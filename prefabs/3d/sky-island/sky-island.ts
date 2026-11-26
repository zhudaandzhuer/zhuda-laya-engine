// The floating island above a sea of cloud, built in a scene: the look (sun, sky,
// fog and the cloud sea below), the pond's water, the island, the windmill cottage,
// the big tree, the props, the plants and stones of 3d/nature-pack, glowing windows
// and lanterns at night, the grass, and the weather's particles (IslandFx).
// update() each frame turns the sails with the wind, sways the crown, bobs the crate
// in the pond, lights the windows by night and moves grass, water and particles.
//
// Characters are the game's (3d/island-pig): give them SKY_ISLAND_WORLD (layout.ts),
// pass where they stand as grass `benders`, and use `fx` for their bursts.
import { ZhudaGrassField, ZhudaSceneLook, ZhudaWaterSurface, type ModelInstance, type ZhudaFilmLook, type ZhudaLookQuality, type ZhudaModelLibrary } from 'zhuda-laya-engine';
import { IslandFx } from './fx.ts';
import { HOUSE, POND, TREE, WATER_Y, groundAt } from './ground.ts';
import { CHIMNEY, LAMPS, NATURE, OBSTACLES, PROPS, SKY_ISLAND_WORLD, TREE_PLACE, WINDMILL, crateAt, grassGrows, islandPath } from './layout.ts';
import { naturePath } from '../nature-pack/nature-pack.ts';
import type { SkyState } from '../day-look.ts';
import type { TierGrass } from '../quality-tiers.ts';
import type { V3 } from '../math.ts';

export interface SkyIslandOptions {
  /** The first look (skyAt(...).look of 3d/day-look) and the look's level (1..3). */
  look: ZhudaFilmLook;
  quality: ZhudaLookQuality;
  /** The camera's vertical field of view, degrees. */
  fov: number;
  /** Where the models come from: a library on a provider rooted at the page (baseUrl './'). */
  models: ZhudaModelLibrary;
  /** More models to load in the same batch (the characters), returned as `extra` in this order. */
  alsoLoad?: { path: string; independentMaterials?: boolean }[];
  /** Grass blades a square metre and how far they are drawn, or null for none (3d/quality-tiers). */
  grass: TierGrass | null;
  /** A soft moonlight that follows a point the game gives each frame (`moonlightAt`), so characters never show as shadows at night. */
  moonlight?: boolean;
  /** Loading progress, for a loading note: models arrived, all of them, and whether one is being tried again. */
  onProgress?: (arrived: number, total: number, retrying: boolean) => void;
}

/** What the island needs each frame. */
export interface SkyIslandFrame {
  dt: number;
  /** Seconds since the scene started (wind, water and crate motion). */
  seconds: number;
  eye: V3;
  /** What the camera looks at. */
  target: V3;
  /** The hour and weather's look (skyAt of 3d/day-look). */
  sky: SkyState;
  /** Lightning now (the look is refreshed every frame while it flashes, else ten times a second). */
  flash: number;
  /** How stormy it is, 0..1 (grass waves faster). */
  storm: number;
  /** Where the grass is pressed down: up to four places and radii (the characters' feet, a hard landing). */
  benders?: { position: V3; radius: number }[];
  /** Where the moonlight hangs (with `moonlight: true`). */
  moonlightAt?: V3;
}

export interface SkyIsland {
  readonly look: ZhudaSceneLook;
  readonly water: ZhudaWaterSurface;
  /** Weather particles, and the bursts for characters (dust, splashes, stars, hearts…). */
  readonly fx: IslandFx;
  readonly grass: ZhudaGrassField | null;
  /** The `alsoLoad` models, in order. */
  readonly extra: ModelInstance[];
  /** The island for characters (3d/island-pig's PigWorld) and what they walk round. */
  readonly world: typeof SKY_ISLAND_WORLD;
  readonly obstacles: typeof OBSTACLES;
  /** The windmill's hub, for its creak (3d/island-sound). */
  readonly windmill: V3;
  /** Applies a picture setting: the look's level (null: leave it) and resolution, the share of particles, the grass (rebuilt only when it changes). */
  setQuality(q: { look: ZhudaLookQuality | null; renderScale: number; particles: number; grass: TierGrass | null }): void;
  update(frame: SkyIslandFrame): void;
  readonly stats: { grass: ZhudaGrassField['stats'] | undefined; particles: number; quality: ZhudaLookQuality };
  /** Releases what the island made (not the model library, which is the game's). */
  dispose(): void;
}

