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
    <a href="/">
      <span class="p-index-title__main">
        Nozokimado
      </span>
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

@keyframes hue-rotate-animation {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

.p-index-title a {
  animation: hue-rotate-animation 5s infinite;

  -webkit-text-fill-color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  background-image: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);
}
</style>