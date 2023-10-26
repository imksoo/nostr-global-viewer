<script setup lang="ts">
const props = defineProps({
  relays: {
    type: Array as () => [string, number][],
    required: true
  }
})
</script>

<template>
  <div class="p-index-relay">
    <h2 class="p-index-relay__head">リレーの接続状態 (プロフ取得＆イベント投稿用)</h2>
    <p class="p-index-relay-notice">wss://eu.rbr.bio と wss://us.rbr.bio は本サイトの内部で利用している nostr-relaypool
      がプロフ取得に既定で利用するリレーです。</p>
    <div class="p-index-relay-status-list">
      <p v-for="[url, status] in props.relays" v-bind:key="url" v-bind:class="'p-index-relay-status-' + status">
        <span>{{ url }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.p-index-relay {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 12px;
  gap: 10px;
  margin-top: 1rem;

  &__head {
    color: #ffffff;
    font-size: 14px;
  }

  &-notice {
    font-size: 8px;
  }

  &-list {
    font-size: 10px;
  }

  &-status-0 ::before {
    content: "❌ "
  }

  &-status-0 {
    // Connecting
    font-size: 10px;
    color: red;
  }

  &-status-1 ::before {
    content: "🟢 ";
  }

  &-status-1 {
    // OPEN
    font-size: 10px;
    color: rgba(255, 255, 255, 1);
  }

  &-status-2 ::before {
    content: "🟡 "
  }

  &-status-2 {
    // Closing
    font-size: 10px;
    color: yellow;
  }

  &-status-3 ::before {
    content: "❌ "
  }

  &-status-3 {
    // Closed
    font-size: 10px;
    color: red;
  }
}
</style>