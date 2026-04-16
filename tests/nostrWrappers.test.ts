import { bech32 } from '@scure/base';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { schnorr } from '@noble/curves/secp256k1.js';

import { decodeNip19, encodeNote, encodeNpub } from '../src/lib/nostr/encode';
import { getEventHash, parseNip10, verifyEventSignature } from '../src/lib/nostr/event';
import { relayStateToLegacyStatus as relayStateToLegacyStatusFromPool, resolveRelayStatus as resolveRelayStatusFromPool } from '../src/lib/nostr/relayPool';
import {
  decryptNip04,
  decryptNip44,
  getPublicKey,
  getRelays,
  hasNip04,
  hasNip44,
  signEvent,
} from '../src/lib/nostr/nip07';

const utf8Encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function encodeTlvBech32(prefix: string, entries: Array<[number, Uint8Array]>): string {
  const chunks = entries.map(([type, value]) => {
    const entry = new Uint8Array(value.length + 2);
    entry[0] = type;
    entry[1] = value.length;
    entry.set(value, 2);
    return entry;
  });
  const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return bech32.encode(prefix, bech32.toWords(merged), 5000);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('nostr wrappers', () => {
  it('encodes and decodes npub and note via wrapper', () => {
    const pubkey = 'f'.repeat(64);
    const noteId = 'e'.repeat(64);

    const npub = encodeNpub(pubkey);
    const note = encodeNote(noteId);

    expect(decodeNip19(npub)).toEqual({ type: 'npub', data: pubkey });
    expect(decodeNip19(note)).toEqual({ type: 'note', data: noteId });
  });

  it('decodes nprofile and nevent via wrapper', () => {
    const pubkey = 'f'.repeat(64);
    const eventId = 'e'.repeat(64);
    const relay = 'wss://relay.example.com';
    const author = 'a'.repeat(64);
    const kindBytes = new Uint8Array([0, 0, 0, 1]);

    const nprofile = encodeTlvBech32('nprofile', [
      [0, hexToBytes(pubkey)],
      [1, utf8Encoder.encode(relay)],
    ]);
    const nevent = encodeTlvBech32('nevent', [
      [0, hexToBytes(eventId)],
      [1, utf8Encoder.encode(relay)],
      [2, hexToBytes(author)],
      [3, kindBytes],
    ]);

    expect(decodeNip19(nprofile)).toEqual({
      type: 'nprofile',
      data: {
        pubkey,
        relays: [relay],
      },
    });

    expect(decodeNip19(nevent)).toEqual({
      type: 'nevent',
      data: {
        id: eventId,
        relays: [relay],
        author,
        kind: 1,
      },
    });
  });

  it('maps rx-nostr connection states to the legacy relay status UI', () => {
    expect(relayStateToLegacyStatusFromPool('initialized')).toBe(0);
    expect(relayStateToLegacyStatusFromPool('connecting')).toBe(0);
    expect(relayStateToLegacyStatusFromPool('waiting-for-retrying')).toBe(0);
    expect(relayStateToLegacyStatusFromPool('retrying')).toBe(0);
    expect(relayStateToLegacyStatusFromPool('connected')).toBe(1);
    expect(relayStateToLegacyStatusFromPool('dormant')).toBe(2);
    expect(relayStateToLegacyStatusFromPool('error')).toBe(3);
    expect(relayStateToLegacyStatusFromPool('rejected')).toBe(3);
    expect(relayStateToLegacyStatusFromPool('terminated')).toBe(3);
  });

  it('treats response timeouts and transport failures as no signal', () => {
    expect(resolveRelayStatusFromPool('connected', 'timeout')).toBe(3);
    expect(resolveRelayStatusFromPool('dormant', 'timeout')).toBe(3);
    expect(resolveRelayStatusFromPool('error', 'timeout')).toBe(3);
    expect(resolveRelayStatusFromPool('connected', 'transport-error')).toBe(3);
    expect(resolveRelayStatusFromPool('dormant', 'transport-error')).toBe(3);
    expect(resolveRelayStatusFromPool('error', 'transport-error')).toBe(3);
    expect(resolveRelayStatusFromPool('connected')).toBe(1);
  });


  it('hashes, verifies, and parses reply tags without nostr-tools', () => {
    const secretKey = new Uint8Array(32).fill(7);
    const pubkey = Array.from(schnorr.getPublicKey(secretKey), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const event = {
      kind: 1,
      content: 'hello',
      tags: [
        ['e', '11'.repeat(32), '', 'root'],
        ['e', '22'.repeat(32), '', 'reply'],
        ['e', '33'.repeat(32)],
        ['p', '44'.repeat(32)],
      ],
      created_at: 123,
      pubkey,
      id: '',
      sig: '',
    };

    event.id = getEventHash(event);
    event.sig = Array.from(schnorr.sign(hexToBytes(event.id), secretKey), (byte) => byte.toString(16).padStart(2, '0')).join('');

    expect(verifyEventSignature(event)).toBe(true);
    expect(parseNip10(event)).toEqual({
      root: { id: '11'.repeat(32) },
      reply: { id: '22'.repeat(32) },
      mentions: [{ id: '33'.repeat(32) }],
      profiles: [{ pubkey: '44'.repeat(32) }],
    });
  });

  it('returns safe defaults when NIP-07 is unavailable', async () => {
    vi.stubGlobal('window', {});

    expect(await getPublicKey()).toBe('');
    expect(await getRelays()).toEqual({});
    expect(hasNip04()).toBe(false);
    expect(hasNip44()).toBe(false);
    expect(await decryptNip04('pubkey', 'cipher')).toBeNull();
    expect(await decryptNip44('pubkey', 'cipher')).toBeNull();
    await expect(signEvent({ foo: 'bar' })).rejects.toThrow('NIP-07 is not available');
  });

  it('proxies NIP-07 methods through the wrapper', async () => {
    const signEventMock = vi.fn(async (event) => ({ ...event, id: 'signed' }));
    const getPublicKeyMock = vi.fn(async () => 'pubkey');
    const getRelaysMock = vi.fn(async () => ({ 'wss://relay.example.com': { read: true, write: true } }));
    const nip04DecryptMock = vi.fn(async () => 'plain4');
    const nip44DecryptMock = vi.fn(async () => 'plain44');

    vi.stubGlobal('window', {
      nostr: {
        getPublicKey: getPublicKeyMock,
        signEvent: signEventMock,
        getRelays: getRelaysMock,
        nip04: { decrypt: nip04DecryptMock },
        nip44: { decrypt: nip44DecryptMock },
      },
    });

    expect(await getPublicKey()).toBe('pubkey');
    expect(await getRelays()).toEqual({ 'wss://relay.example.com': { read: true, write: true } });
    expect(hasNip04()).toBe(true);
    expect(hasNip44()).toBe(true);
    expect(await decryptNip04('pubkey', 'cipher')).toBe('plain4');
    expect(await decryptNip44('pubkey', 'cipher')).toBe('plain44');
    expect(await signEvent({ kind: 1 })).toEqual({ kind: 1, id: 'signed' });
  });
});
