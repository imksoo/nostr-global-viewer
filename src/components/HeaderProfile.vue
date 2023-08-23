<script setup lang="ts">
import { computed, ref } from "vue";
import FeedProfile from "./FeedProfile.vue";

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
  },
  kind3Follow: {
    type: Array<Array<Object>>,
  },
  kind3Relay: {
    type: Object,
  },
  kind10002: {
    type: Object,
  },
  getProfile: {
    type: Function,
    required: true,
  },
})

const backgroundImage = ref("url(" + props.profile.banner + ")");

const follows = computed(() => {
  const f: string[] = [];
  if (props.kind3Follow) {
    console.log("props.kind3Follow", props.kind3Follow);
    for (let i = 0; i < props.kind3Follow.length; ++i) {
      const tag = props.kind3Follow[i];

      if (tag[0] === "p") {
        f.push(tag[1] as string);
      }
    }
  }
  return f;
});
if (props.kind3Follow) {
  console.log("props.kind3Follow", props.kind3Follow);
  for (let i = 0; i < props.kind3Follow.length; ++i) {
    const tag = props.kind3Follow[i];

    if (tag[0] === "p") {
      follows.value.push(tag[1] as string);
    }
  }

  console.log("follows", follows);
}
</script>

<template>
  <tabs>
    <tab name="kind 0:profile">
      <div class="p-header-profile" :style="{ backgroundImage: backgroundImage }">
        <div class="p-header-profile-content" v-if="props.profile">
          {{ JSON.stringify(props.profile, undefined, 1) }}
        </div>
        <div class="p-header-profile-content" v-else>
          undefined
        </div>
      </div>
    </tab>
    <tab name="kind 3:relays">
      <div class="p-header-profile" :style="{ backgroundImage: backgroundImage }">
        <div class="p-header-profile-content" v-if="props.kind3Relay">
          {{ JSON.stringify(props.kind3Relay, function (key, value) {
            if (value && typeof value === 'object' && value.read !== undefined && value.write !== undefined) {
              return `{ "read": ${value.read}, "write": ${value.write} }`;
            }
            return value;
          }, 1).replace(/\\"/g, '"').replace(/"{/g, '{').replace(/}"/g, '}') }}
        </div>
        <div class="p-header-profile-content" v-else>
          undefined
        </div>
      </div>
    </tab>
    <tab name="kind 10002:relays">
      <div class="p-header-profile" :style="{ backgroundImage: backgroundImage }">
        <div class="p-header-profile-content" v-if="props.kind10002">
          {{ JSON.stringify(props.kind10002, function (key, value) {
            if (Array.isArray(value) && typeof value[0] === 'string') {
              return JSON.stringify(value);
            }
            return value;
          }, 1).replace(/"\[/g, '[').replace(/\]"/g, ']').replace(/\\\"/g, '\"')
          }}
        </div>
        <div class="p-header-profile-content" v-else>
          undefined
        </div>
      </div>
    </tab>
    <tab name="kind 3:follows">
      <div class="p-header-profile" :style="{ backgroundImage: backgroundImage }">
        <div class="p-header-profile-follows" v-if="follows">
          <div v-for="p in follows" :key="p" class="p-header-profile-follows-profile">
            <FeedProfile :profile="props.getProfile(p)"></FeedProfile>
          </div>
        </div>
        <div class="p-header-profile-content" v-else>
          undefined
        </div>
      </div>
    </tab>
  </tabs>
</template>

<style scoped lang="scss">
.p-header-profile {
  font-size: 12px;
  color: white;
  text-shadow: 2px 2px 8px gray,
    -2px 2px 8px gray,
    2px -2px 8px gray,
    -2px -2px 8px gray;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;

  &-content {
    padding: 12px;
    background: rgba(0, 0, 0, 0.6);
  }

  &-follows {
    text-shadow: none;
    background: #ffffff;
    padding-top: 10px;
    border-bottom: rgba(0, 0, 0, 0.6) 1px dashed;
    display: flex;
    flex-direction: row;
    flex-flow: wrap;
  }

  &-follows-profile {
    padding: 10px;
    flex-grow: 1;
  }
}
</style>