<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import * as Nostr from "nostr-tools";
import { RelayPool } from "nostr-relaypool";
import { NostrFetcher } from "nostr-fetch";
import { useRoute } from "vue-router";

import type { Nip07 } from "nostr-typedef";

import { feedRelays, profileRelays, pool, normalizeUrls, NostrEvent, events, eventsToSearch, eventsReceived } from "../store";
import {
  myPubkey,
  myRelaysCreatedAt, myReadRelays, myWriteRelays,
  myFollows,
  myBlockCreatedAtKind10000, myBlockCreatedAtKind30000, myBlockList, myBlockListKind10000, myBlockListKind30000, myBlockedEvents,
} from "../profile";

import { playActionSound, playETWSSound, playReactionSound } from '../hooks/usePlaySound';
import { getRandomProfile } from '../hooks/useEmojiProfiles';
import { speakNote } from '../hooks/useSpeakNote';
import { createFavEvent, createRepostEvent } from '../hooks/useFavRepost';

import IndexTitleControl from "../components/IndexTitleControl.vue";
import IndexIntroControl from "../components/IndexIntroControl.vue";
import SoundEffectControl from "../components/SoundEffectControl.vue";
import AutoSpeechControl from "../components/AutoSpeechControl.vue";
import SearchWordControl from "../components/SearchWordControl.vue";
import AutoLoginControl from "../components/AutoLoginControl.vue";

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
let robohashMode = ref("");

let firstFetching = true;
let autoSpeech = ref(false);
let volume = ref("0.5");
let searchWords = ref("");
let searchEventType = ref("all");
let soundEffect = ref(true);

let countOfDisplayEvents = ref<number>(20);

let noteId = ref<string | undefined>();
let npubId = ref<string | undefined>();
let npubDate = ref<Date | undefined>();
let npubDateYesterday = ref<Date | undefined>();
let npubDateTomorrow = ref<Date | undefined>();
let npubMonth = ref<Date | undefined>();
let npubPrevMonth = ref<Date | undefined>();
let npubNextMonth = ref<Date | undefined>();
let npubDateOrMonth = ref<string>("");
let npubModeText = ref<string>("");
let npubProfile = ref();
let npubKind3Follow = ref();
let npubKind3Relay = ref();
let npubKind10002 = ref();
let cutoffMode = ref<boolean>(true);

