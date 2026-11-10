// Generated from TypeScript source; run npm run types:generate.
/**
 * @zhuda-laya/core — Runtime Ready Guards & Prototype Detox
 *
 * 解決痛點二、三、五、六：
 * - 痛點二：追蹤並驗證 ClassUtils.regClass 類別反射註冊表
 * - 痛點三：WASM / 物理 / Spine 4.2 運行期狀態守衛 (Runtime Ready Guards)
 * - 痛點五：3D 材質與 Shader 管線安全降級守衛
 * - 痛點六：Laya.Button AutoBitmap.setState 原型崩潰免疫補丁 (Prototype Detox)
 */
import type { Physics2DGuardStatus, Physics3DGuardStatus, Spine42PhysicsTelemetry } from './index';
export interface EngineHealthReport {
    timestamp: number;
    engineVersion: string;
    prototypeDetoxApplied: boolean;
    buttonSetStateGuarded: boolean;
    registeredComponents: string[];
    physics2D: Physics2DGuardStatus;
    physics3D: Physics3DGuardStatus;
    spine42: Spine42PhysicsTelemetry;
    loadedGlobalModules: number;
}
export declare class EngineGuard {
    private static detoxInstalled;
    private static registeredComponentNames;
    /**
     * 安裝原型解毒補丁 (Prototype Detox)
     * 徹底修復 Laya.Button 強制假設 _graphics 為 AutoBitmap 導致 setState is not a function 的崩潰
     */
    static installPrototypeDetox(): {
        detoxApplied: boolean;
        patchedTargets: string[];
    };
    /**
     * 註冊組件至 Laya 反射表並記錄於 Zhuda 守衛索引
     */
    static registerComponent(className: string, ctor: unknown, assetId?: string): void;
    static getRegisteredComponents(): string[];
    /**
     * 驗證 2D 物理 (Physics2D + Box2D + TileMap) 狀態守衛
     */
    static checkPhysics2D(): Physics2DGuardStatus;
    /**
     * 驗證 3D 物理 (Bullet + Physics3D) 狀態守衛
     */
    static checkPhysics3D(): Physics3DGuardStatus;
    /**
     * 驗證 Spine 4.2 (含 PhysicsConstraint 物理骨骼約束) 狀態守衛
     */
    static checkSpine42(): Spine42PhysicsTelemetry;
    /**
     * 產出完整引擎健康度與防撞牆診斷報告
     */
    static inspectEngineHealth(): EngineHealthReport;
}
