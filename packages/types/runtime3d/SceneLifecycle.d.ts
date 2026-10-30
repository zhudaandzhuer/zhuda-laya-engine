import type { Vec3 } from "./Math3D";
/** Owned releases execute in reverse order. Borrowed resources must not be registered here. */
export declare class ZhudaResourceScope {
    private releases;
    disposed: boolean;
    own<T>(value: T, release: (value: T) => void): T;
    defer(release: () => void): void;
    dispose(): void;
}
export interface SceneRegion {
    dispose(): void;
}
/** Regions are consumer-defined. Leaving a region cancels pending work and rejects late additions. */
export declare class ZhudaSceneRegions {
    private regions;
    enter(id: string, create: (signal: AbortSignal) => Promise<SceneRegion>): Promise<boolean>;
    leave(id: string): void;
    clear(): void;
    get size(): number;
}
export type SceneResourceKind = "mesh" | "texture" | "renderTarget";
export declare class ZhudaSceneBudget {
    private resources;
    track(id: string, kind: SceneResourceKind, estimatedBytes: number): () => boolean;
    report(): {
        counts: {
            mesh: number;
            texture: number;
            renderTarget: number;
        };
        estimatedBytes: number;
        memoryMeasurement: "estimate";
    };
}
export interface SceneQuality {
    dprCap: number;
    shadowDistance: number;
    shadowResolution: 512 | 1024 | 2048;
    extraPasses: number;
    lodDistance: number;
}
export declare const sceneQuality: Record<"low" | "medium" | "high", SceneQuality>;
/** Hysteresis avoids repeated mesh swaps at a distance boundary. Consumer owns LOD meshes. */
export declare class ZhudaDistanceLOD {
    readonly distance: number;
    readonly hysteresis: number;
    private near;
    constructor(distance: number, hysteresis?: number);
    update(camera: Vec3, object: Vec3): boolean;
}
/** Logical resource inventory. Byte totals are estimates, never driver/GPU measurements. */
export declare function inspectSceneResources(runtime?: any): {
    counts: {
        mesh: number;
        texture: number;
        renderTarget: number;
    };
    resources: number;
    estimatedBytes: number;
    meshBytes: number;
    textureBytes: number;
    renderTargetBytes: number;
    memoryMeasurement: "estimate";
    assumptions: string;
};
/** Presentation budget only. Consumers retain authority over simulation and visibility rules. */
export declare function applySceneQuality(quality: SceneQuality, session: {
    options: {
        dprCap?: number;
    };
    resize(): void;
}, camera: any, lights?: any[]): {
    additionalPassBudget: number;
    dprCap: number;
    shadowDistance: number;
    shadowResolution: 512 | 1024 | 2048;
    extraPasses: number;
    lodDistance: number;
};
