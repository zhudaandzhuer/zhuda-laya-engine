// Generated from TypeScript source; run npm run types:generate.
/**
 * @zhuda-laya/core — M5 跨引擎基建：Unity 場景 + AnimatorController 狀態機 + Spine 4.2 轉換管線 (UnityBridgePipeline)
 *
 * Legacy descriptor demonstration for a fixed showcase prefab. This is not a general Unity file importer.
 * Production material and curve conversion lives in VisualMigrationPipeline.ts; unknown shaders must block migration.

 */
import type { LayaHierarchyNodeData, UnityAnimatorControllerSpec, UnityAnimatorState, UnityMigrationReport, UnitySceneDescriptor } from '../index';
export declare const UNITY_CYBER_SHRINE_SCENE: UnitySceneDescriptor;
/**
 * Unity AnimatorController 運行期確定性狀態機求值器
 */
export declare class UnityAnimatorStateMachine {
    private spec;
    private currentStateName;
    private paramValues;
    private stateHistory;
    constructor(spec: UnityAnimatorControllerSpec);
    getCurrentState(): UnityAnimatorState;
    getStateHistory(): string[];
    setFloat(name: string, value: number): string;
    setBool(name: string, value: boolean): string;
    setTrigger(name: string): string;
    evaluateTransitions(): string;
    private checkCondition;
}
export declare class UnityBridgePipeline {
    /**
     * 將 Unity 左手座標系 (LH, +X 右, +Y 上, +Z 前) 轉為 LayaAir 3.4.2 右手座標系 (RH, -X 翻轉)
     */
    static convertPositionLHtoRH(posLH: [number, number, number]): [number, number, number];
    /**
     * 將 Unity 左手系歐拉角 [rx, ry, rz] 轉為 LayaAir 3.4.2 右手系歐拉角 [rx, -ry, -rz]
     */
    static convertEulerLHtoRH(eulerLH: [number, number, number]): [number, number, number];
    /**
     * 映射 Unity Shader 名稱至 LayaAir 3.4.2 對應材質類別
     */
    static mapUnityShaderToLayaMaterialClass(shaderName: string): string;
    /**
     * 將 Unity 場景中的「CrystalGuardian (含 AnimatorController + Spine 4.2 聯動)」轉為 LayaAir 靜態預製體 (.lh)
     */
    static buildUnityCrystalGuardianPrefab(scene?: UnitySceneDescriptor): LayaHierarchyNodeData;
    /**
     * 執行完整 Unity 場景 + AnimatorController + Spine 4.2 轉換與狀態機過渡驗測
     */
    static runFullMigrationVerification(scene?: UnitySceneDescriptor): UnityMigrationReport;
}
