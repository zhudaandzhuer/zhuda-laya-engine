// Generated from TypeScript source; run npm run types:generate.
/**
 * What a bright light does inside a lens: a glow round the light, a streak
 * through it, and ghosts (discs, rings, the shape of the aperture) strung
 * along the line from the light through the middle of the picture.
 *
 * The light must be seen to flare. Before anything is drawn, a few points
 * round the light are looked up in the depth picture, and the flare is as
 * strong as the share of them that nothing stands in front of: it fades as
 * the sun goes behind a roof and is gone behind a wall. LayaAir 3.4.2's own
 * `LensFlareEffect` draws through everything, and needs pictures; the shapes
 * here are drawn by arithmetic, so a flare needs no assets.
 *
 * One effect for `sceneEffects` (it adds light to the scene, so bloom and
 * the tone curve treat it like any other light): a copy of the picture, a
 * one-pixel pass for what is seen, and a small quad for each element. It
 * does not know about clouds or fog drawn after the scene (they are not in
 * the depth picture): lower `strength` under an overcast sky. Only the
 * class needs the Laya runtime.
 */
export type ZhudaLensFlareShape = 'glow' | 'disc' | 'ring' | 'polygon';
export interface ZhudaLensFlareElement {
    /**
     * `glow`: brightest in the middle, fading to nothing at the rim (wide and
     * low, it is a streak). `disc`: evenly bright. `ring`: the rim of a disc.
     * `polygon`: a disc with straight sides, the shape of an aperture.
     */
    shape: ZhudaLensFlareShape;
    /**
     * Where along the line from the light through the middle of the picture,
     * -1..3: 0 on the light, 1 in the middle, 2 as far beyond the middle as
     * the light is before it.
     */
    at: number;
    /** How wide across, as a share of the picture's height, 0.005..3. */
    size: number;
    /**
     * Width over height, 0.02..50 (default 1): its height is `size` over
     * this. A streak is a glow many times wider than high.
     */
    stretch?: number;
    /** Display RGB 0..1. */
    color: readonly [number, number, number];
    /** Brightness where it is brightest, as a multiple of white, 0..64 (default 1). */
    strength?: number;
    /** Degrees it is turned by (default 0). */
    rotationDeg?: number;
    /** Turn with the line toward the middle of the picture (default false). */
    follow?: boolean;
    /** `polygon`: sides, 3..12 (default 6). */
    sides?: number;
    /** `disc`, `ring`, `polygon`: how soft the rim is, 0..1 (default 0.15). */
    softness?: number;
    /** `ring`: its width as a share of the radius, 0.02..1 (default 0.12). */
    width?: number;
}
export interface ZhudaLensFlareOptions {
    /** One to twelve elements (default `ZHUDA_LENS_FLARE_SUN`). */
    elements?: readonly ZhudaLensFlareElement[];
    /** Scales every element, 0..16 (default 1). */
    strength?: number;
    /**
     * The radius round the light that is looked up in the depth picture, as a
     * share of the picture's height, 0.002..0.1 (default 0.012): the flare
     * fades over this distance as the light passes behind an edge.
     */
    occlusionRadius?: number;
}
/** Where the light is: a direction toward it (the sun) or a point in the scene (a lamp). */
export interface ZhudaLensFlareLight {
    /** Toward the light, from anywhere in the scene. Either this or `position`. */
    toward?: readonly [number, number, number];
    position?: readonly [number, number, number];
    /** The light's colour as light (not a display colour), multiplied into every element (default white). */
    color?: readonly [number, number, number];
}
/** A flare for a low sun: a glow, a streak across, and five ghosts down the line. */
export declare const ZHUDA_LENS_FLARE_SUN: readonly ZhudaLensFlareElement[];
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaLensFlare(options: ZhudaLensFlareOptions): string[];
/**
 * How much of a flare is left for a light at this place in the picture
 * (`x` and `y` are -1..1 across it): all of it inside the frame, none of it
 * a third of the frame outside, and nothing for a light behind the camera.
 */
export declare function zhudaLensFlareEdgeFade(x: number, y: number): number;
/**
 * Where an element is and how it is turned, for a light at `light` (both in
 * picture coordinates, 0..1 from the bottom left): its middle, and the
 * angle in radians. `aspect` is the picture's width over its height.
 */
export declare function zhudaLensFlarePlace(element: ZhudaLensFlareElement, light: readonly [number, number], aspect: number): {
    middle: [number, number];
    angle: number;
};
export declare class ZhudaLensFlare {
    /** The Laya post-process effect; `ZhudaFilmicPipeline` takes it in `sceneEffects`, last. */
    readonly effect: any;
    private readonly seen;
    private readonly copy;
    private elements;
    private strength;
    private radius;
    private light;
    private disposed;
    constructor(options?: ZhudaLensFlareOptions);
    private build;
    /** Where the light is and what colour; `null` puts the flare out. Call it when the light moves. */
    setLight(light: ZhudaLensFlareLight | null): void;
    /** New strength, radius or elements in place; the same limits as the options. */
    set(options: ZhudaLensFlareOptions): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
