// A play-money ledger kept in localStorage that accepts a round before it is shown
// (commit before play): the round, its bet and win and the balance after are written
// first; a reload replays the last round instead of losing it. Every read re-checks the
// whole save (sequence, ids, every bet and win against the rules, every balance), and a
// failed write leaves the points unchanged. Keeps the last `limit` rounds.
//
//   const session = new LocalSession({ storage: localStorage, resolve: (fixture, bet) => rules(fixture, bet),
//     saveKey: 'my-slot.local-session.v1', rules: 'my-rules-v1' });
//   await session.open();
//
// From games/dungeon-spin (LocalSession.ts). Changes: the save key, lock name, rules id,
// starting points, bets and kept rounds are options; the defaults are generic, and
// dungeon-spin passes its own (dungeon-spin.local-session.v1, original-fixed-v1, 100000, 10/20/50, 100).
// Added from <original-cascade-slot> (same lineage): option contractVersion, which stamps
// contractVersion: 1 on every saved round and replay as that game did (off by default).

const money = (n: any): boolean => Number.isSafeInteger(n) && n >= 0;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export interface LocalSessionOptions {
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  lock?: (name: string, callback: () => any) => Promise<any>;
  resolve: (fixture: string, singleBet: number) => { p: any; b: any };
  uuid?: () => string;
  now?: () => number;
  /** localStorage key (default 'slot-round.local-session.v1'). */
  saveKey?: string;
  /** Name passed to `lock` (default: the save key without its version). */
  lockName?: string;
  /** Rules id stored in the save; a save with another id is refused (default 'slot-rules-v1'). */
  rules?: string;
  /** Points of a fresh save (default 100000). */
  initialPoints?: number;
  /** Single bets a saved round may have (default 10, 20, 50). */
  bets?: readonly number[];
  /** Rounds kept in the save (default 100). */
  limit?: number;
  /** Stamp contractVersion: 1 on saved rounds and replays (<original-cascade-slot> did; default off). */
  contractVersion?: boolean;
}

export class LocalSession {
  private storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  private lock: (name: string, callback: () => any) => Promise<any>;
  private resolve: (fixture: string, singleBet: number) => { p: any; b: any };
  private uuid: () => string;
  private now: () => number;
  public state: any = null;
  public readonly saveKey: string;
  public readonly lockName: string;
  public readonly rules: string;
  public readonly initialPoints: number;
  public readonly bets: readonly number[];
  public readonly limit: number;
  public readonly contractVersion: boolean;

  constructor({
    storage,
    lock = async (_name, cb) => cb(),
    resolve,
    uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    now = () => Date.now(),
    saveKey = 'slot-round.local-session.v1',
    lockName = saveKey.replace(/\.v\d+$/, ''),
    rules = 'slot-rules-v1',
    initialPoints = 100000,
    bets = [10, 20, 50],
    limit = 100,
    contractVersion = false
  }: LocalSessionOptions) {
    this.storage = storage;
    this.lock = lock;
    this.resolve = resolve;
    this.uuid = uuid;
    this.now = now;
    this.saveKey = saveKey;
    this.lockName = lockName;
    this.rules = rules;
    this.initialPoints = initialPoints;
    this.bets = Object.freeze([...bets]);
    this.limit = limit;
    this.contractVersion = contractVersion;
  }

  public fresh(): any {
    return {
      version: 1,
      rules: this.rules,
      generation: this.uuid(),
      sequence: 0,
      basePoints: this.initialPoints,
      points: this.initialPoints,
      rounds: []
    };
  }

  public validate(state: any): any {
    if (
      !state ||
      state.version !== 1 ||
      state.rules !== this.rules ||
      typeof state.generation !== 'string' ||
      !state.generation ||
      !money(state.sequence) ||
      !money(state.points) ||
      !money(state.basePoints) ||
      !Array.isArray(state.rounds) ||
      state.rounds.length > this.limit
    ) {
      throw new Error('本地存檔格式不符，請匯出後重設');
    }
    let balance = state.basePoints;
    let previous = state.sequence - state.rounds.length;
    if (
      previous < 0 ||
      (!state.sequence && (state.points !== this.initialPoints || state.basePoints !== this.initialPoints)) ||
      Boolean(state.sequence) !== Boolean(state.rounds.length)
    ) {
      throw new Error('本地存檔回合序號不符');
    }
    const ids = new Set<string>();
    for (const round of state.rounds) {
      if (
        !round ||
        typeof round.id !== 'string' ||
        !round.id ||
        ids.has(round.id) ||
        round.sequence !== ++previous ||
        !money(round.acceptedAt) ||
        typeof round.presented !== 'boolean' ||
        typeof round.burst !== 'boolean' ||
        !this.bets.includes(round.singleBet)
      ) {
        throw new Error('本地回合紀錄不完整');
      }
      ids.add(round.id);
      const { p, b } = this.resolve(round.fixture, round.singleBet);
      if (
        round.bet !== p.totalBet ||
        round.win !== p.mainWin + b.total ||
        round.mainWin !== p.mainWin ||
        round.bonusWin !== b.total ||
        balance < round.bet
      ) {
        throw new Error('本地回合金額核對失敗');
      }
      balance = balance - round.bet + round.win;
      if (!money(balance) || round.pointsAfter !== balance) {
        throw new Error('本地存檔餘額核對失敗');
      }
    }
    if (balance !== state.points) throw new Error('本地存檔總額核對失敗');
    return state;
  }

