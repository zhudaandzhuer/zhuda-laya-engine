// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaDensityVolume } from '../procedural/Isosurface.js';
type Vec3 = [number, number, number];
export interface ZhudaDensitySpec {
    /** `Zhuda` and letters, digits or `_`: names the compute code (one name, one code). */
    name: string;
    /** GLSL: `float zhudaDensity(vec3 p)` and what it calls; negative inside. */
    glsl: string;
    /** The same density in JavaScript: the fallback and the reference. */
    density: (x: number, y: number, z: number) => number;
    /** The box the mesh is made in, as for `createZhudaIsosurfaceMesh`. */
    min: Vec3;
    max: Vec3;
    cellSize: number;
}
export interface ZhudaDensityOptions {
    signal?: AbortSignal;
    /** Milliseconds before the load gives up (default 30 000). */
    timeoutMs?: number;
    /** `'cpu'` runs the JavaScript density even where there is compute (default `'auto'`). */
    backend?: 'auto' | 'cpu';
    /**
     * Grid points where a GPU result is compared with the JavaScript density
     * (default 64, spread over the grid); 0 skips the check.
     */
    checkPoints?: number;
    /** Largest difference the check allows, in the field's units (default 1e-3 × cellSize + 1e-4). */
    tolerance?: number;
}
/** Lists what is wrong with a density spec; empty when it can be used. Needs no GPU. */
export declare function validateZhudaDensitySpec(spec: ZhudaDensitySpec): string[];
/**
 * Fills the isosurface grid of `spec`'s box with its density, on the GPU
 * where there is compute, and reads it back once. Rejects when cancelled,
 * past the time limit, when the density throws or is not finite, and when a
 * GPU result disagrees with the JavaScript density.
 */
export declare function computeZhudaDensityVolume(spec: ZhudaDensitySpec, options?: ZhudaDensityOptions): Promise<ZhudaDensityVolume>;
export {};
