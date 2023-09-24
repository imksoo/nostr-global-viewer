<script setup lang="ts">
import { computed, ref } from "vue";

const props = withDefaults(
  defineProps<{
    autoLogin: boolean;
  }>(),
  {
    autoLogin: false,
  }
);

const emit = defineEmits<{
  (e: "update:autoLogin", autoSpeech: boolean): void;
}>();

const autoLogin = computed({
  get: () => props.autoLogin,
  set: (value) => {
    // 値に変更があると呼ばれるsetter
    emit("update:autoLogin", value);
    localStorage.setItem("autoLogin", `${value}`);
  },
});

// const nip07exists = ref('nostr' in window);
const nip07exists = true;
</script>

<template>
  <div class="p-index-auto-login" :style="(!nip07exists) ? { display: 'none' } : {}">
    <h2 class="p-index-auto-login__head">自動ログイン</h2>
    <div class="p-index-auto-login__body">
      <label class="p-index-auto-login-cb" for="auto-login">
        <input class="p-index-auto-login-cb__input" type="checkbox" id="auto-login" v-model="autoLogin" />
        <span class="p-index-auto-login-cb__dummy"></span>
        <span class="p-index-auto-login-cb__text-label">次回から自動ログインする</span>
      </label>
    </div>
  </div>
</template>

<style scoped lang="scss">
.p-index-auto-login {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 1rem;
}

.p-index-auto-login__head {
  color: #ffffff;
  font-size: 13px;
  width: 6em;
}

.p-index-auto-login__body {
  flex-grow: 1;
  border-left: 1px solid #fff;
  padding-left: 10px;
}

.p-index-auto-login-cb {
  padding: 0 4px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.p-index-auto-login-cb__input {
  margin: 0;
  width: 0;
  opacity: 0;
}

.p-index-auto-login-cb:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

.p-index-auto-login-cb:hover>.p-index-auto-login-cb__dummy {
  transform: scale(1.1);
}

.p-index-auto-login-cb__input:focus+.p-index-auto-login-cb__dummy {
  transform: scale(1.1);
}

.p-index-auto-login-cb__input:checked+.p-index-auto-login-cb__dummy {
  background: #df3d81;
}

.p-index-auto-login-cb__input:checked+.p-index-auto-login-cb__dummy::before {
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

.p-index-auto-login-cb__input:checked+.p-index-auto-login-cb__dummy::after {
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

.p-index-auto-login-cb__dummy {
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

.p-index-auto-login-cb__text-label {
  margin-left: 12px;
  display: block;
  font-size: 16px;
  font-weight: bold;
  color: #fff;
}
</style>
