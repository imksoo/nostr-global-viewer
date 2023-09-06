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
    return '?' + nostr.nip19.npubEncode(pubkey);
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

function onImageError(e: Event) {
  const placehold = 'https://placehold.jp/391e6c/d7c6c6/60x60.png?text=Image%0ANot%20Found';
  const target = e.target as HTMLImageElement;
  target.src = placehold;
}

function truncateName(name: string | undefined): string | undefined {
  if (name === undefined) {
    return undefined;
  }

  if (name.length > 35) {
    return `${name.substring(0, 35)}...`
  } else {
    return name;
  }
}

</script>
<template>
  <div class="c-feed-profile">
    <div class="c-feed-profile-parts c-feed-profile-avatar">
      <div>
        <a target="_blank" :href="getProfileLink(props.profile.pubkey)">
          <img class="c-feed-profile-picture"
            v-bind:src="props.profile.picture ? props.profile.picture : 'https://placehold.jp/623e70/d7c6c6/60x60.png?text=Unknown'"
            referrerpolicy="no-referrer" @error="onImageError" />
        </a>
      </div>
    </div>
    <div class="c-feed-profile-parts">
      <div class="c-feed-profile-display-name">
        <span class="c-feed-profile-copy-button" @click="(_$event) => { copyNpubId(); }">
          <mdicon name="content-copy" :width="14" :height="14" title="Copy npub string" />
        </span>
        <span>&nbsp;</span>
        <a target="_blank" :href="getProfileLink(props.profile.pubkey)">{{
          truncateName(props.profile.display_name) ||
          truncateName(props.profile.name) ||
          props.profile.pubkey.substring(props.profile.pubkey.length - 8)
        }}</a>
      </div>
      <div class="c-feed-profile-user-name">
        <a target="_blank" :href="getProfileLink(props.profile.pubkey)">@{{
          truncateName(props.profile.name) ?? "" }}</a>
      </div>
    </div>
  </div>
</template>
<style lang="scss" scoped>
.c-feed-profile {
  display: flex;
  gap: 10px;

  &-parts {
    overflow: hidden;
  }

  &-avatar {
    padding: 0;
    margin: 0;
    flex-grow: 0;
    flex-shrink: 0;
    max-width: 3rem;
    word-wrap: break-word;
    word-break: break-all;
  }

  &-picture {
    max-height: 3rem;
    max-width: 3rem;
    height: 3rem;
    width: 3rem;
    margin: 0;
    object-fit: cover;
    border-radius: 4px;
  }

  &-display-name,
  &-user-name {
    font-size: 14px;
    white-space: nowrap;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
  }

  &-display-name a {
    color: #213547;
  }

  &-copy-button {
    display: inline;
    color: #213547;
    vertical-align: bottom;
  }
}
</style>
