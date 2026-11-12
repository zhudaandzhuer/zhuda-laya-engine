// Generated from TypeScript source; run npm run types:generate.
export interface PrefilteredEnvironmentSpec {
    size: number;
    levels: {
        size: number;
        offset: number;
        elements: number;
    }[];
    ambientSH: number[];
}
/** Upload an offline convolved GGX mip chain. Offsets are float32 elements, not bytes.
 * Data is scene-linear RGBA in WebGL cube face order +X,-X,+Y,-Y,+Z,-Z.
 * Mip roughness follows Laya's r*(2-r) lookup. No LDR fallback is silently substituted. */
export declare function createPrefilteredEnvironment(spec: PrefilteredEnvironmentSpec, pixels: Float32Array): {
    texture: any;
    apply(scene: any): void;
    /**
     * Replaces the pixels and ambient colours in the same texture, for an
     * environment of the same size. Scenes it was applied to see the new
     * reflections at once; call `apply` again for the new ambient colours.
     */
    update(next: Float32Array, nextSH: readonly number[]): void;
    dispose(): void;
};
export interface FilmicOptions {
    exposure?: number;
    contrast?: number;
    saturation?: number;
    ao?: boolean;
    aoIntensity?: number;
    aoRadius?: number;
    bloom?: boolean;
    bloomIntensity?: number;
    temporalAA?: boolean;
    /**
     * Borrowed effects inserted after ambient occlusion and before bloom, in
     * linear HDR: for example `ZhudaLightFog.effect`. They read the camera depth
     * texture, which the pipeline switches on. The caller disposes them after
     * the pipeline.
     */
    sceneEffects?: readonly any[];
    /**
     * Borrowed effects added last, after tone mapping, in display space: for
     * example `ZhudaLensFinish.effect`. The caller disposes them after the
     * pipeline.
     */
    finishEffects?: readonly any[];
}
/** Owns the camera's HDR, AO, restrained bloom and ACES chain. Caller chooses quality. */
export declare class ZhudaFilmicPipeline {
    readonly post: any;
    readonly grade: any;
    readonly ao: any;
    readonly bloom: any;
    private previous;
    private previousHDR;
    private disposed;
    private camera;
    private ownsTAA;
    private previousMSAA;
    private previousDepth;
    constructor(camera: any, options?: FilmicOptions);
    /** Update the existing ACES grading exposure multiplier. */
    setExposure(value: number): void;
    /**
     * Sets the continuous values of the chain in place: exposure, contrast,
     * saturation, bloom strength, and ambient occlusion strength and radius.
     * Whether bloom or ambient occlusion run at all is fixed at construction.
     */
    setGrade(values: {
        exposure?: number;
        contrast?: number;
        saturation?: number;
        bloomIntensity?: number;
        aoIntensity?: number;
        aoRadius?: number;
    }): void;
    /** Call on camera cuts, teleports and timeline seeks, not on ordinary movement. */
    resetHistory(): void;
    dispose(): void;
}
/** A real mirrored scene camera for a horizontal surface. Objects on excludedLayer
 * must include the reflecting surface to prevent feedback. The scene should not
 * contain visible geometry below the plane: arbitrary oblique clipping is not provided. */
export declare class ZhudaPlanarReflection {
    readonly camera: any;
    readonly texture: any;
    constructor(scene: any, options: {
        width: number;
        height: number;
        planeY?: number;
        excludedLayer: number;
        near?: number;
        far?: number;
        /**
         * Draw only what lies above the plane (an oblique near plane). Water
         * needs it: its bed and the sunk part of stones are below the mirror
         * and would otherwise cover the mirrored view.
         */
        clipBelowPlane?: boolean;
        /**
         * Leave the mirrored camera out of the engine's frame loop: the owner
         * draws it with `draw()` when it wants (default false: the loop draws it).
         */
        manual?: boolean;
        /**
         * Whether `draw()` also redraws the shadow maps for the mirrored view
         * (default true). Without it the mirror uses the shadow maps of the
         * main view, which saves a full shadow pass per frame.
         */
        shadows?: boolean;
    });
    private planeY;
    private readonly shadows;
    private readonly scene;
    private clip?;
    private disposed;
    update(eye: readonly number[], target: readonly number[], fieldOfView: number, aspect?: number): any[][];
    /** Draws the mirrored view now (captures, or a `manual` mirror in a game loop). */
    draw(): void;
    dispose(): void;
}
