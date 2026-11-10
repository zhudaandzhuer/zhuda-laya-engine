// Generated from TypeScript source; run npm run types:generate.
/**
 * Runtime visual contract for Spine 4.2 assets.
 *
 * A loaded Sprite or a static fallback image is not evidence that a Spine
 * presentation migrated correctly. This contract gives applications and
 * headless tests a shared, fail-fast check for the actual Spine templet.
 */
export interface SpineVisualContractSpec {
    assetId: string;
    runtimeVersion?: string;
    requiredAnimations?: string[];
    requiredSkins?: string[];
    requiredSlots?: string[];
    requiredEvents?: string[];
    requiredPhysicsConstraints?: number;
    expectedBounds?: {
        width: number;
        height: number;
        tolerancePx?: number;
    };
}
export interface SpineVisualRuntimeSnapshot {
    isSpineTemplet: boolean;
    runtimeVersion: string | null;
    animations: string[];
    skins: string[];
    slots: string[];
    events: string[];
    physicsConstraints: number;
    bounds: {
        width: number | null;
        height: number | null;
    };
}
export interface SpineVisualContractReport {
    assetId: string;
    passed: boolean;
    snapshot: SpineVisualRuntimeSnapshot;
    missingAnimations: string[];
    missingSkins: string[];
    missingSlots: string[];
    missingEvents: string[];
    issues: string[];
}
export declare class SpineVisualContract {
    static inspect(templet: any): SpineVisualRuntimeSnapshot;
    static validate(templet: any, spec: SpineVisualContractSpec): SpineVisualContractReport;
    static assert(templet: any, spec: SpineVisualContractSpec): SpineVisualContractReport;
}
