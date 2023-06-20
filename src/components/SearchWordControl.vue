<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    searchWords: string;
  }>(),
  {
    searchWords: "" // デフォルト値を指定
  }
);

const emit = defineEmits<{
  (e: 'update:searchWords', searchWords: string): void
}>();

const searchWords = computed({
  get: () => props.searchWords,
  set: (value) => { // 値に変更があると呼ばれるsetter
    emit('update:searchWords', value);
  },
});

</script>

<template>
  <div class="p-index-search">
    <h2 class="p-index-search__head">検索</h2>
    <div class="p-index-search__body">
      <input class="p-index-search__input" type="search" id="search" v-model="searchWords" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.p-index-search {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 1rem;

  &__head {
    color: #ffffff;
    font-size: 14px;
  }

  &__body {
    flex-grow: 1;
    border-left: 1px solid #fff;
    padding-left: 10px;
  }

  &__input {
    font-size: 18px;
  }
}
</style>