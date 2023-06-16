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
  }
});

</script>
<template>
  <div class="c-feed-footer">
    <p class="c-feed-speak">
      <span @click="(_$event) => props.speakNote(props.event, 0)">
        <mdicon name="play" />読み上げ
      </span>
    </p>
    <p class="c-feed-fav">
      <span onclick="alert('まって♡')">
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