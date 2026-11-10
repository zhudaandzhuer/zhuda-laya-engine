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
import { ZhudaCinematicCapture, type CinematicFramePixels } from '../runtime3d/CinematicCapture.ts';
import type { ZhudaRuntimeSession } from '../runtime3d/Runtime.ts';
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
  /** Moves the camera and sets its lens; ignores depth of field until a render asks for it. */
  setCamera(camera: ZhudaFilmCamera): void;
  dispose(): void;
}

const bakeKey = (recipe: ZhudaTextureRecipe, size: number) => `${size}:${JSON.stringify(recipe)}`;

/**
 * Builds the scene under `rootScene`. Every Laya object is released by
 * `dispose()`, including on a failure part-way through.
 */
export function mountZhudaFilmScene(
  rootScene: any,
  input: ZhudaFilmScene,
  options: ZhudaFilmStageOptions = {},
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
  const cleanups: (() => void)[] = [];
  const materials = new Map<string, any>();
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
    applyLook(l, scene3D, camera, sun.light, look, cleanups);
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

    // Practical lights: native point and spot light components.
    for (const node of scene.nodes) {
      if (node.type !== 'light') continue;
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
    const setCamera = (value: ZhudaFilmCamera) => {
      const c = resolveZhudaFilmCamera(value);
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
      setCamera,
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
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
) {
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
  if (look.fog) {
    scene3D.enableFog = true;
    scene3D.fogMode = l.FogMode.Linear;
    scene3D.fogColor = new l.Color(...look.fog.color, 1);
    scene3D.fogStart = look.fog.start;
    scene3D.fogEnd = look.fog.end;
    cleanups.push(() => (scene3D.enableFog = false));
  }
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
