// Generated from TypeScript source; run npm run types:generate.
/**
 * Baked lightmaps for Laya 3.4.2's native lightmap path. A lightmap stores the
 * diffuse light arriving at a surface (direct and bounced), laid out by the
 * mesh's second UV set. Decoding and encoding are pure; only
 * `createZhudaLightmap` needs the Laya runtime.
 */
export interface ZhudaHdrImage {
    width: number;
    height: number;
    /** Scene-linear RGB, three floats per pixel, top row first. */
    rgb: Float32Array;
}
/** Largest side accepted for a lightmap. */
export declare const ZHUDA_LIGHTMAP_MAX_SIZE = 4096;
/**
 * Decodes a Radiance `.hdr` picture (RGBE, flat or run-length encoded, the
 * standard `-Y h +X w` orientation).
 */
export declare function decodeRadianceHdr(input: ArrayBuffer | Uint8Array): ZhudaHdrImage;
/** Brightest linear value a lightmap can hold; brighter texels are clamped. */
export declare const ZHUDA_LIGHTMAP_MAX_LINEAR: number;
/**
 * Encodes scene-linear light as the RGBA8 picture Laya's lightmap shader
 * reads: gamma 2.2, RGBM with range 5, straight alpha. `intensity` scales the
 * light first.
 */
export declare function encodeZhudaLightmapRgbm(image: ZhudaHdrImage, intensity?: number): Uint8Array;
/** Inverse of `encodeZhudaLightmapRgbm` for one texel (tests and tools). */
export declare function decodeZhudaLightmapTexel(r: number, g: number, b: number, m: number): [number, number, number];
export interface ZhudaLightmap {
    readonly width: number;
    readonly height: number;
    /** The native `Laya.Lightmap` to list in `Scene3D.lightmaps`. */
    readonly lightmap: any;
    dispose(): void;
}
/** Uploads a decoded lightmap. The caller disposes it after the scene stops using it. */
export declare function createZhudaLightmap(image: ZhudaHdrImage, intensity?: number): ZhudaLightmap;
