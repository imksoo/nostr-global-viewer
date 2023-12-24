<script setup lang="ts">
import { Ref, onBeforeUnmount, onMounted, ref } from 'vue';
import * as Nostr from "nostr-tools";
import axios, { AxiosResponse } from 'axios';
import parser from 'html-dom-parser';
import Bottleneck from 'bottleneck';

import { myBlockedEvents, myBlockList } from '../profile';
import { eventsReceived } from '../store';

import FeedProfile from "./FeedProfile.vue";
import FeedFooter from "./FeedFooter.vue";
import FeedReplies from './FeedReplies.vue';

const props = defineProps({
  event: {
    type: Object as () => {
      id: string,
      pubkey: string,
      kind: number,
      content: string,
      tags: string[][],
      created_at: number
    },
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

const emojiMap = new Map();
for (let i = 0; i < props.event.tags.length; ++i) {
  const tag = props.event.tags[i];
  if (tag[0] === 'emoji') {
    emojiMap.set(tag[1], tag[2]);
  }
}

const twitterSources: string[] = [];
const twitterIframes = ref<HTMLIFrameElement[]>([]);

const onIframeLoad = (event: Event) => {
  const iframe = event.target as HTMLIFrameElement;
  twitterIframes.value.push(iframe);
  iframe.contentWindow?.postMessage(
    { element: iframe.src, query: 'height' },
    'https://twitframe.com'
  );
}

const handleMessage = (evt: MessageEvent) => {
  if (evt.origin !== 'https://twitframe.com') {
    return;
  } else if (evt.data.height) {
    const targetIframe = twitterIframes.value.find(iframe => iframe.src === evt.data.element);
    if (targetIframe) {
      targetIframe.style.height = `${parseInt(evt.data.height)}px`;
    }
  }
};

onMounted(() => {
  window.addEventListener('message', handleMessage);
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage);
})

let isHidden = ref(false);
let isNIP36 = ref(false);
let reasonOfNIP36 = ref('');
for (let i = 0; i < props.event.tags.length; ++i) {
  const tag = props.event.tags[i];
  if (tag[0] === 'content-warning') {
    isHidden.value = true;
    isNIP36.value = true;
    reasonOfNIP36.value = tag[1] ? tag[1] : "Content Warning (NIP36)";
  }
}

const regex = /(:\w+:|#\[\d+\]|#[^\s!@#$%^&*()=+./,\[{\]};:'"?><]+|https?:\/\/\S+|(nostr:|@)?(nprofile|nrelay|nevent|naddr|nsec|npub|note)1[023456789acdefghjklmnpqrstuvwxyz]{6,})/;

function getTokens() {
  let rest = props.event.content;
  let tokens = ref<{ type: string; content?: any; src?: any; href?: any; id?: string; picture?: any; ogp?: any; }[]>([]);

  if (props.event.kind === 6) {
    let note = "";
    for (let i = 0; i < props.event.tags.length; ++i) {
      const t = props.event.tags[i];
      if (t[0] === 'e') {
        note = Nostr.nip19.noteEncode(t[1]);
        break;
      }
    }
    rest = `📬\n${note}`;
  } else if (props.event.kind === 7) {
    let note = "";
    for (let i = props.event.tags.length - 1; i >= 0; --i) {
      const t = props.event.tags[i];
      if (t[0] === 'e') {
        note = Nostr.nip19.noteEncode(t[1]);
        break;
      }
    }
    rest = `${props.event.content}\n${note}`;
  } else if (props.event.kind === 1984) {
    rest = `👁️ つうほうしますた！ 🫵🏽\n${rest}`;
  } else if (props.event.kind === 40) {
    const content = JSON.parse(rest);
    rest = `パブリックチャット はじめますた！\n\nルーム名：${content.name}\n説明：${content.about}\n${content.picture}`;
  } else if (props.event.kind === 41) {
    const content = JSON.parse(rest);
    rest = `パブリックチャット 編集しますた！\n\nルーム名：${content.name}\n説明：${content.about}\n${content.picture}`;
  } else {
    // ミュートユーザーのリプライを非表示にする
    for (let i = 0; i < props.event.tags.length; ++i) {
      const tag = props.event.tags[i];
      if (tag[0] === 'p') {
        myBlockList.value.forEach((block) => {
          if (block === tag[1]) {
            rest = `🔇 Muted event (reply to blocked user)`;
          }
        });
      }
    }
  }

  while (rest.length > 0) {
    const match = rest.match(regex);
    if (match) {
      if (match.index && match.index > 0) {
        const text = rest.substring(0, match.index);
        tokens.value.push({ type: "text", content: text });
        rest = rest.substring(match.index);
      } else {
        const text = match[0];
        if (text.startsWith(':') && text.endsWith(':')) {
          const emojiName = text.slice(1, -1);
          if (emojiMap.has(emojiName)) {
            tokens.value.push({ type: "emoji", content: emojiName, src: emojiMap.get(emojiName) });
          } else {
            tokens.value.push({ type: "text", content: text });
          }
        } else if (text.startsWith('#[')) {
          const num = parseInt(text.slice(2, -1));
          if (0 <= num && num < props.event.tags.length) {
            const t = props.event.tags[num];
            if (t[0] === 'p') {
              const href = '?' + Nostr.nip19.npubEncode(t[1]);
              if (props.getProfile) {
                const profile = props.getProfile(t[1]);
                let name = profile.display_name || profile.name || profile.pubkey.substring(profile.pubkey.length - 8);
                if (name.length > 35) {
                  name = `${name.substring(0, 35)}...`;
                }
                tokens.value.push({ type: 'nostr-npub', content: "@" + name, href, picture: profile.picture });
              } else {
                tokens.value.push({ type: 'nostr', content: text, href });
              }
            } else if (t[0] === 'e') {
              const href = '?' + Nostr.nip19.noteEncode(t[1]);
              const id = t[1];
              tokens.value.push({ type: 'nostr-note', content: text, href, id });
            } else {
              tokens.value.push({ type: "text", content: text });
            }
          }
        } else if (text.startsWith('#')) {
          const href = '?q=' + text.replace('#', '%23');
          tokens.value.push({ type: "link", href: href, content: decodeURI(text) });
        } else if (text.startsWith('http')) {
          try {
            const url = new URL(text);
            const ext = url.pathname.split(".").pop()?.toLocaleLowerCase() ?? "";
            if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'bmp', 'webp'].includes(ext)) {
              tokens.value.push({ type: "img", src: text });
            } else if (['mp4', 'webm', 'ogg', 'mov', 'ogv', 'wmv', 'avi'].includes(ext)) {
              tokens.value.push({ type: "video", src: text });
            } else {
              if (url.hostname === "youtu.be") {
                tokens.value.push({ type: "youtube", href: url.pathname, content: decodeURI(text) });
              } else if (url.hostname === "www.youtube.com" || url.hostname === "m.youtube.com") {
                if (url.pathname.startsWith("/shorts/")) {
                  const v = url.pathname.replace('/shorts/', '');
                  tokens.value.push({ type: "youtube", href: v, content: decodeURI(text) });
                } else {
                  const v = getParam('v', text);
                  tokens.value.push({ type: "youtube", href: v, content: decodeURI(text) });
                }
              } else if (url.hostname.endsWith("twitter.com") || url.hostname.endsWith("x.com")) {
                const src = encodeURI(text.replace("x.com", "twitter.com"));
                twitterSources.push(src);
                tokens.value.push({ type: "twitter", href: text, src, content: decodeURI(text) });
              } else {
                try {
                  const ogp = ref({});
                  getOgp(text, ogp);
                  tokens.value.push({ type: "link", href: text, content: decodeURI(text), ogp });
                } catch (error) {
                  console.log(error);
                  tokens.value.push({ type: "link", href: text, content: decodeURI(text) });
                }
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
          } catch (err) {
            tokens.value.push({ type: "text", content: text });
          }
        } else {
          try {
            const data = Nostr.nip19.decode(text.replace('nostr:', '').replace('@', ''));
            switch (data.type) {
              case "nevent": {
                const href = '?' + Nostr.nip19.noteEncode(data.data.id);
                const id = data.data.id;
                tokens.value.push({ type: 'nostr-note', content: text, href, id });
              } break;
              case "note": {
                const href = '?' + Nostr.nip19.noteEncode(data.data);
                const id = data.data;
                tokens.value.push({ type: 'nostr-note', content: text, href, id });
              } break;
              case "nprofile": {
                const href = '?' + Nostr.nip19.npubEncode(data.data.pubkey);
                if (props.getProfile) {
                  const profile = props.getProfile(data.data.pubkey);
                  let name = profile.display_name || profile.name || profile.pubkey.substring(profile.pubkey.length - 8);
                  if (name.length > 35) {
                    name = `${name.substring(0, 35)}...`;
                  }
                  tokens.value.push({ type: 'nostr-npub', content: "@" + name, href, picture: profile.picture });
                } else {
                  tokens.value.push({ type: 'nostr', content: text, href });
                }
              } break;
              case "npub": {
                const href = '?' + Nostr.nip19.npubEncode(data.data);
                if (props.getProfile) {
                  const profile = props.getProfile(data.data);
                  let name = profile.display_name || profile.name || profile.pubkey.substring(profile.pubkey.length - 8);
                  if (name.length > 35) {
                    name = `${name.substring(0, 35)}...`;
                  }
                  tokens.value.push({ type: 'nostr-npub', content: "@" + name, href, picture: profile.picture });
                } else {
                  tokens.value.push({ type: 'nostr', content: text, href });
                }
              } break;
              default: {
                const href = text;
                tokens.value.push({ type: 'nostr', content: text, href });
              }
            }
          } catch (err) {
            tokens.value.push({ type: "text", content: text });
          }
        }
        rest = rest.substring(text.length);
      }
    } else {
      const text = rest;
      tokens.value.push({ type: "text", content: text });
      rest = "";
    }
  }

  return tokens.value;
}

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 3000,
});

async function fetchWithLimiter(url: string): Promise<AxiosResponse | undefined> {
  try {
    return await limiter.schedule(() => axios.get(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`));
  } catch (error) {
    console.error('Request failed:', error);
    return undefined;
  }
}

const ogpCache = new Map<string, AxiosResponse>();

async function getOgp(url: string, ogp: Ref<{}>) {
  try {
    let res: AxiosResponse | undefined = undefined;
    if (ogpCache.has(url)) {
      res = ogpCache.get(url);
    } else {
      res = await fetchWithLimiter(url);
      if (res) {
        ogpCache.set(url, res);
      } else {
        return;
      }
    }

    const dom = parser(res?.data.contents);
    const ogTitleMetaTag = findMetaTag(dom, 'og:title');
    const ogTitle = (ogTitleMetaTag && ogTitleMetaTag.type === 'tag') ? ogTitleMetaTag.attribs.content : '';
    const ogImageMetaTag = findMetaTag(dom, 'og:image');
    const ogImage = (ogImageMetaTag && ogImageMetaTag.type === 'tag') ? ogImageMetaTag.attribs.content : '';
    const ogDescriptionMetaTag = findMetaTag(dom, 'og:description');
    const ogDescription = (ogDescriptionMetaTag && ogDescriptionMetaTag.type === 'tag') ? ogDescriptionMetaTag.attribs.content : '';

    if (ogTitle) {
      ogp.value = {
        title: ogTitle,
        image: ogImage,
        description: ogDescription,
      };
    }

    // 再帰的にノードを検索する関数
    function findMetaTag(nodes: any[], property: string): any {
      for (const node of nodes) {
        if (node.type === 'tag' && node.attribs && node.attribs.property === property) {
          return node;
        }
        const found = findMetaTag(node.children || [], property);
        if (found) {
          return found;
        }
      }
      return null;
    }
  } catch (err) {
    // console.log(err);
  }
}

</script>
<template>
  <button class="c-feed-warning" v-if="isNIP36" @click="($_event) => { isHidden = !isHidden }">
    {{ reasonOfNIP36 }}
  </button>
  <p class="c-feed-content" v-if="isHidden != true">
    <template v-for="(token, _index) in getTokens()" :key="_index">
      <template v-if="token?.type === 'text'">
        <span class="c-feed-content-kind6" v-if="props.event.kind === 6">{{
          token.content
        }}</span>
        <span class="c-feed-content-kind7" v-else-if="props.event.kind === 7">{{
          token.content?.replace("+", "💕").replace("-", "👎")
        }}</span>
        <span class="c-feed-content-kind1984" v-else-if="props.event.kind === 1984">{{
          token.content
        }}</span>
        <span v-else>{{ token.content }}</span>
      </template>
      <template v-else-if="token?.type === 'link'">
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer">{{ token.content }}</a>
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer" v-if="token.ogp">
          <div class="c-feed-content-ogp" v-if="token.ogp.title">
            <div class="c-feed-content-ogp-title">{{ token.ogp.title }}</div>
            <div class="c-feed-content-ogp-box">
              <img :src="token.ogp.image" class="c-feed-content-ogp-image" referrerpolicy="no-referrer" />
              <span class="c-feed-content-ogp-description">{{ token.ogp.description }}</span>
            </div>
          </div>
        </a>
      </template>
      <template v-else-if="token?.type === 'youtube'">
        <iframe :src="'https://www.youtube.com/embed/' + token.href" title="YouTube video player" frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen></iframe>
      </template>
      <template v-else-if="token?.type === 'twitter'">
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
          {{ token.content }}
        </a>
        <br />
        <iframe frameborder="0" :src="'https://twitframe.com/show?url=' + token.src" @load="onIframeLoad"></iframe>
      </template>
      <template v-else-if="token?.type === 'nostr'">
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
          {{ token?.content }}
        </a>
      </template>
      <template v-else-if="token?.type === 'nostr-note'">
        <div class="c-feed-content-repost">
          <template v-if="props.getEvent(token.id)">
            <FeedProfile v-bind:profile="props.getProfile(props.getEvent(token.id).pubkey)"></FeedProfile>
            <FeedReplies v-bind:event="props.getEvent(token.id)" :get-profile="props.getProfile"
              :get-event="props.getEvent"></FeedReplies>
            <FeedContent :event="props.getEvent(token.id)" :get-event="props.getEvent" :speak-note="props.speakNote"
              :volume="props.volume" :is-logined="props.isLogined" :post-event="props.postEvent"
              :get-profile="props.getProfile" :open-reply-post="props.openReplyPost"
              :open-quote-post="props.openQuotePost" :add-fav-event="props.addFavEvent"
              :add-repost-event="props.addRepostEvent">
            </FeedContent>
            <FeedFooter v-bind:event="props.getEvent(token.id)" :speak-note="props.speakNote" :volume="volume"
              :is-logined="props.isLogined" :post-event="props.postEvent" :get-profile="props.getProfile"
              :open-reply-post="props.openReplyPost" :open-quote-post="props.openQuotePost"
              :add-fav-event="props.addFavEvent" :add-repost-event="props.addRepostEvent"></FeedFooter>
          </template>
          <template v-else>
            <div v-if="token.id && myBlockedEvents.has(token.id)">🔇 Muted event (posted by blocked user)</div>
            <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
              {{ token.content }}
            </a>
          </template>
        </div>
      </template>
      <template v-else-if="token?.type === 'nostr-npub'">
        <a :href="token.href" target="_blank" referrerpolicy="no-referrer">
          <img :src="token.picture ? token.picture : 'https://placehold.jp/60x60.png'"
            class="c-feed-content-profile-picture" />{{
              token?.content
            }}</a>
      </template>
      <template v-else-if="token?.type === 'img'">
        <a :href="token.src" target="_blank" referrerpolicy="no-referrer">
          <img :src="token.src" class="c-feed-content-image" referrerpolicy="no-referrer" />
        </a>
      </template>
      <template v-else-if="token?.type === 'video'">
        <video :src="token.src" class="c-feed-content-video" controls="true" preload="metadata" />
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

.c-feed-content-kind6 {
  font-size: 1em;
  color: #df3d81;
}

.c-feed-content-kind7 {
  font-size: 1em;
}

.c-feed-content-kind1984 {
  font-size: 1.5em;
  color: #df3d81;
}

.c-feed-content-repost {
  border: gray dashed 1px;
  font-size: 0.8em;
  margin: 0.2em 2%;
  padding: 0.5em;
}

.c-feed-content-ogp {
  border: gray groove 1px;
  font-size: 0.8em;
  margin: 0.2em 1.5em;
  padding: 0.5em;
  color: #213547;
}

.c-feed-content-ogp-box {
  display: flexbox;
  overflow: auto;
}

.c-feed-content-ogp-title {
  font-size: 1.2em;
  flex-basis: 100%;
  text-decoration: underline;
}

.c-feed-content-ogp-image {
  float: left;
  max-width: 25%;
  max-height: 240px;
  margin: 8px 12px 4px 4px;
}

.c-feed-content-ogp-description {
  font-size: 0.8em;
}

.c-feed-content-image {
  max-width: 90%;
  max-height: 600px;
  display: block;
  margin: auto;
}

.c-feed-content-video {
  max-width: 90%;
  max-height: 600px;
  display: block;
  margin: auto;
}

.c-feed-content-emoji {
  max-height: 1.3em;
  max-width: 90%;
  vertical-align: middle;
}

.c-feed-content-profile-picture {
  max-width: 1em;
  max-height: 1em;
  vertical-align: middle;
  margin-right: 0.3em;
}

.c-feed-warning {
  margin: 2em auto 1em auto;
  background-color: #df3d81;
}
</style>