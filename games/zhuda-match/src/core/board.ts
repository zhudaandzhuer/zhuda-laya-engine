// 豬大果園 — a match-three board, pure and seeded: swap two neighbours, lines of three or more
// burst, what is above falls, new fruit drops in, and chains follow. Four in a line leave a
// lightning fruit (it clears its row and column when burst); five leave a star (swapped with a
// fruit, it clears every fruit of that kind). Tested in test/board.test.ts.

export const SIZE = 8;
export const KINDS = 6;
export type Special = 'none' | 'bolt' | 'star';
export interface Cell { kind: number; special: Special; id: number }
/** What happened in one round of a move, for the screen to play back in order. */
export interface Round {
  /** Cells that burst (indices), and the points for them. */
  burst: number[];
  points: number;
  /** Specials made this round: where and what. */
  made: { at: number; special: Special; kind: number }[];
  /** After the burst: every cell's fruit id → the index it ends at; ids not seen before are new fruit (dropped in from above). */
  after: Cell[];
}
export interface LevelDef { id: string; name: string; moves: number; target: number; kinds: number }
export const LEVELS: LevelDef[] = [
  { id: 'l1', name: '第一園', moves: 16, target: 1000, kinds: 5 },
  { id: 'l2', name: '第二園', moves: 20, target: 2400, kinds: 5 },
  { id: 'l3', name: '第三園', moves: 22, target: 3000, kinds: 6 },
  { id: 'l4', name: '第四園', moves: 24, target: 4400, kinds: 6 },
];

const idx = (x: number, y: number) => y * SIZE + x;

export class Board {
  cells: Cell[] = [];
  score = 0;
  movesLeft: number;
  shuffles = 0;
  readonly level: LevelDef;
  private seed: number;
  private nextId = 1;

