// Generated from TypeScript source; run npm run types:generate.
/**
 * Puts a loaded model under a holder node: once, or as many copies at given
 * places, with the per-use options film scenes and model prefabs share
 * (leaves that let light through, a scale for what the materials give off).
 * The model's meshes and materials are shared by every copy and by every
 * other user of the same asset, so whatever is changed on a material is put
 * back on disposal.
 */
import type { ModelInstance } from './Assets.js';
/** One copy of a model: x, y, z in metres, yaw in degrees, uniform scale. */
export type ZhudaModelPlacement = readonly [number, number, number, number, number];
export interface ZhudaModelMountOptions {
    /** Copies relative to the holder; without it the model is attached once, at the holder. */
    placements?: readonly ZhudaModelPlacement[];
    /** Cut-out (alpha-tested) materials let light through. */
    translucent?: boolean;
    /** Scales the emissive strength of glTF materials (1 leaves them alone). */
    emission?: number;
    /** Name prefix of the nodes created for copies. */
    label?: string;
}
export interface ZhudaMountedModel {
    /** Renderers of the loaded instance (copies share their materials). */
    renderers: any[];
    dispose(): void;
}
/** Every mesh renderer below a node. */
export declare function zhudaModelRenderers(l: any, root: any): any[];
/** Lists what is wrong with a placement list; empty when it is valid. */
export declare function validateZhudaModelPlacements(value: unknown, max?: number): string[];
export declare function mountZhudaModel(holder: any, instance: ModelInstance, options?: ZhudaModelMountOptions): ZhudaMountedModel;
