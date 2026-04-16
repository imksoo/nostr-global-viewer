import { EventKind, createBlankEvent } from "../lib/nostr/event";
import { feedRelays } from "../store";

type NostrEvent = {
  id: string,
  pubkey: string,
  kind: EventKind,
  content: string,
  tags: string[][],
  created_at: number,
  isReposted: Boolean | undefined,
  isFavorited: Boolean | undefined,
};

export function createFavEvent(reacted: NostrEvent) {
  const inheritedTags = reacted.tags.filter(
    (tag) => tag.length >= 2 && (tag[0] === 'e' || tag[0] === 'p'),
  )

  const reaction = createBlankEvent(7);
  reaction.tags = [
    ...inheritedTags,
    ['e', reacted.id],
    ['p', reacted.pubkey],
    ['k', reacted.kind.toString()],
    ["client", "Nozokimado", "31990:ad73ce27d83ccc6bf6184549e529119d8b5963c5e6f681f6690a33f91c8b615a:1757113040", feedRelays[0] || ""],
  ]
  reaction.content = "🪟";
  reaction.created_at = Math.floor(Date.now() / 1000);

  return reaction;
}

export function createRepostEvent(reposted: NostrEvent) {
  const reaction = createBlankEvent(6);
  reaction.tags = [
    ['e', reposted.id],
    ['p', reposted.pubkey],
    ["client", "Nozokimado", "31990:ad73ce27d83ccc6bf6184549e529119d8b5963c5e6f681f6690a33f91c8b615a:1757113040", feedRelays[0] || ""],
  ]
  reaction.content = "";
  reaction.created_at = Math.floor(Date.now() / 1000);

  return reaction;
}

export default {
  createFavEvent,
  createRepostEvent,
};
