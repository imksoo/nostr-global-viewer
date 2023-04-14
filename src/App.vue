<script setup lang="ts">
import { ref } from "vue";
import * as nostr from "nostr-tools";

const pool = new nostr.SimplePool();
const relays = [
  "wss://relay-jp.nostr.wirednet.jp",
  /*  "wss://relay.nostr.wirednet.jp",
    "wss://relay.snort.social",
    "wss://eden.nostr.land",
    "wss://relay.nostr.info",
    "wss://relay.current.fyi",
    "wss://nostr-relay.nokotaro.com",*/
];
const global = pool.sub(relays, [
  {
    kinds: [1],
    limit: 100,
  },
]);

const events = ref(new Array<nostr.Event>());
const profiles = ref(new Map<string, any>());

global.on("event", async (ev) => {
  events.value.push(ev);
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
});
global.on("eose", async () => {
  collectPubkeys();
});

async function collectPubkeys() {
  const pubkeySet = new Set<string>();
  for (const e of events.value) {
    pubkeySet.add(e.pubkey);
  }
  const pubkeys = Array.from(pubkeySet);
  const prof = pool.sub(relays, [
    {
      kinds: [0],
      authors: pubkeys,
    },
  ]);
  prof.on("event", async (ev) => {
    const content = JSON.parse(ev.content);
    profiles.value.set(ev.pubkey, content);
  });
  prof.on("eose", async () => {
    prof.unsub();
  });
}
setInterval(collectPubkeys, 60000);
</script>

<template>
  <div class="p-index-wrap">
    <div class="p-index-heading">
      <div class="p-index-heading__inner">
        <h1 class="p-index-title">
          <span class="p-index-title__main">Feeds</span>
          <span class="p-index-title__main">from</span>
          <span class="p-index-title__sub">relay.nostr.wirednet.jp.</span>
        </h1>
        <div class="p-index-intro">
          <h2 class="p-index-intro__head">はじめに</h2>
          <p class="p-index-intro__text">Nostrを始めてみたくなった方は</p>
          <p class="p-index-intro__text">
            <a
              href="https://scrapbox.io/nostr/%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E3%81%AENostr%E3%80%90%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E3%81%AE%E6%96%B9%E3%81%AF%E3%81%93%E3%81%A1%E3%82%89%E3%80%91"
              rel="noopener"
              target="_blank"
              class="p-index-intro__btn"
              >はじめてのNostr【はじめての方はこちら】</a
            >
          </p>
          <p class="p-index-intro__text">を参照ください。<br /></p>
          <p class="p-index-intro__text">
            また、日本向けリレーとしてこのページの裏側にある
            <code>wss://relay-jp.nostr.wirednet.jp</code> をお使いください。
          </p>
        </div>
      </div>
    </div>
    <div class="p-index-feeds">
      <div
        v-for="e in events"
        v-bind:key="nostr.nip19.noteEncode(e.id)"
        class="c-feed-item"
      >
        <div class="c-feed-profile">
          <p class="c-feed-profile__avatar">
            <img
              class="profilePicture"
              v-bind:src="
                profiles.get(e.pubkey)?.picture ??
                'https://placehold.jp/60x60.png'
              "
            />
          </p>
          <a
            target="_blank"
            v-bind:href="
              'https://nostx.shino3.net/' + nostr.nip19.npubEncode(e.pubkey)
            "
            class="c-feed-profile__detail"
          >
            <span class="c-feed-profile__display-name">
              {{ profiles.get(e.pubkey)?.display_name ?? "noname" }}
            </span>
            <span class="c-feed-profile__user-name">
              @{{ profiles.get(e.pubkey)?.name ?? "" }}
            </span>
          </a>
        </div>
        <p class="c-feed-content">
          {{ e.content.replace("\n", "\n") }}
        </p>
        <p class="c-feed-date">
          <a
            target="_blank"
            v-bind:href="
              'https://nostx.shino3.net/' + nostr.nip19.noteEncode(e.id)
            "
          >
            {{ new Date(e.created_at * 1000).toLocaleString() }}</a
          >
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.p-index-wrap {
  box-sizing: border-box;
  max-width: 1200px;
  padding: 0 10px;
  display: flex;
  gap: 20px;
}
@media screen and (max-width: 880px) {
  .p-index-wrap {
    display: block;
  }
}

.p-index-heading {
  width: 360px;
  flex-shrink: 0;
  position: relative;
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
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 2rem 0;
}
.p-index-title__main {
  font-size: 6rem;
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

.c-feed-content {
  font-size: 1.2em;
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
</style>
