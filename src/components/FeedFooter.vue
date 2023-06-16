<script setup lang="ts">
import * as Nostr from "nostr-tools";

const props = defineProps({
  event: {
    // @ts-ignore
    type: Nostr.Event,
    required: true,
  },
  speakNote: {
    type: Function,
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
});

function favEvent(reacted: Nostr.Event) {
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
}


function repostEvent(reposted: Nostr.Event) {
  const reaction = Nostr.getBlankEvent(Nostr.Kind.Repost);
  reaction.tags = [
    ['e', reposted.id],
    ['p', reposted.pubkey],
  ]
  reaction.content = "";
  reaction.created_at = Math.floor(Date.now() / 1000);

  props.postEvent(reaction);
}

</script>
<template>
  <div class="c-feed-footer">
    <p class="c-feed-speak">
      <span @click="(_$event) => props.speakNote(props.event, 0)" v-if="props.event.kind == 1">
        <mdicon name="play" />読み上げ
      </span>
    </p>
    <p class="c-feed-repost" v-if="isLogined && props.event.kind == 1">
      <span @click="(_$event) => { repostEvent(props.event) }">
        <mdicon name="heart" />りぽすと
      </span>
    </p>
    <p class="c-feed-fav" v-if="isLogined && props.event.kind == 1">
      <span @click="(_$event) => { favEvent(props.event) }">
        <mdicon name="heart" />ふぁぼ
      </span>
    </p>
    <p class="c-feed-date">
      <a target="_blank" v-bind:href="'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(props.event.id)
        ">
        {{ new Date(props.event.created_at * 1000).toLocaleString() }}</a>
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

.c-feed-speak {
  vertical-align: middle;
  font-size: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
  margin: 0;
  text-align: left;
  color: #213547;
}

.c-feed-repost {
  vertical-align: middle;
  font-size: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
  margin: 0;
  text-align: left;
  color: #3faf83;
}

.c-feed-fav {
  vertical-align: middle;
  font-size: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
  margin: 0;
  text-align: left;
  color: #df3d81;
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
</style>