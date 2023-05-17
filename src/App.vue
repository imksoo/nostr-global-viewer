<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import * as nostr from "nostr-tools";

const pool = new nostr.SimplePool();
const feedRelays = ["wss://relay-jp.nostr.wirednet.jp"];
let profileRelays = [
  "wss://nos.lol",
  "wss://nostr-pub.wellorder.net",
  "wss://nostr-relay.nokotaro.com",
  "wss://nostr.h3z.jp",
  "wss://nostr.holybea.com",
  "wss://offchain.pub",
  "wss://relay-jp.nostr.wirednet.jp",
  "wss://relay.austrich.net",
  "wss://relay.current.fyi",
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://relay.nostr.wirednet.jp",
  "wss://relay.snort.social",
];

const global = pool.sub(feedRelays, [
  {
    kinds: [1],
    limit: 1000,
  },
]);

const events = ref(new Array<nostr.Event>());
const eventsBackup = ref(new Array<nostr.Event>());
let firstFetching = true;
let autoSpeech = ref(false);
let volume = ref(0.5);
let searchWords = ref("");

global.on("event", async (ev) => {
  eventsBackup.value.push(ev);
  eventsBackup.value.slice(-1000);
  search();
  if (!firstFetching && autoSpeech.value && events.value.some((obj) => { return obj.id === ev.id })) {
    speakNote(ev);
  }
});

global.on("eose", async () => {
  collectProfiles();
  if (firstFetching) {
    firstFetching = false;
  }
});

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
  const prof = pool.sub(profileRelays, [
    {
      kinds: [0, 3],
      authors: pubkeys,
    },
  ]);
  prof.on("event", async (ev) => {
    if (ev.kind === 0) {
      const content = JSON.parse(ev.content);
      if (
        !profiles.value.has(ev.pubkey) ||
        profiles.value.get(ev.pubkey)?.created_at < ev.created_at
      ) {
        const press = {
          picture: content.picture,
          display_name: content.display_name,
          name: content.name,
          created_at: ev.created_at,
        };
        // content.created_at = ev.created_at
        profiles.value.set(ev.pubkey, press);
      }
    } else if (ev.kind === 3) {
      if (false && ev.content) {
        // プロフィール情報を取得するリレーを各人のものから拾おうとしたが、非常に多くなりすぎるのでやめた
        const content = JSON.parse(ev.content);
        for (const r in content) {
          if (content[r].write && !profileRelays.find((e) => e === r)) {
            profileRelays.push(r);
            profileRelays.sort();
          }
        }
        console.log(profileRelays);
      }
    }
  });
  prof.on("eose", async () => {
    prof.unsub();
    oldProfileCacheMismatch = false;

    // ローカルストレージにプロフィール情報を保存しておく
    localStorage.setItem(
      "profiles",
      JSON.stringify(Array.from(profiles.value.entries()))
    );
  });
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
      .replace(
        /nostr:(nprofile|nrelay|nevent|naddr|nsec|npub|note)\S*/g,
        ""
      );

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

function getReplyPrevUser(event: nostr.Event): string {
  const filteredTags = event.tags.filter(([tagType]) => tagType === "p");
  if (filteredTags.length) {
    const tags = filteredTags[filteredTags.length - 1];
    return tags[1];
  }
  return "";
}

function getReplyPrevNote(event: nostr.Event): string {
  const filteredTags = event.tags.filter(([tagType]) => tagType === "e");
  if (filteredTags.length) {
    const tags = filteredTags[filteredTags.length - 1];
    return tags[1];
  }
  return "";
}

let logined = ref(false);
let isPostOpen = ref(false);
let myPubkey = "";
let myRelaysCreatedAt = 0;
let myRelays: string[] = [];
async function login() {
  // @ts-ignore
  myPubkey = (await window.nostr?.getPublicKey()) ?? "";

  if (myPubkey) {
    logined.value = true;
    collectMyRelay();
  }
}

let note = ref("");
async function post() {
  if (!note) {
    return;
  }
  let event = {
    kind: 1,
    tags: [],
    pubkey: myPubkey,
    content: note.value,
    created_at: Math.floor(Date.now() / 1000),
  };
  // @ts-ignore
  event = await window.nostr?.signEvent(event);

  // @ts-ignore
  const submit = pool.publish(myRelays, event);
  submit.on("ok", () => {
    console.log("ok");
  });
  submit.on("failed", () => {
    console.log("NG");
  });
  isPostOpen.value = false;
  note.value = "";
}

const noteTextarea = ref<HTMLTextAreaElement | null>(null);
watch(isPostOpen, async (isPostOpened) => {
  if (isPostOpened) {
    await nextTick();
    noteTextarea.value?.focus();
  }
});

async function collectMyRelay() {
  const relays = pool.sub(profileRelays, [
    {
      kinds: [3],
      authors: [myPubkey],
    },
  ]);
  relays.on("event", async (ev) => {
    if (ev.content && myRelaysCreatedAt < ev.created_at) {
      const content = JSON.parse(ev.content);
      myRelaysCreatedAt = ev.created_at;
      for (const r in content) {
        if (content[r].write) {
          myRelays.push(r);
        }
      }
    }
  });
  relays.on("eose", async () => {
    relays.unsub();
  });
}

function checkSend(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    post();
  }
}

