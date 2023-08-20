<script setup lang="ts">
import { computed, ref } from "vue";
import * as Nostr from "nostr-tools";
import { createFavEvent, createRepostEvent } from '../hooks/useFavRepost';
import { ADDRCONFIG } from "dns";

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
  isLogined: {
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

const isFavorited = computed(()=>(props.event.isFavorited));
const isReposted = computed(()=>(props.event.isReposted));
let isShowJSONData = ref(false);

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
      <span v-if="isLogined && props.event.kind == 1" @click="(_$event) => { repostEvent() }">
        <mdicon name="multicast" :height="14" />
      </span>
    </p>
    <p :class="{ 'c-feed-quote': true }">
      <span v-if="isLogined && props.event.kind == 1" @click="(_$event) => { quoteEvent() }">
        <mdicon name="comment-quote-outline" :height="14" />
      </span>
    </p>
    <p :class="{ 'c-feed-fav': true, 'c-feed-fav-actioned': isFavorited }">
      <span v-if="isLogined && props.event.kind == 1" @click="(_$event) => { favEvent() }">
        <mdicon name="star-shooting" :height="14" />
      </span>
    </p>
    <p :class="{ 'c-feed-reply': true }">
      <span v-if="isLogined && props.event.kind == 1" @click="(_$event) => { openReplyPost(props.event) }">
        <mdicon name="reply" :height="14" />
      </span>
    </p>
    <p :class="{ 'c-feed-json': true }">
      <span @click="(_$event) => { isShowJSONData = !isShowJSONData }">
        <mdicon name="code-json" :width="14" :height="14" title="Show event json" />
      </span>
    </p>
    <p class="c-feed-date">
      <span>
        <a :href="'?' + Nostr.nip19.noteEncode(props.event.id)">
          {{ new Date(props.event.created_at * 1000).toLocaleString("ja-JP", {
            month: "numeric", day: "numeric", hour:
              "numeric", minute: "numeric"
          }) }}
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

.c-feed-footer p {
  font-size: 14px;
  margin: 0.7em 0 0.2em 0;
}

.c-feed {
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
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

  &-json {
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