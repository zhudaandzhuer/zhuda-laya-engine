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
    /**
     * Shadow map splits by distance: 1, 2 or 4 (default 2). More splits keep
     * shadows near the camera sharp when `distance` is long.
     */
    cascades?: 1 | 2 | 4;
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
    /**
     * What a real camera adds, after tone mapping, each 0..1 and off by
     * default: film grain, darker corners and colour fringing at the corners.
     */
    grain?: number;
    vignette?: number;
    fringe?: number;
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
    /**
     * Fog near the ground that lights shine into: halos around lamps, haze
     * down a street. Needs `grade`; off unless given.
     */
    lightFog?: ZhudaFilmLightFog | false;
    /**
     * A photograph as the sky: a 2:1 panorama (equirectangular) named by
     * logical asset id. Replaces `atmosphere`. Off unless given.
     */
    panorama?: ZhudaFilmPanorama | false;
    /**
     * Captures the scene around one point and uses it as the environment:
     * glossy surfaces reflect it and surfaces without a lightmap get its
     * ambient light. Off unless given.
     */
    environment?: ZhudaFilmEnvironment | false;
}
/** A panoramic picture drawn as the sky (Laya's native `SkyPanoramicMaterial`). */
export interface ZhudaFilmPanorama {
    /** Logical id of a `.png` or `.jpg` picture twice as wide as it is tall. */
    asset: string;
    /** Brightness, 0..16 (default 1). */
    exposure?: number;
    /** Turns the picture about the vertical axis, degrees (default 0). */
    rotationDeg?: number;
}
/** One environment probe (see `ZhudaEnvironmentProbe`). */
export interface ZhudaFilmEnvironment {
    /** Where the surroundings are captured from: near the subject of the shot. */
    position: ZhudaFilmVec3;
    /** Scales reflections, 0..8 (default 1). */
    reflection?: number;
    /** Scales the ambient light on surfaces without a lightmap, 0..8 (default 1). */
    ambient?: number;
    /**
     * Take only reflections from the capture and keep `look.ambient` as the
     * ambient light (default false). For shots under trees or between walls,
     * where the captured ambient light is as dark as the surroundings.
     */
    reflectionOnly?: boolean;
}
/** Height fog lit by the scene's `light` nodes (see `ZhudaLightFog`). */
export interface ZhudaFilmLightFog {
    /** Extinction per metre at `baseY`, 0..1 (default 0.012). */
    density?: number;
    /** Height over which the fog thins to 1/e, 0.5..1000 metres (default 8). */
    falloffMeters?: number;
    /** Height where the density equals `density` (default 0). */
    baseY?: number;
    /** Colour of the fog itself, linear RGB 0..1 (default dark blue). */
    color?: ZhudaFilmVec3;
    /** Strength of the glow around lights, 0..16 (default 1). */
    scatter?: number;
    /**
     * Beams of the sun or moon in the fog, cut by whatever stands in the light
     * (`look.sun` gives direction, colour and intensity); off unless given.
     */
    shafts?: ZhudaFilmLightShafts | false;
}
/** One copy of a model: x, y, z in metres, yaw in degrees, uniform scale. */
export type ZhudaFilmPlacement = [number, number, number, number, number];
export interface ZhudaFilmLightShafts {
    /** Brightness of the beams, 0..64 (default 1). */
    strength?: number;
    /** Forward scattering, 0..0.95 (default 0.6): beams are brightest looking toward the light. */
    anisotropy?: number;
    /** How far from the camera beams are drawn, 5..2000 metres (default 60). */
    distance?: number;
    /** Steps along each view ray, 8..96 (default 40). */
    steps?: number;
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
    /**
     * Logical id of a Radiance `.hdr` picture of the dominant light
     * direction per lightmap texel (`d * 0.5 + 0.5`, world space). With it,
     * normal maps show relief under baked light. Needs `lightmap`; the
     * model must not be turned (`yawDeg` 0).
     */
    lightmapDirection?: string;
    /** Plays a clip of the model as a function of shot time. */
    animation?: ZhudaFilmAnimation;
    /**
     * Moves the model during the shot: two or more keys, the first at time
     * 0, times increasing. Replaces `position` and `yawDeg` while it runs;
     * the model holds the last key afterwards. Not with a lightmap.
     */
    motion?: ZhudaFilmMotionKey[];
    /**
     * Copies of the model: one `[x, y, z, yawDeg, scale]` per copy, in
     * metres relative to `position` (a forest floor of ferns, rocks along a
     * bank, trees). The copies share the model's meshes and materials. With
     * `placements` the model is drawn only at those places. Not with a
     * lightmap, an animation or motion.
     */
    placements?: ZhudaFilmPlacement[];
    /**
     * Leaves let light through: the cut-out (alpha-tested) materials of the
     * model glow in their own colour when the sun or a lamp is behind
     * them. Opaque materials of the same model (bark) are unchanged.
     */
    translucent?: boolean;
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
    type: 'water';
    /**
     * Clear running water on a horizontal rectangle (see
     * `ZhudaWaterSurface`): the bed shows through, bent by the waves and
     * tinted with depth; the surface mirrors the scene, glints in the sun
     * (`look.sun`) and foams where it is shallow. `position` is the centre;
     * `y` is the water level. Banks and stones are models that cross it.
     * Needs `grade`. One per scene, and not together with a reflector.
     */
    position: ZhudaFilmVec3;
    /** Width (X) and depth (Z) in metres. */
    size: [number, number];
    /** Flow in metres per second along X and Z (default [0, 0.6]). */
    flow?: [number, number];
    /** Colour of deep water, linear RGB 0..1 (default a green-blue). */
    color?: ZhudaFilmVec3;
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
    /** Depth under which the water foams, 0..2 metres (default 0.12); 0 is no foam. */
    foamDepth?: number;
    /** Longer side of the mirrored picture (default 1024). */
    resolution?: 256 | 512 | 1024 | 2048;
    /** Ids of model nodes the mirror must not draw (the bed, if it shows in the reflection). */
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
    /**
     * Spot lights: the light casts shadows. One per scene (Laya 3.4.2 draws
     * one spot shadow map); point lights cannot cast shadows.
     */
    castsShadow?: boolean;
    /**
     * Keeps the light at `offset` (metres, in the model's own frame: +Z is
     * the model's front before `yawDeg`) from a `model` node, following its
     * `motion`. Point lights only; `position` is then ignored.
     */
    follows?: {
        node: string;
        offset?: ZhudaFilmVec3;
    };
    /**
     * The light only shines into `look.lightFog` and does not light
     * surfaces: for lamps whose light is already in a lightmap. Point
     * lights only; such lights do not count against the 32 real-time lights.
     */
    fogOnly?: boolean;
};
/** A clip of a model, sampled at `offsetSec + shotTime * speed`. */
export interface ZhudaFilmAnimation {
    /** Name of an animation in the model file. */
    clip: string;
    /** Repeat the clip (default true); otherwise hold its last frame. */
    loop?: boolean;
    /** 0..8 (default 1). */
    speed?: number;
    /** Clip time at shot time 0, 0..3600 seconds (default 0). */
    offsetSec?: number;
}
export interface ZhudaFilmMotionKey {
    /** Seconds from the start of the shot. */
    time: number;
    position: ZhudaFilmVec3;
    /** Defaults to the previous key's yaw (the node's `yawDeg` for the first). */
    yawDeg?: number;
}
/**
 * Where a moving node is at `time`: linear between keys, yaw the short way
 * around, the first and last keys held outside their range.
 */
