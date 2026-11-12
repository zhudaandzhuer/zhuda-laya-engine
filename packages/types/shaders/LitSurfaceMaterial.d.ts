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
     * Fields: baseColor (linear), metallic, roughness, occlusion, emission (linear HDR).
     * Geometry, alpha and normal maps retain the native PBR shadow/depth contract. */
    surface: string;
    /** Native Laya textures use -Y (DirectX). Most scanned/glTF maps use +Y (OpenGL). */
    normalConvention?: 'directx' | 'opengl';
    uniforms?: Record<string, ShaderUniformSpec>;
    material?: Omit<SurfaceMaterialSpec, 'type'> & {
        clearCoat?: number;
        clearCoatRoughness?: number;
    };
}
/** Problems with a vertex hook; an empty list means it can be compiled into the lit passes. */
export declare function validateZhudaLitVertexHook(vertex: unknown): string[];
/**
 * The three vertex programs of a lit material. Without a hook they are the
 * native templates unchanged; with one, each pass runs `zhudaVertex` on the
 * world-space position and normal before projecting. Pure: no Laya needed.
 */
export declare function buildZhudaLitVertexShaders(vertex?: string): {
    forward: string;
    shadow: string;
    depth: string;
};
/** Native Laya PBR lighting, IBL, shadows, depth normals and instancing with a bounded surface hook. */
export declare class ZhudaLitSurfaceMaterial {
    readonly material: any;
    readonly spec: ZhudaLitSurfaceSpec;
    private disposed;
    constructor(spec: ZhudaLitSurfaceSpec, textures?: Record<string, any>);
    set(name: string, value: any): void;
    dispose(): void;
}
