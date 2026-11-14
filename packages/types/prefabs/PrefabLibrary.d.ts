// Generated from TypeScript source; run npm run types:generate.
import type { LayaHierarchyNodeData } from '../zhuda-static-assets.js';
import type { AssetProvider } from '../runtime3d/AssetProvider.js';
import type { PrefabTree3D, PrefabNodePatch3D } from './PrefabTree3D.js';
import { type ZhudaModelPlacement } from '../runtime3d/ModelPlacements.js';
import { type ZhudaLodCounts } from '../runtime3d/ModelLod.js';
export type PrefabNodePatch = Partial<Pick<LayaHierarchyNodeData, 'x' | 'y' | 'width' | 'height' | 'anchorX' | 'anchorY' | 'pivotX' | 'pivotY' | 'scaleX' | 'scaleY' | 'rotation' | 'alpha' | 'visible' | 'text' | 'font' | 'fontSize' | 'color' | 'bold' | 'align' | 'valign' | 'sizeGrid'>>;
export interface PrefabDefinition {
    id: string;
    kind?: '2d';
    /** Logical provider ID of a static 2D .lh JSON hierarchy. */
    asset: string;
    textures?: string[];
    states: Record<string, Record<string, PrefabNodePatch>>;
}
export interface Prefab3DDefinition {
    id: string;
    kind: '3d';
    tree: PrefabTree3D;
    states: Record<string, Record<string, PrefabNodePatch3D>>;
}
/** One model of a model prefab: a self-contained `.glb` by logical provider ID. */
export interface PrefabModelNode {
    /** Unique within the prefab; the path `find` and state patches use. */
    name: string;
    /** Logical provider ID of an embedded GLB. */
    asset: string;
    position?: [number, number, number];
    yawDeg?: number;
    /** Uniform scale, 0.001..1000 (default 1). */
    scale?: number;
    /** Copies of the model: `[x, y, z, yawDeg, scale]` each, relative to this node. */
    placements?: ZhudaModelPlacement[];
    /** Cut-out (alpha-tested) materials let light through. */
    translucent?: boolean;
    /** Scales what the model's materials give off, 0..8 (default 1). */
    emission?: number;
    /**
     * False: the model casts no shadow (it still takes them). For ground and
     * paving, which shade nothing, and for what is too small to matter.
     */
    castShadow?: boolean;
    /**
     * Lighter versions for distance, nearest first (at most 4): beyond
     * `fromMeters` from the eye a copy draws this model instead of the one
     * before. Nothing changes until the Scene calls the instance's `updateLod`.
     */
    lod?: {
        asset: string;
        fromMeters: number;
    }[];
    /** Beyond this distance from the eye a copy draws nothing. */
    cullMeters?: number;
}
export interface PrefabModelPatch {
    active?: boolean;
}
/**
 * Scenery built from model files: many models, each once or as many copies.
 * Lighting, sky, fog, water and cameras belong to the Scene that instantiates it.
 */
export interface PrefabModelsDefinition {
    id: string;
    kind: 'models';
    nodes: PrefabModelNode[];
    states: Record<string, Record<string, PrefabModelPatch>>;
}
export type AnyPrefabDefinition = PrefabDefinition | Prefab3DDefinition | PrefabModelsDefinition;
type PrefabRoot<T> = T extends Prefab3DDefinition | PrefabModelsDefinition ? Laya.Sprite3D : Laya.Sprite;
/** Most copies one model prefab may hold in all. */
export declare const ZHUDA_PREFAB_MODEL_COPIES = 60000;
/** Throws on the first problem of a model prefab definition. */
export declare function validatePrefabModels(entry: PrefabModelsDefinition): void;
export interface PrefabProvenance {
    kind: '2d' | '3d';
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
    /**
     * Model prefabs with `lod` or `cullMeters`: chooses what every copy draws
     * for an eye at `[x, y, z]` in world metres. Until it is called every copy
     * draws its full model. Without levels it changes nothing.
     */
    updateLod(eye: readonly [number, number, number]): ZhudaLodCounts;
    /**
     * Model prefabs: scales what a node's model gives off, 0..8, while it runs
     * (windows and lanterns that light at dusk). `name` is the node's name; 1
     * is as authored, whatever `emission` the definition started with.
     */
    setEmission(name: string, scale: number): void;
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
    private readonly provider;
    private models;
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
                phase: import("../index.js").AssetPhase;
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
            phase: import("../index.js").AssetPhase;
            references: number;
        }[];
        gpuReady: "requires-first-draw";
        instances: number;
    };
    dispose(): void;
}
export {};
