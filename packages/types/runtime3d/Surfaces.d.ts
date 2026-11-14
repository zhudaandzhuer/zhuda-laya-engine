// Generated from TypeScript source; run npm run types:generate.
export interface SurfaceMaterialSpec {
    /**
     * `pbr`: LayaAir's standard physically based material. `unlit`: colour and
     * texture only. `physical`: LayaAir's glTF shader (`glTFPBR`), the one a
     * glTF model's materials use, which adds sheen, iridescence, an index of
     * refraction and specular tint, light through the surface (`transmission`,
     * with `volume`), clear-coat maps and a turned highlight. It is registered by
     * LayaAir's glTF module (`laya.gltf.js`, the `gltf` feature, browser SDK
     * profiles `3d-gltf` and `3d-gltf-webgpu`) when `Laya.init` runs; without it
     * a physical surface is refused.
     *
     * Every colour here is a display colour (sRGB, as a colour picker gives it
     * and as LayaAir's `Color` takes it); the shader gets it linear. Alpha and
     * the other numbers are taken as they are.
     */
    type: 'pbr' | 'unlit' | 'physical';
    /** Base colour and alpha, 0..1 each (default white). */
    color?: readonly [number, number, number, number];
    metallic?: number;
    roughness?: number;
    emission?: readonly [number, number, number];
    /**
     * A clear layer over the surface (lacquer, varnish, a wet sheen): how much,
     * 0..1 (default 0, none). Physically based surfaces only (`pbr`, `physical`).
     */
    clearCoat?: number;
    /**
     * Roughness of that layer, 0..1 (default 0.1). On a `physical` surface it
     * needs `clearCoat` above 0.
     */
    clearCoatRoughness?: number;
    /**
     * `physical`: how strongly `textures.clearCoatNormal` bends the layer, 0..10
     * (default 1). Needs `clearCoat` above 0.
     */
    clearCoatNormalScale?: number;
    /**
     * How far the highlight is drawn out, 0..1 (default 0): brushed metal,
     * hair, satin. It becomes a band across the mesh's tangent (its U
     * direction): round a ball turned on a lathe, a ring about its axis.
     */
    anisotropy?: number;
    /**
     * Turns the drawn-out highlight in the surface, degrees, any angle
     * (default 0: along the tangent, 90: along the bitangent). `pbr` and
     * `physical`. Needs `anisotropy` above 0. Written to the shader as it is:
     * LayaAir's own setter keeps the angle between 0 and 1 radian.
     */
    anisotropyRotationDeg?: number;
    /** `physical`: how strongly `textures.normal` bends the surface, 0..10 (default 1). */
    normalScale?: number;
    /** `physical`: how much `textures.occlusion` darkens, 0..1 (default 1). */
    occlusionStrength?: number;
    /**
     * `physical`: cloth and velvet, a soft light that rises where the surface
     * turns away from the eye. `color` 0..1 each; `roughness` 0..1
     * (default 0.5).
     */
    sheen?: {
        color: readonly [number, number, number];
        roughness?: number;
    };
    /**
     * `physical`: a thin film on the surface (soap, oil, a beetle's shell):
     * colours that change with the angle it is seen at. `factor` 0..1 (default
     * 1); `ior` of the film 1..3 (default 1.3); `thicknessRange` in nanometres,
     * 0..2000 (default [100, 400]). Without `textures.iridescenceThickness`
     * the film is `thicknessRange[1]` thick everywhere.
     */
    iridescence?: {
        factor?: number;
        ior?: number;
        thicknessRange?: readonly [number, number];
    };
    /**
     * `physical`: index of refraction of a dielectric, 1..3 (default 1.5: a
     * reflectance of 4 % head on). Water 1.33, glass 1.5, diamond 2.42. It
     * also bends the light through a `transmission` surface with a `volume`.
     */
    ior?: number;
    /**
     * `physical`: the strength (`factor` 0..1, default 1) and tint (`color`
     * 0..1 each, default white) of a dielectric's reflection.
     */
    specular?: {
        factor?: number;
        color?: readonly [number, number, number];
    };
    /**
     * `physical`: light through the surface (glass, water, gems): `factor`
     * 0..1 of what is behind it shows through, tinted by `color`. It reads
     * the camera's picture of the opaque scene: the camera needs that pass
     * (`configureSurfacePasses(camera, [surfaceMaterialPasses(spec)], …)`):
     * without it nothing shows through and the surface is drawn as black
     * glass, with its reflections only. The surface is drawn after the opaque
     * scene (render queue 3000), so other transparent and transmissive
     * surfaces do not show through it. `volume` gives it a thickness, in the
     * mesh's own units (the node's scale applies), that bends what is behind
     * (by `ior`) and absorbs light: after `attenuationDistance` (default:
     * none absorbed) the light left is `attenuationColor` (above 0 and at
     * most 1 each, default white).
     */
    transmission?: {
        factor: number;
        volume?: {
            thickness: number;
            attenuationColor?: readonly [number, number, number];
            attenuationDistance?: number;
        };
    };
    /**
     * Textures. `pbr`: `albedo`, `normal`, `metallicGloss` (R metallic, A
     * smoothness) and `emission`. `physical` reads them the glTF way:
     * `albedo`, `normal` (read as `pbr` reads it), `metallicRoughness`
     * (G roughness, B metallic), `occlusion` (R), `emission`, and for its
     * features: `clearCoat` (R), `clearCoatRoughness` (G), `clearCoatNormal`,
     * `sheenColor` (RGB), `sheenRoughness` (A), `iridescence` (R),
     * `iridescenceThickness` (G, across `thicknessRange`), `transmission`
     * (R), `thickness` (G), `specular` (A), `specularColor` (RGB) and
     * `anisotropy` (RG direction, B strength). A feature's textures need the
     * feature switched on; a slot left `undefined` or `null` is empty. Colour
     * textures are sRGB (`createSurfaceTexture` role `color`), the others
     * linear. A `physical` surface may fill six slots at most
     * (`physicalSurfaceTextureLimit`), and its `normal` texture needs a mesh
     * with tangents.
     */
    textures?: {
        albedo?: any;
        normal?: any;
        metallicGloss?: any;
        emission?: any;
        metallicRoughness?: any;
        occlusion?: any;
        clearCoat?: any;
        clearCoatRoughness?: any;
        clearCoatNormal?: any;
        sheenColor?: any;
        sheenRoughness?: any;
        iridescence?: any;
        iridescenceThickness?: any;
        transmission?: any;
        thickness?: any;
        specular?: any;
        specularColor?: any;
        anisotropy?: any;
    };
    blend?: 'opaque' | 'alpha' | 'additive' | 'cutout';
    alphaCutoff?: number;
    doubleSided?: boolean;
    depthWrite?: boolean;
}
/** LayaAir's glTF shader, registered by `laya.gltf.js` at `Laya.init`. */
export declare const ZHUDA_PHYSICAL_SHADER = "glTFPBR";
/** Where a physical surface is drawn, as far as it changes how many textures it may carry. */
export interface PhysicalSurfaceUse {
    /**
     * The renderer carries a baked lightmap (`true`: one sampler more), with a
     * direction picture (`'directional'`: two more). Default none.
     */
    lightmap?: boolean | 'directional';
}
/**
 * How many texture slots a `physical` surface may fill and still be drawn:
 * 6, or 5 on a lightmapped renderer, 4 with a directional lightmap.
 *
 * A shader stage holds 16 samplers and every filled slot takes one, the
 * same picture in two slots twice. A lit scene takes 10 of them on WebGPU
 * (shadow maps, the point-shadow picture, light lists, the camera's
 * pictures, the environment); WebGL binds only what the scene uses, so the
 * WebGPU count is the limit for both. Past it the surface is not drawn at
 * all: WebGPU refuses its pipeline and WebGL its shader, and LayaAir only
 * logs it. Counted with every light and shadow the engine has. Not counted:
 * the animation texture of LayaAir's simple skinned mesh, one sampler more.
 */
