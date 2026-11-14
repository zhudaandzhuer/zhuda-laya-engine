// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaFilmLook } from './FilmScene.js';
import { type ZhudaLookQuality } from './LookQuality.js';
import { type ZhudaRenderScaleOptions, type ZhudaUpscale } from '../runtime3d/RenderScale.js';
import type { ZhudaQualityStep } from '../runtime3d/QualityGovernor.js';
export interface ZhudaSceneLookOptions extends ZhudaRenderScaleOptions {
    /** Quality level to start at (default 3, the look as authored). */
    quality?: ZhudaLookQuality;
    /**
     * Size the 3D picture is drawn at against the canvas, 0.5..1 (default 1),
     * brought up to it by `upscale` with `sharpness` (see `ZhudaRenderScale`).
     * Below 1 the look holds the stage's one render scale.
     */
    scale?: number;
}
export declare class ZhudaSceneLook {
    /** The directional light of the look (`look.sun`). */
    readonly sun: any;
    private look;
    private parts;
    private readonly sunNode;
    private cleanups;
    private lightFog;
    /** How long the clouds have drifted, in seconds. */
    private cloudSeconds;
    private level;
    private frame;
    private disposed;
    private readonly hemisphere;
    /** The render scale, made when the picture is first drawn below full size. */
    private renderScale;
    private scaling;
    private readonly scene3D;
    private readonly camera;
    constructor(scene3D: any, camera: any, look: ZhudaFilmLook, options?: ZhudaSceneLookOptions);
    get quality(): ZhudaLookQuality;
    /** Size of the 3D picture against the canvas (1 is full size). */
    get scale(): number;
    /** How a picture drawn smaller reaches the canvas. */
    get upscale(): ZhudaUpscale;
    /**
     * Draws the 3D picture at `scale` of the canvas from the next frame,
     * 0.5..1, cheap enough to change at any time (nothing is rebuilt); the
     * upscale and sharpness can change with it. Below 1 the look holds the
     * stage's one render scale (`ZhudaRenderScale`): a second look that does
     * so is refused.
     */
    setRenderScale(scale: number, options?: Omit<ZhudaRenderScaleOptions, 'scale'>): void;
    /**
     * Moves to a rung of a quality ladder (`zhudaQualitySteps`): its look
     * level and its render scale.
     */
    setStep(step: ZhudaQualityStep): void;
    /**
     * Draws the sun's shadow maps on the next frame, for a look whose
     * `shadows.update` is 'interval' or 'manual' (a caster moved, the camera
     * went elsewhere). Nothing to do when they are drawn every frame.
     */
    redrawShadows(): void;
    /** Unit vector from the scene toward the sun, for water and other surfaces that glint. */
    get towardSun(): [number, number, number];
    /**
     * Changes the look while the game runs (a day passing, weather turning),
     * at the current quality level. A rejected look changes nothing. When only
     * continuous values differ (see `zhudaFilmLookRebuildReason`) they are set
     * in place, cheap enough for every frame, and `'updated'` is returned;
     * otherwise the look is rebuilt and `'rebuilt'` is returned. A panorama or
     * environment probe is refused, as in the constructor.
     */
    setLook(look: ZhudaFilmLook): 'updated' | 'rebuilt';
    /** Rebuilds the look at another level; nothing happens when it is the current one. */
    setQuality(level: ZhudaLookQuality): void;
    /**
     * Call every frame after the camera has moved. `frameSeconds` is the time
     * since the frame before (default 1/60): how far automatic exposure adapts.
     */
    update(eye: readonly [number, number, number], target: readonly [number, number, number], fieldOfViewDeg: number, aspect: number, frameSeconds?: number): void;
    dispose(): void;
    /** At full size the stage's render scale is given back; below it is taken (once). */
    private scaleTo;
    private updateInPlace;
    private apply;
    private release;
}
