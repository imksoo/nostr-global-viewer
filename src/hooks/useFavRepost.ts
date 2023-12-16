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

  const reaction = Nostr.getBlankEvent(Nostr.Kind.Reaction);
  reaction.tags = [
    ...inheritedTags,
    ['e', reacted.id],
    ['p', reacted.pubkey],
  ]
  reaction.content = "🪟";
  reaction.created_at = Math.floor(Date.now() / 1000);

  return reaction;
}

export function createRepostEvent(reposted: NostrEvent) {
  const reaction = Nostr.getBlankEvent(Nostr.Kind.Repost);
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