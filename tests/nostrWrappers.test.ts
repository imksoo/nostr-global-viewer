import { afterEach, describe, expect, it, vi } from 'vitest';

import { decodeNip19, encodeNote, encodeNpub } from '../src/lib/nostr/encode';
import { relayStateToLegacyStatus, resolveRelayStatus } from '../src/lib/nostr/relayPool';
import {
  decryptNip04,
  decryptNip44,
  getPublicKey,
  getRelays,
  hasNip04,
  hasNip44,
  signEvent,
} from '../src/lib/nostr/nip07';

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


  it('maps rx-nostr connection states to the legacy relay status UI', () => {
    expect(relayStateToLegacyStatus('initialized')).toBe(0);
    expect(relayStateToLegacyStatus('connecting')).toBe(0);
    expect(relayStateToLegacyStatus('waiting-for-retrying')).toBe(0);
    expect(relayStateToLegacyStatus('retrying')).toBe(0);
    expect(relayStateToLegacyStatus('connected')).toBe(1);
    expect(relayStateToLegacyStatus('dormant')).toBe(2);
    expect(relayStateToLegacyStatus('error')).toBe(3);
    expect(relayStateToLegacyStatus('rejected')).toBe(3);
    expect(relayStateToLegacyStatus('terminated')).toBe(3);
  });

  it('treats response timeouts as no signal even when the socket stays open', () => {
    expect(resolveRelayStatus('connected', 'timeout')).toBe(3);
    expect(resolveRelayStatus('dormant', 'timeout')).toBe(3);
    expect(resolveRelayStatus('error', 'timeout')).toBe(3);
    expect(resolveRelayStatus('connected')).toBe(1);
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
