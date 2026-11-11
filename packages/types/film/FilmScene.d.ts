// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaTextureRecipe } from '../procedural/TextureRecipe.js';
export type ZhudaFilmVec3 = [number, number, number];
export interface ZhudaFilmCamera {
    eye: ZhudaFilmVec3;
    target: ZhudaFilmVec3;
    /** 35 mm full-frame equivalent focal length (default 35). */
    focalLengthMm?: number;
    /** Aperture used by final renders for depth of field (default 8). */
    fStop?: number;
    /** Metres; defaults to the eye-target distance. */
    focusDistanceM?: number;
}
export interface ZhudaFilmSun {
    /** Turns the sun about +Y, degrees. At 0 the light travels toward -Z. Defaults to the preset. */
    azimuthDeg?: number;
    /** Height above the horizon, degrees (0..90). Defaults to the preset. */
    elevationDeg?: number;
    intensity?: number;
    /** Linear RGB 0..1. */
    color?: ZhudaFilmVec3;
}
export type ZhudaFilmLookPreset = 'day' | 'dawn' | 'dusk' | 'night' | 'overcast';
/** Sun shadows (native `DirectionLightCom` shadow maps). */
export interface ZhudaFilmShadows {
    /** Metres from the camera that receive shadows (default 60). */
    distance?: number;
    /** 'soft' filters the edge (default); 'hard' does not. */
    softness?: 'hard' | 'soft';
    /** 0..1 (default 1). */
    strength?: number;
    /** Shadow map size (default 2048). */
    resolution?: 1024 | 2048 | 4096;
}
/** Procedural sky (native `SkyProceduralMaterial`); the sun disk follows the sun. */
export interface ZhudaFilmAtmosphere {
    /** Air density, 0..5 (default 1); higher is redder near the horizon. */
    thickness?: number;
    /** Linear RGB 0..1. */
    skyTint?: ZhudaFilmVec3;
    /** Colour below the horizon, linear RGB 0..1. */
    groundTint?: ZhudaFilmVec3;
    /** 0..8 (default 1.3). */
    exposure?: number;
    /** Sun disk size, 0..1 (default 0.04). */
    sunSize?: number;
}
/** Linear distance fog (native scene fog). */
export interface ZhudaFilmFog {
    /** Linear RGB 0..1; defaults to the sky or horizon colour. */
    color?: ZhudaFilmVec3;
    /** Metres where fog starts and where it is complete. */
    start: number;
    end: number;
}
/** Filmic camera chain (existing `ZhudaFilmicPipeline`): HDR, ACES, bloom, AO. */
export interface ZhudaFilmGrade {
    /** Linear exposure multiplier, 0.05..16 (default 1). */
    exposure?: number;
    /** 0.5..2 (default 1). */
    contrast?: number;
    /** 0..2 (default 1). */
    saturation?: number;
    /** Bloom intensity, 0..2; 0 turns bloom off (default 0.1). */
    bloom?: number;
    /** Ambient occlusion intensity, 0..4; 0 turns it off (default 0.5). */
    ao?: number;
    /** Ambient occlusion radius in metres, 0.05..5 (default 0.5). */
    aoRadius?: number;
}
export interface ZhudaFilmLook {
    /**
     * A time of day. Every other field overrides the preset. Without a preset
     * the look is the plain one: flat sky colour, no shadows, sky or fog.
     */
    preset?: ZhudaFilmLookPreset;
    /** Flat background colour (used when there is no atmosphere), linear RGB 0..1. */
    sky?: ZhudaFilmVec3;
    /** Ambient light colour, linear RGB 0..1. */
    ambient?: ZhudaFilmVec3;
    sun?: ZhudaFilmSun;
    /** `false` turns sun shadows off. */
    shadows?: ZhudaFilmShadows | false;
    /** `false` uses the flat `sky` colour instead of a procedural sky. */
    atmosphere?: ZhudaFilmAtmosphere | false;
    fog?: ZhudaFilmFog | false;
    /** HDR tone-mapped rendering with bloom and ambient occlusion; off unless given. */
    grade?: ZhudaFilmGrade | false;
}
/** A baked recipe (a registered recipe name or an inline recipe) or a flat PBR colour. */
export type ZhudaFilmMaterial = {
    recipe: string | ZhudaTextureRecipe;
    tint?: [number, number, number, number];
    /** Bake size; 128, 256 or 512 (default 256). */
    size?: 128 | 256 | 512;
} | {
    color: ZhudaFilmVec3;
    roughness?: number;
    metallic?: number;
    /** Self-lit colour (lamp heads, signs), linear RGB 0..8. */
    emission?: ZhudaFilmVec3;
};
export type ZhudaFilmNode = {
    id: string;
    type: 'prop';
    /** Id in the prop registry the host was given. */
    prop: string;
    position: ZhudaFilmVec3;
    yawDeg?: number;
    seed?: number;
    params?: Record<string, unknown>;
} | {
    id: string;
    type: 'box';
    size: ZhudaFilmVec3;
    /** Centre of the underside. */
    position: ZhudaFilmVec3;
    yawDeg?: number;
    bevel?: number;
    /** A scene material, or a recipe name the host knows. */
    material: string;
} | {
    id: string;
    type: 'ground';
    /** Width (X) and depth (Z) in metres; the top surface sits at y = 0. */
    size: [number, number];
    material: string;
} | {
    id: string;
    type: 'model';
    /** Logical id of a self-contained `.glb` the host's asset provider delivers. */
    asset: string;
    /** Where the model's origin goes. */
    position: ZhudaFilmVec3;
    yawDeg?: number;
    /** Uniform scale, 0.001..1000 (default 1). */
    scale?: number;
    /**
     * Logical id of a Radiance `.hdr` lightmap baked for this model: the
     * diffuse light reaching its surfaces (direct and bounced), laid out by
     * the meshes' second UV set. Replaces the flat ambient on this model.
     */
    lightmap?: string;
    /** Scales the lightmap, 0..16 (default 1). */
    lightmapIntensity?: number;
} | {
    id: string;
    type: 'reflector';
    /**
     * A horizontal rectangle that mirrors the scene above it (wet paving,
     * still water). `position` is its centre; `y` is the mirror height and
     * should sit a few millimetres above the surface it covers.
     */
    position: ZhudaFilmVec3;
    /** Width (X) and depth (Z) in metres. */
    size: [number, number];
    /** Brightness of the reflection, 0..4 (default 1). */
    strength?: number;
    /** Share of the surface that is standing water, 0..1 (default 0.45). */
    wetness?: number;
    /** Blur on damp areas, 0..1 (default 0.35). */
    roughness?: number;
    /** How much damp areas break the reflection up, 0..1 (default 0.4). */
    ripple?: number;
    /** Size of the puddle pattern in metres, 0.1..100 (default 3). */
    patternMeters?: number;
    /** Longer side of the mirrored picture (default 1024). */
    resolution?: 256 | 512 | 1024 | 2048;
    /**
     * Ids of model nodes the mirror must not draw: the ground under the
     * reflector, which would otherwise block the view from below.
     */
    hides?: string[];
} | {
    id: string;
    type: 'light';
    /** Point lights shine all around; spot lights shine at `target`. */
    kind: 'point' | 'spot';
    position: ZhudaFilmVec3;
    /** Linear RGB 0..1 (default warm white). */
    color?: ZhudaFilmVec3;
    /** 0..20 (default 2). */
    intensity?: number;
    /** Metres the light reaches, 0.1..200 (default 12). */
    range?: number;
    /** Spot lights: the point they aim at. */
    target?: ZhudaFilmVec3;
    /** Spot lights: full cone angle, 1..179 degrees (default 60). */
    spotAngleDeg?: number;
};
export interface ZhudaFilmScene {
    schemaVersion: 1;
    id: string;
    camera: ZhudaFilmCamera;
    look?: ZhudaFilmLook;
    materials?: Record<string, ZhudaFilmMaterial>;
    nodes: ZhudaFilmNode[];
}
/** Atomic change set. Removals run first, then upserts by node id. */
export interface ZhudaFilmScenePatch {
    camera?: Partial<ZhudaFilmCamera>;
    look?: Partial<ZhudaFilmLook>;
    /** `null` removes a material. */
    materials?: Record<string, ZhudaFilmMaterial | null>;
    upsert?: ZhudaFilmNode[];
    remove?: string[];
}
export interface ZhudaFilmValidationContext {
    /** Prop ids the host can build. When omitted, prop ids are not checked. */
    props?: readonly string[];
    /** Recipe names the host can bake. When omitted, recipe names are not checked. */
    recipes?: readonly string[];
    /** Asset ids the host can deliver. When omitted, asset ids are not checked. */
    assets?: readonly string[];
}
export interface ZhudaFilmCameraKey {
    time: number;
    camera: ZhudaFilmCamera;
}
export declare const ZHUDA_FILM_LIMITS: Readonly<{
    nodes: 512;
    materials: 64;
    extent: 10000;
    idLength: 64;
    /** Laya 3.4.2 `Config3D.maxLightCount` default. */
    lights: 32;
    models: 64;
}>;
/** The plain look of scenes without a preset (phase 1 behaviour). */
export declare const ZHUDA_FILM_DEFAULT_LOOK: Readonly<{
    sky: ZhudaFilmVec3;
    ambient: ZhudaFilmVec3;
    sun: Readonly<{
        azimuthDeg: 50;
        elevationDeg: 40;
        intensity: 1.2;
        color: ZhudaFilmVec3;
    }>;
}>;
type PresetLook = {
    sky: ZhudaFilmVec3;
    ambient: ZhudaFilmVec3;
    sun: Required<ZhudaFilmSun>;
    shadows: Required<ZhudaFilmShadows>;
    atmosphere: Required<ZhudaFilmAtmosphere>;
    fog: Required<ZhudaFilmFog> | false;
};
/** Starting points for a time of day; any look field overrides them. */
export declare const ZHUDA_FILM_LOOK_PRESETS: Readonly<Record<ZhudaFilmLookPreset, PresetLook>>;
/** Lists every problem with a path; an empty list means the scene is valid. */
export declare function validateZhudaFilmScene(scene: unknown, context?: ZhudaFilmValidationContext): string[];
/** Throws with every problem listed; returns a detached copy otherwise. */
export declare function parseZhudaFilmScene(scene: unknown, context?: ZhudaFilmValidationContext): ZhudaFilmScene;
/** Applies a patch atomically: the input is untouched and an invalid result throws. */
export declare function applyZhudaFilmScenePatch(scene: ZhudaFilmScene, patch: ZhudaFilmScenePatch, context?: ZhudaFilmValidationContext): ZhudaFilmScene;
/** Camera with every default filled in. */
export declare function resolveZhudaFilmCamera(camera: ZhudaFilmCamera): Required<ZhudaFilmCamera>;
/** Look with every default filled in. */
export interface ZhudaResolvedFilmLook {
    preset: ZhudaFilmLookPreset | null;
    sky: ZhudaFilmVec3;
    ambient: ZhudaFilmVec3;
    sun: Required<ZhudaFilmSun>;
    shadows: Required<ZhudaFilmShadows> | false;
    atmosphere: Required<ZhudaFilmAtmosphere> | false;
    fog: Required<ZhudaFilmFog> | false;
    grade: Required<ZhudaFilmGrade> | false;
}
/**
 * Look with every value filled in: the preset (if any) first, then the
 * scene's own fields. Without a preset, shadows, atmosphere and fog stay off
 * unless the scene turns them on.
 */
export declare function resolveZhudaFilmLook(look?: ZhudaFilmLook): ZhudaResolvedFilmLook;
/** Checks a keyed camera move: two to 256 keys, strictly increasing times from 0. */
export declare function validateZhudaFilmCameraPath(keys: unknown): string[];
/**
 * Camera at time `t` along keyed shots, eased in and out between keys
 * (smoothstep). Times outside the path hold the first or last key.
 */
export declare function sampleZhudaFilmCameraPath(keys: readonly ZhudaFilmCameraKey[], t: number): Required<ZhudaFilmCamera>;
export {};
