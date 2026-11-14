// Generated from TypeScript source; run npm run types:generate.
/** Version-specific sizing seam. Native retinal sizing preserves design units
 * and scales the stage transform, including pointer conversion and text caches.
 * Override the browser ratio only during the synchronous resize so a render
 * quality cap never changes the browser/device measurement seen by consumers. */
export declare function resizeLaya342Stage(runtime: {
    Browser: object;
    systemTimer?: {
        clearCallLater(caller: object, method: (...args: never[]) => unknown): void;
    };
    stage: {
        size(width: number, height: number): unknown;
        setScreenSize(width: number, height: number): void;
        updateCanvasSize?: (...args: never[]) => unknown;
        _canvasTransform?: {
            a: number;
            b: number;
            c: number;
            d: number;
            tx: number;
            ty: number;
        };
    };
}, width: number, height: number, designWidth: number, designHeight: number, dpr: number, canvas?: HTMLCanvasElement): void;
/** Laya 3.4.2 allocates two process-owned fallback textures but releases only depth.
 * Keep this version-specific repair isolated from consumer scene code. */
export declare function installLaya342LifecycleFix(runtime?: any): void;
/** Model ownership seam: native Node.destroy queues component teardown for the
 * next frame. Finish only this tree's queued components before releasing its
 * cache lease; otherwise zero-reference clips/meshes survive resource disposal.
 * Never drain the global driver (which could destroy unrelated consumer nodes).
 */
export declare function destroyLaya342ModelTree(node: any, runtime?: any): void;
/**
 * glTF multiplies a mesh's `COLOR_0` into its base colour. Laya 3.4.2's glTF
 * shader does so only for a material that carries `ENABLEVERTEXCOLOR`, and its
 * loader never sets it: baked shade, wet bands and tints were silently dropped.
 * Switches it on for the materials of every mesh in the tree that has a colour
 * channel. Returns how many materials changed.
 */
export declare function enableLaya342VertexColors(node: any, runtime?: any): number;
/** The define that switches leaf translucency on for a material. */
export declare const ZHUDA_TRANSLUCENT_DEFINE = "ZHUDA_TRANSLUCENT";
/**
 * The shadow caster's vertex code with the normal bias kept off faces that
 * look away from the light; text that does not hold the upstream line comes
 * back unchanged. Pure: no Laya needed.
 */
export declare function zhudaPatchShadowBias(text: string): string;
/**
 * Laya 3.4.2 draws a shadow caster a little smaller than it is: every vertex
 * is pulled back along its normal, most where the surface lies along the
 * light. A face that looks away from the light is pulled the full distance,
 * which moves it toward the light: the underside of a thin slab (a paved
 * road, a floor, a roof) rises above its top and the top lies in its own
 * shadow all day. With this the pull fades out as a face turns away from the
 * light. Must run before `Laya.init`, which registers the include.
 */
export declare function installLaya342ShadowBias(runtime?: any): boolean;
/**
 * Adds light that passes through thin surfaces to Laya 3.4.2's PBR lighting:
 * a leaf lit from behind glows in its own colour instead of going black.
 * Materials opt in with the `ZHUDA_TRANSLUCENT` define; everything else
 * compiles to the upstream code. Must run before `Laya.init`, which registers
 * the lighting include and compiles the PBR shaders from it.
 */
export declare function installLaya342Translucency(runtime?: any): boolean;
/** The define that turns specular anti-aliasing on for a scene (or one material). */
export declare const ZHUDA_SPECULAR_AA_DEFINE = "ZHUDA_SPECULAR_AA";
/**
 * `PBRFrag.glsl` with specular anti-aliasing in `getPixelInfo`, behind
 * `ZHUDA_SPECULAR_AA`; the surface becomes `inout` so the widened roughness
 * reaches the lights, the environment lookup and the G-buffer. Text that does
 * not hold each anchor exactly once comes back unchanged with the reason.
 * Pure: no Laya needed.
 */