let npubRelaysCreatedAt = 0;
let npubReadRelays: string[] = [];
let npubWriteRelays: string[] = [];
watch(() => route.query, async (newQuery) => {
  const nostrRegex = /(nostr:|@)?(nprofile|nrelay|nevent|naddr|nsec|npub|note)1[023456789acdefghjklmnpqrstuvwxyz]{6,}/

  sushiMode.value = (route.query.sushi === "on");
  mahjongMode.value = (route.query.mahjong === "on");
  if (typeof route.query.robohash === "string" && route.query.robohash) {
    robohashMode.value = route.query.robohash.toString();
  }
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
        if (datestr.length === 8) {
          const year = Number(datestr.slice(0, 4));
          const month = Number(datestr.slice(4, 6));
          const day = Number(datestr.slice(6, 8));
          npubDate.value = new Date(year, month - 1, day);
          npubDateOrMonth.value = "date";
        } else if (datestr.length === 6) {
          const year = Number(datestr.slice(0, 4));
          const month = Number(datestr.slice(4, 6));
          npubMonth.value = new Date(year, month - 1);
          npubDateOrMonth.value = "month";
        }
      }
    } else if (key === 'q') {
      searchWords.value = route.query[key]?.toString() || "";
    }
  }

  if (npubId.value) {
    let profileCreatedAt = 0;
    let kind3CreatedAt = 0;
    let kind10002CreatedAt = 0;
    pool.subscribe(
      [{
        kinds: [0, 3, 10002],
        authors: [npubId.value]
      }],
      [...new Set(normalizeUrls([...feedRelays, ...profileRelays]))],
      async (ev, _isAfterEose, _relayURL) => {
        if (!Nostr.verifySignature(ev)) {
          console.log('Invalid nostr event, signature invalid', ev);
          return;
        }

        if (ev.kind === 0 && profileCreatedAt < ev.created_at) {
          profileCreatedAt = ev.created_at;
          const profile = JSON.parse(ev.content);
          npubProfile.value = profile;
        } else if (ev.kind === 3 && kind3CreatedAt < ev.created_at) {
          kind3CreatedAt = ev.created_at;
          if (ev.content) {
            try {
              npubKind3Relay.value = JSON.parse(ev.content);
            } catch (err) {
              console.log(err);
            }
          }
          npubKind3Follow.value = ev.tags;
        } else if (ev.kind === 10002 && kind10002CreatedAt < ev.created_at) {
          kind10002CreatedAt = ev.created_at;
          npubKind10002.value = ev.tags;
        }
      },
      undefined,
      undefined,
      { unsubscribeOnEose: true }
    );
  }

  if ((!npubId.value && !noteId.value) || (noteId.value) || (npubId.value && npubDateOrMonth.value === "")) {
    if (noteId.value) {
      // 指定されたイベントIDに関連する投稿を表示するスレッドモード
      cutoffMode.value = false;
      pool.subscribe(
        [{
          ids: [noteId.value],
        }, {
          kinds: [1, 6, 7, 40, 41, 42, 30315],
          '#e': [noteId.value],
        }],
        [... new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays.value, ...myReadRelays.value]))],
        async (ev, _isAfterEose, _relayURL) => {
          addEvent(ev);
        },
        undefined,
        () => {
          collectProfiles(true);
          if (firstFetching) {
            firstFetching = false;
          }
        }
      );
    } else if (npubId.value && npubDateOrMonth.value === "") {
      // ユーザーの直近の投稿をプレビューするモード
      pool.subscribe(
        [{
          kinds: [1, 6, 7, 40, 41, 42, 30315],
          limit: countOfDisplayEvents.value * 10,
          authors: [npubId.value]
        }],
        [... new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays.value, ...myReadRelays.value]))],
        async (ev, _isAfterEose, _relayURL) => {
          addEvent(ev);
          npubModeText.value = `接続中のリレーから直近の ${events.value.length} 件の投稿を表示しています。(今日へ)`;
        },
        undefined,
        () => {
          collectProfiles(true);
          if (firstFetching) {
            firstFetching = false;
          }
        }
      );
    } else {
      // 通常ののぞき窓グローバルモード
      pool.subscribe(
        [{
          kinds: [1, 6, 40, 41, 42, 1984, 30315],
          limit: countOfDisplayEvents.value * 25,
        }],
        [...new Set(normalizeUrls([...feedRelays]))],
        async (ev, _isAfterEose, _relayURL) => {
          addEvent(ev);
        },
        undefined,
        () => {
          collectProfiles(true);
          if (firstFetching) {
            firstFetching = false;
          }
        }
      );
    }

    if (npubId.value && npubDateOrMonth.value === "") {
      let now = new Date();
      now.setHours(0, 0, 0, 0);
      const targetDate = new Date(now.getTime());
      now.setDate(1);
      const targetMonth = new Date(now.getTime());

      setupNpubDate(targetDate);
      setupNpubMonth(targetMonth);
      npubModeText.value = `接続中のリレーから直近の ${countOfDisplayEvents} 件の投稿を表示しています。(今日へ)`;
    }
  } else if (npubId.value) {
    cutoffMode.value = false;

    const targetDate = npubDate.value ? npubDate.value : npubMonth.value;
    const targetMonth = npubMonth.value ? npubMonth.value : npubDate.value;

    if (!targetDate || !targetMonth) {
      return;
    }

    setupNpubDate(targetDate);
    setupNpubMonth(targetMonth);

    let searchRelays = [... new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays.value, ...myReadRelays.value]))];

    let since = 0;
    let until = 0;
    if (npubDateOrMonth.value === "date" && npubDateTomorrow.value) {
      since = Math.floor(targetDate.getTime() / 1000) - 1;
      until = Math.floor(npubDateTomorrow.value.getTime() / 1000) + 1;
      console.log("npubDate", npubDate.value, npubDateYesterday.value, npubDateTomorrow.value);
    } else if (npubDateOrMonth.value === "month" && npubNextMonth.value) {
      since = Math.floor(targetMonth.getTime() / 1000) - 1;
      until = Math.floor(npubNextMonth.value.getTime() / 1000) + 1;
      console.log("npubMonth", npubMonth.value, npubPrevMonth.value, npubNextMonth.value);
    }

    const unsub1 = pool.subscribe(
      [{
        kinds: [1, 6, 7, 40, 41, 42, 30315],
        authors: [npubId.value],
        since,
        until,
      }],
      searchRelays,
      async (ev, _isAfterEose, _relayURL) => {
        if (since <= ev.created_at && ev.created_at <= until) {
          addEvent(ev);
          if (npubDateOrMonth.value === "date") {
            npubModeText.value = `接続中のリレーから ${targetDate.toLocaleDateString()} の投稿 ${events.value.length} 件 を表示しています。`;
          } else if (npubDateOrMonth.value === "month") {
            npubModeText.value = `接続中のリレーから  ${targetMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' })} の投稿 ${events.value.length} 件 を表示しています。(今日へ)`;
          }
        }
      },
      undefined,
      undefined
    );
    setTimeout(() => { unsub1() }, 60 * 1000);

    const unsub2 = pool.subscribe(
      [{ kinds: [3, 10002], authors: [npubId.value], limit: 1 }],
      [...new Set(normalizeUrls(searchRelays))],
      (ev, _isAfterEose, _relayURL) => {
        if (!Nostr.verifySignature(ev)) {
          console.log('Invalid nostr event, signature invalid', ev);
          return;
        }

        if (ev.kind === 3 && ev.content && npubRelaysCreatedAt < ev.created_at) {
          pool.publish(ev, normalizeUrls(feedRelays));
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
          pool.publish(ev, normalizeUrls(feedRelays));
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
    setTimeout(() => {
      unsub2();

      if (npubId.value && npubDateOrMonth.value === "date") {
        let searchRelays = [...npubReadRelays, ...npubWriteRelays];
        collectUserDailyEvents(npubId.value, searchRelays, targetDate);
      } else if (npubId.value && npubDateOrMonth.value === "month") {
        let searchRelays = [...npubReadRelays, ...npubWriteRelays];
        collectUserMonthlyEvents(npubId.value, searchRelays, targetMonth);
      }
    }, 5 * 1000);
  }
});

function setupNpubMonth(targetMonth: Date) {
  npubMonth.value = new Date(targetMonth.getTime());
  npubPrevMonth.value = new Date(targetMonth.getTime());
  npubPrevMonth.value.setDate(1);
  npubPrevMonth.value.setMonth(npubPrevMonth.value.getMonth() - 1);
  npubPrevMonth.value.setHours(0, 0, 0, 0);
  npubNextMonth.value = new Date(targetMonth.getTime());
  npubNextMonth.value.setDate(1);
  npubNextMonth.value.setMonth(npubNextMonth.value.getMonth() + 1);
  npubNextMonth.value.setHours(0, 0, 0, 0);
}

