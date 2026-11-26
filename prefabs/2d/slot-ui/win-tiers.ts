// Win tiers by win ÷ bet, for the celebration and the receipt. Pure TypeScript.
// The source used two tables (celebration 10/50/100, receipt 10/20/35/60/100) with its own
// names; here the table and the names are the caller's, with neutral defaults.

export interface WinTier {
  id: string;
  /** Smallest win ÷ bet. */
  min: number;
  label: string;
  /** Count-up length of the celebration. */
  countMs: number;
}

export const DEFAULT_WIN_TIERS: WinTier[] = [
  { id: 'big', min: 10, label: '大獎', countMs: 1000 },
  { id: 'great', min: 25, label: '巨獎', countMs: 1600 },
  { id: 'huge', min: 50, label: '超級大獎', countMs: 2200 },
  { id: 'legend', min: 100, label: '傳奇大獎', countMs: 3000 },
];

/** The highest tier the win reaches, or null under the first. */
export function winTier(win: number, bet: number, tiers: WinTier[] = DEFAULT_WIN_TIERS): WinTier | null {
  const ratio = win / Math.max(1, bet);
  let hit: WinTier | null = null;
  for (const t of [...tiers].sort((a, b) => a.min - b.min)) if (ratio >= t.min) hit = t;
  return hit;
}
