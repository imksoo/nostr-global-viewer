<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import * as Nostr from "nostr-tools";
import { RelayPool } from "nostr-relaypool";
import { NostrFetcher } from "nostr-fetch";
import { useRoute } from "vue-router";

import { playActionSound, playReactionSound } from '../hooks/usePlaySound';
import { getRandomProfile } from '../hooks/useEmojiProfiles';
import { speakNote } from '../hooks/useSpeakNote';
import { createFavEvent, createRepostEvent } from '../hooks/useFavRepost';

import IndexTitleControl from "../components/IndexTitleControl.vue";
import IndexIntroControl from "../components/IndexIntroControl.vue";
import SoundEffectControl from "../components/SoundEffectControl.vue";
import AutoSpeechControl from "../components/AutoSpeechControl.vue";
import SearchWordControl from "../components/SearchWordControl.vue";

import RelayStatus from "../components/RelayStatus.vue";
import RiverStatus from "../components/RiverStatus.vue";
import FeedProfile from "../components/FeedProfile.vue";
import FeedReplies from "../components/FeedReplies.vue";
import FeedContent from "../components/FeedContent.vue";
import FeedFooter from "../components/FeedFooter.vue";
import HeaderProfile from "../components/HeaderProfile.vue"

const route = useRoute();
let sushiMode = ref(false);
let mahjongMode = ref(false);

const feedRelays = ["wss://relay-jp.nostr.wirednet.jp/"];
let profileRelays = [
  "wss://nos.lol/",
  "wss://nostr-pub.wellorder.net/",
  "wss://nostr-relay.nokotaro.com/",
  "wss://nostr.fediverse.jp",
  "wss://nostr.holybea.com/",
  "wss://nrelay-jp.c-stellar.net",
  "wss://nrelay.c-stellar.net",
  "wss://offchain.pub/",
  "wss://r.kojira.io/",
  "wss://relay-jp.nostr.wirednet.jp/",
  "wss://relay.current.fyi/",
  "wss://relay.damus.io/",
  "wss://relay.nostr.band/",
  "wss://relay.nostr.wirednet.jp/",
  "wss://relay.snort.social/",
  "wss://yabu.me/",
];

const pool = new RelayPool(normalizeUrls(feedRelays), {
  autoReconnect: true,
  logErrorsAndNotices: true,
  subscriptionCache: true,
  useEventCache: true,
});
pool.onerror((url, msg) => { console.log("pool.error", url, msg) });
pool.onnotice((url, msg) => { console.log("pool.onnotice", url, msg) });
pool.ondisconnect((url, msg) => { console.log("pool.ondisconnect", url, msg) });

