import {
  createRxForwardReq,
  createRxNostr,
  createRxOneshotReq,
  type ConnectionState,
  type ConnectionStatePacket,
  type EventPacket,
  type MessagePacket,
  type RxNostr,
} from "rx-nostr";
import type { Filter } from "nostr-typedef";
import { type Event, verifyEventSignature } from "./event";

export type RelayStatusDetail = "timeout" | "transport-error";
export type RelayStatusTuple = [string, number, RelayStatusDetail?];

export interface RelayPoolOptions {
  autoReconnect?: boolean;
  logErrorsAndNotices?: boolean;
  subscriptionCache?: boolean;
  useEventCache?: boolean;
  skipVerification?: boolean;
}

export interface SubscribeOptions {
  unsubscribeOnEose?: boolean;
}

export type SubscribeCallback = (
  event: Event,
  isAfterEose: boolean,
  relayURL: string,
) => void | Promise<void>;
export type SubscribeDoneCallback = () => void | Promise<void>;

type RelayErrorCallback = (url: string, msg: string) => void;
type RelayNoticeCallback = (url: string, msg: string) => void;
type RelayDisconnectCallback = (url: string, msg: string) => void;

const RESPONSE_TIMEOUT_MS = 60000;

export function relayStateToLegacyStatus(state: ConnectionState): number {
  switch (state) {
    case "connected":
      return 1;
    case "dormant":
      return 2;
    case "error":
    case "rejected":
    case "terminated":
      return 3;
    default:
      return 0;
  }
}

export function resolveRelayStatus(
  state: ConnectionState,
  detail?: RelayStatusDetail,
): number {
  if ((detail === "timeout" || detail === "transport-error") && state !== "error" && state !== "rejected" && state !== "terminated") {
    return 3;
  }

  return relayStateToLegacyStatus(state);
}

function isRelayDoneState(state: ConnectionState): boolean {
  return (
    state === "dormant" ||
    state === "error" ||
    state === "rejected" ||
    state === "terminated"
  );
}

