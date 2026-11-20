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
/**
 * How many pieces LayaAir 3.4.2's glTF loader cuts a skinned primitive into
 * for these triangles in this order: it gathers the joints the triangles
 * name, all four a vertex, and starts a piece when one more triangle would
 * bring them past 24. One for a skin that names 24 joints or fewer. Pure.
 */
export declare function countLaya342SkinPieces(indices: ArrayLike<number>, joints: ArrayLike<number>): number;
/**
 * Puts a skinned primitive's triangles in an order LayaAir 3.4.2 cuts into
 * few pieces, in place, and returns the pieces before and after. Two things
 * are done, neither of which changes what is drawn:
 *
 * - a joint a vertex names with no weight is replaced by the joint that
 *   vertex is weighted to most (`joints` is changed in place): the loader
 *   counts a named joint whether it is weighted or not;
 * - the triangles are gathered a piece at a time: every triangle whose
 *   joints the piece already holds, then the one that adds the fewest, until
 *   no triangle fits in 24.
 *
 * The order is left as it is when it is already cut as little, or when the
 * skin names 24 joints or fewer.
 */
export declare function orderLaya342SkinTriangles(indices: {
    [index: number]: number;
    readonly length: number;
}, joints: {
    [index: number]: number;
    readonly length: number;
}, weights: ArrayLike<number>): {
    before: number;
    after: number;
};
/**
 * Gives every primitive (sub-mesh) of one glTF mesh the same vertex attributes,
 * the union of theirs, before LayaAir 3.4.2 packs them into one buffer laid out
 * as the first one's. A missing attribute gets a value that changes nothing (see
 * LAYA342_DEFAULTS). Returns how many attributes were added; leaves the list as
 * it was when it holds a name this function does not know.
 */
export declare function unifyLaya342SubMeshAttributes(subMeshes: any[]): number;
/**
 * A colour accessor's values as RGBA floats in 0..1 (see glTF 2.0, COLOR_0), for
 * LayaAir's vertex colour: glTF's colour is linear, and LayaAir's shader raises
 * the red, green and blue it is given to the power 2.2 (it takes them as display
 * values), so they are handed over raised to 1/2.2. Alpha is passed as it is.
 */
export declare function zhudaGltfColors(raw: ArrayLike<number>, accessor: {
    type?: string;
    componentType?: number;
    count?: number;
} | undefined): Float32Array;