type NostrEvent = {
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

const events = ref(new Array<NostrEvent>());
const eventsToSearch = ref(new Array<NostrEvent>());
const eventsReceived = ref(new Map<string, NostrEvent>());

let firstFetching = true;
let autoSpeech = ref(false);
let volume = ref("0.5");
let searchWords = ref("");
let soundEffect = ref(true);

const totalNumberOfEventsToKeep = 5000;
const initialNumberOfEventToGet = 500;
let countOfDisplayEvents = 100;

const japaneseFollowBotPubkey = "087c51f1926f8d3cb4ff45f53a8ee2a8511cfe113527ab0e87f9c5821201a61e";
let japaneseUsers: string[] = [];
function collectJapaneseUsers() {
  const unsub = pool.subscribe(
    [{ kinds: [3], authors: [japaneseFollowBotPubkey], limit: 1 }],
    [...new Set(normalizeUrls(profileRelays))],
    (ev, _isAfterEose, _relayURL) => {
      if (ev.kind === 3 && ev.tags && npubRelaysCreatedAt < ev.created_at) {
        japaneseUsers = ev.tags.filter((t) => (t[0] === 'p')).map((t) => (t[1]));
      }
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
  setTimeout(() => { unsub() }, 10 * 1000);
}
collectJapaneseUsers();

let isKirinoRiver = ref<boolean>(feedRelays.some((e) => (e.includes("relay-jp.nostr.wirednet.jp"))));
const ryuusokuChanBotPubkey = "a3c13ef4c9eccfde01bd9326a2ab08b2ad7dc57f3b77db77723f8e2ad7ba24d6";
let ryuusokuChanData = ref<[string, string][]>([["", ""]]);
function collectRyuusokuChan() {
  const poolRiver = new RelayPool(normalizeUrls(feedRelays), {});
  poolRiver.subscribe(
    // @ts-ignore
    [{ kinds: [30078], authors: [ryuusokuChanBotPubkey], "#d": ["nostr-arrival-rate_kirino"], "#t": ["nostr-arrival-rate_kirino"], limit: 1 }],
    [...new Set(normalizeUrls(feedRelays))],
    (ev, _isAfterEose, _relayURL) => {
      ryuusokuChanData.value.length = 0;
      ryuusokuChanData.value = ev.tags.slice(-10) as [string, string][];
      ryuusokuChanData.value.splice(ryuusokuChanData.value.length);
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
  setTimeout(() => { poolRiver.close(); }, 5 * 1000);
}
if (isKirinoRiver) {
  collectRyuusokuChan();
  setInterval(() => {
    collectRyuusokuChan();
  }, 30 * 1000);
}

let noteId = ref<string | undefined>();
let npubId = ref<string | undefined>();
let npubDate = ref<Date | undefined>();
let npubDateYesterday = ref<Date | undefined>();
let npubDateTomorrow = ref<Date | undefined>();
let npubMode = ref<string>("");
let npubProfile = ref();
let cutoffMode = ref<boolean>(true);

let npubRelaysCreatedAt = 0;
let npubReadRelays: string[] = [];
let npubWriteRelays: string[] = [];
watch(() => route.query, async (newQuery) => {
  const nostrRegex = /(nostr:|@)?(nprofile|nrelay|nevent|naddr|nsec|npub|note)1[023456789acdefghjklmnpqrstuvwxyz]{6,}/

  sushiMode.value = (route.query.sushi === "on");
  mahjongMode.value = (route.query.mahjong === "on");
  for (let key in newQuery) {
    if (key.match(nostrRegex)) {
      try {
        const data = Nostr.nip19.decode(key.replace('nostr:', '').replace('@', ''));
        switch (data.type) {
          case "nevent": {
            noteId.value = data.data.id;
          } break;
          case "note": {
            noteId.value = data.data;
          } break;
          case "nprofile": {
            npubId.value = data.data.pubkey;
          } break;
          case "npub": {
            npubId.value = data.data;
          }
        }
      } catch (err) {
        console.error(err);
      }
    } else if (key === 'date') {
      const datestr = route.query[key];
      if (datestr) {
        const year = Number(datestr.slice(0, 4));
        const month = Number(datestr.slice(4, 6));
        const day = Number(datestr.slice(6, 8));
        npubDate.value = new Date(year, month - 1, day);
      }
    }
  }

  if (npubId.value) {
    pool.subscribe(
      [{
        kinds: [0],
        limit: 1,
        authors: [npubId.value]
      }],
      [...new Set(normalizeUrls([...feedRelays]))],
      async (ev, _isAfterEose, relayURL) => {
        const profile = JSON.parse(ev.content);
        npubProfile.value = profile;
      },
      undefined,
      undefined,
      { unsubscribeOnEose: true }
    );
  }

  if ((!npubId.value && !noteId.value) || (noteId.value) || (npubId.value && !npubDate.value)) {
    const timelineFilter = (noteId.value) ? {
      kinds: [1, 6],
      limit: initialNumberOfEventToGet,
      ids: [noteId.value],
    } : (npubId.value) ? {
      kinds: [1],
      limit: countOfDisplayEvents,
      authors: [npubId.value]
    } : {
      kinds: [1, 6],
      limit: initialNumberOfEventToGet,
    };
    pool.subscribe(
      [
        timelineFilter
      ],
      [...new Set(normalizeUrls([...feedRelays]))],
      async (ev, _isAfterEose, relayURL) => {
        if (relayURL !== undefined && !feedRelays.includes(relayURL) && !eventsReceived.value.has(ev.id) && ev.content.match(/[亜-熙ぁ-んァ-ヶ]/)) {
          pool.publish(ev, normalizeUrls(feedRelays));
        }

        addEvent(ev);
      },
      undefined,
      () => {
        collectProfiles();
        if (firstFetching) {
          firstFetching = false;
        }
      }
    );

    if (npubId.value && !npubDate.value) {
      npubMode.value = `直近の ${countOfDisplayEvents} 件の投稿を表示しています。(リンクを押すと日付別モードに変わります)`;

      let now = new Date();
      now.setHours(0, 0, 0, 0);
      const targetDate = now;

      npubDate.value = new Date(targetDate.getTime());
      npubDateYesterday.value = new Date(targetDate.getTime());
      npubDateYesterday.value.setDate(npubDateYesterday.value.getDate() - 1);
      npubDateTomorrow.value = new Date(targetDate.getTime());
      npubDateTomorrow.value.setDate(npubDateTomorrow.value.getDate() + 1);
    }
  } else if (npubId.value) {
    let now = new Date();
    now.setHours(0, 0, 0, 0);
    const targetDate = npubDate.value ? npubDate.value : now;

    cutoffMode.value = false;

    npubDate.value = new Date(targetDate.getTime());
    npubDateYesterday.value = new Date(targetDate.getTime());
    npubDateYesterday.value.setDate(npubDateYesterday.value.getDate() - 1);
    npubDateTomorrow.value = new Date(targetDate.getTime());
    npubDateTomorrow.value.setDate(npubDateTomorrow.value.getDate() + 1);

    const since = Math.floor(targetDate.getTime() / 1000) - 1;
    const until = Math.floor(npubDateTomorrow.value.getTime() / 1000) + 1;
    const unsub1 = pool.subscribe(
      [{
        kinds: [1, 6, 7],
        authors: [npubId.value],
        since, until,
      }],
      [...new Set(normalizeUrls([...feedRelays]))],
      async (ev, _isAfterEose, relayURL) => {
        if (since <= ev.created_at && ev.created_at <= until) {
          npubMode.value = `${targetDate.toLocaleDateString()} の投稿 ${events.value.length} 件 を表示しています。`;
          addEvent(ev);
        }
      },
      undefined,
      undefined,
      { unsubscribeOnEose: true }
    );
    setTimeout(() => { unsub1() }, 60 * 1000);

    let searchRelays = [...feedRelays, ...profileRelays, ...myWriteRelays, ...myReadRelays];
    const unsub2 = pool.subscribe(
      [{ kinds: [3, 10002], authors: [npubId.value], limit: 1 }],
      [...new Set(normalizeUrls(profileRelays))],
      (ev, _isAfterEose, _relayURL) => {
        if (ev.kind === 3 && ev.content && npubRelaysCreatedAt < ev.created_at) {
          npubReadRelays.slice(0);
          npubWriteRelays.slice(0);
          npubRelaysCreatedAt = ev.created_at;
          const content = JSON.parse(ev.content);
          for (const r in content) {
            npubReadRelays.push(r);
            if (content[r].write) {
              npubWriteRelays.push(r);
            }
          }
        } else if (ev.kind === 10002 && npubRelaysCreatedAt < ev.created_at) {
          npubReadRelays.slice(0);
          npubWriteRelays.slice(0);
          npubRelaysCreatedAt = ev.created_at;
          for (const t in ev.tags) {
            let r = t[1];
            let m = "";
            if (t.length > 2) { m = t[2] }
            if (t[0] === "r") {
              if (m === "read") {
                npubReadRelays.push(r);
              } else {
                npubReadRelays.push(r);
                npubWriteRelays.push(r);
              }
            }
          }
        }
      },
      undefined,
      undefined,
      { unsubscribeOnEose: true }
    );
    setTimeout(() => { unsub2() }, 5000);

    collectUserDailyEvents(npubId.value, searchRelays, targetDate);
    setTimeout(async () => {
      if (npubId.value) {
        let searchRelays = [...npubReadRelays, ...npubWriteRelays];
        collectUserDailyEvents(npubId.value, searchRelays, targetDate);
      }
    }, 5000);
  }
});

// 指定されたユーザーのその一日のイベントを取得する
async function collectUserDailyEvents(pubkey: string, relays: string[], targetDate: Date) {
  const profile = getProfile(pubkey);

  const fetcher = NostrFetcher.init();

  let nextDay = new Date(targetDate.getTime());
  nextDay.setDate(nextDay.getDate() + 1);

  const since = Math.floor(targetDate.getTime() / 1000);
  const until = Math.floor(nextDay.getTime() / 1000);

  const eventsIter = fetcher.allEventsIterator(
    [...new Set(normalizeUrls(relays))],
    { kinds: [1, 5, 6, 7], authors: [pubkey] },
    { since, until }
  );

  for await (const ev of eventsIter) {
    if (since <= ev.created_at && ev.created_at <= until) {
      const usertext = profile.display_name + profile.name + ev.content;
      const japaneseRegex = /[亜-熙ぁ-んァ-ヶ]/;
      if (ev.kind === 5) {
        for (let i = 0; i < ev.tags.length; ++i) {
          const t = ev.tags[i];
          if (t[0] === "e") {
            cacheBlacklistEventIds.add(t[1]);
          }
        }
        pool.publish(ev, [...new Set(normalizeUrls([...relays, ...feedRelays, ...myWriteRelays]))]);
      } else if (!eventsReceived.value.has(ev.id) && (usertext.match(japaneseRegex) || japaneseUsers.includes(ev.pubkey))) {
        pool.publish(ev, normalizeUrls(feedRelays));
      }

      if (ev.kind !== 5) {
        addEvent(ev);
      }
      npubMode.value = `${targetDate.toLocaleDateString()} の投稿 ${events.value.length} 件 を表示しています。(全リレー探索済み)`;
    }
  }
}

function addEvent(event: NostrEvent | Nostr.Event): void {
  if (eventsReceived.value.has(event.id) || event.kind === 3 || event.kind === 5) {
    return;
  }
  eventsReceived.value.set(event.id, event as NostrEvent);
  eventsToSearch.value = Nostr.utils.insertEventIntoDescendingList(eventsToSearch.value, event) as NostrEvent[];
  if (cutoffMode.value) {
    eventsToSearch.value.slice(-totalNumberOfEventsToKeep);
  }
  searchAndBlockFilter();
  if (
    !firstFetching &&
    autoSpeech.value &&
    events.value.some((obj) => {
      return obj.id === event.id;
    })
  ) {
    speakNote(event, getProfile(event.pubkey), volume.value.toString());
  }
}

let cacheMissHitEventIds = new Set<string>();
let cacheBlacklistEventIds = new Set<string>();

function getEvent(id: string): Nostr.Event | undefined {
  if (myBlockedEvents.has(id)) {
    return undefined;
  }
  if (eventsReceived.value.has(id)) {
    const ev = eventsReceived.value.get(id);
    if (ev) {
      if (myBlockList.includes(ev.pubkey)) {
        myBlockedEvents.add(ev.id);
        console.log("Blocked by pubkey:", ev.pubkey, getProfile(ev.pubkey).display_name, `kind=${ev.kind}`, ev.content);
        return undefined;
      } else {
        return eventsReceived.value.get(id);
      }
    }
    return undefined;
  } else {
    cacheMissHitEventIds.add(id);
    return eventsReceived.value.get(id);
  }
}

async function collectEvents() {
  if (cacheMissHitEventIds.size === 0) {
    return;
  }

  const eventIds = Array.from(cacheMissHitEventIds).filter((ev) => (!eventsToSearch.value.find((e) => (e.id === ev)) && !cacheBlacklistEventIds.has(ev)));
  if (eventIds.length === 0) {
    return;
  }

  const unsub = pool.subscribe(
    [{
      ids: eventIds
    }],
    [...new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays, ...myReadRelays, ...npubReadRelays, ...npubWriteRelays]))],
    async (ev, _isAfterEose, relayURL) => {
      cacheMissHitEventIds.delete(ev.id);
      addEvent(ev);

      if (!eventsReceived.value.has(ev.id) && ev.content.match(/[亜-熙ぁ-んァ-ヶ]/)) {
        pool.publish(ev, normalizeUrls(feedRelays));
      }
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
  setTimeout(() => { unsub() }, 3 * 1000);
}
setInterval(collectEvents, 0.6 * 1000);

// ローカルストレージからプロフィール情報を読み出しておく
const profiles = ref(
  new Map<string, any>(JSON.parse(localStorage.getItem("profiles") ?? "[]"))
);
let cacheMissHitPubkeys = new Set<string>()

type Profile = {
  pubkey: string,
  picture: string,
  display_name: string,
  name: string,
  created_at: number,
};

function getProfile(pubkey: string): Profile {
  if (!profiles.value.has(pubkey)) {
    cacheMissHitPubkeys.add(pubkey);

    profiles.value.set(pubkey, {
      pubkey: pubkey,
      picture: "https://placehold.jp/60x60.png",
      display_name: "",
      name: "",
      created_at: 0,
    });
  }
  if (sushiMode.value || mahjongMode.value) {
    return getRandomProfile(pubkey, sushiMode.value, mahjongMode.value);
  }
  return profiles.value.get(pubkey);
}

async function collectProfiles(force = false) {
  if (!force || cacheMissHitPubkeys.size === 0) {
    return;
  }

  const pubkeys = [...new Set<string>([...events.value.map(e => e.pubkey), ...cacheMissHitPubkeys])];
  const unsub = pool.subscribe(
    [{
      kinds: [0],
      authors: pubkeys,
    }],
    [...new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays, ...myReadRelays]))],
    async (ev, _isAfterEose, _relayURL) => {
      if (ev.kind === 0) {
        const content = JSON.parse(ev.content);

        pool.publish(ev, feedRelays);
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
          cacheMissHitPubkeys.delete(ev.pubkey);
        }
      }
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
  setTimeout(() => { unsub() }, 2 * 1000);
}
setInterval(() => { collectProfiles(false); }, 0.7 * 1000);
setInterval(() => { collectProfiles(true); }, 4.5 * 1000);

setInterval(() => {
  // ローカルストレージにプロフィール情報を保存しておく
  const validProfiles = Array.from(profiles.value.entries()).filter((p) => (p[1].created_at != 0));
  localStorage.setItem(
    "profiles",
    JSON.stringify(validProfiles)
  );
}, 2 * 1000);

let logined = ref(false);
let isPostOpen = ref(false);
let myPubkey = "";
let myRelaysCreatedAt = 0;
let myReadRelays: string[] = [];
let myWriteRelays: string[] = [];
let firstReactionFetching = true;
let firstReactionFetchedRelays = 0;
let myFollows: string[] = [];
let myBlockCreatedAt = 0;
let myBlockList: string[] = [];
let myBlockedEvents = new Set<string>();
async function login() {
  // @ts-ignore
  myPubkey = (await window.nostr?.getPublicKey()) ?? "";

  if (myPubkey) {
    logined.value = true;
    countOfDisplayEvents *= 2;
    collectMyRelay();
    collectMyBlockList();
    if (!noteId.value && !npubId.value) {
      setTimeout(() => {
        collectFollowsAndSubscribe();
        subscribeReactions();
      }, 1000);
    }
  }
}

function autoLogin() {
  let retryCount = 0;
  const checkNIP07Extention = setInterval(() => {
    // @ts-ignore
    if (window.nostr) {
      login();
      clearInterval(checkNIP07Extention);
    }
    ++retryCount;

    if (retryCount > 60) {
      clearInterval(checkNIP07Extention);
    }
  }, 500);
}
autoLogin();

function collectMyRelay() {
  const unsub = pool.subscribe(
    [
      {
        kinds: [3, 10002],
        authors: [myPubkey],
        limit: 1,
      },
    ],
    [... new Set(normalizeUrls([...feedRelays, ...profileRelays]))],
    (ev, _isAfterEose, _relayURL) => {
      if (ev.kind === 3 && ev.content && myRelaysCreatedAt < ev.created_at) {
        myReadRelays.slice(0);
        myWriteRelays.slice(0);
        myRelaysCreatedAt = ev.created_at;
        const content = JSON.parse(ev.content);
        for (const r in content) {
          myReadRelays.push(r);
          if (content[r].write) {
            myWriteRelays.push(r);
          }
        }
      } else if (ev.kind === 10002 && myRelaysCreatedAt < ev.created_at) {
        myReadRelays.slice(0);
        myWriteRelays.slice(0);
        myRelaysCreatedAt = ev.created_at;
        for (let i = 0; i < ev.tags.length; ++i) {
          const t = ev.tags[i];
          if (t[0] === "r") {
            const r = t[1];
            let m = "";

            if (t.length > 2) { m = t[2]; }
            if (m === "read") {
              myReadRelays.push(r);
            } else {
              myReadRelays.push(r);
              myWriteRelays.push(r);
            }
          }
        }
      }
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
  setTimeout(() => { unsub() }, 30 * 1000);
}

function collectMyBlockList() {
  const unsub = pool.subscribe(
    [{
      // @ts-ignore
      kinds: [10000, 30000],
      authors: [myPubkey],
    }],
    [... new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myReadRelays, ...myWriteRelays]))],
    async (ev, _isAfterEose, _relayURL) => {
      // @ts-ignore
      if (myBlockCreatedAt < ev.created_at && ((ev.kind === 10000) || (ev.kind === 30000 && ev.tags[0][0] === "d" && ev.tags[0][1] === "mute"))) {
        myBlockCreatedAt = ev.created_at;
        // @ts-ignore
        const blockListJSON = (await window.nostr?.nip04.decrypt(myPubkey, ev.content)) || "[]";
        const blockList = JSON.parse(blockListJSON);
        let blocks: string[] = [];
        for (let i = 0; i < blockList.length; ++i) {
          if (blockList[i][0] === 'p') {
            blocks.push(blockList[i][1]);
          }
        }
        for (let i = 0; i < ev.tags.length; ++i) {
          if (ev.tags[i][0] === 'p') {
            blocks.push(ev.tags[i][1]);
          }
        }
        myBlockList = [... new Set(blocks)];
      }
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
  setTimeout(() => { unsub() }, 30 * 1000);
}

async function collectFollowsAndSubscribe() {
  const contactList = await pool.fetchAndCacheContactList(myPubkey);
  myFollows = contactList.tags.filter((t) => (t[0] === 'p')).map((t) => (t[1]));

  const subscribeMaxCount = 1000;
  for (let begin = 0; begin < myFollows.length; begin += subscribeMaxCount) {
    const followList = myFollows.slice(begin, subscribeMaxCount);

    pool.subscribe([
      { kinds: [1, 5], authors: followList, limit: 20 },
    ],
      [...new Set(normalizeUrls(myReadRelays))],
      async (ev, _isAfterEose, _relayURL) => {
        switch (ev.kind) {
          case 1:
            addEvent(ev);
            break;
          case 5:
            for (let i = 0; i < ev.tags.length; ++i) {
              const t = ev.tags[i];
              if (t[0] === "e") {
                cacheBlacklistEventIds.add(t[1]);
              }
            }
            pool.publish(ev, normalizeUrls([...new Set([...feedRelays, ...myWriteRelays])]));
            break;
        }
      }
    );
  }
}

function subscribeReactions() {
  relayStatus.value = pool.getRelayStatuses();

  pool.subscribe([
    { kinds: [1, 6, 7], "#p": [myPubkey], limit: countOfDisplayEvents / 10 },
    { kinds: [6, 7], authors: [myPubkey], limit: countOfDisplayEvents / 10 },
  ],
    [...new Set(normalizeUrls(myReadRelays))],
    async (ev, _isAfterEose, _relayURL) => {
      addEvent(ev);

      if (ev.pubkey !== myPubkey) {
        if (
          !firstReactionFetching &&
          soundEffect.value &&
          !myBlockList.includes(ev.pubkey) &&
          events.value[events.value.length - 1].created_at < ev.created_at
        ) {
          console.log("reactioned", ev);
          playReactionSound();
        }
      } if (ev.pubkey === myPubkey) {
        for (let i = 0; i < ev.tags.length; ++i) {
          const t = ev.tags[i];
          if (t[0] === 'e') {
            const et = t[1];

            if (ev.kind === 6) {
              eventsToSearch.value.filter((ee) => (ee.id === et)).map((ee) => (ee.isReposted = true));
              const ef = eventsReceived.value.get(et);
              if (ef) {
                ef.isReposted = true;
              }
            } else if (ev.kind === 7) {
              eventsToSearch.value.filter((ee) => (ee.id === et)).map((ee) => (ee.isFavorited = true));
              const ef = eventsReceived.value.get(et);
              if (ef) {
                ef.isFavorited = true;
              }
            }
          }
        }
      }
    },
    undefined,
    async () => {
      firstReactionFetchedRelays++;
      if (firstReactionFetchedRelays > myReadRelays.length / 2) {
        setTimeout(() => {
          firstReactionFetching = false;
        }, 10 * 1000);
      }
    }
  );
}

let draftEvent = ref(Nostr.getBlankEvent(Nostr.Kind.Text));
let editingTags = ref(Nostr.getBlankEvent(Nostr.Kind.Text));
async function post() {
  if (!draftEvent.value.content) {
    return;
  }

  draftEvent.value.tags = draftEvent.value.tags.concat(editingTags.value.tags);

  const ev = JSON.parse(JSON.stringify(draftEvent.value));
  ev.created_at = Math.floor(Date.now() / 1000);

  // @ts-ignore
  await postEvent(ev);

  isPostOpen.value = false;
  draftEvent.value = Nostr.getBlankEvent(Nostr.Kind.Text);
}

async function postEvent(event: Nostr.Event) {
  // @ts-ignore
  event = await window.nostr?.signEvent(JSON.parse(JSON.stringify(event)));

  pool.publish(event, normalizeUrls(myWriteRelays));

  if (soundEffect.value) {
    playActionSound();
  }

  addEvent(event);
}

function openReplyPost(reply: Nostr.Event): void {
  // 投稿欄をすべて空っぽにする
  draftEvent.value = Nostr.getBlankEvent(Nostr.Kind.Text);
  const parsedTags = Nostr.nip10.parse(reply);
  if (parsedTags.root) {
    draftEvent.value.tags.push(['e', parsedTags.root.id, "", "root"]);
  }
  for (let i = 0; i < parsedTags.mentions.length; ++i) {
    const e = parsedTags.mentions[i];

    // Damusみたいに古い形式だとrootリプライがないので、最初の1個目をrootとしてみなす
    if (i == 0 && !parsedTags.root) {
      draftEvent.value.tags.push(['e', e.id, "", "root"]);
    } else {
      draftEvent.value.tags.push(['e', e.id, ""]);
    }
  }
  if (parsedTags.reply) {
    draftEvent.value.tags.push(['e', parsedTags.reply.id]);
  }
  if (draftEvent.value.tags.length) {
    draftEvent.value.tags.push(['e', reply.id, "", "reply"]);
  } else {
    draftEvent.value.tags.push(['e', reply.id, "", "root"]);
  }

  for (let i = 0; i < parsedTags.profiles.length; ++i) {
    const p = parsedTags.profiles[i];
    draftEvent.value.tags.push(['p', p.pubkey]);
  }
  draftEvent.value.tags.push(['p', reply.pubkey]);

  isPostOpen.value = true;
}

function openQuotePost(repost: Nostr.Event): void {
  // 投稿欄をすべて空っぽにする
  draftEvent.value = Nostr.getBlankEvent(Nostr.Kind.Text);
  // 投稿欄にnoteidを追加する
  draftEvent.value.content = "\n\nnostr:" + Nostr.nip19.noteEncode(repost.id);

  isPostOpen.value = true;
}

const noteTextarea = ref<HTMLTextAreaElement | null>(null);
watch(isPostOpen, async (isPostOpened) => {
  if (isPostOpened) {
    await nextTick();
    noteTextarea.value?.focus();
    if (noteTextarea.value) {
      noteTextarea.value.selectionStart = 0;
      noteTextarea.value.selectionEnd = 0;
    }
  }
});

function extractTags() {
  editingTags.value.tags.length = 0;
  const regexNostrStr = /(nostr:|@)(nprofile|nrelay|nevent|naddr|nsec|npub|note)1[023456789acdefghjklmnpqrstuvwxyz]{6,}/g
  const nostrStr = draftEvent.value.content.match(regexNostrStr);
  if (nostrStr?.length) {
    for (let i = 0; i < nostrStr.length; ++i) {
      const ns = nostrStr[i];
      try {
        const d = Nostr.nip19.decode(ns.replace('nostr:', '').replace('@', ''));
        switch (d.type) {
          case "nevent": {
            editingTags.value.tags.push(['e', d.data.id])
          } break;
          case "note": {
            editingTags.value.tags.push(['e', d.data])
          } break;
          case "nprofile": {
            editingTags.value.tags.push(['p', d.data.pubkey]);
          } break;
          case "npub": {
            editingTags.value.tags.push(['p', d.data]);
          }
        }
      } catch (err) {
        ;
      }
    }
  }
  const regexHashTag = /#[^\s!@#$%^&*()=+./,\[{\]};:'"?><]+/g;
  const hashTags = draftEvent.value.content.match(regexHashTag);
  if (hashTags?.length) {
    for (let i = 0; i < hashTags?.length; ++i) {
      const t = hashTags[i].replace('#', '');
      editingTags.value.tags.push(['t', t]);
    }
  }

  const regexURL = /https?:\/\/\S+/g;
  const urls = draftEvent.value.content.match(regexURL);
  if (urls?.length) {
    for (let i = 0; i < urls.length; ++i) {
      const u = urls[i];
      editingTags.value.tags.push(['r', u]);
    }
  }
}

function checkSend(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    post();
  }
}

function searchAndBlockFilter() {
  events.value = eventsToSearch.value.filter((e) => {
    const isBlocked = !npubMode.value && myBlockList.includes(e.pubkey);
    if (isBlocked && !myBlockedEvents.has(e.id)) {
      console.log("Blocked by pubkey:", e.pubkey, getProfile(e.pubkey).display_name, `kind=${e.kind}`, e.content);
      myBlockedEvents.add(e.id);
    }

    const searchMatched = searchSubstring(e.content, searchWords.value);

    return !isBlocked && searchMatched;
  });
  if (cutoffMode.value) {
    events.value = events.value.slice(0, countOfDisplayEvents);
  }
  if (events.value.length === 0) {
    events.value[0] = {
      id: "",
      kind: 1,
      created_at: Math.floor(new Date().getTime() / 1000),
      pubkey: "",
      sig: "",
      tags: [],
      content: searchWords.value + " is not found.",
      isFavorited: false,
      isReposted: false,
    };
  }
}

function searchSubstring(inputString: string, searchWords: string): boolean {
  // Convert both strings to lowercase
  inputString = inputString.toLowerCase();
  inputString = inputString.replace(/\s/g, " ");

  // Normalize unicode whitespace characters
  searchWords = searchWords.toLowerCase();
  searchWords = searchWords.replace(/\s/g, " ");

  // Split searchWords into chunks, considering quotes
  let words = searchWords.match(/"[^"]+"|[^\s]+/g) || [];

  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    let isNegative = false;

    // Check if word starts with "-", and remove it if true
    if (word.startsWith("-")) {
      isNegative = true;
      word = word.slice(1);
    }
    // Remove quotes if they exist
    if (word.startsWith('"') && word.endsWith('"')) {
      word = word.slice(1, -1);
    }

    // Check if word is in the string
    const isWordInInputString = inputString.includes(word);

    // If isNegative is true, word should not be in the string, else it should be in the string
    if (
      (isNegative && isWordInInputString) ||
      (!isNegative && !isWordInInputString)
    ) {
      return false;
    }
  }
  // If all conditions are met, return true
  return true;
}

let relayStatus = ref(pool.getRelayStatuses());
setInterval(() => {
  relayStatus.value = pool.getRelayStatuses();
}, 1000);

function normalizeUrls(urls: string[]): string[] {
  return urls.map((url) => (Nostr.utils.normalizeURL(url)));
}

const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const konamiIndex = ref(0);

function handleKeydownShortcuts(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  if (target.tagName.toLowerCase() === 'input' || target.tagName.toLocaleLowerCase() === 'textarea') {
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
    return;
  }

  if (e.key === konamiCode[konamiIndex.value]) {
    console.log("KONAMI COUNT=", konamiIndex.value);
    konamiIndex.value += 1;
  } else {
    konamiIndex.value = 0;
  }

  if (konamiIndex.value === konamiCode.length) {
    console.log("!!!KONAMI COMMAND!!!");
    rotateImages();
    konamiIndex.value = 0;
  }

  if (e.key === 'n' && logined.value && !isPostOpen.value) {
    isPostOpen.value = true;
    e.preventDefault();
    e.stopPropagation();
  } else if (e.key === 'l' && !logined.value) {
    login();
    e.preventDefault();
    e.stopPropagation();
  } else if (e.key === 'l' && logined.value) {
    moveToItemById(focusedItemId.value);
    e.preventDefault();
    e.stopPropagation();
  } else if (e.key === 'j') {
    let currentIndex = events.value.findIndex((e) => (e.id === focusedItemId.value));
    if (currentIndex < 0) {
      currentIndex = focusItemIndex.value;
    }
    const newFocusIndex = currentIndex < events.value.length - 1 ? currentIndex + 1 : events.value.length - 1;
    moveToItemByIndex(newFocusIndex);
  } else if (e.key === 'k') {
    let currentIndex = events.value.findIndex((e) => (e.id === focusedItemId.value));
    if (currentIndex < 0) {
      currentIndex = focusItemIndex.value;
    }
    const newFocusIndex = focusItemIndex.value > 0 ? currentIndex - 1 : 0;
    moveToItemByIndex(newFocusIndex);
  } else if (e.key === 'h') {
    gotoTop();
  } else if (e.key === 'g') {
    focusItemIndex.value = events.value.length - 1;
    focusedItemId.value = events.value[focusItemIndex.value].id;
    if (itemsBottom.value) {
      scrollToItemTop(itemsBottom.value);
    }
  } else if (e.key === 'r' && logined.value && !isPostOpen.value) {
    const targetEvent = events.value.find((e) => (e.id === focusedItemId.value));
    if (targetEvent && targetEvent.kind === 1) {
      e.preventDefault();
      e.stopPropagation();
      openReplyPost(targetEvent);
    }
  } else if (e.key === 'q' && logined.value && !isPostOpen.value) {
    const targetEvent = events.value.find((e) => (e.id === focusedItemId.value));
    if (targetEvent && targetEvent.kind === 1) {
      e.preventDefault();
      e.stopPropagation();
      openQuotePost(targetEvent);
    }
  } else if (e.key === "f" && logined.value && !isPostOpen.value) {
    const targetEvent = events.value.find((e) => (e.id === focusedItemId.value));
    if (targetEvent && targetEvent.kind === 1 && !targetEvent.isFavorited) {
      e.preventDefault();
      e.stopPropagation();
      addFavEvent(targetEvent);
    }
  } else if (e.key === "e" && logined.value && !isPostOpen.value) {
    const targetEvent = events.value.find((e) => (e.id === focusedItemId.value));
    if (targetEvent && targetEvent.kind === 1 && !targetEvent.isReposted) {
      e.preventDefault();
      e.stopPropagation();
      addRepostEvent(targetEvent);
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydownShortcuts);
  Object.values(items.value).forEach((i) => { observer.observe(i as Element) });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydownShortcuts);
  Object.values(items.value).forEach((i) => { observer.unobserve(i as Element) });
})

