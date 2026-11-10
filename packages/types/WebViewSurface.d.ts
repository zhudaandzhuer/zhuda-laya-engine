// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaWebViewDiagnostics, ZhudaWebViewFrame, ZhudaWebViewSurfaceOptions } from './zhuda-webview.js';
/**
 * Keeps a platform WebView aligned with a Laya hierarchy anchor. The WebView
 * itself remains outside the canvas when the platform requires it; this class
 * makes that boundary explicit and prevents unowned DOM overlays.
 */
export declare class ZhudaWebViewSurface {
    readonly anchor: Laya.Sprite;
    private readonly adapter;
    private frameValue;
    private urlValue;
    private visibleValue;
    private disposed;
    constructor(options: ZhudaWebViewSurfaceOptions);
    get url(): string;
    get frame(): ZhudaWebViewFrame;
    setUrl(url: string): void;
    setFrame(frame: ZhudaWebViewFrame): void;
    setVisible(visible: boolean): void;
    diagnostics(): ZhudaWebViewDiagnostics;
    dispose(): void;
    private applyAnchor;
    private sync;
    private assertLive;
}
