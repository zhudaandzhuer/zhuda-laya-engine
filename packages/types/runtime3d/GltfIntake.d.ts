// Generated from TypeScript source; run npm run types:generate.
/**
 * glTF intake steps LayaAir 3.4.2's importer lacks. They read a glTF document,
 * or rewrite its bytes, before the native parser sees it. Nothing here makes a
 * Laya object, fetches a URL or allocates a GPU resource.
 */
type Json = Record<string, unknown>;
/** Texture-source extensions the engine resolves, in the order it prefers them. */
export type ZhudaGltfImageExtension = 'EXT_texture_avif' | 'EXT_texture_webp';
/** Whether this device decodes WebP and AVIF pictures (`probeZhudaImageDecode`). */
export interface ZhudaImageDecodeSupport {
    readonly webp: boolean;
    readonly avif: boolean;
}
export interface ZhudaGltfTextureSource {
    /** The image the texture loads, or null when the file offers nothing loadable. */
    readonly image: number | null;
    /** The extension that image came from; null for the core `source`. */
    readonly extension: ZhudaGltfImageExtension | null;
    /** Extensions whose image this device cannot decode. */
    readonly unavailable: readonly ZhudaGltfImageExtension[];
}
/**
 * The image a glTF texture should load: its AVIF, then its WebP source when the
 * device decodes it, else the core `source` (the optional fallback). Without
 * `support` the core source is preferred, and an extension image is used only
 * when there is no fallback.
 */
export declare function resolveZhudaGltfTextureSource(texture: unknown, support?: ZhudaImageDecodeSupport): ZhudaGltfTextureSource;
/** Decodes a one-pixel WebP and AVIF picture once per page and remembers the answer. */
export declare function probeZhudaImageDecode(): Promise<ZhudaImageDecodeSupport>;
/** One `KHR_lights_punctual` light, as the file gives it (glTF units). */
export interface ZhudaGltfLight {
    readonly index: number;
    readonly name: string;
    readonly type: 'directional' | 'point' | 'spot';
    /** Linear RGB, 0..1. */
    readonly color: readonly [number, number, number];
    /** Lux (lm/m²) for a directional light; candela (lm/sr) for point and spot. */
    readonly intensity: number;
    /** Metres; null when the file gives none (no cut-off). */
    readonly range: number | null;
    /** Spot cone half-angles in radians (glTF defaults: 0 and π/4). */
    readonly innerConeAngle: number;
    readonly outerConeAngle: number;
}
export interface ZhudaGltfProblem {
    readonly index: number;
    readonly message: string;
}
/** The file's punctual lights; an invalid one is null and named in `problems`. */
export declare function readZhudaGltfLights(document: unknown): {
    lights: readonly (ZhudaGltfLight | null)[];
    problems: readonly ZhudaGltfProblem[];
};
/** What `zhudaGltfLightToLaya` gives a LayaAir light component. */
export interface ZhudaLayaLightSettings {
    readonly kind: 'directional' | 'point' | 'spot';
    /** For `Light.color`, which LayaAir reads as sRGB-encoded: glTF's linear colour, encoded. */
    readonly color: readonly [number, number, number];
    readonly intensity: number;
    /** Point and spot: LayaAir's `range`, where its falloff reaches zero. */
    readonly range: number | null;
    /** Spot: LayaAir's full cone angle in degrees (its inner edge is fixed at half of it). */
    readonly spotAngleDeg: number | null;
}
/**
 * glTF light units to LayaAir's. LayaAir's diffuse term has no 1/π
 * (`Fd_Lambert` returns 1), so a LayaAir intensity is radiance per unit of
 * albedo; glTF gives lux and candela.
 * - Directional: `scale × lux / π`.
 * - Point and spot: LayaAir's falloff is `1/(1+25f²)` (and a fade past 0.87),
 *   f = distance/range, not glTF's inverse square. The range is the file's,
 *   or `4·√(scale·cd/π)` when it gives none: a quarter of it is where the glTF
 *   light makes a white surface white. The intensity makes LayaAir's curve equal
 *   glTF's recommended falloff at half the range. Without a file range the two
 *   stay within about 30 % from a quarter to nine tenths of it. With one,
 *   glTF's window closes faster: LayaAir's light is about 0.63 of it at a
 *   quarter of the range and about twice it at three quarters. Nearer than a
 *   quarter, LayaAir's light stays finite.
 * - Spot: the full cone is twice glTF's outer angle (at most 179°). LayaAir puts
 *   the inner edge at half of it, whatever the file says, and dims the cone by
 *   the cosine to its axis as well.
 * `scale` stands in for exposure: physical units can be very large.
 */
