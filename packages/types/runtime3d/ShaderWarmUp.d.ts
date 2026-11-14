// Generated from TypeScript source; run npm run types:generate.
/**
 * Shaders compiled before they are first drawn.
 *
 * LayaAir compiles a shader the first time something is drawn with it: for
 * that mesh's vertex layout and that set of defines (the material's, the
 * renderer's, the scene's lights, shadows and fog, the camera's). A scene
 * that comes on screen, a look that changes level and a model that changes
 * level of detail each bring shaders nobody has drawn yet, and the frame
 * that compiles them is long.
 *
 * LayaAir 3.4.2 can list what it compiles (`Shader3D.debugMode` with
 * `ShaderVariantCollection`) and compile from such a list
 * (`Shader3D.compileShaderByDefineNames`). This module makes the two usable:
 * - `ZhudaShaderVariantRecorder` lists every variant compiled while it runs,
 *   in an order that does not depend on what was drawn first. A game runs it
 *   once (in a development build, through each of its scenes and each level
 *   of its look) and ships the list;
 * - `zhudaWarmUpShaders` compiles a list a few milliseconds at a time behind
 *   a loading screen, and says what it compiled, what was there already and
 *   what it could not find.
 *
 * What it does not do: one shader cannot be compiled in parts, so the longest
 * single compile is the longest pause (the report gives it). On WebGPU the
 * list covers the shader modules; the render pipeline, which also depends on
 * the target and the blend state, is still made at the first draw. A list is
 * for the backend it was recorded on.
 *
 * A shader is compiled for the scene's uniform sets in force at that moment
 * (LayaAir's `preDrawUniformMaps`: the scene's, the global ones, and the
 * shadow maps on frames that draw shadows). They are not in LayaAir's own
 * list, and a shader compiled without them is wrong for good: on WebGL the
 * lights, fog and shadows of the scene are taken for the material's and the
 * surface is drawn dark; on WebGPU a shader that reads a shadow map does
 * not compile, and leaves the material's uniform block with members that
 * break every later compile of that shader. A node's uniform maps are
 * listed sorted by LayaAir, but on WebGPU their order is the order of the
 * bindings. So the recorder keeps the scene's sets and the node's maps in
 * their own order with each variant, the warm-up puts them in force for its
 * compile, and a 3D variant recorded without them is not compiled.
 * Only the recorder and the warm-up need the Laya runtime; the rest is pure.
 */
export interface ZhudaShaderVariant {
    /** The shader's registered name (`Shader3D.find`). */
    shader: string;
    subShader: number;
    pass: number;
    /** Define names, sorted, without those the engine's configuration gives every shader. */
    defines: string[];
    /**
     * Uniform maps of the node the pass was drawn for, in the node's own order:
     * on WebGPU the order is the order of the bindings.
     */
    nodeCommonMap: string[];
    /** Further uniform maps the pass was drawn with, in their own order. */
    additionMap: string[];
    /** Vertex attribute locations of the mesh it was drawn with, ascending. */
    attributeLocations: number[];
    is2D: boolean;
    /**
     * 3D shaders: the scene's uniform sets in force when it was compiled
     * (LayaAir's `preDrawUniformMaps`), sorted. A 3D variant without them is
     * not warmed up.
     */
    preDrawMaps?: string[];
}
export type ZhudaShaderBackend = 'webgl' | 'webgpu';
export interface ZhudaShaderVariantList {
    version: 1;
    /** The backend the list was recorded on; it is warmed up on the same one. */
    backend: ZhudaShaderBackend;
    variants: ZhudaShaderVariant[];
}
export declare const ZHUDA_SHADER_VARIANT_LIMIT = 4096;
/** What is wrong with a variant list, in words; empty when `zhudaWarmUpShaders` takes it. */
export declare function validateZhudaShaderVariantList(value: unknown): string[];
/** One line that names a variant: two variants with the same line are the same compile. */
export declare function zhudaShaderVariantKey(variant: ZhudaShaderVariant): string;
/**
 * Variants without repeats, in the order of their keys: the same set of
 * variants gives the same list whatever was drawn first. Defines, attribute
 * locations and the scene's sets are sorted; a node's uniform maps keep
 * their order, which is part of what is compiled. Pure.
 */
export declare function zhudaSortShaderVariants(variants: readonly ZhudaShaderVariant[]): ZhudaShaderVariant[];
/**
 * Several lists of one backend as one (a list for each scene of a game, a
 * list for each level of its look). Throws when the lists are not all of the
 * same backend. Pure.
 */
export declare function zhudaMergeShaderVariants(...lists: readonly ZhudaShaderVariantList[]): ZhudaShaderVariantList;
/** Which backend this runtime draws with. */
export declare function zhudaShaderBackend(runtime?: any): ZhudaShaderBackend;
/**
 * Lists every shader variant LayaAir compiles from when it is made to when
 * it is stopped. Make it right after boot, before the scene: a variant
 * compiled earlier is not in the list. One at a time.
 */
export declare class ZhudaShaderVariantRecorder {
    private readonly l;
    private readonly collection;
    private readonly previous;
    private stopped;
    constructor(runtime?: any);
    /** Variants listed so far. */
    get count(): number;
    /** The variants compiled so far, sorted; the recorder goes on listing. */
    list(): ZhudaShaderVariantList;
    /** Gives LayaAir its own collection and debug switch back. The list stays readable. */
    stop(): void;
}
export interface ZhudaShaderWarmUpOptions {
    /**
     * Milliseconds of compiling before the next frame is let through, 1..1000
     * (default 8). One compile is never cut: a slice ends after the compile
     * that passes the budget.
     */
    budgetMs?: number;
    /** Stops between two compiles; the promise rejects with the signal's reason. */
    signal?: AbortSignal;
    /** Called after every slice, for a loading bar. */
    onProgress?: (done: number, total: number) => void;
    /**
     * Waits for the next frame between slices. Default: one frame of LayaAir's
     * system timer. A test gives its own.
     */
    wait?: () => Promise<void>;
    /** A clock in milliseconds (default `performance.now`). */
    now?: () => number;
}
export interface ZhudaShaderWarmUpReport {
    total: number;
    /** Compiled now. */
    compiled: number;
    /** Compiled before the warm-up reached them. */
    cached: number;
    /** Not found: the shader, sub-shader or pass of that name is not registered (yet). By key. */
    missing: string[];
    /**
     * Not compiled, by key with the reason: it threw, or it is a 3D variant
     * recorded without the scene's uniform sets. The warm-up went on.
     */
    failed: string[];
    /** Why nothing was compiled, when the list was not for this runtime. */
    refused?: string;
    /** Milliseconds spent compiling, and the longest single compile among them. */
    ms: number;
    longestMs: number;
    /** Frames the warm-up was spread over. */
    slices: number;
}
/**
 * Compiles the variants of a list that are not compiled yet, `budgetMs` at a
 * time, and resolves with what happened. A list of the other backend, or one
 * the validator refuses, compiles nothing and says so in `refused`: a
 * warm-up never keeps a game from starting. The engine's own effects are
 * registered for it when a name is not known (`registerZhudaEffectShaders`);
 * a material's shader is registered when the material is first made, so
 * run the warm-up after the scene is made and before it is drawn. What is
 * still not registered comes back in `missing`.
 */
export declare function zhudaWarmUpShaders(list: ZhudaShaderVariantList, options?: ZhudaShaderWarmUpOptions, runtime?: any): Promise<ZhudaShaderWarmUpReport>;
