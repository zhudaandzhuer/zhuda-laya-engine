export interface ZhudaLayoutRect { x: number; y: number; width: number; height: number; }
export interface ZhudaLayoutInsets { top: number; right: number; bottom: number; left: number; }
export interface ZhudaGridLayoutSpec {
  viewport: { width: number; height: number };
  design: { width: number; height: number };
  safeArea?: Partial<ZhudaLayoutInsets>;
  columns: number;
  rows: number;
  gapX?: number;
  gapY?: number;
  padding?: Partial<ZhudaLayoutInsets>;
  scaleMode?: 'showall' | 'cover' | 'none';
}
export interface ZhudaGridLayoutReport { scale: number; designViewport: ZhudaLayoutRect; safeRect: ZhudaLayoutRect; cells: ZhudaLayoutRect[]; overflow: boolean; }
export interface ZhudaTextMetrics { width: number; height: number; baseline: number; }
export interface ZhudaTextLayoutSpec {
  box: ZhudaLayoutRect;
  metrics: ZhudaTextMetrics;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  padding?: Partial<ZhudaLayoutInsets>;
  scaleToFit?: boolean;
  minScale?: number;
}
export interface ZhudaTextLayoutReport { rect: ZhudaLayoutRect; scale: number; baselineX: number; baselineY: number; overflow: boolean; }
