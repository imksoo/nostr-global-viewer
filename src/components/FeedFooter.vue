<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import * as Nostr from "nostr-tools";
import { pool } from "../store";

import { broadcastEventById } from '../actions/EventBroadcast';

const props = defineProps({
  event: {
    type: Object as () => {
      id: string,
      pubkey: string,
      kind: Nostr.Kind,
      content: string,
      tags: string[][],
      created_at: number,
      isReposted: Boolean | undefined,
      isFavorited: Boolean | undefined,
    },
    required: true,
  },
  getProfile: {
    type: Function,
    required: true,
  },
  speakNote: {
    type: Function,
    required: true,
  },
  volume: {
    type: String,
    required: true,
  },
  loggedIn: {
    type: Boolean,
    required: true,
  },
  postEvent: {
    type: Function,
    required: true,
  },
  openReplyPost: {
    type: Function,
    required: true,
  },
  openQuotePost: {
    type: Function,
    required: true,
  },
  addFavEvent: {
    type: Function,
    required: true,
  },
  addRepostEvent: {
    type: Function,
    required: true,
  },
});

const isFavorited = computed(() => (props.event.isFavorited));
const isReposted = computed(() => (props.event.isReposted));
let isShowJSONData = ref(false);
const nowUnix = ref(Math.floor(Date.now() / 1000));
let relativeTimer: number | undefined;

function scheduleRelativeTimeUpdate() {
  const eventAgeSeconds = nowUnix.value - props.event.created_at;
  const waitMs = eventAgeSeconds < 60 ? 1000 : 60 * 1000;

  relativeTimer = window.setTimeout(() => {
    nowUnix.value = Math.floor(Date.now() / 1000);
    scheduleRelativeTimeUpdate();
  }, waitMs);
}

onMounted(() => {
  nowUnix.value = Math.floor(Date.now() / 1000);
  scheduleRelativeTimeUpdate();
});

onUnmounted(() => {
  if (relativeTimer !== undefined) {
    clearTimeout(relativeTimer);
  }
});

const favEvent = (reacted = props.event) => {
  props.addFavEvent(reacted);
}

const repostEvent = (reposted = props.event) => {
  props.addRepostEvent(reposted);
}

const quoteEvent = (quote = props.event) => {
  props.openQuotePost(quote);
}

function copyNoteId(): void {
  const text = Nostr.nip19.noteEncode(props.event.id);
  copyToClipboard('nostr:' + text);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.log(err);
  }
}

function getLinkUrl(): string {
  return 'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(props.event.id);
}

function getRelativeTimeText(createdAt: number): string {
  const diffSeconds = Math.max(nowUnix.value - createdAt, 0);
  const yearSeconds = 60 * 60 * 24 * 365;

  if (diffSeconds < 60) {
    return `${diffSeconds}秒前`;
  }

  if (diffSeconds < 60 * 60) {
    return `${Math.floor(diffSeconds / 60)}分前`;
  }

  if (diffSeconds < 60 * 60 * 24) {
    return `${Math.floor(diffSeconds / (60 * 60))}時間前`;
  }

  if (diffSeconds < yearSeconds) {
    return `${Math.floor(diffSeconds / (60 * 60 * 24))}日前`;
  }

  return `${Math.floor(diffSeconds / yearSeconds)}年前`;
}

