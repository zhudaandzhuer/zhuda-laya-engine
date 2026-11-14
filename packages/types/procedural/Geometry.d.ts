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
    /**
     * Openings right through the shape (a window in a wall piece, the inside of
     * a letter O), up to 32 of them. Each is an outline of 3..256 [x, z] pairs
     * in either direction, inside the outline and clear of its edges and of
     * the other holes.
     */
    holes?: readonly (readonly (readonly [number, number])[])[];
    /**
     * Cut off or round the top edges by this many metres (default 0, sharp).
     * The wall stops this far below the top and the top is drawn in by it;
     * holes are widened by it at the top. The footprint stays the outline.
     * Needs caps.
     */
    bevel?: number;
    /** 1 (default) cuts the edges off flat; 2..8 rounds them in that many steps. */
    bevelSegments?: number;
    /** Bevel the underside's edges too (default false: a shape standing on the ground). */
    bevelBottom?: boolean;
}
export declare function validateZhudaExtrude(options: ZhudaExtrudeOptions): string[];
/**
 * A flat outline raised to a height: kerbs, steps, signs, wall pieces, L and
 * U profiles; with `holes`, windows and doorways; with `bevel`, worn or
 * rounded top edges.
 */
export declare function createZhudaExtrudeMesh(options: ZhudaExtrudeOptions): MeshData;
export interface ZhudaSweepOptions {
    /**
     * The cross-section as [across, up] pairs in metres, 3..64 of them, in
     * either direction: across is to the left of the way the path runs, up is
     * up. It may be concave; it must not cross itself. [0, 0] lies on the path.
     */
    profile: readonly (readonly [number, number])[];
    /** The line the section is carried along, 2..1024 points in metres. */
    path: readonly (readonly [number, number, number])[];
    /** The path returns to its first point: a ring with no ends (default false). */
    closed?: boolean;
    /** Close the two ends (default true); ignored on a closed path. */
    caps?: boolean;
}
export declare function validateZhudaSweep(options: ZhudaSweepOptions): string[];
/**
 * A cross-section carried along a path: kerbs and gutters round a bend,
 * rails, cornices, cables, walls that follow a street. The section stays
 * upright (its up is the world's, as far as the path allows) and keeps its
 * width through a corner. Each edge of the section is a flat band with its
 * own normal; the corners of the path are not rounded.
 */
export declare function createZhudaSweepMesh(options: ZhudaSweepOptions): MeshData;
export type ZhudaCurveKind = 'centripetal' | 'chordal' | 'uniform';
export interface ZhudaCurveOptions {
    /** Points the curve passes through: 2..256 [x, y, z] in metres (3 or more when closed). */
    points: readonly (readonly [number, number, number])[];
    /** The curve runs on from the last point back round to the first (default false). */
    closed?: boolean;
    /**
     * How a Catmull-Rom curve spaces its points (default 'centripetal': no
     * loops or cusps where points bunch up; 'chordal' bends wider; 'uniform' is
     * the classic curve).
     */
    kind?: ZhudaCurveKind;
}
export declare function validateZhudaCurve(options: ZhudaCurveOptions): string[];
/**
 * `count` points (2..4096) along a Catmull-Rom curve, the same distance
 * apart. An open curve starts and ends on its first and last points; a
 * closed one does not repeat its start. Feed them to `createZhudaSweepMesh`
 * (with `closed` for a closed curve) or `createZhudaTubeMesh`.
 */
export declare function sampleZhudaCurve(options: ZhudaCurveOptions, count: number): ZhudaVec3[];
/** What `sampleZhudaCurvePath` reads of a LayaAir `CurvePath`: a point a share 0..1 of the way along. */
export interface ZhudaCurvePathLike {
    getPointAt(t: number): {
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };
}
/**
 * `count` points (2..4096) along a LayaAir `CurvePath` (Catmull-Rom or
 * Bezier; it measures by length), for `createZhudaTubeMesh` or
 * `createZhudaSweepMesh`. With `closed`, the last point is not repeated, as
 * a closed sweep wants. A point the same as the one before is left out.
 */
export declare function sampleZhudaCurvePath(path: ZhudaCurvePathLike, count: number, options?: {
    closed?: boolean;
}): ZhudaVec3[];
export interface ZhudaCurveTubeOptions extends ZhudaCurveOptions {
    radius: number;
    /** Rings along the curve, 2..2048 (default 64), the same distance apart. */
    tubularSegments?: number;
    /** Sides around the tube, 3..64 (default 12). */
    radialSegments?: number;
    /** Close the two ends of an open curve with flat caps (default true). */
    caps?: boolean;
}
export declare function validateZhudaCurveTube(options: ZhudaCurveTubeOptions): string[];
/**
 * A round tube along a Catmull-Rom curve through the given points: pipes,
 * cables, handles, a loop of hose. Its rings are spaced evenly along the
 * curve and turn with it as little as possible (rotation-minimising frames);
 * a closed tube's seam is twisted into place over its whole length. A radius
 * wider than the tightest bend folds the tube into itself; that is not
 * checked.
 */
export declare function createZhudaCurveTubeMesh(options: ZhudaCurveTubeOptions): MeshData;
export interface ZhudaTorusOptions {
    /** From the middle of the hole to the middle of the tube, in metres. */
    radius: number;
    /** The tube's own radius: less than `radius`. */
    tube: number;
    /** Sides around the tube, 3..64 (default 16). */
    radialSegments?: number;
    /** Steps around the hole, 3..256 (default 48). */
    tubularSegments?: number;
}
export declare function validateZhudaTorus(options: ZhudaTorusOptions): string[];
/** A ring-shaped tube lying flat about +Y, centred on the origin: rings, tyres, handles, haloes. */
export declare function createZhudaTorusMesh(options: ZhudaTorusOptions): MeshData;
export interface ZhudaRingOptions {
    outerRadius: number;
    /** The hole's radius; 0 (default) gives a disc. */
    innerRadius?: number;
    /** Steps around, 3..256 (default 48). */
    segments?: number;
    /**
     * Omitted: a flat ring at y = 0 facing +Y, seen from above only (a marker
     * on the ground). Given: a solid washer this many metres thick, from y = 0 up.
     */
    thickness?: number;
}
export declare function validateZhudaRing(options: ZhudaRingOptions): string[];
/** A flat ring or disc, or with `thickness` a washer or coin, about +Y on the origin. */
export declare function createZhudaRingMesh(options: ZhudaRingOptions): MeshData;
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
