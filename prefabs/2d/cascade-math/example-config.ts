// A neutral, made-up cascade configuration (the same as slotmath.ExampleConfig in Go, strip
// for strip): 6×5 grid, eight shape symbols paying from 8 anywhere (tiers 8 / 11 / 14), a
// scatter ring (4+ → 12 free spins, 3 in free spins → +4), a multiplier ball ×2–×100, cap
// 5000×. Its numbers belong to no real game; measured RTP ≈ 93 % (see README). For demos,
// tests and as a template.
import type { CascadeConfig } from './config.ts';
import { buildStrip } from './rng.ts';

export const EXAMPLE_SCATTER = 0;
export const EXAMPLE_MULTIPLIER = 9;

function strips(base: Record<number, number>, extra: Array<Record<number, number>>, seed: number): number[][] {
  return extra.map((more, c) => {
    const counts: Record<number, number> = { ...base };
    for (const [k, v] of Object.entries(more)) counts[Number(k)] = (counts[Number(k)] ?? 0) + v;
    return buildStrip(counts, (seed + c * 101) >>> 0);
  });
}

export function exampleConfig(): CascadeConfig {
  const base = { 1: 10, 2: 11, 3: 12, 4: 13, 5: 14, 6: 15, 7: 16, 8: 17 };
  const free = { 1: 10, 2: 11, 3: 12, 4: 13, 5: 14, 6: 15, 7: 16, 8: 17 };
  const refill = { 1: 8, 2: 8, 3: 9, 4: 9, 5: 10, 6: 10, 7: 11, 8: 11 };
  const t = (a: number, b: number, c: number) => [
    { min: 8, pay: a },
    { min: 11, pay: b },
    { min: 14, pay: c },
  ];
  return {
    gameId: 'cascade-example',
    cols: 6,
    rows: 5,
    paySymbols: [1, 2, 3, 4, 5, 6, 7, 8],
    paytable: { 1: t(600, 1500, 3000), 2: t(300, 800, 2000), 3: t(250, 600, 1200), 4: t(160, 400, 900), 5: t(120, 250, 600), 6: t(80, 200, 500), 7: t(60, 150, 300), 8: t(40, 100, 250) },
    minMatch: 8,
    scatterSymbol: EXAMPLE_SCATTER,
    multiplierSymbol: EXAMPLE_MULTIPLIER,
    scatterPays: [
      { min: 4, pay: 200 },
      { min: 5, pay: 500 },
      { min: 6, pay: 2000 },
    ],
    freeSpinsTrigger: 4,
    freeSpinsAward: 12,
    retriggerScatters: 3,
    retriggerAward: 4,
    maxWinMultiplier: 5000,
    defaultBet: 10,
    anteCostPercent: 150,
    buyCostMultiplier: 80,
    buyScatterCells: [2, 9, 16, 23],
    baseReels: strips(base, [{ 0: 3 }, { 0: 3, 9: 1 }, { 0: 3 }, { 0: 3, 9: 1 }, { 0: 3 }, { 0: 3, 9: 1 }], 1001),
    freeReels: strips(free, [{ 0: 2, 9: 2 }, { 0: 2, 9: 2 }, { 0: 2, 9: 2 }, { 0: 2, 9: 2 }, { 0: 2, 9: 2 }, { 0: 2, 9: 2 }], 2002),
    refillReels: strips(refill, [{ 0: 1 }, { 9: 1 }, { 0: 1 }, { 9: 1 }, { 0: 1 }, { 9: 1 }], 3003),
    multiplierWeights: [
      { value: 2, weight: 400 },
      { value: 3, weight: 250 },
      { value: 5, weight: 150 },
      { value: 10, weight: 60 },
      { value: 25, weight: 20 },
      { value: 50, weight: 6 },
      { value: 100, weight: 2 },
    ],
    freeMultiplierWeights: [
      { value: 2, weight: 300 },
      { value: 3, weight: 220 },
      { value: 5, weight: 170 },
      { value: 10, weight: 90 },
      { value: 25, weight: 40 },
      { value: 50, weight: 15 },
      { value: 100, weight: 5 },
    ],
    names: { 0: '金環', 1: '紅圓', 2: '橙方', 3: '黃三角', 4: '綠菱', 5: '青六角', 6: '藍水滴', 7: '紫月', 8: '灰十字', 9: '倍數球' },
  };
}
