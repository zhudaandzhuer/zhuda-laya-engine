import { type SurfacePassRequirements } from "../runtime3d/Surfaces";
export type ShaderUniformType = "float" | "vec2" | "vec3" | "vec4" | "texture2D";
export interface ShaderUniformSpec {
    type: ShaderUniformType;
    value?: number | number[];
}
export interface ZhudaShaderSpec {
    schemaVersion: 1;
    name: string;
    dimension: 2 | 3;
    surface: string;
    uniforms: Record<string, ShaderUniformSpec>;
    blend?: "opaque" | "alpha" | "additive";
    doubleSided?: boolean;
    depthWrite?: boolean;
    /** Opt out for sky domes/backgrounds; scene fog remains enabled for other surfaces. */
    fog?: boolean;
    passes?: SurfacePassRequirements;
}
export declare function validateShaderSpec(spec: unknown): string[];
/** Named and typed uniforms; built-in transforms, clipping and output remain in tested templates.
 * Surface validation is structural. Actual GLSL compilation/variants require a real rendered draw. */
export declare class ZhudaShaderMaterial {
    readonly material: any;
    readonly spec: ZhudaShaderSpec;
    private disposed;
    constructor(spec: ZhudaShaderSpec, textures?: Record<string, any>);
    setUniform(name: string, value: number | readonly number[]): void;
    setTexture(name: string, texture: any): void;
    report(): {
        name: string;
        dimension: 2 | 3;
        uniforms: string[];
        passes: SurfacePassRequirements;
        gpuStatus: "requires-first-draw";
        disposed: boolean;
    };
    dispose(): void;
}
export declare const shaderRecipes: Record<"terrain3D" | "textured3D" | "dissolve3D" | "tint2D", ZhudaShaderSpec>;
