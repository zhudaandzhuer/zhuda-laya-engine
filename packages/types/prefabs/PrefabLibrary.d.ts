import type { LayaHierarchyNodeData } from "../../types/zhuda-static-assets";
import type { AssetProvider } from "../runtime3d/AssetProvider";
import type { PrefabTree3D, PrefabNodePatch3D } from "./PrefabTree3D";
export type PrefabNodePatch = Partial<Pick<LayaHierarchyNodeData, "x" | "y" | "width" | "height" | "scaleX" | "scaleY" | "rotation" | "alpha" | "visible" | "text" | "font" | "fontSize" | "color" | "bold" | "align" | "valign" | "sizeGrid">>;
export interface PrefabDefinition {
    id: string;
    kind?: "2d";
    /** Logical provider ID of a static 2D .lh JSON hierarchy. */
    asset: string;
    textures?: string[];
    states: Record<string, Record<string, PrefabNodePatch>>;
}
export interface Prefab3DDefinition {
    id: string;
    kind: "3d";
    tree: PrefabTree3D;
    states: Record<string, Record<string, PrefabNodePatch3D>>;
}
export type AnyPrefabDefinition = PrefabDefinition | Prefab3DDefinition;
type PrefabRoot<T> = T extends Prefab3DDefinition ? Laya.Sprite3D : Laya.Sprite;
export interface PrefabProvenance {
    kind: "2d" | "3d";
    /** Hash of the complete serialized definition, including states and recipe. */
    definitionHash: string;
    id: string;
    state: string;
    /** SHA-256 of the original bytes, including every declared texture. */
    sources: Record<string, string>;
}
export interface PrefabInstance<T extends Laya.Node = Laya.Sprite> {
    root: T;
    provenance: PrefabProvenance;
    find(path?: string): T;
    applyState(state: string): void;
    socket(id: string): T;
    /** 3D only: copy this instance's material slot before changing material properties. */
    makeMaterialUnique(path?: string): Laya.Material;
    dispose(): void;
}
/** Returns null for manually built substitutes. */
export declare function inspectPrefabInstance(root: Laya.Node): PrefabProvenance | null;
export declare function findPrefabNode<T extends Laya.Node>(root: T, path?: string): T;
/** Shared by isolated previews and scenes. Owns instances and resource leases. */
export declare class ZhudaPrefabLibrary<T extends AnyPrefabDefinition = PrefabDefinition> {
    private readonly definitions;
    private readonly cache;
    private readonly shared3DCache;
    private readonly share3DResources;
    private readonly active;
    private readonly instances;
    private disposed;
    private readonly timeoutMs;
    constructor(options: {
        provider: AssetProvider;
        definitions: readonly T[];
        timeoutMs?: number;
        share3DResources?: boolean;
    });
    instantiate(id: string, options?: {
        state?: string;
        signal?: AbortSignal;
        parent?: Laya.Node;
    }): Promise<PrefabInstance<PrefabRoot<T>>>;
    report(): {
        shared3D: {
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
        };
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
export {};
