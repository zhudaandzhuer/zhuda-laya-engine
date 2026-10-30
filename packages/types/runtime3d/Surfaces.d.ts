export interface SurfaceMaterialSpec {
    type: "pbr" | "unlit";
    color?: [number, number, number, number];
    metallic?: number;
    roughness?: number;
    emission?: [number, number, number];
    textures?: {
        albedo?: any;
        normal?: any;
        metallicGloss?: any;
        emission?: any;
    };
    blend?: "opaque" | "alpha" | "additive" | "cutout";
    alphaCutoff?: number;
    doubleSided?: boolean;
    depthWrite?: boolean;
}
/** glTF/Three.js G=roughness,B=metallic -> Laya R=metallic,A=smoothness. Data stays linear. */
export declare function packMetallicRoughness(rgba: Uint8Array): Uint8Array<ArrayBuffer>;
export declare function createSurfaceTexture(width: number, height: number, pixels: Uint8Array, role: "color" | "emission" | "normal" | "data"): any;
export declare function createSurfaceMaterial(s: SurfaceMaterialSpec): any;
/** Detach borrowed texture slots before destroying an owned material. */
export declare function disposeSurfaceMaterial(m: any): void;
export interface CustomSurfaceShader {
    dimension?: 2 | 3;
    name: string;
    vertex: string;
    fragment: string;
    attributes?: Record<string, [number, any]>;
    uniforms: Record<string, any>;
    instancing?: boolean;
}
export declare function createCustomSurfaceMaterial(s: CustomSurfaceShader): any;
export interface MeshData {
    positions: Float32Array;
    normals?: Float32Array;
    uvs?: Float32Array;
    indices: Uint16Array | Uint32Array;
}
/** Laya 3.4.2 buffer adapter; POSITION/NORMAL/UV, local range uploads and refreshed bounds. */
export declare class ZhudaDynamicMesh {
    readonly data: MeshData;
    readonly mesh: any;
    readonly vertices: Float32Array;
    readonly node: any;
    private disposed;
    constructor(data: MeshData, parent?: any);
    updateRange(first: number, count: number): void;
    setPosition(i: number, x: number, y: number, z: number): void;
    refreshBounds(): void;
    dispose(): void;
}
/** Stable application IDs survive batch reorder. Laya batches shared mesh/material via GPU instancing. */
export declare class ZhudaInstanceGroup {
    readonly parent: any;
    readonly mesh: any;
    readonly material: any;
    private nodes;
    constructor(parent: any, mesh: any, material: any);
    set(id: string, matrix: ArrayLike<number>): any;
    remove(id: string): boolean;
    get(id: string): any;
    get size(): number;
    dispose(): void;
}
export interface SurfacePassRequirements {
    depth?: boolean;
    opaqueColor?: boolean;
}
/** Owns this camera's depth/color requests. A rejected budget requires a consumer material fallback.
 * Costs count requested prepasses/copies; actual draw calls depend on scene/shadows/postprocessing. */
export declare function configureSurfacePasses(camera: any, requirements: readonly SurfacePassRequirements[], maxAdditionalPasses: number): {
    requested: {
        depth: boolean;
        opaqueColor: boolean;
    };
    requestedPasses: number;
    enabledPasses: number;
    ready: boolean;
    reason: string | null;
};
