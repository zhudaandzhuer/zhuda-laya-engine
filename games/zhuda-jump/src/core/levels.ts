// 豬大跳跳 — the levels. Each is laid out by a few lines of data and turned into rows of
// characters (what the rules read):
//   #  earth     =  a ledge (solid)     ^  spikes (deadly)     o  a coin
//   e  a walker (turns at walls and edges)     P  where 豬大 starts     F  the flag
// The ground is two rows deep with its top at row 8 of 10. A jump rises 2.5 tiles and carries
// 4.2: ledges sit two rows above what they are reached from, pits are at most three tiles wide,
// and nothing solid hangs within five columns of spikes or a pit (a jump there would hit it).
export interface LevelDef {
  id: string;
  name: string;
  rows: string[];
}
const ROWS = 10, GROUND = 8;

interface Plan {
  id: string;
  name: string;
  width: number;
  /** Columns where the ground is missing: [from, width]. */
  pits: [number, number][];
  /** Blocks of earth standing on the ground: [column, width, height]. */
  steps?: [number, number, number][];
  /** Ledges: [column, width, rows above the ground's top (2 = reachable from the ground)]. */
  ledges?: [number, number, number][];
  spikes?: [number, number][];
  walkers?: number[];
  /** Coins: [column, rows above the ground's top]. */
  coins?: [number, number][];
}

function build(p: Plan): LevelDef {
  const grid = Array.from({ length: ROWS }, () => Array<string>(p.width).fill(' '));
  const set = (col: number, row: number, c: string) => {
    if (col < 0 || col >= p.width || row < 0 || row >= ROWS) throw Error(`${p.id}: ${c} at ${col},${row} is outside the level`);
    grid[row][col] = c;
  };
  for (let col = 0; col < p.width; col++) if (!p.pits.some(([from, w]) => col >= from && col < from + w)) for (let row = GROUND; row < ROWS; row++) set(col, row, '#');
  for (const [col, w, h] of p.steps ?? []) for (let i = 0; i < w; i++) for (let k = 1; k <= h; k++) set(col + i, GROUND - k, '#');
  for (const [col, w, up] of p.ledges ?? []) for (let i = 0; i < w; i++) set(col + i, GROUND - up - 1, '=');
  for (const [col, w] of p.spikes ?? []) for (let i = 0; i < w; i++) set(col + i, GROUND - 1, '^');
  for (const col of p.walkers ?? []) set(col, GROUND - 1, 'e');
  for (const [col, up] of p.coins ?? []) set(col, GROUND - 1 - up, 'o');
  set(1, GROUND - 1, 'P');
  set(p.width - 3, GROUND - 1, 'F');
  return { id: p.id, name: p.name, rows: grid.map((r) => r.join('')) };
}

export const LEVELS: LevelDef[] = [
  build({
    id: 'meadow', name: '竹原小徑', width: 72,
    pits: [[24, 3], [53, 3]],
    steps: [[19, 2, 1], [62, 2, 1]],
    ledges: [[8, 5, 2], [34, 5, 2]],
    spikes: [[44, 2]],
    walkers: [13, 31, 49],
    coins: [[5, 0], [7, 0], [9, 3], [11, 3], [25, 2], [35, 3], [37, 3], [45, 2], [54, 2], [66, 0]],
  }),
  build({
    id: 'ridge', name: '山口石階', width: 84,
    pits: [[26, 3], [45, 3], [66, 3]],
    steps: [[14, 2, 1], [16, 2, 2], [36, 3, 1], [58, 2, 1], [60, 3, 2]],
    ledges: [[6, 4, 2], [51, 4, 2], [72, 4, 2]],
    spikes: [[21, 2], [41, 2], [78, 2]],
    walkers: [10, 31, 55],
    coins: [[7, 3], [8, 3], [17, 3], [27, 2], [37, 2], [46, 2], [52, 3], [53, 3], [61, 3], [67, 2], [73, 3], [74, 3]],
  }),
  build({
    id: 'ash', name: '常羊焦土', width: 92,
    pits: [[12, 3], [30, 3], [48, 3], [64, 3], [82, 3]],
    steps: [[19, 2, 1], [21, 2, 2], [36, 2, 1], [38, 2, 2], [55, 3, 1], [71, 2, 1], [73, 2, 2]],
    spikes: [[8, 2], [26, 2], [44, 3], [60, 2], [77, 2]],
    walkers: [17, 34, 68],
    coins: [[3, 0], [5, 0], [13, 2], [22, 3], [31, 2], [39, 3], [45, 2], [49, 2], [56, 2], [65, 2], [74, 3], [83, 2], [88, 0]],
  }),
];