function setupNpubDate(targetDate: Date) {
  npubDate.value = new Date(targetDate.getTime());
  npubDateYesterday.value = new Date(targetDate.getTime());
  npubDateYesterday.value.setDate(npubDateYesterday.value.getDate() - 1);
  npubDateTomorrow.value = new Date(targetDate.getTime());
  npubDateTomorrow.value.setDate(npubDateTomorrow.value.getDate() + 1);
}

// 指定されたユーザーのその一日のイベントを取得する
async function collectUserDailyEvents(pubkey: string, relays: string[], targetDate: Date) {
  let nextDay = new Date(targetDate.getTime());
  nextDay.setDate(nextDay.getDate() + 1);

  const since = Math.floor(targetDate.getTime() / 1000);
  const until = Math.floor(nextDay.getTime() / 1000);

  collectUserEventsRange(pubkey, relays, since, until, () => {
    npubModeText.value = `複数のリレーから探索した ${targetDate.toLocaleDateString()} の投稿 ${events.value.length} 件 を表示しています。`;
  });
}

// 指定されたユーザーのその一ヶ月間のイベントを取得する
async function collectUserMonthlyEvents(pubkey: string, relays: string[], targetMonth: Date) {
  let nextMonth = new Date(targetMonth.getTime());
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const since = Math.floor(targetMonth.getTime() / 1000) - 1;
  const until = Math.floor(nextMonth.getTime() / 1000) + 1;

  collectUserEventsRange(pubkey, relays, since, until, () => {
    npubModeText.value = `複数のリレーから探索した ${targetMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' })} の投稿 ${events.value.length} 件 を表示しています。(今日へ)`;
  });
}

// 指定されたユーザーの指定された範囲のイベントを取得する
async function collectUserEventsRange(pubkey: string, relays: string[], since: number, until: number, cb: () => void) {
  const profile = getProfile(pubkey);
  const fetcher = NostrFetcher.init();
  const eventsIter = fetcher.allEventsIterator(
    [...new Set(normalizeUrls(relays))],
    { kinds: [1, 5, 6, 40, 41, 42], authors: [pubkey] },
    { since, until }
  );

  for await (const ev of eventsIter) {
    if (since <= ev.created_at && ev.created_at <= until) {
      const usertext = profile.display_name + profile.name + ev.content;
      const japaneseRegex = /[亜-熙ぁ-んァ-ヶ]/;
      if (ev.kind === 5) {
        addDeletedEvent(ev);
      } else if (!eventsReceived.value.has(ev.id) && (usertext.match(japaneseRegex) || japaneseUsers.includes(ev.pubkey))) {
        pool.publish(ev, normalizeUrls(feedRelays));
      }

      if (ev.kind !== 5) {
        addEvent(ev);
      }

      cb();
    }
  }
}

