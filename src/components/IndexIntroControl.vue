<script setup lang="ts">
const props = defineProps({
  isLogined: {
    type: Boolean,
    required: true,
  },
  login: {
    type: Function,
    required: true,
  },
});
</script>
<template>
  <div class="p-index-signin" v-if="!props.isLogined">
    <h2 class="p-index-signin__head">この画面からつぶやく</h2>
    <div class="p-index-signin__body">
      <input class="p-index-signin__btn" type="button" value="NIP-07でログイン" v-on:click="(_$event) => props.login()" />
    </div>
  </div>
  <div class="p-index-intro" v-if="!props.isLogined">
    <h2 class="p-index-intro__head">はじめに</h2>
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
    <h2 class="p-index-intro__head">このリレーについて</h2>
    <p class="p-index-intro__text">
      日本向けリレーとしてこのページの裏側にある
      <code>wss://relay-jp.nostr.wirednet.jp</code>
      を是非 Nostr クライアントに設定してお使いください。
    </p>
    <h2 class="p-index-intro__head">ライセンス、ソースコードなど</h2>
    <p class="p-index-intro__text">
      このサイトのソースコードは<a href="https://github.com/imksoo/nostr-global-viewer" class="p-index-intro__text-link"
        target="_blank">GitHub</a>にあります。
    </p>
    <p class="p-index-intro__text">
      <a href="https://awayuki.github.io/emojis.html" target="_blank" class="p-index-intro__text-link">SUSHIYUKI
        emojis (©awayuki)</a> の絵文字素材や
      <a href="https://soundeffect-lab.info/" target="_blank" class="p-index-intro__text-link">効果音ラボ</a>
      の効果音素材を利用しています。
    </p>
    <p class="p-index-intro__text">
      なお、私が管理する Nostr リレーの利用規約は
      <a href="https://relay.nostr.wirednet.jp/index.html" class="p-index-intro__text-link"
        target="_blank">relay.nostr.wirednet.jp</a>
      に掲示してあります。
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
    cursor: pointer;

    &:hover {
      background-color: #df3d81;
    }
  }
}

.p-index-intro {
  margin-top: 2rem;

  @media screen and (max-width: 880px) {
    margin-top: 0rem;
  }

  &__head {
    font-size: 1.5rem;
    color: #ffffff;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin: 1em 0 0 0;

    &::before {
      content: "";
      width: 2em;
      height: 2px;
      background-color: #ffffff;
    }

    &::after {
      content: "";
      width: 2em;
      height: 2px;
      background-color: #ffffff;
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
    display: inline-block;
    padding: 0.5rem 1.4rem;
    border-radius: 2rem;
    transition: all 0.4s;
  }

  &__btn:hover {
    background-color: #df3d81;
  }
}

@media screen and (max-width: 880px) {
  .p-index-post--signin {
    padding: 12px 0;
  }
}
</style>