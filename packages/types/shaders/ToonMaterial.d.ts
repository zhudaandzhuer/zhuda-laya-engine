// Generated from TypeScript source; run npm run types:generate.
/**
 * Cel shading on the lit template: the light a point receives (N·L times its
 * shadow) is cut into bands instead of fading, per light, for every light
 * LayaAir gives the surface: directional, point and spot, with their
 * shadows. The band edge follows the cast shadow too, so a shadow has the
 * same hard rim as the shaded side. A highlight with a hard rim, a rim
 * light and an outline are optional.
 *
 * The outline is a second forward pass of the same material: the mesh drawn
 * again inside out, pushed along its normals, in one colour. It follows
 * skinning, instancing and the vertex hook because it is the same vertex
 * program. A mesh with split normals (a cube's corners) opens gaps in it:
 * give such meshes smooth normals. It is not in the depth texture, so depth
 * of field and fog by depth see what is behind the line.
 *
 * Only the class needs the Laya runtime; the ramp functions are plain.
 */
import { type SurfaceMaterialSpec } from '../runtime3d/Surfaces.js';
import type { ShaderUniformSpec } from './ShaderMaterials.js';
export interface ZhudaToonRamp {
    /**
     * Where one band ends and the next begins, on the light a point receives
     * (N·L times its shadow, 0..1): one to four values, ascending, inside 0..1.
     */
    edges: readonly number[];
    /**
     * How bright each band is, darkest first: one more value than `edges`, not
     * decreasing, 0..4. The first is the side turned from the light and its
     * shadows; 1 is the light at full.
     */
    levels: readonly number[];
    /** Width of the blend across an edge, in the unit of `edges` (default 0.02; 0 is a hard step). */
    softness?: number;
}
export type ZhudaToonColor = readonly [number, number, number];
export interface ZhudaToonHighlight {
    /** Display colour (as a colour picker gives it). */
    color: ZhudaToonColor;
    /** Half-angle of the highlight in degrees, above 0 and up to 90: on a ball it is a disc this wide. */
    sizeDeg: number;
    /** Multiplies the colour (default 1; above 1 it is bright enough to bloom), 0..16. */
    strength?: number;
    /** Width of the blend across its rim, on N·H (default 0.01), 0..1. */
    softness?: number;
}
export interface ZhudaToonRim {
    /** Display colour. */
    color: ZhudaToonColor;
    /** How far in from the silhouette the rim reaches, above 0 and up to 1 (0.3 is a thin rim). */
    width: number;
    /** Multiplies the colour (default 1), 0..16. */
    strength?: number;
    /** Width of the blend across its inner edge (default 0.02), 0..1. */
    softness?: number;
}
export interface ZhudaToonOutline {
    /** Display colour. */
    color: ZhudaToonColor;
    /**
     * `screen` (default): pixels of the picture being drawn, the same at any
     * distance, 0..32. `world`: scene units, thinner with distance, 0..10.
     */
    width: number;
    space?: 'screen' | 'world';
}
/**
 * A colour for the side away from the light, as MToon has it (VRM): the
 * bands go from this colour (level 0) to the base colour (level 1) instead
 * of darkening the base colour. They are laid on 0.5 + 0.5·N·L, the whole
 * way round, so `ramp.edges` 0.5 is where the surface turns from the
 * light; a directional light's shadow takes a point to the shade colour,
 * and a lamp's falloff dims both colours.
 */
