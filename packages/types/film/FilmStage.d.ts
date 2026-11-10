// Generated from TypeScript source; run npm run types:generate.
import { ZhudaPhysicalCameraRig } from '../runtime3d/PhysicalCamera.js';
import { type CinematicFramePixels } from '../runtime3d/CinematicCapture.js';
import type { ZhudaRuntimeSession } from '../runtime3d/Runtime.js';
import { type ZhudaBakedTextureSet, type ZhudaTextureRecipe } from '../procedural/TextureRecipe.js';
import { type ZhudaPropDefinition } from '../procedural/PropFactory.js';
import { type ZhudaFilmCamera, type ZhudaFilmScene } from './FilmScene.js';
export interface ZhudaFilmStageOptions {
    /** Props a scene may place, by id. */
    props?: readonly ZhudaPropDefinition<any>[];
    /** Named texture recipes a scene may reference. */
    recipes?: Readonly<Record<string, ZhudaTextureRecipe>>;
    /**
     * Baked texture sets keyed by recipe and size. Pass the same map to the next
     * stage so an edited scene does not bake unchanged recipes again.
     */
    bakeCache?: Map<string, ZhudaBakedTextureSet>;
}
export interface ZhudaFilmStage {
    readonly scene: ZhudaFilmScene;
    readonly scene3D: any;
    readonly camera: any;
    readonly lens: ZhudaPhysicalCameraRig;
    /** Material names in use and how many meshes each one draws. */
    readonly batches: readonly {
        material: string;
        meshes: number;
    }[];
    /** Moves the camera and sets its lens; ignores depth of field until a render asks for it. */
    setCamera(camera: ZhudaFilmCamera): void;
    dispose(): void;
}
/**
 * Builds the scene under `rootScene`. Every Laya object is released by
 * `dispose()`, including on a failure part-way through.
 */
export declare function mountZhudaFilmScene(rootScene: any, input: ZhudaFilmScene, options?: ZhudaFilmStageOptions): ZhudaFilmStage;
export interface ZhudaFilmRenderOptions {
    width: number;
    height: number;
    /** 1 for previews; more samples add anti-aliasing and depth of field. */
    samples?: number;
    /** Depth of field from the camera's fStop (default: on when samples > 1). */
    aperture?: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
}
/**
 * Renders frames of a mounted stage. The runtime is paused for the renderer's
 * lifetime and restored on `dispose()`.
 */
export declare class ZhudaFilmRenderer {
    private readonly stage;
    private readonly runtime;
    private readonly wasPaused;
    private disposed;
    constructor(stage: ZhudaFilmStage, runtime: ZhudaRuntimeSession);
    /** Renders one frame with the camera given (or the scene camera). */
    render(options: ZhudaFilmRenderOptions & {
        camera?: ZhudaFilmCamera;
        index?: number;
        fps?: number;
    }): Promise<CinematicFramePixels>;
    dispose(): void;
}
/** Waits for the engine to settle before the first capture (helper for hosts). */
export declare function flushZhudaFilmFrames(count?: number): void;
