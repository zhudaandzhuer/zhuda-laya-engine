// Generated from TypeScript source; run npm run types:generate.
/** Public, deterministic design-coordinate contracts shared by wireframes, Prefabs and Scenes. */
export interface ZhudaLayoutRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ZhudaLayoutInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export interface ZhudaGridLayoutSpec {
    viewport: {
        width: number;
        height: number;
    };
    design: {
        width: number;
        height: number;
    };
    safeArea?: Partial<ZhudaLayoutInsets>;
    columns: number;
    rows: number;
    gapX?: number;
    gapY?: number;
    padding?: Partial<ZhudaLayoutInsets>;
    scaleMode?: 'showall' | 'cover' | 'none';
}
export interface ZhudaGridLayoutReport {
    scale: number;
    designViewport: ZhudaLayoutRect;
    safeRect: ZhudaLayoutRect;
    cells: ZhudaLayoutRect[];
    overflow: boolean;
}
export interface ZhudaTextMetrics {
    width: number;
    height: number;
    /** Baseline offset from the top of the measured text box. */
    baseline: number;
}
export interface ZhudaTextLayoutSpec {
    box: ZhudaLayoutRect;
    metrics: ZhudaTextMetrics;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    padding?: Partial<ZhudaLayoutInsets>;
    scaleToFit?: boolean;
    minScale?: number;
}
export interface ZhudaTextLayoutReport {
    rect: ZhudaLayoutRect;
    scale: number;
    baselineX: number;
    baselineY: number;
    overflow: boolean;
}
/** Public, model-independent design-coordinate contract for screenshot wireframes. */
export type ZhudaLayoutNodeKind = 'scene' | 'container' | 'region' | 'button' | 'text' | 'image' | 'safe-area' | 'custom';
export type ZhudaLayoutAnchor = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export interface ZhudaLayoutSource {
    path: string;
    sha256: string;
    bytes?: number;
    width: number;
    height: number;
}
export interface ZhudaLayoutNode {
    id: string;
    kind: ZhudaLayoutNodeKind;
    rect: ZhudaLayoutRect;
    label?: string;
    anchor?: ZhudaLayoutAnchor;
    parent?: string;
    zIndex?: number;
    states?: readonly string[];
}
export interface ZhudaLayoutSafeArea {
    id: string;
    inset: ZhudaLayoutInsets;
}
export interface ZhudaLayoutContract {
    contract: 'zhuda-laya-engine.layout';
    schemaVersion: 1;
    id: string;
    design: {
        width: number;
        height: number;
    };
    source: ZhudaLayoutSource;
    nodes: readonly ZhudaLayoutNode[];
    safeAreas?: readonly ZhudaLayoutSafeArea[];
}