export interface ZhudaToonShade {
    /** Display colour. */
    color: ZhudaToonColor;
    /**
     * `true` (default): the base colour (with its texture) times this colour,
     * a darker tint of the same picture. `false`: this colour alone.
     */
    multiply?: boolean;
}
export interface ZhudaToonAmbient {
    /** How much of the scene's ambient light the surface takes (default 1), 0..8. */
    strength?: number;
    /**
     * 1 (default): the same on every side, the flat shade of a drawing. 0: as
     * the scene's ambient light falls on each side, like the other materials.
     */
    flat?: number;
}
export interface ZhudaToonSpec {
    /** Shader name: `Zhuda` then letters, digits or `_`. Materials of one name share a shader. */
    name: string;
    /** Default: two bands, `ZHUDA_TOON_DEFAULT_RAMP`. */
    ramp?: ZhudaToonRamp;
    highlight?: ZhudaToonHighlight;
    rim?: ZhudaToonRim;
    /** Whether a shader has the outline pass is fixed by the first material of its name. */
    outline?: ZhudaToonOutline;
    ambient?: ZhudaToonAmbient;
    /** A shade colour (MToon's); without it a band's level darkens the base colour. */
    shade?: ZhudaToonShade;
    /** As `ZhudaLitSurfaceSpec.surface`; metallic and roughness are not used. */
    surface?: string;
    /** As `ZhudaLitSurfaceSpec.vertex`; the outline moves with it. */
    vertex?: string;
    normalConvention?: 'directx' | 'opengl';
    backFaces?: 'mirrored' | 'same';
    /** Custom uniforms for the hooks; names beginning `u_ZhudaToon` or `u_ZhudaOutline` are the material's own. */
    uniforms?: Record<string, ShaderUniformSpec>;
    material?: Omit<SurfaceMaterialSpec, 'type' | 'metallic' | 'roughness' | 'clearCoat' | 'clearCoatRoughness'>;
}
/** Two bands: the lit side at full, the rest at 0.45. */
export declare const ZHUDA_TOON_DEFAULT_RAMP: ZhudaToonRamp;
/** Problems with a ramp; an empty list means the material takes it. */
export declare function validateZhudaToonRamp(ramp: unknown): string[];
/**
 * A ramp of `bands` equal bands (2 to 5): the darkest at `darkest` (default
 * 0.3), the brightest at 1, the ones between evenly spaced. The first edge
 * is at `from` (default 0.15) and the last at `to` (default 0.75).
 */
export declare function zhudaToonRamp(bands: number, options?: {
    darkest?: number;
    from?: number;
    to?: number;
    softness?: number;
}): ZhudaToonRamp;
/**
 * The brightness the shader gives a point that receives `lit` (N·L times
 * its shadow, 0..1): the same arithmetic as the shader, for tests and tools.
 */
export declare function zhudaToonBand(ramp: ZhudaToonRamp, lit: number): number;
/** Problems with a toon spec; an empty list means `ZhudaToonMaterial` takes it. */
export declare function validateZhudaToonSpec(spec: unknown): string[];
/**
 * The outline pass from a material's shadow programs: the same vertices
 * (skinning, the vertex hook, the alpha test), projected as a hull and
 * filled with one colour. Pure: no Laya needed.
 */
export declare function buildZhudaToonOutlinePass(shadowVertex: string): {
    vertex: string;
    fragment: string;
};
/** A lit material shaded in bands, with LayaAir's lights, shadows, fog, skinning and instancing. */
export declare class ZhudaToonMaterial {
    /** The Laya material: give it to a renderer. */
    readonly material: any;
    readonly spec: ZhudaToonSpec;
    private readonly lit;
    private readonly hasOutline;
    private disposed;
    constructor(spec: ZhudaToonSpec, textures?: Record<string, any>);
    private check;
    private probe;
    /** Changes the bands; nothing is compiled. */
    setRamp(ramp: ZhudaToonRamp): void;
    private base;
    private shape;
    /** The highlight, or `null` for none. */
    setHighlight(highlight: ZhudaToonHighlight | null): void;
    /** The rim light, or `null` for none. */
    setRim(rim: ZhudaToonRim | null): void;
    /** The shade colour, or `null` for none (the bands darken the base colour). */
    setShade(shade: ZhudaToonShade | null): void;
    setAmbient(ambient: ZhudaToonAmbient): void;
    /**
     * Colour, width and space of the outline. Only for a material made with an
     * outline: the pass is part of the shader. A width of 0 hides the line.
     */
    setOutline(outline: ZhudaToonOutline): void;
    /** A custom uniform of the hooks (`spec.uniforms`). */
    set(name: string, value: any): void;
    dispose(): void;
}
