<script setup lang="ts">
const props = defineProps({
  data: {
    type: Array as () => [string, string][],
    required: true
  },
})
</script>

<template>
  <div class="p-index-river">
    <h2 class="p-index-river__head">
      <a href="https://nostr-hotter-site.vercel.app/" target="_blank">流速情報 (直近の観測状況10個)</a>
    </h2>
    <div class="p-index-river-list">
      <p v-for="t in props.data" :title="t[1]">
        {{
          t[0].replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1/$2/$3 $4:$5")
        }} {{ "🌊".repeat((parseInt(t[1]) + 1) / 3) }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.p-index-river {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 12px;
  gap: 10px;
  margin-top: 1rem;

  overflow: hidden;

  &__head {
    color: #ffffff;
    font-size: 14px;
  }

  &-list {
    font-size: 10px;
  }
}

a {
  color: #ffffff;
}

p {
  font-size: 10px;
  margin: 0 0 0 1rem;
  vertical-align: bottom;
  height: 14px;
  overflow: hidden;
}
</style>