export declare function zhudaGltfLightToLaya(light: ZhudaGltfLight, options?: {
    scale?: number;
}): ZhudaLayaLightSettings;
export type ZhudaGltfCamera = {
    readonly index: number;
    readonly name: string;
    readonly type: 'perspective';
    /** Vertical field of view in degrees. */
    readonly yfovDeg: number;
    /** Width over height when the file fixes one; LayaAir uses its viewport's. */
    readonly aspectRatio: number | null;
    readonly znear: number;
    /** Null: no far plane in the file. */
    readonly zfar: number | null;
} | {
    readonly index: number;
    readonly name: string;
    readonly type: 'orthographic';
    /** Half width and half height of the view, in metres. */
    readonly xmag: number;
    readonly ymag: number;
    readonly znear: number;
    readonly zfar: number;
};
/** The file's cameras; an invalid one is null and named in `problems`. */
export declare function readZhudaGltfCameras(document: unknown): {
    cameras: readonly (ZhudaGltfCamera | null)[];
    problems: readonly ZhudaGltfProblem[];
};
/**
 * Points a LayaAir camera as a glTF camera: its lens, and, given the Laya node
 * the camera hangs on, that node's world position and rotation (both look down
 * their local -Z). The aspect ratio stays the viewport's; an infinite far plane
 * keeps the camera's own.
 */
export declare function applyZhudaGltfCamera(camera: Laya.Camera, data: ZhudaGltfCamera, node?: Laya.Sprite3D): void;
/** glTF node data LayaAir 3.4.2 drops on import: custom properties, a camera, a light. */
export interface ZhudaGltfNodeData {
    readonly index: number;
    /** The glTF name, or null (LayaAir then names the node `node_<n>`). */
    readonly name: string | null;
    /** A frozen copy of the node's `extras`, when it has any. */
    readonly extras?: unknown;
    readonly camera?: ZhudaGltfCamera;
    readonly light?: ZhudaGltfLight;
}
/** Every node that carries extras, a valid camera or a valid light. */
export declare function readZhudaGltfNodeData(document: unknown): readonly ZhudaGltfNodeData[];
/**
 * Vertex attribute accessors LayaAir would read wrongly: integers, normalized or
 * not (`KHR_mesh_quantization`, or core glTF's normalized texture coordinates
 * and weights). LayaAir copies them into a float vertex buffer unscaled.
 */
export declare function quantizedZhudaGltfAccessors(document: unknown): number[];
export interface ZhudaDequantizeResult {
    /** A GLB: the source data in one buffer, then the float copies. */
    readonly bytes: Uint8Array;
    /** Accessors turned into floats. */
    readonly accessors: number;
    /** Bytes of float data added. */
    readonly floatBytes: number;
}
/**
 * Turns quantized vertex attributes into 32-bit floats before LayaAir parses
 * the file (see `quantizedZhudaGltfAccessors`). Node transforms are kept: they
 * still carry `KHR_mesh_quantization`'s scale and offset. Needs embedded
 * buffers. Returns null when nothing needs it. GPU memory becomes that of an
 * unquantized export; the quantized source bytes stay in the file unread.
 */
export declare function dequantizeZhudaGltf(input: ArrayBuffer | Uint8Array, options?: {
    maxOutputBytes?: number;
}): ZhudaDequantizeResult | null;
/** A glTF JSON or GLB file's document and, for a GLB, its binary chunk. */
export declare function readZhudaGltfBytes(bytes: Uint8Array): {
    document: Json;
    bin?: Uint8Array;
};
/** A GLB of a document and its one binary buffer. */
export declare function writeZhudaGlb(document: unknown, bin: Uint8Array): Uint8Array;
export {};