/** Loads one model, trying again (up to about four minutes) when the site is away for a moment. */
export async function fetchModel(models: ZhudaModelLibrary, path: string, options: { independentMaterials?: boolean } = {}, onRetry?: () => void, tries = 6): Promise<ModelInstance> {
  for (let tryNo = 0; ; tryNo++) {
    try {
      return await models.instantiate(path, { retries: 1, ...(options.independentMaterials ? { independentMaterials: true } : {}) });
    } catch (error) {
      if (tryNo >= tries) throw error;
      onRetry?.();
      await new Promise((r) => setTimeout(r, Math.min(30_000, 3000 * 2 ** tryNo)));
    }
  }
}

/** Builds the island in `scene` for `camera`; resolves once every model is in. */
export async function createSkyIsland(scene: Laya.Scene3D, camera: Laya.Camera, options: SkyIslandOptions): Promise<SkyIsland> {
  const look = new ZhudaSceneLook(scene, camera, options.look, { quality: options.quality, cameraPasses: { depth: true, opaque: true } });

  // ---- the pond ----
  const water = new ZhudaWaterSurface(scene, {
    position: [POND.center[0], WATER_Y, POND.center[1]],
    size: [POND.radii[0] * 2 + 0.8, POND.radii[1] * 2 + 0.8],
    flow: [0.05, 0.02],
    color: [0.08, 0.2, 0.2],
    clarity: 2.2,
    waveMeters: 0.45,
    waves: 0.25,
    glow: 0.25,
    foamDepth: 0.04,
    resolution: 512,
    sun: { toward: look.towardSun, color: [2.2, 2.0, 1.7] },
  });
  water.camera.clearFlag = camera.clearFlag;
  water.camera.clearColor = camera.clearColor;

  // ---- models ----
  const natureFiles = [...new Set(NATURE.map((n) => n[0]))];
  const extra = options.alsoLoad ?? [];
  const files: { path: string; independentMaterials?: boolean }[] = [
    { path: islandPath('island') },
    { path: islandPath('house') },
    { path: islandPath('props') },
    ...extra,
    { path: islandPath('tree') },
    ...natureFiles.map((id) => ({ path: naturePath(id) })),
  ];
  let arrived = 0;
  options.onProgress?.(arrived, files.length, false);
  const loaded = await Promise.all(
    files.map(async (f) => {
      const model = await fetchModel(options.models, f.path, f, () => options.onProgress?.(arrived, files.length, true));
      options.onProgress?.(++arrived, files.length, false);
      return model;
    }),
  );
  const [islandModel, house, props] = loaded;
  const extraModels = loaded.slice(3, 3 + extra.length);
  const [treeModel, ...natureModels] = loaded.slice(3 + extra.length);

  const shade = (node: Laya.Node, cast = true) => {
    const r = (node as Laya.Sprite3D).getComponent?.(Laya.MeshRenderer) as Laya.MeshRenderer | null;
    if (r) (r.castShadow = cast), (r.receiveShadow = true);
    const sr = (node as Laya.Sprite3D).getComponent?.(Laya.SkinnedMeshRenderer) as Laya.SkinnedMeshRenderer | null;
    if (sr) (sr.castShadow = cast), (sr.receiveShadow = true);
    for (let i = 0; i < node.numChildren; i++) shade(node.getChildAt(i), cast);
  };
  const place = (node: Laya.Sprite3D, x: number, z: number, turnDeg = 0, s = 1, y?: number) => {
    scene.addChild(node);
    node.transform.position = new Laya.Vector3(x, y ?? groundAt(x, z) ?? 0, z);
    node.transform.rotationEuler = new Laya.Vector3(0, turnDeg, 0);
    if (s !== 1) node.transform.localScale = new Laya.Vector3(s, s, s);
    shade(node);
    return node;
  };
  place(islandModel.node, 0, 0, 0, 1, 0);
  place(house.node, HOUSE.center[0], HOUSE.center[1], 0, 1, HOUSE.height);
  const sails = house.find('sails');
  // The sails turn about the axis out of their own plane (local z), after the turn the file gives the node.
  const sailsRest = sails ? sails.transform.localRotation.clone() : null;
  // Props: each placement is a copy of one node of props.glb.
  const propNodes: Laya.Sprite3D[] = [];
  for (const [name, x, z, turn] of PROPS) {
    const source = props.find(name);
    if (!source) continue;
    const copy = source.clone() as Laya.Sprite3D;
    propNodes.push(place(copy, x, z, turn, 1, name === 'crate' ? WATER_Y - 0.18 : undefined));
  }
  props.node.active = false;
  const crate = propNodes[PROPS.findIndex((p) => p[0] === 'crate')];
  place(treeModel.node, TREE.center[0], TREE.center[1], TREE_PLACE.turn, TREE_PLACE.scale, (groundAt(TREE.center[0], TREE.center[1]) ?? 0) - TREE_PLACE.sink);
  const canopy = treeModel.find('canopy');
  const canopyRest = canopy ? canopy.transform.localRotation.clone() : null;
  const natureById = new Map(natureFiles.map((id, i) => [id, natureModels[i]]));
  const usedOnce = new Set<string>();
  for (const [id, x, z, s, turn] of NATURE) {
    const model = natureById.get(id)!;
    const node = usedOnce.has(id) ? (model.node.clone() as Laya.Sprite3D) : model.node;
    usedOnce.add(id);
    place(node, x, z, turn, s, (groundAt(x, z) ?? 0) - 0.03);
  }
  // Glowing windows and the lamp: the material `glow`, lit by night.
  const glows: Laya.Material[] = [];
  const collect = (node: Laya.Node) => {
    const r = (node as Laya.Sprite3D).getComponent?.(Laya.MeshRenderer) as Laya.MeshRenderer | null;
    if (r) for (const m of r.sharedMaterials) if (m && m.name === 'glow' && !glows.includes(m)) glows.push(m);
    for (let i = 0; i < node.numChildren; i++) collect(node.getChildAt(i));
  };
  collect(house.node);
  for (const n of propNodes) collect(n);
  const pointLight = (name: string, color: [number, number, number], range: number, at?: V3) => {
    const holder = new Laya.Sprite3D(name);
    const light = holder.addComponent(Laya.PointLightCom);
    light.color = new Laya.Color(color[0], color[1], color[2], 1);
    light.range = range;
    light.intensity = 0;
    scene.addChild(holder);
    if (at) holder.transform.position = new Laya.Vector3(...at);
    return { holder, light };
  };
  const lamps = LAMPS.map((l) => pointLight('lamp-light', [1, 0.62, 0.3], l.range, l.at).light);
  const moon = options.moonlight ? pointLight('night-glow', [0.75, 0.82, 1], 6) : null;

  // ---- grass ----
  const makeGrass = (g: TierGrass | null) =>
    g &&
    new ZhudaGrassField(scene, {
      area: { minX: -8.6, maxX: 8.6, minZ: -8.6, maxZ: 8.6 },
      ground: groundAt,
      grows: grassGrows,
      density: g.density,
      distanceM: g.distanceM,
      patchM: 3,
      heightM: [0.12, 0.32],
      widthM: 0.022,
      tip: [0.42, 0.62, 0.2],
      root: [0.1, 0.18, 0.05],
      dry: [0.72, 0.64, 0.34],
      dryness: 0.18,
      wind: { directionDeg: 30, strength: 0.4, speed: 1 },
      seed: 3,
    });
  let grassNow = options.grass;
  let grass = makeGrass(grassNow);

  const fx = new IslandFx(scene);
  fx.chimney = [...CHIMNEY];

  let skyTimer = 0,
    sailAngle = 0,
    mirrorSkip = 0;
  return {
    look,
    water,
    fx,
    get grass() {
      return grass;
    },
    extra: extraModels,
    world: SKY_ISLAND_WORLD,
    obstacles: OBSTACLES,
    windmill: WINDMILL,
    setQuality(q) {
      if (q.look !== null) look.setStep({ look: q.look, renderScale: q.renderScale });
      fx.budget = q.particles;
      if (q.grass?.density !== grassNow?.density || q.grass?.distanceM !== grassNow?.distanceM) {
        grass?.dispose();
        grass = makeGrass(q.grass);
        grassNow = q.grass;
      }
    },
    update(f) {
      const { dt, seconds, eye, target, sky } = f;
      grass?.setBenders(f.benders ?? []);
      // the crate bobs in the pond
      if (crate) {
        const c = crateAt(seconds);
        crate.transform.position = new Laya.Vector3(...c.position);
        crate.transform.rotationEuler = new Laya.Vector3(...c.euler);
      }
      // the look: the hour and the weather, ten times a second (every frame during lightning)
      skyTimer -= dt;
      if (skyTimer <= 0 || f.flash > 0) {
        skyTimer = 0.1;
        look.setLook(sky.look);
        const p = sky.sun * 2.2 + 0.2;
        water.setSun({ toward: look.towardSun, color: [p, p * 0.92, p * 0.8] });
        water.camera.clearColor = camera.clearColor;
      }
      const aspect = Laya.stage.width / Laya.stage.height;
      water.update(eye, target, options.fov, aspect);
      look.update(eye, target, options.fov, aspect, dt);
      water.setTime(seconds);
      if (look.quality >= 2 || ++mirrorSkip % 2 === 0) water.render();
      // lamps and windows at night
      for (const m of glows) m.setFloat('u_EmissionStrength', 0.3 + 5.5 * sky.night);
      for (const l of lamps) l.intensity = 6 * sky.night;
      if (moon) {
        moon.light.intensity = 2.2 * sky.night;
        if (f.moonlightAt) moon.holder.transform.position = new Laya.Vector3(...f.moonlightAt);
      }
      // wind: grass, sails, smoke, leaves
      const windDir = 30 + 25 * Math.sin(seconds * 0.05);
      grass?.setWind({ directionDeg: windDir, strength: sky.wind, speed: 1 + f.storm });
      fx.windX = Math.cos((windDir * Math.PI) / 180) * sky.wind * 2;
      fx.windZ = Math.sin((windDir * Math.PI) / 180) * sky.wind * 2;
      sailAngle += dt * (0.5 + sky.wind * 1.6);
      if (sails && sailsRest) {
        const spin = new Laya.Quaternion();
        Laya.Quaternion.createFromAxisAngle(new Laya.Vector3(0, 0, 1), sailAngle, spin);
        const q = new Laya.Quaternion();
        Laya.Quaternion.multiply(sailsRest, spin, q);
        sails.transform.localRotation = q;
      }
      grass?.update(eye, seconds);
      if (canopy && canopyRest) {
        // the crown sways in the wind, more in a storm
        const sway = new Laya.Quaternion();
        const gust = sky.wind * (0.6 + 0.4 * Math.sin(seconds * 0.7));
        Laya.Quaternion.createFromYawPitchRoll(0, (Math.sin(seconds * 1.3) * 1.6 + 1.2) * gust * (Math.PI / 180), Math.cos(seconds * 0.9) * 1.4 * gust * (Math.PI / 180), sway);
        const q = new Laya.Quaternion();
        Laya.Quaternion.multiply(canopyRest, sway, q);
        canopy.transform.localRotation = q;
      }
      // the weather's particles
      fx.rainAmount = sky.rain;
      fx.night = sky.night;
      fx.sun = sky.sun;
      fx.update(dt, eye, camera, seconds);
    },
    get stats() {
      return { grass: grass?.stats, particles: fx.alive, quality: look.quality };
    },
    dispose() {
      fx.dispose();
      grass?.dispose();
      water.dispose();
      look.dispose();
      for (const m of [islandModel, house, props, treeModel, ...natureModels]) m.dispose();
    },
  };
}
