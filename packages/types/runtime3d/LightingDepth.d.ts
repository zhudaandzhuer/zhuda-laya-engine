// Generated from TypeScript source; run npm run types:generate.
/**
 * What LayaAir 3.4.2's lights and shadows cannot be told:
 *
 * - **Falloff by the square of the distance.** LayaAir's lamp is as bright
 *   at its middle whatever its range. With `falloff: 'physical'` a lamp's
 *   `intensity` is its brightness at one metre, a quarter of it at two, and
 *   it is brought to nothing at its range.
 * - **A spot's penumbra**, a light at a time: how much of the cone is soft.
 * - **How wide the sun's soft shadow is**, in multiples of LayaAir's.
 * - **Cascades that meet without a line**: near the end of a cascade pixels
 *   take the next one more and more often, and past the last one the shadow
 *   fades out instead of stopping.
 * - **Contact shadows**: the last centimetres under a thin thing, which the
 *   shadow map is too coarse to hold, shaded by a short march toward the sun
 *   through the depth picture. Only the sun's light is shaded.
 *
 * LayaAir's lighting and shadow includes are changed as text before
 * `Laya.init` (`installLaya342LightingDepth`; `ZhudaEngine.boot` does it),
 * as point shadows are. Each change compiles to LayaAir's own arithmetic
 * unless a scene switches it on, which `ZhudaLightingDepth` does.
 *
 * Nothing is added to the scene's uniforms (LayaAir fixes the layout of
 * their block, and another member moves the rest) or to its textures (a
 * WebGPU stage has 16 samplers): the width and the reach travel in the two
 * numbers of `u_ShadowParams` that LayaAir leaves unused, and a spot's
 * penumbra in the unused fourth texel of its row in the light buffer.
 */
/** The scene defines the patched includes look at. */
export declare const ZHUDA_LIGHT_DEFINES: {
    readonly inverseSquare: "ZHUDA_LIGHT_INVERSE_SQUARE";
    readonly spotPenumbra: "ZHUDA_SPOT_PENUMBRA";
    readonly cascadeBlend: "ZHUDA_CASCADE_BLEND";
    readonly shadowSpread: "ZHUDA_SHADOW_SPREAD";
    readonly contactShadow: "ZHUDA_CONTACT_SHADOW";
};
export interface ZhudaLightingDepthOptions {
    /**
     * `laya` (default): LayaAir's own falloff, 1 at the lamp whatever its
     * range. `physical`: by the square of the distance in scene units; a
     * lamp's `intensity` is then its brightness at one unit.
     */
    falloff?: 'laya' | 'physical';
    /**
     * How wide the sun's soft shadow is, 1..4 times LayaAir's (default 1, which
     * is LayaAir's own filter). Above 1 the edge is sixteen reads on a turned
     * disc: wider, and a fine grain. For soft shadows (`ShadowMode.SoftHigh`).
     */
    shadowSpread?: number;
    /** Blend from one cascade into the next, and fade the shadow out past the last (default false). */
    cascadeBlend?: boolean;
    /**
     * How far toward the sun a point looks for something in its way, in scene
     * units, 0.02..2; 0 or left out: no contact shadows. Needs the camera's
     * depth picture (the camera given to the constructor is asked for it) and
     * the sun's shadows on.
     */
    contactShadows?: number;
}
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaLightingDepth(options: ZhudaLightingDepthOptions): string[];
/**
 * How bright a lamp is at `distance` as a share of its `intensity`, with
 * LayaAir's falloff: 1 at the lamp, nothing from its range on. The shader's
 * arithmetic.
 */
export declare function zhudaLayaFalloff(distance: number, range: number): number;
/**
 * The same with `falloff: 'physical'`: 1 at one unit, a quarter at two,
 * brought to nothing at the range by a window that leaves the first half of
 * the range almost as the square says (0.88 of it at half the range).
 */
export declare function zhudaPhysicalFalloff(distance: number, range: number): number;
/**
 * How bright a spot is at an angle from its axis, as a share of its middle
 * (before LayaAir's own cosine): 1 inside the inner cone, 0 outside the
 * cone, a smooth step between. `penumbra` 0..1 is the share of the cone's
 * half-angle that is soft; LayaAir's own is 0.5.
 */
export declare function zhudaSpotCone(angleDeg: number, coneDeg: number, penumbra?: number): number;
/**
 * Teaches LayaAir 3.4.2's lights and sun shadows what `ZhudaLightingDepth`
 * switches on. Must run before `Laya.init`, which registers the includes
 * and compiles the lit shaders from them. Returns false when there is no
 * runtime to patch.
 */
export declare function installLaya342LightingDepth(runtime?: any): boolean;
/** Whether the includes this runtime registered were changed (after `Laya.init`). */
export declare function zhudaLightingDepthInstalled(runtime?: any): boolean;
/**
 * How much of a spot light's cone is soft, 0..1: 0 a hard rim, 1 soft from
 * the middle out; `null` gives LayaAir's own half back. `light` is the
 * LayaAir spot light component. It shows in scenes whose
 * `ZhudaLightingDepth` is alive.
 */
export declare function setZhudaSpotPenumbra(light: any, penumbra: number | null): void;
export declare class ZhudaLightingDepth {
    private readonly scene;
    private readonly camera;
    private values;
    /** Whether this asked the camera for its depth picture. */
    private askedDepth;
    /** The scene's own way of reading a vector, while this stands in for it. */
    private read;
    private write;
    private disposed;
    /**
     * `camera` is needed for contact shadows only: it is asked to draw its
     * depth picture, and left as it was on disposal.
     */
    constructor(scene3D: any, options?: ZhudaLightingDepthOptions, camera?: any);
    /**
     * LayaAir reads the vector of its shadow strengths, writes a strength into
     * it and puts it back, once for each shadow pass. The spread and the reach
     * ride in its last two numbers, put in as it goes back. What LayaAir is
     * handed to write into is a copy: it changes the scene's own vector in
     * place otherwise, which then counts as unchanged, and on WebGPU the new
     * strength (or these two numbers) never reaches the graphics card.
     */
    private watch;
    private unwatch;
    /** The scene's values; nothing once LayaAir has destroyed the scene. */
    private data;
    /** New values in place; the same limits as the options. */
    set(options: ZhudaLightingDepthOptions): void;
    private apply;
    dispose(): void;
}
