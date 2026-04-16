import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { Event as NostrTypedEvent, Tag } from "nostr-typedef";

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
export type ParsedNip10 = {
  root?: { id: string };
  reply?: { id: string };
  mentions: Array<{ id: string }>;
  profiles: Array<{ pubkey: string }>;
};

export const Kind = {
  Text: 1,
  ChannelMessage: 42,
} as const;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("hex string must have an even length");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const value = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(value)) {
      throw new Error("invalid hex string");
    }
    bytes[i] = value;
  }
  return bytes;
}

function serializeEvent(event: Event): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

export function verifyEventSignature(event: Event): boolean {
  if (!event.sig || !event.id || !event.pubkey) {
    return false;
  }

  try {
    const expectedId = getEventHash(event);
    if (expectedId !== event.id) {
      return false;
    }

    return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}

export function getEventHash(event: Event): string {
  return bytesToHex(sha256(new TextEncoder().encode(serializeEvent(event))));
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
  const eventTags = event.tags.filter((tag): tag is string[] => tag[0] === "e" && typeof tag[1] === "string" && tag[1] !== "");
  const explicitRoot = eventTags.find((tag) => tag[3] === "root");
  const explicitReply = eventTags.find((tag) => tag[3] === "reply");

  let root = explicitRoot ? { id: explicitRoot[1] } : undefined;
  let reply = explicitReply ? { id: explicitReply[1] } : undefined;
  let mentions: Array<{ id: string }> = [];

  if (explicitRoot || explicitReply) {
    mentions = eventTags
      .filter((tag) => tag[3] !== "root" && tag[3] !== "reply")
      .map((tag) => ({ id: tag[1] }));
  } else if (eventTags.length > 0) {
    root = { id: eventTags[0][1] };
    if (eventTags.length > 1) {
      reply = { id: eventTags[eventTags.length - 1][1] };
      mentions = eventTags.slice(1, -1).map((tag) => ({ id: tag[1] }));
    }
  }

  const profiles = event.tags
    .filter((tag): tag is string[] => tag[0] === "p" && typeof tag[1] === "string" && tag[1] !== "")
    .map((tag) => ({ pubkey: tag[1] }));

  return { root, reply, mentions, profiles };
}
