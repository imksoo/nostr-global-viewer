<script setup lang="ts">
const props = defineProps({
  feedRelays: {
    type: Array as () => string[],
    required: true
  }
})

function appVersion() {
  // @ts-ignore
  return __APP_VERSION__;
}
</script>
<template>
  <h1 class="p-index-title">
    <a href="/" :class="(Math.floor(new Date().getTime() / 1000) % 10 === 0) ? ['gaming'] : []">
      <span class="p-index-title__main">Nozokimado</span>
    </a>
    <span class="p-index-title__sub">From
      {{
        feedRelays
          .map((s) => {
            return s.replace(/wss?:\/\/(.*)\//, "$1");
          })
          .join(",")
      }}</span>
    <span class="p-index-title__sub">Version: {{ appVersion() }}</span>
  </h1>
</template>
<style scoped lang="scss">
.p-index-title {
  font-family: "Anton", sans-serif;
  color: #ffffff;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 1rem 0;

  @media screen and (max-width: 880px) {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  &__main {
    font-size: 4rem;
    color: #ffffff;

    @media screen and (max-width: 880px) {
      font-size: 3rem;
    }
  }

  &__sub {
    font-size: 1.5rem;

    @media screen and (max-width: 880px) {
      font-size: 1.5rem;
      width: 100%;
    }
  }
}

.p-index-title a.gaming {
  -webkit-text-fill-color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  background-image: linear-gradient(to top right, red 20%, orange 25% 35%, yellow 45% 55%, green 65% 75%, blue 80% 95%, violet 100%);
}
</style>