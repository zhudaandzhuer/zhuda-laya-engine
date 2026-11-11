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
/** The define that switches leaf translucency on for a material. */
export declare const ZHUDA_TRANSLUCENT_DEFINE = "ZHUDA_TRANSLUCENT";
/**
 * Adds light that passes through thin surfaces to Laya 3.4.2's PBR lighting:
 * a leaf lit from behind glows in its own colour instead of going black.
 * Materials opt in with the `ZHUDA_TRANSLUCENT` define; everything else
 * compiles to the upstream code. Must run before `Laya.init`, which registers
 * the lighting include and compiles the PBR shaders from it.
 */
export declare function installLaya342Translucency(runtime?: any): boolean;
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
