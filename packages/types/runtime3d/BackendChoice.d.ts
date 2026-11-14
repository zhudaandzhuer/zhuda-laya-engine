// Generated from TypeScript source; run npm run types:generate.
/**
 * Which backend a page starts: WebGPU where the browser has a real adapter,
 * WebGL elsewhere.
 *
 * A realm holds one backend. LayaAir's libraries for the two cannot be
 * loaded together, and a realm that started WebGPU cannot start anything
 * again. So nothing falls back after the fact: the page asks the browser
 * first and then loads the libraries of one backend only. `ZhudaLoader` is
 * this file as a script of its own, loaded before either bundle
 * (`zhuda-loader.js` of the browser SDK; `"renderer": "auto"` of a consumer
 * build puts it into the page).
 *
 * Nothing here needs LayaAir or the rest of the engine.
 */
export type ZhudaBackendName = 'webgl' | 'webgpu';
/** What a page found out about its browser before choosing. */
export interface ZhudaBackendFacts {
    /** `isSecureContext`: browsers have WebGPU on HTTPS and localhost only. */
    secure: boolean;
    /** `navigator.gpu` is there. */
    api: boolean;
    /**
     * What `navigator.gpu.requestAdapter()` gave: a hardware adapter, one that
     * draws on the CPU, none, an error, or no answer in time. Not read when
     * `secure` or `api` is false.
     */
    adapter: 'hardware' | 'software' | 'none' | 'error' | 'timeout';
    /** The error's message, with `adapter: 'error'`. */
    message?: string;
}
export interface ZhudaBackendOptions {
    /**
     * `'webgpu'` (default, also for `undefined`): WebGPU where it can run,
     * WebGL elsewhere. `'webgl'`: WebGL without asking the browser, for a
     * game whose own settings say so.
     */
    prefer?: ZhudaBackendName;
    /**
     * Take an adapter that draws on the CPU for WebGPU (default false: WebGL
     * on the same machine is the faster of the two).
     */
    allowSoftware?: boolean;
}
export interface ZhudaBackendChoice {
    backend: ZhudaBackendName;
    /**
     * Why the page is on WebGL although WebGPU was preferred; `null` when it
     * is on WebGPU, or on WebGL because that was preferred. One of
     * `ZHUDA_FALLBACK_REASONS`, with a detail after `': '` for `retry`,
     * `adapter-error` and `bundle-failed`.
     */
    fallbackReason: string | null;
}
/** The reasons a choice can carry, before any detail. */
export declare const ZHUDA_FALLBACK_REASONS: readonly ["retry", "insecure-context", "no-webgpu-api", "no-adapter", "software-adapter", "adapter-error", "adapter-timeout", "bundle-failed"];
/**
 * The decision, with nothing asked of the browser: the same facts give the
 * same answer. `retry` is the reason carried over from a page that loaded
 * WebGPU and failed to start it.
 */
export declare function chooseZhudaBackend(facts: ZhudaBackendFacts | null, options?: ZhudaBackendOptions, retry?: string | null): ZhudaBackendChoice;
/** What the adapter said about itself, where the browser tells. */
export interface ZhudaBackendAdapter {
    vendor: string;
    architecture: string;
    isFallbackAdapter: boolean;
}
/**
 * Asks the browser: is this a secure page, is there `navigator.gpu`, and
 * what adapter does it give within `timeoutMs` (100..30000, default 3000).
 * Never rejects; makes no device.
 */
export declare function probeZhudaBackend(env?: any, timeoutMs?: number): Promise<{
    facts: ZhudaBackendFacts;
    adapter: ZhudaBackendAdapter | null;
}>;
/** A script to load: its address, and the integrity the browser is to hold it to. */
export interface ZhudaScriptRef {
    src: string;
    integrity?: string;
}
export interface ZhudaLoaderOptions extends ZhudaBackendOptions {
    /** The scripts of the WebGPU build, in the order they run. */
    webgpu: readonly (string | ZhudaScriptRef)[];
    /** The scripts of the WebGL build, in the order they run. */
    webgl: readonly (string | ZhudaScriptRef)[];
    /**
     * What runs after the backend, whichever it is: the game's own scripts,
     * in order. A function is called in its place.
     */
    after?: readonly (string | ZhudaScriptRef | (() => void))[];
    /** How long the browser has to answer about its adapter, 100..30000 ms (default 3000). */
    timeoutMs?: number;
}
/** What the loader did; also `globalThis.ZhudaBackend` once the backend's scripts have run. */
export interface ZhudaBackendRecord extends ZhudaBackendChoice {
    /** What the browser had; `null` when it was not asked (WebGL preferred, or a retry). */
    facts: ZhudaBackendFacts | null;
    adapter: ZhudaBackendAdapter | null;
    /** Milliseconds the browser took to answer about its adapter. */
    probeMs: number;
}
/** Where a retry's reason waits for the page's next load. */
export declare const ZHUDA_BACKEND_RETRY_KEY = "zhuda-backend-retry";
/**
 * Asks the browser, chooses, and loads the scripts of one backend, then
 * `after`. Scripts run one after another in the order given; the browser is
 * told about all of them at once, so they download together.
 *
 * If the first WebGPU script does not load, nothing of WebGPU has run and
 * the WebGL scripts are loaded in its place (`bundle-failed`). If a later
 * one fails, the realm holds half a backend: the promise rejects with
 * `code: 'ZHUDA_LOADER_PARTIAL'`, and `retryZhudaBackend` loads the page
 * again on WebGL.
 *
 * One call a page. `globalThis.ZhudaBackend` holds the record from the
 * moment the backend's scripts have run, before `after`.
 */
export declare function loadZhudaBackend(options: ZhudaLoaderOptions, env?: any): Promise<ZhudaBackendRecord>;
/**
 * For a page whose WebGPU was loaded and did not start (`ZhudaEngine.boot`
 * rejected, the device was lost): loads the page again, and the loader then
 * takes WebGL with `fallbackReason: 'retry: <reason>'`, for that load only.
 *
 * Returns false and does nothing when the page is not on WebGPU (there is
 * nothing to fall back to: no loop) or has no session storage to carry the
 * reason in (a sandboxed frame).
 */
export declare function retryZhudaBackend(reason: string, env?: any): boolean;
