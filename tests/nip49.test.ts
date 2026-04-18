import { describe, expect, it } from "vitest";

import { decryptSecretKeyWithNip49, encryptSecretKeyWithNip49 } from "../src/lib/nostr/nip49";

const SECRET_KEY = "0000000000000000000000000000000000000000000000000000000000000001";
const NIP49_VECTOR =
  "ncryptsec1qgg9947rlpvqu76pj5ecreduf9jxhselq2nae2kghhvd5g7dgjtcxfqtd67p9m0w57lspw8gsq6yphnm8623nsl8xn9j4jdzz84zm3frztj3z7s35vpzmqf6ksu8r89qk5z2zxfmu5gv8th8wclt0h4p";
const NIP49_VECTOR_SECRET = "3501454135014541350145413501453fefb02227e449e57cf4d3a3ce05378683";

describe("NIP-49 secret key encryption", () => {
  it("round-trips a secret key with a password", async () => {
    const encrypted = await encryptSecretKeyWithNip49(SECRET_KEY, "correct horse battery staple");
    const decrypted = await decryptSecretKeyWithNip49(encrypted, "correct horse battery staple");

    expect(encrypted.startsWith("ncryptsec1")).toBe(true);
    expect(decrypted).toBe(SECRET_KEY);
  });

  it("decrypts the published NIP-49 test vector", async () => {
    await expect(decryptSecretKeyWithNip49(NIP49_VECTOR, "nostr")).resolves.toBe(NIP49_VECTOR_SECRET);
  });

  it("rejects an invalid password", async () => {
    const encrypted = await encryptSecretKeyWithNip49(SECRET_KEY, "right password");

    await expect(decryptSecretKeyWithNip49(encrypted, "wrong password")).rejects.toThrow(
      "NIP-49 の復号に失敗しました。パスワードを確認してください"
    );
  });
});
