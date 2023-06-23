<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from "vue-router";
import * as Nostr from 'nostr-tools';
import * as Utils from '../components/utils';

import { speakNote } from '../hooks/useSpeakNote';

import FeedContent from '../components/FeedContent.vue';

const route = useRoute();
const noteId = ref("");
const noteEvent = ref();

const isVaildNoteId = computed(() => {
  try {
    const data = route.query.e;
    if ( !Array.isArray(data) && data ) {
      const ev = Nostr.nip19.decode(data);
      console.log(ev);
      switch (ev.type) {
        case 'nevent': {
          noteId.value = ev.data.id;
          noteEvent.value = Utils.getEvent(noteId.value);
          return true;
        } break;
        case 'note': {
          noteId.value = ev.data;
          noteEvent.value = Utils.getEvent(noteId.value);
          return true;
        } break;
      }
    }
  } catch (err) {
    console.log(err);
  }
  return false;
});


function noop() { }

</script>
<template>
  {{  noteEvent }}
    <FeedContent v-bind:event="noteEvent" :get-profile="Utils.getProfile" :get-event="Utils.getEvent"
    :speak-note="speakNote" :volume="0.5" :is-logined="false" :post-event="noop" :open-reply-post="noop"></FeedContent>
</template>