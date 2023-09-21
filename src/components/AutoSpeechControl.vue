<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    volume: string,
    autoSpeech: boolean,
  }>(),
  {
    volume: "0.5", // デフォルト値を指定
    autoSpeech: false,
  }
);

const emit = defineEmits<{
  (e: 'update:volume', volume: string): void
  (e: 'update:autoSpeech', autoSpeech: boolean): void
}>();

const volume = computed({
  get: () => props.volume,
  set: (value) => { // 値に変更があると呼ばれるsetter
    emit('update:volume', value);
  },
});

const autoSpeech = computed({
  get: () => props.autoSpeech,
  set: (value) => { // 値に変更があると呼ばれるsetter
    emit('update:autoSpeech', value);
  },
});

</script>

<template>
  <div class="p-index-speech">
    <h2 class="p-index-speech__head">読み上げ</h2>
    <div class="p-index-speech__body">
      <label class="p-index-speech-cb" for="speech">
        <input class="p-index-speech-cb__input" type="checkbox" id="speech" v-model="autoSpeech" />
        <span class="p-index-speech-cb__dummy"></span>
        <span class="p-index-speech-cb__text-label">自動読み上げをする</span>
      </label>
      <div class="p-index-speech-volume">
        <label for="volume">音量</label>
        <input type="range" id="volume" v-model="volume" min="0" max="1" step="0.1" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.p-index-speech {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 1rem;
}

.p-index-speech__head {
  color: #ffffff;
  font-size: 13px;
  width: 6em;
}

.p-index-speech__body {
  flex-grow: 1;
  border-left: 1px solid #fff;
  padding-left: 10px;
}

.p-index-speech-cb {
  padding: 0 4px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.p-index-speech-cb__input {
  margin: 0;
  width: 0;
  opacity: 0;
}

.p-index-speech-cb:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

.p-index-speech-cb:hover > .p-index-speech-cb__dummy {
  transform: scale(1.1);
}

.p-index-speech-cb__input:focus + .p-index-speech-cb__dummy {
  transform: scale(1.1);
}

.p-index-speech-cb__input:checked + .p-index-speech-cb__dummy {
  background: #df3d81;
}

.p-index-speech-cb__input:checked + .p-index-speech-cb__dummy::before {
  content: "";
  display: block;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 35%;
  height: 4px;
  border-radius: 2px;
  transform: translate(-4px, 2px) rotateZ(-135deg);
  transform-origin: 2px 2px;
  background: #ffffff;
}

.p-index-speech-cb__input:checked + .p-index-speech-cb__dummy::after {
  content: "";
  display: block;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 70%;
  height: 4px;
  border-radius: 2px;
  transform: translate(-4px, 2px) rotateZ(-45deg);
  transform-origin: 2px 2px;
  background: #ffffff;
}

.p-index-speech-cb__dummy {
  position: relative;
  top: 0;
  left: 0;
  display: block;
  width: 20px;
  height: 20px;
  border: solid 2px transparent;
  background: rgba(255, 255, 255, 1);
  border-radius: 50%;
  transition: all 0.15s linear;
}

.p-index-speech-cb__text-label {
  margin-left: 12px;
  display: block;
  font-size: 18px;
  font-weight: bold;
  color: #fff;
}

.p-index-speech-volume {
  color: #fff;
  margin-top: 8px;
  text-align: center;
}

</style>