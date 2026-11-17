// Generated from TypeScript source; run npm run types:generate.
import { type SurfaceMaterialSpec } from '../runtime3d/Surfaces.js';
import { type ShaderUniformSpec } from './ShaderMaterials.js';
export interface ZhudaLitSurfaceSpec {
    name: string;
    /**
     * Optional vertex hook, a function body contract:
     * `void zhudaVertex(inout vec3 positionWS, inout vec3 normalWS, vec2 uv, vec3 originWS)`.
     * It moves world-space positions (wind in grass and leaves, swell, wobble)
     * and may bend normals. The forward, `ShadowCaster` and `DepthNormal` passes
     * all run it, so shadows and ambient occlusion follow the moved surface.
     * `originWS` is the object's world origin (a per-instance phase). Custom
     * uniforms (`u_Zhuda…`) are visible here too. The mesh bounds are not
     * grown: keep displacement small or pad the bounds yourself.
     */
    vertex?: string;
    /** void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 worldPosition, vec3 worldNormal).
     * Fields: baseColor (linear), metallic, roughness, occlusion, emission
     * (linear HDR), alpha (0..1) and normalTS (the normal in the surface's own
     * frame: x along the texture's u, y along its v, z out of the surface;
     * (0, 0, 1) leaves it as it is).
     *
     * A surface that writes `alpha` is cut by it where the material is a
     * cut-out (`material.blend: 'cutout'`, or `alphaHash`), and its shadow and
     * its depth are cut the same way: those passes run the hook too, with the
     * material's plain colour and maps, and keep only its alpha and normal. A
     * surface that writes `normalTS` is lit by that normal, on a mesh with
     * tangents or without (the frame then comes from the texture coordinates).
     * A surface that writes neither is drawn as before.
     *
     * It is also given, to read: `viewDirection` (from the surface toward the
     * eye, a unit; with the fourth argument, the mesh's own normal before any
     * normal map, it says how steeply the surface is seen; where a light's
     * shadow is written it is toward that light, so a cloth cut by how steeply
     * it is seen shades the floor by how steeply the light meets it) and `vertexColor`
     * (the mesh's colour at this place, white where it has none: red, green
     * and blue arrive as light, a display colour to the power 2.2; alpha
     * arrives as it was given, so a plain number for the hook goes there).
     * With `sheen`: `sheenColor` and `sheenRoughness`; with `subsurface`:
     * `subsurfaceColor` and `thickness`; with `strands`: `strandShift`.
     *
     * A hook that reads `s.tangent`, `s.bitangent` or `s.viewTS` is given the
     * surface's own frame where the colours are drawn: unit vectors in the
     * world along the texture's u and v (from the mesh's tangents, or from how
     * the place and the texture coordinates change across the pixel), and the
     * view direction in that frame (x along u, y along v, z out of the
     * surface): what an iris seen through a cornea, or any pattern that lies
     * under the surface, is moved by. */
    surface: string;
    /**
     * The soft glow cloth has at its edges (velvet, knit, a stocking), from
     * LayaAir's own sheen lobe: its colour as light and its roughness 0..1
     * (default white and 0.5). The hook may change both a pixel
     * (`s.sheenColor`, `s.sheenRoughness`). Not with a `ZhudaLitShading`
     * (a toon material is lit its own way).
     */
    sheen?: {
        color?: readonly [number, number, number];
        roughness?: number;
    } | boolean;
    /**
     * Light that goes into the surface and comes out near by: skin, wax, a
     * leaf. `wrap` (0..1, default 0.5) lets a light reach round where the
     * surface turns from it, tinted by `color` (as light; default a skin's
     * red, 1, 0.35, 0.25). `back` (default 0) is how much light from behind
     * shows through a thin part, by the hook's `s.thickness` (1 thin, 0 none);
     * `power` (6) how narrow that glow is, `distortion` (0.3) how far the
     * surface's own facing bends it. The hook may change `s.subsurfaceColor`
     * and `s.thickness` a pixel at a time. A light's own shadow takes the
     * light that goes round away again; light from behind is not shadowed by
     * a sun. Not with a `ZhudaLitShading` of one's own.
     */
    subsurface?: {
        color?: readonly [number, number, number];
        wrap?: number;
        back?: number;
        power?: number;
        distortion?: number;
    } | boolean;
    /**
     * A highlight along strands (hair, brushed fur, a satin ribbon), after
     * Kajiya and Kay: two bands of light across the strands, both as strong as
     * `strength` (default 1), a narrow white one and a wider one of `color`
     * (default 0.5, 0.4, 0.3; on dark hair keep it near the hair's own colour,
     * since the band adds it to each light where the strands run square to it),
     * each moved along the strand by `shift` (default 0.05 and -0.1) and
     * as narrow as `exponent` (default 120 and 24). The strands run along the
     * texture's `along` (`'v'` by default, or `'u'`). The hook's
     * `s.strandShift` moves both a pixel at a time (a noise there breaks the
     * bands up as real hair does). Not with a `ZhudaLitShading`.
     */
    strands?: {
        along?: 'u' | 'v';
        color?: readonly [number, number, number];
        strength?: number;
        shift?: readonly [number, number];
        exponent?: readonly [number, number];
    } | boolean;
    /** The surface may call `ZhudaCommon.glsl`: hash, noise, fractal noise, triplanar. */
    common?: boolean;
    /**
     * Cut by chance instead of at one threshold: a pixel is kept with the
     * chance its alpha gives, by a pattern that stays on the object (it does
     * not swim as the camera or the object moves, and it follows a skinned
     * mesh). Half-clear things then sort themselves, cast half a shadow and
     * write depth, at the price of grain; temporal anti-aliasing smooths it.
     * The material is drawn as a cut-out.
     */
    alphaHash?: boolean;
    /** Native Laya textures use -Y (DirectX). Most scanned/glTF maps use +Y (OpenGL). */
    normalConvention?: 'directx' | 'opengl';
    /**
     * How the back of a two-sided surface is lit. `mirrored` (default) turns
     * the normal round, as for a sheet with two sides. `same` lights the back
     * with the normal the vertex gave: for blades and leaves whose normals
     * point where the light should come from, whichever side is seen.
     */
    backFaces?: 'mirrored' | 'same';
    uniforms?: Record<string, ShaderUniformSpec>;
    material?: Omit<SurfaceMaterialSpec, 'type'> & {
        clearCoat?: number;
        clearCoatRoughness?: number;
    };
}
/**
 * Lighting that replaces the physically based one of a lit template. The
 * surface hook, the vertex hook, the shadow and depth passes stay as they
 * are, so a material lit another way still casts and receives shadows as
 * the others do. `ZhudaToonMaterial` is built on it.
 */
