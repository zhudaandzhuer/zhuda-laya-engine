// Generated from TypeScript source; run npm run types:generate.
export type RendererBackend = 'webgl' | 'webgpu';
import type { ZhudaRuntimeSession } from './Runtime.js';
export interface RendererDiagnostics {
    requested: RendererBackend;
    selected: RendererBackend;
    /** This release never silently falls back. A fallback requires a fresh realm. */
    fallbackReason: null;
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
