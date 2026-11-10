// Generated from TypeScript source; run npm run types:generate.
/**
 * @zhuda-laya/core — 基建六：像素邊界度量與 CIE ΔE (CIE76 / CIEDE2000) 色差校準引擎 (PixelCalibrationEngine)
 *
 * 目標：
 * - 讓 AI Agent 擺脫「每次調整 2px 或微調色號都要重啟完整遊戲 Runtime」的低效迴圈
 * - 支援對靜態 .lh 階層樹與孤立微預覽 RGBA 像素緩衝區進行：
 *   1. Tight Bounding Box 像素級邊界與內距 (Padding) 校準
 *   2. sRGB -> XYZ (D65) -> CIE L*a*b* 轉換與 CIEDE2000 (ΔE00) 感知色差計算
 *   3. 自動生成 JSON 路徑級別的 AutoFixPatch 並單步收斂至 0px / ΔE = 0.00
 */
import type { ColorLab, LayaHierarchyNodeData, NineSliceCalibrationReport, PixelCalibrationReport, PixelCalibrationSpec } from './index';
export declare class PixelCalibrationEngine {
    /**
     * 將 #RRGGBB 或 #RRGGBBAA 轉為 0..255 RGB
     */
    static hexToRgb(hex: string): {
        r: number;
        g: number;
        b: number;
        a: number;
    };
    /**
     * 將 sRGB (#RRGGBB) 轉換為 CIE L*a*b* (D65 標準光源)
     */
    static hexToLab(hex: string): ColorLab;
    /**
     * 計算 CIE76 色差 (ΔE*ab)
     */
    static computeDeltaE76(hex1: string, hex2: string): number;
    /**
     * 計算工業標準 CIEDE2000 感知色差 (ΔE00)
     */
    static computeDeltaE2000(hex1: string, hex2: string): number;
    /**
     * 靜態解析 .lh 階層樹的精確 Tight Bounding Box 與主色調（無需啟動 Runtime）
     */
    static measureStaticHierarchy(data: LayaHierarchyNodeData): {
        tightBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        primaryFill: string;
        borderStroke: string;
        accentOrText: string;
    };
    /**
     * 掃描 WebGL / Canvas2D RGBA 像素緩衝區，計算非背景像素覆蓋率、Tight Bounding Box 與主導色
     */
    static measurePixelBuffer(rgba: Uint8Array | Uint8ClampedArray, canvasWidth: number, canvasHeight: number, bgRgb?: {
        r: number;
        g: number;
        b: number;
    }): {
        tightBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        nonTransparentPixels: number;
        coveragePercent: number;
        sampledDominantHex: string;
    };
    /**
     * 執行單一靜態資產的像素邊界與 ΔE 色差校準，並自動生成修復 Patch
     */
    static calibrateAsset(data: LayaHierarchyNodeData, specOverride?: PixelCalibrationSpec, pixelBufferInfo?: {
        rgba: Uint8Array | Uint8ClampedArray;
        width: number;
        height: number;
    }): PixelCalibrationReport;
    /**
     * 演示 AI Agent 靜態資產自動校準閉環：
     * 從帶有 +3px 寬度偏差、+2px 內距偏移與 ΔE00 色差的未校準 Prefab，自動檢測並單步收斂至 0 誤差
     */
    /**
     * 驗證 M1 九宮格 (9-Slice / sizeGrid) 預製體拉伸後四角錨塊是否維持 1:1 零變形
     */
    static verifyNineSliceIntegrity(data: LayaHierarchyNodeData): NineSliceCalibrationReport;
}
