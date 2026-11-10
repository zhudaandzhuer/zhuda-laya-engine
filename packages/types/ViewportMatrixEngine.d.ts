// Generated from TypeScript source; run npm run types:generate.
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
import type { ViewportDeviceId, ViewportDeviceSpec, ViewportLayoutReport } from './index.js';
export declare const VIEWPORT_DEVICE_PROFILES: Record<ViewportDeviceId, ViewportDeviceSpec>;
export declare class ViewportMatrixEngine {
    /**
     * 針對指定設備視口與 SafeArea 計算無裁切 UI 錨點與 3D 相機 FOV 自適應補償
     */
    static computeLayoutForDevice(deviceOrId: ViewportDeviceId | ViewportDeviceSpec): ViewportLayoutReport;
    /**
     * 執行全部 5 大主流設備視口與 SafeArea 矩陣驗測
     */
    static auditAllViewportProfiles(): {
        totalProfiles: number;
        allPassed: boolean;
        reports: ViewportLayoutReport[];
    };
}
