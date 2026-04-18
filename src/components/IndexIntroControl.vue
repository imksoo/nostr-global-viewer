<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  loggedIn: boolean;
  nip07Available: boolean;
  loginWithNip07: () => Promise<void> | void;
  loginWithNsec: (secretKey: string) => Promise<void> | void;
}>();

const nsecInput = ref("");
const nsecError = ref("");
const nsecSubmitting = ref(false);
const nsecModalOpen = ref(false);

async function submitNsecLogin(): Promise<void> {
  nsecError.value = "";
  nsecSubmitting.value = true;

  try {
    await props.loginWithNsec(nsecInput.value);
    nsecInput.value = "";
    nsecModalOpen.value = false;
  } catch (error) {
    nsecError.value = error instanceof Error ? error.message : "秘密鍵ログインに失敗しました";
  } finally {
    nsecSubmitting.value = false;
  }
}

function openNsecModal(): void {
  nsecError.value = "";
  nsecModalOpen.value = true;
}

function closeNsecModal(): void {
  if (nsecSubmitting.value) {
    return;
  }
  nsecError.value = "";
  nsecModalOpen.value = false;
}
</script>

<template>
  <div class="p-index-signin" v-if="!props.loggedIn">
    <h2 class="p-index-signin__head">この画面からつぶやく</h2>
    <div class="p-index-signin__body">
      <div class="p-index-signin__row">
        <input
          class="p-index-signin__btn"
          type="button"
          value="NIP-07でログイン"
          :disabled="!props.nip07Available"
          v-on:click="(_$event) => props.loginWithNip07()"
        />
        <input
          class="p-index-signin__btn"
          type="button"
          value="nsec (秘密鍵)でログイン"
          v-on:click="openNsecModal()"
        />
      </div>
    </div>
  </div>
  <div
    class="p-index-signin-modal"
    v-if="!props.loggedIn && nsecModalOpen"
    v-on:click.self="closeNsecModal()"
  >
    <form class="p-index-signin-modal__dialog" v-on:submit.prevent="submitNsecLogin()">
      <h3 class="p-index-signin-modal__head">nsec (秘密鍵)でログイン</h3>
      <input
        class="p-index-signin-modal__input"
        type="password"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="nsec1... または 64桁の16進秘密鍵"
        v-model="nsecInput"
      />
      <p class="p-index-signin-modal__note">
        入力された秘密鍵はブラウザー上のメモリでのみ保持して、リレーサーバーや外部には送信しません。
      </p>
      <p class="p-index-signin-modal__error" v-if="nsecError">{{ nsecError }}</p>
      <div class="p-index-signin-modal__actions">
        <input
          class="p-index-signin-modal__btn p-index-signin-modal__btn--ghost"
          type="button"
          value="キャンセル"
          :disabled="nsecSubmitting"
          v-on:click="closeNsecModal()"
        />
        <input
          class="p-index-signin-modal__btn"
          type="submit"
          :value="nsecSubmitting ? 'ログイン中...' : 'ログイン'"
          :disabled="nsecSubmitting"
        />
      </div>
    </form>
  </div>
  <div class="p-index-intro" v-if="!props.loggedIn">
    <h2 class="p-index-intro__head"><span>はじめに</span></h2>
    <p class="p-index-intro__text">Nostr を始めてみたくなった方は</p>
    <p class="p-index-intro__text">
      <a href="https://welcome.nostr-jp.org/" rel="noopener" target="_blank" class="p-index-intro__btn">Welcome to
        Nostr</a>
    </p>
    <p class="p-index-intro__text">をはじめに読んでみてください。<br />また、ちょっと詳しいことが気になった方は</p>
    <p class="p-index-intro__text">
      <a href="https://scrapbox.io/nostr/%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E3%81%AENostr%E3%80%90%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E3%81%AE%E6%96%B9%E3%81%AF%E3%81%93%E3%81%A1%E3%82%89%E3%80%91"
        rel="noopener" target="_blank" class="p-index-intro__btn">はじめてのNostr【はじめての方はこちら】</a>
    </p>
    <p class="p-index-intro__text">などを起点に調べてる見ると面白いと思います。</p>
    <h2 class="p-index-intro__head"><span>このリレーについて</span></h2>
    <p class="p-index-intro__text">日本向けリレーとしてこのページの裏側にある
      <code>wss://relay-jp.nostr.wirednet.jp</code>
      を是非 Nostr クライアントに設定してお使いください。
    </p>
    <h2 class="p-index-intro__head">ライセンス、ソースコードなど</h2>
    <p class="p-index-intro__text">このサイトのソースコードは<a href="https://github.com/imksoo/nostr-global-viewer"
        class="p-index-intro__text-link" target="_blank">GitHub</a>にあります。
    </p>
    <p class="p-index-intro__text">
      <a href="https://awayuki.github.io/emojis.html" target="_blank" class="p-index-intro__text-link">SUSHIYUKI
        emojis (©awayuki)</a> の絵文字素材や
      <a href="https://soundeffect-lab.info/" target="_blank" class="p-index-intro__text-link">効果音ラボ</a>
      の効果音素材を利用しています。
    </p>
    <p class="p-index-intro__text">なお、私が管理する Nostr リレーの利用規約は<br>
      <a href="https://relay.nostr.wirednet.jp/index.html" class="p-index-intro__text-link"
        target="_blank">relay.nostr.wirednet.jp</a><br>に掲示してあります。
    </p>
  </div>
