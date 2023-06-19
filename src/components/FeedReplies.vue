<script setup lang="ts">
import * as Nostr from "nostr-tools";

function getUserLink(pubkey: string): string {
  if (pubkey) {
    try {
      const href = 'https://nostx.shino3.net/' + Nostr.nip19.npubEncode(pubkey);
      return href;
    } catch (err) {
      console.error(err);
      return "";
    }
  } else {
    return "";
  }
}

function getEventLink(id: string): string {
  if (id) {
    try {
      const href = 'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(id);
      return href;
    } catch (err) {
      console.error(err);
      return "";
    }
  } else {
    return "";
  }
}

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
  getEvent: {
    type: Function,
    required: true,
  },
});
</script>
<template>
  <p class="c-feed-reply" v-for="(tag, index) in event.tags" :key="index">
    <template v-if="tag[0] === 'p'">
      ユーザー <a target="_blank" v-bind:href="getUserLink(tag[1])">
        <img :src="getProfile(tag[1]).picture" class="c-feed-reply-picture" />
        <span class="c-feed-reply-profile__display-name">
          {{
            getProfile(tag[1]).display_name ||
            getProfile(tag[1]).name ||
            getProfile(tag[1]).pubkey.substring(getProfile(tag[1]).pubkey.length - 8)
          }}
        </span>
      </a> への返信
    </template>
    <template v-else-if="tag[0] === 'e'">
      投稿 <a target="_blank" v-bind:href="getEventLink(tag[1])">
        <span class="c-feed-reply-link" v-if="getEvent(tag[1])?.content">{{ getEvent(tag[1])?.content }}</span>
        <span class="c-feed-reply-link" v-else>{{ tag[1].substring(tag[1].length - 8) }}</span>
      </a> <span v-if="tag.length > 3">({{ tag[3] }})</span> への返信
    </template>
  </p>
</template>
<style lang="scss" scoped>
.c-feed-reply {
  font-size: 0.8em;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
  margin: 0;
  color: #213547;
}

.c-feed-reply-link {
  white-space: normal;
}

.c-feed-reply-picture {
  max-width: 1em;
  max-height: 1em;
  margin-right: 0.3em;
  vertical-align: middle;
}

.c-feed-reply-profile__display-name {
  display: inline-block;
}
</style>