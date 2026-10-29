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

import type {
  AutoFixPatch,
  ColorLab,
  LayaHierarchyNodeData,
  NineSliceCalibrationReport,
  PixelCalibrationReport,
  PixelCalibrationSpec
} from '../types/index.ts';
import { ZhudaAssetSerializer } from './StaticAssetPipeline.ts';

export class PixelCalibrationEngine {
  /**
   * 將 #RRGGBB 或 #RRGGBBAA 轉為 0..255 RGB
   */
  public static hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
    const clean = (hex || '#000000').replace(/^#/, '').trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return { r, g, b, a: 255 };
    }
    const r = parseInt(clean.slice(0, 2) || '00', 16);
    const g = parseInt(clean.slice(2, 4) || '00', 16);
    const b = parseInt(clean.slice(4, 6) || '00', 16);
    const a = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) : 255;
    return {
      r: Number.isNaN(r) ? 0 : r,
      g: Number.isNaN(g) ? 0 : g,
      b: Number.isNaN(b) ? 0 : b,
      a: Number.isNaN(a) ? 255 : a
    };
  }

  /**
   * 將 sRGB (#RRGGBB) 轉換為 CIE L*a*b* (D65 標準光源)
   */
  public static hexToLab(hex: string): ColorLab {
    const { r, g, b } = this.hexToRgb(hex);
    const toLinear = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };

    const lr = toLinear(r);
    const lg = toLinear(g);
    const lb = toLinear(b);

    // sRGB to XYZ (D65)
    const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
    const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) / 1.0;
    const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;

    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);

    return {
      L: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  /**
   * 計算 CIE76 色差 (ΔE*ab)
   */
  public static computeDeltaE76(hex1: string, hex2: string): number {
    const lab1 = this.hexToLab(hex1);
    const lab2 = this.hexToLab(hex2);
    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    return Number(Math.sqrt(dL * dL + da * da + db * db).toFixed(2));
  }

  /**
   * 計算工業標準 CIEDE2000 感知色差 (ΔE00)
   */
  public static computeDeltaE2000(hex1: string, hex2: string): number {
    if ((hex1 || '').toLowerCase().slice(0, 7) === (hex2 || '').toLowerCase().slice(0, 7)) {
      return 0;
    }
    const lab1 = this.hexToLab(hex1);
    const lab2 = this.hexToLab(hex2);

    const avgL = (lab1.L + lab2.L) / 2;
    const c1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
    const c2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
    const avgC = (c1 + c2) / 2;

    const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
    const a1p = (1 + g) * lab1.a;
    const a2p = (1 + g) * lab2.a;
    const c1p = Math.sqrt(a1p * a1p + lab1.b * lab1.b);
    const c2p = Math.sqrt(a2p * a2p + lab2.b * lab2.b);
    const avgCp = (c1p + c2p) / 2;

    const h1p = a1p === 0 && lab1.b === 0 ? 0 : (Math.atan2(lab1.b, a1p) * 180) / Math.PI + (Math.atan2(lab1.b, a1p) < 0 ? 360 : 0);
    const h2p = a2p === 0 && lab2.b === 0 ? 0 : (Math.atan2(lab2.b, a2p) * 180) / Math.PI + (Math.atan2(lab2.b, a2p) < 0 ? 360 : 0);

    let dhp = 0;
    if (c1p * c2p !== 0) {
      if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
      else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
      else dhp = h2p - h1p + 360;
    }

    const dLp = lab2.L - lab1.L;
    const dCp = c2p - c1p;
    const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(((dhp / 2) * Math.PI) / 180);

    let avgHp = h1p + h2p;
    if (c1p * c2p !== 0) {
      if (Math.abs(h1p - h2p) <= 180) avgHp = (h1p + h2p) / 2;
      else if (h1p + h2p < 360) avgHp = (h1p + h2p + 360) / 2;
      else avgHp = (h1p + h2p - 360) / 2;
    }

    const T =
      1 -
      0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
      0.24 * Math.cos(((2 * avgHp) * Math.PI) / 180) +
      0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
      0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

    const dRo = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
    const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
    const sl = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
    const sc = 1 + 0.045 * avgCp;
    const sh = 1 + 0.015 * avgCp * T;
    const rt = -Math.sin(((2 * dRo) * Math.PI) / 180) * rc;

    const dE = Math.sqrt(
      Math.pow(dLp / sl, 2) +
        Math.pow(dCp / sc, 2) +
        Math.pow(dHp / sh, 2) +
        rt * (dCp / sc) * (dHp / sh)
    );

    return Number(dE.toFixed(2));
  }

  /**
   * 靜態解析 .lh 階層樹的精確 Tight Bounding Box 與主色調（無需啟動 Runtime）
   */
  public static measureStaticHierarchy(data: LayaHierarchyNodeData): {
    tightBox: { x: number; y: number; width: number; height: number };
    primaryFill: string;
    borderStroke: string;
    accentOrText: string;
  } {
    const rootX = data.x ?? 0;
    const rootY = data.y ?? 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    let primaryFill = '';
    let borderStroke = '';
    let accentOrText = '';

    const expandRect = (rx: number, ry: number, rw: number, rh: number) => {
      if (rw <= 0 || rh <= 0) return;
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx + rw);
      maxY = Math.max(maxY, ry + rh);
    };

    if (Array.isArray(data._gcmds)) {
      for (const cmd of data._gcmds) {
        if (cmd._$type === 'DrawRoundRectCmd' || cmd._$type === 'DrawRectCmd') {
          const cx = rootX + (cmd.x ?? 0);
          const cy = rootY + (cmd.y ?? 0);
          const cw = cmd.width ?? data.width ?? 0;
          const ch = cmd.height ?? data.height ?? 0;
          expandRect(cx, cy, cw, ch);
          if (!primaryFill && cmd.fillColor) primaryFill = cmd.fillColor;
          if (!borderStroke && cmd.lineColor) borderStroke = cmd.lineColor;
        } else if (cmd._$type === 'DrawCircleCmd') {
          const r = cmd.radius ?? 0;
          const cx = rootX + (cmd.x ?? 0) - r;
          const cy = rootY + (cmd.y ?? 0) - r;
          expandRect(cx, cy, r * 2, r * 2);
          if (!primaryFill && cmd.fillColor) primaryFill = cmd.fillColor;
          else if (!accentOrText && cmd.fillColor && cmd.fillColor !== '#090d14') {
            accentOrText = cmd.fillColor;
          }
        }
      }
    }

    if (minX === Infinity) {
      expandRect(rootX, rootY, data.width ?? 100, data.height ?? 40);
    }

    if (Array.isArray(data._$child)) {
      for (const child of data._$child) {
        if (child._$type === 'Text' && child.color) {
          if (!accentOrText || data.name !== 'ZhudaSpine42Mascot') {
            accentOrText = child.color;
            break;
          }
        }
      }
    }

    return {
      tightBox: {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY)
      },
      primaryFill: (primaryFill || '#000000').slice(0, 7),
      borderStroke: (borderStroke || '#000000').slice(0, 7),
      accentOrText: (accentOrText || '#ffffff').slice(0, 7)
    };
  }

  /**
   * 掃描 WebGL / Canvas2D RGBA 像素緩衝區，計算非背景像素覆蓋率、Tight Bounding Box 與主導色
   */
  public static measurePixelBuffer(
    rgba: Uint8Array | Uint8ClampedArray,
    canvasWidth: number,
    canvasHeight: number,
    bgRgb: { r: number; g: number; b: number } = { r: 11, g: 15, b: 23 }
  ): {
    tightBox: { x: number; y: number; width: number; height: number };
    nonTransparentPixels: number;
    coveragePercent: number;
    sampledDominantHex: string;
  } {
    let minX = canvasWidth;
    let minY = canvasHeight;
    let maxX = -1;
    let maxY = -1;
    let activeCount = 0;

    const colorBuckets = new Map<string, number>();

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const idx = (y * canvasWidth + x) * 4;
        const r = rgba[idx];
        const g = rgba[idx + 1];
        const b = rgba[idx + 2];
        const a = rgba[idx + 3];

        const isForeground =
          a > 20 &&
          (Math.abs(r - bgRgb.r) > 8 ||
            Math.abs(g - bgRgb.g) > 8 ||
            Math.abs(b - bgRgb.b) > 8);

        if (isForeground) {
          activeCount++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;

          const hex =
            '#' +
            r.toString(16).padStart(2, '0') +
            g.toString(16).padStart(2, '0') +
            b.toString(16).padStart(2, '0');
          colorBuckets.set(hex, (colorBuckets.get(hex) || 0) + 1);
        }
      }
    }

    let dominantHex = '#000000';
    let bestCount = 0;
    for (const [hex, cnt] of colorBuckets.entries()) {
      if (cnt > bestCount) {
        bestCount = cnt;
        dominantHex = hex;
      }
    }

    const hasPixels = maxX >= minX && maxY >= minY;
    return {
      tightBox: hasPixels
        ? {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
          }
        : { x: 0, y: 0, width: 0, height: 0 },
      nonTransparentPixels: activeCount,
      coveragePercent: Number(((activeCount / Math.max(1, canvasWidth * canvasHeight)) * 100).toFixed(2)),
      sampledDominantHex: dominantHex
    };
  }

  /**
   * 執行單一靜態資產的像素邊界與 ΔE 色差校準，並自動生成修復 Patch
   */
  public static calibrateAsset(
    data: LayaHierarchyNodeData,
    specOverride?: PixelCalibrationSpec,
    pixelBufferInfo?: {
      rgba: Uint8Array | Uint8ClampedArray;
      width: number;
      height: number;
    }
  ): PixelCalibrationReport {
    const spec = specOverride || data._zhudaMeta?.targetSpec;
    if (!spec) {
      throw new Error(`[PixelCalibrationEngine] 資產 ${data.name} 缺少 targetSpec 校準規格`);
    }

    const staticMetrics = this.measureStaticHierarchy(data);
    const measuredBox = staticMetrics.tightBox;
    const expectedBox = spec.expectedBox;

    const xDiffPx = measuredBox.x - expectedBox.x;
    const yDiffPx = measuredBox.y - expectedBox.y;
    const widthDiffPx = measuredBox.width - expectedBox.width;
    const heightDiffPx = measuredBox.height - expectedBox.height;
    const maxAbsErrorPx = Math.max(
      Math.abs(xDiffPx),
      Math.abs(yDiffPx),
      Math.abs(widthDiffPx),
      Math.abs(heightDiffPx)
    );

    const targetPrimaryFill = spec.targetColors.primaryFill;
    const targetBorderStroke = spec.targetColors.borderStroke || staticMetrics.borderStroke;
    const targetAccentOrText = spec.targetColors.accentOrText || staticMetrics.accentOrText;

    const primaryDeltaE76 = this.computeDeltaE76(staticMetrics.primaryFill, targetPrimaryFill);
    const primaryDeltaE2000 = this.computeDeltaE2000(staticMetrics.primaryFill, targetPrimaryFill);
    const borderDeltaE2000 = this.computeDeltaE2000(staticMetrics.borderStroke, targetBorderStroke);
    const accentDeltaE2000 = this.computeDeltaE2000(staticMetrics.accentOrText, targetAccentOrText);
    const maxDeltaE2000 = Number(
      Math.max(primaryDeltaE2000, borderDeltaE2000, accentDeltaE2000).toFixed(2)
    );

    const tolerancePx = spec.tolerancePx ?? 0;
    const toleranceDeltaE = spec.toleranceDeltaE ?? 1.5;

    const autoFixPatches: AutoFixPatch[] = [];

    if (Math.abs(xDiffPx) > tolerancePx) {
      autoFixPatches.push({
        targetPath: 'root',
        property: 'x',
        currentValue: data.x ?? 0,
        suggestedValue: expectedBox.x,
        reason: `X 座標偏移 ${xDiffPx > 0 ? '+' : ''}${xDiffPx}px (預期 ${expectedBox.x}px)`
      });
    }
    if (Math.abs(yDiffPx) > tolerancePx) {
      autoFixPatches.push({
        targetPath: 'root',
        property: 'y',
        currentValue: data.y ?? 0,
        suggestedValue: expectedBox.y,
        reason: `Y 座標偏移 ${yDiffPx > 0 ? '+' : ''}${yDiffPx}px (預期 ${expectedBox.y}px)`
      });
    }
    if (Math.abs(widthDiffPx) > tolerancePx) {
      autoFixPatches.push({
        targetPath: 'root',
        property: 'width',
        currentValue: data.width ?? measuredBox.width,
        suggestedValue: expectedBox.width,
        reason: `節點寬度誤差 ${widthDiffPx > 0 ? '+' : ''}${widthDiffPx}px (預期 ${expectedBox.width}px)`
      });
      if (Array.isArray(data._gcmds) && data._gcmds[0]) {
        autoFixPatches.push({
          targetPath: '_gcmds[0]',
          property: 'width',
          currentValue: data._gcmds[0].width ?? measuredBox.width,
          suggestedValue: expectedBox.width,
          reason: `底圖指令 DrawRoundRectCmd 寬度誤差 ${widthDiffPx > 0 ? '+' : ''}${widthDiffPx}px`
        });
      }
    }
    if (Math.abs(heightDiffPx) > tolerancePx) {
      autoFixPatches.push({
        targetPath: 'root',
        property: 'height',
        currentValue: data.height ?? measuredBox.height,
        suggestedValue: expectedBox.height,
        reason: `節點高度誤差 ${heightDiffPx > 0 ? '+' : ''}${heightDiffPx}px (預期 ${expectedBox.height}px)`
      });
      if (Array.isArray(data._gcmds) && data._gcmds[0]) {
        autoFixPatches.push({
          targetPath: '_gcmds[0]',
          property: 'height',
          currentValue: data._gcmds[0].height ?? measuredBox.height,
          suggestedValue: expectedBox.height,
          reason: `底圖指令高度誤差 ${heightDiffPx > 0 ? '+' : ''}${heightDiffPx}px`
        });
      }
    }

    if (primaryDeltaE2000 > toleranceDeltaE && Array.isArray(data._gcmds) && data._gcmds[0]) {
      autoFixPatches.push({
        targetPath: '_gcmds[0]',
        property: 'fillColor',
        currentValue: staticMetrics.primaryFill,
        suggestedValue: targetPrimaryFill,
        reason: `主填充色差 ΔE00 = ${primaryDeltaE2000} 超出容許值 ${toleranceDeltaE} (目標 ${targetPrimaryFill})`
      });
    }
    if (borderDeltaE2000 > toleranceDeltaE && Array.isArray(data._gcmds) && data._gcmds[0]) {
      autoFixPatches.push({
        targetPath: '_gcmds[0]',
        property: 'lineColor',
        currentValue: staticMetrics.borderStroke,
        suggestedValue: targetBorderStroke,
        reason: `邊框色差 ΔE00 = ${borderDeltaE2000} 超出容許值 ${toleranceDeltaE} (目標 ${targetBorderStroke})`
      });
    }
    if (accentDeltaE2000 > toleranceDeltaE && Array.isArray(data._$child) && data._$child[0]) {
      autoFixPatches.push({
        targetPath: '_$child[0]',
        property: 'color',
        currentValue: staticMetrics.accentOrText,
        suggestedValue: targetAccentOrText,
        reason: `文字/強調色差 ΔE00 = ${accentDeltaE2000} 超出容許值 ${toleranceDeltaE} (目標 ${targetAccentOrText})`
      });
    }

    const passed = maxAbsErrorPx <= tolerancePx && maxDeltaE2000 <= toleranceDeltaE;

    let pixelBufferTelemetry: PixelCalibrationReport['pixelBufferTelemetry'];
    if (pixelBufferInfo) {
      const bufRes = this.measurePixelBuffer(
        pixelBufferInfo.rgba,
        pixelBufferInfo.width,
        pixelBufferInfo.height
      );
      pixelBufferTelemetry = {
        canvasWidth: pixelBufferInfo.width,
        canvasHeight: pixelBufferInfo.height,
        nonTransparentPixels: bufRes.nonTransparentPixels,
        coveragePercent: bufRes.coveragePercent,
        sampledDominantHex: bufRes.sampledDominantHex
      };
    }

    return {
      assetName: spec.assetName,
      category: data._zhudaMeta?.category ?? 'ui-prefab',
      passed,
      measuredBox,
      expectedBox,
      pixelErrors: {
        xDiffPx,
        yDiffPx,
        widthDiffPx,
        heightDiffPx,
        maxAbsErrorPx
      },
      colorMetrics: {
        measuredPrimaryFill: staticMetrics.primaryFill,
        targetPrimaryFill,
        primaryDeltaE76,
        primaryDeltaE2000,
        measuredBorderStroke: staticMetrics.borderStroke,
        targetBorderStroke,
        borderDeltaE2000,
        measuredAccentOrText: staticMetrics.accentOrText,
        targetAccentOrText,
        accentDeltaE2000,
        maxDeltaE2000
      },
      ...(pixelBufferTelemetry ? { pixelBufferTelemetry } : {}),
      autoFixPatches,
      summary: passed
        ? `✅ 像素邊界誤差 0px 且色差 ΔE00=${maxDeltaE2000} (通過校準)`
        : `⚠️ 偵測到像素誤差 ${maxAbsErrorPx}px 與色差 ΔE00=${maxDeltaE2000}，已產出 ${autoFixPatches.length} 項自動修復 Patch`
    };
  }

  /**
   * 演示 AI Agent 靜態資產自動校準閉環：
   * 從帶有 +3px 寬度偏差、+2px 內距偏移與 ΔE00 色差的未校準 Prefab，自動檢測並單步收斂至 0 誤差
   */
  public static runSelfConvergenceDemo(): {
    beforeReport: PixelCalibrationReport;
    appliedPatches: AutoFixPatch[];
    afterReport: PixelCalibrationReport;
    convergedHierarchy: LayaHierarchyNodeData;
    elapsedMs: number;
  } {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const uncalibrated = ZhudaAssetSerializer.buildConfirmButtonPrefab('uncalibrated-drift');
    const beforeReport = this.calibrateAsset(uncalibrated);
    const convergedHierarchy = ZhudaAssetSerializer.applyCalibrationPatches(
      uncalibrated,
      beforeReport.autoFixPatches
    );
    const afterReport = this.calibrateAsset(convergedHierarchy);
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      beforeReport,
      appliedPatches: beforeReport.autoFixPatches,
      afterReport,
      convergedHierarchy,
      elapsedMs: Number(Math.max(0.1, t1 - t0).toFixed(2))
    };
  }

  /**
   * 驗證 M1 九宮格 (9-Slice / sizeGrid) 預製體拉伸後四角錨塊是否維持 1:1 零變形
   */
  public static verifyNineSliceIntegrity(
    data?: LayaHierarchyNodeData
  ): NineSliceCalibrationReport {
    const targetData = data || ZhudaAssetSerializer.buildNineSliceDialogPrefab(320, 140);
    const rawGrid = (targetData.sizeGrid || '16,16,16,16,0')
      .split(',')
      .map((n) => Number(n.trim()));
    const sizeGrid: [number, number, number, number, number] = [
      rawGrid[0] ?? 16,
      rawGrid[1] ?? 16,
      rawGrid[2] ?? 16,
      rawGrid[3] ?? 16,
      rawGrid[4] ?? 0
    ];
    const [top, right, bottom, left] = sizeGrid;

    const baseWidth = targetData._zhudaMeta?.nineSliceSpec?.baseWidth ?? 160;
    const baseHeight = targetData._zhudaMeta?.nineSliceSpec?.baseHeight ?? 80;
    const stretchedWidth = targetData.width ?? 320;
    const stretchedHeight = targetData.height ?? 140;

    const cmds = targetData._gcmds || [];
    const centerCmd = cmds[1] || { x: left, y: top, width: stretchedWidth - left - right, height: stretchedHeight - top - bottom };
    const tlCmd = cmds[2] || { x: 0, y: 0, width: left, height: top };
    const trCmd = cmds[3] || { x: stretchedWidth - right, y: 0, width: right, height: top };
    const blCmd = cmds[4] || { x: 0, y: stretchedHeight - bottom, width: left, height: bottom };
    const brCmd = cmds[5] || { x: stretchedWidth - right, y: stretchedHeight - bottom, width: right, height: bottom };

    const cornerPins = {
      topLeft: { x: tlCmd.x ?? 0, y: tlCmd.y ?? 0, width: tlCmd.width ?? left, height: tlCmd.height ?? top },
      topRight: { x: trCmd.x ?? 0, y: trCmd.y ?? 0, width: trCmd.width ?? right, height: trCmd.height ?? top },
      bottomLeft: { x: blCmd.x ?? 0, y: blCmd.y ?? 0, width: blCmd.width ?? left, height: blCmd.height ?? bottom },
      bottomRight: { x: brCmd.x ?? 0, y: brCmd.y ?? 0, width: brCmd.width ?? right, height: brCmd.height ?? bottom }
    };

    const errors = [
      Math.abs(cornerPins.topLeft.width - left),
      Math.abs(cornerPins.topLeft.height - top),
      Math.abs(cornerPins.topRight.width - right),
      Math.abs(cornerPins.topRight.height - top),
      Math.abs(cornerPins.bottomLeft.width - left),
      Math.abs(cornerPins.bottomLeft.height - bottom),
      Math.abs(cornerPins.bottomRight.width - right),
      Math.abs(cornerPins.bottomRight.height - bottom),
      Math.abs(cornerPins.topRight.x - (stretchedWidth - right)),
      Math.abs(cornerPins.bottomRight.y - (stretchedHeight - bottom))
    ];
    const maxCornerDistortionPx = Math.max(...errors);

    return {
      assetName: targetData._zhudaMeta?.targetSpec?.assetName || 'NineSliceDialogFrame.lh',
      sizeGrid,
      baseSize: { width: baseWidth, height: baseHeight },
      stretchedSize: { width: stretchedWidth, height: stretchedHeight },
      stretchRatioX: Number((stretchedWidth / baseWidth).toFixed(2)),
      stretchRatioY: Number((stretchedHeight / baseHeight).toFixed(2)),
      cornerPins,
      maxCornerDistortionPx,
      centerSliceSize: {
        width: centerCmd.width ?? stretchedWidth - left - right,
        height: centerCmd.height ?? stretchedHeight - top - bottom
      },
      passed: maxCornerDistortionPx === 0 && Boolean(targetData.sizeGrid)
    };
  }
}
