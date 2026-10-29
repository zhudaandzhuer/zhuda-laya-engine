/**
 * @zhuda-laya/core — M3 視口基建：多解析度跨設備與 SafeArea 安全區驗測矩陣 (ViewportMatrixEngine)
 *
 * 支援 5 大主流商業終端視口與瀏海/靈動島/Home Indicator 安全區 (SafeArea) 計算與 3D FOV 自動補償：
 * 1. desktop-fhd-16-9       (1280×720, 16:9 標準桌面)
 * 2. iphone-15-pro-portrait (393×852, 9:19.5 靈動島 Top=59px, Bottom=34px)
 * 3. iphone-15-pro-landscape(852×393, 19.5:9 左右安全內縮 Left=59px, Right=59px, Bottom=21px)
 * 4. ipad-air-4-3           (1024×768, 4:3 平板比例 Top=24px, Bottom=20px)
 * 5. ultrawide-21-9         (1680×720, 21:9 超寬螢幕)
 */

import type {
  ViewportDeviceId,
  ViewportDeviceSpec,
  ViewportLayoutReport
} from '../types/index.ts';

export const VIEWPORT_DEVICE_PROFILES: Record<ViewportDeviceId, ViewportDeviceSpec> = {
  'desktop-fhd-16-9': {
    id: 'desktop-fhd-16-9',
    name: 'Desktop FHD (16:9)',
    aspectLabel: '16:9',
    viewportWidth: 1280,
    viewportHeight: 720,
    devicePixelRatio: 2,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 }
  },
  'iphone-15-pro-portrait': {
    id: 'iphone-15-pro-portrait',
    name: 'iPhone 15 Pro 直向 (9:19.5 靈動島)',
    aspectLabel: '9:19.5',
    viewportWidth: 393,
    viewportHeight: 852,
    devicePixelRatio: 3,
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 }
  },
  'iphone-15-pro-landscape': {
    id: 'iphone-15-pro-landscape',
    name: 'iPhone 15 Pro 橫向 (19.5:9 安全區)',
    aspectLabel: '19.5:9',
    viewportWidth: 852,
    viewportHeight: 393,
    devicePixelRatio: 3,
    safeArea: { top: 0, right: 59, bottom: 21, left: 59 }
  },
  'ipad-air-4-3': {
    id: 'ipad-air-4-3',
    name: 'iPad Air 平板 (4:3)',
    aspectLabel: '4:3',
    viewportWidth: 1024,
    viewportHeight: 768,
    devicePixelRatio: 2,
    safeArea: { top: 24, right: 0, bottom: 20, left: 0 }
  },
  'ultrawide-21-9': {
    id: 'ultrawide-21-9',
    name: 'Ultrawide 超寬電競螢幕 (21:9)',
    aspectLabel: '21:9',
    viewportWidth: 1680,
    viewportHeight: 720,
    devicePixelRatio: 2,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 }
  }
};

