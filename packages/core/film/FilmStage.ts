/**
 * Browser side of film scenes: mounts a validated `ZhudaFilmScene` into Laya
 * and renders it through `ZhudaCinematicCapture`, so previews, review shots
 * and final frames share one deterministic path. Requires the Laya runtime.
 */
import { zhudaBakeKey } from './BakeKey.ts';
export { zhudaBakeKey } from './BakeKey.ts';
import { ZhudaEngine, Zhuda3D } from '../DeclarativeSDK.ts';
import {
  ZhudaDynamicMesh,
  computeMeshTangents,
  createSurfaceMaterial,
  disposeSurfaceMaterial,
  type MeshData,
} from '../runtime3d/Surfaces.ts';
import { ZhudaPhysicalCameraRig } from '../runtime3d/PhysicalCamera.ts';
import { ZhudaFilmicPipeline } from '../runtime3d/Filmic.ts';
import {
  ZhudaCinematicCapture,
  type CinematicFramePixels,
  type CinematicLinearChain,
} from '../runtime3d/CinematicCapture.ts';
import type { ZhudaRuntimeSession } from '../runtime3d/Runtime.ts';
import { ZhudaModelLibrary, type AssetLease, type ModelInstance } from '../runtime3d/Assets.ts';
import type { ZhudaAssetCache } from '../runtime3d/Assets.ts';
import { createProviderAssetCache, type AssetProvider } from '../runtime3d/AssetProvider.ts';
import { ZhudaReflectiveSurface } from '../shaders/ReflectiveSurface.ts';
import { ZhudaWaterSurface } from '../shaders/WaterSurface.ts';
import { mountZhudaModel } from '../runtime3d/ModelPlacements.ts';
import { ZhudaLightFog } from '../runtime3d/LightFog.ts';
import { ZhudaScreenReflections } from '../runtime3d/ScreenReflections.ts';
import { zhudaDecodeColor } from './ColorValues.ts';
import { ZhudaPointShadow } from '../runtime3d/PointShadow.ts';
import { ZhudaProbeVolume, zhudaProbeCounts } from '../runtime3d/ProbeVolume.ts';
import { ZhudaEnvironmentProbe } from '../runtime3d/EnvironmentProbe.ts';
import { ZhudaLensFinish } from '../runtime3d/LensFinish.ts';
import { ZhudaModelInspector } from '../runtime3d/ModelInspector.ts';
import { ZhudaModelAnimationSampler } from '../runtime3d/ModelAnimationSampler.ts';
import {
  createZhudaLightmap,
  decodeRadianceHdr,
  type ZhudaHdrImage,
} from '../runtime3d/Lightmap.ts';
import {
  bakeZhudaTextureSet,
  type ZhudaBakedTextureSet,
  type ZhudaTextureRecipe,
} from '../procedural/TextureRecipe.ts';
import { createZhudaProceduralMaterial } from '../procedural/ProceduralMaterial.ts';
import {
  createZhudaBoxMesh,
  createZhudaExtrudeMesh,
  createZhudaLatheMesh,
  mergeZhudaMeshes,
  transformZhudaMesh,
} from '../procedural/Geometry.ts';
import {
  ZhudaPropRegistry,
  mergeZhudaPlacedProps,
  instantiateZhudaPropBatches,
  type ZhudaPropDefinition,
} from '../procedural/PropFactory.ts';
import {
  parseZhudaFilmScene,
  resolveZhudaFilmCamera,
  resolveZhudaFilmLook,
  sampleZhudaFilmMotion,
  type ZhudaFilmCamera,
  type ZhudaFilmMaterial,
  type ZhudaFilmLook,
  type ZhudaFilmScene,
  type ZhudaResolvedFilmLook,
  zhudaFilmLookRebuildReason,
  zhudaFilmBounceBox,
} from './FilmScene.ts';
import { zhudaLookForQuality, type ZhudaLookQuality } from './LookQuality.ts';
import {
  ZhudaHemisphereAmbientSlot,
  updateZhudaLookInPlace,
  zhudaSunRadiance,
  zhudaTowardSun,
  type ZhudaAppliedLookParts,
} from './LiveLook.ts';

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
  readonly batches: readonly { material: string; meshes: number }[];
  /** Models placed by the scene, in node order, with the clips each one has. */
  readonly models: readonly {
    id: string;
    asset: string;
    meshes: number;
    lightmap: boolean;
    clips: readonly { name: string; durationSeconds: number }[];
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
  prepare(aspect: number, frame?: { width: number; height: number; index: number }): void;
  /** Hands the stage something to release when it is disposed (before the scene goes). */
  adopt(release: () => void): void;
  /**
   * The HDR chain's handle for averaging the samples of a frame in
   * scene-linear light; undefined for a look without a grade.
   */
  linearChain(): CinematicLinearChain | undefined;
  /** What stands in the scene (props, boxes, shapes) as world axis-aligned boxes. */
  readonly solids: readonly { readonly min: number[]; readonly max: number[] }[];
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
  setLight(
    id: string,
    values: {
      enabled?: boolean;
      intensity?: number;
      color?: readonly [number, number, number];
      range?: number;
    },
  ): void;
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
export class ZhudaFilmAssets {
  readonly models: ZhudaModelLibrary;
  /** Decoded lightmap pictures; each stage uploads and owns its own texture. */
  readonly lightmaps: ZhudaAssetCache<ZhudaHdrImage>;
  /** Decoded sky panoramas (PNG or JPEG); each stage uploads its own texture. */
  readonly pictures: ZhudaAssetCache<ImageBitmap>;
  private disposed = false;
  constructor(provider: AssetProvider, options: ZhudaFilmAssetsOptions = {}) {
    const maxIdle = options.maxIdle ?? 16;
    this.models = new ZhudaModelLibrary({
      provider,
      maxIdle,
      timeoutMs: options.timeoutMs ?? 30_000,
    });
    this.lightmaps = createProviderAssetCache(
      provider,
      (asset) => decodeRadianceHdr(asset.bytes),
      () => {},
      maxIdle,
    );
    this.pictures = createProviderAssetCache(
      provider,
      (asset) =>
        createImageBitmap(new Blob([new Uint8Array(asset.bytes)]), {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        }),
      (bitmap) => bitmap.close(),
      2,
    );
  }
  /** Dispose every stage first. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.models.dispose();
    } finally {
      this.lightmaps.dispose();
      this.pictures.dispose();
    }
  }
}

interface LoadedFilmModel {
  instance: ModelInstance;
  lightmap?: AssetLease<ZhudaHdrImage>;
  direction?: AssetLease<ZhudaHdrImage>;
}

function releaseLoaded(loaded: Iterable<LoadedFilmModel>) {
  for (const item of loaded) {
    try {
      item.instance.dispose();
    } catch {
      // Keep releasing the rest.
    }
    item.lightmap?.release();
    item.direction?.release();
  }
}

/**
 * Mounts a scene that places models: loads every model and lightmap through
 * `assets`, then builds the stage. Cancelling `signal`, a timeout or a failed
 * asset releases everything already loaded and rejects; nothing is added to
 * `rootScene` in that case.
 */
export async function loadZhudaFilmScene(
  rootScene: any,
  input: ZhudaFilmScene,
  options: ZhudaFilmStageOptions & { assets?: ZhudaFilmAssets; signal?: AbortSignal },
): Promise<ZhudaFilmStage> {
  const registry = new ZhudaPropRegistry();
  for (const definition of options.props ?? []) registry.register(definition);
  const scene = parseZhudaFilmScene(input, {
    props: registry.ids(),
    recipes: Object.keys(options.recipes ?? {}),
  });
  const nodes = scene.nodes.flatMap((node) => (node.type === 'model' ? [node] : []));
  if (nodes.length && !options.assets)
    throw Error('Film scene places models; give loadZhudaFilmScene an assets library');
  const library = options.assets as ZhudaFilmAssets;
  const results = await Promise.allSettled(
    nodes.map(async (node): Promise<LoadedFilmModel> => {
      const picture = (id: string | undefined) =>
        id === undefined ? undefined : library.lightmaps.acquire(id, { signal: options.signal });
      const [instance, lightmap, direction] = await Promise.allSettled([
        library.models.instantiate(node.asset, { signal: options.signal }),
        picture(node.lightmap),
        picture(node.lightmapDirection),
      ]);
      if (
        instance.status === 'fulfilled' &&
        lightmap.status === 'fulfilled' &&
        direction.status === 'fulfilled'
      )
        return { instance: instance.value, lightmap: lightmap.value, direction: direction.value };
      if (instance.status === 'fulfilled') instance.value.dispose();
      if (lightmap.status === 'fulfilled') lightmap.value?.release();
      if (direction.status === 'fulfilled') direction.value?.release();
      const failed = [instance, lightmap, direction].find(
        (result) => result.status === 'rejected',
      ) as PromiseRejectedResult;
      const which =
        instance.status === 'rejected'
          ? node.asset
          : lightmap.status === 'rejected'
            ? node.lightmap
            : node.lightmapDirection;
      if (options.signal?.aborted) throw failed.reason;
      throw Error(
        `Film scene model ${node.id}: cannot load ${which}: ${failed.reason?.message ?? failed.reason}`,
        { cause: failed.reason },
      );
    }),
  );
  const loaded = new Map<string, LoadedFilmModel>();
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') loaded.set(nodes[i].id, result.value);
  });
  const failure = results.find((result) => result.status === 'rejected');
  if (failure || options.signal?.aborted) {
    releaseLoaded(loaded.values());
    if (options.signal?.aborted)
      throw options.signal.reason ?? new DOMException('Film scene load cancelled', 'AbortError');
    throw (failure as PromiseRejectedResult).reason;
  }
  // The stage owns the loaded assets from here, including on a failed mount.
  const resolved = resolveZhudaFilmLook(scene.look);
  let panorama: AssetLease<ImageBitmap> | undefined;
  if (resolved.panorama) {
    if (!options.assets) {
      releaseLoaded(loaded.values());
      throw Error('Film scene uses a panorama; give loadZhudaFilmScene an assets library');
    }
    try {
      panorama = await options.assets.pictures.acquire(resolved.panorama.asset, {
        signal: options.signal,
      });
    } catch (error) {
      releaseLoaded(loaded.values());
      if (options.signal?.aborted) throw error;
      throw Error(
        `Film scene panorama: cannot load ${resolved.panorama.asset}: ${(error as Error)?.message ?? error}`,
        { cause: error },
      );
    }
  }
  let stage: ZhudaFilmStage;
  try {
    stage = buildFilmStage(rootScene, scene, options, loaded);
  } catch (error) {
    panorama?.release();
    throw error;
  }
  if (panorama && resolved.panorama) {
    const lease = panorama;
    stage.adopt(() => lease.release());
    try {
      applyPanorama(stage, lease.value, resolved.panorama);
    } catch (error) {
      stage.dispose();
      throw error;
    }
  }
  const environment = resolved.environment;
  if (environment) {
    try {
      // New meshes are registered on the next native frame; draw two before
      // looking at the surroundings.
      ZhudaEngine.flushRenderFrames(2);
      const probe = new ZhudaEnvironmentProbe(stage.scene3D);
      stage.adopt(() => probe.dispose());
      // The reflecting surface of a reflector is an overlay, not scenery.
      await probe.capture({ ...environment, excludedLayers: [29, 30] }, options.signal);
    } catch (error) {
      stage.dispose();
      throw error;
    }
  }
  const bounce = resolved.bounceLight;
  const box = bounce
    ? bounce.min && bounce.max
      ? { min: bounce.min, max: bounce.max }
      : zhudaFilmBounceBox(scene)
    : null;
  if (bounce && box) {
    try {
      ZhudaEngine.flushRenderFrames(2);
      const volume = new ZhudaProbeVolume(stage.scene3D, {
        min: box.min,
        max: box.max,
        counts: zhudaProbeCounts(box.min, box.max, bounce.spacing),
        strength: bounce.strength,
        excludedLayers: [29, 30],
        solids: stage.solids,
      });
      stage.adopt(() => volume.dispose());
      await volume.bake(options.signal);
    } catch (error) {
      stage.dispose();
      throw error;
    }
  }
  return stage;
}

