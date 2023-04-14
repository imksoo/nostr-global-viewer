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
      ? a.id === b.id ? 0 : a.id < b.id ? 1 : -1
      : a.created_at < b.created_at ? 1 : -1;
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
  <div v-for="e in events">
    <p>
      <a target="_blank" v-bind:href="
        'https://nostx.shino3.net/' + nostr.nip19.npubEncode(e.pubkey)
      ">{{ profiles.get(e.pubkey)?.display_name ?? "" }} (@{{
  profiles.get(e.pubkey)?.name ?? ""
}}) </a><br />
      <span class="content">{{ e.content.replace('\n', "\n") }}</span><br />
      <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.noteEncode(e.id)">
        {{ new Date(e.created_at * 1000).toLocaleString() }}</a>
    </p>
    <hr>
  </div>
</template>

<style scoped>
.content {
  font-size: 1.2em;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
}

p {
  width: 100%;
  word-wrap: break-word;
  word-break: break-all;
}
</style>