function search() {
  events.value = events.value.filter((e) => {
    return searchSubstring(e.content, searchWords.value);
  });
  events.value = eventsBackup.value.filter((e) => {
    return searchSubstring(e.content, searchWords.value);
  });
  events.value.sort((a, b) => {
    return a.created_at === b.created_at
      ? a.id === b.id
        ? 0
        : a.id < b.id
          ? 1
          : -1
      : a.created_at < b.created_at
        ? 1
        : -1;
  });
  events.value = events.value.filter((event, index, array) => {
    return index === 0 || event.id !== array[index - 1].id;
  });
  events.value = events.value.slice(0, 100);
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
</script>

<template>
  <div class="p-index-wrap">
    <div class="p-index-heading">
      <div class="p-index-heading__inner">
        <h1 class="p-index-title">
          <span class="p-index-title__main">Nostr</span>
          <span class="p-index-title__main">Feeds</span>
          <span class="p-index-title__sub">from relay-jp.nostr.wirednet.jp.</span>
        </h1>
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
            なお、私が管理するNostrリレーの利用規約は
            <a href="https://relay.nostr.wirednet.jp/index.html" class="p-index-intro__text-link"
              target="_blank">relay.nostr.wirendet.jp</a>
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

        <div class="p-index-search">
          <h2 class="p-index-search__head">フィルタ</h2>
          <div class="p-index-search__body">
            <input class="p-index-search__input" type="search" id="search" v-model="searchWords" v-on:change="search()" />
          </div>
        </div>

        <div class="p-index-signin" v-if="!logined">
          <h2 class="p-index-signin__head">この画面からつぶやく</h2>
          <div class="p-index-signin__body">
            <input class="p-index-signin__btn" type="button" value="NIP-07でログイン" v-on:click="($event) => login()" />
          </div>
        </div>
      </div>
    </div>
    <div class="p-index-body">
      <div class="p-index-feeds">
        <div v-for="e in events" v-bind:key="nostr.nip19.noteEncode(e.id)" class="c-feed-item">
          <div class="c-feed-profile">
            <p class="c-feed-profile__avatar">
              <img class="c-feed-profile__picture" v-bind:src="getProfile(e.pubkey)?.picture ??
                'https://placehold.jp/60x60.png'
                " />
            </p>
            <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.npubEncode(e.pubkey)
              " class="c-feed-profile__detail">
              <span class="c-feed-profile__display-name">
                {{
                  getProfile(e.pubkey)?.display_name ??
                  getProfile(e.pubkey)?.name ??
                  "loading"
                }}
              </span>
              <span class="c-feed-profile__user-name">
                @{{ getProfile(e.pubkey)?.name ?? "" }}
              </span>
            </a>
          </div>
          <p class="c-feed-reply" v-if="getReplyPrevUser(e) || getReplyPrevNote(e)">
            <span v-if="getReplyPrevUser(e)">
              <a target="_blank" v-bind:href="'https://nostx.shino3.net/' +
                nostr.nip19.npubEncode(getReplyPrevUser(e))
                ">
                <span class="c-feed-reply-profile__display-name">
                  {{
                    getProfile(getReplyPrevUser(e))?.display_name ??
                    getProfile(getReplyPrevUser(e))?.name ??
                    "loading"
                  }}
                </span>
              </a>
              の
            </span>
            <span v-else>
              <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.npubEncode(e.pubkey)
                  ">
                <span class="c-feed-reply-profile__display-name">
                  {{
                    getProfile(e.pubkey)?.display_name ??
                    getProfile(e.pubkey)?.name ??
                    "loading"
                  }}
                </span>
              </a>
              の
            </span>
            <span v-if="getReplyPrevNote(e)">
              <a target="_blank" v-bind:href="'https://nostx.shino3.net/' +
                nostr.nip19.noteEncode(getReplyPrevNote(e))
                ">投稿</a>
            </span>
            への返信
          </p>
          <p class="c-feed-content">
            {{ e.content.replace("\\n", "\n") }}
          </p>
          <div class="c-feed-footer">
            <p class="c-feed-speak">
              <span @click="($event) => speakNote(e, 0)">
                <mdicon name="play" />読み上げ
              </span>
            </p>
            <p class="c-feed-date">
              <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.noteEncode(e.id)
                ">
                {{ new Date(e.created_at * 1000).toLocaleString() }}</a>
            </p>
          </div>
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
      <div class="c-feed-profile">
        <p class="c-feed-profile__avatar">
          <img class="c-feed-profile__picture" v-bind:src="getProfile(myPubkey)?.picture ?? 'https://placehold.jp/60x60.png'
            " />
        </p>
        <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.npubEncode(myPubkey)
          " class="c-feed-profile__detail">
          <span class="c-feed-profile__display-name">
            {{
              getProfile(myPubkey)?.display_name ??
              getProfile(myPubkey)?.name ??
              "loading"
            }}
          </span>
          <span class="c-feed-profile__user-name">
            @{{ getProfile(myPubkey)?.name ?? "" }}
          </span>
        </a>
      </div>
      <div class="p-index-post__editer">
        <div class="p-index-post__textarea">
          <textarea class="i-note" id="note" rows="8" v-model="note" ref="noteTextarea"
            @keydown.enter="($event) => checkSend($event)" @keydown.esc="($event) => {
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
@import "./assets/scss/component/feed.scss";
@import "./assets/scss/component/post.scss";
</style>
