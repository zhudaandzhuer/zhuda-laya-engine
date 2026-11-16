// Generated from TypeScript source; run npm run types:generate.
/**
 * Foliage that moves in the wind and stays full in the distance, for models
 * drawn with LayaAir 3.4.2's PBR shaders (glTF trees, shrubs, ferns).
 *
 * Wind (`ZHUDA_WIND` on a material): every vertex is moved where LayaAir
 * computes its place in the world, in the visible pass (`shadingPixelParams`)
 * and in the shadow and depth passes (`DepthPositionCS`), so the leaves and
 * their shadows move together. The whole plant leans with the gusts and sways
 * back, more the higher above its base (a stem bends with the square of the
 * height); the leaves of a cut-out material also flutter, each part on its own
 * clock. Direction, strength and time are the scene's (`ZhudaFoliageWind`).
 *
 * Coverage (`ZHUDA_KEEP_COVERAGE` on a cut-out material of LayaAir's glTF
 * shader): a leaf picture loses its leaves as it is minified, because its
 * smaller mipmaps average the alpha toward the empty background and more of
 * each leaf falls under the cut-off. The alpha that is tested is raised by a
 * quarter for each mip level the picture is read at, in the visible, shadow
 * and depth passes, so a crown far away stays about as full as near.
 *
 * Materials without the defines compile to LayaAir's own code. The include
 * and pass texts are changed as LayaAir registers them; install before
 * `Laya.init` (`ZhudaEngine.boot` does it). `zhudaWindOffset` is the shader's
 * wind in TypeScript.
 */
export declare const ZHUDA_WIND_DEFINE = "ZHUDA_WIND";
export declare const ZHUDA_KEEP_COVERAGE_DEFINE = "ZHUDA_KEEP_COVERAGE";
/** Scene uniform: direction x, z (a unit vector), strength, seconds. */
export declare const ZHUDA_WIND_UNIFORM = "u_ZhudaWind";
/** An include's text with this module's changes, or unchanged with the reason. Pure. */
export declare function zhudaPatchFoliageInclude(name: string, text: string): {
    text: string;
    reason?: string;
};
/** A pass fragment with coverage kept after each alpha read of the glTF shader. Pure. */
export declare function zhudaPatchFoliagePass(fragment: string): {
    text: string;
    reads: number;
};
/**
 * Teaches LayaAir's PBR and glTF shaders the wind and the kept coverage.
 * Must run before `Laya.init`. Returns false when there is no runtime to patch.
 */
export declare function installLaya342Foliage(runtime?: any): boolean;
/** Whether the wind and the coverage reach LayaAir's shaders in this runtime (after `Laya.init`). */
export declare function zhudaFoliageStatus(runtime?: any): {
    wind: boolean;
    coverage: boolean;
    passes: number;
};
export interface ZhudaWindOptions {
    /** Where the wind blows to on the ground, x and z (normalised; default [1, 0.35]). */
    direction?: readonly [number, number];
    /** 0..2 (default 1): 1 bends a 10 m tree about 16 cm at its top and flutters its leaves about 2 cm. */
    strength?: number;
}
/** Lists what is wrong with wind options; empty when they are valid. */
export declare function validateZhudaWind(options: ZhudaWindOptions): string[];
/**
 * Where the wind moves a point of a plant whose base (the model's origin) is
 * at `base`, at `seconds`: the shader's displacement in TypeScript, in metres.
 * `leaf` is a cut-out material (it flutters too).
 */
export declare function zhudaWindOffset(point: readonly [number, number, number], base: readonly [number, number, number], seconds: number, wind?: ZhudaWindOptions, leaf?: boolean): [number, number, number];
/** A scene's wind: direction, strength and the seconds it has blown. */
export declare class ZhudaFoliageWind {
    private readonly values;
    private readonly id;
    private direction;
    private strength;
    private seconds;
    private disposed;
    constructor(scene: any, options?: ZhudaWindOptions, runtime?: any);
    /** Changes the direction or the strength (a calm, a storm). */
    setWind(options: ZhudaWindOptions, runtime?: any): void;
    /** Seconds the wind has blown: call once a frame with the game's clock. */
    update(seconds: number, runtime?: any): void;
    private write;
    /** Stills the scene's plants. */
    dispose(runtime?: any): void;
}
/**
 * Marks the materials under `root` as foliage: all of them move in the wind
 * (`wind`, default true), and cut-out ones keep their coverage in the
 * distance (`keepCoverage`, default true). Materials are shared between the
 * copies of a model: every copy is marked. `dispose` takes off what this mark
 * put on.
 */
export declare function zhudaMarkFoliage(root: any, options?: {
    wind?: boolean;
    keepCoverage?: boolean;
}, runtime?: any): {
    materials: number;
    dispose(): void;
};