/**
 * Builds the scene under `rootScene`. Every Laya object is released by
 * `dispose()`, including on a failure part-way through. Scenes that place
 * models load assets first: use `loadZhudaFilmScene`.
 */
export function mountZhudaFilmScene(
  rootScene: any,
  input: ZhudaFilmScene,
  options: ZhudaFilmStageOptions = {},
): ZhudaFilmStage {
  if (Array.isArray(input?.nodes) && input.nodes.some((node) => node?.type === 'model'))
    throw Error('Film scene places models; mount it with loadZhudaFilmScene');
  if (input?.look?.environment)
    throw Error('Film scene captures an environment; mount it with loadZhudaFilmScene');
  if (input?.look?.panorama)
    throw Error('Film scene uses a panorama; mount it with loadZhudaFilmScene');
  return buildFilmStage(rootScene, input, options, new Map());
}

function buildFilmStage(
  rootScene: any,
  input: ZhudaFilmScene,
  options: ZhudaFilmStageOptions,
  loaded: Map<string, LoadedFilmModel>,
): ZhudaFilmStage {
  const cleanups: (() => void)[] = [() => releaseLoaded(loaded.values())];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch {
        // Keep releasing the rest.
      }
    }
  };
  try {
    return buildFilmStageContents(rootScene, input, options, loaded, cleanups, dispose);
  } catch (error) {
    dispose();
    throw error;
  }
}

