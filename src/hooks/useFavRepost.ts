import * as Nostr from 'nostr-tools';

type NostrEvent = {
  id: string,
  pubkey: string,
  kind: Nostr.Kind | number,
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

  const reaction = Nostr.getBlankEvent(7);
  reaction.tags = [
    ...inheritedTags,
    ['e', reacted.id],
    ['p', reacted.pubkey],
    ['k', reacted.kind.toString()],
  ]
  reaction.content = "🪟";
  reaction.created_at = Math.floor(Date.now() / 1000);

  return reaction;
}

export function createRepostEvent(reposted: NostrEvent) {
  const reaction = Nostr.getBlankEvent(6);
  reaction.tags = [
    ['e', reposted.id],
    ['p', reposted.pubkey],
  ]
  reaction.content = "";
  reaction.created_at = Math.floor(Date.now() / 1000);

  return reaction;
}

export default {
  createFavEvent,
  createRepostEvent,
};