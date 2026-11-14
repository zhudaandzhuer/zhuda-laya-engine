// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaModelPlacement } from './ModelPlacements.js';
/** Sixteen numbers a copy, column by column, as LayaAir's `Matrix4x4.elements`. */
export type ZhudaInstanceMatrices = Float32Array;
/**
 * The matrix of each copy: `parent * place * local`, where `place` is the
 * placement (`[x, y, z, yawDeg, scale]`), `parent` the holder's world matrix
 * and `local` where the mesh sits inside its model (both default to none).
 */
export declare function zhudaPlacementMatrices(placements: readonly ZhudaModelPlacement[], parent?: ArrayLike<number>, local?: ArrayLike<number>): ZhudaInstanceMatrices;
export interface ZhudaInstanceCell {
    /** Which copies, by their place in the list, ascending. */
    indices: number[];
    /** The box round those copies' meshes. */
    min: [number, number, number];
    max: [number, number, number];
}
/**
 * Groups copies by the square of ground their origin stands on (`cellMeters`
 * a side, on X and Z), at most `maxPerCell` to a group, with the box round
 * each group's meshes. Groups come in a fixed order (by square, then by
 * place in the list), so the same input gives the same groups. `anchors`
 * (three numbers a copy) say where each copy counts as standing instead of
 * its own origin: the meshes of one model, grouped by where the model
 * stands, then fall into the same groups.
 */
export declare function zhudaInstanceCells(matrices: ZhudaInstanceMatrices, meshMin: readonly number[], meshMax: readonly number[], cellMeters?: number, maxPerCell?: number, anchors?: Float32Array): ZhudaInstanceCell[];
export interface ZhudaInstancedMeshOptions {
    /** The copies cast shadows (default true). */
    castShadow?: boolean;
    /** The copies take shadows (default true). */
    receiveShadow?: boolean;
    /** Side of the squares the copies are grouped by, in metres (default 32). */
    cellMeters?: number;
    /** Most copies in one group, 1..65536 (default 1024). */
    maxPerCell?: number;
    /**
     * A colour for each copy, four numbers a copy (red, green, blue as display
     * colours, and one spare), multiplied into the base colour. Only materials
     * made by `ZhudaLitSurfaceMaterial` or `ZhudaToonMaterial` read it; any
     * other is refused.
     */
    tints?: Float32Array;
    /** Where each copy counts as standing for the grouping, three numbers a copy (default: its origin). */
    anchors?: Float32Array;
    /** LayaAir layer of the group nodes (default: the parent's). */
    layer?: number;
    /** Name prefix of the group nodes. */
    label?: string;
}
/** The define a material's shader reads a copy's tint under. */
export declare const ZHUDA_INSTANCE_TINT_DEFINE = "ZHUDA_INSTANCE_TINT";
/** The attribute a copy's tint arrives in, and its place among the vertex attributes. */
export declare const ZHUDA_INSTANCE_TINT_ATTRIBUTE = "a_ZhudaInstanceTint";
export declare const ZHUDA_INSTANCE_TINT_LOCATION = 15;
/** For the lit template: a shader of this name reads `a_ZhudaInstanceTint` under the tint define. */
export declare function registerZhudaInstanceTintShader(runtime: any, name: string): void;
export interface ZhudaInstancedGroup {
    /** The node that draws the group. */
    node: any;
    renderer: any;
    /** How many copies it draws. */
    count: number;
    /** The middle of the box round them, in the parent's space. */
    centre: [number, number, number];
}
export declare class ZhudaInstancedMesh {
    /** How many copies. */
    readonly count: number;
    /** One node a group, in a fixed order. */
    readonly groups: readonly ZhudaInstancedGroup[];
    /** Destroyed in this order: the nodes, then what they drew with. */
    private readonly nodes;
    private readonly owned;
    private disposed;
    /**
     * @param parent the node the group nodes are added under. The matrices
     *   are in its space: give them as places under it (`zhudaPlacementMatrices`
     *   without a parent matrix). A parent that moves afterwards takes the
     *   copies with it for culling but not for drawing: make the mesh again.
     * @param mesh a LayaAir mesh; its buffers are shared, never copied.
     * @param materials one material, or one a sub-mesh.
     * @param matrices sixteen numbers a copy.
     */
    constructor(parent: any, mesh: any, materials: any, matrices: ZhudaInstanceMatrices, options?: ZhudaInstancedMeshOptions);
    /** Copies, groups, and draws a pass: one a group a sub-mesh. */
    get stats(): {
        copies: number;
        groups: number;
        drawsPerPass: number;
    };
    private release;
    /** Destroys the group nodes and the instance buffers; the mesh and the materials are the caller's. */
    dispose(): void;
}
