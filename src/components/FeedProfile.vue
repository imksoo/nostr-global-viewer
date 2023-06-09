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
</script>
<template>
  <div class="c-feed-profile">
    <p class="c-feed-profile__avatar">
      <img class="c-feed-profile__picture" v-bind:src="props.profile.picture ?? 'https://placehold.jp/60x60.png'"
        referrerpolicy="no-referrer" />
    </p>
    <a target="_blank" v-bind:href="getProfileLink(props.profile.pubkey)" class="c-feed-profile__detail">
      <span class="c-feed-profile__display-name">
        {{
          props.profile.display_name ??
          props.profile.name ??
          "loading"
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
  flex-grow: 1;
}

.c-feed-profile__display-name {
  display: block;
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
</style>