<script setup lang="ts">
import { ref } from "vue"
import * as nostr from "nostr-tools"

const pool = new nostr.SimplePool()
const feedRelays = ["wss://relay-jp.nostr.wirednet.jp"]
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
]

const global = pool.sub(feedRelays, [
  {
    kinds: [1],
    limit: 100,
  },
])

const events = ref(new Array<nostr.Event>());
let firstFetching = true;
let autoSpeech = ref(false);
let volume = ref(0.5);

global.on("event", async (ev) => {
  events.value.push(ev)
  events.value.sort((a, b) => {
    return a.created_at === b.created_at
      ? a.id === b.id
        ? 0
        : a.id < b.id
          ? 1
          : -1
      : a.created_at < b.created_at
        ? 1
        : -1
  })
  events.value = events.value.filter((event, index, array) => {
    return index === 0 || event.id !== array[index - 1].id
  })

  if (!firstFetching && autoSpeech.value) {
    speakNote(ev);
  }
})
global.on("eose", async () => {
  collectProfiles()
  if (firstFetching) {
    firstFetching = false
  }
})

// ローカルストレージからプロフィール情報を読み出しておく
const profiles = ref(new Map<string, any>(JSON.parse(localStorage.getItem('profiles') ?? '[]')))
let oldProfileCacheMismatch = false
let cacheMissHitPubkeys: string[] = []

function getProfile(pubkey: string): any {
  if (!profiles.value.has(pubkey)) {
    oldProfileCacheMismatch = true
    cacheMissHitPubkeys.push(pubkey)
  }
  return profiles.value.get(pubkey)
}

async function collectProfiles() {
  if (!oldProfileCacheMismatch) {
    return
  }

  const pubkeySet = new Set<string>()
  for (const e of events.value) {
    pubkeySet.add(e.pubkey)
  }
  for (const p of cacheMissHitPubkeys) {
    pubkeySet.add(p)
  }
  cacheMissHitPubkeys.length = 0
  const pubkeys = Array.from(pubkeySet)
  const prof = pool.sub(profileRelays, [
    {
      kinds: [0, 3],
      authors: pubkeys,
    },
  ])
  prof.on("event", async (ev) => {
    if (ev.kind === 0) {
      const content = JSON.parse(ev.content)
      if (!profiles.value.has(ev.pubkey) || profiles.value.get(ev.pubkey)?.created_at < ev.created_at) {
        content.created_at = ev.created_at
        profiles.value.set(ev.pubkey, content)
      }
    } else if (ev.kind === 3) {
      if (false && ev.content) { // プロフィール情報を取得するリレーを各人のものから拾おうとしたが、非常に多くなりすぎるのでやめた
        const content = JSON.parse(ev.content)
        for (const r in content) {
          if (content[r].write && !profileRelays.find(e => e === r)) {
            profileRelays.push(r)
            profileRelays.sort()
          }
        }
        console.log(profileRelays)
      }
    }
  })
  prof.on("eose", async () => {
    prof.unsub()
    oldProfileCacheMismatch = false

    // ローカルストレージにプロフィール情報を保存しておく
    localStorage.setItem('profiles', JSON.stringify(Array.from(profiles.value.entries())))
  })
}
setInterval(collectProfiles, 1000)

const synth = window.speechSynthesis
async function speakNote(event: nostr.Event) {
  setTimeout(() => {
    const display_name =
      profiles.value.get(event.pubkey)?.display_name + "さん" ?? profiles.value.get(event.pubkey)?.name + "-san"

    let utterUserNameText = display_name
    utterUserNameText = utterUserNameText
      .replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/g, "")
      .replace(
        /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g,
        ""
      )

    const utterUserName = new SpeechSynthesisUtterance(utterUserNameText)
    if (utterUserNameText.match(/[亜-熙ぁ-んァ-ヶ]/)) {
      utterUserName.lang = "ja-JP"
    } else {
      utterUserName.lang = "en-US"
    }
    utterUserName.volume = volume.value;
    synth.speak(utterUserName)

    let utterEventContent = event.content
    utterEventContent = utterEventContent
      .replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/g, "")
      .replace(
        /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g,
        ""
      )

    const utterContent = new SpeechSynthesisUtterance(utterEventContent)
    if (utterEventContent.match(/[亜-熙ぁ-んァ-ヶ]/)) {
      utterContent.lang = "ja-JP"
    } else {
      utterContent.lang = "en-US"
    }
    utterContent.volume = volume.value;
    synth.speak(utterContent)
  }, 1500)
}

