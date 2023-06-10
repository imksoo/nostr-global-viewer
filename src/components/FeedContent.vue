<script setup lang="ts">
import * as Nostr from "nostr-tools";

const props = defineProps({
  event: {
    // @ts-ignore
    type: Nostr.Event,
    required: true,
  }
});

const emojiMap = new Map();
for (let i = 0; i < props.event.tags.length; ++i) {
  const tag = props.event.tags[i];
  if (tag[0] === 'emoji') {
    emojiMap.set(tag[1], tag[2]);
  }
}
const words: string[] = props.event.content.split(/(:\w+:|https?:\/\/[^\s]+|nostr:(nprofile|nrelay|nevent|naddr|nsec|npub|note))/g);
const tokens = words.map(word => {
  if (!word) {
    return { type: "null" };
  }
  if (word.startsWith(":") && word.endsWith(":")) {
    const emojiName = word.slice(1, -1);
    if (emojiMap.has(emojiName)) {
      return { type: "emoji", content: emojiName, src: emojiMap.get(emojiName) };
    }
  } else if (word.match(/^https?:\/\/[\w\-.~:/?#\[\]@!$&'()*+,;=]+$/)) {
    const url = new URL(word);
    const ext = url.pathname.split(".").pop()?.toLocaleLowerCase() ?? "";
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'bmp', 'webp'].includes(ext)) {
      return { type: "img", src: word };
    } else {
      return { type: "link", href: word, content: word };
    }
  } else if (word.startsWith('nostr:')) {
    return { type: 'nostr', content: word.replace('nostr:', ''), hex: Nostr.nip19.decode(word.replace('nostr:', '')) };
  } else {
    return { type: 'text', content: word }
  }
});

</script>
<template>
  <p class="c-feed-content">
    <template v-for="(token, index) in tokens" :key="index">
      <span v-if="token?.type === 'text'">{{ token.content }}</span>
        <a v-else-if="token?.type === 'url'" :href="token.href" target="_blank">{{ token.content }}</a>
        <img v-else-if="token?.type === 'img'" :src="token.src" class="c-feed-content-image" referrerpolicy="no-referrer"/>
        <img v-else-if="token?.type === 'emoji'" :src="token.src" :alt="token.content" />
        <a v-else-if="token?.type === 'nostr'">{{ token?.content }}</a>
    </template>
  </p>
</template>
<style lang="scss" scoped>
.c-feed-content {
  font-size: 1.2em;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  padding: 0.4rem 0 0 0;
  margin: 0;
  color: #213547;
}

.c-feed-content-image {
  max-width: 300px;
}
</style>