export class ViewportMatrixEngine {
  /**
   * 針對指定設備視口與 SafeArea 計算無裁切 UI 錨點與 3D 相機 FOV 自適應補償
   */
  public static computeLayoutForDevice(
    deviceOrId: ViewportDeviceId | ViewportDeviceSpec
  ): ViewportLayoutReport {
    const spec: ViewportDeviceSpec =
      typeof deviceOrId === 'string'
        ? VIEWPORT_DEVICE_PROFILES[deviceOrId] || VIEWPORT_DEVICE_PROFILES['desktop-fhd-16-9']
        : deviceOrId;

    const { viewportWidth: vw, viewportHeight: vh, safeArea } = spec;
    const safeX = safeArea.left;
    const safeY = safeArea.top;
    const safeW = Math.max(100, vw - safeArea.left - safeArea.right);
    const safeH = Math.max(100, vh - safeArea.top - safeArea.bottom);

    const orientation: 'landscape' | 'portrait' = vw >= vh ? 'landscape' : 'portrait';
    const aspect = safeW / safeH;

    // 設計基準為 1280x720 (橫向) 或 393x759 (直向安全區)
    const scaleFactor =
      orientation === 'landscape'
        ? Number(Math.min(safeW / 1280, safeH / 720).toFixed(3))
        : Number(Math.min(safeW / 393, safeH / 759).toFixed(3));

    // 3D 相機垂直 FOV 與距離補償：直向窄螢幕時擴大 FOV 並拉遠距離，保證 3D 棋盤絕不超出左右邊界
    const recommendedCameraFov =
      orientation === 'portrait'
        ? Math.min(68, Math.round(45 / Math.max(0.62, aspect)))
        : aspect < 1.5
          ? 50
          : 45;
    const recommendedCameraDist =
      orientation === 'portrait' ? 19.2 : aspect < 1.5 ? 15.6 : 14.0;

    const pad = orientation === 'portrait' ? 10 : 16;

    let hudTopBarRect: { x: number; y: number; width: number; height: number };
    let mascotRect: { x: number; y: number; width: number; height: number };
    let telemetryRect: { x: number; y: number; width: number; height: number };
    let boardViewportRect: { x: number; y: number; width: number; height: number };

    if (orientation === 'landscape') {
      const topH = Math.min(72, Math.round(safeH * 0.12));
      hudTopBarRect = {
        x: safeX + pad,
        y: safeY + pad,
        width: safeW - pad * 2,
        height: topH
      };

      const sideW = Math.min(225, Math.round(safeW * 0.21));
      const mascotH = Math.min(172, Math.round((safeH - topH - pad * 3) * 0.34));
      mascotRect = {
        x: safeX + safeW - pad - sideW,
        y: hudTopBarRect.y + topH + pad,
        width: sideW,
        height: mascotH
      };

      const teleY = mascotRect.y + mascotH + pad;
      const teleH = Math.max(80, safeY + safeH - pad - teleY);
      telemetryRect = {
        x: mascotRect.x,
        y: teleY,
        width: sideW,
        height: teleH
      };

      boardViewportRect = {
        x: safeX + pad,
        y: hudTopBarRect.y + topH + pad,
        width: Math.max(120, mascotRect.x - (safeX + pad) - pad),
        height: Math.max(120, safeH - topH - pad * 3)
      };
    } else {
      // 直向佈局 (Portrait Mobile)：頂部 HUD -> 中央 3D 棋盤 -> 底部並排 Mascot 與遙測面板
      const topH = 60;
      hudTopBarRect = {
        x: safeX + pad,
        y: safeY + pad,
        width: safeW - pad * 2,
        height: topH
      };

      const bottomRowH = 148;
      const bottomY = safeY + safeH - pad - bottomRowH;
      const halfW = Math.floor((safeW - pad * 3) / 2);

      mascotRect = {
        x: safeX + pad,
        y: bottomY,
        width: halfW,
        height: bottomRowH
      };

      telemetryRect = {
        x: safeX + pad * 2 + halfW,
        y: bottomY,
        width: safeW - pad * 3 - halfW,
        height: bottomRowH
      };

      const boardY = hudTopBarRect.y + topH + pad;
      boardViewportRect = {
        x: safeX + pad,
        y: boardY,
        width: safeW - pad * 2,
        height: Math.max(160, bottomY - boardY - pad)
      };
    }

    const allRects = [hudTopBarRect, mascotRect, telemetryRect, boardViewportRect];
    const safeRight = safeX + safeW;
    const safeBottom = safeY + safeH;

    const safeAreaCompliant = allRects.every(
      (r) =>
        r.x >= safeX &&
        r.y >= safeY &&
        r.x + r.width <= safeRight &&
        r.y + r.height <= safeBottom &&
        r.width > 0 &&
        r.height > 0
    );

    const zeroOverflowPassed = allRects.every(
      (r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= vw && r.y + r.height <= vh
    );

    return {
      deviceId: spec.id,
      deviceName: spec.name,
      aspectLabel: spec.aspectLabel,
      viewportWidth: vw,
      viewportHeight: vh,
      safeArea: { ...safeArea },
      safeZoneRect: { x: safeX, y: safeY, width: safeW, height: safeH },
      orientation,
      scaleFactor,
      recommendedCameraFov,
      recommendedCameraDist,
      hudTopBarRect,
      mascotRect,
      telemetryRect,
      boardViewportRect,
      safeAreaCompliant,
      zeroOverflowPassed
    };
  }

  /**
   * 執行全部 5 大主流設備視口與 SafeArea 矩陣驗測
   */
  public static auditAllViewportProfiles(): {
    totalProfiles: number;
    allPassed: boolean;
    reports: ViewportLayoutReport[];
  } {
    const ids = Object.keys(VIEWPORT_DEVICE_PROFILES) as ViewportDeviceId[];
    const reports = ids.map((id) => this.computeLayoutForDevice(id));
    const allPassed = reports.every((r) => r.safeAreaCompliant && r.zeroOverflowPassed);

    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.zhudaViewportProfiles = String(reports.length);
      document.body.dataset.zhudaSafeareaPassed = String(allPassed);
    }

    return {
      totalProfiles: reports.length,
      allPassed,
      reports
    };
  }
}
