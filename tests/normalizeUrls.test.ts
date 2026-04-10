import { describe, it, expect, vi } from 'vitest';

vi.mock('nostr-relaypool', () => ({
  RelayPool: vi.fn().mockImplementation(function () {
    this.onerror = vi.fn();
    this.onnotice = vi.fn();
    this.ondisconnect = vi.fn();
    this.publish = vi.fn();
  }),
}));

import { sanitizeRelayUrls } from '../src/store';

describe('normalizeUrls', () => {
  it('converts http to ws', () => {
    const result = sanitizeRelayUrls(['http://example.com']);
    expect(result).toEqual(['ws://example.com/']);
  });

  it('converts https to wss', () => {
    const result = sanitizeRelayUrls(['https://example.com']);
    expect(result).toEqual(['wss://example.com/']);
  });

  it('prefixes missing scheme with wss', () => {
    const result = sanitizeRelayUrls(['example.com']);
    expect(result).toEqual(['wss://example.com/']);
  });

  it('retains existing ws or wss', () => {
    const result = sanitizeRelayUrls(['ws://example.com', 'wss://example.com']);
    expect(result).toEqual(['ws://example.com/', 'wss://example.com/']);
  });

  it('filters localhost relays', () => {
    const result = sanitizeRelayUrls(['localhost', 'wss://localhost:8080', 'wss://example.com']);
    expect(result).toEqual(['wss://example.com/']);
  });

  it('filters private ipv4 relays', () => {
    const result = sanitizeRelayUrls([
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '127.0.0.1',
      'wss://example.com',
    ]);
    expect(result).toEqual(['wss://example.com/']);
  });

  it('filters cidr-like private relay entries', () => {
    const result = sanitizeRelayUrls(['10.0.0.0/8', '192.168.0.0/16', 'relay.example.com']);
    expect(result).toEqual(['wss://relay.example.com/']);
  });
});
