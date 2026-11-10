// Generated from TypeScript source; run npm run types:generate.
import { PixelCalibrationEngine as CorePixelCalibrationEngine } from '../PixelCalibrationEngine.js';
import type { PixelCalibrationReport, AutoFixPatch, LayaHierarchyNodeData } from '../index.js';
/** Calibration sample using the explicit built-in asset catalog. */
export declare class PixelCalibrationEngine extends CorePixelCalibrationEngine {
    static runSelfConvergenceDemo(): {
        beforeReport: PixelCalibrationReport;
        appliedPatches: AutoFixPatch[];
        afterReport: PixelCalibrationReport;
        convergedHierarchy: LayaHierarchyNodeData;
        elapsedMs: number;
    };
}