export declare function sampleZhudaFilmMotion(keys: readonly ZhudaFilmMotionKey[], time: number, baseYawDeg?: number): {
    position: ZhudaFilmVec3;
    yawDeg: number;
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
    /**
     * Real-time lights a scene may ask for. The runtime must have been booted
     * with at least as many (`maxLights`; Laya's default is 32).
     */
    lights: 128;
    /** Point lights one `lightFog` can hold, fog-only lights included. */
    fogLights: 128;
    models: 64;
    /** Copies of one model node; a scene holds at most `placementsTotal` in all. */
    placements: 20000;
    placementsTotal: 60000;
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
    lightFog: (Required<Omit<ZhudaFilmLightFog, 'shafts'>> & {
        shafts: Required<ZhudaFilmLightShafts> | false;
    }) | false;
    environment: Required<ZhudaFilmEnvironment> | false;
    panorama: Required<ZhudaFilmPanorama> | false;
}
export declare function resolveZhudaFilmLook(look?: ZhudaFilmLook): ZhudaResolvedFilmLook;
/** Checks a keyed camera move: two to 256 keys, strictly increasing times from 0. */
export declare function validateZhudaFilmCameraPath(keys: unknown): string[];
/**
 * Camera at time `t` along keyed shots, eased in and out between keys
 * (smoothstep). Times outside the path hold the first or last key.
 */
export declare function sampleZhudaFilmCameraPath(keys: readonly ZhudaFilmCameraKey[], t: number): Required<ZhudaFilmCamera>;
export {};
