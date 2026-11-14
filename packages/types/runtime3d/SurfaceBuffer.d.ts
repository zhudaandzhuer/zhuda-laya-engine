// Generated from TypeScript source; run npm run types:generate.
/**
 * What every pixel's surface is, beside its colour: LayaAir 3.4.2 can draw
 * a scene's opaque things into more than one picture at once (`GBuffer`,
 * `Camera.opaqueMRT`): the world normal, and the metalness, roughness and
 * occlusion. Its standard PBR material writes them; the shader glTF models
 * are drawn with does not, so a scene of models has empty pictures.
 *
 * `installLaya342SurfaceBuffer` changes that shader's include as text
 * before LayaAir compiles it, so that it writes what the standard material
 * writes. The call compiles to nothing while a camera asks for no such
 * picture: a scene that uses none draws as before.
 *
 * An effect asks a camera for the pictures through LayaAir's own
 * `getCameraOpaqueMRTRequirements` (see `ZhudaScreenReflections`,
 * `surfaces`). A pixel a material did not write has alpha 0 in them: an
 * effect has to treat it as unknown.
 */
/**
 * Teaches the glTF shader to write LayaAir's surface pictures. Must run
 * before `Laya.init` (`ZhudaEngine.boot` does it). Returns false when there
 * is no runtime to patch.
 */
export declare function installLaya342SurfaceBuffer(runtime?: any): boolean;
/** Whether glTF models write the surface pictures in this runtime (after `Laya.init`). */
export declare function zhudaSurfaceBufferInstalled(runtime?: any): boolean;
/** Whether this runtime's LayaAir has the surface pictures at all. */
export declare function zhudaSurfaceBufferSupported(runtime?: any): boolean;
