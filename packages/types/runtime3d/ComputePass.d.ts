// Generated from TypeScript source; run npm run types:generate.
export type ZhudaComputeElement = 'float' | 'vec4' | 'uint';
export interface ZhudaComputeBufferSpec {
    /** What one element is: a float, four floats, or an unsigned integer. */
    type: ZhudaComputeElement;
    /** How many elements, 1..16777216. */
    length: number;
    /** `'read'`: the step only reads it (default `'read-write'`). */
    access?: 'read' | 'read-write';
    /** Also the vertex data of a draw (`ZhudaComputedInstances`); `vec4` only. */
    vertex?: boolean;
}
export interface ZhudaComputeUniformSpec {
    type: 'float' | 'vec4' | 'int';
    value?: number | readonly number[];
}
export type ZhudaComputeArrays = Record<string, Float32Array | Uint32Array>;
export type ZhudaComputeValues = Record<string, number | number[]>;
export interface ZhudaComputeSpec {
    /** `Zhuda` and letters, digits or `_`. A name names its code: two passes of one name share the code. */
    name: string;
    /**
     * GLSL: `void zhudaStep(uint index)` and what it calls. Each buffer is an
     * array under its own name (`zhudaPlaces[index]`), each uniform a value
     * under its name; `u_ZhudaCount` is how many indices the dispatch has.
     * The layout, the buffers, the uniforms and `main` are the engine's.
     */
    code: string;
    /** Up to eight, named `zhuda` and a capital, letters or digits (`zhudaPlaces`). */
    buffers: Record<string, ZhudaComputeBufferSpec>;
    /** Up to 32, named `u_Zhuda…`. */
    uniforms?: Record<string, ZhudaComputeUniformSpec>;
    /**
     * The same step in JavaScript, for a backend without compute. A `vec4`
     * buffer is four numbers an element in its array.
     */
    step?: (index: number, buffers: ZhudaComputeArrays, uniforms: ZhudaComputeValues) => void;
}
/** Indices one group of the GPU's step covers. */
export declare const ZHUDA_COMPUTE_GROUP = 64;
/** The uniform a step reads its count from. */
export declare const ZHUDA_COMPUTE_COUNT = "u_ZhudaCount";
/** Lists what is wrong with a compute spec; empty when it is valid. Needs no GPU. */
export declare function validateZhudaComputeSpec(spec: ZhudaComputeSpec): string[];
/**
 * The compute shader a spec becomes: the engine's layout, a block for each
 * buffer, the spec's code, and a `main` that calls `zhudaStep` for every
 * index below the dispatch's count. Uniforms are declared by LayaAir from
 * the pass's uniform map.
 */
export declare function zhudaComputeSource(spec: ZhudaComputeSpec): string;
export declare class ZhudaComputeError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** Whether this realm's LayaAir has compute (the WebGPU backend). */
export declare function zhudaComputeSupported(l?: any): boolean;
export declare class ZhudaComputePass {
    /** Where the step runs: on the GPU, or as the spec's JavaScript step. */
    readonly backend: 'webgpu' | 'cpu';
    readonly spec: ZhudaComputeSpec;
    private readonly held;
    private readonly values;
    private shader;
    private uniformData;
    private bufferData;
    private commands;
    private defines;
    private disposed;
    constructor(spec: ZhudaComputeSpec);
    private makeGpu;
    private makeCpu;
    private buffer;
    /**
     * Puts numbers into a buffer, from element `offset` on. A `vec4` buffer
     * takes four numbers an element.
     */
    write(name: string, data: Float32Array | Uint32Array, offset?: number): void;
    /** CPU: a buffer that is also vertex data is handed to the GPU again. */
    private upload;
    /** A uniform's value: a number, or four for a `vec4`. */
    setUniform(name: string, value: number | readonly number[]): void;
    /** Runs `zhudaStep` for every index below `count` (1..16777216). */
    dispatch(count: number): void;
    /**
     * A buffer's numbers as they are now. On the GPU they are copied out and
     * waited for; a draw does not need this.
     */
    read(name: string): Promise<Float32Array | Uint32Array>;
    /**
     * LayaAir's vertex buffer over a buffer declared with `vertex: true`, for
     * a draw. On the GPU it is the buffer the step writes; in JavaScript it is
     * filled again after every dispatch.
     */
    vertexBuffer(name: string): any;
    private release;
    dispose(): void;
}
export interface ZhudaComputedInstancesOptions {
    /**
     * The box every copy stays inside, in the world: what the draw is culled
     * by. The places are on the GPU; nothing else knows where they are.
     */
    bounds: {
        min: readonly [number, number, number];
        max: readonly [number, number, number];
    };
    /** Default true. */
    castShadow?: boolean;
    /** Default true. */
    receiveShadow?: boolean;
    layer?: number;
    label?: string;
}
/** Floats a copy in the buffer a pass writes: a matrix's four columns, then (1, 0, 0, 0). */
export declare const ZHUDA_COMPUTED_INSTANCE_FLOATS = 20;
/**
 * One draw of `count` copies of a mesh, each at the world matrix a compute
 * pass wrote for it: five `vec4` a copy in a buffer declared with `vertex:
 * true`, the matrix's four columns and then `vec4(1, 0, 0, 0)` (LayaAir's
 * own fifth: 1 for a copy that is not mirrored).
 *
 * Nothing is read back: the step and the draw share the buffer.
 */
export declare class ZhudaComputedInstances {
    readonly count: number;
    private node;
    private readonly owned;
    private disposed;
    constructor(parent: any, mesh: any, materials: any, pass: ZhudaComputePass, buffer: string, count: number, options: ZhudaComputedInstancesOptions);
    private release;
    /** Destroys the draw; the mesh, the materials and the pass are the caller's. */
    dispose(): void;
}
