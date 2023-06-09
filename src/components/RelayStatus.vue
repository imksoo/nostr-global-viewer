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
    <h2 class="p-index-relay__head">
      リレーの接続状態 (プロフィール取得＆投稿用)
    </h2>
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

  &-list {
    font-size: 4px;
  }

  &-status-0 ::before {
    content: "🆖 "
  }

  &-status-0 {
    // Connecting
    font-size: 4px;
    color: red;
  }

  &-status-1 ::before {
    content: "🆗 ";
  }

  &-status-1 {
    // OPEN
    font-size: 4px;
    color: rgba(255, 255, 255, 1);
  }

  &-status-2 ::before {
    content: "🆖 "
  }

  &-status-2 {
    // Closing
    font-size: 4px;
    color: red;
  }

  &-status-3 ::before {
    content: "🆖 "
  }

  &-status-3 {
    // Closed
    font-size: 4px;
    color: red;
  }
}
</style>