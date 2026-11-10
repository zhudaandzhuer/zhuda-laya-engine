import { PixelCalibrationEngine as CorePixelCalibrationEngine } from '../core/PixelCalibrationEngine.ts';
import { ZhudaAssetSerializer } from './StaticAssetPipeline.ts';
import type { PixelCalibrationReport, AutoFixPatch, LayaHierarchyNodeData } from '../types/index.ts';

/** Calibration sample using the explicit built-in asset catalog. */
export class PixelCalibrationEngine extends CorePixelCalibrationEngine {
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

}
