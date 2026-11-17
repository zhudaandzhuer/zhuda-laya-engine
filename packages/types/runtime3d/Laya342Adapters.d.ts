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
/**
 * MEM-01 (docs/plans/records/windows-acceptance/plan.md). LayaAir 3.4.2
 * keys its pipeline state by pass, on WebGPU and on WebGL: a 3D pass by its
 * scene's and camera's data ids, a WebGPU 2D pass by its pass data id. The
 * render context keeps one entry a key (and the key's text) and every render
 * element one more, forever, so each scene or camera ever drawn leaves them
 * behind (two context entries and the long-lived elements' entries a
 * destroyed scene). A key not used for PASS_KEY_FRAMES frames is dropped
 * here, and an element drops the keys the context no longer has once it
 * holds more than the context does. A dropped key that is drawn again is rebuilt by
 * LayaAir's own path, marked changed, so the state it guards is refreshed.
 * Call after `Laya.init` (the backend's classes exist then); what a backend
 * lacks is skipped.
 */
export declare function installLaya342PassCacheBounds(native?: any): void;
/**
 * WP22 (docs/plans/records/threejs-gap-audit/plan.md). LayaAir 3.4.2 takes
 * the brightest light of each kind as the scene's main one, the one that
 * casts the shadow (and, for directional lights, the sun the sky and fog
 * follow): a rim light brighter than a look's sun took the sun's shadow
 * away without a word. A light that casts shadows now comes first; among
 * those, and when none does, the brightest, as before. Call after
 * `Laya.init`. Returns whether it was installed.
 */
export declare function installLaya342ShadowLightFirst(runtime?: any): boolean;
/**
 * LayaAir 3.4.2's WebGL batch agent (`WebGLMeshRenderBatchAgent`) keeps a
 * batch mark for every material and mesh it ever batched
 * (`_batchOpaqueMarks`, by their ids), each with the instanced elements it
 * drew, which hold the material's shader data and a render that drew them;
 * and `WebGLInstanceRenderElement3D` keeps, for every geometry it ever drew
 * instanced, a buffer state with an instance buffer of 1024 matrices (80 KiB
 * of GPU memory). Both are freed only when a scene goes. In a scene that
 * stays while materials and meshes come and go they piled up
 * (`verify:webgpu-churn`, batch kind on WebGL: a material, two shader data,
 * a buffer state and 6 KiB of heap a cycle; MEM-01 of
 * `docs/plans/records/windows-acceptance/`, `docs/plans/records/engine-defects`).
 *
 * Every 30 batch passes a mark is let go when the renders and geometry its
 * elements drew are destroyed and it was not drawn in the last 8 passes, or
 * when it was not drawn for 600: its elements are destroyed and it leaves
 * the agent's table. A render that still names it (one out of sight) keeps a
 * working mark, which makes its elements anew when drawn; LayaAir gives it
 * one from the table again when its batch properties change. A mark never
 * drawn starts its count when the sweep first sees it. An instance buffer
 * state whose geometry is destroyed is destroyed as LayaAir does with the
 * scene, at the start of the next frame. Call after `Laya.init`. Returns
 * whether it was installed.
 */
export declare function installLaya342WebGLBatchMarkSweep(runtime?: any): boolean;
/**
 * Issue #8 (docs/plans/records/webgpu-node-bindings). LayaAir 3.4.2 compiles
 * a shader variant once per set of defines and takes its render-level
 * bindings from the first render that compiled it. A render whose shader
 * reads the reflection probe block (PBR, glTFPBR, a lit surface:
 * `Shader3D._supportReflectionProbe`) but holds no probe when it is drawn
 * shares the variant of one that held it, since the scene's probe adds no
 * define: on WebGPU its layout then lacks the block's binding, the pipeline
 * is invalid and so is every command buffer after it (the frame turns dark);
 * on WebGL the block keeps what another object bound. Such a render is given
 * the scene's probe as it is prepared, as LayaAir's own instanced draw does;
 * the volume manager still places a better one when it next updates. Both
 * backends; call after `Laya.init`. Returns whether anything was patched.
 */