function unique(urls: string[]): string[] {
  return [...new Set(urls)];
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export class RelayPool {
  private rxNostr: RxNostr;
  private readonly options: RelayPoolOptions;
  private noticeHandlers = new Set<RelayNoticeCallback>();
  private errorHandlers = new Set<RelayErrorCallback>();
  private disconnectHandlers = new Set<RelayDisconnectCallback>();
  private relayResponseIssues = new Map<string, Set<string>>();
  private relayTransportIssues = new Set<string>();

  constructor(relays: string[] = [], options: RelayPoolOptions = {}) {
    this.options = options;
    this.rxNostr = createRxNostr({
      verifier: async (event) =>
        verifyEventSignature(event as unknown as Event),
      connectionStrategy: "lazy-keep",
      retry:
        this.options.autoReconnect === false
          ? { strategy: "off" }
          : {
              strategy: "exponential",
              maxCount: 1024,
              initialDelay: 1000,
            },
      skipVerify: this.options.skipVerification === true,
    });

    if (relays.length > 0) {
      this.rxNostr.setDefaultRelays(relays);
    }

    this.rxNostr.createAllErrorObservable().subscribe(({ from, reason }) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      this.markRelayTransportError(from);
      if (this.options.logErrorsAndNotices) {
        console.log("RelayPool.error", from, message);
      }
      this.errorHandlers.forEach((cb) => cb(from, message));
    });

    this.rxNostr.createAllMessageObservable().subscribe((packet) => {
      this.clearRelayTransportIssue(packet.from);
      if (packet.type === "NOTICE") {
        if (this.options.logErrorsAndNotices) {
          console.log("RelayPool.notice", packet.from, packet.notice);
        }
        this.noticeHandlers.forEach((cb) => cb(packet.from, packet.notice));
      }
    });

    this.rxNostr
      .createConnectionStateObservable()
      .subscribe(({ from, state }: ConnectionStatePacket) => {
        if (isRelayDoneState(state)) {
          this.disconnectHandlers.forEach((cb) => cb(from, state));
        }
      });
  }

  onerror(callback: RelayErrorCallback): void {
    this.errorHandlers.add(callback);
  }

  onnotice(callback: RelayNoticeCallback): void {
    this.noticeHandlers.add(callback);
  }

  ondisconnect(callback: RelayDisconnectCallback): void {
    this.disconnectHandlers.add(callback);
  }

  private clearRelayResponseIssue(url: string, subscriptionId?: string): void {
    if (!subscriptionId) {
      this.relayResponseIssues.delete(url);
      return;
    }

    const issues = this.relayResponseIssues.get(url);
    if (!issues) {
      return;
    }

    issues.delete(subscriptionId);
    if (issues.size === 0) {
      this.relayResponseIssues.delete(url);
    }
  }

  private markRelayResponseTimeout(url: string, subscriptionId: string): void {
    const issues = this.relayResponseIssues.get(url) ?? new Set<string>();
    issues.add(subscriptionId);
    this.relayResponseIssues.set(url, issues);
  }

  private markRelayTransportError(url: string): void {
    this.relayTransportIssues.add(url);
  }

  private clearRelayTransportIssue(url: string): void {
    this.relayTransportIssues.delete(url);
  }

  private getRelayResponseDetail(url: string): RelayStatusDetail | undefined {
    const issues = this.relayResponseIssues.get(url);
    if (issues && issues.size > 0) {
      return "timeout";
    }

    if (this.relayTransportIssues.has(url)) {
      return "transport-error";
    }

    return undefined;
  }

  getRelayStatuses(): RelayStatusTuple[] {
    const statuses = this.rxNostr.getAllRelayStatus();
    const relayUrls = unique([
      ...Object.keys(statuses),
      ...Array.from(this.relayResponseIssues.keys()),
      ...Array.from(this.relayTransportIssues),
    ]);

    return relayUrls.map((url) => {
      const connection = statuses[url]?.connection ?? "initialized";
      const detail = this.getRelayResponseDetail(url);
      return [url, resolveRelayStatus(connection, detail), detail];
    });
  }

  publish(event: Event, relays: string[]): void {
    const targets = unique(relays);
    if (targets.length === 0) {
      return;
    }

    void this.rxNostr
      .cast(event as never, {
        on: { relays: targets },
        signer: {
          async getPublicKey() {
            return event.pubkey;
          },
          async signEvent() {
            return event as never;
          },
        },
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        targets.forEach((url) =>
          this.errorHandlers.forEach((cb) => cb(url, message)),
        );
      });
  }

  subscribe(
    filters: Filter[],
    relays: string[],
    onEvent: SubscribeCallback,
    _unused?: unknown,
    onEose?: SubscribeDoneCallback,
    options?: SubscribeOptions,
  ): () => void {
    const targets = unique(relays);
    const rxReqId = randomId();
    const isOneShot = options?.unsubscribeOnEose === true;
    const trackResponseTimeout = isOneShot;
    const rxReq = isOneShot
      ? createRxOneshotReq({ filters, rxReqId })
      : createRxForwardReq(rxReqId);
    const subId = `${rxReqId}:0`;
    const subscriptionIssueId = subId;
    const eoseRelays = new Set<string>();
    const responseTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let eoseCalled = false;

    const clearResponseTimer = (url: string) => {
      const timerId = responseTimers.get(url);
      if (!timerId) {
        return;
      }

      clearTimeout(timerId);
      responseTimers.delete(url);
    };

    const startResponseTimer = (url: string) => {
      if (!trackResponseTimeout || !targets.includes(url) || eoseRelays.has(url)) {
        return;
      }

      clearResponseTimer(url);
      responseTimers.set(
        url,
        setTimeout(() => {
          responseTimers.delete(url);
          this.markRelayResponseTimeout(url, subscriptionIssueId);
        }, RESPONSE_TIMEOUT_MS),
      );
    };

    const markRelayResponsive = (url: string) => {
      if (!trackResponseTimeout || !targets.includes(url)) {
        return;
      }

      clearResponseTimer(url);
      this.clearRelayResponseIssue(url, subscriptionIssueId);
    };

    const cleanup = () => {
      responseTimers.forEach((timerId) => clearTimeout(timerId));
      responseTimers.clear();
      if (trackResponseTimeout) {
        targets.forEach((url) => this.clearRelayResponseIssue(url, subscriptionIssueId));
      }
      eventSubscription.unsubscribe();
      messageSubscription.unsubscribe();
      connectionSubscription.unsubscribe();
      if ("over" in rxReq) {
        (rxReq as { over: () => void }).over();
      }
    };

    const maybeDone = async () => {
      if (eoseCalled || targets.length === 0 || eoseRelays.size < targets.length) {
        return;
      }
      eoseCalled = true;
      await onEose?.();
      if (isOneShot) {
        cleanup();
      }
    };

    const markRelayDone = (url: string) => {
      if (!trackResponseTimeout || !targets.includes(url) || eoseRelays.has(url)) {
        return;
      }
      markRelayResponsive(url);
      eoseRelays.add(url);
      void maybeDone();
    };

    const eventSubscription = this.rxNostr
      .use(rxReq, { on: { relays: targets } })
      .subscribe({
        next: ({ event, from }: EventPacket) => {
          this.clearRelayTransportIssue(from);
          markRelayResponsive(from);
          void onEvent(
            event as unknown as Event,
            eoseRelays.has(from),
            from,
          );
        },
        complete: () => {
          if (isOneShot && !eoseCalled) {
            eoseCalled = true;
            void onEose?.();
          }
        },
      });

    const messageSubscription = this.rxNostr
      .createAllMessageObservable()
      .subscribe((packet: MessagePacket) => {
        if (
          targets.includes(packet.from) &&
          "subId" in packet &&
          packet.subId === subId &&
          (packet.type === "EOSE" || packet.type === "CLOSED")
        ) {
          markRelayDone(packet.from);
        }
      });

    const connectionSubscription = this.rxNostr
      .createConnectionStateObservable()
      .subscribe((packet: ConnectionStatePacket) => {
        if (!targets.includes(packet.from)) {
          return;
        }

        if (packet.state === "connected") {
          this.clearRelayTransportIssue(packet.from);
          startResponseTimer(packet.from);
          return;
        }

        if (isRelayDoneState(packet.state)) {
          clearResponseTimer(packet.from);
          markRelayDone(packet.from);
        }
      });

    if (trackResponseTimeout) {
      targets.forEach((url) => startResponseTimer(url));
    }

    if (!isOneShot) {
      (rxReq as ReturnType<typeof createRxForwardReq>).emit(filters);
    }

    return cleanup;
  }

  async fetchAndCacheContactList(pubkey: string): Promise<Event> {
    const relays = unique(
      Object.values(this.rxNostr.getDefaultRelays({ filter: "read-all" })).map(
        (relay) => relay.url,
      ),
    );

    return await new Promise<Event>((resolve, reject) => {
      let latestEvent: Event | null = null;
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const settle = (cb: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        unsubscribe();
        cb();
      };

      const unsubscribe = this.subscribe(
        [{ kinds: [3], authors: [pubkey], limit: 1 }],
        relays,
        (event) => {
          if (!latestEvent || latestEvent.created_at < event.created_at) {
            latestEvent = event;
          }
        },
        undefined,
        () => {
          settle(() => {
            if (latestEvent) {
              resolve(latestEvent);
            } else {
              reject(new Error(`Contact list not found for ${pubkey}`));
            }
          });
        },
        { unsubscribeOnEose: true },
      );

      timeoutId = setTimeout(() => {
        settle(() => {
          if (latestEvent) {
            resolve(latestEvent);
          } else {
            reject(new Error(`Contact list request timed out for ${pubkey}`));
          }
        });
      }, 30000);
    });
  }

  dispose(): void {
    this.rxNostr.dispose();
  }
}
