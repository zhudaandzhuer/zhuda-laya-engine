// Generated from TypeScript source; run npm run types:generate.
/** The scene define that switches the shadow lookup on. */
export declare const ZHUDA_POINT_SHADOW_DEFINE = "ZHUDA_POINT_SHADOW";
/** Point lights one `ZhudaPointShadow` can hold, and the lit shaders look up. */
export declare const ZHUDA_POINT_SHADOW_MAX_LIGHTS = 4;
/**
 * Teaches Laya 3.4.2's point lights to ask for a shadow. Must run before
 * `Laya.init`, which registers the lighting include and compiles the lit
 * shaders from it. Returns false when there is no runtime to patch.
 */
export declare function installLaya342PointShadows(runtime?: any): boolean;
export interface ZhudaPointShadowOptions {
    /** Edge of each of the six pictures in pixels: 256, 512 or 1024 (default 512). */
    resolution?: 256 | 512 | 1024;
    /**
     * Nothing closer to the light than this casts a shadow, in metres (default
     * 0.5): the lamp's own head, which would otherwise shade everything.
     */
    near?: number;
    /** How dark the shadow is, 0..1 (default 1). */
    strength?: number;
    /** Distance in metres a surface may be behind the picture and still be lit (default 0.03). */
    bias?: number;
    /**
     * Width of the shadow's edge in texels of the pictures, 0..4 (default 2).
     * The edge widens with distance from the lamp, as each texel does.
     */
    softness?: number;
    /** Point lights this one holds pictures for, 1..4 (default 1): `render(..., light)`. */
    lights?: number;
}
export declare function validateZhudaPointShadow(options: ZhudaPointShadowOptions): string[];
export declare class ZhudaPointShadow {
    private readonly scene;
    private readonly options;
    private readonly camera;
    private readonly target;
    private readonly material;
    /** Bound in place of the pictures while they are drawn into. */
    private readonly blank;
    private readonly active;
    /** Every texel's alpha: the lights the texture holds, plus 8 on WebGPU (see the shader). */
    private readonly head;
    private written;
    private disposed;
    /** Whether pictures have been drawn for some light and the scene is using them. */
    drawn: boolean;
    constructor(scene: any, options?: ZhudaPointShadowOptions);
    /**
     * Draws the six tiles of `light`: the scene seen from `position` out to
     * `range` with `notes` (two values a tile) beside the distances, or, with
     * no notes, nothing but the mark that this light casts no shadow.
     */
    private drawTiles;
    /**
     * Draws the six pictures of `light` (0 up to `lights` - 1) from `position`
     * out to `range` metres and switches the shadow on for the point light at
     * that position. Call again after the light or anything that should cast a
     * shadow has moved.
     */
    render(position: readonly number[], range: number, light?: number): void;
    /** Switches the shadow of `light` off; its light is drawn as without shadows. */
    clear(light?: number): void;
    private publish;
    dispose(): void;
}