</template>

<style scoped lang="scss">
.p-index-signin {
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

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  &__btn {
    background-color: #fc5fa1;
    color: #ffffff;
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 1.4rem;
    border-radius: 2rem;
    transition: all 0.4s;
    border: none;
    line-height: 1;
    cursor: pointer;

    &:hover {
      background-color: #df3d81;
    }

    &:disabled {
      opacity: 0.7;
    cursor: not-allowed;
    }
  }
}

.p-index-signin-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;

  &__dialog {
    width: min(32rem, 100%);
    background: #1f1f1f;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 1rem;
    box-sizing: border-box;
    padding: 1.25rem;
  }

  &__head {
    color: #ffffff;
    font-size: 1rem;
    margin: 0 0 1rem;
  }

  &__input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.8rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.95);
    color: #222222;
    font-size: 14px;
  }

  &__note {
    color: rgba(255, 255, 255, 0.82);
    font-size: 12px;
    line-height: 1.6;
    margin: 0.75rem 0 0;
  }

  &__error {
    color: #ffb6cf;
    font-size: 13px;
    margin: 0.75rem 0 0;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  &__btn {
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

    &:hover {
      background-color: #df3d81;
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }

  &__btn--ghost {
    background: rgba(255, 255, 255, 0.14);

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

.p-index-intro {
  margin-top: 2rem;

  @media screen and (max-width: 880px) {
    margin-top: 0rem;
  }

  &__head {
    font-size: 1.4rem;
    color: gold;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin: 2rem 0 1rem 0;

    &::before {
      content: "";
      flex-grow: 1;
      height: 2px;
      background-color: gold;
    }

    &::after {
      content: "";
      flex-grow: 1;
      height: 2px;
      background-color: gold;
    }

    span {
      width: max-content;
      flex-grow: 0;
      flex-shrink: 0;
    }
  }

  &__text {
    color: #ffffff;
    margin: 0;
    line-height: 1.8;
    margin-top: 0.3rem;
  }

  &__text-link {
    color: #fc5fa1;
    font-weight: bold;
  }

  &__text code {
    display: inline-block;
  }

  &__btn {
    background-color: #fc5fa1;
    color: #ffffff;
    display: block;
    padding: 0.5rem 1.4rem;
    border-radius: 2rem;
    transition: all 0.4s;
    line-height: 1;
    margin: 0 auto;
    width: max-content;
  }

  &__btn:hover {
    background-color: #df3d81;
  }
}

@media screen and (max-width: 880px) {
  .p-index-post--signin {
    padding: 12px 0;
  }

  .p-index-signin {
    flex-direction: column;
    align-items: stretch;

    &__body {
      border-left: none;
      border-top: 1px solid #fff;
      padding-left: 0;
      padding-top: 10px;
    }
  }

  .p-index-signin-modal__actions {
    flex-direction: column-reverse;
  }

  .p-index-signin-modal__btn {
    width: 100%;
  }
}
</style>
