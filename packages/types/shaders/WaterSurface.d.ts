// Generated from TypeScript source; run npm run types:generate.
export interface ZhudaWaterSurfaceOptions {
    /** Centre of the rectangle; `y` is the water level. */
    position: readonly [number, number, number];
    /** Width (X) and depth (Z) in metres. */
    size: readonly [number, number];
    /** Flow in metres per second along X and Z (default [0, 0.6]). */
    flow?: readonly [number, number];
    /** Colour of deep water, linear RGB (default a green-blue). */
    color?: readonly [number, number, number];
    /** Metres of water at which the bed has faded to about a third, 0.05..100 (default 1.5). */
    clarity?: number;
    /** Length of the waves in metres, 0.05..50 (default 0.9). */
    waveMeters?: number;
    /** Steepness of the waves, 0..1 (default 0.35). */
    waves?: number;
    /** How much the bed is bent by the waves, 0..1 (default 0.4). */
    refraction?: number;
    /** Brightness of the mirrored scene, 0..4 (default 1). */
    reflection?: number;
    /**
     * How much deep water shines in its own colour from light scattered inside
     * it, 0..4 (default 0.25). Higher values give luminous jade or turquoise water.
     */
    glow?: number;
    /** Depth in metres under which the water foams, 0..2 (default 0.12); 0 switches foam off. */
    foamDepth?: number;
    /** Sun glint: unit vector toward the sun and its linear colour times intensity. */
    sun?: {
        toward: readonly [number, number, number];
        color: readonly [number, number, number];
    };
    /** Longer side of the reflection target in pixels (default 1024). */
    resolution?: 256 | 512 | 1024 | 2048;
    /**
     * Flip the lookup into the camera's depth and colour textures vertically.
     * Off for a camera that draws into a render target (captures, post-process
     * chains); a camera drawing straight to the canvas may need it.
     */
    flipScreen?: boolean;
    /**
     * The mirrored view redraws the shadow maps (default true). A game turns it
     * off to save a shadow pass per frame; the mirror then uses the shadows of
     * the main view.
     */
    mirrorShadows?: boolean;
    /** Laya layer for the surface; the mirrored camera does not draw this layer (default 29). */
    layer?: number;
}
/** Share of the bed's light that survives `metres` of water with the given clarity. */
export declare function zhudaWaterAbsorption(metres: number, clarity: number): number;
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaWaterSurface(options: ZhudaWaterSurfaceOptions): string[];
export declare class ZhudaWaterSurface {
    /** Laya layer of the surface. Put anything the mirror must not draw on it. */
    readonly layer: number;
    readonly planeY: number;
    private readonly reflection;
    private readonly material;
    private readonly mesh;
    private readonly scene;
    private readonly flow;
    private foamDepth;
    private disposed;
    constructor(scene: any, options: ZhudaWaterSurfaceOptions);
    /** The mirrored camera, for matching the main camera's clear flag, sky and fog. */
    get camera(): any;
    /**
     * Whether the lookup into the camera's depth and colour textures is flipped
     * vertically (see `flipScreen`). A game that switches its camera between
     * drawing through a post-process chain and straight to the canvas changes
     * it at the same time.
     */
    setScreenFlip(flip: boolean): void;
    /** Seconds of flow: where the waves and the foam are. */
    setTime(seconds: number): void;
    /** Call after the main camera moves or its field of view changes. */
    update(eye: readonly [number, number, number], target: readonly [number, number, number], fieldOfViewDeg: number, aspect: number): void;
    /**
     * Draws the mirrored view. Call it once per frame before the main camera
     * draws (the engine's frame loop does not draw it), or less often to save time.
     */
    render(): void;
    dispose(): void;
}
