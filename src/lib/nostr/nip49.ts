import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { bech32 } from "@scure/base";

const BECH32_MAX_SIZE = 5000;
const NCRYPTSEC_PREFIX = "ncryptsec";
const NIP49_VERSION = 0x02;
const NIP49_DEFAULT_LOG_N = 16;
const NIP49_MIN_LOG_N = 16;
const NIP49_MAX_LOG_N = 22;
const NIP49_SALT_LENGTH = 16;
const NIP49_NONCE_LENGTH = 24;
const NIP49_PRIVATE_KEY_LENGTH = 32;
const NIP49_CIPHERTEXT_LENGTH = 48;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("秘密鍵の形式が不正です");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
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

function getRandomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function normalizePassword(password: string): string {
  return password.normalize("NFKC");
}

async function deriveSymmetricKey(password: string, salt: Uint8Array, logN: number): Promise<Uint8Array> {
  return await scryptAsync(normalizePassword(password), salt, {
    N: 2 ** logN,
    r: 8,
    p: 1,
    dkLen: 32,
  });
}

function validateLogN(logN: number): void {
  if (!Number.isInteger(logN) || logN < NIP49_MIN_LOG_N || logN > NIP49_MAX_LOG_N) {
    throw new Error(`NIP-49 の log_n は ${NIP49_MIN_LOG_N} から ${NIP49_MAX_LOG_N} の範囲で指定してください`);
  }
}

export async function encryptSecretKeyWithNip49(
  secretHex: string,
  password: string,
  options?: {
    logN?: number;
    keySecurityByte?: 0 | 1 | 2;
    randomBytes?: (length: number) => Uint8Array;
  }
): Promise<string> {
  const logN = options?.logN ?? NIP49_DEFAULT_LOG_N;
  const keySecurityByte = options?.keySecurityByte ?? 0x02;
  const randomBytes = options?.randomBytes ?? getRandomBytes;

  validateLogN(logN);

  const secretBytes = hexToBytes(secretHex.toLowerCase());
  const salt = randomBytes(NIP49_SALT_LENGTH);
  const nonce = randomBytes(NIP49_NONCE_LENGTH);
  const associatedData = new Uint8Array([keySecurityByte]);
  const symmetricKey = await deriveSymmetricKey(password, salt, logN);

  try {
    const ciphertext = xchacha20poly1305(symmetricKey, nonce, associatedData).encrypt(secretBytes);
    const payload = concatBytes(
      new Uint8Array([NIP49_VERSION, logN]),
      salt,
      nonce,
      associatedData,
      ciphertext
    );

    return bech32.encode(NCRYPTSEC_PREFIX, bech32.toWords(payload), BECH32_MAX_SIZE);
  } finally {
    secretBytes.fill(0);
    symmetricKey.fill(0);
  }
}

export async function decryptSecretKeyWithNip49(ncryptsec: string, password: string): Promise<string> {
  const decoded = bech32.decode(ncryptsec as `${string}1${string}`, BECH32_MAX_SIZE);
  if (decoded.prefix !== NCRYPTSEC_PREFIX) {
    throw new Error("NIP-49 の暗号化秘密鍵ではありません");
  }

  const payload = new Uint8Array(bech32.fromWords(decoded.words));
  const expectedLength = 1 + 1 + NIP49_SALT_LENGTH + NIP49_NONCE_LENGTH + 1 + NIP49_CIPHERTEXT_LENGTH;
  if (payload.length !== expectedLength) {
    throw new Error("NIP-49 の暗号化秘密鍵が壊れています");
  }

  const version = payload[0];
  if (version !== NIP49_VERSION) {
    throw new Error(`未対応の NIP-49 バージョンです: ${version}`);
  }

  const logN = payload[1];
  validateLogN(logN);
  const saltOffset = 2;
  const nonceOffset = saltOffset + NIP49_SALT_LENGTH;
  const associatedDataOffset = nonceOffset + NIP49_NONCE_LENGTH;
  const ciphertextOffset = associatedDataOffset + 1;

  const salt = payload.slice(saltOffset, nonceOffset);
  const nonce = payload.slice(nonceOffset, associatedDataOffset);
  const associatedData = payload.slice(associatedDataOffset, ciphertextOffset);
  const ciphertext = payload.slice(ciphertextOffset);
  const symmetricKey = await deriveSymmetricKey(password, salt, logN);

  try {
    const secretKey = xchacha20poly1305(symmetricKey, nonce, associatedData).decrypt(ciphertext);
    if (secretKey.length !== NIP49_PRIVATE_KEY_LENGTH) {
      throw new Error("NIP-49 の復号結果が不正です");
    }

    return bytesToHex(secretKey);
  } catch (_error) {
    throw new Error("NIP-49 の復号に失敗しました。パスワードを確認してください");
  } finally {
    symmetricKey.fill(0);
  }
}
