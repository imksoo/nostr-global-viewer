import { secp256k1, schnorr } from "@noble/curves/secp256k1.js";
import { chacha20 } from "@noble/ciphers/chacha.js";
import { hmac } from "@noble/hashes/hmac.js";
import { expand, extract } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { decodeNip19 } from "./encode";
import { getEventHash, type Event as NostrEventType } from "./event";
import {
  decryptNip04 as decryptNip04ViaNip07,
  decryptNip44 as decryptNip44ViaNip07,
  encryptNip04 as encryptNip04ViaNip07,
  encryptNip44 as encryptNip44ViaNip07,
  getNip07,
  getPublicKey as getPublicKeyViaNip07,
  getRelays as getRelaysViaNip07,
  signEvent as signEventViaNip07,
} from "./nip07";

type RelayPolicy = { read?: boolean; write?: boolean };
export type RelayMap = Record<string, RelayPolicy>;
export type SignerLoginMethod = "nip07" | "nsec";

interface NostrCipher {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

interface NostrSigner {
  type: SignerLoginMethod;
  getPublicKey(): Promise<string>;
  getRelays(): Promise<RelayMap>;
  signEvent<T extends NostrEventType>(event: T): Promise<T>;
  nip04?: NostrCipher;
  nip44?: NostrCipher;
}

interface SecretKeySignerOptions {
  randomBytes?: (length: number) => Uint8Array;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();
const NIP44_V2_SALT = utf8Encoder.encode("nip44-v2");

let activeSigner: NostrSigner | null = null;

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

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function base64Decode(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    merged.set(array, offset);
    offset += array.length;
  }
  return merged;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getRandomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function requireCryptoSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available");
  }
  return subtle;
}

function normalizePeerPublicKey(pubkey: string): string {
  const normalized = pubkey.trim().toLowerCase();
  if (/^(02|03)[0-9a-f]{64}$/.test(normalized)) {
    return normalized;
  }
  if (/^[0-9a-f]{64}$/.test(normalized)) {
    return `02${normalized}`;
  }
  throw new Error("invalid public key");
}

export function parseSecretKeyInput(secretInput: string): string {
  const normalized = secretInput.trim().replace(/^nostr:/i, "");
  if (!normalized) {
    throw new Error("秘密鍵を入力してください");
  }

  let secretHex = normalized.toLowerCase();
  if (secretHex.startsWith("nsec1")) {
    const decoded = decodeNip19(secretHex);
    if (decoded.type !== "nsec") {
      throw new Error("nsec を入力してください");
    }
    secretHex = decoded.data;
  }

  if (!/^[0-9a-f]{64}$/.test(secretHex)) {
    throw new Error("秘密鍵の形式が不正です");
  }

  const secretBytes = hexToBytes(secretHex);
  if (!secp256k1.utils.isValidSecretKey(secretBytes)) {
    throw new Error("秘密鍵が secp256k1 の範囲外です");
  }

  return secretHex;
}

async function importAesKey(rawKey: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return await requireCryptoSubtle().importKey("raw", toArrayBuffer(rawKey), { name: "AES-CBC" }, false, usages);
}

function getNip04SharedSecret(secretKey: Uint8Array, peerPubkey: string): Uint8Array {
  return secp256k1.getSharedSecret(secretKey, hexToBytes(normalizePeerPublicKey(peerPubkey)), true).slice(1, 33);
}

function splitNip04Payload(payload: string): { ciphertext: Uint8Array; iv: Uint8Array } {
  const [ciphertextBase64, ivPart] = payload.split("?iv=");
  if (!ciphertextBase64 || !ivPart) {
    throw new Error("invalid NIP-04 payload");
  }

  const ciphertext = base64Decode(ciphertextBase64);
  const iv = base64Decode(ivPart);
  if (iv.length !== 16) {
    throw new Error("invalid NIP-04 IV length");
  }

  return { ciphertext, iv };
}

