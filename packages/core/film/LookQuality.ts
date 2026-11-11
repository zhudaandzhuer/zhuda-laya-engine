/**
 * Quality levels of a look: what a game drops, in order, to stay inside its
 * frame budget. Pure; `ZhudaSceneLook` applies the result.
 */
import type { ZhudaResolvedFilmLook } from './FilmScene.ts';

/** 3 is the look as authored; lower levels drop the most expensive parts first. */
export type ZhudaLookQuality = 0 | 1 | 2 | 3;
export const ZHUDA_LOOK_QUALITY_LEVELS = 4;

/**
 * The look at a quality level:
 * 3 as authored; 2 without ambient occlusion, shorter beams, 2048 shadows;
 * 1 without beams and lens finish, two shadow cascades;
 * 0 without the HDR chain at all (no bloom, no grade), one small shadow map.
 */
export function zhudaLookForQuality(
  look: ZhudaResolvedFilmLook,
  level: ZhudaLookQuality,
): ZhudaResolvedFilmLook {
  if (![0, 1, 2, 3].includes(level)) throw Error('Look quality: use 0, 1, 2 or 3');
  const next = structuredClone(look);
  if (level === 3) return next;
  if (next.shadows) {
    const cap = level === 0 ? 1024 : 2048;
    if (next.shadows.resolution > cap) next.shadows.resolution = cap;
    if (level === 1) next.shadows.cascades = Math.min(next.shadows.cascades, 2) as 1 | 2 | 4;
    if (level === 0) {
      next.shadows.cascades = 1;
      next.shadows.distance = Math.min(next.shadows.distance, 40);
    }
  }
  if (level === 0) {
    next.grade = false;
    next.lightFog = false;
    return next;
  }
  if (next.grade) {
    next.grade.ao = 0;
    if (level === 1) next.grade.grain = next.grade.vignette = next.grade.fringe = 0;
  }
  if (next.lightFog && next.lightFog.shafts) {
    if (level === 1) next.lightFog.shafts = false;
    else next.lightFog.shafts.steps = Math.max(12, Math.round(next.lightFog.shafts.steps / 2));
  }
  return next;
}