function getReplyPrevUser(event: nostr.Event): string {
  const filteredTags = event.tags.filter(([tagType]) => tagType === "p")
  if (filteredTags.length) {
    const tags = filteredTags[filteredTags.length - 1]
    return tags[1]
  }
  return ""
}

function getReplyPrevNote(event: nostr.Event): string {
  const filteredTags = event.tags.filter(([tagType]) => tagType === "e")
  if (filteredTags.length) {
    const tags = filteredTags[filteredTags.length - 1]
    return tags[1]
  }
  return ""
}

let logined = ref(false)
let myPubkey = ""
let myRelaysCreatedAt = 0
let myRelays: string[] = []
async function login() {
  // @ts-ignore
  myPubkey = (await window.nostr?.getPublicKey()) ?? ""

  if (myPubkey) {
    logined.value = true
    collectMyRelay()
  }
}

let note = ""
async function post() {
  if (!note) {
    return
  }
  let event = {
    kind: 1,
    tags: [],
    pubkey: myPubkey,
    content: note,
    created_at: Math.floor(Date.now() / 1000),
  }
  // @ts-ignore
  event = await window.nostr?.signEvent(event)

  // @ts-ignore
  const submit = pool.publish(myRelays, event)
  submit.on("ok", () => {
    console.log("ok")
  })
  submit.on("failed", () => {
    console.log("NG")
  })

  note = ""
}

async function collectMyRelay() {
  const relays = pool.sub(profileRelays, [
    {
      kinds: [3],
      authors: [myPubkey],
    },
  ])
  relays.on("event", async (ev) => {
    if (ev.content && myRelaysCreatedAt < ev.created_at) {
      const content = JSON.parse(ev.content)
      console.log(content)
      myRelaysCreatedAt = ev.created_at
      for (const r in content) {
        if (content[r].write) {
          myRelays.push(r)
        }
      }
    }
  })
  relays.on("eose", async () => {
    relays.unsub()
  })
}

function checkSend(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    post()
  }
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
      </div>
    </div>
    <div class="p-index-body">
      <div class="p-index-post">
        <div class="p-index-post--signin" v-if="!logined">
          <h2 class="p-index-post__head">この画面からつぶやく</h2>
          <div class="p-p-index-post__signin-btn">
            <input class="b-login" type="button" value="NIP-07でログイン" v-on:click="($event) => login()" />
          </div>
        </div>
        <div class="p-index-post--isLogin" v-if="logined">
          <div class="c-feed-profile">
            <p class="c-feed-profile__avatar">
              <img class="profilePicture"
                v-bind:src="getProfile(myPubkey)?.picture ?? 'https://placehold.jp/60x60.png'" />
            </p>
            <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.npubEncode(myPubkey)"
              class="c-feed-profile__detail">
              <span class="c-feed-profile__display-name">
                {{ getProfile(myPubkey)?.display_name ?? getProfile(myPubkey)?.name ?? "loading" }}
              </span>
              <span class="c-feed-profile__user-name"> @{{ getProfile(myPubkey)?.name ?? "" }} </span>
            </a>
          </div>
          <div class="p-p-index-post__editer">
            <div class="p-p-index-post__textarea">
              <textarea class="i-note" id="note" rows="5" v-model="note"
                @keydown.enter="$event => checkSend($event)"></textarea>
            </div>
            <div class="p-p-index-post__post-btn">
              <input class="b-post" type="button" value="投稿" v-on:click="post()" />
            </div>
          </div>
        </div>
      </div>
      <div class="p-index-feeds">
        <div v-for="e in events" v-bind:key="nostr.nip19.noteEncode(e.id)" class="c-feed-item">
          <div class="c-feed-profile">
            <p class="c-feed-profile__avatar">
              <img class="profilePicture"
                v-bind:src="getProfile(e.pubkey)?.picture ?? 'https://placehold.jp/60x60.png'" />
            </p>
            <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.npubEncode(e.pubkey)"
              class="c-feed-profile__detail">
              <span class="c-feed-profile__display-name">
                {{ getProfile(e.pubkey)?.display_name ?? getProfile(e.pubkey)?.name ?? "loading" }}
              </span>
              <span class="c-feed-profile__user-name"> @{{ getProfile(e.pubkey)?.name ?? "" }} </span>
            </a>
          </div>
          <p class="c-feed-reply" v-if="getReplyPrevUser(e) || getReplyPrevNote(e)">
            <span v-if="getReplyPrevUser(e)">
              <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.npubEncode(getReplyPrevUser(e))">
                <span class="c-feed-reply-profile__display-name">
                  {{
                    getProfile(getReplyPrevUser(e))?.display_name ?? getProfile(getReplyPrevUser(e))?.name ?? "loading"
                  }}
                </span>
              </a>
              の
            </span>
            <span v-else>
              <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.npubEncode(e.pubkey)">
                <span class="c-feed-reply-profile__display-name">
                  {{ getProfile(e.pubkey)?.display_name ?? getProfile(e.pubkey)?.name ?? "loading" }}
                </span>
              </a>
              の
            </span>
            <span v-if="getReplyPrevNote(e)">
              <a target="_blank"
                v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.noteEncode(getReplyPrevNote(e))">投稿</a>
            </span>
            への返信
          </p>
          <p class="c-feed-content">
            {{ e.content.replace("\\n", "\n") }}
          </p>
          <p class="c-feed-date">
            <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.noteEncode(e.id)">
              {{ new Date(e.created_at * 1000).toLocaleString() }}</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.p-index-wrap {
  box-sizing: border-box;
  max-width: 1200px;
  width: 100%;
  padding: 0 10px;
  display: flex;
  gap: 20px;
}

