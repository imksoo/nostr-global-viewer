import { expect, test } from '@playwright/test';

const FIXTURES = {
  profile: {
    kind: 0,
    created_at: 1775781466,
    tags: [],
    content: '{"name":"e2e-user"}',
    pubkey: 'ed9a24e3b8352ff1dd77e2c256f4f0a87296c38cb694dfa4e9aaa65431b2f53a',
    id: '391a2a280815138507f3a22dac7eeae5986f1168064a8344716b7c786eea379f',
    sig: '9002bd69710523479364d3919c3d574ed8f6d959455980eca08dcddd01c745537ba829f4108bd413a5a73de9470b724101e5041b1b2352afd17901380b8da9d4',
  },
  note: {
    kind: 1,
    created_at: 1775781466,
    tags: [],
    content: 'E2E relay smoke event',
    pubkey: 'ed9a24e3b8352ff1dd77e2c256f4f0a87296c38cb694dfa4e9aaa65431b2f53a',
    id: '849864f174fba95488c64eb7c810df24637a81e273b3e858877ca876f2279a64',
    sig: 'af7129b1f78208b77d21e07f3e898ab21ab3a9a5445c929375ba7eef965221271fe2c479a80cb14fe6742dac5e5456e574b045399d227f75c0170f2221f4914c',
  },
};

test('SPA smoke: relay connect, latest content render, no blank screen/errors', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.addInitScript((fixtures) => {
    type NostrFixture = {
      profile: Record<string, unknown>;
      note: Record<string, unknown>;
    };

    const payload = fixtures as NostrFixture;

    class MockWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readonly url: string;
      readonly protocol = '';
      readonly extensions = '';
      readonly bufferedAmount = 0;
      readonly binaryType = 'blob';

      readyState = MockWebSocket.CONNECTING;

      onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
      onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
      onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
      onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);

        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.emitOpen();
        }, 0);
      }

      send(rawData: string): void {
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          return;
        }

        if (!Array.isArray(parsed) || parsed[0] !== 'REQ' || typeof parsed[1] !== 'string') {
          return;
        }

        const subId = parsed[1];
        const filters = parsed.slice(2) as Array<Record<string, unknown>>;
        const wantsKind = (kind: number): boolean =>
          filters.some((f) => Array.isArray(f?.kinds) && (f.kinds as unknown[]).includes(kind));

        if (wantsKind(0)) {
          this.emitMessage(['EVENT', subId, payload.profile]);
        }

        if (
          wantsKind(1) || wantsKind(6) || wantsKind(7) || wantsKind(40) || wantsKind(41) || wantsKind(42) || wantsKind(1984) || wantsKind(30315)
        ) {
          this.emitMessage(['EVENT', subId, payload.note]);
        }

        this.emitMessage(['EOSE', subId]);
      }

      close(): void {
        this.readyState = MockWebSocket.CLOSED;
        const event = new Event('close');
        this.dispatchEvent(event);
        if (this.onclose) {
          this.onclose.call(this as unknown as WebSocket, event as CloseEvent);
        }
      }

      private emitOpen(): void {
        const event = new Event('open');
        this.dispatchEvent(event);
        if (this.onopen) {
          this.onopen.call(this as unknown as WebSocket, event);
        }
      }

      private emitMessage(data: unknown): void {
        const event = new MessageEvent('message', { data: JSON.stringify(data) });
        this.dispatchEvent(event);
        if (this.onmessage) {
          this.onmessage.call(this as unknown as WebSocket, event);
        }
      }
    }

    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    });
  }, FIXTURES);

  await page.goto('/');

  await expect(page.locator('.p-index-wrap')).toBeVisible();
  await expect(page.locator('.c-feed-item').first()).toBeVisible();
  await expect(page.getByText('E2E relay smoke event')).toBeVisible();

  const bodyTextLength = await page.evaluate(() => document.body.innerText.trim().length);
  expect(bodyTextLength).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
