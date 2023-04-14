<script setup lang="ts">
import { ref, Ref } from 'vue';
import * as nostr from 'nostr-tools'

const pool = new nostr.SimplePool()
const relays = [
  "wss://relay-jp.nostr.wirednet.jp",
  /*  "wss://relay.nostr.wirednet.jp",
    "wss://relay.snort.social",
    "wss://eden.nostr.land",
    "wss://relay.nostr.info",
    "wss://relay.current.fyi",
    "wss://nostr-relay.nokotaro.com",*/
];
const global = pool.sub(
  relays,
  [
    {
      kinds: [1],
      limit: 100
    }
  ]
)

const events = ref(new Array<nostr.Event>())
const profiles = ref(new Map<string, any>())

global.on('event', async (ev) => {
  events.value.push(ev)
  events.value.sort((a, b) => {
    return a.created_at === b.created_at
      ? (a.id === b.id ? 0 : a.id < b.id ? 1 : -1)
      : (a.created_at < b.created_at ? 1 : -1);
  });
  events.value = events.value.filter((event, index, array) => {
    return index === 0 || event.id !== array[index - 1].id;
  });
})

function collectPubkeys() {
  const pubkeys = events.value.map(event => event.pubkey);
  const prof = pool.sub(
    relays,
    [
      {
        kinds: [0],
        authors: pubkeys
      }
    ]
  )
  prof.on('event', async (ev) => {
    const content = JSON.parse(ev.content)
    profiles.value.set(ev.pubkey, content)
  })
  prof.on('eose', () => {
    prof.unsub()
  })
}
setTimeout(collectPubkeys, 1000)
setInterval(collectPubkeys, 15000);
</script>

<template>
  <div v-for="e in events">
    <p>
      <span>{{ new Date(e.created_at * 1000).toLocaleString() }}</span> &nbsp;
      <a v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.npubEncode(e.pubkey)">{{
        profiles.get(e.pubkey)?.display_name ?? '' }} (@{{ profiles.get(e.pubkey)?.name ?? '' }})
      </a><br>
      <span class="content">{{ e.content }}</span><br>
      <a v-bind:href="'https://nostx.shino3.net/' + nostr.nip19.noteEncode(e.id)">{{
        'https://nostx.shino3.net/' + nostr.nip19.noteEncode(e.id) }}</a>
    </p>
    <hr>
  </div>
</template>

<style scoped>
.content {
  font-size: 1.2em;
}
</style>
