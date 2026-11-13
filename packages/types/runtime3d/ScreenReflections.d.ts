// Generated from TypeScript source; run npm run types:generate.
/**
 * Reflections of what is on screen, on every surface: wet walls, props, and
 * ground beyond a planar reflector. A post-process effect in linear HDR, after
 * ambient occlusion and before fog.
 *
 * A forward renderer has no roughness or normal buffer, so the whole view
 * reflects alike and by Fresnel: strongly at grazing angles, faintly head-on.
 * That is the look of rain and of polished places; it is not a substitute for
 * materials that differ. What is off screen, hidden behind something or behind
 * the camera is not reflected, and the sky is not (a ray that leaves the
 * picture finds nothing).
 */
export interface ZhudaScreenReflectionsOptions {
    /** Brightness of the reflections, 0..4 (default 1). */
    strength?: number;
    /** How wet the surfaces are, 0..1: how much shows when seen head-on (default 0.5). */
    wetness?: number;
    /** Metres a reflected ray is followed, 1..200 (default 30). */
    distance?: number;
    /** Steps along the ray, 8..64 (default 32). Fewer are cheaper and coarser. */
    steps?: number;
}
export declare const ZHUDA_SCREEN_REFLECTION_MAX_STEPS = 64;
export declare function validateZhudaScreenReflections(options: ZhudaScreenReflectionsOptions): string[];
export declare function resolveZhudaScreenReflections(options?: ZhudaScreenReflectionsOptions): Required<ZhudaScreenReflectionsOptions>;
export declare class ZhudaScreenReflections {
    /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, before fog. */
    readonly effect: any;
    /** The material of the pass that follows the rays (its uniforms are the effect's settings). */
    private readonly material;
    private readonly passes;
    private options;
    private phase;
    private disposed;
    constructor(options?: ZhudaScreenReflectionsOptions);
    /** Changes the values in place. */
    setReflections(options: ZhudaScreenReflectionsOptions): void;
    private shape;
    /**
     * Shifts the noise of the ray steps for the frame at `seconds`. A capture
     * calls it for every sample (their times differ by the shutter), so a still
     * averages the noise away; the same time always gives the same pattern. A
     * game leaves it alone. Takes effect with the next `update`.
     */
    setPhase(seconds: number): void;
    /** Call after the camera has moved or its field of view has changed. */
    update(eye: readonly number[], target: readonly number[], fieldOfViewDeg: number, aspect: number): void;
    dispose(): void;
}
