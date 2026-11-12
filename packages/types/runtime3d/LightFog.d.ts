// Generated from TypeScript source; run npm run types:generate.
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
    private fog;
    private readonly authored;
    private count;
    private disposed;
    private shaft?;
    private refresh;
    /** What the depth picture was last drawn for; undefined forces a redraw. */
    private drawnFor;
    private boxCentre;
    private frame;
    constructor(options?: ZhudaLightFogOptions);
    /**
     * Changes the fog in place (weather turning): density, falloff, base
     * height, colour, scatter, reach, and the strength and spread of the light
     * shafts. The next \`update\` shows it. Whether there are shafts, and their
     * distance, resolution and step count, are fixed at construction.
     */
    setFog(values: {
        density?: number;
        falloffMeters?: number;
        baseY?: number;
        color?: readonly [number, number, number];
        scatter?: number;
        maxDistance?: number;
        shafts?: {
            strength?: number;
            anisotropy?: number;
        };
    }): void;
    /** Replaces the lights that shine into the fog (at most `ZHUDA_FOG_MAX_LIGHTS`). */
    setLights(lights: readonly ZhudaFogLight[]): void;
    /**
     * Lets the sun or moon shine into the fog (`shafts` options required). A
     * camera in `scene` draws what the light sees into a depth picture; call
     * `update` and then `renderShafts` before every frame. Calling it again
     * replaces the light.
     */
    attachSun(scene: any, sun: ZhudaFogSun): void;
    /** Which frame of a sequence is drawn: moves the step noise so samples average it away. */
    setFrame(index: number): void;
    /**
     * `always` (default): `renderShafts` redraws the depth picture every time,
     * which moving things in the light need. `moved`: the picture covers a
     * larger box that follows the camera in steps and is redrawn only when the
     * camera has left it, which suits a game with still scenery.
     */
    setShaftRefresh(mode: 'always' | 'moved'): void;
    /** Forces the next `renderShafts` to redraw (the scenery changed). */
    invalidateShafts(): void;
    /**
     * Draws the depth picture of the light. Call it after `update`, before the
     * main camera draws; the engine's frame loop does not draw it. The pass
     * needs no shadow maps of its own and does not draw any.
     */
    renderShafts(): void;
    /** Call when the camera moves or its field of view or aspect changes. */
    update(eye: readonly number[], target: readonly number[], fieldOfViewDeg: number, aspect: number): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
