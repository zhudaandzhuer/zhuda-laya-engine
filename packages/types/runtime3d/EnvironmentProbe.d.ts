// Generated from TypeScript source; run npm run types:generate.
/**
 * Environment captured from the scene itself.
 *
 * `prefilterZhudaEnvironment` (pure) turns a cube picture of the surroundings
 * into what Laya's image-based lighting needs: a mip chain blurred for
 * increasing roughness (GGX) and nine spherical-harmonic colours for ambient
 * light. `ZhudaEnvironmentProbe` renders that cube picture with a Laya camera
 * from one point and applies the result, so glossy surfaces reflect the
 * scene around them and unlit surfaces pick up its ambient light.
 *
 * One probe: reflections are correct at the probe and approximate elsewhere.
 */
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
    /** Laya layers the capture does not draw (default: none). */
    excludedLayers?: readonly number[];
}
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
