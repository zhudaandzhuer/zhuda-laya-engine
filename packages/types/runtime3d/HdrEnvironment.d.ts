// Generated from TypeScript source; run npm run types:generate.
/**
 * An HDR panorama (a Radiance `.hdr` photograph of the whole surroundings,
 * twice as wide as tall) as the light of a scene and as its sky, and a
 * studio room made here for scenes that have neither.
 *
 * What was there before: a PNG or JPEG panorama as the sky (8 bits, so the
 * sun in it is no brighter than a white wall and lights nothing), and
 * `ZhudaEnvironmentProbe`, which photographs the scene and its sky from one
 * point and lights the scene with that. Here the photograph itself is the
 * light: it is turned into a cube picture, prefiltered
 * (`prefilterZhudaEnvironment`: blurred mip levels for rough surfaces, nine
 * ambient colours) and applied, with the picture as the sky, turned and
 * exposed together.
 *
 * Only `ZhudaHdrEnvironment` needs the Laya runtime; the rest is pure.
 */
import { prefilterZhudaEnvironment, type ZhudaCubePicture, type ZhudaPrefilterOptions } from './EnvironmentProbe.js';
import type { ZhudaHdrImage } from './Lightmap.js';
import { type ZhudaEnvironmentFormat } from './Filmic.js';
export interface ZhudaEquirectOptions {
    /** Side of each cube face, a power of two 16..1024 (default 256). */
    size?: number;
    /** Turns the panorama about the vertical axis, degrees (default 0): positive moves it to the right. */
    rotationDeg?: number;
    /** Scales every value (default 1). */
    exposure?: number;
    /**
     * The largest value kept (default 4096). A photographed sun is tens of
     * thousands of times brighter than the sky round it; left as it is, the
     * few texels that hold it flicker in every rough reflection.
     */
    maxRadiance?: number;
}
/**
 * Where a world direction lies in a panorama, as u (0 at the left edge, 1 at
 * the right) and v (0 at the top). The middle of the picture is what lies
 * toward -Z, its left edge and right edge meet toward +Z, and +X is a
 * quarter of the width right of the middle: the layout of an
 * equirectangular photograph as glTF viewers and three.js read it.
 */
export declare function zhudaEquirectUv(x: number, y: number, z: number): [number, number];
/** The direction a point of a panorama shows: the inverse of `zhudaEquirectUv`. */
export declare function zhudaEquirectDirection(u: number, v: number): [number, number, number];
/**
 * A panorama as a cube picture of world directions (the input of
 * `prefilterZhudaEnvironment`). Each texel is the mean of the panorama under
 * it, so a small face of a large panorama does not alias. Pure.
 */
export declare function zhudaEquirectToCube(image: ZhudaHdrImage, options?: ZhudaEquirectOptions): ZhudaCubePicture;
export interface ZhudaStudioOptions {
    /** Side of each cube face, a power of two 16..256 (default 64). */
    size?: number;
    /** Brightness of the lamps against the default, 0..16 (default 1). */
    intensity?: number;
    /** Colour of the walls, linear 0..1 (default a neutral grey). */
    walls?: readonly [number, number, number];
}
/**
 * A room of plain walls with a large soft lamp overhead, a window to one
 * side and two smaller lamps: enough to give a metal or a lacquer something
 * to reflect and a model even light, where a scene has no surroundings of
 * its own (a model viewer, a shop, a menu). Radiance arriving at the middle
 * of the room, as a cube picture. Pure, and the same every time.
 */
export declare function zhudaStudioEnvironment(options?: ZhudaStudioOptions): ZhudaCubePicture;
export interface ZhudaHdrEnvironmentSource {
    /** The panorama (`decodeRadianceHdr`), or a cube picture made elsewhere (`zhudaStudioEnvironment`). */
    panorama?: ZhudaHdrImage;
    cube?: ZhudaCubePicture;
}
export interface ZhudaHdrEnvironmentOptions extends ZhudaEquirectOptions, ZhudaPrefilterOptions {
    /** Scales reflections, 0..8 (default 1). */
    reflection?: number;
    /** Scales the ambient light, 0..8 (default 1). */
    ambient?: number;
}
/** A panorama or a cube picture, prefiltered: what `createPrefilteredEnvironment` uploads. Pure. */
export declare function prefilterZhudaHdrEnvironment(source: ZhudaHdrEnvironmentSource, options?: ZhudaHdrEnvironmentOptions): {
    spec: import("./Filmic.js").PrefilteredEnvironmentSpec;
    pixels: Float32Array;
};
/**
 * A panorama made smaller by whole steps (each pixel the mean of a square of
 * the source), until neither side is over a limit. Pure.
 */
export declare function zhudaShrinkPanorama(image: ZhudaHdrImage, maxWidth: number): ZhudaHdrImage;
/**
 * The sky a blurred reflection would show: the panorama a prefiltered cube
 * level stands for, as a small panorama. `level` 0 is the sharpest. Pure.
 */
export declare function zhudaBlurredPanorama(prefiltered: ReturnType<typeof prefilterZhudaEnvironment>, level: number, width?: number): ZhudaHdrImage;
export interface ZhudaHdrEnvironmentApplyOptions extends ZhudaHdrEnvironmentOptions {
    /**
     * Draws the panorama as the sky (default: yes for a panorama, no for a
     * cube picture, which has no panorama to show). The camera given here, or
     * the scene's first, is set to clear with the sky.
     */
    sky?: boolean;
    camera?: any;
    /**
     * How soft the sky is, 0..1 (default 0, the photograph as it is). Above 0
     * the sky is the panorama as a surface of that roughness would reflect
     * it: a backdrop that does not compete with what stands before it.
     */
    skyBlur?: number;
    /** Widest sky texture, 256..4096 (default 2048); a wider panorama is made smaller. */
    skyWidth?: number;
    /**
     * How the light is stored on the graphics card (default: the best this
     * device filters): 32-bit floats, 16-bit floats, or 8 bits with a divisor.
     */
    format?: ZhudaEnvironmentFormat;
}
/**
 * A panorama (or a cube picture) as the light of a scene: reflections and
 * ambient light from it, and the panorama as the sky. One for a scene at a
 * time; `dispose` gives the scene back what it had.
 */
export declare class ZhudaHdrEnvironment {
    private readonly l;
    private readonly scene;
    private readonly environment;
    private readonly previous;
    private readonly camera;
    private sky;
    private rotationDeg;
    private disposed;
    /** The nine ambient colours (27 numbers), for inspection. */
    readonly ambientSH: readonly number[];
    constructor(scene3D: any, source: ZhudaHdrEnvironmentSource, options?: ZhudaHdrEnvironmentApplyOptions);
    /** How the light is stored on this device. */
    get format(): ZhudaEnvironmentFormat;
    /** Degrees the surroundings are turned about the vertical axis. */
    get rotation(): number;
    /**
     * Turns the light and the sky together, degrees: positive moves the
     * surroundings to the right. Costs nothing: nothing is filtered again.
     */
    setRotation(degrees: number): void;
    /** Scales reflections and ambient light, each 0..8. */
    setIntensity(reflection: number, ambient: number): void;
    dispose(): void;
}
