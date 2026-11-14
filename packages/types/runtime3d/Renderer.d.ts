// Generated from TypeScript source; run npm run types:generate.
export type RendererBackend = 'webgl' | 'webgpu';
import type { ZhudaRuntimeSession } from './Runtime.js';
export interface RendererDiagnostics {
    requested: RendererBackend;
    selected: RendererBackend;
    /**
     * Nothing falls back inside a realm. On a page whose backend was chosen
     * before either was loaded (`ZhudaLoader`, `BackendChoice.ts`), this is
     * why that page is on WebGL although WebGPU was preferred; `null` on
     * WebGPU, and on a page that was built for one backend.
     */
    fallbackReason: string | null;
    nativeEngine: string;
    status: 'initializing' | 'ready' | 'lost' | 'disposed' | 'failed';
    adapter?: {
        vendor: string;
        architecture: string;
        device: string;
        description: string;
        isFallbackAdapter: boolean;
    };
    features: string[];
    errors: string[];
    loss?: {
        reason: string;
        message: string;
    };
    /**
     * WebGPU: where the two shader compilers' bytes came from (carried in the
     * script, the origin's cache, or the network) and how long it took until
     * both were ready, in milliseconds.
     */
    compilers?: {
        from: 'inline' | 'cache' | 'network';
        ms: number;
    };
}
export declare class ZhudaRendererError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** Version-pinned native seam. All private upstream details stay in the engine.
 * WebGPU's device belongs to the realm; after release/loss use RuntimeHost to
 * recreate the realm, rather than invoking Laya's cached init promise again. */
export declare function prepareRenderer(requested?: RendererBackend, native?: any): {
    backend: RendererBackend;
    diagnostics: RendererDiagnostics;
    ready(): void;
    attach(runtime: ZhudaRuntimeSession): void;
    release: (status: "disposed" | "failed") => void;
};
