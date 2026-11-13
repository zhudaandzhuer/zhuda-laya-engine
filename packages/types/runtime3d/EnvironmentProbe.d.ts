// Generated from TypeScript source; run npm run types:generate.
import { type PrefilteredEnvironmentSpec } from './Filmic.js';
/**
 * A cube picture: six square faces of `size` pixels, RGBA float32, scene-linear,
 * in the order +X, -X, +Y, -Y, +Z, -Z with WebGL's face layout, holding the
 * radiance arriving from each world direction.
 */
export interface ZhudaCubePicture {
    size: number;
    data: Float32Array;
}
/** Direction of a texel: face 0..5, s and t in -1..1 (s along the row, t down the rows). */
export declare function zhudaCubeDirection(face: number, s: number, t: number): [number, number, number];
/** Face and s, t of a direction: the inverse of `zhudaCubeDirection`. */
export declare function zhudaCubeTexel(x: number, y: number, z: number): [number, number, number];
export interface ZhudaPrefilterOptions {
    /** Side of the largest mip, a power of two 8..256 (default 64). */
    size?: number;
    /** Directions sampled per texel for the blurred mips, 8..1024 (default 64). */
    samples?: number;
}
/**
 * Prefilters a world cube picture for Laya. Laya looks the cube up with the
 * X axis mirrored, so the output is stored that way; the ambient colours use
 * the same convention.
 */
export declare function prefilterZhudaEnvironment(world: ZhudaCubePicture, options?: ZhudaPrefilterOptions): {
    spec: PrefilteredEnvironmentSpec;
    pixels: Float32Array;
};
/**
 * The nine ambient colours (27 numbers, Laya's `u_IblSH`: irradiance / pi as
 * a quadratic in the normal, X mirrored) of a cube picture of the
 * surroundings. `evaluateZhudaAmbient` evaluates them.
 */
export declare function zhudaAmbientSH(base: ZhudaCubePicture): number[];
/**
 * Ambient light (irradiance / pi) on a surface with world normal (x, y, z),
 * as Laya's shader evaluates the nine colours. For tests and tools.
 */
export declare function evaluateZhudaAmbient(ambientSH: readonly number[], x: number, y: number, z: number): number[];
export interface ZhudaEnvironmentProbeOptions {
    /** World position the surroundings are captured from. */
    position: readonly [number, number, number];
    /** Pixels per captured face, 32..512 (default 128). */
    captureSize?: number;
    /** Side of the largest stored mip (default 64). */
    size?: number;
    /** Scales reflections, 0..8 (default 1). */
    reflection?: number;
    /** Scales the ambient light, 0..8 (default 1). */
    ambient?: number;
    /**
     * Use the capture for reflections only and leave the scene's ambient light
     * as it is. Under a canopy or in a courtyard the captured ambient is as
     * dark as the surroundings; an open sky light may suit the shot better.
     */
    reflectionOnly?: boolean;
    /** Laya layers the capture does not draw (default: none). */
    excludedLayers?: readonly number[];
}
/** The six views of a capture, in the order the faces are read back. */
export declare const ZHUDA_CUBE_VIEWS: readonly {
    readonly forward: number[];
    readonly up: number[];
}[];
/**
 * A sky-and-ground surrounding as a cube picture: `sky` from above, `ground`
 * from below, blended across the horizon. Light from it gives surfaces that
 * face up the colour of the sky and surfaces that face down the light the
 * ground throws back, which is what keeps shadows from going flat and black.
 */
export declare function zhudaHemisphereCube(sky: readonly [number, number, number], ground: readonly [number, number, number], size?: number): ZhudaCubePicture;
/**
 * The prefiltered environment of `zhudaHemisphereCube(sky, ground, 16)` at
 * size 16, without prefiltering again. The cube is linear in the two colours
 * and so is the prefilter, so one prefilter of a unit sky (red) and a unit
 * ground (green) is mixed per call: microseconds instead of milliseconds,
 * equal to a full prefilter up to float rounding.
 */
export declare function prefilterZhudaHemisphere(sky: readonly [number, number, number], ground: readonly [number, number, number]): {
    spec: PrefilteredEnvironmentSpec;
    pixels: Float32Array;
};
/** What `applyZhudaHemisphereAmbient` returns: call it to restore the scene. */
export interface ZhudaHemisphereAmbientHandle {
    (): void;
    /** New colours in the same texture; nothing is allocated on the GPU. */
    update(sky: readonly [number, number, number], ground: readonly [number, number, number]): void;
}
/**
 * Lights a scene with a sky-and-ground ambient (and the matching soft
 * reflections). Returns the function that restores the scene's previous
 * ambient setup and releases the texture; its `update` changes the colours
 * in place. The colours are light (scene-linear); a film look and
 * `ZhudaSceneLook` decode their display colours before handing them here.
 */
export declare function applyZhudaHemisphereAmbient(scene: any, sky: readonly [number, number, number], ground: readonly [number, number, number]): ZhudaHemisphereAmbientHandle;
/**
 * Six pictures read back from a 90-degree camera turned along `VIEWS`, as one
 * cube picture of the surroundings in world directions.
 */
export declare function zhudaCubeFromFaces(faces: readonly Float32Array[], n: number): ZhudaCubePicture;
export declare class ZhudaEnvironmentProbe {
    private readonly scene;
    private environment;
    private previous;
    private disposed;
    /** The nine ambient colours of the last capture (27 numbers), for inspection. */
    ambientSH: readonly number[];
    constructor(scene: any);
    /**
     * Renders the surroundings and applies them to the scene. Call it after the
     * scene has drawn at least one frame; call it again when the surroundings
     * change. `signal` cancels the read-back.
     */
    capture(options: ZhudaEnvironmentProbeOptions, signal?: AbortSignal): Promise<void>;
    dispose(): void;
}
