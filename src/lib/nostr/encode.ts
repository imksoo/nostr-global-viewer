import * as Nostr from "nostr-tools";

export function encodeNpub(pubkey: string): string {
  return Nostr.nip19.npubEncode(pubkey);
}

export function encodeNote(id: string): string {
  return Nostr.nip19.noteEncode(id);
}

export function decodeNip19(value: string) {
  return Nostr.nip19.decode(value);
}
