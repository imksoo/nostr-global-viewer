import { sha256 } from "@noble/hashes/sha2.js";

import type { Event as NostrEventType } from "./event";
import { signEvent } from "./signer";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

export function sha256ToBase64(data: Uint8Array): string {
  return bytesToBase64(sha256(data));
}

export async function createNip98AuthorizationHeader(
  url: string,
  method: string,
  payloadHashBase64?: string
): Promise<string> {
  const authEvent = {
    kind: 27235,
    content: "",
    tags: [
      ["u", url],
      ["method", method.toUpperCase()],
    ],
    created_at: Math.floor(Date.now() / 1000),
    pubkey: "",
    id: "",
    sig: "",
  } as NostrEventType;

  if (payloadHashBase64) {
    authEvent.tags.push(["payload", payloadHashBase64]);
  }

  const signedEvent = await signEvent(authEvent);
  return `Nostr ${bytesToBase64(new TextEncoder().encode(JSON.stringify(signedEvent)))}`;
}
