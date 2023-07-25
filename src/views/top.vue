<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import * as nostr from "nostr-tools";
import { RelayPool } from "nostr-relaypool";
import { NostrFetcher } from "nostr-fetch";
import { useRoute } from "vue-router";

import { playActionSound, playRectionSound } from '../hooks/usePlaySound';
import { getRandomProfile } from '../hooks/useEmojiProfiles';
import { speakNote } from '../hooks/useSpeakNote';
import { createFavEvent, createRepostEvent } from '../hooks/useFavRepost';

import IndexTitleControl from "../components/IndexTitleControl.vue";
import IndexIntroControl from "../components/IndexIntroControl.vue";
import SoundEffectControl from "../components/SoundEffectControl.vue";
import AutoSpeechControl from "../components/AutoSpeechControl.vue";
import SearchWordControl from "../components/SearchWordControl.vue";

import RelayStatus from "../components/RelayStatus.vue";
import FeedProfile from "../components/FeedProfile.vue";
import FeedReplies from "../components/FeedReplies.vue";
import FeedContent from "../components/FeedContent.vue";
import FeedFooter from "../components/FeedFooter.vue";

const route = useRoute();
let sushiMode = ref(false);
let mahjongMode = ref(false);

const feedRelays = ["wss://relay-jp.nostr.wirednet.jp/"];
let profileRelays = [
  "wss://nos.lol/",
  "wss://nostr-pub.wellorder.net/",
  "wss://nostr-relay.nokotaro.com/",
  "wss://nostr.h3z.jp/",
  "wss://nostr.holybea.com/",
  "wss://offchain.pub/",
  "wss://relay-jp.nostr.wirednet.jp/",
  "wss://relay.austrich.net/",
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
const events = ref(new Array<nostr.Event>());
const eventsToSearch = ref(new Array<nostr.Event>());
const eventsReceived = new Set<string>();

let firstFetching = true;
let autoSpeech = ref(false);
let volume = ref(0.5);
let searchWords = ref("");
let soundEffect = ref(true);

const totalNumberOfEventsToKeep = 5000;
const initialNumberOfEventToGet = 500;
let countOfDisplayEvents = 100;

let noteId: string | undefined;
let npubId: string | undefined;
let npubDate = ref<Date | undefined>();
let npubDateYesterday = ref<Date | undefined>();
let npubDateTomorrow = ref<Date | undefined>();
watch(() => route.query, async (newQuery) => {
  const nostrRegex = /(nostr:|@)?(nprofile|nrelay|nevent|naddr|nsec|npub|note)1[023456789acdefghjklmnpqrstuvwxyz]{6,}/

  sushiMode.value = (route.query.sushi === "on");
  mahjongMode.value = (route.query.mahjong === "on");
  for (let key in newQuery) {
    console.log(key, route.query[key]);
    if (key.match(nostrRegex)) {
      try {
        const data = nostr.nip19.decode(key.replace('nostr:', '').replace('@', ''));
        switch (data.type) {
          case "nevent": {
            noteId = data.data.id;
          } break;
          case "note": {
            noteId = data.data;
          } break;
          case "nprofile": {
            npubId = data.data.pubkey;
          } break;
          case "npub": {
            npubId = data.data;
          }
        }
      } catch (err) {
        console.error(err);
      }
    } else if (key === 'date') {
      const datestr = route.query[key];
      if (datestr) {
        console.log('datestr=', datestr);
        const year = Number(datestr.slice(0, 4));
        const month = Number(datestr.slice(4, 6));
        const day = Number(datestr.slice(6, 8));
        npubDate.value = new Date(year, month - 1, day);
        console.log('npubDate=', npubDate);
      }
    }
  }

  if (!npubId) {
    const timelineFilter = (noteId) ? {
      kinds: [1, 6],
      limit: initialNumberOfEventToGet,
      ids: [noteId],
    } : {
      kinds: [1, 6],
      limit: initialNumberOfEventToGet,
    };
    pool.subscribe(
      [
        timelineFilter
      ],
      feedRelays,
      async (ev, _isAfterEose, _relayURL) => {
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
  } else {
    let now = new Date();
    now.setHours(0, 0, 0, 0);
    const targetDate = npubDate.value ? npubDate.value : now;

    npubDate.value = new Date(targetDate.getTime());
    npubDateYesterday.value = new Date(targetDate.getTime());
    npubDateYesterday.value.setDate(npubDateYesterday.value.getDate() - 1);
    npubDateTomorrow.value = new Date(targetDate.getTime());
    npubDateTomorrow.value.setDate(npubDateTomorrow.value.getDate() + 1);

    const since = Math.floor(targetDate.getTime() / 1000);
    const until = since + 24 * 60 * 60;
    const fetcher = NostrFetcher.init();

    console.log({ since, until });
    const eventsIter = fetcher.allEventsIterator(
      feedRelays,
      { kinds: [1, 6, 7], authors: [npubId] },
      { since, until }
    );

    for await (const ev of eventsIter) {
      addEvent(ev, false);
    }
  }
});

function addEvent(event: nostr.Event, cutoff: boolean = true): void {
  if (eventsReceived.has(event.id)) {
    return;
  }
  eventsReceived.add(event.id);
  eventsToSearch.value = nostr.utils.insertEventIntoDescendingList(eventsToSearch.value, event);
  if (cutoff) {
    eventsToSearch.value.slice(-totalNumberOfEventsToKeep);
  }
  search();
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

function getEvent(id: string): nostr.Event | undefined {
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
    normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays, ...myReadRelays]),
    async (ev, _isAfterEose, relayURL) => {
      addEvent(ev);

      if (relayURL !== undefined && !feedRelays.includes(relayURL) && !eventsReceived.has(ev.id) && ev.content.match(/[亜-熙ぁ-んァ-ヶ]/)) {
        console.log(JSON.stringify({ msg: "japanese content", relayURL, ev }));
        pool.publish(ev, normalizeUrls(feedRelays));
      }
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
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

function getProfile(pubkey: string): Profile {
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
  if (sushiMode.value || mahjongMode.value) {
    return getRandomProfile(pubkey, sushiMode.value, mahjongMode.value);
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
    normalizeUrls([...feedRelays, ...profileRelays, ...myWriteRelays, ...myReadRelays]),
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
          pool.publish(ev, feedRelays);
        }
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

let logined = ref(false);
let isPostOpen = ref(false);
let myPubkey = "";
let myRelaysCreatedAt = 0;
let myReadRelays: string[] = [];
let myWriteRelays: string[] = [];
let firstReactionFetching = true;
let firstReactionFetchedRelays = 0;
let myFollows: string[] = [];
async function login() {
  // @ts-ignore
  myPubkey = (await window.nostr?.getPublicKey()) ?? "";

  if (myPubkey) {
    logined.value = true;
    countOfDisplayEvents *= 2;
    collectMyRelay();
    if (!noteId && !npubId) {
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
  pool.subscribe(
    [
      {
        kinds: [3],
        authors: [myPubkey],
        limit: 1,
      },
    ],
    profileRelays,
    (ev, _relayURL) => {
      if (ev.kind === 3 && ev.content && myRelaysCreatedAt < ev.created_at) {
        myWriteRelays.slice(0);
        const content = JSON.parse(ev.content);
        myRelaysCreatedAt = ev.created_at;
        for (const r in content) {
          myReadRelays.push(r);
          if (content[r].write) {
            myWriteRelays.push(r);
          }
        }
      }
    },
    undefined,
    undefined,
    { unsubscribeOnEose: true }
  );
}

async function collectFollowsAndSubscribe() {
  const contactList = await pool.fetchAndCacheContactList(myPubkey);
  myFollows = contactList.tags.filter((t) => (t[0] === 'p')).map((t) => (t[1]));

  pool.subscribe([
    { kinds: [1, 5], authors: myFollows, limit: 20 },
  ],
    normalizeUrls(myReadRelays),
    async (ev, _isAfterEose, _relayURL) => {
      switch (ev.kind) {
        case 1:
          addEvent(ev);
          break;
        case 5:
          pool.publish(ev, normalizeUrls(feedRelays));
          break;
      }
    }
  );
}

function subscribeReactions() {
  relayStatus.value = pool.getRelayStatuses();

  pool.subscribe([
    { kinds: [1, 6, 7], "#p": [myPubkey], limit: 10 },
  ],
    normalizeUrls(myReadRelays),
    async (ev, _isAfterEose, _relayURL) => {
      addEvent(ev);

      if (
        !firstReactionFetching &&
        soundEffect.value &&
        events.value[events.value.length - 1].created_at < ev.created_at
      ) {
        console.log("reactioned", ev);
        playRectionSound();
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

let draftEvent = ref(nostr.getBlankEvent(nostr.Kind.Text));
let editingTags = ref(nostr.getBlankEvent(nostr.Kind.Text));
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
  draftEvent.value = nostr.getBlankEvent(nostr.Kind.Text);
}

async function postEvent(event: nostr.Event) {
  // @ts-ignore
  event = await window.nostr?.signEvent(JSON.parse(JSON.stringify(event)));

  pool.publish(event, normalizeUrls(myWriteRelays));

  if (soundEffect.value) {
    playActionSound();
  }

  addEvent(event);
}

function openReplyPost(reply: nostr.Event): void {
  // 投稿欄をすべて空っぽにする
  draftEvent.value = nostr.getBlankEvent(nostr.Kind.Text);
  const parsedTags = nostr.nip10.parse(reply);
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

const noteTextarea = ref<HTMLTextAreaElement | null>(null);
watch(isPostOpen, async (isPostOpened) => {
  if (isPostOpened) {
    await nextTick();
    noteTextarea.value?.focus();
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
        const d = nostr.nip19.decode(ns.replace('nostr:', '').replace('@', ''));
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

function search() {
  events.value = eventsToSearch.value.filter((e) => {
    return searchSubstring(e.content, searchWords.value);
  });
  events.value = events.value.slice(0, countOfDisplayEvents);
  if (events.value.length === 0) {
    events.value[0] = {
      id: "",
      kind: 1,
      created_at: Math.floor(new Date().getTime() / 1000),
      pubkey: "",
      sig: "",
      tags: [],
      content: searchWords.value + " is not found.",
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
  return urls.map((url) => (nostr.utils.normalizeURL(url)));
}

const isFaved = new Set<string>();
const isReposted = new Set<string>();

function handleKeydownShortcuts(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  if (target.tagName.toLowerCase() === 'input' || target.tagName.toLocaleLowerCase() === 'textarea') {
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
    return;
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
  } else if (e.key === "f" && logined.value && !isPostOpen.value) {
    const targetEvent = events.value.find((e) => (e.id === focusedItemId.value));
    if (targetEvent && targetEvent.kind === 1 && !isFaved.has(targetEvent.id)) {
      e.preventDefault();
      e.stopPropagation();

      const confirmed = window.confirm(`ふぁぼりますか？\n\n"${targetEvent.content}"`);
      if (confirmed) {
        const reaction = createFavEvent(targetEvent) as nostr.Event;
        reaction.pubkey = myPubkey;
        postEvent(reaction);
        isFaved.add(targetEvent.id);
      }
    }
  } else if (e.key === "e" && logined.value && !isPostOpen.value) {
    const targetEvent = events.value.find((e) => (e.id === focusedItemId.value));
    if (targetEvent && targetEvent.kind === 1 && !isReposted.has(targetEvent.id)) {
      e.preventDefault();
      e.stopPropagation();

      const confirmed = window.confirm(`リポストしますか？\n\n"${targetEvent.content}"`);
      if (confirmed) {
        const repost = createRepostEvent(targetEvent) as nostr.Event;
        repost.pubkey = myPubkey;
        postEvent(repost);
        isReposted.add(targetEvent.id);
      }
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

function loggingStatistics(): void {
  console.log(JSON.stringify({
    eventsToSearchSize: eventsToSearch.value.length,
    profilesSize: profiles.value.size,
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

const japaneseFollowBotPubkey = "087c51f1926f8d3cb4ff45f53a8ee2a8511cfe113527ab0e87f9c5821201a61e";
let japaneseUsers: string[] = [];
async function collectJapaneseUsers() {
  console.log(JSON.stringify({ msg: "Japanese users1", japaneseUsers }));
  const contactList = await pool.fetchAndCacheContactList(japaneseFollowBotPubkey);
  japaneseUsers = contactList.tags.filter((t) => (t[0] === 'p')).map((t) => (t[1]));

  console.log(JSON.stringify({ msg: "Japanese users2", japaneseUsers }));
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
        <SearchWordControl v-model:search-words="searchWords" v-on:change="search()"></SearchWordControl>
        <RelayStatus v-bind:relays="relayStatus"></RelayStatus>
      </div>
    </div>
    <div class="p-index-body">
      <div class="p-index-header" v-if="npubId">
        <div><a
            :href="'?' + nostr.nip19.npubEncode(npubId) + '&date=' + npubDateYesterday?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">前の日へ</a>
        </div>
        <div><a
            :href="'?' + nostr.nip19.npubEncode(npubId) + '&date=' + npubDate?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')"><span>{{
              npubDate?.toLocaleDateString() }}</span></a></div>
        <div><a
            :href="'?' + nostr.nip19.npubEncode(npubId) + '&date=' + npubDateTomorrow?.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">次の日へ</a>
        </div>
      </div>
      <div class="p-index-feeds" :ref="(el) => { itemsTop = el as HTMLElement }">
        <div v-for="e in events" :key="e.id"
          :class="{ 'c-feed-item': true, 'c-feed-item-focused': (showFocusBorder && focusedItemId === e.id) }"
          :ref="(el) => { if (el) { items[e.id] = el as HTMLElement } }"
          @click="{ focusedItemId = e.id; focusItemIndex = events.findIndex((e) => (e.id === focusedItemId)); console.log(JSON.stringify({ focusedItemId, focusItemIndex })) }">
          <FeedProfile v-bind:profile="getProfile(e.pubkey)"></FeedProfile>
          <FeedReplies v-bind:event="e" :get-profile="getProfile" :get-event="getEvent" v-if="e.kind !== 6"></FeedReplies>
          <FeedContent v-bind:event="e" :get-profile="getProfile" :get-event="getEvent" :speak-note="speakNote"
            :volume="volume" :is-logined="logined" :post-event="postEvent" :open-reply-post="openReplyPost"></FeedContent>
          <FeedFooter v-bind:event="e" :speak-note="speakNote" :volume="volume" :is-logined="logined"
            :post-event="postEvent" :get-profile="getProfile" :open-reply-post="openReplyPost"
            :ref="(el) => { if (el) { itemFooters?.set(e.id, el) } }"></FeedFooter>
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
        <button @click="isPostOpen = !isPostOpen; draftEvent = nostr.getBlankEvent(nostr.Kind.Text);"
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
</style>
