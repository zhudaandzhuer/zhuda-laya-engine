// Picture settings: one setting decides the look's level, the resolution, the
// grass and the particles together. `?fx=low|mid|high|max` picks it from the
// address; without it a phone starts low and anything else mid, so nobody's
// first frame is the heaviest one. While playing, frames that run long step
// down (resolution first, then the look, then the grass) and step back up to
// the chosen setting when there is room again.
//
// The look, resolution and particle shares are the same for every scene; the
// grass is the scene's own (how dense, how far), given to makeTiers().
// Wire the steps to the engine's ZhudaQualityGovernor (levels = ladder length).
import type { ZhudaLookQuality } from 'zhuda-laya-engine';

export interface Tier {
  id: 'low' | 'mid' | 'high' | 'max';
  label: string;
  look: ZhudaLookQuality;
  /** Device pixels a CSS pixel, at most (set once, at start). */
  dpr: number;
  /** Blades a square metre, and how far from the camera grass is drawn. */
  grass: { density: number; distanceM: number };
  /** Share of rain, splashes, motes and fireflies drawn. */
  particles: number;
}

export type TierGrass = Tier['grass'];

/** The four settings with a scene's grass for low, mid, high and max. */
export function makeTiers(grass: readonly [TierGrass, TierGrass, TierGrass, TierGrass]): Tier[] {
  return [
    { id: 'low', label: '低', look: 1, dpr: 1, grass: grass[0], particles: 0.35 },
    { id: 'mid', label: '中', look: 2, dpr: 1.25, grass: grass[1], particles: 0.6 },
    { id: 'high', label: '高', look: 3, dpr: 1.5, grass: grass[2], particles: 1 },
    { id: 'max', label: '滿', look: 3, dpr: 1.5, grass: grass[3], particles: 1 },
  ];
}

/**
 * The floating island's grass: it is 17 m across and grass grows only on it, so a long
 * reach costs nothing beyond it and keeps grass in view from a far (phone) camera.
 */
export const SKY_ISLAND_GRASS = [
  { density: 300, distanceM: 70 },
  { density: 600, distanceM: 70 },
  { density: 900, distanceM: 70 },
  { density: 1100, distanceM: 70 },
] as const satisfies readonly TierGrass[];

/** The garden island's grass: a 100 m island walked close up, so less of it, nearer. */
export const GARDEN_ISLAND_GRASS = [
  { density: 90, distanceM: 28 },
  { density: 170, distanceM: 38 },
  { density: 260, distanceM: 48 },
  { density: 340, distanceM: 60 },
] as const satisfies readonly TierGrass[];

/** Tier ids in order; startTier() reads `?fx=` against these. */
export const TIER_IDS: Tier['id'][] = ['low', 'mid', 'high', 'max'];

/** A rung of the ladder the frame budget moves along: a setting and how large the 3D picture is drawn. */
export interface Step {
  tier: number;
  renderScale: number;
}

/** The rungs from the cheapest up to `ceiling` (a tier index). */
export function ladder(ceiling: number): Step[] {
  const all: Step[] = [
    { tier: 0, renderScale: 0.6 },
    { tier: 0, renderScale: 0.75 },
    { tier: 1, renderScale: 0.85 },
    { tier: 2, renderScale: 1 },
    { tier: 3, renderScale: 1 },
  ];
  // The chosen setting's own rung is its top; for low, both of its rungs remain.
  return all.filter((s) => s.tier < ceiling || (s.tier === ceiling && (s.renderScale === 1 || ceiling <= 1)));
}

/** Whether this looks like a phone or a small tablet (touch only, or a small screen). */
export function looksLikePhone(): boolean {
  try {
    const coarse = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
    return coarse || Math.min(screen.width, screen.height) < 520;
  } catch {
    return false;
  }
}

/** The setting to start with: the address's `fx`, else low on a phone and mid elsewhere. */
export function startTier(params: URLSearchParams, phone = looksLikePhone()): { tier: number; fromAddress: boolean } {
  const asked = TIER_IDS.indexOf(params.get('fx') as Tier['id']);
  if (asked >= 0) return { tier: asked, fromAddress: true };
  return { tier: phone ? 0 : 1, fromAddress: false };
}
