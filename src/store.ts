import { ref } from "vue";

import * as Nostr from "nostr-tools";
import { RelayPool } from "nostr-relaypool";

export const feedRelays = ["wss://relay-jp.nostr.wirednet.jp/"];

export const profileRelays = [
  "wss://bostr.nokotaro.com/",
  "wss://ipv6.nostr.wirednet.jp/",
  "wss://nos.lol/",
  "wss://nostr-pub.wellorder.net/",
  "wss://nostr-relay.nokotaro.com/",
  "wss://nostr.fediverse.jp",
  "wss://nostr.holybea.com/",
  "wss://nostream.ocha.one/",
  "wss://nrelay-jp.c-stellar.net",
  "wss://nrelay.c-stellar.net",
  "wss://offchain.pub/",
  "wss://purplepag.es/",
  "wss://r.kojira.io/",
  "wss://relay-jp.nostr.wirednet.jp/",
  "wss://relay-jp.shino3.net/",
  "wss://relay.damus.io/",
  "wss://relay.nostr.band/",
  "wss://relay.nostr.wirednet.jp/",
  "wss://relay.snort.social/",
  "wss://yabu.me/",
];

const DOH_RESOLVE_ENDPOINT = "https://dns.google/resolve";
const DNS_SAFE_TTL_MS = 30 * 60 * 1000;
const DNS_UNSAFE_TTL_MS = 60 * 60 * 1000;

interface DnsResolveAnswer {
  data?: string;
  type?: number;
}

interface DnsResolveResponse {
  Status?: number;
  Answer?: DnsResolveAnswer[];
}

interface RelayHostnameSafetyCacheEntry {
  isSafe: boolean;
  expiresAt: number;
  reason?: string;
}

interface RelayHostnameSafetyResult {
  isSafe: boolean;
  reason?: string;
}

const relayHostnameSafetyCache = new Map<string, RelayHostnameSafetyCacheEntry>();

function logSanitizedRelay(url: string, reason: string): void {
  console.log("sanitizeRelayUrls: skipped relay", { url, reason });
}

function isPrivateIpv4Address(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((p) => p === "")) {
    return false;
  }

  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = nums;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateRelay(url: string): boolean {
  return getPrivateRelayReason(url) !== undefined;
}

function getPrivateRelayReason(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return "localhost relay is not allowed";
    }

    if (isPrivateIpv4Address(hostname)) {
      return "private/local IPv4 relay is not allowed";
    }

    // IPv6 loopback (::1), unique local (fc00::/7), and link-local (fe80::/10)
    if (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe8") || hostname.startsWith("fe9") || hostname.startsWith("fea") || hostname.startsWith("feb")) {
      return "private/local IPv6 relay is not allowed";
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function shouldAttemptDohLookup(hostname: string): boolean {
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    return false;
  }

  if (hostname.endsWith(".local") || hostname.endsWith(".home.arpa")) {
    return false;
  }

  return !isPrivateIpv4Address(hostname);
}

function parseIpv6Address(raw: string): string {
  return raw.replace(/^\[|\]$/g, "").toLowerCase();
}

function isPrivateIpv6Address(address: string): boolean {
  const a = parseIpv6Address(address);
  return a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe8") || a.startsWith("fe9") || a.startsWith("fea") || a.startsWith("feb");
}

function parseHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function getCachedRelayHostnameSafety(hostname: string): RelayHostnameSafetyCacheEntry | undefined {
  const cached = relayHostnameSafetyCache.get(hostname);
  if (!cached) {
    return undefined;
  }
  if (cached.expiresAt < Date.now()) {
    relayHostnameSafetyCache.delete(hostname);
    return undefined;
  }
  return cached;
}

function cacheRelayHostnameSafety(hostname: string, isSafe: boolean, reason?: string): void {
  relayHostnameSafetyCache.set(hostname, {
    isSafe,
    expiresAt: Date.now() + (isSafe ? DNS_SAFE_TTL_MS : DNS_UNSAFE_TTL_MS),
    reason,
  });
}

function getUnsafeDnsAnswerAddress(answers: DnsResolveAnswer[] | undefined): string | undefined {
  if (!answers || answers.length === 0) {
    return undefined;
  }

  for (const answer of answers) {
    const data = (answer.data || "").trim();
    if (!data) {
      continue;
    }
    if (isPrivateIpv4Address(data) || isPrivateIpv6Address(data)) {
      return data;
    }
  }

  return undefined;
}

