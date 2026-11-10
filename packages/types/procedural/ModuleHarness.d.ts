// Generated from TypeScript source; run npm run types:generate.
/**
 * Boot contract for games assembled from independent modules.
 *
 * Each module can be created, shown alone in an isolated showcase, and
 * replaced by a stub when it fails, so one broken system does not hide the
 * rest from review. URL parameters make every run reproducible.
 *
 * It adds no second engine path: a fixed step becomes the engine's
 * `ZhudaSimulationClock` (driven by the runtime session), a showcase may be a
 * Prefab instantiated through `ZhudaPrefabLibrary` (the same definition the
 * scene uses), and still captures belong to `ZhudaCinematicCapture`.
 */
import { ZhudaSimulationClock } from '../runtime3d/Clocks.js';
export interface ZhudaRunParams {
    /** `?seed=`; defaults to 1. */
    seed: number;
    /** `?show=<module>`: build up to that module and run only its showcase. */
    show?: string;
    /**
     * `?dt=<seconds>`: fixed simulation step for repeatable runs. Build the
     * clock with `createZhudaRunClock(params)`; never step a game with timers.
     */
    fixedDt?: number;
    /**
     * `?shot=1`: still capture. Render it through `ZhudaCinematicCapture` (or
     * `ZhudaFilmRenderer`) and disable adaptive quality.
     */
    shot: boolean;
    /** `?bench=1` or `#bench`. */
    bench: boolean;
    /** Every parameter as written. */
    raw: Record<string, string>;
}
export declare function parseZhudaRunParams(search?: string, hash?: string): ZhudaRunParams;
export interface ZhudaGameModule<C> {
    create(context: C): unknown | Promise<unknown>;
    /**
     * Isolated scene that proves this module alone; runs after create(). Either
     * a function, or a Prefab to instantiate alone through the `prefabs` library
     * given to `bootZhudaModules` (the same definition the full scene uses).
     */
    showcase?: ((context: C) => unknown | Promise<unknown>) | ZhudaPrefabShowcase;
    /** Minimal stand-in used when create() throws. */
    stub?(context: C): unknown;
    /** A required module has no fallback: its failure stops the boot. */
    required?: boolean;
}
export interface ZhudaPrefabShowcase {
    prefab: string;
    state?: string;
}
/** The part of `ZhudaPrefabLibrary` a Prefab showcase needs. */
export interface ZhudaShowcasePrefabs {
    instantiate(id: string, options?: {
        state?: string;
        parent?: any;
        signal?: AbortSignal;
    }): Promise<unknown>;
}
/**
 * The engine's fixed-step clock for a run: `?dt=` sets its step (default
 * 1/60 s). Advance it from the runtime session, the only wall-clock source:
 * `context.runtime.start((dt) => clock.advance(dt, step))`.
 */
export declare function createZhudaRunClock(params: Pick<ZhudaRunParams, 'fixedDt'>, maxCatchup?: number): ZhudaSimulationClock;
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
    /** Library for Prefab showcases, normally the scene's `ZhudaPrefabLibrary`. */
    prefabs?: ZhudaShowcasePrefabs;
    /** Parent node for a Prefab showcase. */
    parent?: unknown;
    signal?: AbortSignal;
}): Promise<ZhudaBootReport>;
