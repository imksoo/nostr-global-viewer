<script setup lang="ts">
import * as Nostr from "nostr-tools";

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

const emojiMap = new Map();
for (let i = 0; i < props.event.tags.length; ++i) {
  const tag = props.event.tags[i];
  if (tag[0] === 'emoji') {
    emojiMap.set(tag[1], tag[2]);
  }
}
const words: string[] = props.event.content.split(/(:\w+:|https?:\/\/\S+|nostr:\S+)/g);
const tokens = words.map(word => {
  if (!word) {
    return { type: "null" };
  }
  if (word.startsWith(":") && word.endsWith(":")) {
    const emojiName = word.slice(1, -1);
    if (emojiMap.has(emojiName)) {
      return { type: "emoji", content: emojiName, src: emojiMap.get(emojiName) };
    }
  } else if (word.startsWith("http")) {
    const url = new URL(word);
    const ext = url.pathname.split(".").pop()?.toLocaleLowerCase() ?? "";
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'bmp', 'webp'].includes(ext)) {
      return { type: "img", src: word };
    } else {
      return { type: "link", href: word, content: word };
    }
  } else if (word.match(/^nostr:(nprofile|nrelay|nevent|naddr|nsec|npub|note)/)) {
    const data = Nostr.nip19.decode(word.replace('nostr:', ''));
    switch (data.type) {
      case "nevent": {
        const href = 'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(data.data.id);
        return { type: 'nostr', content: word, href }
      }
      case "note": {
        const href = 'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(data.data);
        return { type: 'nostr', content: word, href }
      }
      case "nprofile": {
        const href = 'https://nostx.shino3.net/' + Nostr.nip19.npubEncode(data.data.pubkey);
        if (props.getProfile) {
          const profile = props.getProfile(data.data.pubkey);
          const name = profile.display_name ?? profile.name ?? word
          return { type: 'nostr', content: "@" + name, href }
        } else {
          return { type: 'nostr', content: word, href }
        }
      }
      case "npub": {
        const href = 'https://nostx.shino3.net/' + Nostr.nip19.npubEncode(data.data);
        if (props.getProfile) {
          const profile = props.getProfile(data.data);
          const name = profile.display_name ?? profile.name ?? word
          return { type: 'nostr', content: "@" + name, href }
        } else {
          return { type: 'nostr', content: word, href }
        }
      }
      default: {
        const href = word;
        return { type: 'nostr', content: word, href }
      }
    }
  } else {
    return { type: 'text', content: word }
  }
});

</script>
<template>
  <p class="c-feed-content">
    <template v-for="(token, index) in tokens" :key="index">
      <span style="display: none">{{ JSON.stringify(token) }}</span>
      <span v-if="token?.type === 'text'">{{ token.content }}</span>
      <a v-else-if="token?.type === 'link'" :href="token.href" target="_blank" referrerpolicy="no-referrer">{{
        token.content }}</a>
      <a v-else-if="token?.type === 'nostr'" :href="token.href" target="_blank" referrerpolicy="no-referrer">{{
        token?.content }}</a>
      <img v-else-if="token?.type === 'img'" :src="token.src" class="c-feed-content-image" referrerpolicy="no-referrer" />
      <img v-else-if="token?.type === 'emoji'" :src="token.src" class="c-feed-content-emoji" :alt="token.content" />
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
  max-height: 600px;
  vertical-align: middle;
}

.c-feed-content-emoji {
  max-width: 1.3em;
  max-height: 1.3em;
  vertical-align: middle;
}
</style>