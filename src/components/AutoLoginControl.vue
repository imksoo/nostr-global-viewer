<script setup lang="ts">
import { computed, ref } from "vue";

const props = withDefaults(
  defineProps<{
    loggedIn: boolean;
    loginMethod: "nip07" | "nsec" | "nip49" | null;
    autoLogin: boolean;
    nip07Available: boolean;
    nip49Stored: boolean;
    enableNip49Storage: (password: string) => Promise<void> | void;
    disableNip49Storage: () => void;
  }>(),
  {
    loggedIn: false,
    loginMethod: null,
    autoLogin: false,
    nip07Available: false,
    nip49Stored: false,
  }
);

const emit = defineEmits<{
  (e: "update:autoLogin", autoSpeech: boolean): void;
}>();

const autoLogin = computed({
  get: () => props.autoLogin,
  set: (value) => {
    emit("update:autoLogin", value);
  },
});

const nip49Enabled = computed({
  get: () => props.nip49Stored,
  set: (value) => {
    void toggleNip49Storage(value);
  },
});

const nip49ModalOpen = ref(false);
const nip49Password = ref("");
const nip49PasswordConfirm = ref("");
const nip49Submitting = ref(false);
const nip49Error = ref("");

function closeNip49Modal(): void {
  if (nip49Submitting.value) {
    return;
  }

  nip49ModalOpen.value = false;
  nip49Password.value = "";
  nip49PasswordConfirm.value = "";
  nip49Error.value = "";
}

async function toggleNip49Storage(checked: boolean): Promise<void> {
  if (!checked) {
    props.disableNip49Storage();
    return;
  }

  nip49ModalOpen.value = true;
  nip49Error.value = "";
}

async function submitNip49Storage(): Promise<void> {
  nip49Error.value = "";
  if (!nip49Password.value) {
    nip49Error.value = "暗号化パスワードを入力してください";
    return;
  }
  if (nip49Password.value !== nip49PasswordConfirm.value) {
    nip49Error.value = "確認用パスワードが一致しません";
    return;
  }

  nip49Submitting.value = true;
  try {
    await props.enableNip49Storage(nip49Password.value);
    nip49ModalOpen.value = false;
    nip49Password.value = "";
    nip49PasswordConfirm.value = "";
    nip49Error.value = "";
  } catch (error) {
    nip49Error.value = error instanceof Error ? error.message : "NIP-49 の保管に失敗しました";
  } finally {
    nip49Submitting.value = false;
  }
}

</script>

<template>
  <div class="p-index-auto-login" v-if="props.loginMethod === 'nsec' || props.nip07Available">
    <h2 class="p-index-auto-login__head">{{ props.loginMethod === "nsec" ? "秘密鍵の保管" : "自動ログイン" }}</h2>
    <div class="p-index-auto-login__body">
      <label class="p-index-auto-login-cb" for="nip49-storage" v-if="props.loginMethod === 'nsec'">
        <input class="p-index-auto-login-cb__input" type="checkbox" id="nip49-storage" v-model="nip49Enabled" />
        <span class="p-index-auto-login-cb__dummy"></span>
        <span class="p-index-auto-login-cb__text-label">NIP-49で秘密鍵を暗号化して保管</span>
      </label>
      <label class="p-index-auto-login-cb" for="auto-login" v-else>
        <input class="p-index-auto-login-cb__input" type="checkbox" id="auto-login" v-model="autoLogin" />
        <span class="p-index-auto-login-cb__dummy"></span>
        <span class="p-index-auto-login-cb__text-label">次回から自動ログインする</span>
      </label>
    </div>
  </div>
  <div class="p-index-auto-login-modal" v-if="nip49ModalOpen" v-on:click.self="closeNip49Modal()">
    <form class="p-index-auto-login-modal__dialog" v-on:submit.prevent="submitNip49Storage()">
      <h3 class="p-index-auto-login-modal__head">NIP-49 で秘密鍵を保管</h3>
      <input
        class="p-index-auto-login-modal__input"
        type="password"
        autocomplete="new-password"
        autocapitalize="off"
        spellcheck="false"
        placeholder="暗号化パスワード"
        v-model="nip49Password"
      />
      <input
        class="p-index-auto-login-modal__input"
        type="password"
        autocomplete="new-password"
        autocapitalize="off"
        spellcheck="false"
        placeholder="暗号化パスワード（確認）"
        v-model="nip49PasswordConfirm"
      />
      <p class="p-index-auto-login-modal__note">
        保存するのは NIP-49 で暗号化した秘密鍵だけです。次回はこのパスワードで復号してログインします。
      </p>
      <p class="p-index-auto-login-modal__error" v-if="nip49Error">{{ nip49Error }}</p>
      <div class="p-index-auto-login-modal__actions">
        <input
          class="p-index-auto-login-modal__btn p-index-auto-login-modal__btn--ghost"
          type="button"
          value="キャンセル"
          :disabled="nip49Submitting"
          v-on:click="closeNip49Modal()"
        />
        <input
          class="p-index-auto-login-modal__btn"
          type="submit"
          :value="nip49Submitting ? '保管中...' : '保管する'"
          :disabled="nip49Submitting"
        />
      </div>
    </form>
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

.p-index-auto-login-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.p-index-auto-login-modal__dialog {
  width: min(32rem, 100%);
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 1rem;
  box-sizing: border-box;
  padding: 1.25rem;
}

.p-index-auto-login-modal__head {
  color: #ffffff;
  font-size: 1rem;
  margin: 0 0 1rem;
}

.p-index-auto-login-modal__input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.8rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.95);
  color: #222222;
  font-size: 14px;
  margin-top: 0.75rem;
}

.p-index-auto-login-modal__input:first-of-type {
  margin-top: 0;
}

.p-index-auto-login-modal__note {
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  line-height: 1.6;
  margin: 0.75rem 0 0;
}

.p-index-auto-login-modal__error {
  color: #ffb6cf;
  font-size: 13px;
  margin: 0.75rem 0 0;
}

.p-index-auto-login-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.p-index-auto-login-modal__btn {
  background-color: #fc5fa1;
  color: #ffffff;
  display: block;
  box-sizing: border-box;
  padding: 0.5rem 1.4rem;
  border-radius: 2rem;
  transition: all 0.4s;
  border: none;
  line-height: 1;
  cursor: pointer;
}

.p-index-auto-login-modal__btn:hover {
  background-color: #df3d81;
}

.p-index-auto-login-modal__btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.p-index-auto-login-modal__btn--ghost {
  background: rgba(255, 255, 255, 0.14);
}

.p-index-auto-login-modal__btn--ghost:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
