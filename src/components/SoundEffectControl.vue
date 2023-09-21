<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    soundEffect: boolean;
  }>(),
  {
    soundEffect: true // デフォルト値を指定
  }
);

const emit = defineEmits<{
  (e: 'update:soundEffect', soundEffect: boolean): void
}>();

const soundEffect = computed({
  get: () => props.soundEffect,
  set: (value) => { // 値に変更があると呼ばれるsetter
    emit('update:soundEffect', value);
  },
});

</script>

<template>
  <div class="p-index-sound-effect">
    <h2 class="p-index-sound-effect__head">効果音</h2>
    <div class="p-index-sound-effect__body">
      <label class="p-index-sound-effect-cb" for="sound">
        <input class="p-index-sound-effect-cb__input" type="checkbox" id="sound" v-model="soundEffect" />
        <span class="p-index-sound-effect-cb__dummy"></span>
        <span class="p-index-sound-effect-cb__text-label">効果音を鳴らす</span>
      </label>
    </div>
  </div>
</template>

<style scoped lang="scss">
.p-index-sound-effect {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 1rem;
}

.p-index-sound-effect__head {
  color: #ffffff;
  font-size: 13px;
  width: 6em;
}

.p-index-sound-effect__body {
  flex-grow: 1;
  border-left: 1px solid #fff;
  padding-left: 10px;
}

.p-index-sound-effect-cb {
  padding: 0 4px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.p-index-sound-effect-cb__input {
  margin: 0;
  width: 0;
  opacity: 0;
}

.p-index-sound-effect-cb:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

.p-index-sound-effect-cb:hover>.p-index-sound-effect-cb__dummy {
  transform: scale(1.1);
}

.p-index-sound-effect-cb__input:focus+.p-index-sound-effect-cb__dummy {
  transform: scale(1.1);
}

.p-index-sound-effect-cb__input:checked+.p-index-sound-effect-cb__dummy {
  background: #df3d81;
}

.p-index-sound-effect-cb__input:checked+.p-index-sound-effect-cb__dummy::before {
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

.p-index-sound-effect-cb__input:checked+.p-index-sound-effect-cb__dummy::after {
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

.p-index-sound-effect-cb__dummy {
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

.p-index-sound-effect-cb__text-label {
  margin-left: 12px;
  display: block;
  font-size: 18px;
  font-weight: bold;
  color: #fff;
}

.p-index-sound-effect-volume {
  color: #fff;
  margin-top: 8px;
}
</style>