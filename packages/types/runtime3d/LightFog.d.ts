// Generated from TypeScript source; run npm run types:generate.
/**
 * Height fog lit by point lights, as one post-process effect.
 *
 * Fog density falls off exponentially with height. Along each view ray the
 * effect computes, in closed form, how much the fog hides the scene and how
 * much light every source scatters toward the camera, so lanterns and candles
 * get halos and distant streets sink into haze. For point lights there is no
 * ray marching and no shadowing: geometry between a light and the ray does
 * not cut the glow, only geometry on the ray itself ends it.
 *
 * With `shafts`, the sun or moon also shines into the fog, and what stands in
 * its way cuts the light: beams between trees, roofs and window bars. That
 * part marches along the view ray and looks each step up in a depth picture
 * drawn from the light's direction (`attachSun`, `renderShafts`).
 *
 * `zhudaFogOpticalDepth` and `zhudaFogAirlight` are the shader's formulas in
 * TypeScript. Only the class needs the Laya runtime.
 */
export interface ZhudaLightFogOptions {
    /** Extinction per metre at `baseY`, 0..1 (default 0.012). */
    density?: number;
    /** Height over which the density falls to 1/e, 0.5..1000 metres (default 8). */
    falloffMeters?: number;
    /** Height where the density equals `density` (default 0). */
    baseY?: number;
    /** Colour the fog itself adds (ambient light in the fog), linear RGB (default dark blue). */
    color?: readonly [number, number, number];
    /** Strength of the glow from lights, 0..16 (default 1). */
    scatter?: number;
    /** Rays are cut here, which bounds the fog on the sky, 1..100000 metres (default 600). */
    maxDistance?: number;
    /** Shadowed light from the sun or moon in the fog; needs `attachSun`. */
    shafts?: ZhudaLightShaftOptions;
}
export interface ZhudaLightShaftOptions {
    /** Brightness of the beams, 0..64 (default 1). */
    strength?: number;
    /**
     * How strongly the fog scatters forward, 0..0.95 (default 0.6): high values
     * make beams bright when looking toward the light and faint from the side.
     */
    anisotropy?: number;
    /** How far from the camera beams are drawn, 5..2000 metres (default 60). */
    distance?: number;
    /** Side of the depth picture in pixels, 256..4096 (default 2048). */
    resolution?: number;
    /** Steps along each view ray, 8..96 (default 40). */
    steps?: number;
}
export interface ZhudaFogSun {
    /** Unit vector from the scene toward the sun or moon. */
    toward: readonly [number, number, number];
    /** Linear RGB, already multiplied by the light's intensity. */
    color: readonly [number, number, number];
}
/** Most steps one view ray takes through the beams. */
export declare const ZHUDA_SHAFT_MAX_STEPS = 96;
export interface ZhudaFogLight {
    position: readonly [number, number, number];
    /** Linear RGB. */
    color: readonly [number, number, number];
    intensity: number;
    /**
     * Metres from the light beyond which a view ray gets no glow from it
     * (default 12). Keeps many lamps from adding up to a wash over the sky.
     */
    range?: number;
}
/** Most lights one fog can hold. */
export declare const ZHUDA_FOG_MAX_LIGHTS = 128;
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaLightFog(options: ZhudaLightFogOptions): string[];
/** Fills in the defaults. */
export declare function resolveZhudaLightFog(options?: ZhudaLightFogOptions): {
    density: number;
    falloffMeters: number;
    baseY: number;
    color: [number, number, number];
    scatter: number;
    maxDistance: number;
    shafts: {
        strength: number;
        anisotropy: number;
        distance: number;
        resolution: number;
        steps: number;
    } | undefined;
};
/**
 * Optical depth of the fog along a ray from `eyeY` in a direction whose
 * vertical component is `directionY` (unit vector), over `distance` metres.
 * The scene behind is seen through `exp(-depth)`.
 */
export declare function zhudaFogOpticalDepth(fog: {
    density: number;
    falloffMeters: number;
    baseY: number;
}, eyeY: number, directionY: number, distance: number): number;
/**
 * The integral of 1/r² along a ray of length `distance`, r being the distance
 * to a light whose closest approach is `offset` metres from the ray, `along`
 * metres from its start, faded to nothing where the ray passes `range` metres
 * from the light. Multiplied by the fog density and the light's colour, this
 * is the light scattered toward the camera.
 */
export declare function zhudaFogAirlight(along: number, offset: number, distance: number, range?: number): number;
export declare class ZhudaLightFog {
    /** The Laya post-process effect; `ZhudaFilmicPipeline` adds it to its chain. */
    readonly effect: any;
    private readonly material;
    private readonly lights;
    private readonly data;
    private readonly fog;
    private count;
    private disposed;
    private shaft?;
    private frame;
    constructor(options?: ZhudaLightFogOptions);
    /** Replaces the lights that shine into the fog (at most `ZHUDA_FOG_MAX_LIGHTS`). */
    setLights(lights: readonly ZhudaFogLight[]): void;
    /**
     * Lets the sun or moon shine into the fog (`shafts` options required). A
     * camera in `scene` draws what the light sees into a depth picture; call
     * `update` and then `renderShafts` before a frame drawn outside the engine's
     * frame loop. Calling it again replaces the light.
     */
    attachSun(scene: any, sun: ZhudaFogSun): void;
    /** Which frame of a sequence is drawn: moves the step noise so samples average it away. */
    setFrame(index: number): void;
    /**
     * Draws the depth picture now. The engine's frame loop already draws it;
     * call this only when a frame is rendered outside that loop (captures).
     */
    renderShafts(): void;
    /** Call when the camera moves or its field of view or aspect changes. */
    update(eye: readonly number[], target: readonly number[], fieldOfViewDeg: number, aspect: number): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
