// Generated from TypeScript source; run npm run types:generate.
/**
 * Deterministic, forkable random source for procedural content.
 *
 * The same seed and the same call order always produce the same values on
 * every platform (32-bit integer arithmetic only). Gameplay authority still
 * belongs to the consumer; this stream is for authored variation such as
 * prop placement, wear and decals.
 */
export interface ZhudaRandom {
    readonly seed: number;
    /** Uniform in [0, 1). */
    next(): number;
    /** Uniform in [min, max). */
    range(min: number, max: number): number;
    /** Uniform integer in [min, max], both inclusive. */
    int(min: number, max: number): number;
    pick<T>(items: readonly T[]): T;
    /**
     * Independent child stream. A labelled fork depends only on the parent seed
     * and the label, so adding draws to the parent never reshuffles the child.
     * Unlabelled forks are numbered in call order.
     */
    fork(label?: string | number): ZhudaRandom;
}
export declare function createZhudaRandom(seed: number): ZhudaRandom;
