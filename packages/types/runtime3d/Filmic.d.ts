// Generated from TypeScript source; run npm run types:generate.
import type { CinematicLinearChain } from './CinematicCapture.js';
/**
 * The brightest scene value, after exposure, that the lookup table of
 * LayaAir's `ColorGradEffect` holds: its log encoding ends at 58.85. A value
 * above it is looked up outside the table and comes out dark or in the wrong
 * colour (a red lamp turned grey-green, then lost its red altogether).
 */
export declare const ZHUDA_GRADE_TABLE_MAX = 56;
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
     * Multisample the camera's HDR target (4x where the device allows it):
     * geometry edges come out smooth in a frame drawn once, as a game draws it.
     * Omitted, the camera keeps its own setting; disposal restores it either way.
     */
    msaa?: boolean;
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
    private readonly sceneEffects;
    private readonly finishEffects;
    /** Keeps what reaches the grade inside its lookup table; absent without the material effect class. */
    private readonly range;
    private linear;
    constructor(camera: any, options?: FilmicOptions);
    /** The table's end is in values after exposure: the limit before it moves with the exposure. */
    private limit;
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
    /**
     * The chain's handle for a capture that averages its samples in scene-linear
     * light (see `CinematicLinearChain`): samples are drawn without tone mapping
     * and lens finish, and their average is then drawn through both once. The
     * first call puts one pass at the head of the chain; it is idle outside a
     * capture.
     */
    linearChain(): CinematicLinearChain;
    /** Switches multisampling of the camera's HDR target on or off, in place. */
    setAntialias(msaa: boolean): void;
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
