// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaImageDecodeSupport, type ZhudaLayaLightSettings } from './GltfIntake.js';
import { type ZhudaBasisTranscoder } from './BasisTexture.js';
/** The copies a glTF node asks for (`EXT_mesh_gpu_instancing`), read when the file was parsed. */
export interface Laya342GltfInstances {
    /** Sixteen numbers a copy, column by column, in the node's own space. */
    readonly matrices: Float32Array;
    /** How many copies the file asked for and are not here: their scale turns the mesh inside out. */
    readonly mirrored: number;
}
/** Options for one owned glTFResource. */
export interface Laya342GltfResourceOptions {
    /** This device's WebP/AVIF decoding; picks each texture's image (see resolveZhudaGltfTextureSource). */
    imageDecode?: ZhudaImageDecodeSupport;
    /** Transcodes embedded KTX 2 images (`KHR_texture_basisu`) to a format the graphics card samples. */
    basis?: ZhudaBasisTranscoder;
}
/** Version-pinned importer repairs. Applied to one owned glTFResource, never to
 * global prototypes. The native Animator remains the sole pose evaluator. */
export declare function prepareLaya342GltfResource(resource: any, runtime: any, options?: Laya342GltfResourceOptions): void;
/** Native MeshRenderer cloning does not consistently preserve authored weights.
 * Copy values through the public setter to retain independent dirty tracking. */
export declare function copyLaya342MorphWeights(source: any, target: any, runtime: any): void;
/** Native create() retains its partial trees on failure. Retire their components
 * before the caller releases the parsed resource and its shared dependencies. */
export declare function createLaya342ModelTemplate(resource: any, runtime: any): Laya.Sprite3D;
/**
 * The glTF texture indices whose picture did not load or decode while the
 * resource was parsed: LayaAir left their material slots empty.
 */
export declare function laya342GltfMissingTextures(resource: object): readonly number[];
/**
 * The occlusion and emissive textures that asked for the second set of
 * texture coordinates and are drawn with the first, because the shader
 * text that reads it could not be put in place.
 */
export declare function laya342GltfRefusedSecondUv(resource: object): readonly {
    material: number;
    slot: string;
    reason: string;
}[];
/** The copies each glTF node asks for (`EXT_mesh_gpu_instancing`), by node index. */
export declare function laya342GltfInstances(resource: object): ReadonlyMap<number, Laya342GltfInstances>;
/** The Laya node made for each glTF node index by the resource's last create(). */
export declare function laya342GltfNodes(resource: object): readonly any[];
/** Adds a LayaAir light component, set from `zhudaGltfLightToLaya`, to a node.
 * It points down the node's -Z, as glTF's does, and casts no shadow. */
export declare function createLaya342GltfLight(node: any, settings: ZhudaLayaLightSettings, runtime: any): any;
/** A colour accessor's values as RGBA floats in 0..1 (see glTF 2.0, COLOR_0). */
export declare function zhudaGltfColors(raw: ArrayLike<number>, accessor: {
    type?: string;
    componentType?: number;
    count?: number;
} | undefined): Float32Array;
