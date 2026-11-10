// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaVideoDiagnostics, ZhudaVideoMode, ZhudaVideoSurfaceOptions } from './zhuda-video';
/**
 * Small ownership wrapper around LayaAir's VideoNode. It deliberately uses the
 * vendor node rather than a DOM overlay, so decoder-mode video participates in
 * the same Laya hierarchy, transform and disposal path as other UI nodes.
 */
export declare class ZhudaVideoSurface {
    readonly node: Laya.VideoNode;
    private disposed;
    constructor(options: ZhudaVideoSurfaceOptions);
    get mode(): ZhudaVideoMode;
    get source(): string;
    setSource(source: string): void;
    play(): void;
    pause(): void;
    stop(): void;
    diagnostics(): ZhudaVideoDiagnostics;
    dispose(): void;
    private assertLive;
}