const japaneseFollowBotPubkey = "087c51f1926f8d3cb4ff45f53a8ee2a8511cfe113527ab0e87f9c5821201a61e";
let japaneseUsers: string[] = [];
function collectJapaneseUsers() {
  const unsub = pool.subscribe(
    [{ kinds: [3], authors: [japaneseFollowBotPubkey], limit: 1 }],
    [...new Set(normalizeUrls(profileRelays))],
    (ev, _isAfterEose, _relayURL) => {
      if (!Nostr.verifySignature(ev)) {
        console.log('Invalid nostr event, signature invalid', ev);
        return;
      }

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
  const poolRiver = new RelayPool();
  poolRiver.subscribe(
    [{ kinds: [30078], authors: [ryuusokuChanBotPubkey], "#d": ["nostr-arrival-rate_kirino"], limit: 1 }],
    [...new Set(normalizeUrls(feedRelays).map((e) => (e + "?river=" + Math.floor((new Date()).getTime() / 1000))))],
    (ev, _isAfterEose, _relayURL) => {
      if (!Nostr.verifySignature(ev)) {
        console.log('Invalid nostr event, signature invalid', ev);
        return;
      }

      ryuusokuChanData.value.length = 0;
      ryuusokuChanData.value = ev.tags.slice(-10) as [string, string][];
      ryuusokuChanData.value.splice(ryuusokuChanData.value.length);
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
}
if (isKirinoRiver) {
  collectRyuusokuChan();
  setInterval(() => {
    collectRyuusokuChan();
  }, 30 * 1000);
}

function addEvent(event: NostrEvent | Nostr.Event, addFeeds: boolean = true): void {
  if (!Nostr.verifySignature(event)) {
    console.log('Invalid nostr event, signature invalid', event);
    return;
  }

  if (event.kind === 5) {
    addDeletedEvent(event);
    return;
  }
  if (eventsReceived.value.has(event.id) || event.kind === 3) {
    return;
  }

  const now = Math.floor((new Date()).getTime() / 1000);
  const ev = event as unknown as NostrEvent;
  eventsReceived.value.set(ev.id, ev);

  if (addFeeds === false) {
    return;
  }

  const rootKind = noteId.value ? getEvent(noteId.value)?.kind || 0 : 0;

  if (noteId.value && 40 <= rootKind && rootKind <= 42) {
    eventsToSearch.value = Nostr.utils.insertEventIntoDescendingList(eventsToSearch.value, ev) as NostrEvent[];
  } else if (noteId.value) {
    eventsToSearch.value = Nostr.utils.insertEventIntoAscendingList(eventsToSearch.value, ev) as NostrEvent[];
  } else if (npubId.value) {
    eventsToSearch.value = Nostr.utils.insertEventIntoDescendingList(eventsToSearch.value, ev) as NostrEvent[];
  } else if (firstFetching) {
    eventsToSearch.value = Nostr.utils.insertEventIntoDescendingList(eventsToSearch.value, ev) as NostrEvent[];
  } else {
    if (ev.created_at < now - 600) {
      eventsToSearch.value = Nostr.utils.insertEventIntoDescendingList(eventsToSearch.value, ev) as NostrEvent[];
    } else {
      eventsToSearch.value.unshift(ev);
    }
  }
  if (cutoffMode.value) {
    const totalNumberOfEventsToKeep = 500 + countOfDisplayEvents.value * 2;
    eventsToSearch.value.slice(-totalNumberOfEventsToKeep);
  }
  searchAndBlockFilter();
  if (
    !firstFetching &&
    events.value.some((obj) => {
      return obj.id === event.id;
    })
  ) {
    if (autoSpeech.value) {
      speakNote(event, getProfile(event.pubkey), volume.value.toString());
    }
    if (soundEffect.value && now - 60 < ev.created_at && event.pubkey === "9f77d173dcd94cc4243d36883b157f8c3283051dc6bd237b1c5ac400fb90cecb") {
      playETWSSound();
    }
  }
}

let cacheMissHitEventIds = new Set<string>();
let cacheBlacklistEventIds = new Set<string>();
let cacheMissHitCountByEventId = new Map<string, number>();

function addDeletedEvent(ev: Nostr.Event) {
  cacheBlacklistEventIds.add(ev.id);

  for (let i = 0; i < ev.tags.length; ++i) {
    const t = ev.tags[i];
    if (t[0] === "e") {
      eventsToSearch.value = eventsToSearch.value.filter((ee) => (ee.id !== t[1]));
      eventsReceived.value.set(t[1], ev);
    }
  }
  pool.publish(ev, [...new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays.value, ...myReadRelays.value, ...npubReadRelays, ...npubWriteRelays]))]);
}

function getEvent(id: string): Nostr.Event | undefined {
  if (myBlockedEvents.value.has(id)) {
    return undefined;
  }

  const ev = eventsReceived.value.get(id);
  if (ev) {
    if (myBlockList.value.includes(ev.pubkey)) {
      myBlockedEvents.value.add(ev.id);
      console.log("Blocked by pubkey:", ev.pubkey, getProfile(ev.pubkey).display_name, `kind=${ev.kind}`, ev.content);
      return undefined;
    }
  } else {
    cacheMissHitEventIds.add(id);
  }
  return ev;
}

async function collectEvents() {
  if (cacheMissHitEventIds.size === 0) {
    return;
  }

  const eventIds = Array.from(cacheMissHitEventIds).filter((ev) => (!eventsToSearch.value.find((e) => (e.id === ev)) && !cacheBlacklistEventIds.has(ev)));
  if (eventIds.length === 0) {
    return;
  }

  const reqEventIds = new Set<string>(eventIds);
  console.log(`collectEvents(${eventIds})`);
  const unsub = pool.subscribe(
    [{ ids: eventIds }, { kinds: [5], '#e': eventIds }],
    [...new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays.value, ...myReadRelays.value, ...npubReadRelays, ...npubWriteRelays]))],
    async (ev, _isAfterEose, _relayURL) => {
      if (!Nostr.verifySignature(ev)) {
        console.log('Invalid nostr event, signature invalid', ev);
        return;
      }
      cacheMissHitEventIds.delete(ev.id);
      reqEventIds.delete(ev.id);

      if (ev.kind === 5) {
        addDeletedEvent(ev);
      } else if (noteId.value) {
        addEvent(ev);
      } else {
        addEvent(ev, false);
      }

      if (!eventsReceived.value.has(ev.id) && (ev.content.match(/[亜-熙ぁ-んァ-ヶ]/) || japaneseUsers.includes(ev.pubkey))) {
        pool.publish(ev, normalizeUrls(feedRelays));
      }
    },
    undefined,
    () => {
      if (reqEventIds.size === 0) {
        unsub();
        clearTimeout(timeout);
      }
    },
    { unsubscribeOnEose: true }
  );
  const timeout = setTimeout(() => {
    unsub();
    reqEventIds.forEach((id) => {
      cacheMissHitCountByEventId.set(id, (cacheMissHitCountByEventId.get(id) ?? 0) + 1);
      const cacheMissHitCount = cacheMissHitCountByEventId.get(id) ?? 0;
      if (cacheMissHitCount === 3) {
        eventsReceived.value.forEach((ev) => {
          ev.tags.forEach((t) => {
            if (ev.kind === 6 && t[0] === "e" && t[1] === id) {
              addEvent(ev);
            }
          })
        });
      } else if (cacheMissHitCount > 64) {
        cacheBlacklistEventIds.add(id);
        console.log("Blocked by cache miss:", id, cacheMissHitCount);
      }
    });
    console.log(`collectEvents(${timeout}) => Timeout`);
  }, 5 * 1000);
}
setInterval(collectEvents, 2 * 1000);

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
  if (sushiMode.value || mahjongMode.value) {
    return getRandomProfile(pubkey, sushiMode.value, mahjongMode.value);
  }

  let prof;
  if (!profiles.value.has(pubkey)) {
    cacheMissHitPubkeys.add(pubkey);
    prof = {
      pubkey: pubkey,
      picture: "https://placehold.jp/60x60.png",
      display_name: "",
      name: "",
      created_at: 0,
    };
  } else {
    prof = profiles.value.get(pubkey);
  }

  if (robohashMode.value) {
    prof.picture = `https://robohash.org/${Nostr.nip19.npubEncode(pubkey)}.png?set=${robohashMode.value}`
    prof.created_at = 0;
  }
  return prof;
}