async function encryptNip04WithSecretKey(secretKey: Uint8Array, peerPubkey: string, plaintext: string): Promise<string> {
  const sharedSecret = getNip04SharedSecret(secretKey, peerPubkey);
  const iv = getRandomBytes(16);
  const key = await importAesKey(sharedSecret, ["encrypt"]);
  const ciphertext = await requireCryptoSubtle().encrypt(
    { name: "AES-CBC", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(utf8Encoder.encode(plaintext))
  );

  return `${base64Encode(new Uint8Array(ciphertext))}?iv=${base64Encode(iv)}`;
}

async function decryptNip04WithSecretKey(secretKey: Uint8Array, peerPubkey: string, payload: string): Promise<string> {
  const sharedSecret = getNip04SharedSecret(secretKey, peerPubkey);
  const { ciphertext, iv } = splitNip04Payload(payload);
  const key = await importAesKey(sharedSecret, ["decrypt"]);
  const plaintext = await requireCryptoSubtle().decrypt(
    { name: "AES-CBC", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext)
  );

  return utf8Decoder.decode(new Uint8Array(plaintext));
}

function getConversationKey(secretKey: Uint8Array, peerPubkey: string): Uint8Array {
  const sharedSecret = secp256k1.getSharedSecret(secretKey, hexToBytes(normalizePeerPublicKey(peerPubkey)), true).slice(1, 33);
  return extract(sha256, sharedSecret, NIP44_V2_SALT);
}

function getNip44MessageKeys(conversationKey: Uint8Array, nonce: Uint8Array): {
  chachaKey: Uint8Array;
  chachaNonce: Uint8Array;
  hmacKey: Uint8Array;
} {
  if (conversationKey.length !== 32) {
    throw new Error("invalid conversation key length");
  }
  if (nonce.length !== 32) {
    throw new Error("invalid nonce length");
  }

  const keys = expand(sha256, conversationKey, nonce, 76);
  return {
    chachaKey: keys.slice(0, 32),
    chachaNonce: keys.slice(32, 44),
    hmacKey: keys.slice(44, 76),
  };
}

function calcNip44PaddedLength(unpaddedLength: number): number {
  if (unpaddedLength <= 32) {
    return 32;
  }

  const nextPower = 1 << (Math.floor(Math.log2(unpaddedLength - 1)) + 1);
  const chunk = nextPower <= 256 ? 32 : nextPower / 8;
  return chunk * (Math.floor((unpaddedLength - 1) / chunk) + 1);
}

function padNip44Plaintext(plaintext: string): Uint8Array {
  const unpadded = utf8Encoder.encode(plaintext);
  const unpaddedLength = unpadded.length;
  if (unpaddedLength < 1 || unpaddedLength > 0xffff) {
    throw new Error("invalid plaintext length");
  }

  const padded = new Uint8Array(2 + calcNip44PaddedLength(unpaddedLength));
  new DataView(padded.buffer).setUint16(0, unpaddedLength, false);
  padded.set(unpadded, 2);
  return padded;
}

function unpadNip44Plaintext(padded: Uint8Array): string {
  if (padded.length < 34) {
    throw new Error("invalid padded plaintext length");
  }

  const unpaddedLength = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint16(0, false);
  const expectedLength = 2 + calcNip44PaddedLength(unpaddedLength);
  if (unpaddedLength < 1 || expectedLength !== padded.length) {
    throw new Error("invalid padding");
  }

  const suffix = padded.slice(2 + unpaddedLength);
  if (suffix.some((byte) => byte !== 0)) {
    throw new Error("invalid padding bytes");
  }

  return utf8Decoder.decode(padded.slice(2, 2 + unpaddedLength));
}

function decodeNip44Payload(payload: string): { nonce: Uint8Array; ciphertext: Uint8Array; mac: Uint8Array } {
  if (!payload || payload[0] === "#") {
    throw new Error("unknown encryption version");
  }
  if (payload.length < 132 || payload.length > 87472) {
    throw new Error("invalid payload size");
  }

  const data = base64Decode(payload);
  if (data.length < 99 || data.length > 65603) {
    throw new Error("invalid data size");
  }
  if (data[0] !== 2) {
    throw new Error(`unknown encryption version ${data[0]}`);
  }

  return {
    nonce: data.slice(1, 33),
    ciphertext: data.slice(33, data.length - 32),
    mac: data.slice(data.length - 32),
  };
}

function createNip44Mac(hmacKey: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  if (nonce.length !== 32) {
    throw new Error("invalid nonce length");
  }
  return hmac(sha256, hmacKey, concatBytes(nonce, ciphertext));
}

async function encryptNip44WithSecretKey(
  secretKey: Uint8Array,
  peerPubkey: string,
  plaintext: string,
  randomBytes: (length: number) => Uint8Array
): Promise<string> {
  const conversationKey = getConversationKey(secretKey, peerPubkey);
  const nonce = randomBytes(32);
  const { chachaKey, chachaNonce, hmacKey } = getNip44MessageKeys(conversationKey, nonce);
  const padded = padNip44Plaintext(plaintext);
  const ciphertext = chacha20(chachaKey, chachaNonce, padded);
  const mac = createNip44Mac(hmacKey, nonce, ciphertext);

  return base64Encode(concatBytes(new Uint8Array([2]), nonce, ciphertext, mac));
}

async function decryptNip44WithSecretKey(secretKey: Uint8Array, peerPubkey: string, payload: string): Promise<string> {
  const { nonce, ciphertext, mac } = decodeNip44Payload(payload);
  const conversationKey = getConversationKey(secretKey, peerPubkey);
  const { chachaKey, chachaNonce, hmacKey } = getNip44MessageKeys(conversationKey, nonce);
  const expectedMac = createNip44Mac(hmacKey, nonce, ciphertext);
  if (!constantTimeEqual(expectedMac, mac)) {
    throw new Error("invalid MAC");
  }

  const padded = chacha20(chachaKey, chachaNonce, ciphertext);
  return unpadNip44Plaintext(padded);
}

function createNip07Signer(): NostrSigner {
  if (!getNip07()) {
    throw new Error("NIP-07 is not available");
  }

  return {
    type: "nip07",
    getPublicKey: getPublicKeyViaNip07,
    getRelays: getRelaysViaNip07,
    signEvent: signEventViaNip07,
    nip04: {
      async encrypt(pubkey: string, plaintext: string) {
        const payload = await encryptNip04ViaNip07(pubkey, plaintext);
        if (!payload) {
          throw new Error("NIP-04 encrypt is not available");
        }
        return payload;
      },
      async decrypt(pubkey: string, ciphertext: string) {
        const plaintext = await decryptNip04ViaNip07(pubkey, ciphertext);
        if (plaintext == null) {
          throw new Error("NIP-04 decrypt is not available");
        }
        return plaintext;
      },
    },
    nip44: {
      async encrypt(pubkey: string, plaintext: string) {
        const payload = await encryptNip44ViaNip07(pubkey, plaintext);
        if (!payload) {
          throw new Error("NIP-44 encrypt is not available");
        }
        return payload;
      },
      async decrypt(pubkey: string, ciphertext: string) {
        const plaintext = await decryptNip44ViaNip07(pubkey, ciphertext);
        if (plaintext == null) {
          throw new Error("NIP-44 decrypt is not available");
        }
        return plaintext;
      },
    },
  };
}

export function createSecretKeySigner(
  secretInput: string,
  options: SecretKeySignerOptions = {}
): NostrSigner {
  const secretHex = parseSecretKeyInput(secretInput);
  const secretKey = hexToBytes(secretHex);
  const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
  const randomBytes = options.randomBytes ?? getRandomBytes;

  return {
    type: "nsec",
    async getPublicKey() {
      return pubkey;
    },
    async getRelays() {
      return {};
    },
    async signEvent<T extends NostrEventType>(event: T): Promise<T> {
      const signedEvent = JSON.parse(JSON.stringify(event)) as T;
      signedEvent.pubkey = pubkey;
      signedEvent.id = getEventHash(signedEvent);
      signedEvent.sig = bytesToHex(schnorr.sign(hexToBytes(signedEvent.id), secretKey));
      return signedEvent;
    },
    nip04: {
      async encrypt(peerPubkey: string, plaintext: string) {
        return await encryptNip04WithSecretKey(secretKey, peerPubkey, plaintext);
      },
      async decrypt(peerPubkey: string, ciphertext: string) {
        return await decryptNip04WithSecretKey(secretKey, peerPubkey, ciphertext);
      },
    },
    nip44: {
      async encrypt(peerPubkey: string, plaintext: string) {
        return await encryptNip44WithSecretKey(secretKey, peerPubkey, plaintext, randomBytes);
      },
      async decrypt(peerPubkey: string, ciphertext: string) {
        return await decryptNip44WithSecretKey(secretKey, peerPubkey, ciphertext);
      },
    },
  };
}

function getActiveSigner(): NostrSigner | null {
  return activeSigner;
}

export function isNip07Available(): boolean {
  return !!getNip07();
}

export function getActiveSignerType(): SignerLoginMethod | null {
  return getActiveSigner()?.type ?? null;
}

export function clearActiveSigner(): void {
  activeSigner = null;
}

export async function activateNip07Signer(): Promise<string> {
  activeSigner = createNip07Signer();
  return await activeSigner.getPublicKey();
}

export async function activateNsecSigner(secretInput: string): Promise<string> {
  activeSigner = createSecretKeySigner(secretInput);
  return await activeSigner.getPublicKey();
}

export async function getPublicKey(): Promise<string> {
  return (await getActiveSigner()?.getPublicKey()) ?? "";
}

export async function getRelays(): Promise<RelayMap> {
  return (await getActiveSigner()?.getRelays()) ?? {};
}

export async function signEvent<T extends NostrEventType>(event: T): Promise<T> {
  const signer = getActiveSigner();
  if (!signer) {
    throw new Error("No active signer");
  }
  return await signer.signEvent(event);
}

export function hasNip04(): boolean {
  return !!getActiveSigner()?.nip04;
}

export async function encryptNip04(pubkey: string, plaintext: string): Promise<string | null> {
  const signer = getActiveSigner();
  if (!signer?.nip04) {
    return null;
  }
  return await signer.nip04.encrypt(pubkey, plaintext);
}

export async function decryptNip04(pubkey: string, ciphertext: string): Promise<string | null> {
  const signer = getActiveSigner();
  if (!signer?.nip04) {
    return null;
  }
  return await signer.nip04.decrypt(pubkey, ciphertext);
}

export function hasNip44(): boolean {
  return !!getActiveSigner()?.nip44;
}

export async function encryptNip44(pubkey: string, plaintext: string): Promise<string | null> {
  const signer = getActiveSigner();
  if (!signer?.nip44) {
    return null;
  }
  return await signer.nip44.encrypt(pubkey, plaintext);
}

export async function decryptNip44(pubkey: string, ciphertext: string): Promise<string | null> {
  const signer = getActiveSigner();
  if (!signer?.nip44) {
    return null;
  }
  return await signer.nip44.decrypt(pubkey, ciphertext);
}
