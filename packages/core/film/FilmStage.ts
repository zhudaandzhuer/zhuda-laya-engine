/**
 * Browser side of film scenes: mounts a validated `ZhudaFilmScene` into Laya
 * and renders it through `ZhudaCinematicCapture`, so previews, review shots
 * and final frames share one deterministic path. Requires the Laya runtime.
 */
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
import { ZhudaCinematicCapture, type CinematicFramePixels } from '../runtime3d/CinematicCapture.ts';
import type { ZhudaRuntimeSession } from '../runtime3d/Runtime.ts';
import { ZhudaModelLibrary, type AssetLease, type ModelInstance } from '../runtime3d/Assets.ts';
import type { ZhudaAssetCache } from '../runtime3d/Assets.ts';
import { createProviderAssetCache, type AssetProvider } from '../runtime3d/AssetProvider.ts';
import { ZhudaReflectiveSurface } from '../shaders/ReflectiveSurface.ts';
import { ZhudaLightFog } from '../runtime3d/LightFog.ts';
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
  type ZhudaFilmCamera,
  type ZhudaFilmMaterial,
  type ZhudaFilmScene,
  type ZhudaResolvedFilmLook,
} from './FilmScene.ts';

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
  /** Models placed by the scene, in node order. */
  readonly models: readonly { id: string; asset: string; meshes: number; lightmap: boolean }[];
  /** Moves the camera and sets its lens; ignores depth of field until a render asks for it. */
  setCamera(camera: ZhudaFilmCamera): void;
  /**
   * Draws what the main camera reads (a reflector's mirrored view) for the
   * camera last set. `ZhudaFilmRenderer` calls it before every sample.
   */
  prepare(aspect: number): void;
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
  }
  /** Dispose every stage first. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.models.dispose();
    } finally {
      this.lightmaps.dispose();
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
  options: ZhudaFilmStageOptions & { assets: ZhudaFilmAssets; signal?: AbortSignal },
): Promise<ZhudaFilmStage> {
  const registry = new ZhudaPropRegistry();
  for (const definition of options.props ?? []) registry.register(definition);
  const scene = parseZhudaFilmScene(input, {
    props: registry.ids(),
    recipes: Object.keys(options.recipes ?? {}),
  });
  const nodes = scene.nodes.flatMap((node) => (node.type === 'model' ? [node] : []));
  const results = await Promise.allSettled(
    nodes.map(async (node): Promise<LoadedFilmModel> => {
      const picture = (id: string | undefined) =>
        id === undefined
          ? undefined
          : options.assets.lightmaps.acquire(id, { signal: options.signal });
      const [instance, lightmap, direction] = await Promise.allSettled([
        options.assets.models.instantiate(node.asset, { signal: options.signal }),
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
  return buildFilmStage(rootScene, scene, options, loaded);
}

const bakeKey = (recipe: ZhudaTextureRecipe, size: number) => `${size}:${JSON.stringify(recipe)}`;

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
  const look = resolveZhudaFilmLook(scene.look);
  const materials = new Map<string, any>();
  {
    const scene3D = Zhuda3D.createScene3D(rootScene, { ambientColor: [...look.ambient, 1] });
    cleanups.push(() => scene3D.destroy(true));
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
    const lightFog = applyLook(l, scene3D, camera, sun.light, look, cleanups);
    lightFog?.setLights(
      scene.nodes.flatMap((node) =>
        node.type === 'light' && node.kind === 'point'
          ? [
              {
                position: node.position,
                color: node.color ?? ([1, 0.82, 0.6] as [number, number, number]),
                intensity: node.intensity ?? 2,
                range: node.range ?? 12,
              },
            ]
          : [],
      ),
    );
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
          key = bakeKey(recipe, size);
        let set = bakeCache.get(key);
        if (!set) {
          set = bakeZhudaTextureSet(recipe, { size });
          bakeCache.set(key, set);
        }
        const baked = createZhudaProceduralMaterial(set, spec.tint ? { tint: spec.tint } : {});
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
    const models: { id: string; asset: string; meshes: number; lightmap: boolean }[] = [];
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
      holder.addChild(item.instance.node);
      // The library destroys the clone; detach it first so the holder does not.
      cleanups.push(() => item.instance.node.removeSelf());
      const renderers = modelRenderers(l, item.instance.node);
      if (!renderers.length) throw Error(`Film scene model ${node.id}: ${node.asset} has no mesh`);
      for (const renderer of renderers) {
        renderer.castShadow = true;
        renderer.receiveShadow = true;
      }
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

    // Practical lights: native point and spot light components.
    for (const node of scene.nodes) {
      if (node.type !== 'light' || node.fogOnly) continue;
      const holder = new l.Sprite3D(`ZhudaFilmLight:${node.id}`);
      scene3D.addChild(holder);
      cleanups.push(() => holder.destroy(true));
      holder.transform.position = new l.Vector3(...node.position);
      const light = holder.addComponent(node.kind === 'spot' ? l.SpotLightCom : l.PointLightCom);
      const [r, g, b] = node.color ?? [1, 0.82, 0.6];
      light.color = new l.Color(r, g, b, 1);
      light.intensity = node.intensity ?? 2;
      light.range = node.range ?? 12;
      if (node.kind === 'spot') {
        light.spotAngle = node.spotAngleDeg ?? 60;
        holder.transform.lookAt(new l.Vector3(...node.target!), new l.Vector3(0, 1, 0));
      }
    }

    const first = resolveZhudaFilmCamera(scene.camera);
    const lens = new ZhudaPhysicalCameraRig(camera, {
      focalLengthMm: first.focalLengthMm,
      fStop: first.fStop,
      focusDistanceM: first.focusDistanceM,
    });
    cleanups.push(() => lens.dispose());
    let current = resolveZhudaFilmCamera(scene.camera);
    const prepare = (aspect: number) => {
      lightFog?.update(current.eye, current.target, camera.fieldOfView, aspect);
      if (!reflector) return;
      reflector.update(current.eye, current.target, camera.fieldOfView, aspect);
      reflector.render();
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
    return {
      scene,
      scene3D,
      camera,
      lens,
      batches: [...batches]
        .map(([material, meshes]) => ({ material, meshes }))
        .sort((a, b) => a.material.localeCompare(b.material)),
      models,
      setCamera,
      prepare,
      dispose,
    };
  }
}

function setLayer(node: any, layer: number) {
  if (!node) return;
  node.layer = layer;
  for (let i = 0; i < (node.numChildren || 0); i++) setLayer(node.getChildAt(i), layer);
}

function modelRenderers(l: any, root: any): any[] {
  const found: any[] = [];
  const visit = (node: any) => {
    const renderer =
      node.meshRenderer ?? node.skinnedMeshRenderer ?? node.getComponent?.(l.MeshRenderer);
    if (renderer) found.push(renderer);
    for (let i = 0; i < (node.numChildren || 0); i++) visit(node.getChildAt(i));
  };
  visit(root);
  return found;
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
function applyLook(
  l: any,
  scene3D: any,
  camera: any,
  sun: any,
  look: ZhudaResolvedFilmLook,
  cleanups: (() => void)[],
): ZhudaLightFog | undefined {
  let lightFog: ZhudaLightFog | undefined;
  if (look.shadows) {
    sun.shadowMode = look.shadows.softness === 'hard' ? l.ShadowMode.Hard : l.ShadowMode.SoftHigh;
    sun.shadowDistance = look.shadows.distance;
    sun.shadowResolution = look.shadows.resolution;
    sun.shadowStrength = look.shadows.strength;
    sun.shadowCascadesMode = l.ShadowCascadesMode.TwoCascades;
    // Switch shadows off before the scene is destroyed (see the stage tests).
    cleanups.push(() => (sun.shadowMode = l.ShadowMode.None));
  } else sun.shadowMode = l.ShadowMode.None;
  if (look.atmosphere) {
    const sky = new l.SkyProceduralMaterial();
    sky.sunDisk = l.SkyProceduralMaterial.SUN_HIGH_QUALITY;
    sky.sunSize = look.atmosphere.sunSize;
    sky.atmosphereThickness = look.atmosphere.thickness;
    sky.skyTint = new l.Color(...look.atmosphere.skyTint, 1);
    sky.groundTint = new l.Color(...look.atmosphere.groundTint, 1);
    sky.exposure = look.atmosphere.exposure;
    // Own the dome: the shared SkyDome.instance would be destroyed with this
    // scene and break every scene drawn after it.
    const dome = new l.SkyDome();
    scene3D.skyRenderer.mesh = dome;
    scene3D.skyRenderer.material = sky;
    camera.clearFlag = l.CameraClearFlags.Sky;
    cleanups.push(() => {
      scene3D.skyRenderer.material = null;
      scene3D.skyRenderer.mesh = null;
      sky.destroy();
      dome.destroy();
    });
  }
  if (look.grade) {
    if (look.lightFog) {
      const fog = (lightFog = new ZhudaLightFog({ ...look.lightFog, color: look.lightFog.color }));
      // Cleanups run in reverse: the pipeline releases its chain first.
      cleanups.push(() => fog.dispose());
    }
    const film = new ZhudaFilmicPipeline(camera, {
      sceneEffects: lightFog ? [lightFog.effect] : [],
      exposure: look.grade.exposure,
      contrast: look.grade.contrast,
      saturation: look.grade.saturation,
      bloom: look.grade.bloom > 0,
      bloomIntensity: look.grade.bloom,
      ao: look.grade.ao > 0,
      aoIntensity: look.grade.ao,
      aoRadius: look.grade.aoRadius,
      temporalAA: false,
    });
    cleanups.push(() => film.dispose());
  }
  if (look.fog) {
    scene3D.enableFog = true;
    scene3D.fogMode = l.FogMode.Linear;
    scene3D.fogColor = new l.Color(...look.fog.color, 1);
    scene3D.fogStart = look.fog.start;
    scene3D.fogEnd = look.fog.end;
    cleanups.push(() => (scene3D.enableFog = false));
  }
  return lightFog;
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
        sample: () => this.stage.setCamera(camera),
        prepare: () => this.stage.prepare(options.width / options.height),
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