export declare function installLaya342ReflectionProbeFill(runtime?: any): boolean;
/** How many times a render has been given the scene's probe in this runtime. */
export declare function zhudaReflectionProbeFills(runtime?: any): number;
/**
 * GFX-03 (docs/plans/records/windows-acceptance/plan.md). LayaAir 3.4.2's
 * WebGL textures ask for 4x anisotropic filtering from the start, also when
 * they are set to point filtering. Direct3D 11 (ANGLE on Windows) then
 * filters them anyway: an anisotropic sampler ignores the point setting, so
 * pixel art, look-up tables and data textures come out blurred there (and a
 * still picture under temporal anti-aliasing no longer matches one without),
 * while Metal, GLES and WebGPU sample them as asked. A texture's anisotropy
 * is sent as 1 while it is point-filtered and as asked otherwise; what was
 * asked is what `anisoLevel` reports. Call after `Laya.init`; WebGPU has no
 * such class and is left alone.
 */
export declare function installLaya342PointFilterFix(runtime?: any): boolean;
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
 * The define a material carries while its normal map has no mipmaps: specular
 * anti-aliasing then leaves the map's part alone. Set and cleared as a
 * texture is given to a material (`Material.setTexture`, `normalTexture`); a
 * material whose normal map arrives another way can add it itself.
 */
export declare const ZHUDA_NORMAL_NOMIPMAP_DEFINE = "ZHUDA_NORMAL_NOMIPMAP";
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
 * `PBRLighting.glsl` with the widened highlight's fall-off in `specularLobe`,
 * behind `ZHUDA_SPECULAR_AA` (see `SPECULAR_LOBE_PATCHED`). Text that does
 * not hold Laya's `specularAA` and the head of `specularLobe` exactly once
 * each comes back unchanged with the reason. Pure: no Laya needed.
 */
export declare function zhudaPatchSpecularLobe(text: string): {
    text: string;
    reason?: string;
};
/**
 * The forward pass of a physically based shader (Laya's `PBR`, `glTFPBR`, a
 * `ZhudaLitSurfaceMaterial`) with the spread of the normals under the pixel
 * kept as how much shorter the filtered normal is (`zhudaNormalShort`, 0 to
 * 0.9), for `PBRFrag.glsl` to read; the stored normal stays as LayaAir made
 * it. The spread is read one mipmap level
 * above the one the shading uses: the bumps under the pixel and its
 * neighbours, which is steadier from pixel to pixel. It is kept:
 * - only where the map is drawn at less than half its size, fading in from two
 *   texels to a pixel to four (along the way it is most squeezed): nearer
 *   than that its bumps can be seen one by one and are left as they are, and
 *   magnified, the shorter normal halfway between two texels is no sign of
 *   bumps lost; it would draw their grid;
 * - only where the map has mipmaps: a material whose normal map has none
 *   carries `ZHUDA_NORMAL_NOMIPMAP` and compiles none of this, and where the
 *   read one level up comes back the same as the first there was no other
 *   level to read. Without mipmaps the shortness of a normal is chance and the
 *   sparkle is in the read itself, which no roughness repairs;
 * - less 0.004, which is 8-bit rounding, and in step with the normal scale
 *   (a map applied at half strength spreads the normals a quarter as far).
 * WebGL 1 has no `textureSize` and keeps the curvature term alone; so does a
 * material with a detail normal map, which renormalises the blend.
 *
 * Text that is not such a pass comes back unchanged. One that is, but reads
 * its normal map in another way, comes back unchanged with the reason.
 * Pure: no Laya needed.
 */