</script>
<template>
  <p class="c-feed-json-data" v-if="isShowJSONData">
    {{ props.event }}
  </p>
  <div class="c-feed-footer">
    <p class="c-feed-speak">
      <span @click="(_$event) => props.speakNote(props.event, props.getProfile(props.event.pubkey), props.volume)"
        v-if="props.event.kind == 1">
        <mdicon name="play" :height="14" />
      </span>
    </p>
    <p :class="{ 'c-feed-repost': true, 'c-feed-repost-actioned': isReposted }">
      <span v-if="loggedIn && props.event.kind == 1" @click="(_$event) => { repostEvent() }">
        <mdicon name="repeat-variant" :height="14" title="Repost" />
      </span>
    </p>
    <p class="c-feed-quote">
      <span v-if="loggedIn && props.event.kind == 1" @click="(_$event) => { quoteEvent() }">
        <mdicon name="comment-quote-outline" :height="14" title="Post with quoted event" />
      </span>
    </p>
    <p :class="{ 'c-feed-fav': true, 'c-feed-fav-actioned': isFavorited }">
      <span v-if="loggedIn && (props.event.kind == 1 || props.event.kind == 42)" @click="(_$event) => { favEvent() }">
        <mdicon name="star-shooting" :height="14" title="Favorite this post" />
      </span>
    </p>
    <p class="c-feed-reply">
      <span v-if="loggedIn && (props.event.kind == 1 || props.event.kind == 42)"
        @click="(_$event) => { openReplyPost(props.event) }">
        <mdicon name="reply" :height="14" title="Reply" />
      </span>
    </p>
    <p class="c-feed-broadcast">
      <span @click="(_$event) => { broadcastEventById(props.event.id) }">
        <mdicon name="broadcast" :width="14" :height="14" title="Broadcast event" />
      </span>
    </p>
    <p class="c-feed-json">
      <span @click="(_$event) => { isShowJSONData = !isShowJSONData }">
        <mdicon name="code-json" :width="14" :height="14" title="Show event json" />
      </span>
    </p>
    <p class="c-feed-event-search">
      <span>
        <a target="_blank"
          :href="'https://koteitan.github.io/nostr-post-checker/?hideform&eid=' + event.id + '&kind=' + event.kind + '&relay=' + pool.getRelayStatuses().map((r) => (r[0])).join(';')">
          <mdicon name="table-search" :width="14" :height="14" title="Search event in relays" />
        </a>
      </span>
    </p>
  </div>
  <div class="c-feed-footer2">
    <p class="c-feed-date">
      <span>
        <a target="_blank" :href="'?' + Nostr.nip19.noteEncode(props.event.id)">
          {{ new Date(props.event.created_at * 1000).toLocaleString("ja-JP", {
            year: "numeric", month: "numeric", day: "numeric", hour:
              "numeric", minute: "numeric"
          }) }}
          &nbsp;({{ getRelativeTimeText(props.event.created_at) }})
        </a>
        <a target="_blank"
          :href="'https://nosaray.vercel.app/?dur=5m' + '&since='
            + new Date(props.event.created_at * 1000).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
            + 'T' + new Date(props.event.created_at * 1000 - 4 * 60 * 1000).toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })">
          <mdicon name="timer-marker" :width="14" :height="14" title="Open timelines in Nosaray" />
        </a>
        <span>&nbsp;</span>
        <a target="_blank"
          :href="'?' + Nostr.nip19.npubEncode(props.event.pubkey) + '&date=' + new Date(props.event.created_at * 1000).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')">
          <mdicon name="calendar-today" :width="14" :height="14" title="Open posts of the day" />
        </a>
        <span>&nbsp;</span>
        <a target="_blank" v-bind:href="getLinkUrl()">
          <mdicon name="open-in-new" :width="14" :height="14" title="Open NosTx" />
        </a>
      </span>
      <span>&nbsp;</span>
      <span class="c-feed-date-copy-button" @click="(_$event) => { copyNoteId(); }">
        <mdicon name="content-copy" :width="14" :height="14" title="Copy note id" />
      </span>
    </p>
  </div>
</template>
<style lang="scss" scoped>
.c-feed-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  width: 100%;
}

.c-feed-footer2 {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  width: 100%;
}

.c-feed-footer p {
  font-size: 14px;
  margin: 0.7em 0 0 0;
}

.c-feed-footer2 p {
  font-size: 14px;
  margin: 0.2em 0 0.2em 0;
}

.c-feed {
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  margin: 0;
  text-align: left;

  &-speak {
    color: #213547;
    flex-basis: 18px;
  }

  &-repost {
    color: #213547;
    flex-basis: 18px;

    &-actioned {
      color: #3faf83;
      flex-basis: auto;
    }
  }

  &-quote {
    color: #213547;
    flex-basis: 18px;
  }

  &-fav {
    color: #213547;
    flex-basis: 18px;

    &-actioned {
      color: #df3d81;
    }
  }

  &-reply {
    color: #213547;
    flex-basis: 18px;
  }

  &-broadcast {
    color: #213547;
    flex-basis: 18px;
  }

  &-json {
    color: #213547;
    flex-basis: 18px;
  }

  &-event-search a {
    color: #213547;
    flex-basis: 18px;
  }

  &-date {
    text-align: right;

    &-copy-button {
      margin-left: 0.2em;
      color: #213547;
    }
  }
}

.c-feed-json-data {
  border: gray dashed 1px;
  font-size: 0.8em;
  margin: 0.2em 1.5em;
  padding: 0.5em;
  color: #213547;
}
</style>