// Generated from TypeScript source; run npm run types:generate.
type V3 = readonly [number, number, number];
export interface ZhudaUnderwaterCaustics {
    /** How strongly the waves gather sunlight, 0..4 (default 1); 0 is a plain dimmed sun. */
    strength?: number;
    /** Length of the longest wave in metres, 0.2..50 (default 2.5). */
    waveMeters?: number;
    /** Height of the waves relative to the default, 0..4 (default 1). */
    waves?: number;
    /** Metres below the surface over which caustics fade to about a third, 0.5..500 (default 10). */
    fadeDepth?: number;
    /** Metres from the eye beyond which caustics are gone, 1..2000 (default 40). */
    fadeDistance?: number;
}
export interface ZhudaUnderwaterOptions {
    /** Height of the water's surface (default 0). */
    surfaceY?: number;
    /**
     * Light the water scatters toward the eye where it is thick, as light:
     * scene-linear RGB (default a sea blue-green). A film look decodes its
     * display value first.
     */
    color?: V3;
    /** Extinction per metre for red, green and blue, each 0..10 (default [0.45, 0.12, 0.08]). */
    extinction?: V3;
    /** Rays are cut here, which bounds the water on open views, 1..10000 metres (default 150). */
    maxDistance?: number;
    /** Caustics and how the waves are made; `false` for none. */
    caustics?: ZhudaUnderwaterCaustics | false;
    /** Draw the surface seen from below (default true). */
    surface?: boolean;
}
export type ZhudaResolvedUnderwater = Required<Omit<ZhudaUnderwaterOptions, 'caustics'>> & {
    caustics: Required<ZhudaUnderwaterCaustics> | false;
};
/** The define that turns the lighting part on for a scene. */
export declare const ZHUDA_UNDERWATER_DEFINE = "ZHUDA_UNDERWATER";
/** The layer the surface seen from below is drawn on (left out of light shafts' depth picture). */
export declare const ZHUDA_UNDERWATER_LAYER = 29;
/** Lists what is wrong with the options; empty when they are valid. Needs no GPU. */
export declare function validateZhudaUnderwater(options: ZhudaUnderwaterOptions): string[];
/** The options with their defaults. */
export declare function resolveZhudaUnderwater(options?: ZhudaUnderwaterOptions): ZhudaResolvedUnderwater;
/** How much of each channel survives `meters` of water. */
export declare function zhudaUnderwaterTransmittance(extinction: V3, meters: number): [number, number, number];
/** Height, slope (d/dx, d/dz) and the second derivatives (xx, zz, xz) of the waves at x, z. */
export declare function zhudaUnderwaterWaves(x: number, z: number, seconds: number, waveMeters?: number, waves?: number): {
    height: number;
    slope: [number, number];
    curvature: [number, number, number];
};
/**
 * How much sunlight is gathered at a point `depth` metres of light path below
 * where it crossed the surface at x, z: the area the waves focus onto it
 * (1 where flat; above 1 in the bright lines; at most 6).
 */
export declare function zhudaCausticIntensity(x: number, z: number, depth: number, seconds: number, waveMeters?: number, waves?: number): number;
/** An include's text with the underwater light, or unchanged with the reason. Pure. */
export declare function zhudaPatchUnderwaterInclude(name: string, text: string): {
    text: string;
    reason?: string;
};
/**
 * Teaches LayaAir's PBR and Blinn-Phong lighting the underwater light. Must
 * run before `Laya.init` (`ZhudaEngine.boot` does it). Returns false when
 * there is no runtime to patch.
 */
export declare function installLaya342Underwater(runtime?: any): boolean;
/** Whether the underwater light reaches LayaAir's lit shaders in this runtime (after `Laya.init`). */
export declare function zhudaUnderwaterInstalled(runtime?: any): {
    light: boolean;
    includes: string[];
};
/** One underwater medium: its post effect, the scene's lighting values and the surface from below. */
export declare class ZhudaUnderwater {
    /** The Laya post-process effect; the HDR chain takes it after the light fog. */
    readonly effect: any;
    private readonly material;
    private readonly scene;
    private resolved;
    private readonly underside?;
    private readonly backdrop?;
    /** The camera's far plane, as last told or last seen by the effect. */
    private far;
    private readonly define;
    private seconds;
    private disposed;
    /**
     * `scene3D`: the scene whose lit surfaces take the underwater light. `sky`
     * and `sun` (as light) light the window in the surface seen from below.
     */
    constructor(scene3D: any, options?: ZhudaUnderwaterOptions, light?: {
        sky?: V3;
        sun?: {
            toward: V3;
            color: V3;
        };
    });
    /** The values in use, with their defaults. */
    get options(): ZhudaResolvedUnderwater;
    /**
     * Changes the water in place (clearer, murkier, calmer): colour,
     * extinction, surface height, reach and the caustics' values. Whether there
     * are caustics and whether the surface is drawn are fixed at construction.
     */
    set(options: ZhudaUnderwaterOptions): void;
    private write;
    /** Where the waves are: seconds of a shot (a film) or of play (a game's clock). */
    setTime(seconds: number): void;
    /**
     * The camera for the next frame (as `ZhudaLightFog.update`): the medium is
     * drawn while the eye is below the surface, and the surface seen from
     * below follows the eye. `farMeters` is the camera's far plane: what stands
     * behind the water is put just inside it. Left out, it is taken from the
     * camera that draws the effect, a frame late.
     */
    update(eye: V3, target: V3, fieldOfViewDeg: number, aspect: number, farMeters?: number): void;
    dispose(): void;
}
export {};
