<script setup lang="ts">
import { ref } from "vue";
import * as Nostr from "nostr-tools";

const props = defineProps({
  event: {
    // @ts-ignore
    type: Nostr.Event,
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
    type: Number,
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
});

let isFavorited = ref(false);
let isReposted = ref(false);

const favEvent = (reacted: Nostr.Event = props.event) => {
  if (isFavorited.value) {
    return;
  }

  const inheritedTags = reacted.tags.filter(
    (tag) => tag.length >= 2 && (tag[0] === 'e' || tag[0] === 'p'),
  )

  const reaction = Nostr.getBlankEvent(Nostr.Kind.Reaction);
  reaction.tags = [
    ...inheritedTags,
    ['e', reacted.id],
    ['p', reacted.pubkey],
  ]
  reaction.content = "+";
  reaction.created_at = Math.floor(Date.now() / 1000);

  props.postEvent(reaction);

  isFavorited.value = true;
}

const repostEvent = (reposted: Nostr.Event = props.event) => {
  if (isReposted.value) {
    return;
  }

  const reaction = Nostr.getBlankEvent(Nostr.Kind.Repost);
  reaction.tags = [
    ['e', reposted.id],
    ['p', reposted.pubkey],
  ]
  reaction.content = "";
  reaction.created_at = Math.floor(Date.now() / 1000);

  props.postEvent(reaction);

  isReposted.value = true;
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
</script>
<template>
  <div class="c-feed-footer">
    <p class="c-feed-speak">
      <span @click="(_$event) => props.speakNote(props.event, props.getProfile(props.event.pubkey), props.volume)"
        v-if="props.event.kind == 1">
        <mdicon name="play" :height="14" />
      </span>
    </p>
    <p v-if="isLogined && props.event.kind == 1" :class="{ 'c-feed-repost': true, 'c-feed-repost-actioned': isReposted }">
      <span @click="(_$event) => { repostEvent() }">
        <mdicon name="multicast" :height="14" />
      </span>
    </p>
    <p v-if="isLogined && props.event.kind == 1" :class="{ 'c-feed-fav': true, 'c-feed-fav-actioned': isFavorited }">
      <span @click="(_$event) => { favEvent() }">
        <mdicon name="star-shooting" :height="14" />
      </span>
    </p>
    <p v-if="isLogined && props.event.kind == 1" :class="{ 'c-feed-reply': true }">
      <span @click="(_$event) => { openReplyPost(props.event) }">
        <mdicon name="reply" :height="14" />
      </span>
    </p>
    <p class="c-feed-date">
      <span>
        <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(props.event.id)">
          {{ new Date(props.event.created_at * 1000).toLocaleString("ja-JP", {
            month: "numeric", day: "numeric", hour:
              "numeric", minute: "numeric"
          }) }}
        </a>
      </span>
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
  }

  &-repost {
    color: #213547;

    &-actioned {
      color: #3faf83;
    }
  }

  &-fav {
    color: #213547;

    &-actioned {
      color: #df3d81;
    }
  }

  &-reply {
    color: #213547;
  }

  &-date {
    text-align: right;

    &-copy-button {
      margin-left: 0.2em;
      color: #213547;
    }
  }
}
</style>