import { bech32 } from "@scure/base";

const BECH32_MAX_SIZE = 5000;
const utf8Decoder = new TextDecoder("utf-8");

type Nip19DecodeResult =
  | { type: "npub"; data: string }
  | { type: "nsec"; data: string }
  | { type: "note"; data: string }
  | { type: "nprofile"; data: { pubkey: string; relays: string[] } }
  | { type: "nevent"; data: { id: string; relays: string[]; author?: string; kind?: number } };

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("hex string must have an even length");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("invalid hex string");
    }
    bytes[i] = byte;
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeBytes(prefix: string, hex: string): string {
  return bech32.encode(prefix, bech32.toWords(hexToBytes(hex)), BECH32_MAX_SIZE);
}

function parseTlv(data: Uint8Array): Record<number, Uint8Array[]> {
  const result: Record<number, Uint8Array[]> = {};
  let offset = 0;

  while (offset < data.length) {
    const type = data[offset];
    const length = data[offset + 1];
    if (length === undefined) {
      throw new Error(`malformed TLV ${type}`);
    }

    const value = data.slice(offset + 2, offset + 2 + length);
    if (value.length < length) {
      throw new Error(`not enough data to read TLV ${type}`);
    }

    result[type] ||= [];
    result[type].push(value);
    offset += length + 2;
  }

  return result;
}

function parseUint32(bytes: Uint8Array): number {
  if (bytes.length !== 4) {
    throw new Error("kind TLV should be 4 bytes");
  }

  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
}

export function encodeNpub(pubkey: string): string {
  return encodeBytes("npub", pubkey);
}

export function encodeNote(id: string): string {
  return encodeBytes("note", id);
}

export function decodeNip19(value: string): Nip19DecodeResult {
  const { prefix, words } = bech32.decode(value as `${string}1${string}`, BECH32_MAX_SIZE);
  const data = new Uint8Array(bech32.fromWords(words));

  switch (prefix) {
    case "nsec":
    case "npub":
    case "note":
      return { type: prefix, data: bytesToHex(data) };
    case "nprofile": {
      const tlv = parseTlv(data);
      const pubkey = tlv[0]?.[0];
      if (!pubkey) {
        throw new Error("missing TLV 0 for nprofile");
      }

      return {
        type: "nprofile",
        data: {
          pubkey: bytesToHex(pubkey),
          relays: tlv[1] ? tlv[1].map((entry) => utf8Decoder.decode(entry)) : [],
        },
      };
    }
    case "nevent": {
      const tlv = parseTlv(data);
      const id = tlv[0]?.[0];
      if (!id) {
        throw new Error("missing TLV 0 for nevent");
      }

      return {
        type: "nevent",
        data: {
          id: bytesToHex(id),
          relays: tlv[1] ? tlv[1].map((entry) => utf8Decoder.decode(entry)) : [],
          author: tlv[2]?.[0] ? bytesToHex(tlv[2][0]) : undefined,
          kind: tlv[3]?.[0] ? parseUint32(tlv[3][0]) : undefined,
        },
      };
    }
    default:
      throw new Error(`unsupported NIP-19 prefix: ${prefix}`);
  }
}
