// Generated from TypeScript source; run npm run types:generate.
export interface SurfaceMaterialSpec {
    type: 'pbr' | 'unlit';
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
    blend?: 'opaque' | 'alpha' | 'additive' | 'cutout';
    alphaCutoff?: number;
    doubleSided?: boolean;
    depthWrite?: boolean;
}
/** glTF/Three.js G=roughness,B=metallic -> Laya R=metallic,A=smoothness. Data stays linear. */
export declare function packMetallicRoughness(rgba: Uint8Array): Uint8Array<ArrayBuffer>;
/** Anisotropic filtering mipmapped surface textures get unless told otherwise. */
export declare const ZHUDA_DEFAULT_ANISO = 8;
export declare function createSurfaceTexture(width: number, height: number, pixels: Uint8Array, role: 'color' | 'emission' | 'normal' | 'data', options?: {
    mipmap?: boolean;
    /**
     * Anisotropic filtering, 1..16 (1 is off). Default: `ZHUDA_DEFAULT_ANISO`
     * with mipmaps, 1 without. A floor, a road or a wall seen along its length
     * loses its detail a few metres away without it.
     */
    anisoLevel?: number;
}): any;
/**
 * Gives the mipmapped textures of every material below `root` anisotropic
 * filtering (see `createSurfaceTexture`). Textures that already ask for as
 * much or more, and render targets, are left alone. Returns how many textures
 * changed. The model library applies it to each model once, when it is loaded.
 */
export declare function applyZhudaAnisotropy(root: any, level?: number): number;
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
    tangents?: Float32Array;
    indices: Uint16Array | Uint32Array;
}
/** UV-derived tangent frames for normal-mapped procedural geometry. Degenerate UVs use a stable orthogonal frame. */
export declare function computeMeshTangents(data: MeshData): Float32Array;
/** Laya 3.4.2 buffer adapter; POSITION/NORMAL/UV, local range uploads and refreshed bounds. */
export declare class ZhudaDynamicMesh {
    readonly data: MeshData;
    readonly mesh: any;
    readonly vertices: Float32Array;
    readonly stride: number;
    readonly node: any;
    private disposed;
    constructor(data: MeshData, parent?: any);
    updateRange(first: number, count: number): void;
    setPosition(i: number, x: number, y: number, z: number): void;
    private padding;
    /**
     * Grows the bounds by this many metres on every side, and keeps them grown
     * when vertices change. For a material whose vertex hook moves the surface
     * (wind, swell): without it the mesh is culled as if it had not moved.
     */
    padBounds(meters: number): void;
    refreshBounds(): void;
    dispose(): void;
}
/** Stable application IDs survive batch reorder. Laya batches shared mesh/material via GPU instancing. */
export declare class ZhudaInstanceGroup {
    readonly parent: any;
    readonly mesh: any;
    readonly material: any;
    private nodes;
    private disposed;
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
