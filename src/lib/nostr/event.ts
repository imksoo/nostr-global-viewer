import type { Event as NostrTypedEvent, Tag } from "nostr-typedef";
import * as Nostr from "nostr-tools";

export type Event = NostrTypedEvent;
export type EventKind = number;
export type EventTag = Tag.Any;
export type BlankEvent = {
  kind: number;
  content: string;
  tags: EventTag[];
  created_at: number;
  pubkey: string;
};
export type ParsedNip10 = ReturnType<typeof Nostr.nip10.parse>;

export const Kind = {
  Text: 1,
  ChannelMessage: 42,
} as const;

export function verifyEventSignature(event: Event): boolean {
  return Nostr.verifySignature(event as Nostr.Event);
}

export function getEventHash(event: Event): string {
  return Nostr.getEventHash(event as Nostr.Event);
}

export function createBlankEvent(kind: number): BlankEvent {
  return {
    kind,
    content: "",
    tags: [],
    created_at: 0,
    pubkey: "",
  };
}

export function normalizeRelayUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  parsed.searchParams.sort();

  if ((parsed.protocol === "ws:" && parsed.port === "80") || (parsed.protocol === "wss:" && parsed.port === "443")) {
    parsed.port = "";
  }

  if (!parsed.pathname) {
    parsed.pathname = "/";
  }

  return parsed.toString();
}

function insertEventIntoSortedList<T extends Event>(events: T[], event: T, compare: (a: T, b: T) => number): T[] {
  const next = events.filter((item) => item.id !== event.id);
  const index = next.findIndex((item) => compare(event, item) < 0);

  if (index === -1) {
    next.push(event);
    return next;
  }

  next.splice(index, 0, event);
  return next;
}

export function insertEventIntoDescendingList<T extends Event>(events: T[], event: T): T[] {
  return insertEventIntoSortedList(events, event, (a, b) => {
    if (a.created_at !== b.created_at) {
      return b.created_at - a.created_at;
    }
    return a.id.localeCompare(b.id);
  });
}

export function insertEventIntoAscendingList<T extends Event>(events: T[], event: T): T[] {
  return insertEventIntoSortedList(events, event, (a, b) => {
    if (a.created_at !== b.created_at) {
      return a.created_at - b.created_at;
    }
    return a.id.localeCompare(b.id);
  });
}

export function parseNip10(event: Event): ParsedNip10 {
  return Nostr.nip10.parse(event as Nostr.Event);
}
