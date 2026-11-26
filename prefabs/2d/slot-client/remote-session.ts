// A session whose rounds come from the slot server (systems/slot-round SessionPort), so the
// same GameRuntime, buttons and step player run a server-authoritative game: accept() asks
// the server to play (the server takes the bet and pays the win), the round is kept for
// replay, the balance is the server's. Pure TypeScript.
// The selection's fixture says what to ask for: 'buy' buys the feature, 'ante' plays with ante,
// anything else is a normal round. New in the dissolving of <original-cascade-slot> (that
// game called its server outside the runtime); not part of the source.
import type { CascadeSnapshot } from './protocol.ts';
import { toResolvedRound } from './server-round.ts';
import type { RemoteSlotClient } from './vendor.ts';

export interface RemoteSessionOptions {
  client: Pick<RemoteSlotClient, 'spin' | 'balance'>;
  cols: number;
  rows: number;
  /** Rounds kept for replay (default 50). */
  keep?: number;
  now?: () => number;
}

export class RemoteSession {
  points = 0;
  readonly state = { generation: 'server' };
  private rounds: CascadeSnapshot[] = [];
  private sequence = 0;
  private o: RemoteSessionOptions;

  constructor(options: RemoteSessionOptions) {
    this.o = options;
  }

  get last(): CascadeSnapshot | null {
    return this.rounds.at(-1) ?? null;
  }

  /** Reads the balance from the server. */
  async open(): Promise<number> {
    this.points = await this.o.client.balance();
    return this.points;
  }

  refresh(): void {}

  async accept(fixture: string, singleBet: number, { burst = false }: { burst?: boolean } = {}): Promise<CascadeSnapshot> {
    const { round, balance } = await this.o.client.spin({ betAmount: singleBet, buyFeature: fixture === 'buy', anteBet: fixture === 'ante' });
    const { p, b } = toResolvedRound(round, this.o.cols, this.o.rows);
    const snapshot: CascadeSnapshot = {
      contractVersion: 1,
      id: round.roundId,
      sequence: ++this.sequence,
      fixture,
      singleBet: round.singleBet,
      bet: round.totalBet,
      win: round.totalWin,
      mainWin: p.mainWin,
      bonusWin: b.total,
      pointsAfter: balance,
      presented: false,
      acceptedAt: (this.o.now ?? Date.now)(),
      burst,
      p,
      b,
    };
    this.points = balance;
    this.rounds.push(snapshot);
    if (this.rounds.length > (this.o.keep ?? 50)) this.rounds.shift();
    return snapshot;
  }

  replay(round: { id: string } | null = this.last): CascadeSnapshot {
    const found = round && this.rounds.find((r) => r.id === round.id);
    if (!found) throw new Error('找不到這一局');
    return found;
  }

  async markPresented(id: string): Promise<boolean> {
    const i = this.rounds.findIndex((r) => r.id === id);
    if (i < 0 || this.rounds[i].presented) return false;
    this.rounds[i] = { ...this.rounds[i], presented: true };
    return true;
  }
}
