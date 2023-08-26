import { ref } from "vue";

import * as Nostr from "nostr-tools";
import { RelayPool } from "nostr-relaypool";

export const feedRelays = ["wss://relay-jp.nostr.wirednet.jp/"];

export const pool = new RelayPool(normalizeUrls(feedRelays), {
  autoReconnect: true,
  logErrorsAndNotices: true,
  subscriptionCache: true,
  useEventCache: true,
});
pool.onerror((url, msg) => { console.log("pool.error", url, msg) });
pool.onnotice((url, msg) => { console.log("pool.onnotice", url, msg) });
pool.ondisconnect((url, msg) => { console.log("pool.ondisconnect", url, msg) });

export function normalizeUrls(urls: string[]): string[] {
  return urls.map((url) => (Nostr.utils.normalizeURL(url)));
}

export interface NostrEvent {
  id: string,
  sig: string,
  pubkey: string,
  kind: Nostr.Kind | number,
  content: string,
  tags: string[][],
  created_at: number,
  isReposted: Boolean | undefined,
  isFavorited: Boolean | undefined,
};

export const events = ref(new Array<NostrEvent>());
export const eventsToSearch = ref(new Array<NostrEvent>());
export const eventsReceived = ref(new Map<string, NostrEvent>());
