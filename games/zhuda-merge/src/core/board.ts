// 豬大食堂 — a merge-two board, pure and seeded: tap a source for an ingredient (one energy), drag
// two of a kind together for the next dish, hand customers what they ask for. Tested in
// test/board.test.ts. No real money: energy returns with time, with levels, or for coins earned.

export const COLS = 7, ROWS = 8, CELLS = COLS * ROWS;
export type Chain = 'veg' | 'tea' | 'bun';
export const TOP = 5; // tiers 0..5
export const NAMES: Record<Chain, string[]> = {
  veg: ['菜苗', '白菜', '紅蘿蔔', '玉米', '沙拉', '什錦鍋'],
  tea: ['清水', '茶壺', '熱茶', '珍珠奶茶', '冰飲', '特調'],
  bun: ['稻穗', '白飯', '飯糰', '煎餃', '拉麵', '便當'],
};
export const SOURCE_NAME: Record<Chain, string> = { veg: '菜籃', tea: '水龍頭', bun: '蒸籠' };
/** The level at which each source arrives. */
export const SOURCE_LEVEL: Record<Chain, number> = { veg: 1, tea: 1, bun: 3 };
export const MAX_ENERGY = 100;
export const ENERGY_SECONDS = 30;
export const ENERGY_PRICE = { coins: 150, energy: 30 };
export const MAX_LEVEL = 10;
export const xpFor = (level: number) => 20 + level * level * 14;
const CUSTOMERS = ['shen-yan', 'huo-qingtang', 'ye-shuang', 'lu-xinghe', 'bai-zhi', 'han-jin', 'yan-wusheng', 'xuan-heng', 'meng-yuanzhou', 'a-heng', 'lin-qingluo'];

export type Cell = { kind: 'item'; chain: Chain; tier: number } | { kind: 'source'; chain: Chain } | null;
export interface Order { who: string; wants: { chain: Chain; tier: number }[]; coins: number; xp: number }
export interface State {
  version: 1;
  seed: number;
  cells: Cell[];
  orders: Order[];
  coins: number;
  xp: number;
  level: number;
  energy: number;
  /** When energy last ticked (ms). */
  energyAt: number;
  served: number;
  merges: number;
  done: boolean;
}