async function resolveRelayHostnameSafety(hostname: string): Promise<RelayHostnameSafetyResult | undefined> {
  try {
    const queries = ["A", "AAAA"];
    const responses = await Promise.all(
      queries.map(async (q) => {
        const res = await fetch(`${DOH_RESOLVE_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${q}`);
        if (!res.ok) {
          return undefined;
        }
        return (await res.json()) as DnsResolveResponse;
      })
    );

    const validResponses = responses.filter((r): r is DnsResolveResponse => !!r);
    if (validResponses.length === 0) {
      return undefined;
    }

    if (validResponses.some((r) => r.Status === 3)) {
      return { isSafe: false, reason: "DoH returned NXDOMAIN" };
    }

    for (const response of validResponses) {
      const unsafeAddress = getUnsafeDnsAnswerAddress(response.Answer);
      if (unsafeAddress) {
        return { isSafe: false, reason: `DoH resolved to private/local address (${unsafeAddress})` };
      }
    }

    const hasAnswer = validResponses.some((r) => !!r.Answer && r.Answer.length > 0);
    if (!hasAnswer) {
      return undefined;
    }

    return { isSafe: true };
  } catch {
    return undefined;
  }
}

async function warmupRelayHostnameSafetyByHostname(hostname: string): Promise<void> {
  if (!shouldAttemptDohLookup(hostname) || getCachedRelayHostnameSafety(hostname)) {
    return;
  }

  const resolved = await resolveRelayHostnameSafety(hostname);
  if (resolved !== undefined) {
    cacheRelayHostnameSafety(hostname, resolved.isSafe, resolved.reason);
  }
}

export async function warmupRelayHostnameSafety(urls: string[]): Promise<void> {
  const normalized = urls
    .map((url) => {
      let u = url;

      if (u.startsWith("http://")) { u = u.replace("http://", "ws://"); }
      else if (u.startsWith("https://")) { u = u.replace("https://", "wss://"); }
      else if (!(u.startsWith("ws://") || u.startsWith("wss://"))) { u = "wss://" + u; }

      return Nostr.utils.normalizeURL(u);
    })
    .filter((url) => !isPrivateRelay(url));

  const hostnames = new Set<string>();
  for (const url of normalized) {
    const hostname = parseHostname(url);
    if (hostname) {
      hostnames.add(hostname);
    }
  }

  await Promise.all(Array.from(hostnames).map((hostname) => warmupRelayHostnameSafetyByHostname(hostname)));
}

export function __resetRelayHostnameSafetyCacheForTests(): void {
  relayHostnameSafetyCache.clear();
}

export function sanitizeRelayUrls(urls: string[]): string[] {
  return urls
    .map((url) => {
      let u = url;

      if (u.startsWith("http://")) { u = u.replace("http://", "ws://"); }
      else if (u.startsWith("https://")) { u = u.replace("https://", "wss://"); }
      else if (!(u.startsWith("ws://") || u.startsWith("wss://"))) { u = "wss://" + u; }

      return Nostr.utils.normalizeURL(u);
    })
    .filter((url) => {
      const reason = getPrivateRelayReason(url);
      if (reason) {
        logSanitizedRelay(url, reason);
        return false;
      }
      return true;
    })
    .filter((url) => {
      const hostname = parseHostname(url);
      if (!hostname) {
        return true;
      }

      const cached = getCachedRelayHostnameSafety(hostname);
      if (cached) {
        if (!cached.isSafe) {
          logSanitizedRelay(url, cached.reason || "DoH cache marked relay as unsafe");
        }
        return cached.isSafe;
      }

      if (shouldAttemptDohLookup(hostname)) {
        void warmupRelayHostnameSafetyByHostname(hostname);
      }

      return true;
    });
}

export const pool = new RelayPool(sanitizeRelayUrls(feedRelays), {
  autoReconnect: true,
  logErrorsAndNotices: true,
  subscriptionCache: true,
  useEventCache: true,
  skipVerification: false,
});
pool.onerror((url, msg) => {
  console.log("pool.error", url, msg);
});
pool.onnotice((url, msg) => {
  console.log("pool.onnotice", url, msg);
});
pool.ondisconnect((url, msg) => {
  console.log("pool.ondisconnect", url, msg);
});

export interface NostrEvent {
  id: string;
  sig: string;
  pubkey: string;
  kind: Nostr.Kind | number;
  content: string;
  rawEvent?: Nostr.Event;
  tags: string[][];
  created_at: number;
  isReposted: Boolean | undefined;
  isFavorited: Boolean | undefined;
}

export const events = ref(new Array<NostrEvent>());
export const eventsToSearch = ref(new Array<NostrEvent>());
export const eventsReceived = ref(new Map<string, NostrEvent | Nostr.Event>());
export const loggedIn = ref(false);
