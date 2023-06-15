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

const regex = /(:\w+:|https?:\/\/\S+|(nostr:)?(nprofile|nrelay|nevent|naddr|nsec|npub|note)\S+)/;

let rest = props.event.content;
let tokens: { type: string; content?: any; src?: any; href?: any; id?: string; picture?: any; }[] = [];
while (rest.length > 0) {
  const match = rest.match(regex);
  if (match) {
    if (match.index > 0) {
      const text = rest.substring(0, match.index);
      tokens.push({ type: "text", content: text });
      rest = rest.substring(match.index);
    } else {
      const text = match[0];
      if (text.startsWith(':') && text.endsWith(':')) {
        const emojiName = text.slice(1, -1);
        if (emojiMap.has(emojiName)) {
          tokens.push({ type: "emoji", content: emojiName, src: emojiMap.get(emojiName) });
        }
      } else if (text.startsWith('http')) {
        const url = new URL(text);
        const ext = url.pathname.split(".").pop()?.toLocaleLowerCase() ?? "";
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'bmp', 'webp'].includes(ext)) {
          tokens.push({ type: "img", src: text });
        } else {
          if (url.hostname === "youtu.be") {
            tokens.push({ type: "youtube", href: url.pathname, content: decodeURI(text) });
          } else if (url.hostname === "www.youtube.com" || url.hostname === "m.youtube.com") {
            if (url.pathname.startsWith("/shorts/")) {
              const v = url.pathname.replace('/shorts/', '');
              tokens.push({ type: "youtube", href: v, content: decodeURI(text) });
            } else {
              const v = getParam('v', text);
              tokens.push({ type: "youtube", href: v, content: decodeURI(text) });
            }
          } else {
            tokens.push({ type: "link", href: text, content: decodeURI(text) });
          }

          function getParam(name: string, url: string): string | null {
            if (!url) url = window.location.href;
            name = name.replace(/[\[\]]/g, "\\$&");
            var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
              results = regex.exec(url);
            if (!results) return null;
            if (!results[2]) return '';
            return decodeURIComponent(results[2].replace(/\+/g, " "));
          }
        }
      } else {
        try {
          const data = Nostr.nip19.decode(text.replace('nostr:', ''));
          switch (data.type) {
            case "nevent": {
              const href = 'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(data.data.id);
              const id = data.data.id;
              tokens.push({ type: 'nostr-note', href, id });
            } break;
            case "note": {
              const href = 'https://nostx.shino3.net/' + Nostr.nip19.noteEncode(data.data);
              const id = data.data;
              tokens.push({ type: 'nostr-note', href, id });
            } break;
            case "nprofile": {
              const href = 'https://nostx.shino3.net/' + Nostr.nip19.npubEncode(data.data.pubkey);
              if (props.getProfile) {
                const profile = props.getProfile(data.data.pubkey);
                const name = profile.display_name || profile.name || profile.pubkey.substring(profile.pubkey.length - 8)
                tokens.push({ type: 'nostr-npub', content: "@" + name, href, picture: profile.picture });
              } else {
                tokens.push({ type: 'nostr', content: text, href });
              }
            } break;
            case "npub": {
              const href = 'https://nostx.shino3.net/' + Nostr.nip19.npubEncode(data.data);
              if (props.getProfile) {
                const profile = props.getProfile(data.data);
                const name = profile.display_name || profile.name || profile.pubkey.substring(profile.pubkey.length - 8)
                tokens.push({ type: 'nostr-npub', content: "@" + name, href, picture: profile.picture })
              } else {
                tokens.push({ type: 'nostr', content: text, href });
              }
            } break;
            default: {
              const href = text;
              tokens.push({ type: 'nostr', content: text, href });
            }
          }
        } catch (err) {
          tokens.push({ type: "text", content: text });
        }
      }
      rest = rest.substring(text.length);
    }
  } else {
    const text = rest;
    tokens.push({ type: "text", content: text });
    rest = "";
  }
}
</script>
<template>
  <p class="c-feed-content">
    <template v-for="(token, index) in tokens" :key="index">
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
      <template v-else-if="token?.type === 'youtube'">
        <iframe width="560" height="315" :src="'https://www.youtube.com/embed/' + token.href" title="YouTube video player"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen></iframe>
      </template>
      <template v-else-if="token?.type === 'nostr'">
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
          {{ token?.content }}
        </a>
      </template>
      <template v-else-if="token?.type === 'nostr-note'">
        <div class="c-feed-content-repost">
          <FeedContent :event="props.getEvent(token.id)" :get-event="props.getEvent" v-bind:get-profile="props.getProfile"
            v-if="props.getEvent(token.id).content">
          </FeedContent>
          <template v-else>
            <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
              {{ token.content }}
            </a>
          </template>
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