async function collectProfiles(force = false) {
  if (cacheMissHitPubkeys.size === 0 && !force) {
    return;
  }

  const pubkeys = [...new Set<string>([...events.value.map(e => e.pubkey), ...cacheMissHitPubkeys])];
  const unsub = pool.subscribe(
    [{
      kinds: [0],
      authors: pubkeys,
    }],
    [...new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays.value, ...myReadRelays.value]))],
    async (ev, _isAfterEose, _relayURL) => {
      if (!Nostr.verifySignature(ev)) {
        console.log('Invalid nostr event, signature invalid', ev);
        return;
      }

      if (ev.kind === 0) {
        const content = JSON.parse(ev.content);

        if (force && ev.created_at > Math.floor(new Date().getTime() / 1000) - forceProfileUpdateInterval * 2) {
          pool.publish(ev, [...new Set(normalizeUrls([...feedRelays]))]);
        } else if (cacheMissHitPubkeys.has(ev.pubkey)) {
          pool.publish(ev, [...new Set(normalizeUrls([...feedRelays]))]);
        }
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
    () => {
      if (cacheMissHitPubkeys.size === 0) {
        unsub();
        clearTimeout(timeout);
      }
    },
    { unsubscribeOnEose: true }
  );
  const timeout = setTimeout(() => {
    unsub();
    console.log(`collectProfiles(${timeout}) => Timeout, ${cacheMissHitPubkeys.size} pubkeys remain`);
  }, 5 * 1000);
}
setInterval(() => { collectProfiles(false); }, 5 * 1000);

const forceProfileUpdateInterval = 29;
setInterval(() => { collectProfiles(true); }, forceProfileUpdateInterval * 1000);

setInterval(() => {
  // ローカルストレージにプロフィール情報を保存しておく
  const diskProfiles = new Map<string, any>(JSON.parse(localStorage.getItem("profiles") ?? "[]"));

  profiles.value.forEach((val, key) => {
    if (val.created_at > 0) {
      if (diskProfiles.has(key) && diskProfiles.get(key).created_at < val.created_at) {
        diskProfiles.set(key, val);
      } else {
        diskProfiles.set(key, val);
      }
    }
  });

  localStorage.setItem(
    "profiles",
    JSON.stringify(Array.from(profiles.value.entries()))
  );
}, 8 * 1000);

let windowNostr: Nip07.Nostr | null = null;
let logined = ref(false);
let isPostOpen = ref(false);