function addRepostEvent(targetEvent: NostrEvent) {
  const confirmed = window.confirm(`リポストしますか？\n\n"${targetEvent.content}"`);
  if (confirmed) {
    const repost = createRepostEvent(targetEvent) as Nostr.Event;
    pool.publish(targetEvent, normalizeUrls(myWriteRelays));
    postEvent(repost);
    targetEvent.isReposted = true;
  }
}

function addFavEvent(targetEvent: NostrEvent) {
  const confirmed = window.confirm(`ふぁぼりますか？\n\n"${targetEvent.content}"`);
  if (confirmed) {
    const reaction = createFavEvent(targetEvent) as Nostr.Event;
    pool.publish(targetEvent, normalizeUrls(myWriteRelays));
    postEvent(reaction);
    targetEvent.isFavorited = true;
  }
}

function rotateImages() {
  const images = document.getElementsByTagName("img");
  for (let i = 0; i < images.length; i++) {
    images[i].classList.add('rotate')
    images[i].addEventListener('animationend', () => {
      images[i].classList.remove('rotate')
    }, { once: true })
  }
}

function loggingStatistics(): void {
  console.log(JSON.stringify({
    eventsReceivedSize: eventsReceived.value.size,
    eventsToSearchSize: eventsToSearch.value.length,
    blockedPubkeys: myBlockList.length,
    eventsBlocked: myBlockedEvents.size,
    profilesSize: profiles.value.size,
    cacheMissHitPubkeysSize: cacheMissHitPubkeys.size,
    cacheMissHitEventIdsSize: cacheMissHitEventIds.size,
    cacheBlacklistEventIdsSize: cacheBlacklistEventIds.size,
  }));
}
setInterval(loggingStatistics, 30 * 1000);

