// Generated from TypeScript source; run npm run types:generate.
/**
 * Height fog lit by point lights, as one post-process effect.
 *
 * Fog density falls off exponentially with height. Along each view ray the
 * effect computes, in closed form, how much the fog hides the scene and how
 * much light every source scatters toward the camera, so lanterns and candles
 * get halos and distant streets sink into haze. There is no ray marching and
 * no shadowing: geometry between a light and the ray does not cut the glow,
 * only geometry on the ray itself ends it.
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
}
export interface ZhudaFogLight {
    position: readonly [number, number, number];
    /** Linear RGB. */
    color: readonly [number, number, number];
    intensity: number;
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
 * metres from its start. Multiplied by the fog density and the light's
 * colour, this is the light scattered toward the camera.
 */
export declare function zhudaFogAirlight(along: number, offset: number, distance: number): number;
export declare class ZhudaLightFog {
    /** The Laya post-process effect; `ZhudaFilmicPipeline` adds it to its chain. */
    readonly effect: any;
    private readonly material;
    private readonly lights;
    private readonly data;
    private readonly fog;
    private count;
    private disposed;
    constructor(options?: ZhudaLightFogOptions);
    /** Replaces the lights that shine into the fog (at most `ZHUDA_FOG_MAX_LIGHTS`). */
    setLights(lights: readonly ZhudaFogLight[]): void;
    /** Call when the camera moves or its field of view or aspect changes. */
    update(eye: readonly number[], target: readonly number[], fieldOfViewDeg: number, aspect: number): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
