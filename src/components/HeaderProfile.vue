<script setup lang="ts">
import { ref } from "vue";

const props = defineProps({
  profile: {
    type: Object as () => {
      pubkey: string,
      picture: string | undefined,
      display_name: string | undefined,
      name: string | undefined,
      banner: string | undefined,
    },
    required: true,
  }
})

const backgroundImage = ref("url(" + props.profile.banner + ")");
</script>

<template>
  <div class="p-header-profile" :style="{ backgroundImage: backgroundImage }">
    {{ JSON.stringify(props.profile, undefined, 1) }}
  </div>
</template>

<style scoped lang="scss">
.p-header-profile {
  padding: 12px;
  color: white;
  text-shadow: 2px 2px 8px gray,
    -2px 2px 8px gray,
    2px -2px 8px gray,
    -2px -2px 8px gray;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}
</style>