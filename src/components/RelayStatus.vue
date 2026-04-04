<script setup lang="ts">
const props = defineProps({
  relays: {
    type: Array as () => [string, number][],
    required: true
  }
})

function getRelayStatusLabel(status: number): string {
  switch (status) {
    case 0: return "📡 TUNING";
    case 1: return "🎙 ON AIR";
    case 2: return "📻 SIGNING OFF";
    case 3: return "⏹ NO SIGNAL";
    default: return "N/A";
  }
}
</script>

<template>
  <div class="p-index-relay">
    <h2 class="p-index-relay__head">リレーの接続状態 (プロフ取得＆イベント投稿用)</h2>
    <div class="p-index-relay-status-list">
      <p v-for="[url, status] in props.relays" v-bind:key="url" v-bind:class="'p-index-relay-status-' + status">
        <span class="p-index-relay-status-label">{{ getRelayStatusLabel(status) }}</span>
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

  &-status-label {
    display: inline-block;
    width: 122px;
    font-weight: bold;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-align: center;
    border-radius: 999px;
    padding: 1px 6px;
    margin-right: 6px;
    border: 1px solid currentColor;
  }

  &-status-0 {
    font-size: 10px;
    color: #ffd166;
  }

  &-status-1 {
    font-size: 10px;
    color: #8ce99a;
  }

  &-status-2 {
    font-size: 10px;
    color: #ffe066;
  }

  &-status-3 {
    font-size: 10px;
    color: #ff6b6b;
  }
}
</style>