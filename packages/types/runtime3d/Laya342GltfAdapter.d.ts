// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaImageDecodeSupport, type ZhudaLayaLightSettings } from './GltfIntake.js';
/** Options for one owned glTFResource. */
export interface Laya342GltfResourceOptions {
    /** This device's WebP/AVIF decoding; picks each texture's image (see resolveZhudaGltfTextureSource). */
    imageDecode?: ZhudaImageDecodeSupport;
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
