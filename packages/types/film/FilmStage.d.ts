// Generated from TypeScript source; run npm run types:generate.
export { zhudaBakeKey } from './BakeKey.js';
import { ZhudaPhysicalCameraRig } from '../runtime3d/PhysicalCamera.js';
import { type CinematicFramePixels } from '../runtime3d/CinematicCapture.js';
import type { ZhudaRuntimeSession } from '../runtime3d/Runtime.js';
import { ZhudaModelLibrary } from '../runtime3d/Assets.js';
import type { ZhudaAssetCache } from '../runtime3d/Assets.js';
import { type AssetProvider } from '../runtime3d/AssetProvider.js';
import { ZhudaLensFinish } from '../runtime3d/LensFinish.js';
import { type ZhudaHdrImage } from '../runtime3d/Lightmap.js';
import { type ZhudaBakedTextureSet, type ZhudaTextureRecipe } from '../procedural/TextureRecipe.js';
import { type ZhudaPropDefinition } from '../procedural/PropFactory.js';
import { type ZhudaFilmCamera, type ZhudaFilmLook, type ZhudaFilmScene, type ZhudaResolvedFilmLook } from './FilmScene.js';
import { type ZhudaLookQuality } from './LookQuality.js';
import { type ZhudaAppliedLookParts } from './LiveLook.js';
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
    /** Models placed by the scene, in node order, with the clips each one has. */
    readonly models: readonly {
        id: string;
        asset: string;
        meshes: number;
        lightmap: boolean;
        clips: readonly {
            name: string;
            durationSeconds: number;
        }[];
    }[];
    /**
     * Poses the scene for a shot time in seconds: animation clips, moving
     * models and the lights that follow them. `ZhudaFilmRenderer` calls it for
     * every sample.
     */
    setTime(seconds: number): void;
    /** Moves the camera and sets its lens; ignores depth of field until a render asks for it. */
    setCamera(camera: ZhudaFilmCamera): void;
    /**
     * Draws what the main camera reads (a reflector's mirrored view) for the
     * camera last set. `ZhudaFilmRenderer` calls it before every sample.
     */
    prepare(aspect: number, frame?: {
        width: number;
        height: number;
        index: number;
    }): void;
    /** Hands the stage something to release when it is disposed (before the scene goes). */
    adopt(release: () => void): void;
    /** The look in use, fully resolved (`scene.look` is the authored one). */
    readonly look: ZhudaResolvedFilmLook;
    /**
     * Changes the look while the stage runs (a day passing, weather turning).
     * The look is validated first; a rejected one changes nothing. When only
     * continuous values differ (see `zhudaFilmLookRebuildReason`) they are set
     * in place, cheap enough for every frame, and `'updated'` is returned.
     * Otherwise the look alone (sky, fog, shadows setup, HDR chain, light fog)
     * is rebuilt and `'rebuilt'` is returned. The water glint and light shafts
     * follow the new sun either way. A panorama or environment cannot be added,
     * removed or changed: remount for that.
     */
    setLook(look: ZhudaFilmLook): 'updated' | 'rebuilt';
    /** The quality level in use: 3 is the look as authored. */
    readonly quality: ZhudaLookQuality;
    /**
     * Draws the authored look at a lower cost (see `zhudaLookForQuality`), or
     * back at 3 as authored. `setLook` keeps taking the authored look and the
     * level stays on top of it. A scene with water keeps a bare HDR chain at
     * level 0, because the water draws in HDR.
     */
    setQuality(level: ZhudaLookQuality): 'updated' | 'rebuilt' | 'unchanged';
    /**
     * Changes a light of the scene while it runs: a lamp switched on or off,
     * a flame that flickers. Its glow in the light fog follows. `id` is a
     * `light` node's id; values left out stay as they are.
     */
    setLight(id: string, values: {
        enabled?: boolean;
        intensity?: number;
        color?: readonly [number, number, number];
        range?: number;
    }): void;
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
    /** Decoded sky panoramas (PNG or JPEG); each stage uploads its own texture. */
    readonly pictures: ZhudaAssetCache<ImageBitmap>;
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
    assets?: ZhudaFilmAssets;
    signal?: AbortSignal;
}): Promise<ZhudaFilmStage>;
/**
 * Builds the scene under `rootScene`. Every Laya object is released by
 * `dispose()`, including on a failure part-way through. Scenes that place
 * models load assets first: use `loadZhudaFilmScene`.
 */
export declare function mountZhudaFilmScene(rootScene: any, input: ZhudaFilmScene, options?: ZhudaFilmStageOptions): ZhudaFilmStage;
/** Shadows, procedural sky and fog, all native Laya 3.4.2 features. */
/** Shared with `ZhudaSceneLook`: shadows, sky, fog and the HDR chain of a resolved look. */
export declare function applyResolvedFilmLook(l: any, scene3D: any, camera: any, sun: any, look: ZhudaResolvedFilmLook, cleanups: (() => void)[]): ZhudaAppliedLookParts & {
    finish?: ZhudaLensFinish;
};
export interface ZhudaFilmRenderOptions {
    width: number;
    height: number;
    /** 1 for previews; more samples add anti-aliasing and depth of field. */
    samples?: number;
    /** Depth of field from the camera's fStop (default: on when samples > 1). */
    aperture?: boolean;
    /** Shot time of frame 0 in seconds (default 0): where a still or preview looks. */
    timeSec?: number;
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
