import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { verifyEventSignature } from "../src/lib/nostr/event";
import { createNip98AuthorizationHeader } from "../src/lib/nostr/nip98";
import { extractMediaUrl } from "../src/lib/nostr/nostpic";
import { activateNsecSigner, clearActiveSigner } from "../src/lib/nostr/signer";

const SECRET_KEY = "0000000000000000000000000000000000000000000000000000000000000001";

function decodeNostrAuthorizationEvent(header: string) {
  const [, encoded] = header.split(" ");
  const json = Buffer.from(encoded, "base64").toString("utf-8");
  return JSON.parse(json);
}

describe("NIP-98 auth helpers", () => {
  it("creates a signed authorization header for HTTP auth", async () => {
    await activateNsecSigner(SECRET_KEY);

    const header = await createNip98AuthorizationHeader(
      "https://nostpic.com/api/v2/media",
      "post",
      "payload-hash-base64"
    );
    const authEvent = decodeNostrAuthorizationEvent(header);

    expect(header.startsWith("Nostr ")).toBe(true);
    expect(authEvent.kind).toBe(27235);
    expect(authEvent.content).toBe("");
    expect(authEvent.tags).toContainEqual(["u", "https://nostpic.com/api/v2/media"]);
    expect(authEvent.tags).toContainEqual(["method", "POST"]);
    expect(authEvent.tags).toContainEqual(["payload", "payload-hash-base64"]);
    expect(verifyEventSignature(authEvent)).toBe(true);

    clearActiveSigner();
  });

  it("extracts the uploaded media URL from nostpic responses", () => {
    expect(extractMediaUrl({
      url: "https://nostpic.com/media/direct.png",
    })).toBe("https://nostpic.com/media/direct.png");

    expect(extractMediaUrl({
      nip94_event: {
        tags: [
          ["m", "image/png"],
          ["url", "https://nostpic.com/media/from-tag.png"],
        ],
      },
    })).toBe("https://nostpic.com/media/from-tag.png");
  });
});