function buildFilmStageContents(
  rootScene: any,
  input: ZhudaFilmScene,
  options: ZhudaFilmStageOptions,
  loaded: Map<string, LoadedFilmModel>,
  cleanups: (() => void)[],
  dispose: () => void,
): ZhudaFilmStage {
  const l = (globalThis as any).Laya;
  if (!l?.Scene3D) throw Error('Film scenes need the Laya 3D runtime');
  const registry = new ZhudaPropRegistry();
  for (const definition of options.props ?? []) registry.register(definition);
  const recipes = options.recipes ?? {};
  const scene = parseZhudaFilmScene(input, {
    props: registry.ids(),
    recipes: Object.keys(recipes),
  });
  const bakeCache = options.bakeCache ?? new Map<string, ZhudaBakedTextureSet>();
  let look = resolveZhudaFilmLook(scene.look);
  let currentScene = scene;
  const materials = new Map<string, any>();
  {
    const scene3D = Zhuda3D.createScene3D(rootScene, { ambientColor: [...look.ambient, 1] });
    cleanups.push(() => scene3D.destroy(true));
    const hemisphere = new ZhudaHemisphereAmbientSlot(scene3D);
    cleanups.push(() => hemisphere.release());
    hemisphere.set(look.ambient, look.ambientGround);
    const camera = Zhuda3D.createCamera(scene3D, {
      position: [0, 0, 0],
      clearColor: [...look.sky, 1],
      near: 0.05,
      far: 4000,
    });
    const sun = Zhuda3D.createDirectionalLight(scene3D, {
      rotationEuler: [-look.sun.elevationDeg, look.sun.azimuthDeg, 0],
      intensity: look.sun.intensity,
      color: [...look.sun.color, 1] as [number, number, number, number],
    });
    // The look's own objects (sky, fog, shadow setup, HDR chain, light fog):
    // released together, so `setLook` can rebuild them without the scene.
    const lookCleanups: (() => void)[] = [];
    const releaseLook = () => {
      for (const cleanup of lookCleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch {
          // Keep releasing the rest.
        }
      }
    };
    cleanups.push(releaseLook);
    let effects = applyResolvedFilmLook(l, scene3D, camera, sun.light, look, lookCleanups);
    let lightFog = effects.lightFog;
    // What moves with shot time; filled in below, applied by `setTime`.
    const timed: ((seconds: number) => void)[] = [];
    const modelPose = new Map<string, { position: number[]; yawDeg: number }>();
    const followPosition = (node: {
      position: number[];
      follows?: { node: string; offset?: number[] };
    }) => {
      const pose = node.follows && modelPose.get(node.follows.node);
      if (!pose) return node.position;
      const [ox, oy, oz] = node.follows!.offset ?? [0, 0, 0],
        yaw = (pose.yawDeg * Math.PI) / 180,
        c = Math.cos(yaw),
        s = Math.sin(yaw);
      return [
        pose.position[0] + ox * c + oz * s,
        pose.position[1] + oy,
        pose.position[2] - ox * s + oz * c,
      ];
    };
    const resolveMaterial = (name: string): any => {
      const existing = materials.get(name);
      if (existing) return existing;
      const spec: ZhudaFilmMaterial | undefined =
        scene.materials?.[name] ?? (recipes[name] ? { recipe: name } : undefined);
      if (!spec) throw Error(`Film scene: no material ${name}; add it to scene.materials`);
      let material: any;
      if ('recipe' in spec) {
        const recipe = typeof spec.recipe === 'string' ? recipes[spec.recipe] : spec.recipe;
        if (!recipe) throw Error(`Film scene: unknown recipe ${String(spec.recipe)}`);
        const size = spec.size ?? 256,
          key = zhudaBakeKey(recipe, size);
        let set = bakeCache.get(key);
        if (!set) {
          set = bakeZhudaTextureSet(recipe, { size });
          bakeCache.set(key, set);
        }
        const baked = createZhudaProceduralMaterial(set, {
          ...(spec.tint ? { tint: spec.tint } : {}),
          // One repeat of the picture spans many tiles and is not a multiple of one: its own
          // repeat is rare in a view and never lines up with the tiles.
          ...(spec.variation
            ? {
                variation: {
                  amount: spec.variation,
                  meters: Math.max(24, Math.max(...set.tileMeters) * 13.7),
                },
              }
            : {}),
        });
        cleanups.push(() => baked.dispose());
        material = baked.material;
      } else {
        material = createSurfaceMaterial({
          type: 'pbr',
          color: [...spec.color, 1],
          metallic: spec.metallic ?? 0,
          roughness: spec.roughness ?? 0.6,
          emission: spec.emission,
        });
        cleanups.push(() => disposeSurfaceMaterial(material));
      }
      materials.set(name, material);
      return material;
    };

    const solids: { min: number[]; max: number[] }[] = [];
    const placed = scene.nodes.flatMap((node) =>
      node.type === 'prop'
        ? [
            registry.place(node.prop, {
              position: node.position,
              yawDeg: node.yawDeg,
              seed: node.seed,
              params: node.params,
              instance: node.id,
            }),
          ]
        : [],
    );
    const batches = new Map<string, number>();
    // What stands in the scene, as world axis-aligned boxes (for probes to keep out of).
    for (const prop of placed)
      for (const collider of prop.colliders)
        solids.push({ min: [...collider.min], max: [...collider.max] });
    if (placed.length) {
      const props = instantiateZhudaPropBatches(
        mergeZhudaPlacedProps(placed),
        resolveMaterial,
        scene3D,
      );
      cleanups.push(() => props.dispose());
      for (const mesh of props.meshes) {
        castsShadow(mesh.node);
        const name = materialName(mesh.node.meshRenderer.sharedMaterial, materials);
        batches.set(name, (batches.get(name) ?? 0) + 1);
      }
    }
    // Boxes and ground: one merged mesh per material, like props.
    const primitives = new Map<string, MeshData[]>();
    for (const node of scene.nodes) {
      let mesh: MeshData, material: string;
      if (node.type === 'box') {
        material = node.material;
        mesh = transformZhudaMesh(
          createZhudaBoxMesh({
            width: node.size[0],
            height: node.size[1],
            depth: node.size[2],
            origin: 'bottom',
            bevel: node.bevel,
          }),
          { position: node.position, yawDeg: node.yawDeg },
        );
      } else if (node.type === 'lathe') {
        material = node.material;
        mesh = transformZhudaMesh(
          createZhudaLatheMesh({ profile: node.profile, segments: node.segments }),
          { position: node.position, yawDeg: node.yawDeg },
        );
      } else if (node.type === 'extrude') {
        material = node.material;
        mesh = transformZhudaMesh(
          createZhudaExtrudeMesh({ outline: node.outline, height: node.height }),
          { position: node.position, yawDeg: node.yawDeg },
        );
      } else if (node.type === 'ground') {
        material = node.material;
        mesh = transformZhudaMesh(
          createZhudaBoxMesh({
            width: node.size[0],
            height: 0.1,
            depth: node.size[1],
            origin: 'bottom',
          }),
          { position: [0, -0.1, 0] },
        );
      } else continue;
      if (node.type !== 'ground') {
        const min = [Infinity, Infinity, Infinity],
          max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < mesh.positions.length; i += 3)
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], mesh.positions[i + k]);
            max[k] = Math.max(max[k], mesh.positions[i + k]);
          }
        solids.push({ min, max });
      }
      const list = primitives.get(material);
      if (list) list.push(mesh);
      else primitives.set(material, [mesh]);
    }
    for (const [name, meshes] of primitives) {
      const material = resolveMaterial(name);
      for (const data of mergeZhudaMeshes(meshes)) {
        const mesh = new ZhudaDynamicMesh(
          { ...data, tangents: computeMeshTangents(data) },
          scene3D,
        );
        mesh.node.meshRenderer.sharedMaterial = material;
        castsShadow(mesh.node);
        cleanups.push(() => mesh.dispose());
        batches.set(name, (batches.get(name) ?? 0) + 1);
      }
    }

    // Models: clones from the shared library; baked lightmaps through Laya's
    // native lightmap path (`Scene3D.lightmaps`, renderer `lightmapIndex`).
    const models: ZhudaFilmStage['models'][number][] = [];
    const modelHolders = new Map<string, any>();
    const lightmaps: any[] = [];
    const lightmapped: { renderer: any; index: number }[] = [];
    for (const node of scene.nodes) {
      if (node.type !== 'model') continue;
      const item = loaded.get(node.id);
      if (!item) throw Error(`Film scene model ${node.id}: not loaded`);
      const holder = new l.Sprite3D(`ZhudaFilmModel:${node.id}`);
      scene3D.addChild(holder);
      cleanups.push(() => holder.destroy(false));
      holder.transform.position = new l.Vector3(...node.position);
      holder.transform.rotationEuler = new l.Vector3(0, node.yawDeg ?? 0, 0);
      const scale = node.scale ?? 1;
      holder.transform.localScale = new l.Vector3(scale, scale, scale);
      modelPose.set(node.id, { position: [...node.position], yawDeg: node.yawDeg ?? 0 });
      if (node.motion) {
        const keys = node.motion;
        timed.push((seconds) => {
          const pose = sampleZhudaFilmMotion(keys, seconds, node.yawDeg ?? 0);
          modelPose.set(node.id, pose);
          holder.transform.position = new l.Vector3(...pose.position);
          holder.transform.rotationEuler = new l.Vector3(0, pose.yawDeg, 0);
        });
      }
      const mounted = mountZhudaModel(holder, item.instance, {
        placements: node.placements,
        translucent: node.translucent,
        emission: node.emission,
        label: `ZhudaFilmModel:${node.id}`,
      });
      cleanups.push(() => mounted.dispose());
      const clips = new ZhudaModelInspector(item.instance).inspect().animations;
      if (node.animation) {
        const animation = node.animation;
        const clip = clips.find((entry) => entry.name === animation.clip);
        if (!clip)
          throw Error(
            `Film scene model ${node.id}: ${node.asset} has no clip ${animation.clip}; it has: ${
              clips.map((entry) => entry.name).join(', ') || 'none'
            }`,
          );
        const sampler = new ZhudaModelAnimationSampler(
          item.instance,
          clip.path,
          clip.name,
          clip.layer,
        );
        cleanups.push(() => sampler.dispose());
        timed.push((seconds) =>
          sampler.sample(
            Math.max(0, (animation.offsetSec ?? 0) + seconds * (animation.speed ?? 1)),
            animation.loop ?? true,
          ),
        );
      }
      const renderers = mounted.renderers;
      if (!renderers.length) throw Error(`Film scene model ${node.id}: ${node.asset} has no mesh`);
      if (item.lightmap) {
        for (const renderer of renderers)
          if (!hasSecondUv(l, renderer))
            throw Error(
              `Film scene model ${node.id}: ${node.asset} has a mesh without a second UV set (TEXCOORD_1); a lightmap needs one`,
            );
        const baked = createZhudaLightmap(
          item.lightmap.value,
          node.lightmapIntensity ?? 1,
          item.direction?.value,
        );
        cleanups.push(() => baked.dispose());
        const index = lightmaps.push(baked.lightmap) - 1;
        for (const renderer of renderers) lightmapped.push({ renderer, index });
      }
      modelHolders.set(node.id, holder);
      models.push({
        id: node.id,
        asset: node.asset,
        meshes: renderers.length,
        lightmap: !!item.lightmap,
        clips: clips.map((entry) => ({ name: entry.name, durationSeconds: entry.durationSeconds })),
      });
    }
    if (lightmaps.length) {
      scene3D.lightmaps = lightmaps;
      // Clear the list before the textures go (cleanups run in reverse).
      cleanups.push(() => (scene3D.lightmaps = []));
      for (const { renderer, index } of lightmapped) {
        renderer.lightmapScaleOffset = new l.Vector4(1, 1, 0, 0);
        renderer.lightmapIndex = index;
        renderer.setLightmapIndex?.(index);
      }
    }

    // Reflector: a mirrored scene camera plus an additive surface.
    let reflector: ZhudaReflectiveSurface | undefined;
    for (const node of scene.nodes) {
      if (node.type !== 'reflector') continue;
      const surface = new ZhudaReflectiveSurface(scene3D, {
        position: node.position,
        size: node.size,
        strength: node.strength,
        wetness: node.wetness,
        roughness: node.roughness,
        ripple: node.ripple,
        patternMeters: node.patternMeters,
        resolution: node.resolution,
      });
      cleanups.push(() => surface.dispose());
      surface.camera.clearFlag = camera.clearFlag;
      surface.camera.clearColor = camera.clearColor;
      for (const id of node.hides ?? []) setLayer(modelHolders.get(id), surface.layer);
      reflector = surface;
    }
    let water: ZhudaWaterSurface | undefined;
    for (const node of scene.nodes) {
      if (node.type !== 'water') continue;
      const surface = new ZhudaWaterSurface(scene3D, {
        position: node.position,
        size: node.size,
        flow: node.flow,
        color: node.color && zhudaDecodeColor(node.color),
        clarity: node.clarity,
        waveMeters: node.waveMeters,
        waves: node.waves,
        refraction: node.refraction,
        reflection: node.reflection,
        glow: node.glow,
        foamDepth: node.foamDepth,
        resolution: node.resolution,
        sun: { toward: zhudaTowardSun(l, sun.light), color: zhudaSunRadiance(look) },
      });
      cleanups.push(() => surface.dispose());
      surface.camera.clearFlag = camera.clearFlag;
      surface.camera.clearColor = camera.clearColor;
      for (const id of node.hides ?? []) setLayer(modelHolders.get(id), surface.layer);
      // The water reads the scene behind it and how far away that is.
      const before = { depth: camera.depthTextureMode, opaque: camera.opaquePass };
      camera.depthTextureMode |= l.DepthTextureMode.Depth;
      camera.opaquePass = true;
      cleanups.push(() => {
        camera.depthTextureMode = before.depth;
        camera.opaquePass = before.opaque;
      });
      timed.push((seconds) => surface.setTime(seconds));
      water = surface;
    }

    // Practical lights: native point and spot light components.
    const realTime = scene.nodes.filter((node) => node.type === 'light' && !node.fogOnly).length;
    const capacity = l.Config3D?.maxLightCount ?? 32;
    // The sun is a light too.
    if (realTime + 1 > capacity)
      throw Error(
        `Film scene has ${realTime} real-time lights but the runtime was booted for ${capacity} (one is the sun); boot with maxLights`,
      );
    // What `setLight` changed, and the native light of each node that has one.
    const lightValues = new Map<
      string,
      { enabled: boolean; intensity: number; color: [number, number, number]; range: number }
    >();
    const nativeLights = new Map<string, any>();
    for (const node of scene.nodes)
      if (node.type === 'light')
        lightValues.set(node.id, {
          enabled: true,
          intensity: node.intensity ?? 2,
          color: [...(node.color ?? [1, 0.82, 0.6])] as [number, number, number],
          range: node.range ?? 12,
        });
    // Point lights that cast shadows, up to four, in one set of pictures. Each
    // light's six are drawn in `prepare`, when everything that casts is in
    // place, and again when its reach or something that moves with time changed.
    const pointCasters = scene.nodes.filter((node) => {
      const light = node as { type: string; kind?: string; castsShadow?: boolean; fogOnly?: boolean };
      return light.type === 'light' && light.kind === 'point' && light.castsShadow && !light.fogOnly;
    }).length;
    const pointShadow = pointCasters
      ? new ZhudaPointShadow(scene3D, { lights: pointCasters })
      : undefined;
    if (pointShadow) cleanups.push(() => pointShadow.dispose());
    const pointShadows: {
      id: string;
      light: number;
      position: number[];
      range: number;
      dirty: boolean;
    }[] = [];
    let shadowTime = 0;
    for (const node of scene.nodes) {
      if (node.type !== 'light' || node.fogOnly) continue;
      const holder = new l.Sprite3D(`ZhudaFilmLight:${node.id}`);
      scene3D.addChild(holder);
      cleanups.push(() => holder.destroy(true));
      holder.transform.position = new l.Vector3(...node.position);
      if (node.follows)
        timed.push(() => (holder.transform.position = new l.Vector3(...followPosition(node))));
      const light = holder.addComponent(node.kind === 'spot' ? l.SpotLightCom : l.PointLightCom);
      nativeLights.set(node.id, light);
      const [r, g, b] = node.color ?? [1, 0.82, 0.6];
      light.color = new l.Color(r, g, b, 1);
      light.intensity = node.intensity ?? 2;
      light.range = node.range ?? 12;
      if (node.kind === 'spot') {
        light.spotAngle = node.spotAngleDeg ?? 60;
        const [tx, ty, tz] = node.target!,
          [px, py, pz] = node.position;
        // A light aimed straight down or up needs another up vector.
        const vertical = Math.hypot(tx - px, tz - pz) < 1e-6 * Math.max(1, Math.abs(ty - py));
        holder.transform.lookAt(
          new l.Vector3(tx, ty, tz),
          vertical ? new l.Vector3(0, 0, 1) : new l.Vector3(0, 1, 0),
        );
        if (node.castsShadow) {
          light.shadowMode = l.ShadowMode.SoftHigh;
          light.shadowStrength = 1;
          light.shadowResolution = 2048;
          light.shadowDistance = node.range ?? 12;
          cleanups.push(() => (light.shadowMode = l.ShadowMode.None));
        }
      } else if (node.castsShadow) {
        pointShadows.push({
          id: node.id,
          light: pointShadows.length,
          position: [...node.position],
          range: node.range ?? 12,
          dirty: true,
        });
      }
    }

    // Lights in the fog, after the models they may follow.
    const fogNodes = scene.nodes.flatMap((node) =>
      node.type === 'light' && node.kind === 'point' ? [node] : [],
    );
    const fogLights = () =>
      lightFog?.setLights(
        fogNodes.map((node) => {
          const now = lightValues.get(node.id)!;
          return {
            position: followPosition(node) as [number, number, number],
            // The lamp's glow in the fog in the colour its light has on surfaces.
            color: zhudaDecodeColor(now.color),
            intensity: now.enabled ? now.intensity : 0,
            range: now.range,
          };
        }),
      );
    if (fogNodes.some((node) => node.follows)) timed.push(fogLights);
    const setTime = (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds < 0) throw Error('Invalid film time');
      for (const apply of timed) apply(seconds);
      // The samples of a still differ in time: each moves the ray noise elsewhere.
      effects.reflections?.setPhase(seconds);
      // What moves with time may cast on the lamp's pictures: draw them again.
      if (pointShadows.length && timed.length && seconds !== shadowTime) {
        shadowTime = seconds;
        for (const casting of pointShadows) casting.dirty = true;
      }
    };
    fogLights();
    setTime(0);

    const first = resolveZhudaFilmCamera(scene.camera);
    const lens = new ZhudaPhysicalCameraRig(camera, {
      focalLengthMm: first.focalLengthMm,
      fStop: first.fStop,
      focusDistanceM: first.focusDistanceM,
    });
    cleanups.push(() => lens.dispose());
    let current = resolveZhudaFilmCamera(scene.camera);
    const prepare = (aspect: number, frame?: { width: number; height: number; index: number }) => {
      for (const casting of pointShadows)
        if (casting.dirty) {
          casting.dirty = false;
          pointShadow!.render(casting.position, casting.range, casting.light);
        }
      if (frame) effects.finish?.setFrame(frame.width, frame.height, frame.index);
      if (frame) lightFog?.setFrame(frame.index);
      lightFog?.update(current.eye, current.target, camera.fieldOfView, aspect);
      lightFog?.renderShafts();
      effects.reflections?.update(current.eye, current.target, camera.fieldOfView, aspect);
      for (const surface of [reflector, water]) {
        if (!surface) continue;
        surface.update(current.eye, current.target, camera.fieldOfView, aspect);
        surface.render();
      }
    };
    const setCamera = (value: ZhudaFilmCamera) => {
      const c = resolveZhudaFilmCamera(value);
      current = c;
      camera.transform.position = new l.Vector3(...c.eye);
      camera.transform.lookAt(new l.Vector3(...c.target), new l.Vector3(0, 1, 0));
      lens.configure({
        focalLengthMm: c.focalLengthMm,
        fStop: c.fStop,
        focusDistanceM: c.focusDistanceM,
      });
    };
    setCamera(scene.camera);

    let live = true;
    cleanups.push(() => (live = false));
    const mirrors = [reflector, water].filter((surface) => !!surface) as {
      camera: any;
    }[];
    const afterLook = () => {
      hemisphere.set(look.ambient, look.ambientGround);
      for (const surface of mirrors) {
        surface.camera.clearFlag = camera.clearFlag;
        surface.camera.clearColor = camera.clearColor;
      }
      water?.setSun({ toward: zhudaTowardSun(l, sun.light), color: zhudaSunRadiance(look) });
    };
    const buildLook = (resolved: ZhudaResolvedFilmLook) => {
      effects = applyResolvedFilmLook(l, scene3D, camera, sun.light, resolved, lookCleanups);
      lightFog = effects.lightFog;
      // A new HDR chain restored the camera's depth settings: the water still reads depth.
      if (water) {
        camera.depthTextureMode |= l.DepthTextureMode.Depth;
        camera.opaquePass = true;
      }
      fogLights();
      updateZhudaLookInPlace(l, { scene3D, camera, sun: sun.light, parts: effects }, resolved);
    };
    // The authored look and the quality level drawn on top of it.
    let authored = look;
    let quality: ZhudaLookQuality = 3;
    const keepGrade = scene.nodes.some((node) => node.type === 'water');
    const atQuality = (resolved: ZhudaResolvedFilmLook) =>
      zhudaLookForQuality(resolved, quality, { keepGrade });
    const setLook = (next: ZhudaFilmLook): 'updated' | 'rebuilt' => {
      if (!live) throw Error('Disposed film stage');
      const candidate = parseZhudaFilmScene(
        { ...currentScene, look: next },
        { props: registry.ids(), recipes: Object.keys(recipes) },
      );
      const mode = drawLook(atQuality(resolveZhudaFilmLook(candidate.look)));
      authored = resolveZhudaFilmLook(candidate.look);
      currentScene = candidate;
      return mode;
    };
    const setQuality = (level: ZhudaLookQuality): 'updated' | 'rebuilt' | 'unchanged' => {
      if (!live) throw Error('Disposed film stage');
      if (![0, 1, 2, 3].includes(level)) throw Error('Look quality: use 0, 1, 2 or 3');
      if (level === quality) return 'unchanged';
      const previous = quality;
      quality = level;
      try {
        return drawLook(atQuality(authored));
      } catch (error) {
        quality = previous;
        throw error;
      }
    };
    const setLight = (
      id: string,
      values: {
        enabled?: boolean;
        intensity?: number;
        color?: readonly [number, number, number];
        range?: number;
      },
    ) => {
      if (!live) throw Error('Disposed film stage');
      const now = lightValues.get(id);
      if (!now) throw Error(`Film stage: no light ${id}`);
      const next = { ...now };
      if (values.enabled !== undefined) {
        if (typeof values.enabled !== 'boolean') throw Error('setLight: enabled is true or false');
        next.enabled = values.enabled;
      }
      if (values.intensity !== undefined) {
        if (!(values.intensity >= 0 && values.intensity <= 100000))
          throw Error('setLight: intensity 0..100000');
        next.intensity = values.intensity;
      }
      if (values.range !== undefined) {
        if (!(values.range > 0 && values.range <= 10000)) throw Error('setLight: range above 0');
        next.range = values.range;
      }
      if (values.color !== undefined) {
        if (
          !Array.isArray(values.color) ||
          values.color.length !== 3 ||
          !values.color.every((c) => Number.isFinite(c) && c >= 0)
        )
          throw Error('setLight: color needs three numbers from 0');
        next.color = [...values.color] as [number, number, number];
      }
      lightValues.set(id, next);
      const casting = pointShadows.find((entry) => entry.id === id);
      if (casting && casting.range !== next.range) {
        casting.range = next.range;
        casting.dirty = true;
      }
      const native = nativeLights.get(id);
      if (native) {
        native.color = new l.Color(...next.color, 1);
        // Off is zero light, not a removed component: the light keeps its slot.
        native.intensity = next.enabled ? next.intensity : 0;
        native.range = next.range;
      }
      fogLights();
    };
    const drawLook = (resolved: ZhudaResolvedFilmLook): 'updated' | 'rebuilt' => {
      const reason = zhudaFilmLookRebuildReason(look, resolved);
      if (reason === 'environment' || reason === 'panorama' || reason === 'bounceLight')
        throw Error(`Film stage: setLook cannot change the ${reason}; mount the scene again`);
      if (reason === null)
        updateZhudaLookInPlace(l, { scene3D, camera, sun: sun.light, parts: effects }, resolved);
      else {
        releaseLook();
        try {
          buildLook(resolved);
        } catch (error) {
          // Put the previous look back so the stage keeps drawing.
          releaseLook();
          buildLook(look);
          afterLook();
          throw error;
        }
      }
      look = resolved;
      afterLook();
      return reason === null ? 'updated' : 'rebuilt';
    };
    return {
      get scene() {
        return currentScene;
      },
      get look() {
        return look;
      },
      setLook,
      get quality() {
        return quality;
      },
      setQuality,
      setLight,
      scene3D,
      camera,
      lens,
      batches: [...batches]
        .map(([material, meshes]) => ({ material, meshes }))
        .sort((a, b) => a.material.localeCompare(b.material)),
      models,
      setTime,
      setCamera,
      prepare,
      adopt: (release: () => void) => void cleanups.push(release),
      linearChain: () => effects.film?.linearChain(),
      solids,
      dispose,
    };
  }
}

