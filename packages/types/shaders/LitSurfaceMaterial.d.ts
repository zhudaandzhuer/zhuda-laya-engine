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
     * A surface that writes neither is drawn as before. */
    surface: string;
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
export interface ZhudaLitFragmentOptions {
    surface: string;
    uniforms?: Record<string, ShaderUniformSpec>;
    normalConvention?: 'directx' | 'opengl';
    backFaces?: 'mirrored' | 'same';
    common?: boolean;
    alphaHash?: boolean;
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
/** Native Laya PBR lighting, IBL, shadows, depth normals and instancing with a bounded surface hook. */
export declare class ZhudaLitSurfaceMaterial {
    readonly material: any;
    readonly spec: ZhudaLitSurfaceSpec;
    private disposed;
    constructor(spec: ZhudaLitSurfaceSpec, textures?: Record<string, any>, shading?: ZhudaLitShading);
    set(name: string, value: any): void;
    dispose(): void;
}
