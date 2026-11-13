// Generated from TypeScript source; run npm run types:generate.
/**
 * Procedural geometry kit.
 *
 * Builders are pure data: they return the engine's existing `MeshData`
 * (POSITION/NORMAL/UV + 16-bit indices) and never touch Laya. Pass the result
 * to `ZhudaDynamicMesh` to draw it.
 *
 * Conventions
 * - Units are metres. UVs are metres too, so a material that repeats every
 *   `tileMeters` keeps real-world texel density on every part.
 * - Triangles use the same front-face winding as the terrain meshes in this
 *   engine: cross(v1 - v0, v2 - v0) points away from the surface normal.
 */
import type { MeshData } from '../runtime3d/Surfaces.js';
export type ZhudaVec3 = [number, number, number];
export interface ZhudaBoxOptions {
    width: number;
    height: number;
    depth: number;
    /** 'center' (default) or 'bottom': the origin sits on the middle of the underside. */
    origin?: 'center' | 'bottom';
    /** Chamfer size in metres; 0 or omitted gives sharp edges. */
    bevel?: number;
}
/** Axis-aligned box, optionally chamfered. X = width, Y = height, Z = depth. */
export declare function createZhudaBoxMesh(options: ZhudaBoxOptions): MeshData;
export interface ZhudaTubeOptions {
    /** Centre line; at least two distinct points. */
    path: ZhudaVec3[];
    radius: number;
    /** Sides around the tube, 3..64 (default 8). */
    radialSegments?: number;
    /** Close both ends with flat caps (default true). */
    caps?: boolean;
}
/** Round tube swept along a polyline with twist-free frames. */
export declare function createZhudaTubeMesh(options: ZhudaTubeOptions): MeshData;
/** Straight round rod between two points. */
export declare function createZhudaRodMesh(from: ZhudaVec3, to: ZhudaVec3, radius: number, radialSegments?: number): MeshData;
export interface ZhudaIBeamOptions {
    length: number;
    /** Overall section height (flange to flange). */
    depth: number;
    /** Flange width. */
    width: number;
    flangeThickness: number;
    webThickness: number;
    /** Direction the beam runs along (default 'x'). The section height is Y, or Z for a 'y' beam. */
    axis?: 'x' | 'y' | 'z';
}
/** Structural I-section: two flanges and a web, centred on the origin. */
export declare function createZhudaIBeamMesh(options: ZhudaIBeamOptions): MeshData;
export interface ZhudaLatheOptions {
    /**
     * The outline as [radius, height] pairs in metres, 2..256 of them, turned
     * about the vertical axis. List it from the bottom up along the outside; a
     * hollow form (a bowl, a pipe) goes on down the inside. A radius of 0 is on
     * the axis.
     */
    profile: readonly (readonly [number, number])[];
    /** Sides around the axis, 3..96 (default 24). */
    segments?: number;
    /** Close the first and the last ring with a flat disc where it is off the axis (default true). */
    caps?: boolean;
    /** A corner of the outline sharper than this many degrees stays an edge (default 30). */
    creaseDeg?: number;
}
export declare function validateZhudaLathe(options: ZhudaLatheOptions): string[];
/** A body of revolution about +Y: bollards, barrels, domes, bowls, columns, cones. */
export declare function createZhudaLatheMesh(options: ZhudaLatheOptions): MeshData;
export interface ZhudaExtrudeOptions {
    /**
     * The outline on the ground as [x, z] pairs in metres, 3..256 of them, in
     * either direction. It may be concave; it must not cross itself.
     */
    outline: readonly (readonly [number, number])[];
    /** How far it is raised along +Y, in metres. */
    height: number;
    /** Close the top and the underside (default true). */
    caps?: boolean;
}
export declare function validateZhudaExtrude(options: ZhudaExtrudeOptions): string[];
/** A flat outline raised to a height: kerbs, steps, signs, wall pieces, L and U profiles. */
export declare function createZhudaExtrudeMesh(options: ZhudaExtrudeOptions): MeshData;
export interface ZhudaMeshTransform {
    position?: ZhudaVec3;
    /** Rotation about +Y, applied after pitch and roll. */
    yawDeg?: number;
    /** Rotation about +X. */
    pitchDeg?: number;
    /** Rotation about +Z, applied first. */
    rollDeg?: number;
    /** Uniform positive scale, applied before rotation. */
    scale?: number;
}
/** Returns a transformed copy (scale, then roll, pitch, yaw, then translation). UVs are unchanged. */
export declare function transformZhudaMesh(data: MeshData, transform: ZhudaMeshTransform): MeshData;
/**
 * Concatenates meshes that share one material. Output is split into chunks of
 * at most `maxVertices` so each chunk fits one `ZhudaDynamicMesh`.
 */
export declare function mergeZhudaMeshes(parts: readonly MeshData[], maxVertices?: number): MeshData[];
export declare function computeZhudaMeshBounds(data: MeshData): {
    min: ZhudaVec3;
    max: ZhudaVec3;
};
