// Generated from TypeScript source; run npm run types:generate.
export interface ZhudaReflectiveSurfaceOptions {
    /** Centre of the rectangle; `y` is the height of the reflecting plane. */
    position: readonly [number, number, number];
    /** Width (X) and depth (Z) in metres. */
    size: readonly [number, number];
    /** Brightness of the reflection, 0..4 (default 1). */
    strength?: number;
    /** Share of the surface that is standing water, 0..1 (default 0.45). The rest is damp. */
    wetness?: number;
    /** Blur of the reflection on damp areas, 0..1 (default 0.35). */
    roughness?: number;
    /** How much damp areas break the reflection up, 0..1 (default 0.4). */
    ripple?: number;
    /** Size of the puddle pattern in metres (default 3). */
    patternMeters?: number;
    /** Longer side of the reflection target in pixels (default 1024). */
    resolution?: number;
    /** Laya layer for the surface; the mirrored camera does not draw this layer (default 30). */
    layer?: number;
}
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaReflectiveSurface(options: ZhudaReflectiveSurfaceOptions): string[];
/**
 * Columns of the matrix that takes a world point to the mirrored camera's clip
 * space (x and y in -1..1 after dividing by w; z is unused). The mirrored
 * camera sits at the eye's reflection in the plane `y = planeY`, looks at the
 * reflected target and keeps +Y up.
 */
export declare function zhudaMirrorProjection(eye: readonly number[], target: readonly number[], planeY: number, fieldOfViewDeg: number, aspect: number): [number[], number[], number[], number[]];
export declare class ZhudaReflectiveSurface {
    /** Laya layer of the surface. Put anything the mirror must not draw on it. */
    readonly layer: number;
    readonly planeY: number;
    private readonly reflection;
    private readonly material;
    private readonly mesh;
    private readonly scene;
    private disposed;
    constructor(scene: any, options: ZhudaReflectiveSurfaceOptions);
    /** The mirrored camera, for matching the main camera's clear flag, sky and fog. */
    get camera(): any;
    /** Call after the main camera moves or its field of view changes. */
    update(eye: readonly [number, number, number], target: readonly [number, number, number], fieldOfViewDeg: number, aspect: number): void;
    /**
     * Draws the mirrored view now. The engine's normal frame loop already draws
     * it; call this only when a frame is rendered outside that loop (captures).
     */
    render(): void;
    dispose(): void;
}
