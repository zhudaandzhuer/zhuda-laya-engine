// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaGridLayoutReport, ZhudaGridLayoutSpec, ZhudaTextLayoutReport, ZhudaTextLayoutSpec } from './zhuda-layout';
/**
 * Computes all positions in design pixels. DPR only changes the backing canvas;
 * it never enters this calculation. The same report can therefore drive a
 * Prefab preview and the assembled Scene without a second coordinate formula.
 */
export declare function computeZhudaGridLayout(spec: ZhudaGridLayoutSpec): ZhudaGridLayoutReport;
/** Aligns measured Laya text metrics inside an authored design-space box. */
export declare function computeZhudaTextLayout(spec: ZhudaTextLayoutSpec): ZhudaTextLayoutReport;
