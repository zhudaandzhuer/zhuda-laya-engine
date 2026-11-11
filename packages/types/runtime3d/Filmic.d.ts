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
    });
    private planeY;
    private clip?;
    private disposed;
    update(eye: readonly number[], target: readonly number[], fieldOfView: number, aspect?: number): any[][];
    dispose(): void;
}