const items = ref<Record<string, HTMLElement>>({});
const focusItemIndex = ref(0);
const focusedItemId = ref("");
const showFocusBorder = ref(false);
const itemsTop = ref<HTMLElement>();
const itemsBottom = ref<HTMLElement>();
let showFocusBorderTimeoutId: NodeJS.Timeout | undefined = undefined;

const itemFooters = ref<Map<string, any>>(new Map());

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
      const currentElementId = Object.keys(items.value).find(key => items.value[key] === entry.target);
      if (currentElementId) {
        focusedItemId.value = currentElementId;
      }
    }
  });
});

function scrollToItem(el: HTMLElement) {
  // const offsetY = (window.innerHeight - el.getBoundingClientRect().height) / 2;
  const offsetY = 80;
  const yCoodinate = el.getBoundingClientRect().top + window.pageYOffset - offsetY;
  window.scrollTo({ top: yCoodinate, behavior: 'smooth' });
}

function scrollToItemTop(el: HTMLElement) {
  const yCoodinate = el.getBoundingClientRect().top + window.pageYOffset;
  window.scrollTo({ top: yCoodinate, behavior: 'smooth' });
}

function moveToItemById(id: string): void {
  focusedItemId.value = id;
  focusItemIndex.value = events.value.findIndex((e) => (e.id === focusedItemId.value));;
  scrollToItem(items.value[id] as HTMLElement);

  showFocusBorder.value = true;
  clearTimeout(showFocusBorderTimeoutId);
  showFocusBorderTimeoutId = setTimeout(() => { showFocusBorder.value = false }, 1 * 1000);
}

