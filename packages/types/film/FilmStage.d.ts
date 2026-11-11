// Generated from TypeScript source; run npm run types:generate.
import { ZhudaPhysicalCameraRig } from '../runtime3d/PhysicalCamera.js';
import { type CinematicFramePixels } from '../runtime3d/CinematicCapture.js';
import type { ZhudaRuntimeSession } from '../runtime3d/Runtime.js';
import { ZhudaModelLibrary } from '../runtime3d/Assets.js';
import type { ZhudaAssetCache } from '../runtime3d/Assets.js';
import { type AssetProvider } from '../runtime3d/AssetProvider.js';
import { type ZhudaHdrImage } from '../runtime3d/Lightmap.js';
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
    /** Models placed by the scene, in node order. */
    readonly models: readonly {
        id: string;
        asset: string;
        meshes: number;
        lightmap: boolean;
    }[];
    /** Moves the camera and sets its lens; ignores depth of field until a render asks for it. */
    setCamera(camera: ZhudaFilmCamera): void;
    dispose(): void;
}
export interface ZhudaFilmAssetsOptions {
    /** Download and parse deadline per asset (default 30000 ms). */
    timeoutMs?: number;
    /** Unused models and lightmaps kept warm for the next mount (default 16). */
    maxIdle?: number;
}
/**
 * Models and lightmaps a film scene names by logical asset id. One instance
 * serves every stage a host mounts, so an edited scene does not download or
 * parse unchanged assets again. The provider is borrowed.
 */
export declare class ZhudaFilmAssets {
    readonly models: ZhudaModelLibrary;
    /** Decoded lightmap pictures; each stage uploads and owns its own texture. */
    readonly lightmaps: ZhudaAssetCache<ZhudaHdrImage>;
    private disposed;
    constructor(provider: AssetProvider, options?: ZhudaFilmAssetsOptions);
    /** Dispose every stage first. */
    dispose(): void;
}
/**
 * Mounts a scene that places models: loads every model and lightmap through
 * `assets`, then builds the stage. Cancelling `signal`, a timeout or a failed
 * asset releases everything already loaded and rejects; nothing is added to
 * `rootScene` in that case.
 */
export declare function loadZhudaFilmScene(rootScene: any, input: ZhudaFilmScene, options: ZhudaFilmStageOptions & {
    assets: ZhudaFilmAssets;
    signal?: AbortSignal;
}): Promise<ZhudaFilmStage>;
/**
 * Builds the scene under `rootScene`. Every Laya object is released by
 * `dispose()`, including on a failure part-way through. Scenes that place
 * models load assets first: use `loadZhudaFilmScene`.
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