export declare function zhudaPatchNormalLength(fragment: string): {
    text: string;
    reason?: string;
};
/** Where specular anti-aliasing stands in this runtime. */
export interface ZhudaSpecularAAStatus {
    /** `PBRFrag.glsl` and `PBRLighting.glsl` carry it, behind `ZHUDA_SPECULAR_AA`. */
    patched: boolean;
    /**
     * Every scene made from now on has the define. False unless it was asked
     * for (`installLaya342SpecularAA(runtime, { defaultOn: true })`): a scene
     * turns it on itself with `setZhudaSpecularAA(scene, true)`.
     */
    defaultOn: boolean;
    /** Why it is off, when it is. */
    reason?: string;
    /**
     * Forward passes registered so far that also read the normal map's own
     * filtering: Laya's `PBR` and `glTFPBR` and each `ZhudaLitSurfaceMaterial`
     * shader. Without it they keep the curvature term alone.
     */
    normalMapPasses: number;
    /**
     * Physically based forward passes that read a normal map in a way the
     * patch does not know, each with why: they keep the curvature term alone,
     * and a dense normal map on them sparkles as it did. Each was warned of
     * once on the console.
     */
    normalMapSkipped: string[];
    /**
     * Materials are told when their normal map has no mipmaps
     * (`ZHUDA_NORMAL_NOMIPMAP`). False when this runtime has no
     * `Material.setTextureByIndex` to watch.
     */
    watchesNormalMaps: boolean;
}
export interface ZhudaSpecularAAInstallOptions {
    /**
     * Every `Scene3D` made from now on has it (default false: a scene asks
     * with `setZhudaSpecularAA(scene, true)`). A later call can ask for it;
     * none takes it back.
     */
    defaultOn?: boolean;
}
/**
 * Specular anti-aliasing for Laya 3.4.2's physically based shaders (`PBR`,
 * the glTF `glTFPBR`, and `ZhudaLitSurfaceMaterial`, which all set up their
 * pixel in `PBRFrag.glsl`). A dense normal map seen from afar has more bumps
 * under a pixel than the pixel can show: one pixel catches the sun on a bump
 * and its neighbour misses it, and as the camera moves the highlight
 * sparkles, worst on a phone's small pixels. The highlight is widened by the
 * spread of the normals the map's mipmap has averaged away, and by how far
 * the mesh's own surface turns across the pixel, so the light is spread over
 * the pixel instead.
 *
 * What it leaves alone: a flat surface without a normal map; a normal map
 * seen close up; a normal map without mipmaps (see
 * `ZHUDA_NORMAL_NOMIPMAP_DEFINE`). What it changes besides the sparkle: a
 * highlight narrower than a pixel on a curved surface (a small or polished
 * ball) becomes about a pixel wide and dimmer.
 *
 * Off until a scene asks: what the patch adds is behind the define and is
 * compiled out without it. `setZhudaSpecularAA(scene, true)` turns it on for one
 * scene; `{ defaultOn: true }` here adds the define to Laya's configuration
 * defines, which every `Scene3D` made afterwards copies. It is not the
 * default because of what was measured (docs/plans/records/specular-aa):
 * between two and four texels to a pixel a bumpy metal changes more from
 * frame to frame with it than without, its rim is brighter than the truth,
 * and one more read of the normal map a pixel cost a phone up to 3 ms a
 * frame in the one game measured. If the vendored text no longer holds an
 * anchor, nothing is changed and `zhudaSpecularAAStatus()` (and a console
 * warning) says why.
 * Must run before `Laya.init`, which registers the includes and the shaders.
 */
export declare function installLaya342SpecularAA(runtime?: any, options?: ZhudaSpecularAAInstallOptions): boolean;
/** Where specular anti-aliasing stands (see `installLaya342SpecularAA`). */
export declare function zhudaSpecularAAStatus(runtime?: any): ZhudaSpecularAAStatus;
/**
 * Turns specular anti-aliasing on or off for everything a scene draws. New
 * scenes have it off unless it was installed with `defaultOn`. Every shader
 * of the scene is compiled again for the new
 * set of defines, so switch it when the scene is set up, not every frame.
 * Returns whether it is now on; it cannot be turned on when the patch is not
 * in place (see `zhudaSpecularAAStatus`). Throws when `scene` is not a Laya
 * `Scene3D`, or when LayaAir is not loaded.
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
