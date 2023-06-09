<script setup lang="ts">
import * as Nostr from "nostr-tools";

function getReplyUsers(event: Nostr.Event) {
  const parsedTags = Nostr.nip10.parse(event);
  const users = [];
  for (let i = 0; i < parsedTags.profiles.length; ++i) {
    const p = parsedTags.profiles[i];
    if (props.getProfile) {
      users.push(props.getProfile(p.pubkey));
    }
  }
  return users;
}

function getReplyMentions(event: Nostr.Event) {
  const parsedTags = Nostr.nip10.parse(event);
  let mentions = [];
  if (parsedTags.root) {
    const e = parsedTags.root;
    mentions.push(e);
  }
  for (let i = 0; i < parsedTags.mentions.length; ++i) {
    const m = parsedTags.mentions[i];
    mentions.push(m);
  }
  if (parsedTags.reply) {
    const e = parsedTags.reply;
    mentions.push(e);
  }
  mentions = mentions.filter((m, i, a) => {
    return i === 0 || m.id !== a[i - 1].id;
  })
  return mentions;
}

const props = defineProps({
  event: {
    // @ts-ignore
    type: Nostr.Event,
    required: true,
  },
  getProfile: {
    type: Function,
    require: true,
  }
});
</script>
<template>
  <p class="c-feed-reply" v-if="getReplyUsers(props.event)">
    <span v-for="(u, index) in getReplyUsers(props.event)" :key="index">
      <template v-if="index == 0">ユーザー </template>
      <a target="_blank" v-bind:href="'https://nostx.shino3.net/' +
        Nostr.nip19.npubEncode(u.pubkey)
        ">
        <span class="c-feed-reply-profile__display-name">
          {{
            u.display_name ??
            u.name ??
            "loading"
          }}
        </span>
      </a>
      <template v-if="index != getReplyUsers(props.event).length - 1"> と </template>
      <template v-if="index == getReplyUsers(props.event).length - 1"> への返信</template>
    </span>
  </p>
  <p class="c-feed-reply" v-if="getReplyMentions(props.event).length">
    <span v-for="(p, index) in getReplyMentions(props.event)" :key="index">
      <template v-if="index == 0">投稿 </template>
      <a target="_blank" v-bind:href="'https://nostx.shino3.net/' +
        Nostr.nip19.noteEncode(p.id)
        ">{{ p.id.substring(p.id.length - 8) }}</a>
      <template v-if="index != getReplyMentions(props.event).length - 1"> と </template>
      <template v-if="index == getReplyMentions(props.event).length - 1"> への返信</template>
    </span>
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

.c-feed-reply-profile__display-name {
  display: inline-block;
}
</style>