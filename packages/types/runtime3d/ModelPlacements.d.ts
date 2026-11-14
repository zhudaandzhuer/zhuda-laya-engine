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
import { ZhudaModelLod } from './ModelLod.js';
/** One copy of a model: x, y, z in metres, yaw in degrees, uniform scale. */
export type ZhudaModelPlacement = readonly [number, number, number, number, number];
export interface ZhudaModelMountOptions {
    /** Copies relative to the holder; without it the model is attached once, at the holder. */
    placements?: readonly ZhudaModelPlacement[];
    /** Cut-out (alpha-tested) materials let light through. */
    translucent?: boolean;
    /** Scales the emissive strength of glTF materials (1 leaves them alone). */
    emission?: number;
    /**
     * False: the model casts no shadow (it still takes them). For ground,
     * paving and what is too small to matter: a model is drawn again in every
     * split of the shadow map it reaches. Default true.
     */
    castShadow?: boolean;
    /** Name prefix of the nodes created for copies. */
    label?: string;
    /**
     * Lighter versions of the model for distance, nearest first: beyond
     * `fromMeters` a copy draws this one instead of the one before. The caller
     * loaded them and disposes them after this mount.
     */
    lod?: readonly {
        instance: ModelInstance;
        fromMeters: number;
    }[];
    /** Beyond this distance a copy draws nothing. */
    cullMeters?: number;
    /**
     * With `placements`: no node for a copy. The copies of each mesh are drawn
     * together, a group for each square of ground (`ZhudaInstancedMesh`): one
     * draw a group instead of one a copy, lit and shadowed as before. Levels
     * and the cull distance are then chosen for a group, by the middle of its
     * box. Only for models of plain meshes (no bones, no morph targets).
     */
    instanced?: boolean;
    /** With `instanced`: side of the squares the copies are grouped by, in metres (default 32). */
    cellMeters?: number;
}
export interface ZhudaMountedModel {
    /** Renderers of the loaded instance (copies share their materials). */
    renderers: any[];
    /**
     * Scales what the model's materials give off, 0..8, while it is mounted (1 is
     * as authored). The materials are shared by every copy of the model.
     */
    setEmission(scale: number): void;
    /** Present when the mount has levels or a cull distance: call `update(eye)` as the eye moves. */
    lod?: ZhudaModelLod;
    /** With `instanced`: how many copies, groups and draws a pass (of the full model). */
    instanced?: {
        copies: number;
        groups: number;
        drawsPerPass: number;
    };
    dispose(): void;
}
/** Every mesh renderer below a node. */
export declare function zhudaModelRenderers(l: any, root: any): any[];
/** Lists what is wrong with a placement list; empty when it is valid. */
export declare function validateZhudaModelPlacements(value: unknown, max?: number): string[];
export declare function mountZhudaModel(holder: any, instance: ModelInstance, options?: ZhudaModelMountOptions): ZhudaMountedModel;
