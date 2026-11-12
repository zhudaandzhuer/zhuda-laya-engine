// Generated from TypeScript source; run npm run types:generate.
/**
 * Quality levels of a look: what a game drops, in order, to stay inside its
 * frame budget. Pure; `ZhudaSceneLook` applies the result.
 */
import type { ZhudaResolvedFilmLook } from './FilmScene.js';
/** 3 is the look as authored; lower levels drop the most expensive parts first. */
export type ZhudaLookQuality = 0 | 1 | 2 | 3;
export declare const ZHUDA_LOOK_QUALITY_LEVELS = 4;
/**
 * The look at a quality level:
 * 3 as authored; 2 without ambient occlusion, shorter beams, 2048 shadows;
 * 1 without beams and lens finish, two shadow cascades;
 * 0 without the HDR chain at all (no bloom, no grade), one small shadow map.
 * `options.keepGrade`: at level 0 keep a bare HDR chain (tone mapping only)
 * instead of none. A scene with a water surface needs it: the water draws in HDR.
 */
export declare function zhudaLookForQuality(look: ZhudaResolvedFilmLook, level: ZhudaLookQuality, options?: {
    keepGrade?: boolean;
}): ZhudaResolvedFilmLook;
