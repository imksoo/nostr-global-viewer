import { ref } from "vue";
import * as nostr from "nostr-tools";
import { RelayPool } from "nostr-relaypool";

import { speakNote } from '../hooks/useSpeakNote';

const pool = new RelayPool(undefined, {
  autoReconnect: true,
  logErrorsAndNotices: true,
  subscriptionCache: true,
  useEventCache: true,
});
const feedRelays = ["wss://relay-jp.nostr.wirednet.jp/"];

const events = ref(new Array<nostr.Event>());
const eventsToSearch = ref(new Array<nostr.Event>());
const eventsReceived = new Set<string>();

let firstFetching = true;
let autoSpeech = ref(false);
let volume = ref(0.5);

const totalNumberOfEventsToKeep = 5000;

function addEvent(event: nostr.Event): void {
  if (eventsReceived.has(event.id)) {
    return;
  }
  eventsReceived.add(event.id);
  eventsToSearch.value = nostr.utils.insertEventIntoDescendingList(eventsToSearch.value, event);
  eventsToSearch.value.slice(-totalNumberOfEventsToKeep);
  if (
    !firstFetching &&
    autoSpeech.value &&
    events.value.some((obj) => {
      return obj.id === event.id;
    })
  ) {
    speakNote(event, getProfile(event.pubkey), volume.value);
  }
}

let oldEventCacheMismatch = false;
let cacheMissHitEventIds = new Set<string>();

export function getEvent(id: string): nostr.Event | undefined {
  const event = eventsToSearch.value.find((e) => (e.id === id));

  if (!event) {
    oldEventCacheMismatch = true;
    cacheMissHitEventIds.add(id);
  }
  return event;
}

async function collectEvents() {
  if (!oldEventCacheMismatch) {
    return;
  }

  const eventIds = Array.from(cacheMissHitEventIds).filter((e) => (!eventsReceived.has(e)));
  cacheMissHitEventIds.clear();

  pool.subscribe(
    [
      {
        ids: eventIds
      },
    ],
    normalizeUrls([...feedRelays]),
    async (ev, _isAfterEose, _relayURL) => {
      addEvent(ev);
    },
  );
}
setInterval(collectEvents, 1000);

// ローカルストレージからプロフィール情報を読み出しておく
const profiles = ref(
  new Map<string, any>(JSON.parse(localStorage.getItem("profiles") ?? "[]"))
);
let oldProfileCacheMismatch = false;
let cacheMissHitPubkeys: string[] = [];

type Profile = {
  pubkey: string,
  picture: string,
  display_name: string,
  name: string,
  created_at: number,
};

export function getProfile(pubkey: string): Profile {
  if (!profiles.value.has(pubkey)) {
    oldProfileCacheMismatch = true;
    cacheMissHitPubkeys.push(pubkey);

    profiles.value.set(pubkey, {
      pubkey: pubkey,
      picture: "https://placehold.jp/60x60.png",
      display_name: "",
      name: "",
      created_at: 0,
    });
  }
  return profiles.value.get(pubkey);
}

async function collectProfiles() {
  if (!oldProfileCacheMismatch) {
    return;
  }

  const pubkeySet = new Set<string>();
  for (const e of events.value) {
    pubkeySet.add(e.pubkey);
  }
  for (const p of cacheMissHitPubkeys) {
    pubkeySet.add(p);
  }
  cacheMissHitPubkeys.length = 0;
  const pubkeys = Array.from(pubkeySet);
  pool.subscribe(
    [
      {
        kinds: [0],
        authors: pubkeys,
      },
    ],
    normalizeUrls([...feedRelays]),
    async (ev, _isAfterEose, _relayURL) => {
      if (ev.kind === 0) {
        const content = JSON.parse(ev.content);
        if (
          !profiles.value.has(ev.pubkey) ||
          profiles.value.get(ev.pubkey)?.created_at < ev.created_at
        ) {
          const press = {
            pubkey: ev.pubkey,
            picture: content.picture,
            display_name: content.display_name,
            name: content.name,
            created_at: ev.created_at,
          };
          profiles.value.set(ev.pubkey, press);
        }
        pool.publish(ev, feedRelays);
      }
    },
    undefined,
    async () => {
      oldProfileCacheMismatch = false;

      // ローカルストレージにプロフィール情報を保存しておく
      const validProfiles = Array.from(profiles.value.entries()).filter((p) => (p[1].created_at != 0));
      localStorage.setItem(
        "profiles",
        JSON.stringify(validProfiles)
      );
    },
    { unsubscribeOnEose: true }
  );
}
setInterval(collectProfiles, 1000);

function normalizeUrls(urls: string[]): string[] {
  return urls.map((url) => (nostr.utils.normalizeURL(url)));
}
