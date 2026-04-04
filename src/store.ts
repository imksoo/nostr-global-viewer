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
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return true;
    }

    if (isPrivateIpv4Address(hostname)) {
      return true;
    }

    // IPv6 loopback (::1), unique local (fc00::/7), and link-local (fe80::/10)
    return hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe8") || hostname.startsWith("fe9") || hostname.startsWith("fea") || hostname.startsWith("feb");
  } catch {
    return false;
  }
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
    .filter((url) => !isPrivateRelay(url));
}

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
