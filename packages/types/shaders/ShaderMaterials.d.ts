// Generated from TypeScript source; run npm run types:generate.
import { type SurfacePassRequirements } from '../runtime3d/Surfaces.js';
export type ShaderUniformType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'int' | 'mat4' | 'texture2D' | 'textureCube';
export interface ShaderUniformSpec {
    type: ShaderUniformType;
    /**
     * A number for `float` and `int`, that many for a vector, sixteen in
     * column order for `mat4`; with `length`, that many elements one after
     * another.
     */
    value?: number | number[];
    /**
     * An array of `float`, `vec2`, `vec3` or `vec4`, 2..64 elements: the
     * shader reads `u_ZhudaName[i]`.
     */
    length?: number;
}
export interface ZhudaShaderSpec {
    schemaVersion: 1;
    name: string;
    dimension: 2 | 3;
    surface: string;
    uniforms: Record<string, ShaderUniformSpec>;
    blend?: 'opaque' | 'alpha' | 'additive';
    doubleSided?: boolean;
    depthWrite?: boolean;
    /** Opt out for sky domes/backgrounds; scene fog remains enabled for other surfaces. */
    fog?: boolean;
    passes?: SurfacePassRequirements;
    /**
     * The surface may call the functions of `ZhudaCommon.glsl`: `zhudaHash`,
     * `zhudaNoise`, `zhudaFbm`, `zhudaTriplanarWeights`, `zhudaTriplanar`.
     */
    common?: boolean;
}
export declare function validateShaderSpec(spec: unknown): string[];
/** Named and typed uniforms; built-in transforms, clipping and output remain in tested templates.
 * Surface validation is structural. Actual GLSL compilation/variants require a real rendered draw. */
export declare class ZhudaShaderMaterial {
    readonly material: any;
    readonly spec: ZhudaShaderSpec;
    private disposed;
    constructor(spec: ZhudaShaderSpec, textures?: Record<string, any>);
    /**
     * A uniform's value: a number, a vector's numbers, a matrix's sixteen in
     * column order, or an array's elements one after another.
     */
    setUniform(name: string, value: number | readonly number[] | Float32Array): void;
    setTexture(name: string, texture: any): void;
    report(): {
        name: string;
        dimension: 3 | 2;
        uniforms: string[];
        passes: SurfacePassRequirements;
        gpuStatus: "requires-first-draw";
        disposed: boolean;
    };
    dispose(): void;
}
export declare const shaderRecipes: Record<'terrain3D' | 'textured3D' | 'dissolve3D' | 'matcap3D' | 'normalView3D' | 'tint2D', ZhudaShaderSpec>;
