import type { Nip07 } from "nostr-typedef";

function getNostr(): Nip07.Nostr | null {
  if (typeof window === "undefined" || !("nostr" in window)) {
    return null;
  }
  return (window as typeof window & { nostr?: Nip07.Nostr }).nostr ?? null;
}

export function getNip07(): Nip07.Nostr | null {
  return getNostr();
}

export async function getPublicKey(): Promise<string> {
  return (await getNostr()?.getPublicKey()) ?? "";
}

export async function signEvent<T>(event: T): Promise<T> {
  const nostr = getNostr();
  if (!nostr) {
    throw new Error("NIP-07 is not available");
  }
  return await nostr.signEvent(event as never) as T;
}

export async function getRelays() {
  return (await getNostr()?.getRelays?.()) ?? {};
}

export function hasNip04(): boolean {
  return !!getNostr()?.nip04;
}

export async function encryptNip04(pubkey: string, plaintext: string): Promise<string | null> {
  const nip04 = getNostr()?.nip04;
  if (!nip04?.encrypt) {
    return null;
  }
  return await nip04.encrypt(pubkey, plaintext);
}

export async function decryptNip04(pubkey: string, ciphertext: string): Promise<string | null> {
  const nip04 = getNostr()?.nip04;
  if (!nip04) {
    return null;
  }
  return await nip04.decrypt(pubkey, ciphertext);
}

export function hasNip44(): boolean {
  return !!(getNostr() as any)?.nip44;
}

export async function encryptNip44(pubkey: string, plaintext: string): Promise<string | null> {
  const nip44 = (getNostr() as any)?.nip44;
  if (!nip44?.encrypt) {
    return null;
  }
  return await nip44.encrypt(pubkey, plaintext);
}

export async function decryptNip44(pubkey: string, ciphertext: string): Promise<string | null> {
  const nip44 = (getNostr() as any)?.nip44;
  if (!nip44) {
    return null;
  }
  return await nip44.decrypt(pubkey, ciphertext);
}
