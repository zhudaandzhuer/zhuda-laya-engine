// Generated from TypeScript source; run npm run types:generate.
/**
 * Boot contract for games assembled from independent modules.
 *
 * Each module can be created, shown alone in an isolated showcase, and
 * replaced by a stub when it fails, so one broken system does not hide the
 * rest from review. URL parameters make every run reproducible.
 */
export interface ZhudaRunParams {
    /** `?seed=`; defaults to 1. */
    seed: number;
    /** `?show=<module>`: build up to that module and run only its showcase. */
    show?: string;
    /** `?dt=<seconds>`: fixed simulation step for repeatable captures. */
    fixedDt?: number;
    /** `?shot=1`: still capture; consumers should disable adaptive quality. */
    shot: boolean;
    /** `?bench=1` or `#bench`. */
    bench: boolean;
    /** Every parameter as written. */
    raw: Record<string, string>;
}
export declare function parseZhudaRunParams(search?: string, hash?: string): ZhudaRunParams;
export interface ZhudaGameModule<C> {
    create(context: C): unknown | Promise<unknown>;
    /** Isolated scene that proves this module alone; runs after create(). */
    showcase?(context: C): unknown | Promise<unknown>;
    /** Minimal stand-in used when create() throws. */
    stub?(context: C): unknown;
    /** A required module has no fallback: its failure stops the boot. */
    required?: boolean;
}
export interface ZhudaBootReport {
    modules: Record<string, 'ready' | 'stub' | 'skipped'>;
    errors: Array<{
        module: string;
        message: string;
    }>;
    ms: Record<string, number>;
    showcase?: string;
    showcaseResult?: unknown;
}
/**
 * Creates modules in declaration order and stores each result on
 * `context[name]`. With `show`, modules after the named one are skipped and
 * its showcase runs last.
 */
export declare function bootZhudaModules<C extends Record<string, unknown>>(context: C, modules: Record<string, ZhudaGameModule<C>>, options?: {
    show?: string;
    onProgress?: (module: string, index: number, total: number) => void;
}): Promise<ZhudaBootReport>;
