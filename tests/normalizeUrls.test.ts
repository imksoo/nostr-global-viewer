import { describe, it, expect, vi } from 'vitest';

vi.mock('nostr-relaypool', () => ({
  RelayPool: vi.fn().mockImplementation(() => ({
    onerror: vi.fn(),
    onnotice: vi.fn(),
    ondisconnect: vi.fn(),
    publish: vi.fn(),
  })),
}));

import { normalizeUrls } from '../src/store';

describe('normalizeUrls', () => {
  it('converts http to ws', () => {
    const result = normalizeUrls(['http://example.com']);
    expect(result).toEqual(['ws://example.com/']);
  });

  it('converts https to wss', () => {
    const result = normalizeUrls(['https://example.com']);
    expect(result).toEqual(['wss://example.com/']);
  });

  it('prefixes missing scheme with wss', () => {
    const result = normalizeUrls(['example.com']);
    expect(result).toEqual(['wss://example.com/']);
  });

  it('retains existing ws or wss', () => {
    const result = normalizeUrls(['ws://example.com', 'wss://example.com']);
    expect(result).toEqual(['ws://example.com/', 'wss://example.com/']);
  });
});