function rng(s: State): number {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chainsAt = (level: number) => (Object.keys(SOURCE_LEVEL) as Chain[]).filter((c) => level >= SOURCE_LEVEL[c]);

function newOrder(s: State): Order {
  const chains = chainsAt(s.level);
  // Higher levels ask for later dishes and, from level 4, sometimes two things.
  const top = Math.min(TOP, 1 + Math.floor(s.level * 0.55));
  const count = s.level >= 4 && rng(s) < 0.35 ? 2 : 1;
  const wants = Array.from({ length: count }, () => ({ chain: chains[Math.floor(rng(s) * chains.length)], tier: Math.max(1, top - Math.floor(rng(s) * 2.4)) }));
  const worth = wants.reduce((sum, w) => sum + Math.pow(2, w.tier), 0);
  const used = new Set(s.orders.map((o) => o.who));
  const free = CUSTOMERS.filter((c) => !used.has(c));
  return { who: free[Math.floor(rng(s) * free.length)], wants, coins: Math.round(worth * 2.2), xp: Math.round(worth * 1.6) };
}

export function newState(now: number, seed = 20261125): State {
  const s: State = { version: 1, seed, cells: Array(CELLS).fill(null), orders: [], coins: 0, xp: 0, level: 1, energy: MAX_ENERGY, energyAt: now, served: 0, merges: 0, done: false };
  s.cells[3 * COLS + 2] = { kind: 'source', chain: 'veg' };
  s.cells[3 * COLS + 4] = { kind: 'source', chain: 'tea' };
  while (s.orders.length < 3) s.orders.push(newOrder(s));
  return s;
}

/** Energy that has come back since it last ticked. */
export function tick(s: State, now: number): void {
  if (s.energy >= MAX_ENERGY) return void (s.energyAt = now);
  const gained = Math.floor((now - s.energyAt) / (ENERGY_SECONDS * 1000));
  if (gained <= 0) return;
  s.energy = Math.min(MAX_ENERGY, s.energy + gained);
  s.energyAt += gained * ENERGY_SECONDS * 1000;
}
export const nextEnergyIn = (s: State, now: number) => (s.energy >= MAX_ENERGY ? 0 : Math.max(0, ENERGY_SECONDS - (now - s.energyAt) / 1000));

/** The free cell nearest to `from` (the cell an ingredient drops into), or -1 when the board is full. */
export function freeNear(s: State, from: number): number {
  const fx = from % COLS, fy = Math.floor(from / COLS);
  let best = -1, bestD = Infinity;
  for (let i = 0; i < CELLS; i++) {
    if (s.cells[i]) continue;
    const d = Math.abs((i % COLS) - fx) + Math.abs(Math.floor(i / COLS) - fy) + i * 1e-4;
    if (d < bestD) (bestD = d), (best = i);
  }
  return best;
}

export type Result = { ok: true; what: 'spawn' | 'move' | 'swap' | 'merge'; at: number; tier?: number } | { ok: false; why: 'energy' | 'full' | 'nothing' | 'same' };

/** Taps a source: one energy for an ingredient beside it (mostly the first tier, sometimes better). */
export function tap(s: State, index: number): Result {
  const c = s.cells[index];
  if (!c || c.kind !== 'source') return { ok: false, why: 'nothing' };
  if (s.energy < 1) return { ok: false, why: 'energy' };
  const at = freeNear(s, index);
  if (at < 0) return { ok: false, why: 'full' };
  const r = rng(s);
  const tier = r < 0.03 ? 2 : r < 0.2 ? 1 : 0;
  s.energy -= 1;
  s.cells[at] = { kind: 'item', chain: c.chain, tier };
  return { ok: true, what: 'spawn', at, tier };
}

/** Drags the thing at `from` onto `to`: a merge with its twin, a move to a free cell, a swap otherwise. */
export function drag(s: State, from: number, to: number): Result {
  const a = s.cells[from], b = s.cells[to];
  if (!a || from === to || to < 0 || to >= CELLS) return { ok: false, why: from === to ? 'same' : 'nothing' };
  if (!b) {
    s.cells[to] = a;
    s.cells[from] = null;
    return { ok: true, what: 'move', at: to };
  }
  if (a.kind === 'item' && b.kind === 'item' && a.chain === b.chain && a.tier === b.tier && a.tier < TOP) {
    s.cells[to] = { kind: 'item', chain: a.chain, tier: a.tier + 1 };
    s.cells[from] = null;
    s.merges += 1;
    return { ok: true, what: 'merge', at: to, tier: a.tier + 1 };
  }
  s.cells[to] = a;
  s.cells[from] = b;
  return { ok: true, what: 'swap', at: to };
}

/** The cells that would fill an order, or null when something is missing. */
export function fillable(s: State, order: Order): number[] | null {
  const used = new Set<number>();
  for (const w of order.wants) {
    const i = s.cells.findIndex((c, k) => !used.has(k) && c?.kind === 'item' && c.chain === w.chain && c.tier === w.tier);
    if (i < 0) return null;
    used.add(i);
  }
  return [...used];
}

/** Serves an order: the dishes leave the board, coins and experience come in, a new customer sits down. */
export function serve(s: State, index: number): { coins: number; xp: number; levelUp: boolean; arrived?: Chain } | null {
  const order = s.orders[index];
  const cells = order && fillable(s, order);
  if (!cells) return null;
  for (const i of cells) s.cells[i] = null;
  s.coins += order.coins;
  s.xp += order.xp;
  s.served += 1;
  let levelUp = false, arrived: Chain | undefined;
  while (s.level < MAX_LEVEL && s.xp >= xpFor(s.level)) {
    s.xp -= xpFor(s.level);
    s.level += 1;
    s.energy = Math.min(MAX_ENERGY, s.energy + 40);
    levelUp = true;
    for (const c of Object.keys(SOURCE_LEVEL) as Chain[]) {
      if (SOURCE_LEVEL[c] !== s.level) continue;
      // The new source takes a free cell near the middle (one is made by clearing an item if need be).
      let at = freeNear(s, 4 * COLS + 3);
      if (at < 0) at = s.cells.findIndex((x) => x?.kind === 'item');
      s.cells[at] = { kind: 'source', chain: c };
      arrived = c;
    }
  }
  if (s.level >= MAX_LEVEL) s.done = true;
  s.orders[index] = newOrder(s);
  return { coins: order.coins, xp: order.xp, levelUp, arrived };
}

/** Sells an item for a coin a tier (to clear a full board). */
export function sell(s: State, index: number): number {
  const c = s.cells[index];
  if (!c || c.kind !== 'item') return 0;
  s.cells[index] = null;
  s.coins += c.tier + 1;
  return c.tier + 1;
}
export function buyEnergy(s: State): boolean {
  if (s.coins < ENERGY_PRICE.coins || s.energy > MAX_ENERGY - ENERGY_PRICE.energy) return false;
  s.coins -= ENERGY_PRICE.coins;
  s.energy += ENERGY_PRICE.energy;
  return true;
}

/** A pair that can be merged, if any: [from, to]. */
export function hint(s: State): [number, number] | null {
  const seen = new Map<string, number>();
  for (let i = 0; i < CELLS; i++) {
    const c = s.cells[i];
    if (c?.kind !== 'item' || c.tier >= TOP) continue;
    const k = `${c.chain}${c.tier}`;
    if (seen.has(k)) return [i, seen.get(k)!];
    seen.set(k, i);
  }
  return null;
}

// ---- a player for tests and recorded runs -------------------------------------------------------
export type Move = { do: 'serve'; order: number } | { do: 'drag'; from: number; to: number } | { do: 'tap'; at: number } | { do: 'sell'; at: number } | { do: 'buy' } | { do: 'wait' };
/** Serve what can be served; merge only towards a dish someone is waiting for; sell what nobody wants when room runs short. */
export function botMove(s: State): Move {
  const order = s.orders.findIndex((o) => fillable(s, o));
  if (order >= 0) return { do: 'serve', order };
  // What is still missing: every wanted dish not already on the board.
  const have = new Map<string, number>();
  for (const c of s.cells) if (c?.kind === 'item') have.set(`${c.chain}${c.tier}`, (have.get(`${c.chain}${c.tier}`) ?? 0) + 1);
  const goals: { chain: Chain; tier: number }[] = [];
  for (const o of s.orders)
    for (const w of o.wants) {
      const k = `${w.chain}${w.tier}`;
      if ((have.get(k) ?? 0) > 0) have.set(k, have.get(k)! - 1);
      else goals.push(w);
    }
  const useful = (chain: Chain, tier: number) => goals.some((g) => g.chain === chain && g.tier > tier);
  // A pair below a missing dish of its chain is merged.
  const first = new Map<string, number>();
  for (let i = 0; i < CELLS; i++) {
    const c = s.cells[i];
    if (c?.kind !== 'item' || !useful(c.chain, c.tier)) continue;
    const k = `${c.chain}${c.tier}`;
    if (first.has(k)) return { do: 'drag', from: i, to: first.get(k)! };
    first.set(k, i);
  }
  const free = s.cells.filter((c) => !c).length;
  if (free < 8) {
    const junk = s.cells.findIndex((c) => c?.kind === 'item' && !useful(c.chain, c.tier) && !s.orders.some((o) => o.wants.some((w) => w.chain === c.chain && w.tier === c.tier)));
    if (junk >= 0) return { do: 'sell', at: junk };
    const any = s.cells.findIndex((c) => c?.kind === 'item');
    if (free === 0 && any >= 0) return { do: 'sell', at: any };
  }
  if (!goals.length) return { do: 'wait' };
  if (s.energy < 1) return s.coins >= ENERGY_PRICE.coins ? { do: 'buy' } : { do: 'wait' };
  const goal = goals.sort((x, y) => x.tier - y.tier)[0];
  return { do: 'tap', at: s.cells.findIndex((c) => c?.kind === 'source' && c.chain === goal.chain) };
}
export function apply(s: State, m: Move): void {
  if (m.do === 'serve') serve(s, m.order);
  else if (m.do === 'drag') drag(s, m.from, m.to);
  else if (m.do === 'tap') tap(s, m.at);
  else if (m.do === 'sell') sell(s, m.at);
  else if (m.do === 'buy') buyEnergy(s);
}
