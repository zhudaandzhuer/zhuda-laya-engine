/** Public, model-independent design-coordinate contract for screenshot wireframes. */
export type ZhudaLayoutNodeKind = 'scene' | 'container' | 'region' | 'button' | 'text' | 'image' | 'safe-area' | 'custom';
export type ZhudaLayoutAnchor = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export interface ZhudaLayoutRect { x: number; y: number; width: number; height: number; }
export interface ZhudaLayoutSource { path: string; sha256: string; bytes?: number; width: number; height: number; }
export interface ZhudaLayoutNode { id: string; kind: ZhudaLayoutNodeKind; rect: ZhudaLayoutRect; label?: string; anchor?: ZhudaLayoutAnchor; parent?: string; zIndex?: number; states?: readonly string[]; }
export interface ZhudaLayoutSafeArea { id: string; inset: { top: number; right: number; bottom: number; left: number }; }
export interface ZhudaLayoutContract { contract: 'zhuda-laya-engine.layout'; schemaVersion: 1; id: string; design: { width: number; height: number }; source: ZhudaLayoutSource; nodes: readonly ZhudaLayoutNode[]; safeAreas?: readonly ZhudaLayoutSafeArea[]; }
