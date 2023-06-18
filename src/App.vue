<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import * as nostr from "nostr-tools";
import { RelayPool } from "nostr-relaypool";
import { useRoute } from "vue-router";

import sushiDataJSON from "./assets/sushiyuki.json";
import mahjongDataJSON from "./assets/mahjong.json";

import RelayStatus from "./components/RelayStatus.vue";
import FeedProfile from "./components/FeedProfile.vue";
import FeedReplies from "./components/FeedReplies.vue";
import FeedContent from "./components/FeedContent.vue";
import FeedFooter from "./components/FeedFooter.vue";

const route = useRoute();
const sushiMode = computed(() => {
  return route.query.sushi === "on";
});
const mahjongMode = computed(() => {
  return route.query.mahjong === "on";
});
const sushiData = ref(sushiDataJSON);
const sushiDataLength = sushiData.value.length;
const mahjongData = ref(mahjongDataJSON);
const mahjongDataLength = mahjongData.value.length;
const profileRandom = new Date().getUTCDate() + new Date().getUTCMonth();

const pool = new RelayPool(undefined, {
  autoReconnect: true,
  logErrorsAndNotices: true,
  subscriptionCache: true,
  useEventCache: true,
});
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

const events = ref(new Array<nostr.Event>());
const eventsToSearch = ref(new Array<nostr.Event>());
const eventsReceived = new Set<string>();

let firstFetching = true;
let autoSpeech = ref(false);
let volume = ref(0.5);
let searchWords = ref("");
let playActionSound = ref(true);

import actionMP3 from './assets/action.mp3';
import reactionMP3 from './assets/reaction.mp3';
const actionSound = new Audio(actionMP3);
const reactionSound = new Audio(reactionMP3);

const totalNumberOfEventsToKeep = 5000;
const initialNumberOfEventToGet = 500;
let countOfDisplayEvents = 100;