  public read(): any {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.saveKey);
    } catch {
      throw new Error('瀏覽器無法讀取本地存檔，請開啟網站儲存權限');
    }
    if (raw === null) {
      if (this.state) throw new Error('本地存檔已被清除，請重設或重新載入');
      return null;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('存檔未被覆寫：內容損壞，請先匯出留存，再重設本地存檔');
    }
    try {
      return this.validate(parsed);
    } catch (error: any) {
      throw new Error(`存檔未被覆寫：${error.message}`);
    }
  }

  public write(next: any): any {
    this.validate(next);
    try {
      this.storage.setItem(this.saveKey, JSON.stringify(next));
    } catch {
      throw new Error('無法保存本局，點數尚未變更；請檢查瀏覽器儲存空間');
    }
    this.state = next;
    return copy(next);
  }

  public exclusive(work: () => any): Promise<any> {
    return this.lock(this.lockName, work);
  }

  public async open(): Promise<any> {
    return this.exclusive(() => {
      const saved = this.read();
      if (saved) {
        this.state = saved;
        return copy(saved);
      }
      return this.write(this.fresh());
    });
  }

  public refresh(): any {
    const state = this.read();
    if (!state) throw new Error('本地存檔尚未建立');
    this.state = state;
    return copy(state);
  }

  get points(): number {
    return this.state?.points ?? this.initialPoints;
  }

  get last(): any {
    return this.state?.rounds.at(-1) ?? null;
  }

  public async accept(
    fixture: string,
    singleBet: number,
    { burst = false }: { burst?: boolean } = {}
  ): Promise<any> {
    return this.exclusive(() => {
      const current = this.read();
      if (!current) throw new Error('請先載入本地存檔');
      if (current.generation !== this.state?.generation) {
        throw new Error('另一個分頁已重設存檔，請重新載入');
      }
      const { p, b } = this.resolve(fixture, singleBet);
      const win = p.mainWin + b.total;
      if (current.points < p.totalBet) {
        throw new Error('模擬點數不足；可在本地存檔設定重設試玩點數');
      }
      if (!money(current.points - p.totalBet + win) || !money(current.sequence + 1)) {
        throw new Error('本地數值已達上限，請先匯出並重設試玩存檔');
      }
      const round = {
        ...(this.contractVersion ? { contractVersion: 1 as const } : {}),
        id: `local-${current.sequence + 1}-${this.uuid()}`,
        sequence: current.sequence + 1,
        fixture,
        singleBet,
        bet: p.totalBet,
        mainWin: p.mainWin,
        bonusWin: b.total,
        win,
        pointsAfter: current.points - p.totalBet + win,
        acceptedAt: this.now(),
        presented: false,
        burst: Boolean(burst)
      };
      const next = {
        ...current,
        sequence: round.sequence,
        points: round.pointsAfter,
        rounds: [...current.rounds, round]
      };
      if (next.rounds.length > this.limit) {
        next.basePoints = next.rounds.shift().pointsAfter;
      }
      this.write(next);
      return { ...copy(round), p, b };
    });
  }

  public replay(round = this.last): any {
    if (!round || !this.state?.rounds.some((r: any) => r.id === round.id)) {
      throw new Error('找不到已保存的結算回合');
    }
    const saved = this.state.rounds.find((r: any) => r.id === round.id);
    return { ...(this.contractVersion ? { contractVersion: 1 as const } : {}), ...copy(saved), ...this.resolve(saved.fixture, saved.singleBet) };
  }

  public async markPresented(id: string, generation = this.state?.generation): Promise<boolean> {
    return this.exclusive(() => {
      const current = this.read();
      if (!current || current.generation !== generation) return false;
      const round = current.rounds.find((r: any) => r.id === id);
      if (!round || round.presented) return false;
      round.presented = true;
      this.write(current);
      return true;
    });
  }

  public async reset(): Promise<any> {
    return this.exclusive(() => this.write(this.fresh()));
  }
}
