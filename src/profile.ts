import { ref } from "vue";

export const myPubkey = ref("");
export const myRelaysCreatedAt = ref(0);
export const myReadRelays = ref<string[]>([]);
export const myWriteRelays = ref<string[]>([]);

export const myFollows = ref<string[]>([]);
export const myBlockCreatedAt = ref(0);
export const myBlockList = ref<string[]>([]);
export const myBlockedEvents = ref(new Set<string>());
