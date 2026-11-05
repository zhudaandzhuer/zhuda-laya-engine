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
