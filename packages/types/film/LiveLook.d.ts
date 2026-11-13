// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaFilmicPipeline } from '../runtime3d/Filmic.js';
import type { ZhudaLightFog } from '../runtime3d/LightFog.js';
import type { ZhudaScreenReflections } from '../runtime3d/ScreenReflections.js';
import type { ZhudaLensFinish } from '../runtime3d/LensFinish.js';
import type { ZhudaFilmVec3, ZhudaResolvedFilmLook } from './FilmScene.js';
/** What `applyResolvedFilmLook` built, kept so a later look can adjust it in place. */
export interface ZhudaAppliedLookParts {
    lightFog?: ZhudaLightFog;
    reflections?: ZhudaScreenReflections;
    sky?: any;
    film?: ZhudaFilmicPipeline;
    finish?: ZhudaLensFinish;
}
/** Unit vector from the scene toward the light (the light travels along its forward axis). */
export declare function zhudaTowardSun(l: any, sun: any): [number, number, number];
/** Linear sun colour times intensity, as water and light shafts take it. */
/** The sun's light for shaders of this engine (beams in the fog, the glint on water). */
export declare const zhudaSunRadiance: (look: ZhudaResolvedFilmLook) => [number, number, number];
/** Sky and ground light; its texture is made once and recoloured in place. */
export declare class ZhudaHemisphereAmbientSlot {
    private restore;
    private colours;
    private readonly scene3D;
    constructor(scene3D: any);
    set(ambient: ZhudaFilmVec3, ground: ZhudaFilmVec3 | false): void;
    release(): void;
}
/**
 * Applies the continuous parts of `look` to what is already built. The caller
 * has checked with `zhudaFilmLookRebuildReason` that nothing structural differs.
 */
export declare function updateZhudaLookInPlace(l: any, target: {
    scene3D: any;
    camera: any;
    sun: any;
    parts: ZhudaAppliedLookParts;
}, look: ZhudaResolvedFilmLook): void;
