import { Event as NostrEventType } from "./event";

export type MuteTargets = {
  pubkeys: string[];
  eventIds: string[];
  words: string[];
  hashtags: string[];
};

export type KindMuteEntry = {
  createdAt: number;
  pubkeys: string[];
};

export function createEmptyMuteTargets(): MuteTargets {
  return {
    pubkeys: [],
    eventIds: [],
    words: [],
    hashtags: [],
  };
}

export function getFirstTagValue(tags: string[][], name: string): string {
  for (let i = 0; i < tags.length; ++i) {
    const t = tags[i];
    if (t[0] === name && t[1]) {
      return t[1];
    }
  }
  return "";
}

function normalizeTagValue(value: string): string {
  return value.trim().toLowerCase();
}

export function extractMuteTargetsFromTags(tags: string[][]): MuteTargets {
  const targets = createEmptyMuteTargets();

  for (let i = 0; i < tags.length; ++i) {
    const t = tags[i];
    if (t[0] === "p" && t[1]) {
      targets.pubkeys.push(t[1]);
    } else if (t[0] === "e" && t[1]) {
      targets.eventIds.push(t[1]);
    } else if (t[0] === "word" && t[1]) {
      const word = normalizeTagValue(t[1]);
      if (word.length > 0) {
        targets.words.push(word);
      }
    } else if (t[0] === "t" && t[1]) {
      const hashtag = normalizeTagValue(t[1]);
      if (hashtag.length > 0) {
        targets.hashtags.push(hashtag);
      }
    }
  }

  targets.pubkeys = [...new Set(targets.pubkeys)];
  targets.eventIds = [...new Set(targets.eventIds)];
  targets.words = [...new Set(targets.words)];
  targets.hashtags = [...new Set(targets.hashtags)];
  return targets;
}

export function extractPubkeysFromTags(tags: string[][]): string[] {
  return extractMuteTargetsFromTags(tags).pubkeys;
}

export function rebuildPubkeyMuteList(
  kind10000Pubkeys: string[],
  kind30000Pubkeys: string[],
  kind30007Pubkeys: string[]
): string[] {
  return [...new Set([...kind10000Pubkeys, ...kind30000Pubkeys, ...kind30007Pubkeys])];
}

export function rebuildKind30007Pubkeys(kindMuteByDTag: Map<string, KindMuteEntry>): string[] {
  const blocks: string[] = [];
  kindMuteByDTag.forEach((entry) => {
    blocks.push(...entry.pubkeys);
  });
  return [...new Set(blocks)];
}

export function rebuildExtendedMuteFilters(kind10000: MuteTargets, kind30000: MuteTargets): {
  mutedEventIds: string[];
  mutedWords: string[];
  mutedHashtags: string[];
} {
  return {
    mutedEventIds: [...new Set([...kind10000.eventIds, ...kind30000.eventIds])],
    mutedWords: [...new Set([...kind10000.words, ...kind30000.words])],
    mutedHashtags: [...new Set([...kind10000.hashtags, ...kind30000.hashtags])],
  };
}

export function isMutedEvent(
  ev: NostrEventType,
  filters: {
    blockedPubkeys: string[];
    mutedEventIds: string[];
    mutedWords: string[];
    mutedHashtags: string[];
  }
): boolean {
  if (filters.blockedPubkeys.includes(ev.pubkey)) {
    return true;
  }

  if (filters.mutedEventIds.includes(ev.id)) {
    return true;
  }

  for (let i = 0; i < ev.tags.length; ++i) {
    const t = ev.tags[i];
    if (t[0] === "e" && filters.mutedEventIds.includes(t[1])) {
      return true;
    }
    if (t[0] === "t" && filters.mutedHashtags.includes(normalizeTagValue(t[1] ?? ""))) {
      return true;
    }
  }

  if (filters.mutedWords.length > 0) {
    const content = (ev.content ?? "").toLowerCase();
    for (let i = 0; i < filters.mutedWords.length; ++i) {
      const word = filters.mutedWords[i];
      if (word.length > 0 && content.includes(word)) {
        return true;
      }
    }
  }

  return false;
}
