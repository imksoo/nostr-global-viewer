<script setup lang="ts">
import * as nostr from "nostr-tools";

const props = defineProps({
  profile: {
    type: Object as () => {
      pubkey: string,
      picture: string | undefined,
      display_name: string | undefined,
      name: string | undefined,
    },
    required: true,
  }
});

function getProfileLink(pubkey: string) {
  if (pubkey) {
    return 'https://nostx.shino3.net/' + nostr.nip19.npubEncode(pubkey);
  } else {
    return ""
  }
}

function copyNpubId(): void {
  const text = nostr.nip19.npubEncode(props.profile.pubkey);
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
  <div class="c-feed-profile">
    <a target="_blank" v-bind:href="getProfileLink(props.profile.pubkey)">
      <p class="c-feed-profile__avatar">
        <img class="c-feed-profile__picture"
          v-bind:src="props.profile.picture ? props.profile.picture : 'https://placehold.jp/60x60.png'"
          referrerpolicy="no-referrer" />
      </p>
    </a>
    <span class="c-feed-profile-copy-button" @click="(_$event) => { copyNpubId(); }">
      <mdicon name="content-copy" :width="16" :height="16" title="Copy npub string" />
    </span>
    <a target="_blank" v-bind:href="getProfileLink(props.profile.pubkey)" class="c-feed-profile__detail">
      <span class="c-feed-profile__display-name">
        {{
          props.profile.display_name ||
          props.profile.name ||
          props.profile.pubkey.substring(props.profile.pubkey.length - 8)
        }}
      </span>
      <span class="c-feed-profile__user-name">
        @{{ props.profile.name ?? "" }}
      </span>
    </a>
  </div>
</template>
<style lang="scss" scoped>
.c-feed-profile {
  display: flex;
  gap: 10px;

  &-copy-button {
    color: #213547;
  }
}

.c-feed-profile__avatar {
  padding: 0;
  margin: 0;
  flex-grow: 0;
  flex-shrink: 0;
  max-width: 3rem;
  word-wrap: break-word;
  word-break: break-all;
}

.c-feed-profile__detail {
  width: max-content;
}

.c-feed-profile__display-name {
  display: block;
  font-size: 14px;
  color: #213547;
}

.c-feed-profile__user-name {
  display: block;
  font-size: 14px;
}

.c-feed-profile__picture {
  max-height: 3rem;
  max-width: 3rem;
  height: 3rem;
  width: 3rem;
  margin: 0;
  object-fit: cover;
  border-radius: 4px;
}

.c-feed-profile-copy-button {
  vertical-align: middle;
}
</style>