export declare function physicalSurfaceTextureLimit(use?: PhysicalSurfaceUse): number;
/**
 * Problems with a `physical` surface spec, one line each; an empty list
 * means `createSurfaceMaterial` takes it. Pure: it does not need LayaAir.
 * It counts the filled texture slots against `physicalSurfaceTextureLimit`;
 * `createSurfaceMaterial` checks without `use`, so a surface for a
 * lightmapped renderer is checked here with `use` first.
 */
export declare function validatePhysicalSurfaceSpec(s: SurfaceMaterialSpec, use?: PhysicalSurfaceUse): string[];
/**
 * The camera passes a surface needs, for `configureSurfacePasses`: a
 * `physical` surface with `transmission` reads the camera's picture of the
 * opaque scene (`opaqueColor`).
 */
export declare function surfaceMaterialPasses(s: SurfaceMaterialSpec): SurfacePassRequirements;
/**
 * A display (sRGB) colour channel as light, the way LayaAir's `Color` does it
 * (`gammaToLinearSpace`, values above 1 raised to 2.4).
 */
export declare function zhudaSrgbToLinear(value: number): number;
/** Degrees to the radians LayaAir's anisotropy rotation takes, folded into -180..180 degrees. */
export declare function zhudaAnisotropyRadians(degrees: number): number;
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