  constructor(level: LevelDef, seed = 1) {
    this.level = level;
    this.movesLeft = level.moves;
    this.seed = seed >>> 0;
    // Filled without a line of three and with at least one move to make.
    do {
      this.cells = [];
      for (let i = 0; i < SIZE * SIZE; i++) {
        let kind: number;
        do kind = this.pick();
        while ((i % SIZE >= 2 && this.cells[i - 1].kind === kind && this.cells[i - 2].kind === kind) || (i >= 2 * SIZE && this.cells[i - SIZE].kind === kind && this.cells[i - 2 * SIZE].kind === kind));
        this.cells.push({ kind, special: 'none', id: this.nextId++ });
      }
    } while (!this.hint());
  }
  private random(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private pick(): number {
    return Math.floor(this.random() * this.level.kinds);
  }
  get state(): 'play' | 'won' | 'lost' {
    return this.score >= this.level.target ? 'won' : this.movesLeft <= 0 ? 'lost' : 'play';
  }

  /** One to three once won: by how many moves were left over. */
  stars(): number {
    return this.state !== 'won' ? 0 : this.movesLeft >= this.level.moves * 0.3 ? 3 : this.movesLeft >= this.level.moves * 0.1 ? 2 : 1;
  }
  /** Runs of three or more in rows and columns: each as its cells, in order. */
  static runs(cells: readonly Cell[]): number[][] {
    const out: number[][] = [];
    for (const [dx, dy] of [[1, 0], [0, 1]])
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const k = cells[idx(x, y)].kind;
          if (k < 0) continue;
          const px = x - dx, py = y - dy;
          if (px >= 0 && py >= 0 && cells[idx(px, py)].kind === k) continue; // not the start of its run
          const run = [idx(x, y)];
          for (let nx = x + dx, ny = y + dy; nx < SIZE && ny < SIZE && cells[idx(nx, ny)].kind === k; nx += dx, ny += dy) run.push(idx(nx, ny));
          if (run.length >= 3) out.push(run);
        }
    return out;
  }
  static adjacent(a: number, b: number): boolean {
    const ax = a % SIZE, ay = Math.floor(a / SIZE), bx = b % SIZE, by = Math.floor(b / SIZE);
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }
  /** Whether swapping these two would burst anything. */
  legal(a: number, b: number): boolean {
    if (!Board.adjacent(a, b)) return false;
    if (this.cells[a].special === 'star' || this.cells[b].special === 'star') return true;
    const c = [...this.cells];
    [c[a], c[b]] = [c[b], c[a]];
    return Board.runs(c).length > 0;
  }
  /** A swap that bursts something, or null when the board has none. */
  hint(): [number, number] | null {
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (i % SIZE < SIZE - 1 && this.legal(i, i + 1)) return [i, i + 1];
      if (i < SIZE * (SIZE - 1) && this.legal(i, i + SIZE)) return [i, i + SIZE];
    }
    return null;
  }

  /** Makes a move. Returns the rounds it set off, or null when the swap bursts nothing (the fruit go back). */
  move(a: number, b: number): Round[] | null {
    if (this.state !== 'play' || !this.legal(a, b)) return null;
    const c = this.cells;
    [c[a], c[b]] = [c[b], c[a]];
    this.movesLeft -= 1;
    const rounds: Round[] = [];
    // A star swapped with a fruit clears every fruit of that kind (and itself).
    const star = c[a].special === 'star' ? a : c[b].special === 'star' ? b : -1;
    if (star >= 0) {
      const kind = c[star === a ? b : a].kind;
      const burst = c.map((cell, i) => (cell.kind === kind || i === star ? i : -1)).filter((i) => i >= 0);
      rounds.push(this.settle(new Set(burst), [], 1));
    }
    for (let chain = rounds.length + 1; ; chain++) {
      const runs = Board.runs(c);
      if (!runs.length) break;
      const burst = new Set<number>(runs.flat());
      // A run of four or five leaves a special where the player's fruit landed (or in the run's middle).
      const made: Round['made'] = [];
      for (const run of runs) {
        if (run.length < 4) continue;
        const at = run.includes(a) && chain === 1 ? a : run.includes(b) && chain === 1 ? b : run[Math.floor(run.length / 2)];
        made.push({ at, special: run.length >= 5 ? 'star' : 'bolt', kind: c[at].kind });
      }
      rounds.push(this.settle(burst, made, chain));
    }
    // A board with nothing to do is shuffled (the same fruit, new places) until it has a move and no line.
    if (!this.hint()) {
      this.shuffles += 1;
      do
        for (let i = c.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [c[i], c[j]] = [c[j], c[i]];
        }
      while (Board.runs(c).length || !this.hint());
    }
    return rounds;
  }

  /** Bursts cells (and what their bolts reach), scores them, drops the rest and fills from above. */
  private settle(burst: Set<number>, made: Round['made'], chain: number): Round {
    const c = this.cells;
    // Bolts caught in the burst clear their row and column; those may catch more bolts.
    const queue = [...burst];
    while (queue.length) {
      const i = queue.pop()!;
      if (c[i].special !== 'bolt') continue;
      const x = i % SIZE, y = Math.floor(i / SIZE);
      for (let k = 0; k < SIZE; k++) for (const j of [idx(k, y), idx(x, k)]) if (!burst.has(j)) (burst.add(j), queue.push(j));
    }
    const points = burst.size * 10 * Math.min(chain, 3) + (burst.size > 3 ? (burst.size - 3) * 10 : 0);
    this.score += points;
    for (const i of burst) c[i] = { kind: -1, special: 'none', id: 0 };
    for (const m of made) c[m.at] = { kind: m.special === 'star' ? KINDS : m.kind, special: m.special, id: this.nextId++ };
    // Gravity, column by column, then new fruit.
    for (let x = 0; x < SIZE; x++) {
      const kept: Cell[] = [];
      for (let y = SIZE - 1; y >= 0; y--) if (c[idx(x, y)].kind >= 0) kept.push(c[idx(x, y)]);
      for (let y = SIZE - 1, k = 0; y >= 0; y--, k++) c[idx(x, y)] = kept[k] ?? { kind: this.pick(), special: 'none', id: this.nextId++ };
    }
    return { burst: [...burst].sort((p, q) => p - q), points, made, after: c.map((cell) => ({ ...cell })) };
  }
}

/** The move that scores most at once: a copy of the board is played for each, with other fruit dropping in than
 * really will. For tests and recorded runs. */
export function bestMove(board: Board): [number, number] | null {
  let best: [number, number] | null = null, bestScore = -1;
  for (let i = 0; i < SIZE * SIZE; i++)
    for (const j of [i + 1, i + SIZE]) {
      if (j >= SIZE * SIZE || !board.legal(i, j)) continue;
      const copy = clone(board);
      (copy as any).seed = ((copy as any).seed ^ 0x9e3779b9) >>> 0; // it cannot know which fruit will drop in
      copy.move(i, j);
      if (copy.score > bestScore) (bestScore = copy.score), (best = [i, j]);
    }
  return best;
}
export function clone(board: Board): Board {
  const copy = Object.create(Board.prototype) as Board;
  Object.assign(copy, board, { cells: board.cells.map((c) => ({ ...c })) });
  return copy;
}