/** The picture as the sky: Laya's panoramic sky material on a dome the stage owns. */
function applyPanorama(
  stage: ZhudaFilmStage,
  bitmap: ImageBitmap,
  panorama: { exposure: number; rotationDeg: number },
) {
  const l = (globalThis as any).Laya;
  const texture = new l.Texture2D(
    bitmap.width,
    bitmap.height,
    l.TextureFormat.R8G8B8A8,
    true,
    false,
    true,
  );
  texture.setImageData(bitmap, false, false);
  texture.filterMode = l.FilterMode.Trilinear;
  texture.wrapModeU = l.WrapMode.Repeat;
  texture.wrapModeV = l.WrapMode.Clamp;
  const sky = new l.SkyPanoramicMaterial();
  sky.panoramicTexture = texture;
  sky.exposure = panorama.exposure;
  sky.rotation = panorama.rotationDeg;
  const dome = new l.SkyDome();
  const renderer = stage.scene3D.skyRenderer;
  renderer.mesh = dome;
  renderer.material = sky;
  stage.camera.clearFlag = l.CameraClearFlags.Sky;
  stage.adopt(() => {
    renderer.material = null;
    renderer.mesh = null;
    sky.destroy();
    dome.destroy();
    texture.destroy();
  });
}

function setLayer(node: any, layer: number) {
  if (!node) return;
  node.layer = layer;
  for (let i = 0; i < (node.numChildren || 0); i++) setLayer(node.getChildAt(i), layer);
}