export interface ZhudaLitShading {
    /** Names the lighting in the shader's contract: two lightings never share a shader name. */
    key: string;
    /** GLSL placed before `main`; it defines `vec4 <flow>(const in SurfaceInputs inputs,in PixelParams pixel)`. */
    functions: string;
    /** The function that takes the place of `PBR_Metallic_Flow`. */
    flow: string;
    /** Forward passes drawn after the lit one (an outline hull), from the material's own vertex programs. */
    passes?: (programs: {
        forward: string;
        shadow: string;
        depth: string;
    }) => {
        vertex: string;
        fragment: string;
        cull?: 'front' | 'back' | 'none';
    }[];
}
/** Problems with a vertex hook; an empty list means it can be compiled into the lit passes. */
export declare function validateZhudaLitVertexHook(vertex: unknown): string[];
/** What the fragment programs of a lit material need from its vertex programs. */
export interface ZhudaLitVertexNeeds {
    /** Each vertex's place in its own mesh, for the pattern of `alphaHash`. */
    objectPosition?: boolean;
    /** The shadow pass runs the surface hook: it needs the place, the normal, the texture coordinates. */
    shadowSurface?: boolean;
}
/**
 * The three vertex programs of a lit material. Without a hook they are the
 * native templates unchanged; with one, each pass runs `zhudaVertex` on the
 * world-space position and normal before projecting. `needs` adds what a
 * surface that is cut hands to its fragment programs. Pure: no Laya needed.
 */
