// Generated from TypeScript source; run npm run types:generate.
import type { CinematicLinearChain } from './CinematicCapture.js';
import { ZhudaGroundTruthAO } from './GroundTruthAO.js';
import { type ZhudaToneMapping } from './ToneCurves.js';
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
/**
 * How an environment is stored on the graphics card: 32-bit floats, 16-bit
 * floats (half the memory, values to 65504, which every WebGL 2 device
 * filters), or 8 bits a channel with a divisor in alpha (LayaAir's RGBD: a
 * quarter of the memory of `half`, values to 255, coarse above 1).
 */
export type ZhudaEnvironmentFormat = 'float' | 'half' | 'rgbd';
/** The formats this device can filter, best first. `rgbd` is always there. */
export declare function zhudaEnvironmentFormats(runtime?: any): ZhudaEnvironmentFormat[];
/** Upload an offline convolved GGX mip chain. Offsets are float32 elements, not bytes.
 * Data is scene-linear RGBA in WebGL cube face order +X,-X,+Y,-Y,+Z,-Z.
 * Mip roughness follows Laya's r*(2-r) lookup. Stored in the best format the
 * device filters (`zhudaEnvironmentFormats`), or in `format` when given: a
 * format the device does not have is refused, never replaced. */
export declare function createPrefilteredEnvironment(spec: PrefilteredEnvironmentSpec, pixels: Float32Array, format?: ZhudaEnvironmentFormat): {
    texture: any;
    /** How the light is stored on this device. */
    format: ZhudaEnvironmentFormat;
    apply(scene: any): void;
    /**
     * Replaces the pixels and ambient colours in the same texture, for an
     * environment of the same size. Scenes it was applied to see the new
     * reflections at once; call `apply` again for the new ambient colours.
     */
    update(next: Float32Array, nextSH: readonly number[]): void;
    dispose(): void;
};
/** The values of the chain that can be set while it runs (`setGrade`). */
export interface ZhudaFilmicGrade {
    exposure?: number;
    contrast?: number;
    saturation?: number;
    bloomIntensity?: number;
    aoIntensity?: number;
    aoRadius?: number;
    /** The curve from scene light to screen colour (default `aces`): see `ZhudaToneMapping`. */
    toneMapping?: ZhudaToneMapping;
    /**
     * White balance, each -100..100 (default 0). `temperature`: above 0 warmer
     * (toward orange), below 0 cooler (toward blue). `tint`: above 0 toward
     * magenta, below 0 toward green.
     */
    temperature?: number;
    tint?: number;
    /**
     * Three numbers each, for red, green and blue, applied to the scene's
     * light before the curve as `(colour * gain + lift) ^ gamma`: `lift`
     * (-1..1, default 0) moves the shadows, `gain` (0..16, default 1) the
     * highlights, and `gamma` (0.1..10, default 1) bends the middle: above 1
     * it darkens.
     */
    lift?: readonly number[];
    gamma?: readonly number[];
    gain?: readonly number[];
    /**
     * Where bloom begins, as a display value (default 1.2: a little above
     * white; LayaAir turns it into light with the screen's curve).
     */
    bloomThreshold?: number;
    /** How gradually bloom sets in below the threshold, 0..1 (default 0.5); 0 is a hard start. */
    bloomSoftKnee?: number;
    /** -1..1 (default 0): above 0 the bloom is stretched sideways, below 0 upright, as a lens with an oval opening does. */
    bloomAnamorphic?: number;
    /**
     * How far the bloom spreads, 1..10 (default 4): each step more doubles
     * its reach. The reach is a share of the picture, whatever its size.
     */
    bloomDiffusion?: number;
    /** How strongly the bloom lights up the dirt picture (default 1 with a picture, else 0). */
    bloomDirt?: number;
}
/** Lists what is wrong with the values of a grade, each as `name: rule`; empty when they are valid. */
export declare function validateZhudaFilmicGrade(values: ZhudaFilmicGrade): string[];
export interface FilmicOptions extends ZhudaFilmicGrade {
    ao?: boolean;
    /**
     * How ambient occlusion is worked out (default `sao`, LayaAir's own).
     * `gtao`: by horizons in the depth picture (`ZhudaGroundTruthAO`): open
     * ground is left as it is, and the scene is not drawn once more for
     * normals. Its strength is a power, 0..4, where 1 is what the geometry
     * hides; `aoIntensity` defaults to 1 with it.
     */
    aoMethod?: 'sao' | 'gtao';
    /** With `gtao`: work the occlusion out at half size (default false). */
    aoHalfSize?: boolean;
    bloom?: boolean;
    /**
     * A picture of the marks on a lens (dust, smears): where the bloom falls
     * on it, it lights up. Borrowed: the caller destroys it after the pipeline.
     */
    bloomDirtTexture?: any;
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
    /**
     * LayaAir's occlusion effect. With `ao: false` it is not in the chain (it
     * would cost a pass of the whole scene for its normals): making it active
     * afterwards does nothing; build the pipeline with `ao` on instead.
     */
    readonly ao: any;
    /** The occlusion by horizons, with `aoMethod: 'gtao'`; `ao` is then idle. */
    readonly groundAO: ZhudaGroundTruthAO | undefined;
    readonly bloom: any;
    /** Whether an occlusion effect is in the chain: not with `ao: false`. */
    private readonly occludes;
    /** The effect that darkens creases: LayaAir's, or the one by horizons. */
    private readonly occlusion;
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
     * Sets values of the chain in place: exposure, contrast, saturation, the
     * curve, white balance, lift, gamma and gain, bloom strength, threshold,
     * knee, shape and spread, and ambient occlusion strength and radius. Whether bloom
     * or ambient occlusion run at all is fixed at construction.
     */
    setGrade(values: ZhudaFilmicGrade): void;
    private tone;
    /** The curve in use. */
    get toneMapping(): ZhudaToneMapping;
    private applyGrade;
    /**
     * The picture of the marks on the lens that bloom lights up, and how
     * strongly; `null` takes it away. Borrowed: the caller destroys the
     * picture after the pipeline, or after handing over another.
     */
    setBloomDirt(texture: any | null, intensity?: number): void;
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
         * Whether the mirrored view draws shadow maps of its own. Left out, it
         * does, except while the scene's shadows are not drawn every frame
         * (`ZhudaShadowUpdates`, a look's `shadows.update`): there it reads
         * the maps kept for the main view, since maps of its own would replace
         * those and the main view would have to draw them again every frame.
         * `true`: always, also under such a rule, which then saves nothing.
         * `false`: never, in `draw()`, which saves a full shadow pass per
         * frame; the mirrored view is then drawn without the sun's shadows.
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
