<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    searchWords: string,
    eventType: string,
  }>(),
  {
    searchWords: "", // デフォルト値を指定
    eventType: "all", // デフォルト値を指定
  }
)

const emit = defineEmits<{
  (e: "update:searchWords", searchWords: string): void,
  (e: "update:eventType", eventType: string): void,
}>()

const searchWords = computed({
  get: () => props.searchWords,
  set: (value) => {
    // 値に変更があると呼ばれるsetter
    emit("update:searchWords", value)
  },
});

const eventType = computed({
  get: () => props.eventType,
  set: (value) => {
    // 値に変更があると呼ばれるsetter
    emit("update:eventType", value);
    console.log("eventType", value);
  },
});
</script>

<template>
  <div class="p-index-search">
    <h2 class="p-index-search__head">絞り込み</h2>
    <div class="p-index-search__body">
      <div>
        <label for="search">検索キーワード: </label>
        <input class="p-index-search__input" type="search" id="search" v-model="searchWords"
          :disabled="eventType !== 'all' && eventType !== 'reply' && eventType !== 'chat'" />
      </div>
      <br>
      <div>
        <div>種別: </div>
        <input class="" type="radio" name="eventType" id="eventTypeAll" value="all" v-model="eventType" checked />
        <label for="eventTypeAll">全て</label>
      </div>
      <div>
        <input class="" type="radio" name="eventType" id="eventTypeReply" value="reply" v-model="eventType" />
        <label for="eventTypeReply">自分宛の返信</label>
      </div>
      <div>
        <input class="" type="radio" name="eventType" id="eventTypeReaction" value="reaction" v-model="eventType" />
        <label for="eventTypeReaction">自分宛のリアクション</label>
      </div>
      <!-- div>
        <input class="" type="radio" name="eventType" id="eventTypeFav" value="fav" v-model="eventType" />
        <label for="eventTypeFav">みんなのファボ</label>
      </div -->
      <div>
        <input class="" type="radio" name="eventType" id="eventTypeRepost" value="repost" v-model="eventType" />
        <label for="eventTypeRepost">みんなのリポスト</label>
      </div>
      <div>
        <input class="" type="radio" name="eventType" id="eventTypeChat" value="chat" v-model="eventType" />
        <label for="eventTypeChat">グローバルチャット</label>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.p-index-search {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 1rem;

  &__head {
    color: #ffffff;
    font-size: 13px;
    width: 6em;
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
