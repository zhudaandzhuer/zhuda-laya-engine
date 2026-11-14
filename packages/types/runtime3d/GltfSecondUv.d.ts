// Generated from TypeScript source; run npm run types:generate.
/**
 * A glTF material's occlusion and emissive textures on the mesh's second set
 * of texture coordinates (`texCoord: 1`): a baked map laid out on its own,
 * apart from the tiling one the colour uses.
 *
 * LayaAir 3.4.2 loads `TEXCOORD_1` into the mesh and carries it to the pixel
 * only for a lightmap; its glTF shader reads every texture by the first set
 * and its loader says "non 0 uv channel unsupported" on the console. The
 * text of two includes and of the glTF shader is changed as LayaAir
 * registers them, and compiles to LayaAir's own code until a material asks.
 * Vendor files are not modified.
 */
/** On a material one of whose textures reads the second set: the set is carried to the pixel. */
export declare const ZHUDA_UV1_DEFINE = "ZHUDA_UV1";
export declare const ZHUDA_OCCLUSION_UV1_DEFINE = "ZHUDA_OCCLUSION_UV1";
export declare const ZHUDA_EMISSION_UV1_DEFINE = "ZHUDA_EMISSION_UV1";
/** `ShadingCommon.glsl` with a varying for the second set. Pure. */
export declare function zhudaPatchSecondUvCommon(text: string): {
    text: string;
    reason?: string;
};
/** `ShadingVertex.glsl` handing the second set to the pixel. Pure. */
export declare function zhudaPatchSecondUvVertex(text: string): {
    text: string;
    reason?: string;
};
/**
 * The glTF shader's fragment program reading occlusion and emission by the
 * second set under their defines. A program without those lines (another
 * shader, or the glTF shader's other passes) comes back as it was. Pure.
 */
export declare function zhudaPatchSecondUvGltf(fragment: string): {
    text: string;
    reason?: string;
};
export interface ZhudaSecondUvStatus {
    /** The three texts were found and changed: a material may ask. */
    ready: boolean;
    /** Why not, when it is not. */
    reason: string | null;
}
/**
 * Changes the two includes and the glTF shader as LayaAir registers them.
 * Must run before `Laya.init`; `ZhudaEngine.boot` calls it. If the vendored
 * text no longer holds an anchor, nothing of that text is changed and
 * `zhudaSecondUvStatus()` says why: such a texture is then drawn with the
 * first set, and the model's report says so.
 */
export declare function installLaya342SecondUv(runtime?: any): boolean;
/** Whether a glTF material may read its occlusion and emissive textures by the second set. */
export declare function zhudaSecondUvStatus(runtime?: any): ZhudaSecondUvStatus;
/** Which set of texture coordinates a glTF texture reference asks for (`KHR_texture_transform` may say another). */
export declare function zhudaGltfTexCoord(info: unknown): number;
