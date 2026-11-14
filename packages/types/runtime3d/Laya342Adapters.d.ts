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
 * kept as the length of `inputs.normalTS`, for `PBRFrag.glsl` to read;
 * `getPixelInfo` normalises it as before. The spread is read one mipmap level
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
    /** Every scene made from now on has the define: on by default. */
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
