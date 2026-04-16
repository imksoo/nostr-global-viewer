import * as Nostr from "nostr-tools";

export type Event = Nostr.Event;
export type EventKind = Nostr.Kind | number;
export type BlankEvent = ReturnType<typeof Nostr.getBlankEvent>;
export type ParsedNip10 = ReturnType<typeof Nostr.nip10.parse>;

export const Kind = Nostr.Kind;

export function verifyEventSignature(event: Event): boolean {
  return Nostr.verifySignature(event);
}

export function getEventHash(event: Event): string {
  return Nostr.getEventHash(event);
}

export function createBlankEvent(kind: number): BlankEvent {
  return Nostr.getBlankEvent(kind);
}

export function normalizeRelayUrl(url: string): string {
  return Nostr.utils.normalizeURL(url);
}

export function insertEventIntoDescendingList<T extends Event>(events: T[], event: T): T[] {
  return Nostr.utils.insertEventIntoDescendingList(events, event) as T[];
}

export function insertEventIntoAscendingList<T extends Event>(events: T[], event: T): T[] {
  return Nostr.utils.insertEventIntoAscendingList(events, event) as T[];
}

export function parseNip10(event: Event): ParsedNip10 {
  return Nostr.nip10.parse(event);
}
