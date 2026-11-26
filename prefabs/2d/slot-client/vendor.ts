// Where rounds come from: a local resolver (LocalSession plays it in the browser) or a
// slot server (prefabs/server/slotgateway). The client never decides a server round;
// it only maps the JSON it gets back. Pure TypeScript (fetch injected).
// Split from <original-cascade-slot>/client/src/plugs/vendors/VendorAdapters.ts (the local mock
// and the remote adapter); the remote client follows the shared gateway's routes.
import type { ServerRound, ServerSpinRequest, ServerSpinResponse } from './server-round.ts';

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface RemoteSlotClientOptions {
  /** e.g. 'http://127.0.0.1:8088' (no trailing slash). */
  baseUrl: string;
  /** Bearer token from the operator (or the dev token route). */
  token?: string | (() => string | undefined);
  fetch?: FetchLike;
  /** Health check timeout (default 2000 ms). */
  healthTimeoutMs?: number;
}

export class RemoteSlotClient {
  readonly adapterName = 'RemoteSlotClient';
  private o: RemoteSlotClientOptions;

  constructor(options: RemoteSlotClientOptions) {
    this.o = options;
  }

  private headers(json = false): Record<string, string> {
    const token = typeof this.o.token === 'function' ? this.o.token() : this.o.token;
    return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  private get fetch(): FetchLike {
    return this.o.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  async health(): Promise<boolean> {
    try {
      const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(this.o.healthTimeoutMs ?? 2000) : undefined;
      const res = await this.fetch(`${this.o.baseUrl}/api/health`, { signal });
      return res.ok && ((await res.json()) as { status?: string }).status === 'UP';
    } catch {
      return false;
    }
  }

  async balance(): Promise<number> {
    const res = await this.fetch(`${this.o.baseUrl}/api/user/balance`, { headers: this.headers() });
    const body = (await res.json()) as { balance?: number; error?: string };
    if (!res.ok || typeof body.balance !== 'number') throw new Error(`SLOT_BALANCE_ERROR: ${body.error ?? res.status}`);
    return body.balance;
  }

  /** Plays one round on the server; throws with the server's error (402 insufficient, 429 busy…). */
  async spin(request: ServerSpinRequest): Promise<{ round: ServerRound; balance: number }> {
    const res = await this.fetch(`${this.o.baseUrl}/api/spin`, { method: 'POST', headers: this.headers(true), body: JSON.stringify(request) });
    const body = (await res.json()) as ServerSpinResponse;
    if (!res.ok || !body.success || !body.data) throw new Error(`SLOT_SPIN_ERROR(${res.status}): ${body.error ?? 'unknown'}`);
    return { round: body.data, balance: body.balance };
  }

  async replay(roundId: string): Promise<ServerRound> {
    const res = await this.fetch(`${this.o.baseUrl}/api/replay?id=${encodeURIComponent(roundId)}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`SLOT_REPLAY_ERROR(${res.status})`);
    return (await res.json()) as ServerRound;
  }
}
