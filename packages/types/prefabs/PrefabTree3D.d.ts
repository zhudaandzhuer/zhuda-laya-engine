// Generated from TypeScript source; run npm run types:generate.
import type { DeclarativeMaterialOptions, DeclarativeCameraOptions, DeclarativeLightOptions, PrimitiveType3D } from '../zhuda-3d-physics';
export type PrefabVector3 = [number, number, number];
export interface PrefabNodePatch3D {
    active?: boolean;
    localPosition?: PrefabVector3;
    localRotationEuler?: PrefabVector3;
    localScale?: PrefabVector3;
    /** Key in this tree's materials; only valid on mesh nodes. */
    material?: string;
}
export interface PrefabTreeNode3D extends PrefabNodePatch3D {
    name: string;
    mesh?: {
        type: PrimitiveType3D;
        dimensions?: {
            width?: number;
            height?: number;
            depth?: number;
            radius?: number;
        };
    };
    children?: PrefabTreeNode3D[];
}
export interface PrefabTree3D {
    root: PrefabTreeNode3D;
    materials: Record<string, DeclarativeMaterialOptions>;
    /** Stable socket ID -> slash-separated node path, relative to the root. */
    sockets?: Record<string, string>;
}
export interface PrefabPreview3D {
    camera?: DeclarativeCameraOptions;
    ambientColor?: [number, number, number, number];
    light?: DeclarativeLightOptions;
}
export interface PrefabTreeInstance3D {
    root: Laya.Sprite3D;
    find(path?: string): Laya.Sprite3D;
    socket(id: string): Laya.Sprite3D;
    /** Resets the authored baseline before applying a complete named state. */
    apply(patches: Record<string, PrefabNodePatch3D>): void;
    /** Returns an instance-owned copy of this node's material slot before mutation. */
    makeMaterialUnique(path?: string): Laya.Material;
    dispose(): void;
}
export declare function validatePrefabPatch3D(patch: PrefabNodePatch3D): void;
export declare function validatePrefabTree3D(tree: PrefabTree3D): void;
/** Internal resource pack; lifetime is owned by the library's existing cache leases. */
export declare function createPrefabTreeResources(tree: PrefabTree3D): {
    materials: Map<string, Laya.Material>;
    meshes: Map<string, Laya.Mesh>;
    dispose: () => void;
};
type SharedTreeResources = ReturnType<typeof createPrefabTreeResources>;
/** Independent ownership is the compatible default for the synchronous builder. */
export declare function buildPrefabTree(tree: PrefabTree3D): PrefabTreeInstance3D;
/** Internal library entry; borrowed resources are released by its cache lease. */
export declare function buildSharedPrefabTree(tree: PrefabTree3D, resources: SharedTreeResources): PrefabTreeInstance3D;
export {};
