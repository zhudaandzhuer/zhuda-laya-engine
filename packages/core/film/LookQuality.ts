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
 * 3 as authored; 2 without ambient occlusion, shorter beams and reflection
 * rays, 2048 shadows; 1 without beams, screen reflections, lens finish and
 * multisampling, two shadow cascades;
 * 0 without the HDR chain at all (no bloom, no grade), one small shadow map.
 * `options.keepGrade`: at level 0 keep a bare HDR chain (tone mapping only)
 * instead of none. A scene with a water surface needs it: the water draws in HDR.
 */
export function zhudaLookForQuality(
  look: ZhudaResolvedFilmLook,
  level: ZhudaLookQuality,
  options: { keepGrade?: boolean } = {},
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
    next.lightFog = false;
    next.screenReflections = false;
    next.bounceLight = false;
    if (options.keepGrade && next.grade)
      next.grade.bloom =
        next.grade.ao =
        next.grade.grain =
        next.grade.vignette =
        next.grade.fringe =
          0;
    else next.grade = false;
    if (next.grade) next.grade.antialias = 'none';
    return next;
  }
  if (next.grade) {
    next.grade.ao = 0;
    if (level === 1) {
      next.grade.grain = next.grade.vignette = next.grade.fringe = 0;
      next.grade.antialias = 'none';
    }
  }
  if (next.screenReflections) {
    if (level === 1) next.screenReflections = false;
    else
      next.screenReflections.steps = Math.max(8, Math.round(next.screenReflections.steps / 2));
  }
  if (next.lightFog && next.lightFog.shafts) {
    if (level === 1) next.lightFog.shafts = false;
    else next.lightFog.shafts.steps = Math.max(12, Math.round(next.lightFog.shafts.steps / 2));
  }
  return next;
}