@media screen and (max-width: 880px) {
  .p-index-wrap {
    display: block;
  }
}

.c-note-backgroud {
  margin-top: 5px;
  background-color: #ffffff;
  color: #213547;
  border-radius: 4px;
  box-sizing: border-box;
  padding: 10px;
}

.p-index-heading {
  width: 360px;
  flex-shrink: 0;
  position: relative;
}

.p-index-body {
  flex-grow: 1;
}

.p-index-heading__inner {
  position: sticky;
  top: 0;
}

@media screen and (max-width: 880px) {
  .p-index-heading {
    width: 100%;
  }

  .p-index-heading__inner {
    position: relative;
  }
}

.p-index-feeds {
  padding: 2rem 0;
}

.p-index-title {
  font-family: "Anton", sans-serif;
  color: #ffffff;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 2rem 0;
}

.p-index-title__main {
  font-size: 4rem;
}

.p-index-title__sub {
  font-size: 1.5rem;
}

@media screen and (max-width: 880px) {
  .p-index-title {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .p-index-title__main {
    font-size: 3rem;
  }

  .p-index-title__sub {
    font-size: 1.5rem;
    width: 100%;
  }
}

.p-index-intro {
  margin-top: 2rem;
}

@media screen and (max-width: 880px) {
  .p-index-intro {
    margin-top: 0rem;
  }
}

.p-index-intro__head {
  font-size: 1.5rem;
  color: #ffffff;
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.p-index-intro__head::after {
  content: "";
  width: 3em;
  height: 2px;
  background-color: #ffffff;
}

.p-index-intro__text {
  color: #ffffff;
  margin: 0;
  line-height: 1.8;
  margin-top: 0.3rem;
}

.p-index-intro__text-link {
  color: #fc5fa1;
  font-weight: bold;
}

.p-index-intro__text code {
  display: inline-block;
}

.p-index-intro__btn {
  background-color: #fc5fa1;
  color: #ffffff;
  display: inline-block;
  padding: 0.5rem 1.4rem;
  border-radius: 2rem;
  transition: all 0.4s;
}

.p-index-intro__btn:hover {
  background-color: #df3d81;
}

.p-index-speech {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 1rem;
}

.p-index-speech__head {
  color: #ffffff;
  font-size: 14px;
}

.p-index-speech__body {
  flex-grow: 1;
  border-left: 1px solid #fff;
  padding-left: 10px;
}

.p-index-speech-cb {
  padding: 12px 8px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.p-index-speech-cb__input {
  margin: 0;
  width: 0;
  opacity: 0;
}

.p-index-speech-cb:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

.p-index-speech-cb:hover>.p-index-speech-cb__dummy {
  transform: scale(1.1);
}

.p-index-speech-cb__input:focus+.p-index-speech-cb__dummy {
  transform: scale(1.1);
}

.p-index-speech-cb__input:checked+.p-index-speech-cb__dummy {
  background: #df3d81;
}

.p-index-speech-cb__input:checked+.p-index-speech-cb__dummy::before {
  content: "";
  display: block;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 35%;
  height: 4px;
  border-radius: 2px;
  transform: translate(-4px, 2px) rotateZ(-135deg);
  transform-origin: 2px 2px;
  background: #ffffff;
}

.p-index-speech-cb__input:checked+.p-index-speech-cb__dummy::after {
  content: "";
  display: block;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 70%;
  height: 4px;
  border-radius: 2px;
  transform: translate(-4px, 2px) rotateZ(-45deg);
  transform-origin: 2px 2px;
  background: #ffffff;
}

.p-index-speech-cb__dummy {
  position: relative;
  top: 0;
  left: 0;
  display: block;
  width: 20px;
  height: 20px;
  border: solid 2px transparent;
  background: rgba(255, 255, 255, 1);
  border-radius: 50%;
  transition: all 0.15s linear;
}

.p-index-speech-cb__text-label {
  margin-left: 12px;
  display: block;
  font-size: 18px;
  font-weight: bold;
  color: #fff;
}

.p-index-speech-volume {
  color: #fff;
}

.c-feed-item {
  margin-top: 5px;
  background-color: #ffffff;
  border-radius: 4px;
  box-sizing: border-box;
  padding: 10px;
}

.c-feed-profile {
  display: flex;
  gap: 10px;
}

.c-feed-profile__avatar {
  padding: 0;
  margin: 0;
  flex-grow: 0;
  flex-shrink: 0;
  max-width: 3rem;
}

.c-feed-profile__detail {
  flex-grow: 1;
}

.c-feed-profile__display-name {
  display: block;
  color: #213547;
}

.c-feed-profile__user-name {
  display: block;
  font-size: 14px;
}

.c-feed-reply-profile__display-name {
  display: inline-block;
}

.c-feed-content {
  font-size: 1.2em;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
  margin: 0;
  color: #213547;
}

.c-feed-reply {
  font-size: 0.8em;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
  margin: 0;
  color: #213547;
}

.c-feed-date {
  font-size: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
  margin: 0;
  text-align: right;
}

p {
  width: 100%;
  word-wrap: break-word;
  word-break: break-all;
}

.profilePicture {
  max-height: 3rem;
  max-width: 3rem;
  height: 3rem;
  margin: 0;
  object-fit: cover;
  border-radius: 4px;
}

.p-index-post {
  background-color: #050a30;
  padding: 8px;
  position: sticky;
  top: 0;
}

.p-index-post--isLogin {
  background: #fff;
  padding: 8px;
  border-radius: 4px;
}

@media screen and (max-width: 880px) {
  .p-index-post {
    position: fixed;
    top: auto;
    left: 0;
    bottom: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .p-index-post--signin {
    padding: 12px 0;
  }
}

.p-index-post__head {
  margin: 0;
  text-align: center;
  font-size: 18px;
  color: #fff;
}

.p-p-index-post__signin-btn {
  text-align: center;
  margin-top: 12px;
}

.p-p-index-post__post-btn {
  text-align: right;
}

.p-p-index-post__editer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.p-p-index-post__textarea {
  flex-grow: 1;
}

.b-login,
.b-post {
  background-color: #fc5fa1;
  color: #ffffff;
  display: inline-block;
  padding: 0.5rem 1.4rem;
  border-radius: 2rem;
  transition: all 0.4s;
  border: none;
  cursor: pointer;
}

.b-login:hover,
.b-post:hover {
  background-color: #df3d81;
}

.i-note {
  width: 100%;
  box-sizing: border-box;
  font-size: 16px;
  padding: 5px;
  background-color: #213547;
  color: #ffffff;
}
</style>