function hasSecondUv(l: any, renderer: any): boolean {
  const owner = renderer.owner;
  const mesh =
    owner?.meshFilter?.sharedMesh ??
    owner?.getComponent?.(l.MeshFilter)?.sharedMesh ??
    renderer.sharedMesh;
  const declaration = mesh?.getVertexDeclaration?.();
  return !!declaration?.getVertexElementByUsage?.(l.VertexMesh.MESH_TEXTURECOORDINATE1);
}

function castsShadow(node: any) {
  node.meshRenderer.castShadow = true;
  node.meshRenderer.receiveShadow = true;
}

/** Shadows, procedural sky and fog, all native Laya 3.4.2 features. */
/** Shared with `ZhudaSceneLook`: shadows, sky, fog and the HDR chain of a resolved look. */
export function applyResolvedFilmLook(
  l: any,
  scene3D: any,
  camera: any,
  sun: any,
  look: ZhudaResolvedFilmLook,
  cleanups: (() => void)[],
): ZhudaAppliedLookParts & { finish?: ZhudaLensFinish } {
  let lightFog: ZhudaLightFog | undefined;
  let reflections: ZhudaScreenReflections | undefined;
  let finish: ZhudaLensFinish | undefined;
  let skyMaterial: any;
  let film: ZhudaFilmicPipeline | undefined;
  if (look.shadows) {
    sun.shadowMode = look.shadows.softness === 'hard' ? l.ShadowMode.Hard : l.ShadowMode.SoftHigh;
    sun.shadowDistance = look.shadows.distance;
    sun.shadowResolution = look.shadows.resolution;
    sun.shadowStrength = look.shadows.strength;
    sun.shadowCascadesMode =
      look.shadows.cascades === 4
        ? l.ShadowCascadesMode.FourCascades
        : look.shadows.cascades === 1
          ? l.ShadowCascadesMode.NoCascades
          : l.ShadowCascadesMode.TwoCascades;
    // Switch shadows off before the scene is destroyed (see the stage tests).
    cleanups.push(() => (sun.shadowMode = l.ShadowMode.None));
  } else sun.shadowMode = l.ShadowMode.None;
  // A panorama replaces the procedural sky (it is applied after loading).
  if (look.atmosphere && !look.panorama) {
    const sky = (skyMaterial = new l.SkyProceduralMaterial());
    sky.sunDisk = l.SkyProceduralMaterial.SUN_HIGH_QUALITY;
    sky.sunSize = look.atmosphere.sunSize;
    sky.atmosphereThickness = look.atmosphere.thickness;
    sky.skyTint = new l.Color(...look.atmosphere.skyTint, 1);
    sky.groundTint = new l.Color(...look.atmosphere.groundTint, 1);
    sky.exposure = look.atmosphere.exposure;
    // Own the dome: the shared SkyDome.instance would be destroyed with this
    // scene and break every scene drawn after it.
    const dome = new l.SkyDome();
    const previousMesh = scene3D.skyRenderer.mesh;
    scene3D.skyRenderer.mesh = dome;
    scene3D.skyRenderer.material = sky;
    camera.clearFlag = l.CameraClearFlags.Sky;
    cleanups.push(() => {
      scene3D.skyRenderer.material = null;
      try {
        scene3D.skyRenderer.mesh = null;
      } catch {
        // A scene that has drawn (a game changing its look while it runs)
        // cannot hold no sky mesh in Laya 3.4.2: give it back the one it had.
        if (previousMesh && !previousMesh.destroyed) scene3D.skyRenderer.mesh = previousMesh;
      }
      sky.destroy();
      dome.destroy();
    });
  }
  if (look.grade) {
    if (look.screenReflections) {
      const mirror = (reflections = new ZhudaScreenReflections(look.screenReflections));
      cleanups.push(() => mirror.dispose());
    }
    if (look.lightFog) {
      const { shafts, ...plain } = look.lightFog;
      const fog = (lightFog = new ZhudaLightFog({
        ...plain,
        // A display value like every colour of the look; the fog's own shader takes light.
        color: zhudaDecodeColor(plain.color),
        ...(shafts ? { shafts } : {}),
      }));
      if (shafts) {
        // `getForward` is the direction the light travels (checked against
        // the real shadows by verify:film-fog).
        const travel = new l.Vector3();
        sun.owner.transform.getForward(travel);
        const length = Math.hypot(travel.x, travel.y, travel.z) || 1;
        fog.attachSun(scene3D, {
          toward: [-travel.x / length, -travel.y / length, -travel.z / length],
          color: zhudaSunRadiance(look),
        });
      }
      // Cleanups run in reverse: the pipeline releases its chain first.
      cleanups.push(() => fog.dispose());
    }
    if (look.grade.grain > 0 || look.grade.vignette > 0 || look.grade.fringe > 0) {
      const lens = (finish = new ZhudaLensFinish({
        grain: look.grade.grain,
        vignette: look.grade.vignette,
        fringe: look.grade.fringe,
      }));
      cleanups.push(() => lens.dispose());
    }
    const pipeline = (film = new ZhudaFilmicPipeline(camera, {
      // Reflections first: the fog then lies over them as over everything else.
      sceneEffects: [
        ...(reflections ? [reflections.effect] : []),
        ...(lightFog ? [lightFog.effect] : []),
      ],
      finishEffects: finish ? [finish.effect] : [],
      exposure: look.grade.exposure,
      contrast: look.grade.contrast,
      saturation: look.grade.saturation,
      bloom: look.grade.bloom > 0,
      bloomIntensity: look.grade.bloom,
      ao: look.grade.ao > 0,
      aoIntensity: look.grade.ao,
      aoRadius: look.grade.aoRadius,
      temporalAA: false,
      msaa: look.grade.antialias === 'msaa',
    }));
    cleanups.push(() => pipeline.dispose());
  }
  if (look.fog) {
    scene3D.enableFog = true;
    scene3D.fogMode = l.FogMode.Linear;
    scene3D.fogColor = new l.Color(...look.fog.color, 1);
    scene3D.fogStart = look.fog.start;
    scene3D.fogEnd = look.fog.end;
    cleanups.push(() => (scene3D.enableFog = false));
  }
  return { lightFog, reflections, finish, sky: skyMaterial, film };
}

