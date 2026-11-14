// Generated from TypeScript source; run npm run types:generate.
/**
 * Lines that show what is in a scene: where its axes are, how big a thing
 * is, where a light points and how far it reaches, what a camera sees,
 * where a model's bones are.
 *
 * `ZhudaDebugDraw` keeps one of LayaAir's line sprites in a scene. Each
 * helper follows what it shows: `update()` draws all of them again from
 * what their targets are now, so it is called once a frame while anything
 * moves. Nothing is drawn, counted or kept by a game that makes none.
 *
 * The geometry is plain arithmetic (`zhuda…Lines`), so that it can be
 * checked without a GPU: every function returns line segments as
 * `[x0, y0, z0, x1, y1, z1, …]` in world units.
 */
type V3 = readonly [number, number, number];
/** Column-major, as LayaAir's `Matrix4x4.elements`. */
type M4 = ArrayLike<number>;
/** The three axes of a matrix, each `size` long in its own units: x, then y, then z. */
export declare function zhudaAxesLines(matrix: M4 | null, size?: number): number[];
/** A square grid on the plane `y`, `size` across, in `divisions` cells a side. */
export declare function zhudaGridLines(size?: number, divisions?: number, y?: number): number[];
/** The twelve edges of a box between two corners; with a matrix, of a box in that space. */
export declare function zhudaBoxLines(min: V3, max: V3, matrix?: M4 | null): number[];
/** A circle round `center`, flat to `normal`. */
export declare function zhudaCircleLines(center: V3, normal: V3, radius: number, segments?: number): number[];
/** A sphere as its three great circles: how far a point light reaches. */
export declare function zhudaSphereLines(center: V3, radius: number, segments?: number): number[];
/**
 * A spot's cone: from `apex` along `direction` for `range`, `angle` degrees
 * across the whole cone. Four lines down its side and the circle at its end.
 */
export declare function zhudaConeLines(apex: V3, direction: V3, range: number, angle: number, segments?: number): number[];
/** An arrow from a point along a direction: a shaft and four barbs. */
export declare function zhudaArrowLines(from: V3, direction: V3, length: number): number[];
/** What a camera sees, for `zhudaFrustumLines`. LayaAir's camera looks down its own -Z. */
export interface ZhudaDebugFrustum {
    /** The camera's world matrix. */
    matrix: M4;
    /** Vertical field of view in degrees; not read by an orthographic camera. */
    fieldOfView: number;
    /** Width over height. */
    aspect: number;
    near: number;
    far: number;
    orthographic?: boolean;
    /** The height an orthographic camera sees, in world units. */
    orthographicVerticalSize?: number;
}
/**
 * The frustum of a camera: the near rectangle, the far rectangle and the
 * four edges between them (twelve segments), from the camera's own values,
 * so that it is the same on WebGL and WebGPU whatever their depth ranges.
 */
export declare function zhudaFrustumLines(camera: ZhudaDebugFrustum): number[];
/** A line from every bone to the bone it hangs from; `parent` is an index into the list, or -1. */
export declare function zhudaSkeletonLines(bones: readonly {
    position: V3;
    parent: number;
}[]): number[];
/** Red, green, blue as they are drawn (not scene-linear light). */
export type ZhudaDebugColor = readonly [number, number, number];
export interface ZhudaDebugDrawOptions {
    /** Draw over everything, whatever is in front (default false: things hide the lines behind them). */
    onTop?: boolean;
    /**
     * The most line segments kept, 16..65536 (default 8192). What does not
     * fit is left out, and counted in `dropped`.
     */
    maxLines?: number;
}
/** What a helper gives back: `remove()` takes it away. */
export interface ZhudaDebugHelper {
    remove(): void;
}
/** One colour for all of a helper's segments, or one a segment (repeated when there are fewer). */
export type ZhudaDebugColors = ZhudaDebugColor | readonly ZhudaDebugColor[];
export declare function validateZhudaDebugDraw(options: ZhudaDebugDrawOptions): string[];
export declare class ZhudaDebugDraw {
    private readonly scene;
    private readonly sprite;
    private readonly material;
    private readonly maxLines;
    private readonly entries;
    private disposed;
    /** Segments left out at the last `update()` because they did not fit in `maxLines`. */
    dropped: number;
    constructor(scene3D: any, options?: ZhudaDebugDrawOptions);
    /** How many segments the last `update()` drew. */
    get lineCount(): number;
    private keep;
    /**
     * Segments of your own, worked out again at every `update()`. `colors` may
     * be a function too: it is asked after the segments, each time.
     */
    lines(lines: () => number[], colors?: ZhudaDebugColors | (() => ZhudaDebugColors)): ZhudaDebugHelper;
    /** The axes of a node (red x, green y, blue z), or of the world without one. */
    axes(node?: any, size?: number): ZhudaDebugHelper;
    grid(options?: {
        size?: number;
        divisions?: number;
        y?: number;
        color?: ZhudaDebugColor;
    }): ZhudaDebugHelper;
    box(min: V3, max: V3, color?: ZhudaDebugColor): ZhudaDebugHelper;
    /**
     * The box round everything a node and its children draw, in the world,
     * as it is now. A node that draws nothing shows nothing.
     */
    bounds(node: any, color?: ZhudaDebugColor): ZhudaDebugHelper;
    /**
     * A light: an arrow for a directional light, its reach for a point light,
     * its cone for a spot. `light` is the light's node or its component; the
     * lines take the light's colour unless one is given.
     */
    light(light: any, color?: ZhudaDebugColor): ZhudaDebugHelper;
    /** What a camera sees: its near and far rectangles and the edges between. */
    camera(camera: any, color?: ZhudaDebugColor): ZhudaDebugHelper;
    /**
     * The bones of every skinned mesh under a node: a line from each bone to
     * the bone it hangs from, as the pose is now.
     */
    skeleton(node: any, color?: ZhudaDebugColor): ZhudaDebugHelper;
    /**
     * What the sun's shadow map covers: a sphere for each of its cascades,
     * as LayaAir fitted them at the last frame it drew shadows in. A thing
     * outside every sphere has no shadow from the map. Nothing is shown while
     * the scene draws no directional shadow.
     *
     * (The map itself cannot be shown as a picture: it is a comparison
     * texture, which WebGL may not read as a colour and WebGPU refuses to.)
     */
    shadowCascades(scene3D?: any, color?: ZhudaDebugColor): ZhudaDebugHelper;
    /** Draws every helper again from what its target is now. Once a frame while anything moves. */
    update(): void;
    /** Takes every helper away; the next `update()` draws nothing. */
    clear(): void;
    dispose(): void;
}
/**
 * The box round everything a node and its children draw, in the world;
 * `null` when they draw nothing.
 */
export declare function zhudaWorldBounds(node: any): {
    min: V3;
    max: V3;
} | null;
/**
 * The spheres LayaAir fitted the sun's shadow cascades into at the last
 * frame it drew shadows in, nearest first; empty when a scene draws none.
 */
export declare function zhudaShadowCascades(scene3D: any): {
    center: V3;
    radius: number;
}[];
/** The bones of every skinned mesh under a node, each with the index of the bone it hangs from. */
export declare function zhudaBonesOf(node: any): {
    position: V3;
    parent: number;
}[];
export {};
