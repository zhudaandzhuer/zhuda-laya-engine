import { type SurfaceMaterialSpec } from "../runtime3d/Surfaces";
import { type ShaderUniformSpec } from "./ShaderMaterials";
export interface ZhudaLitSurfaceSpec {
    name: string;
    /** void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 worldPosition, vec3 worldNormal).
     * Fields: baseColor (linear), metallic, roughness, occlusion, emission (linear HDR).
     * Geometry, alpha and normal maps retain the native PBR shadow/depth contract. */
    surface: string;
    /** Native Laya textures use -Y (DirectX). Most scanned/glTF maps use +Y (OpenGL). */
    normalConvention?: "directx" | "opengl";
    uniforms?: Record<string, ShaderUniformSpec>;
    material?: Omit<SurfaceMaterialSpec, "type"> & {
        clearCoat?: number;
        clearCoatRoughness?: number;
    };
}
/** Native Laya PBR lighting, IBL, shadows, depth normals and instancing with a bounded surface hook. */
export declare class ZhudaLitSurfaceMaterial {
    readonly material: any;
    readonly spec: ZhudaLitSurfaceSpec;
    private disposed;
    constructor(spec: ZhudaLitSurfaceSpec, textures?: Record<string, any>);
    set(name: string, value: any): void;
    dispose(): void;
}
