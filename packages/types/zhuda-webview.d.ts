// Generated from TypeScript source; run npm run types:generate.
/** Platform WebView contract anchored to a Laya node. */
export interface ZhudaWebViewFrame {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
}
/**
 * A consumer-owned native/DOM WebView implementation. The engine does not
 * create an untracked iframe or a second renderer; the adapter owns that
 * platform surface and receives every transform/lifecycle update.
 */
export interface ZhudaWebViewAdapter {
    mount(options: {
        url?: string;
        frame: ZhudaWebViewFrame;
        anchor: Laya.Sprite;
    }): void;
    update(options: {
        url: string;
        frame: ZhudaWebViewFrame;
        visible: boolean;
    }): void;
    dispose(): void;
}
export interface ZhudaWebViewSurfaceOptions {
    parent: Laya.Sprite;
    adapter: ZhudaWebViewAdapter;
    url?: string;
    frame?: ZhudaWebViewFrame;
    visible?: boolean;
}
export interface ZhudaWebViewDiagnostics {
    url: string;
    attached: boolean;
    visible: boolean;
    frame: ZhudaWebViewFrame;
    disposed: boolean;
}
