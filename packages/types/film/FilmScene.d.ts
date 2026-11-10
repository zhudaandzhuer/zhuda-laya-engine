// Generated from TypeScript source; run npm run types:generate.
/**
 * Film scenes as data. An agent (or a person) authors a `ZhudaFilmScene`,
 * changes it with patches and renders it through the existing cinematic
 * capture. Everything here is pure and runs in Node, a Worker or a browser.
 *
 * The scene only names things the engine already owns: registered procedural
 * props, texture recipes and flat PBR colours. It never carries code, file
 * paths or URLs.
 */
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
    /** Turns the sun about +Y, degrees. At 0 the light travels toward -Z. */
    azimuthDeg: number;
    /** Height above the horizon, degrees (0..90). */
    elevationDeg: number;
    intensity?: number;
    /** Linear RGB 0..1. */
    color?: ZhudaFilmVec3;
}
export interface ZhudaFilmLook {
    /** Background colour, linear RGB 0..1. */
    sky?: ZhudaFilmVec3;
    /** Ambient light colour, linear RGB 0..1. */
    ambient?: ZhudaFilmVec3;
    sun?: ZhudaFilmSun;
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
}>;
export declare const ZHUDA_FILM_DEFAULT_LOOK: Readonly<Required<ZhudaFilmLook>>;
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
    sky: ZhudaFilmVec3;
    ambient: ZhudaFilmVec3;
    sun: Required<ZhudaFilmSun>;
}
export declare function resolveZhudaFilmLook(look?: ZhudaFilmLook): ZhudaResolvedFilmLook;
/** Checks a keyed camera move: two to 256 keys, strictly increasing times from 0. */
export declare function validateZhudaFilmCameraPath(keys: unknown): string[];
/**
 * Camera at time `t` along keyed shots, eased in and out between keys
 * (smoothstep). Times outside the path hold the first or last key.
 */
export declare function sampleZhudaFilmCameraPath(keys: readonly ZhudaFilmCameraKey[], t: number): Required<ZhudaFilmCamera>;