let firstReactionFetching = true;
let firstReactionFetchedRelays = 0;
async function login() {
  // @ts-ignore
  windowNostr = window.nostr;

  myPubkey.value = (await windowNostr?.getPublicKey()) ?? "";

  if (myPubkey.value) {
    logined.value = true;

    if (windowNostr?.getRelays) {
      const firstRelays = await windowNostr.getRelays();
      console.log("NIP-07 First relay = ", JSON.stringify(firstRelays));

      if (false && Object.keys(firstRelays).length === 0) {
        window.alert("NIP-07拡張機能にリレーリストを設定するのをおすすめしています。");
      }
      for (const r in firstRelays) {
        if (firstRelays[r].read) {
          myReadRelays.value.push(r);
        }
        if (firstRelays[r].write) {
          myWriteRelays.value.push(r);
        }
      }

      console.log("NIP-07 First read relay: ", JSON.stringify(myReadRelays.value));
      console.log("NIP-07 First write relay: ", JSON.stringify(myWriteRelays.value));
    }
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

const autoLogin = ref(localStorage.getItem("autoLogin") === "true");
function tryAutoLogin() {
  let retryCount = 0;
  const checkNIP07Extention = setInterval(() => {
    // @ts-ignore
    windowNostr = window.nostr;
    if (windowNostr) {
      login();
      clearInterval(checkNIP07Extention);
    }
    ++retryCount;

    if (retryCount > 60) {
      clearInterval(checkNIP07Extention);
    }
  }, 500);
}
if (autoLogin.value) {
  tryAutoLogin();
}

function collectMyRelay() {
  const unsub = pool.subscribe(
    [
      {
        kinds: [3, 10002],
        authors: [myPubkey.value],
        limit: 1,
      },
    ],
    [... new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myReadRelays.value, ...myWriteRelays.value]))],
    (ev, _isAfterEose, _relayURL) => {
      if (!Nostr.verifySignature(ev)) {
        console.log('Invalid nostr event, signature invalid', ev);
        return;
      }

      if (ev.kind === 3 && ev.content && myRelaysCreatedAt.value < ev.created_at) {
        myReadRelays.value.slice(0);
        myWriteRelays.value.slice(0);
        myRelaysCreatedAt.value = ev.created_at;
        const content = JSON.parse(ev.content);
        for (const r in content) {
          myReadRelays.value.push(r);
          if (content[r].write) {
            myWriteRelays.value.push(r);
          }
        }
      } else if (ev.kind === 10002 && myRelaysCreatedAt.value < ev.created_at) {
        myReadRelays.value.slice(0);
        myWriteRelays.value.slice(0);
        myRelaysCreatedAt.value = ev.created_at;
        for (let i = 0; i < ev.tags.length; ++i) {
          const t = ev.tags[i];
          if (t[0] === "r") {
            const r = t[1];
            let m = "";

            if (t.length > 2) { m = t[2]; }
            if (m === "read") {
              myReadRelays.value.push(r);
            } else {
              myReadRelays.value.push(r);
              myWriteRelays.value.push(r);
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
      kinds: [10000, 30000],
      authors: [myPubkey.value],
    }],
    [... new Set(normalizeUrls([...feedRelays, ...profileRelays, ...myReadRelays.value, ...myWriteRelays.value]))],
    async (ev, _isAfterEose, _relayURL) => {
      if ((myBlockCreatedAtKind10000.value < ev.created_at && ev.kind === 10000) ||
        (myBlockCreatedAtKind30000.value < ev.created_at && (ev.kind === 30000 && ev.tags[0][0] === "d" && ev.tags[0][1] === "mute"))) {
        if (ev.kind === 10000) {
          myBlockCreatedAtKind10000.value = ev.created_at;
        } else if (ev.kind === 30000) {
          myBlockCreatedAtKind30000.value = ev.created_at;
        }

        let blockListJSON = "[]";
        if (windowNostr && windowNostr.nip04) {
          blockListJSON = (await windowNostr?.nip04.decrypt(myPubkey.value, ev.content))
        }
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

        if (ev.kind === 10000) {
          myBlockListKind10000.value = [...new Set([...blocks])];
        } else if (ev.kind === 30000) {
          myBlockListKind30000.value = [...new Set([...blocks])];
        }
        myBlockList.value = [... new Set([...myBlockListKind10000.value, ...myBlockListKind30000.value])];

        eventsReceived.value.forEach((val, key) => {
          if (myBlockList.value.includes(val.pubkey)) {
            console.log("Removed event by blocked pubkey", val.pubkey, getProfile(val.pubkey).display_name, `kind=${val.kind}`, val.content);
            eventsReceived.value.delete(key);
          }
        });
        eventsToSearch.value = eventsToSearch.value.filter((e) => (!myBlockList.value.includes(e.pubkey)));
      }
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
  setTimeout(() => { unsub() }, 30 * 1000);
}

async function collectFollowsAndSubscribe() {
  const contactList = await pool.fetchAndCacheContactList(myPubkey.value);
  myFollows.value = contactList.tags.filter((t) => (t[0] === 'p')).map((t) => (t[1]));

  const subscribeMaxCount = 1000;
  for (let begin = 0; begin < myFollows.value.length; begin += subscribeMaxCount) {
    const followList = myFollows.value.slice(begin, subscribeMaxCount);

    pool.subscribe(
      [{ kinds: [1, 5], authors: followList, limit: 20 }],
      [...new Set(normalizeUrls(myReadRelays.value))],
      async (ev, _isAfterEose, _relayURL) => {
        if (!Nostr.verifySignature(ev)) {
          console.log('Invalid nostr event, signature invalid', ev);
          return;
        }

        switch (ev.kind) {
          case 1:
            addEvent(ev);
            break;
          case 5:
            addDeletedEvent(ev);
            break;
        }
      },
      0
    );
  }
}

function subscribeReactions() {
  relayStatus.value = pool.getRelayStatuses();

  pool.subscribe([
    { kinds: [1, 6, 7], "#p": [myPubkey.value], limit: countOfDisplayEvents.value * 5 },
    { kinds: [6, 7], authors: [myPubkey.value], limit: countOfDisplayEvents.value * 5 },
  ],
    [...new Set(normalizeUrls(myReadRelays.value))],
    async (ev, _isAfterEose, _relayURL) => {
      addEvent(ev);

      // 自分宛のリアクションが来ていたら音を鳴らす
      if (ev.pubkey !== myPubkey.value) {
        if (
          !firstReactionFetching &&
          soundEffect.value &&
          !myBlockList.value.includes(ev.pubkey) &&
          events.value[events.value.length - 1].created_at < ev.created_at
        ) {
          console.log("reactioned", ev);
          playReactionSound();
        }
      }

      // 自分のリアクション(リポスト、ファボ)があればイベントに色をつけておく
      if (ev.pubkey === myPubkey.value) {
        for (let i = 0; i < ev.tags.length; ++i) {
          const t = ev.tags[i];
          if (t[0] === 'e') {
            const et = t[1];

            if (ev.kind === 6) {
              eventsToSearch.value.filter((ee) => (ee.id === et)).map((ee) => (ee.isReposted = true));
            } else if (ev.kind === 7) {
              eventsToSearch.value.filter((ee) => (ee.id === et)).map((ee) => (ee.isFavorited = true));
            }
          }
        }
      }
    },
    undefined,
    async () => {
      firstReactionFetchedRelays++;
      if (firstReactionFetchedRelays > myReadRelays.value.length / 2) {
        setTimeout(() => {
          firstReactionFetching = false;
        }, 10 * 1000);
      }
    }
  );
}

type BlankEvent = ReturnType<typeof Nostr.getBlankEvent>;
let draftEvent = ref<BlankEvent>(Nostr.getBlankEvent(Nostr.Kind.Text));
let editingTags = ref(Nostr.getBlankEvent(Nostr.Kind.Text));
async function post() {
  if (!draftEvent.value.content) {
    return;
  }

  draftEvent.value.tags = draftEvent.value.tags.concat(editingTags.value.tags);

  const ev = JSON.parse(JSON.stringify(draftEvent.value));
  ev.created_at = Math.floor(Date.now() / 1000);

  await postEvent(ev);

  isPostOpen.value = false;
  draftEvent.value = Nostr.getBlankEvent(Nostr.Kind.Text);
}

async function postEvent(event: Nostr.Event) {
  if (windowNostr) {
    event = await windowNostr.signEvent(JSON.parse(JSON.stringify(event)));

    pool.publish(event, normalizeUrls(myWriteRelays.value));

    if (soundEffect.value) {
      playActionSound();
    }

    addEvent(event);
  }
}

function openReplyPost(reply: Nostr.Event): void {
  // 投稿欄をすべて空っぽにする
  draftEvent.value = Nostr.getBlankEvent(Nostr.Kind.Text);
  if (reply.kind === 42) {
    draftEvent.value = Nostr.getBlankEvent(Nostr.Kind.ChannelMessage);
  }
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

  const pTags = new Set<string>();
  for (let i = 0; i < parsedTags.profiles.length; ++i) {
    const p = parsedTags.profiles[i];
    pTags.add(p.pubkey);
  }
  pTags.add(reply.pubkey);
  pTags.forEach((p) => {
    draftEvent.value.tags.push(['p', p]);
  });

  isPostOpen.value = true;
}

function openQuotePost(repost: Nostr.Event): void {
  // 投稿欄をすべて空っぽにする
  draftEvent.value = Nostr.getBlankEvent(Nostr.Kind.Text);
  // 投稿欄にnoteidを追加する
  draftEvent.value.content = "\nnostr:" + Nostr.nip19.noteEncode(repost.id);

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

      if (searchWords.value) {
        draftEvent.value.content = searchWords.value + " " + draftEvent.value.content;
      }
    }
    extractTags();
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
            editingTags.value.tags.push(['e', d.data, "mention"])
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
    let isBlocked = false;
    if (myBlockList.value.includes(e.pubkey)) {
      isBlocked = true;
      if (!myBlockedEvents.value.has(e.id)) {
        console.log("Blocked by pubkey:", e.pubkey, getProfile(e.pubkey).display_name, `kind=${e.kind}`, e.content);
        myBlockedEvents.value.add(e.id);
      }
    }
    if (cacheBlacklistEventIds.has(e.id)) {
      isBlocked = true;
    }

    if (isBlocked) {
      return false;
    }

    switch (searchEventType.value) {
      case "all": {
        return searchSubstring(e.content, searchWords.value);
      }
      case "fav": {
        return e.kind === 7;
      }
      case "repost": {
        return e.kind === 6;
      }
      case "chat": {
        if (e.kind === 40 || e.kind === 41 || e.kind === 42) {
          return searchSubstring(e.content, searchWords.value);
        }
        return false;
      }
      case "reply": {
        if (e.pubkey !== myPubkey.value && (e.kind === 1 || e.kind === 42)) {
          for (let i = 0; i < e.tags.length; ++i) {
            const t = e.tags[i];
            if (t[0] === "p" && t[1] === myPubkey.value) {
              return searchSubstring(e.content, searchWords.value);
            }
          }
        }
        return false;
      }
      case "reaction": {
        if (e.pubkey !== myPubkey.value && (e.kind === 6 || e.kind === 7)) {
          for (let i = 0; i < e.tags.length; ++i) {
            const t = e.tags[i];
            if (t[0] === "p" && t[1] === myPubkey.value) {
              return true;
            }
          }
        }
        return false;
      }
    }
  });
  if (cutoffMode.value) {
    events.value = events.value.slice(0, countOfDisplayEvents.value);
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
  } else if (e.key === 'm') {
    showMore();
  } else if (e.key === 'g') {
    gotoBottom();
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
  if (!targetEvent.isReposted) {
    const confirmed = window.confirm(`リポストしますか？\n\n"${targetEvent.content}"`);
    if (confirmed) {
      const repost = createRepostEvent(targetEvent) as Nostr.Event;
      pool.publish(targetEvent, normalizeUrls(myWriteRelays.value));
      postEvent(repost);
      targetEvent.isReposted = true;
    }
  }
}

function addFavEvent(targetEvent: NostrEvent) {
  if (!targetEvent.isFavorited) {
    const confirmed = window.confirm(`ふぁぼりますか？\n\n"${targetEvent.content}"`);
    if (confirmed) {
      const reaction = createFavEvent(targetEvent) as Nostr.Event;
      pool.publish(targetEvent, normalizeUrls(myWriteRelays.value));
      postEvent(reaction);
      targetEvent.isFavorited = true;
    }
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
    blockedPubkeys: myBlockList.value.length,
    eventsBlocked: myBlockedEvents.value.size,
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
  const offsetY = 80;
  const yCoordinate = el.getBoundingClientRect().top + document.documentElement.scrollTop - offsetY;
  window.scrollTo({ top: yCoordinate, behavior: 'smooth' });
}

function scrollToItemTop(el: HTMLElement) {
  const yCoordinate = el.getBoundingClientRect().top + document.documentElement.scrollTop;
  window.scrollTo({ top: yCoordinate, behavior: 'smooth' });
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

function gotoBottom() {
  focusItemIndex.value = events.value.length - 1;
  focusedItemId.value = events.value[focusItemIndex.value].id;
  if (itemsBottom.value) {
    scrollToItemTop(itemsBottom.value);
  }
}

function showMore() {
  gotoBottom();

  countOfDisplayEvents.value += 20;
  searchAndBlockFilter();
}
</script>

<template>
  <div class="p-index-wrap">
    <div class="p-index-heading">
      <div class="p-index-heading__inner">
        <IndexTitleControl :feed-relays="feedRelays"></IndexTitleControl>
        <IndexIntroControl :is-logined="logined" :login="login"></IndexIntroControl>
        <AutoLoginControl v-model:autoLogin="autoLogin"></AutoLoginControl>
        <AutoSpeechControl v-model:auto-speech="autoSpeech" v-model:volume="volume"></AutoSpeechControl>
        <SoundEffectControl v-model:soundEffect="soundEffect"></SoundEffectControl>
        <SearchWordControl v-model:search-words="searchWords" v-model:event-type="searchEventType"
          v-on:change="searchAndBlockFilter()"></SearchWordControl>
        <RiverStatus v-bind:data="ryuusokuChanData" v-if="isKirinoRiver"></RiverStatus>
        <RelayStatus v-bind:relays="relayStatus"></RelayStatus>
      </div>
    </div>
    <div class="p-index-body">
      <div class="p-index-profile" v-if="npubId && npubProfile">
        <HeaderProfile :profile="npubProfile" :kind3-follow="npubKind3Follow" :kind3-relay="npubKind3Relay"
          :kind10002="npubKind10002" :get-profile="getProfile"></HeaderProfile>
        <div class="p-index-profile-header">
          <FeedProfile v-bind:profile="getProfile(npubId)" :avatar-link-as-image="true"></FeedProfile>
        </div>
      </div>
      <div class="p-index-header" v-if="npubId">
        <div class="p-index-npub-prev"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubPrevMonth?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace(/\//g, '')">前の月へ</a>
        </div>
        <div class="p-index-npub-now"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubMonth?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace(/\//g, '')"><span>月全体へ</span></a>
        </div>
        <div class="p-index-npub-next"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubNextMonth?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace(/\//g, '')">次の月へ</a>
        </div>
      </div>
      <div class="p-index-header" v-if="npubId">
        <div class="p-index-npub-prev"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDateYesterday?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">前の日へ</a>
        </div>
        <div class="p-index-npub-now"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDate?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')"><span>{{
              npubModeText
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
          <FeedProfile :key="'profile' + e.id" v-bind:profile="getProfile(e.pubkey)" v-if="getProfile(e.pubkey)">
          </FeedProfile>
          <FeedReplies :key="'replies' + e.id" v-bind:event="e" :get-profile="getProfile" :get-event="getEvent"
            v-if="e.kind !== 6"></FeedReplies>
          <FeedContent :key="'content' + e.id" v-bind:event="e" :get-profile="getProfile" :get-event="getEvent"
            :speak-note="speakNote" :volume="volume" :is-logined="logined" :post-event="postEvent"
            :open-reply-post="openReplyPost" :open-quote-post="openQuotePost" :add-fav-event="addFavEvent"
            :add-repost-event="addRepostEvent">
          </FeedContent>
          <FeedFooter :key="'footer' + e.id" v-bind:event="e" :speak-note="speakNote" :volume="volume"
            :is-logined="logined" :post-event="postEvent" :get-profile="getProfile" :open-reply-post="openReplyPost"
            :open-quote-post="openQuotePost" :add-fav-event="addFavEvent" :add-repost-event="addRepostEvent"
            :ref="(el) => { if (el) { itemFooters?.set(e.id, el) } }"></FeedFooter>
        </div>
        <div class="p-index-footer" v-if="!npubId && !noteId"><button v-on:click="(e) => {
          showMore();
          (e.target as HTMLElement).blur()
        }">もっと表示する ({{ countOfDisplayEvents }}件表示中)</button></div>
      </div>
      <div class="p-index-header" v-if="npubId">
        <div class="p-index-npub-prev"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDateYesterday?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">前の日へ</a>
        </div>
        <div class="p-index-npub-now"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDate?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')"><span>{{
              npubModeText
            }}</span></a></div>
        <div class="p-index-npub-next"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubDateTomorrow?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">次の日へ</a>
        </div>
      </div>
      <div class="p-index-header" v-if="npubId">
        <div class="p-index-npub-prev"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubPrevMonth?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace(/\//g, '')">前の月へ</a>
        </div>
        <div class="p-index-npub-now"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubMonth?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace(/\//g, '')"><span>月全体へ</span></a>
        </div>
        <div class="p-index-npub-next"><a
            :href="'?' + Nostr.nip19.npubEncode(npubId) + '&date=' + npubNextMonth?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace(/\//g, '')">次の月へ</a>
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
      <div class="c-post-tags">
        <FeedReplies v-bind:event="draftEvent" :get-profile="getProfile" :get-event="getEvent"></FeedReplies>
        <FeedReplies v-bind:event="editingTags" :get-profile="getProfile" :get-event="getEvent"></FeedReplies>
        <span
          class="p-index-post__help">メンションしたいときは<code>nostr:</code>の後に<code>npub文字列</code>を貼り付けてください。<br />引用リポストするときは<code>nostr:note文字列</code>で投稿IDを貼り付けてください。</span>
      </div>
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

.p-index-footer {
  margin-top: 5px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.p-index-footer button {
  flex-grow: 1;
  border-radius: 4px;
  background-color: #ffffff;
  color: #050a30;
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