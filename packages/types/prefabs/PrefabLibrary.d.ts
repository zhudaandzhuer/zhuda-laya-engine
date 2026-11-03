import type { LayaHierarchyNodeData } from "../../types/zhuda-static-assets";
import type { AssetProvider } from "../runtime3d/AssetProvider";
export type PrefabNodePatch = Partial<Pick<LayaHierarchyNodeData, "x" | "y" | "width" | "height" | "scaleX" | "scaleY" | "rotation" | "alpha" | "visible" | "text" | "font" | "fontSize" | "color" | "bold" | "align" | "valign" | "sizeGrid">>;
export interface PrefabDefinition {
    id: string;
    /** Logical provider ID of a static 2D .lh JSON hierarchy. */
    asset: string;
    textures?: string[];
    states: Record<string, Record<string, PrefabNodePatch>>;
}
export interface PrefabProvenance {
    id: string;
    state: string;
    /** SHA-256 of the original bytes, including every declared texture. */
    sources: Record<string, string>;
}
export interface PrefabInstance {
    root: Laya.Sprite;
    provenance: PrefabProvenance;
    find(path?: string): Laya.Sprite;
    dispose(): void;
}
/** Returns null for manually built substitutes. */
export declare function inspectPrefabInstance(root: Laya.Sprite): PrefabProvenance | null;
export declare function findPrefabNode(root: Laya.Sprite, path?: string): Laya.Sprite;
/** Shared by isolated previews and scenes. Owns instances and resource leases. */
export declare class ZhudaPrefabLibrary {
    private readonly definitions;
    private readonly cache;
    private readonly active;
    private readonly instances;
    private disposed;
    private readonly timeoutMs;
    constructor(options: {
        provider: AssetProvider;
        definitions: PrefabDefinition[];
        timeoutMs?: number;
    });
    instantiate(id: string, options?: {
        state?: string;
        signal?: AbortSignal;
        parent?: Laya.Node;
    }): Promise<PrefabInstance>;
    report(): {
        entries: number;
        references: number;
        pending: number;
        loads: number;
        phases: {
            key: string;
            phase: import("../runtime3d/Assets").AssetPhase;
            references: number;
        }[];
        gpuReady: "requires-first-draw";
        instances: number;
    };
    dispose(): void;
}