function moveToItemByIndex(index: number): void {
  focusItemIndex.value = index;
  focusedItemId.value = events.value[index].id;
  scrollToItem(items.value[focusedItemId.value] as HTMLElement);

  showFocusBorder.value = true;
  clearTimeout(showFocusBorderTimeoutId);
  showFocusBorderTimeoutId = setTimeout(() => { showFocusBorder.value = false }, 1 * 1000);
}

function gotoTop() {
  focusItemIndex.value = 0;
  focusedItemId.value = events.value[0].id;
  if (itemsTop.value) {
    scrollToItemTop(itemsTop.value);
  }
}
</script>

<template>
  <div class="p-index-wrap">
    <div class="p-index-heading">
      <div class="p-index-heading__inner">
        <IndexTitleControl :feed-relays="feedRelays"></IndexTitleControl>
        <IndexIntroControl :is-logined="logined" :login="login"></IndexIntroControl>
        <AutoSpeechControl v-model:auto-speech="autoSpeech" v-model:volume="volume"></AutoSpeechControl>
        <SoundEffectControl v-model:soundEffect="soundEffect"></SoundEffectControl>
        <SearchWordControl v-model:search-words="searchWords" v-on:change="searchAndBlockFilter()"></SearchWordControl>
        <RiverStatus v-bind:data="ryuusokuChanData" v-if="isKirinoRiver"></RiverStatus>
        <RelayStatus v-bind:relays="relayStatus"></RelayStatus>
      </div>
    </div>
    <div class="p-index-body">
      <div class="p-index-profile" v-if="npubId && npubProfile">
        <HeaderProfile :profile="npubProfile"></HeaderProfile>
        <div class="p-index-profile-header">
          <FeedProfile v-bind:profile="getProfile(npubId)"></FeedProfile>
        </div>
      </div>
      <div class="p-index-header" v-if="npubId">
        <div class="p-index-npub-prev"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDateYesterday?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">前の日へ</a>
        </div>
        <div class="p-index-npub-now"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDate?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')"><span>{{
              npubMode
            }}</span></a></div>
        <div class="p-index-npub-next"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDateTomorrow?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">次の日へ</a>
        </div>
      </div>
      <div class="p-index-feeds" :ref="(el) => { itemsTop = el as HTMLElement }">
        <div v-for="e in events" :key="e.id"
          :class="{ 'c-feed-item': true, 'c-feed-item-focused': (showFocusBorder && focusedItemId === e.id) }"
          :ref="(el) => { if (el) { items[e.id] = el as HTMLElement } }"
          @click="{ focusedItemId = e.id; focusItemIndex = events.findIndex((e) => (e.id === focusedItemId)) }">
          <FeedProfile v-bind:profile="getProfile(e.pubkey)"></FeedProfile>
          <FeedReplies v-bind:event="e" :get-profile="getProfile" :get-event="getEvent" v-if="e.kind !== 6"></FeedReplies>
          <FeedContent v-bind:event="e" :get-profile="getProfile" :get-event="getEvent" :speak-note="speakNote"
            :volume="volume" :is-logined="logined" :post-event="postEvent" :open-reply-post="openReplyPost"
            :open-quote-post="openQuotePost" :add-fav-event="addFavEvent" :add-repost-event="addRepostEvent">
          </FeedContent>
          <FeedFooter v-bind:event="e" :speak-note="speakNote" :volume="volume" :is-logined="logined"
            :post-event="postEvent" :get-profile="getProfile" :open-reply-post="openReplyPost"
            :open-quote-post="openQuotePost" :add-fav-event="addFavEvent" :add-repost-event="addRepostEvent"
            :ref="(el) => { if (el) { itemFooters?.set(e.id, el) } }"></FeedFooter>
        </div>
      </div>
      <div class="p-index-header" v-if="npubId">
        <div class="p-index-npub-prev"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDateYesterday?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">前の日へ</a>
        </div>
        <div class="p-index-npub-now"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDate?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')"><span>{{
              npubMode
            }}</span></a></div>
        <div class="p-index-npub-next"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDateTomorrow?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">次の日へ</a>
        </div>
      </div>
      <div :ref="(el) => { itemsBottom = el as HTMLElement }"></div>
    </div>
  </div>
  <div class="p-index-top-btn">
    <button @click="gotoTop()" class="p-index-top-btn__btn">
      <span class="p-index-top-btn__icon">^</span>
    </button>
  </div>
  <div class="p-index-post-btn" v-if="logined">
    <button @click="isPostOpen = !isPostOpen" class="p-index-post-btn__btn">
      <span class="p-index-post-btn__icon">+</span>
    </button>
  </div>
  <div class="c-post-wrap" v-if="isPostOpen">
    <label class="c-post-wrap__bg" @click="isPostOpen = !isPostOpen"></label>
    <div class="c-post-body">
      <div class="c-post-cancel">
        <button @click="isPostOpen = !isPostOpen; draftEvent = Nostr.getBlankEvent(Nostr.Kind.Text);"
          class="c-post-cancel__btn">
          <span class="c-post-cancel__icon">☓</span>
        </button>
      </div>
      <FeedProfile v-bind:profile="getProfile(myPubkey)"></FeedProfile>
      <FeedReplies v-bind:event="draftEvent" :get-profile="getProfile" :get-event="getEvent"></FeedReplies>
      <FeedReplies v-bind:event="editingTags" :get-profile="getProfile" :get-event="getEvent"></FeedReplies>
      <span class="p-index-post__help">メンションしたいときは<code>nostr:</code>の後に<code>npub文字列</code>を貼り付けてください。<br />
        引用リポストするときは<code>nostr:note文字列</code>で投稿IDを貼り付けてください。</span>
      <div class="p-index-post__editer">
        <div class="p-index-post__textarea">
          <textarea class="i-note" id="note" rows="8" v-model="draftEvent.content" ref="noteTextarea"
            @keydown.enter="($event) => checkSend($event)" @keydown.esc="(_$event) => {
              isPostOpen = false;
            }" v-on:input="extractTags"></textarea>
        </div>
        <div class="p-index-post__post-btn">
          <input class="b-post" type="button" value="投稿" v-on:click="post()" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import "../assets/scss/project/index.scss";
@import "../assets/scss/component/post.scss";

.c-feed-item {
  margin-top: 5px;
  background-color: #ffffff;
  border-radius: 4px;
  box-sizing: border-box;
  padding: 10px;
  border: 2px dashed #ffffff;

  &-focused {
    border: 2px dashed blue;
  }
}

.p-index-post__help {
  color: #050a30;
}

.p-index-profile {
  margin-top: 5px;

  &-header {
    padding: 10px 10px 0px;
    background-color: #ffffff;
  }
}

.p-index-header {
  background-color: #ffffff;
  padding: 2px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.p-index-npub-prev {
  flex-grow: 1;
}

.p-index-npub-now {
  text-align: center;
}

.p-index-npub-next {
  flex-grow: 1;
  text-align: right;
}
</style>

<style>
.rotate {
  animation: rotation 2s linear;
}

@keyframes rotation {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>