function materialName(material: unknown, materials: Map<string, any>): string {
  for (const [name, value] of materials) if (value === material) return name;
  return 'unknown';
}

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
export class ZhudaFilmRenderer {
  private readonly wasPaused: boolean;
  private disposed = false;
  constructor(
    private readonly stage: ZhudaFilmStage,
    private readonly runtime: ZhudaRuntimeSession,
  ) {
    // Laya registers newly added meshes on its next frame. Captures freeze the
    // scene, so run two native frames first or a fresh stage can render
    // nothing but its clear colour (intermittently, depending on timing).
    ZhudaEngine.flushRenderFrames(2);
    this.wasPaused = runtime.paused;
    runtime.setPaused(true);
  }
  /** Renders one frame with the camera given (or the scene camera). */
  async render(
    options: ZhudaFilmRenderOptions & { camera?: ZhudaFilmCamera; index?: number; fps?: number },
  ): Promise<CinematicFramePixels> {
    if (this.disposed) throw Error('Film renderer disposed');
    const samples = options.samples ?? 1;
    const capture = new ZhudaCinematicCapture(this.stage.scene3D, this.stage.lens, this.runtime, {
      width: options.width,
      height: options.height,
      timeoutMs: options.timeoutMs,
    });
    try {
      const camera = options.camera ?? this.stage.scene.camera;
      return await capture.renderFrame({
        index: options.index ?? 0,
        fps: options.fps ?? 24,
        samples,
        signal: options.signal,
        aperture: options.aperture ?? samples > 1,
        jitter: samples > 1,
        // Out-of-focus and moving highlights keep their light only when the
        // samples are averaged before tone mapping.
        linear: samples > 1 ? this.stage.linearChain() : undefined,
        sample: (seconds) => {
          this.stage.setTime((options.timeSec ?? 0) + seconds);
          this.stage.setCamera(camera);
        },
        prepare: () =>
          this.stage.prepare(options.width / options.height, {
            width: options.width,
            height: options.height,
            index: (options.index ?? 0) + Math.round((options.timeSec ?? 0) * (options.fps ?? 24)),
          }),
      });
    } finally {
      capture.dispose();
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.runtime.setPaused(this.wasPaused);
  }
}

/** Waits for the engine to settle before the first capture (helper for hosts). */
export function flushZhudaFilmFrames(count = 3): void {
  ZhudaEngine.flushRenderFrames(count);
}