pool.subscribe(
  [
    {
      kinds: [1, 6],
      limit: initialNumberOfEventToGet,
    },
  ],
  feedRelays,
  (ev, _isAfterEose, _relayURL) => {
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

// 823chan
pool.subscribe(
  [
    {
      kinds: [1],
      authors: ["3aa38bf663b6c834a04a6542edf14a81d3223e050c3cc9b7479f8c869c432cf2"],
      limit: initialNumberOfEventToGet / 10,
    },
  ],
  ["wss://yabu.me/"],
  (ev, _isAfterEose, _relayURL) => {
    addEvent(ev);
  }
);

function addEvent(event: nostr.Event): void {
  if (eventsReceived.has(event.id)) {
    return;
  }
  eventsReceived.add(event.id);
  eventsToSearch.value = nostr.utils.insertEventIntoDescendingList(eventsToSearch.value, event);
  eventsToSearch.value.slice(-totalNumberOfEventsToKeep);
  search();
  if (
    !firstFetching &&
    autoSpeech.value &&
    events.value.some((obj) => {
      return obj.id === event.id;
    })
  ) {
    speakNote(event);
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

function collectEvents() {
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
    (ev, _isAfterEose, _relayURL) => {
      addEvent(ev);
    }
  );
}
setInterval(collectEvents, 1000);

// ローカルストレージからプロフィール情報を読み出しておく
const profiles = ref(
  new Map<string, any>(JSON.parse(localStorage.getItem("profiles") ?? "[]"))
);
let oldProfileCacheMismatch = false;
let cacheMissHitPubkeys: string[] = [];

function getProfile(pubkey: string): any {
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
  const pubkeyNumber = profileRandom + parseInt(pubkey.substring(0, 3), 29);
  const characters = [...sushiData.value, ...mahjongData.value];
  if (sushiMode.value && mahjongMode.value) {
    const randomNumber = pubkeyNumber % (sushiDataLength + mahjongDataLength);
    return characters[randomNumber];
  } else if (sushiMode.value) {
    const randomNumber = pubkeyNumber % (sushiDataLength);
    return sushiData.value[randomNumber];
  } else if (mahjongMode.value) {
    const randomNumber = pubkeyNumber % (mahjongDataLength);
    return mahjongData.value[randomNumber];
  }
  return profiles.value.get(pubkey);
}

function collectProfiles() {
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
    (ev, _isAfterEose, _relayURL) => {
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
    () => {
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

const synth = window.speechSynthesis;
async function speakNote(event: nostr.Event, waitTime: number = 1500) {
  setTimeout(() => {
    const display_name =
      profiles.value.get(event.pubkey)?.display_name + "さん" ??
      profiles.value.get(event.pubkey)?.name + "-san";

    let utterUserNameText = display_name;
    utterUserNameText = utterUserNameText
      .replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/g, "")
      .replace(
        /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g,
        ""
      );

    const utterUserName = new SpeechSynthesisUtterance(utterUserNameText);
    if (utterUserNameText.match(/[亜-熙ぁ-んァ-ヶ]/)) {
      utterUserName.lang = "ja-JP";
    } else {
      utterUserName.lang = "en-US";
    }
    utterUserName.volume = volume.value;
    synth.speak(utterUserName);

    let utterEventContent = event.content;
    utterEventContent = utterEventContent
      .replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/g, "")
      .replace(
        /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g,
        ""
      )
      .replace(/nostr:(nprofile|nrelay|nevent|naddr|nsec|npub|note)\S*/g, "");

    const utterContent = new SpeechSynthesisUtterance(utterEventContent);
    if (utterEventContent.match(/[亜-熙ぁ-んァ-ヶ]/)) {
      utterContent.lang = "ja-JP";
    } else {
      utterContent.lang = "en-US";
    }
    utterContent.volume = volume.value;
    synth.speak(utterContent);
  }, waitTime);
}

let logined = ref(false);
let isPostOpen = ref(false);
let myPubkey = "";
let myRelaysCreatedAt = 0;
let myReadRelays: string[] = [];
let myWriteRelays: string[] = [];
let firstReactionFetching = true;
let firstReactionFetchedRelays = 0;
async function login() {
  // @ts-ignore
  myPubkey = (await window.nostr?.getPublicKey()) ?? "";

  if (myPubkey) {
    logined.value = true;
    countOfDisplayEvents *= 2;
    collectMyRelay();

    setTimeout(() => {
      relayStatus.value = pool.getRelayStatuses();
      pool.subscribe([
        { kinds: [6, 7], "#p": [myPubkey], limit: 10 }
      ],
        normalizeUrls(myReadRelays),
        (ev, _isAfterEose, _relayURL) => {
          addEvent(ev);

          if (
            !firstReactionFetching &&
            playActionSound.value &&
            (ev.kind == 6 || ev.kind == 7) &&
            reactionSound.paused &&
            events.value[events.value.length - 1].created_at < ev.created_at
          ) {
            console.log("reactioned", ev);
            reactionSound.currentTime = 0;
            reactionSound.play();
          }
        },
        undefined,
        () => {
          firstReactionFetchedRelays++;
          if (firstReactionFetchedRelays > myReadRelays.length / 2) {
            setTimeout(() => {
              firstReactionFetching = false;
            }, 10 * 1000);
          }
        }
      );
    }, 1000);
  }
}

let note = ref("");
async function post() {
  if (!note) {
    return;
  }
  let event = nostr.getBlankEvent(nostr.Kind.Text);
  event.content = note.value;
  event.created_at = Math.floor(Date.now() / 1000)

  // @ts-ignore
  event = await window.nostr?.signEvent(event);

  // @ts-ignore
  postEvent(event);
  isPostOpen.value = false;
  note.value = "";

  // @ts-ignore
  addEvent(event);
}

async function postEvent(event: nostr.Event) {
  event.pubkey = myPubkey;
  // @ts-ignore
  event = await window.nostr?.signEvent(event);

  pool.publish(event, normalizeUrls(myWriteRelays));

  if (playActionSound.value) {
    actionSound.currentTime = 0;
    actionSound.play();
  }
}

const noteTextarea = ref<HTMLTextAreaElement | null>(null);
watch(isPostOpen, async (isPostOpened) => {
  if (isPostOpened) {
    await nextTick();
    noteTextarea.value?.focus();
  }
});

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
  return urls.map((url) => {
    let urlObject = new URL(url);
    // If there's no pathname, add a slash
    if (urlObject.pathname === "") {
      urlObject.pathname = "/";
    }
    return urlObject.toString();
  });
}

function appVersion() {
  // @ts-ignore
  return __APP_VERSION__;
}

function loggingStatistics(): void {
  console.log({
    eventsToSearchSize: eventsToSearch.value.length,
    profilesSize: profiles.value.size,
  });
}
setInterval(loggingStatistics, 30 * 1000);
</script>

<template>
  <div class="p-index-wrap">
    <div class="p-index-heading">
      <div class="p-index-heading__inner">
        <h1 class="p-index-title">
          <span class="p-index-title__main">Nostr Feeds</span>
          <span class="p-index-title__sub">From
            {{
              feedRelays
                .map((s) => {
                  return s.replace(/wss?:\/\/(.*)\//, "$1");
                })
                .join(",")
            }}</span>
          <span class="p-index-title__sub">Version: {{ appVersion() }}</span>
        </h1>
        <div class="p-index-signin" v-if="!logined">
          <h2 class="p-index-signin__head">この画面からつぶやく</h2>
          <div class="p-index-signin__body">
            <input class="p-index-signin__btn" type="button" value="NIP-07でログイン" v-on:click="(_$event) => login()" />
          </div>
        </div>
        <div class="p-index-intro" v-if="!logined">
          <h2 class="p-index-intro__head">はじめに</h2>
          <p class="p-index-intro__text">Nostrを始めてみたくなった方は</p>
          <p class="p-index-intro__text">
            <a href="https://scrapbox.io/nostr/%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E3%81%AENostr%E3%80%90%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E3%81%AE%E6%96%B9%E3%81%AF%E3%81%93%E3%81%A1%E3%82%89%E3%80%91"
              rel="noopener" target="_blank" class="p-index-intro__btn">はじめてのNostr【はじめての方はこちら】</a>
          </p>
          <p class="p-index-intro__text">を参照ください。<br /></p>
          <p class="p-index-intro__text">
            また、日本向けリレーとしてこのページの裏側にある
            <code>wss://relay-jp.nostr.wirednet.jp</code> も是非お使いください。
          </p>
          <p class="p-index-intro__text">
            このサイトのソースコードは<a href="https://github.com/imksoo/nostr-global-viewer" class="p-index-intro__text-link"
              target="_blank">GitHub</a>にあります。
          </p>
          <p class="p-index-intro__text">
            <a href="https://awayuki.github.io/emojis.html" target="_blank" class="p-index-intro__text-link">SUSHIYUKI
              emojis (©awayuki)</a> の絵文字素材や
            <a href="https://soundeffect-lab.info/" target="_blank" class="p-index-intro__text-link">効果音ラボ</a>
            の効果音素材を利用しています。
          </p>
          <p class="p-index-intro__text">
            なお、私が管理するNostrリレーの利用規約は
            <a href="https://relay.nostr.wirednet.jp/index.html" class="p-index-intro__text-link"
              target="_blank">relay.nostr.wirednet.jp</a>
            に掲示してあります。
          </p>
        </div>

        <div class="p-index-speech">
          <h2 class="p-index-speech__head">読み上げ</h2>
          <div class="p-index-speech__body">
            <label class="p-index-speech-cb" for="speech">
              <input class="p-index-speech-cb__input" type="checkbox" id="speech" v-model="autoSpeech" />
              <span class="p-index-speech-cb__dummy"></span>
              <span class="p-index-speech-cb__text-label">自動読み上げをする</span>
            </label>
            <div class="p-index-speech-volume">
              <label for="volume">音量</label>
              <input type="range" id="volume" v-model="volume" min="0" max="1" step="0.1" />
            </div>
          </div>
        </div>

        <div class="p-index-speech">
          <h2 class="p-index-speech__head">効果音</h2>
          <div class="p-index-speech__body">
            <label class="p-index-speech-cb" for="sound">
              <input class="p-index-speech-cb__input" type="checkbox" id="sound" v-model="playActionSound" />
              <span class="p-index-speech-cb__dummy"></span>
              <span class="p-index-speech-cb__text-label">効果音を鳴らす</span>
            </label>
          </div>
        </div>

        <div class="p-index-search">
          <h2 class="p-index-search__head">フィルタ</h2>
          <div class="p-index-search__body">
            <input class="p-index-search__input" type="search" id="search" v-model="searchWords" v-on:change="search()" />
          </div>
        </div>

        <RelayStatus v-bind:relays="relayStatus"></RelayStatus>
      </div>
    </div>
    <div class="p-index-body">
      <div class="p-index-feeds">
        <div v-for="e in events" v-bind:key="nostr.nip19.noteEncode(e.id)" class="c-feed-item">
          <FeedProfile v-bind:profile="getProfile(e.pubkey)"></FeedProfile>
          <FeedReplies v-bind:event="e" :get-profile="getProfile" :get-event="getEvent" v-if="e.kind !== 6"></FeedReplies>
          <FeedContent v-bind:event="e" :get-profile="getProfile" :get-event="getEvent" :speak-note="speakNote"
            :is-logined="logined" :post-event="postEvent"></FeedContent>
          <FeedFooter v-bind:event="e" :speak-note="speakNote" :is-logined="logined" :post-event="postEvent"></FeedFooter>
        </div>
      </div>
    </div>
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
        <button @click="isPostOpen = !isPostOpen" class="c-post-cancel__btn">
          <span class="c-post-cancel__icon">☓</span>
        </button>
      </div>
      <FeedProfile v-bind:profile="getProfile(myPubkey)"></FeedProfile>
      <div class="p-index-post__editer">
        <div class="p-index-post__textarea">
          <textarea class="i-note" id="note" rows="8" v-model="note" ref="noteTextarea"
            @keydown.enter="($event) => checkSend($event)" @keydown.esc="(_$event) => {
              isPostOpen = false;
            }
              "></textarea>
        </div>
        <div class="p-index-post__post-btn">
          <input class="b-post" type="button" value="投稿" v-on:click="post()" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import "./assets/scss/project/index.scss";
@import "./assets/scss/component/post.scss";

.c-feed-item {
  margin-top: 5px;
  background-color: #ffffff;
  border-radius: 4px;
  box-sizing: border-box;
  padding: 10px;
}
</style>
