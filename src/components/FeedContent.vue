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
    required: true,
  },
  getEvent: {
    type: Function,
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
const words: string[] = props.event.content.split(/(:\w+:|https?:\/\/\S+|nostr:\S+)/g);
const tokens = words.map(word => {
  if (!word || word === "nostr:") {
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
  } else if (word.match(/(nostr:|nprofile|nrelay|nevent|naddr|nsec|npub|note)\S+/)) {
    let data;
    try {
      data = Nostr.nip19.decode(word.replace('nostr:', ''));
    } catch (err) {
      return { type: "null" }
    }
    switch (data.type) {
      case "nevent": {
        const href = 'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(data.data.id);
        const content = "nevent" + data.data.id.substring(data.data.id.length - 8);
        const event = props.getEvent(data.data.id);
        return { type: 'nostr-note', content, event, href }
      }
      case "note": {
        const href = 'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(data.data);
        const content = "note" + data.data.substring(data.data.length - 8);
        const event = props.getEvent(data.data);
        return { type: 'nostr-note', content, event, href }
      }
      case "nprofile": {
        const href = 'https://nostx.shino3.net/' + Nostr.nip19.npubEncode(data.data.pubkey);
        if (props.getProfile) {
          const profile = props.getProfile(data.data.pubkey);
          const name = profile.display_name || profile.name || profile.pubkey.substring(profile.pubkey.length - 8)
          return { type: 'nostr-npub', content: "@" + name, href, picture: profile.picture }
        } else {
          return { type: 'nostr', content: word, href }
        }
      }
      case "npub": {
        const href = 'https://nostx.shino3.net/' + Nostr.nip19.npubEncode(data.data);
        if (props.getProfile) {
          const profile = props.getProfile(data.data);
          const name = profile.display_name || profile.name || profile.pubkey.substring(profile.pubkey.length - 8)
          return { type: 'nostr-npub', content: "@" + name, href, picture: profile.picture }
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
    <span style="display: none; color: black;">{{ tokens }}</span>
    <template v-for="(token, index) in tokens" :key="index">
      <span style="display: none">{{ JSON.stringify(token) }}</span>
      <template v-if="token?.type === 'text'">
        <span v-if="props.event.kind === 7" class="c-feed-content-kind7">{{
          token.content?.replace("+", "💕").replace("-", "👎")
        }}</span>
        <span v-else>{{ token.content }}</span>
      </template>
      <template v-else-if="token?.type === 'link'">
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
          {{ token.content }}
        </a>
      </template>
      <template v-else-if="token?.type === 'nostr'">
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
          {{ token?.content }}
        </a>
      </template>
      <template v-else-if="token?.type === 'nostr-note'">
        <div class="c-feed-content-repost">
          <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
            <FeedContent :event="token.event" :get-event="props.getEvent" :get-profile="props.getProfile"></FeedContent>
            {{ token?.content }}
          </a>
        </div>
      </template>
      <template v-else-if="token?.type === 'nostr-npub'">
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
          <img :src="token.picture" class="c-feed-content-profile-picture" />{{
            token?.content
          }}</a>
      </template>
      <template v-else-if="token?.type === 'img'">
        <a :href="token.src" target="_blank" referrerpolicy="no-referrer">
          <img :src="token.src" class="c-feed-content-image" referrerpolicy="no-referrer" />
        </a>
      </template>
      <template v-else-if="token?.type === 'emoji'">
        <img :src="token.src" class="c-feed-content-emoji" :alt="token.content" />
      </template>
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

.c-feed-content-kind7 {
  font-size: 2.0em;
}

.c-feed-content-repost {
  border: gray dashed 1px;
  font-size: 0.8em;
  margin: 0.2em 1.5em;
  padding: 0.5em;
}

.c-feed-content-image {
  max-width: 300px;
  max-height: 600px;
  display: block;
}

.c-feed-content-emoji {
  max-width: 1.3em;
  max-height: 1.3em;
  vertical-align: middle;
}

.c-feed-content-profile-picture {
  max-width: 1em;
  max-height: 1em;
  vertical-align: middle;
  margin-right: 0.3em;
}
</style>