export declare function buildZhudaLitVertexShaders(vertex?: string, needs?: ZhudaLitVertexNeeds): {
    forward: string;
    shadow: string;
    depth: string;
};
/** Which of the fields added after the first five a surface's text touches. */
export declare function zhudaLitSurfaceWrites(surface: string): {
    alpha: boolean;
    normal: boolean;
};
/** A lit surface's subsurface light: its colour and wrap; how much comes through from behind, how narrow, how bent. */
export declare const ZHUDA_LIT_SUBSURFACE_UNIFORM = "u_ZhudaLitSubsurface";
export declare const ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM = "u_ZhudaLitSubsurfaceBack";
/** A lit surface's strand highlight: the two shifts and exponents; the wide band's colour and the strength of both. */
export declare const ZHUDA_LIT_STRANDS_UNIFORM = "u_ZhudaLitStrands";
export declare const ZHUDA_LIT_STRAND_COLOR_UNIFORM = "u_ZhudaLitStrandColor";
/** The uniform a lit surface's sheen is kept in: its colour, and its roughness in the fourth place. */
export declare const ZHUDA_LIT_SHEEN_UNIFORM = "u_ZhudaLitSheen";
export interface ZhudaLitFragmentOptions {
    surface: string;
    uniforms?: Record<string, ShaderUniformSpec>;
    normalConvention?: 'directx' | 'opengl';
    backFaces?: 'mirrored' | 'same';
    common?: boolean;
    alphaHash?: boolean;
    /** The surface has a sheen (see `ZhudaLitSurfaceSpec.sheen`). */
    sheen?: unknown;
    /** The surface has subsurface light, or a strand highlight (see `ZhudaLitSurfaceSpec`). */
    subsurface?: unknown;
    strands?: unknown;
}
/**
 * The three fragment programs of a lit material, and which of the passes
 * that draw no colour run the surface hook. Pure: no Laya needed.
 */
export declare function buildZhudaLitFragmentShaders(spec: ZhudaLitFragmentOptions, shading?: ZhudaLitShading): {
    forward: string;
    shadow: string;
    depth: string;
    shadowHook: boolean;
    depthHook: boolean;
};
/** A lit surface's sheen with its defaults; null when it has none. Throws on values out of range. */
export declare function resolveZhudaLitSheen(sheen: ZhudaLitSurfaceSpec['sheen']): {
    color: [number, number, number];
    roughness: number;
} | null;
/** A lit surface's subsurface light with its defaults; null when it has none. Throws on values out of range. */
export declare function resolveZhudaLitSubsurface(subsurface: ZhudaLitSurfaceSpec['subsurface']): {
    color: [number, number, number];
    wrap: number;
    back: number;
    power: number;
    distortion: number;
} | null;
/** A lit surface's strand highlight with its defaults; null when it has none. Throws on values out of range. */
export declare function resolveZhudaLitStrands(strands: ZhudaLitSurfaceSpec['strands']): {
    along: 'u' | 'v';
    color: [number, number, number];
    strength: number;
    shift: [number, number];
    exponent: [number, number];
} | null;
/** Native Laya PBR lighting, IBL, shadows, depth normals and instancing with a bounded surface hook. */
export declare class ZhudaLitSurfaceMaterial {
    readonly material: any;
    readonly spec: ZhudaLitSurfaceSpec;
    private disposed;
    constructor(spec: ZhudaLitSurfaceSpec, textures?: Record<string, any>, shading?: ZhudaLitShading);
    set(name: string, value: any): void;
    /** The sheen's colour and roughness in place; only for a material made with `sheen`. */
    setSheen(sheen: {
        color?: readonly [number, number, number];
        roughness?: number;
    }): void;
    private writeSubsurface;
    private writeStrands;
    /** The subsurface light's values in place; only for a material made with `subsurface`. */
    setSubsurface(subsurface: {
        color?: readonly [number, number, number];
        wrap?: number;
        back?: number;
        power?: number;
        distortion?: number;
    }): void;
    /** The strand highlight's values in place (not `along`, which is in the program); only for a material made with `strands`. */
    setStrands(strands: {
        color?: readonly [number, number, number];
        strength?: number;
        shift?: readonly [number, number];
        exponent?: readonly [number, number];
    }): void;
    dispose(): void;
}