export declare function zhudaPatchSpecularAA(text: string): {
    text: string;
    reason?: string;
};
/**
 * The forward pass of a physically based shader (Laya's `PBR`, `glTFPBR`, a
 * `ZhudaLitSurfaceMaterial`) with the length of the filtered normal kept in
 * `inputs.normalTS`, for `PBRFrag.glsl` to read; `getPixelInfo` normalises it
 * as before. Only where the map is drawn smaller than it is (one texel to a
 * pixel or more): magnified, a texel spans pixels, and the shorter normal
 * halfway between two texels is no sign of bumps lost; it would draw their
 * grid. WebGL 1 has no `textureSize` and keeps the derivative term alone; so
 * does a material with a detail normal map, which renormalises the blend.
 * Any other text comes back unchanged. Pure: no Laya needed.
 */
export declare function zhudaPatchNormalLength(fragment: string): string;
/** Where specular anti-aliasing stands in this runtime. */
export interface ZhudaSpecularAAStatus {
    /** `PBRFrag.glsl` carries the call, behind `ZHUDA_SPECULAR_AA`. */
    patched: boolean;
    /** Every scene made from now on has the define: on by default. */
    defaultOn: boolean;
    /** Why it is off, when it is. */
    reason?: string;
    /**
     * Forward passes registered so far that also read the normal map's own
     * filtering: Laya's `PBR` and `glTFPBR` and each `ZhudaLitSurfaceMaterial`
     * shader. Without it they keep the derivative term alone.
     */
    normalMapPasses: number;
}
/**
 * Specular anti-aliasing for Laya 3.4.2's physically based shaders (`PBR`,
 * the glTF `glTFPBR`, and `ZhudaLitSurfaceMaterial`, which all set up their
 * pixel in `PBRFrag.glsl`). A dense normal map seen from afar has more bumps
 * under a pixel than the pixel can show: one pixel catches the sun on a bump
 * and its neighbour misses it, and as the camera moves the highlight
 * sparkles and crawls, worst on a phone's small pixels. The roughness is
 * raised where the normal turns quickly from pixel to pixel and where the
 * map's mipmap has averaged bumps away, so the light those bumps would have
 * scattered is spread over the pixel instead. Flat and gently curved
 * surfaces, and maps seen close up, keep their roughness.
 *
 * On by default: the define is added to Laya's configuration defines, which
 * every new `Scene3D` copies. `setZhudaSpecularAA(scene, false)` turns it off
 * for one scene. If the vendored text no longer holds an anchor, nothing is
 * changed and `zhudaSpecularAAStatus()` (and a console warning) says why.
 * Must run before `Laya.init`, which registers the includes and the shaders.
 */
export declare function installLaya342SpecularAA(runtime?: any): boolean;
/** Where specular anti-aliasing stands (see `installLaya342SpecularAA`). */
export declare function zhudaSpecularAAStatus(runtime?: any): ZhudaSpecularAAStatus;
/**
 * Turns specular anti-aliasing on or off for everything a scene draws. New
 * scenes have it on. Every shader of the scene is compiled again for the new
 * set of defines, so switch it when the scene is set up, not every frame.
 * Returns whether it is now on; it cannot be turned on when the patch is not
 * in place (see `zhudaSpecularAAStatus`).
 */
export declare function setZhudaSpecularAA(scene: any, enabled: boolean, runtime?: any): boolean;
/**
 * Call before drawing a scene by hand (`Camera.drawRenderTextureByScene`)
 * from inside an update: a mirror, a depth picture, a capture.
 *
 * Laya 3.4.2 gives renderers their reflection probe in the scene's own
 * update. A hand-drawn pass in a scene that is on the stage skips that step,
 * so a renderer added since the last frame is drawn without a probe. Its
 * shaders are then compiled without the probe's uniform block; on WebGPU the
 * probe's uniforms are added to the shared material map instead, and every
 * pass of that shader compiled afterwards fails ("nameless block contains a
 * member that already has a name", "u_IBLTex_Texture: redefinition").
 * This runs the scene's own probe assignment; it does nothing when no
 * renderer is waiting.
 */
export declare function prepareLaya342ManualDraw(scene: any): void;
