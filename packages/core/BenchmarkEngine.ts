/** Legacy showcase telemetry. Estimates are labeled; runtime WebGL measurements use ZhudaRuntimeProfiler. */

import { ENGINE_PRESET_PROFILES, type PresetProfileName, TopologyResolver } from './TopologyGraph.ts';
import { PixelCalibrationEngine } from './PixelCalibrationEngine.ts';
import { ZhudaAssetSerializer } from './StaticAssetPipeline.ts';
import { IframeSoundAdapter } from './IframeSoundAdapter.ts';
import { ViewportMatrixEngine } from './ViewportMatrixEngine.ts';
import { UnityBridgePipeline } from './UnityBridgePipeline.ts';

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
  pruningProfiles: Record<
    PresetProfileName,
    {
      moduleCount: number;
      sizeKB: number;
      savedPercent: number;
    }
  >;
}

export class ZhudaBenchmarkEngine {
  /**
   * 執行即時微基準測試並回傳量化性能數據
   */
  public static runSuite(activeTileNodesCount: number = 81): BenchmarkReport {
    // 1. Scalar spring arithmetic only; this does not execute the Spine runtime.
    const iterations = 10000;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let angle = 0.25;
    let vel = 0.0;
    const stiffness = 120.0;
    const damping = 0.92;
    const dt = 0.016;
    for (let i = 0; i < iterations; i++) {
      const accel = -stiffness * angle + Math.sin(i * 0.05) * 4.0;
      vel = (vel + accel * dt) * damping;
      angle += vel * dt;
    }
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsedMs = Math.max(0.05, t1 - t0 + (angle * 0.000001));
    const springMathOpsPerMs = Math.round(iterations / elapsedMs);
    const spinePhysicsOpsPerMs = null;

    // 2. No pool-versus-allocation comparison has been measured here.
    const zeroGcPoolSpeedupRatio = null; // No measured comparison available.

    // 3. 計算同屏 3D 棋盤 + 2D 投影標籤 + Spine 4.2 精靈 + 向量 HUD 的 DrawCall 對比
    // Zhuda-LayaAir 透過 sharedMesh + sharedMaterial 動態合批與同一 WebGL Context 2D/3D 混排：
    const estimatedDrawCallsZhuda = 9; // 背景 + 隱藏格批次 + 揭開格批次 + 旗幟批次 + 2D HUD 合批 + Spine
    // Three.js + Pixi-Spine + DOM/CSS2DRenderer 拼裝方案：每個數字標籤一個 DOM 節點或獨立 Sprite 材質
    const estimatedDrawCallsThreeAssembled = activeTileNodesCount + 28;

    // 4. 計算 4 種預設 Profile 的按需剪枝體積
    const pruningProfiles = {} as BenchmarkReport['pruningProfiles'];
    const profileNames: PresetProfileName[] = [
      '2d-light',
      '3d-standard',
      'spine-hybrid',
      'full-all-in-one'
    ];
    for (const p of profileNames) {
      const res = TopologyResolver.resolveByFeatures(ENGINE_PRESET_PROFILES[p]);
      pruningProfiles[p] = {
        moduleCount: res.orderedModules.length,
        sizeKB: res.totalSizeKB,
        savedPercent: res.prunedRatioPercent
      };
    }

    // 5. 評估基建六與三大落地優化方向：靜態資產 (.lh / .ls)、九宮格、iframe 音訊、多解析度矩陣与 Unity 移植
    const allStaticAssets = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
    const lhKeys = Object.keys(allStaticAssets).filter((k) => k.endsWith('.lh'));
    const vfxKeys = lhKeys.filter(
      (k) =>
        allStaticAssets[k]._zhudaMeta?.category === 'vfx-blueprint' ||
        allStaticAssets[k]._zhudaMeta?.category === 'particle-emitter'
    );
    const convergence = PixelCalibrationEngine.runSelfConvergenceDemo();
    const nineSliceReport = PixelCalibrationEngine.verifyNineSliceIntegrity(
      allStaticAssets['NineSliceDialogFrame.lh']
    );
    const iframeDiag = IframeSoundAdapter.getShared().getDiagnostics();
    const viewportAudit = ViewportMatrixEngine.auditAllViewportProfiles();
    const unityReport = UnityBridgePipeline.runFullMigrationVerification();

    return {
      timestamp: Date.now(),
      springMathOpsPerMs,
      measurementScope: 'Spring arithmetic microbenchmark only; draw calls below are estimates, and no pool speedup or Spine runtime result is claimed.',
      spinePhysicsOpsPerMs,
      zeroGcPoolSpeedupRatio,
      sharedMeshBatchNodes: activeTileNodesCount,
      estimatedDrawCallsZhuda,
      estimatedDrawCallsThreeAssembled,
      staticAssetTelemetry: {
        totalAssetsCount: Object.keys(allStaticAssets).length,
        calibratedPrefabsCount: lhKeys.length,
        vfxBlueprintsCount: vfxKeys.length,
        allCalibratedPassed: convergence.afterReport.passed && nineSliceReport.passed,
        convergenceTimeMs: convergence.elapsedMs,
        beforePxError: convergence.beforeReport.pixelErrors.maxAbsErrorPx,
        afterPxError: convergence.afterReport.pixelErrors.maxAbsErrorPx,
        beforeDeltaE2000: convergence.beforeReport.colorMetrics.maxDeltaE2000,
        afterDeltaE2000: convergence.afterReport.colorMetrics.maxDeltaE2000
      },
      nineSliceTelemetry: {
        sizeGrid: nineSliceReport.sizeGrid.join(','),
        stretchRatioX: nineSliceReport.stretchRatioX,
        stretchRatioY: nineSliceReport.stretchRatioY,
        maxCornerDistortionPx: nineSliceReport.maxCornerDistortionPx,
        passed: nineSliceReport.passed
      },
      iframeAudioTelemetry: {
        postMessageBridgeActive: iframeDiag.postMessageBridgeActive,
        inIframe: iframeDiag.inIframe,
        autoSuspendOnBlurReady: true,
        masterVolume: iframeDiag.volumes.master
      },
      viewportMatrixTelemetry: {
        totalProfiles: viewportAudit.totalProfiles,
        allSafeAreaPassed: viewportAudit.allPassed,
        deviceAspectRatios: viewportAudit.reports.map((r) => `${r.deviceId}(${r.aspectLabel})`)
      },
      unityMigrationTelemetry: {
        sourceSceneName: unityReport.sourceSceneName,
        convertedNodesCount: unityReport.convertedNodesCount,
        animatorTransitionTrace: unityReport.animatorVerification.simulatedTransitionTrace,
        spine42ConstraintsMounted: unityReport.spine42Verification.physicsConstraintsMounted,
        passed: unityReport.passed
      },
      pruningProfiles
    };
  }
}
