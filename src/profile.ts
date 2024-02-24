import { ref } from "vue";

export const myPubkey = ref("");
export const myRelaysCreatedAt = ref(0);
export const myReadRelays = ref<string[]>([]);
export const myWriteRelays = ref<string[]>([]);

export const myFollows = ref<string[]>([]);
export const myBlockCreatedAtKind10000 = ref(0);
export const myBlockCreatedAtKind30000 = ref(0);
export const myBlockListKind10000 = ref<string[]>([]);
export const myBlockListKind30000 = ref<string[]>([]);
export const myBlockList = ref<string[]>([]);
export const myBlockedEvents = ref(new Set<string>());
