import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyEventSignature } from "../src/lib/nostr/event";
import {
  activateNsecSigner,
  clearActiveSigner,
  createSecretKeySigner,
  decryptNip04,
  decryptNip44,
  encryptNip04,
  encryptNip44,
  getPublicKey,
  hasNip04,
  hasNip44,
  signEvent,
} from "../src/lib/nostr/signer";

const SECRET_KEY_1 = "0000000000000000000000000000000000000000000000000000000000000001";
const SECRET_KEY_2 = "0000000000000000000000000000000000000000000000000000000000000002";
const NIP44_VECTOR_NONCE = new Uint8Array(32);
const NIP44_VECTOR_PAYLOAD = "AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABee0G5VSK0/9YypIObAtDKfYEAjD35uVkHyB0F4DwrcNaCXlCWZKaArsGrY6M9wnuTMxWfp1RTN9Xga8no+kF5Vsb";

NIP44_VECTOR_NONCE[31] = 1;

beforeEach(() => {
  clearActiveSigner();
});

afterEach(() => {
  clearActiveSigner();
});

describe("secret key signer", () => {
  it("signs events with a locally managed secret key", async () => {
    const signer = createSecretKeySigner(SECRET_KEY_1);
    const pubkey = await signer.getPublicKey();
    const signedEvent = await signer.signEvent({
      kind: 1,
      content: "hello from nsec",
      tags: [],
      created_at: 123,
      pubkey: "",
      id: "",
      sig: "",
    });

    expect(signedEvent.pubkey).toBe(pubkey);
    expect(verifyEventSignature(signedEvent)).toBe(true);
  });

  it("round-trips NIP-04 payloads without a browser extension", async () => {
    const alice = createSecretKeySigner(SECRET_KEY_1);
    const bob = createSecretKeySigner(SECRET_KEY_2);
    const alicePubkey = await alice.getPublicKey();
    const bobPubkey = await bob.getPublicKey();

    const ciphertext = await alice.nip04!.encrypt(bobPubkey, "hello nip04");

    expect(await alice.nip04!.decrypt(bobPubkey, ciphertext)).toBe("hello nip04");
    expect(await bob.nip04!.decrypt(alicePubkey, ciphertext)).toBe("hello nip04");
  });

  it("matches the published NIP-44 v2 test vector", async () => {
    const alice = createSecretKeySigner(SECRET_KEY_1, {
      randomBytes(length) {
        expect(length).toBe(32);
        return NIP44_VECTOR_NONCE;
      },
    });
    const bob = createSecretKeySigner(SECRET_KEY_2);
    const alicePubkey = await alice.getPublicKey();
    const bobPubkey = await bob.getPublicKey();

    const payload = await alice.nip44!.encrypt(bobPubkey, "a");

    expect(payload).toBe(NIP44_VECTOR_PAYLOAD);
    expect(await bob.nip44!.decrypt(alicePubkey, payload)).toBe("a");
  });

  it("routes active signer helpers through the nsec implementation", async () => {
    const pubkey = await activateNsecSigner(SECRET_KEY_1);
    const peer = createSecretKeySigner(SECRET_KEY_2);
    const peerPubkey = await peer.getPublicKey();

    expect(await getPublicKey()).toBe(pubkey);
    expect(hasNip04()).toBe(true);
    expect(hasNip44()).toBe(true);

    const signedEvent = await signEvent({
      kind: 1,
      content: "hello through active signer",
      tags: [],
      created_at: 456,
      pubkey: "",
      id: "",
      sig: "",
    });
    expect(verifyEventSignature(signedEvent)).toBe(true);

    const ciphertext4 = await encryptNip04(peerPubkey, "hello active nip04");
    expect(ciphertext4).not.toBeNull();
    expect(await decryptNip04(peerPubkey, ciphertext4!)).toBe("hello active nip04");
    expect(await peer.nip04!.decrypt(pubkey, ciphertext4!)).toBe("hello active nip04");

    const ciphertext44 = await encryptNip44(peerPubkey, "hello active nip44");
    expect(ciphertext44).not.toBeNull();
    expect(await decryptNip44(peerPubkey, ciphertext44!)).toBe("hello active nip44");
    expect(await peer.nip44!.decrypt(pubkey, ciphertext44!)).toBe("hello active nip44");
  });
});
