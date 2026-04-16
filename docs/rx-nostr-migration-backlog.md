# rx-nostr Migration Backlog

## Goal

Replace `nostr-relaypool` with an internal relay adapter backed by `rx-nostr`, while reducing direct `nostr-tools` usage from application code.

## Why

- `nostr-relaypool` is no longer actively maintained.
- Reconnection and relay lifecycle handling should rely on a maintained library.
- `nostr-tools` has introduced breaking changes in the past, so direct usage from views/components should be reduced.
- Relay handling and protocol helpers should be isolated behind project-owned interfaces.

## Non-goals

- Rewrite all Nostr-related logic in one pass.
- Remove `nostr-tools` completely in the first migration.
- Change timeline behavior or search behavior unless required by the migration.

## Target Architecture

### 1. Relay adapter layer

Create a project-owned relay API under `src/lib/nostr/relayPool.ts`.

Responsibilities:
- manage multiple relay connections
- reconnect automatically
- maintain subscriptions across reconnects
- publish events
- expose relay status for UI display
- provide explicit cleanup hooks

The rest of the app should stop importing relay client libraries directly.

### 2. NIP-07 wrapper layer

Create `src/lib/nostr/nip07.ts`.

Responsibilities:
- `getPublicKey()`
- `signEvent()`
- `nip04.decrypt()`
- `nip44.decrypt()`
- feature detection for browser extension methods

The rest of the app should stop touching `window.nostr` directly.

### 3. Event utility layer

Create `src/lib/nostr/event.ts`.

Responsibilities:
- event signature verification
- event hash generation
- small event type helpers

`nostr-tools` may remain as the implementation detail here for now.

### 4. Encoding layer

Create `src/lib/nostr/encode.ts`.

Responsibilities:
- `npub` / `note` / `nevent` encoding
- NIP-19 decoding used by routing and content parsing

`nostr-tools` may remain as the implementation detail here for now.

## Migration Plan

### Phase 1: Prepare project-owned interfaces

- [x] Add `src/lib/nostr/relayPool.ts` with the minimal API surface required by current code.
- [x] Add `src/lib/nostr/nip07.ts` wrapper for browser signer/decrypt APIs.
- [x] Add `src/lib/nostr/event.ts` for signature/hash helpers.
- [x] Add `src/lib/nostr/encode.ts` for NIP-19 helpers.
- [x] Keep implementations thin and adapter-oriented.

Exit criteria:
- new wrapper modules exist
- no behavior change yet
- wrappers are covered by basic unit tests where practical

### Phase 2: Replace `nostr-relaypool`

- [x] Replace `pool` construction in `src/store.ts` with the new relay adapter.
- [x] Port all current subscribe flows in `src/views/top.vue` to the new adapter.
- [x] Port publish flows in posting, repost, favorite, and broadcast paths.
- [x] Preserve current reconnect behavior expectations.
- [x] Preserve relay status UI data for `RelayStatus.vue`.

Exit criteria:
- `nostr-relaypool` is no longer imported anywhere
- timeline loading still works in global / note / npub modes
- login-triggered subscriptions still work
- relay status UI still renders meaningful connection state

### Phase 3: Remove direct `window.nostr` access

- [x] Replace direct browser extension calls in `src/views/top.vue` with `nip07.ts`.
- [x] Centralize NIP-04 and NIP-44 capability detection.
- [x] Keep DM flows working for kind `4` and kind `14` display events.

Exit criteria:
- no direct `window.nostr` access remains in views/components
- login and signing still work
- DM decryption still works when the extension supports it

### Phase 4: Reduce direct `nostr-tools` usage

- [x] Replace direct `Nostr.verifySignature` usage with `event.ts` wrapper.
- [x] Replace direct `Nostr.getEventHash` usage with `event.ts` wrapper.
- [x] Replace direct `Nostr.nip19.*` usage with `encode.ts` wrapper.
- [x] Identify remaining `nostr-tools` imports and classify them as keep/remove.

Exit criteria:
- app code imports project wrappers instead of `nostr-tools` in most places
- remaining `nostr-tools` usage is intentionally localized

### Phase 5: Test hardening

- [x] Add unit tests for relay URL normalization and wrapper edge cases.
- [x] Add tests for reconnect-sensitive subscription behavior if feasible.
- [x] Add smoke coverage for login-driven subscriptions.
- [x] Verify NIP-04 inbox behavior.
- [x] Verify NIP-17 inbox behavior.

Exit criteria:
- migration has regression coverage for the most failure-prone paths

## Current Outcome

- Relay transport was replaced with a project-owned adapter backed by `rx-nostr`.
- `window.nostr` access was centralized in `src/lib/nostr/nip07.ts`.
- `Nostr.verifySignature`, `Nostr.getEventHash`, and `Nostr.nip19.*` usage was routed through project wrappers where targeted by the migration.
- `nostr-fetch` remains in place for now.
- DM display items continue to keep `rawEvent` when relay/broadcast logic needs the original wrapped event.

## Open Questions

- How much of relay status data can be preserved exactly with `rx-nostr`?
- Should broadcast use raw wrapped events for NIP-17 display items, or be disabled for DM display items altogether?
- Should the app define its own event type aliases for kind `14` and kind `1059` instead of passing raw numbers around?
- Should `nostr-fetch` remain, or should relay reads gradually converge on one transport stack?

## Recommended Execution Order

1. Introduce wrappers without changing behavior.
2. Swap relay transport from `nostr-relaypool` to `rx-nostr`.
3. Move NIP-07 calls behind a wrapper.
4. Replace direct `nostr-tools` imports in app code.
5. Add regression tests for DM and reconnect paths.

## Definition of Done

- `nostr-relaypool` dependency is removed.
- relay connection handling is owned by `rx-nostr` behind a project adapter.
- application code no longer depends directly on relay client internals.
- direct `nostr-tools` usage in app code is substantially reduced and localized.
- global feed, thread view, profile view, reactions, NIP-04 DM, and NIP-17 DM still work.
