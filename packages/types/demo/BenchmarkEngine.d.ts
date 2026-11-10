// Generated from TypeScript source; run npm run types:generate.
/** Legacy showcase telemetry. Estimates are labeled; runtime WebGL measurements use ZhudaRuntimeProfiler. */
import { type PresetProfileName } from '../TopologyGraph';
export interface BenchmarkReport {
    timestamp: number;
    /** @deprecated No actual Spine runtime benchmark is performed here. */
    spinePhysicsOpsPerMs: number | null;
    springMathOpsPerMs: number;
    measurementScope: string;
    zeroGcPoolSpeedupRatio: number | null;
    sharedMeshBatchNodes: number;
    estimatedDrawCallsZhuda: number;
    estimatedDrawCallsThreeAssembled: number;
    staticAssetTelemetry: {
        totalAssetsCount: number;
        calibratedPrefabsCount: number;
        vfxBlueprintsCount: number;
        allCalibratedPassed: boolean;
        convergenceTimeMs: number;
        beforePxError: number;
        afterPxError: number;
        beforeDeltaE2000: number;
        afterDeltaE2000: number;
    };
    nineSliceTelemetry: {
        sizeGrid: string;
        stretchRatioX: number;
        stretchRatioY: number;
        maxCornerDistortionPx: number;
        passed: boolean;
    };
    iframeAudioTelemetry: {
        postMessageBridgeActive: boolean;
        inIframe: boolean;
        autoSuspendOnBlurReady: boolean;
        masterVolume: number;
    };
    viewportMatrixTelemetry: {
        totalProfiles: number;
        allSafeAreaPassed: boolean;
        deviceAspectRatios: string[];
    };
    unityMigrationTelemetry: {
        sourceSceneName: string;
        convertedNodesCount: number;
        animatorTransitionTrace: string[];
        spine42ConstraintsMounted: number;
        passed: boolean;
    };
    pruningProfiles: Record<PresetProfileName, {
        moduleCount: number;
        sizeKB: number;
        savedPercent: number;
    }>;
}
export declare class ZhudaBenchmarkEngine {
    /**
     * 執行即時微基準測試並回傳量化性能數據
     */
    static runSuite(activeTileNodesCount?: number): BenchmarkReport;
}
