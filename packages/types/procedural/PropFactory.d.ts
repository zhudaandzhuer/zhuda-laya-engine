// Generated from TypeScript source; run npm run types:generate.
/**
 * Parametric props: a factory returns named mesh parts, box colliders with a
 * surface tag, and optional sockets. Everything is plain data until
 * `instantiateZhudaPropBatches` hands merged meshes to the renderer.
 *
 * The engine owns this mechanism. Which props exist, what they look like and
 * what a surface tag means (footsteps, impacts) stay with the consumer.
 */
import { ZhudaDynamicMesh, type MeshData } from '../runtime3d/Surfaces.js';
import { type ZhudaVec3 } from './Geometry.js';
import { type ZhudaRandom } from './Random.js';
export interface ZhudaPropCollider {
    min: ZhudaVec3;
    max: ZhudaVec3;
    /** Consumer-defined tag such as metal, wood or concrete. */
    surface: string;
}
export interface ZhudaPropPart {
    name: string;
    /** Logical material name; the consumer maps it to a real material. */
    material: string;
    mesh: MeshData;
}
export interface ZhudaPropBuild {
    parts: ZhudaPropPart[];
    colliders: ZhudaPropCollider[];
    sockets?: Record<string, ZhudaVec3>;
}
export interface ZhudaPropDefinition<P extends object = Record<string, never>> {
    id: string;
    /** Nominal width (X), height (Y) and depth (Z) in metres. The origin is the middle of the underside. */
    size: ZhudaVec3;
    defaults: P;
    build(params: P, random: ZhudaRandom): ZhudaPropBuild;
}
export interface ZhudaPropPlacement {
    position: ZhudaVec3;
    /** Rotation about +Y in degrees. */
    yawDeg?: number;
    params?: object;
    seed?: number;
    /** Stable instance name for evidence and debugging; defaults to id#index. */
    instance?: string;
}
export interface ZhudaPlacedProp {
    id: string;
    instance: string;
    position: ZhudaVec3;
    yawDeg: number;
    /** World-space parts. */
    parts: ZhudaPropPart[];
    /** World-space axis-aligned boxes. A rotated box becomes several smaller ones. */
    colliders: ZhudaPropCollider[];
    sockets: Record<string, ZhudaVec3>;
}
export interface ZhudaPropBatch {
    material: string;
    meshes: MeshData[];
    triangles: number;
}
/**
 * Moves a local box into world space. Axis-aligned physics cannot hold a
 * rotated box, so an oblique one is cut along its long side into up to ten
 * slices; each slice's bounds is returned.
 */
export declare function rotateZhudaCollider(collider: ZhudaPropCollider, yawDeg: number, position: ZhudaVec3): ZhudaPropCollider[];
export declare class ZhudaPropRegistry {
    private readonly definitions;
    private placed;
    /** Definitions keep their own parameter type; the registry stores them untyped. */
    register(definition: ZhudaPropDefinition<any>): this;
    has(id: string): boolean;
    ids(): string[];
    sizeOf(id: string): ZhudaVec3;
    private require;
    /** Local-space build. The same id, params and seed always give the same result. */
    build(id: string, options?: {
        params?: object;
        seed?: number;
    }): ZhudaPropBuild;
    /** Builds a prop and moves its parts, colliders and sockets into world space. */
    place(id: string, placement: ZhudaPropPlacement): ZhudaPlacedProp;
}
/** Groups every placed part by material and merges each group into as few meshes as possible. */
export declare function mergeZhudaPlacedProps(placed: readonly ZhudaPlacedProp[], maxVertices?: number): ZhudaPropBatch[];
/**
 * Renderer hand-off: one `ZhudaDynamicMesh` per merged chunk, sharing the
 * material returned by `resolveMaterial`. Requires the Laya runtime.
 */
export declare function instantiateZhudaPropBatches(batches: readonly ZhudaPropBatch[], resolveMaterial: (material: string) => unknown, parent?: unknown): {
    meshes: ZhudaDynamicMesh[];
    dispose(): void;
};
