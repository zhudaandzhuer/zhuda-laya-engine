// Neutral scripted rounds for the fixture pipeline, on the example symbols (1–8 shapes,
// 0 scatter ring, 9 multiplier ball). Amounts are the example paytable in points per 10 of
// bet (symbol 8 × 8 pays 4 at bet 10, as the engine does). Made up for demos and tests.
import { exampleConfig } from './example-config.ts';
import type { FixtureDefinition, FixtureMathConfig } from './fixture-pipeline.ts';

const grids: Record<string, Omit<FixtureDefinition, 'key' | 'board'>> = {
  empty: {
    label: '沒有 8 個相同',
    grid: [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6],
    orbs: [],
    bonus: [],
  },
  small: {
    label: '灰十字 × 8',
    grid: [8, 1, 2, 8, 3, 4, 5, 8, 6, 7, 8, 1, 2, 3, 8, 4, 5, 6, 8, 7, 1, 2, 8, 3, 4, 5, 6, 8, 7, 1],
    orbs: [],
    bonus: [],
  },
  double: {
    label: '綠菱 × 9 ＋ 藍水滴 × 9，倍數 ×5',
    grid: [4, 6, 1, 4, 6, 2, 3, 4, 6, 9, 4, 6, 4, 2, 6, 4, 1, 6, 5, 4, 6, 3, 4, 7, 6, 4, 1, 6, 2, 5],
    orbs: [5],
    bonus: [],
  },
  feature: {
    label: '4 個金環進入獎勵，紅圓 × 9',
    grid: [0, 1, 2, 1, 3, 1, 4, 1, 0, 5, 1, 6, 7, 1, 8, 0, 2, 1, 3, 4, 1, 5, 0, 6, 1, 7, 8, 2, 3, 4],
    orbs: [],
    bonus: [
      [3, 3, 3, 1, 3],
      [0, 0, 0, 0, 0],
      [5, 5, 5, 5, 5],
    ],
  },
};

export function exampleFixtureConfig(): FixtureMathConfig {
  const names = exampleConfig().names;
  const fixtures: Record<string, FixtureDefinition> = {};
  for (const [key, f] of Object.entries(grids)) fixtures[key] = { key, board: f.grid.slice(0, 15), ...f };
  return {
    cols: 6,
    rows: 5,
    boardSize: 15,
    paySymbols: [1, 2, 3, 4, 5, 6, 7, 8],
    scatterSymbol: 0,
    minMatch: 8,
    tierMins: [8, 11, 14],
    paytable: { 1: [60, 150, 300], 2: [30, 80, 200], 3: [25, 60, 120], 4: [16, 40, 90], 5: [12, 25, 60], 6: [8, 20, 50], 7: [6, 15, 30], 8: [4, 10, 25] },
    payScale: (bet) => Math.floor(bet / 10),
    totalBet: (bet) => bet,
    bets: [10, 20, 50, 100],
    opportunities: (n) => (n >= 4 ? 2 : 0),
    randomMin: 1,
    randomCount: 8,
    fillerPool: [5, 6, 7, 8, 3],
    fillerIndex: (col, row, seed) => col * 5 + row * 11 + seed,
    fallbackWinIndices: [0, 1, 2, 6, 7, 8, 12, 13],
    fallbackPath: [0, 1, 2],
    waveSeedStep: 31,
    multiplierMin: 2,
    multiplierMax: 100,
    maxWinMultiplier: 5000,
    defaultSeed: 1,
    fixtures,
    defaultFixture: 'small',
    awardLabel: (count, symbol) => `${names[symbol] ?? symbol} ×${count}`,
    multipliedLabel: (label, m) => `${label}（×${m}）`,
    capLabel: (x) => `封頂 ${x}×`,
    bonusTable: [
      { cost: 1, match: 0, full: 10 },
      { cost: 0, match: 20, full: 200 },
      { cost: 0, match: 12, full: 150 },
      { cost: 0, match: 8, full: 120 },
      { cost: 0, match: 6, full: 100 },
      { cost: 0, match: 4, full: 80 },
      { cost: 0, match: 3, full: 60 },
      { cost: 0, match: 2, full: 50 },
      { cost: 0, match: 1, full: 40 },
    ],
    bonusFallbackTarget: 8,
    bonusSlots: 4,
    bonusCostTarget: 0,
  };
}
