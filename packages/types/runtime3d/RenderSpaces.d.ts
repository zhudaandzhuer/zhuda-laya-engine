// Generated from TypeScript source; run npm run types:generate.
export type ZhudaRenderPass = 'local' | 'world' | 'overlay';
export type ZhudaRenderCoordinates = 'local' | 'world' | 'camera-overlay';
export type ZhudaRenderMatrix = ReadonlyArray<number>;
export interface ZhudaRenderPoint {
    x: number;
    y: number;
    z?: number;
}
export interface ZhudaRenderPassContext {
    readonly pass: ZhudaRenderPass;
    readonly coordinates: ZhudaRenderCoordinates;
    /** Matrix supplied by the consumer render bridge; no transform is applied here. */
    readonly transform: ZhudaRenderMatrix | null;
    /** Optional zero-allocation conversions supplied by the owning scene/node. */
    readonly localToWorld?: (point: ZhudaRenderPoint, out: ZhudaRenderPoint) => void;
    readonly worldToLocal?: (point: ZhudaRenderPoint, out: ZhudaRenderPoint) => void;
}
export interface ZhudaRenderSpaceFrame {
    localTransform?: ZhudaRenderMatrix | null;
    worldTransform?: ZhudaRenderMatrix | null;
    overlayTransform?: ZhudaRenderMatrix | null;
    localToWorld?: (point: ZhudaRenderPoint, out: ZhudaRenderPoint) => void;
    worldToLocal?: (point: ZhudaRenderPoint, out: ZhudaRenderPoint) => void;
}
export interface ZhudaRenderSpaceCallbacks {
    onRenderLocal?: (context: ZhudaRenderPassContext) => void;
    onRenderWorld?: (context: ZhudaRenderPassContext) => void;
    onRenderOverlay?: (context: ZhudaRenderPassContext) => void;
}
export interface ZhudaRenderRegistration {
    readonly cancelled: boolean;
    cancel(): boolean;
}
/** Dispatches explicit local/world/overlay passes without mutating a Laya matrix. */
export declare class ZhudaRenderSpace {
    private registrations;
    private disposed;
    register(callbacks: ZhudaRenderSpaceCallbacks): ZhudaRenderRegistration;
    render(frame: ZhudaRenderSpaceFrame): number;
    clear(): void;
    dispose(): void;
    get size(): number;
}
