// 豬大花園島 (the garden island) as one call: everything the place itself is, built
// into a game's scene, and one update a frame.
//
//   const island = createGardenIsland(scene, camera, { ceiling: startTier(params).tier });
//   runtime.start((dt) => {
//     ... move the character and place the camera (island-walker) ...
//     island.update({ dt, hour, eye, target, bodies: [walker] });
//   });
//
// What it builds, in this order (the order the game built it in): the day's look
// (ZhudaSceneLook with day-look's OCEAN setting), the one water sheet that is the lily
// pond, the stream and the far pool (ZhudaWaterSurface, with its mirror), the ground
// and everything standing on it (build.ts), the far islands (far.ts), the moving sea
// (sea.ts), the leaf cards, fallen petals and flower clumps (detail.ts), a point light
// at each lantern and terrace lamp, the grass (ZhudaGrassField, trodden down where a
// body walks) and the petals, motes, fireflies, stars and sea mist (fx.ts).
// The character, the camera and the input are the game's (see 3d/island-walker).
import { ZhudaGrassField, ZhudaQualityGovernor, ZhudaSceneLook, ZhudaWaterSurface, type ZhudaLookQuality } from 'zhuda-laya-engine';
import { OCEAN, skyAt, type SkyState, type Weather, type WeatherMix } from '../day-look.ts';
import { GARDEN_ISLAND_GRASS, ladder, makeTiers, type Step } from '../quality-tiers.ts';
import { approach, len, sub, type V3 } from '../math.ts';
import { HALF, START, WATER_Y, grassGrows, groundAt, heightAt, walkable } from './land.ts';
import { CROWN_SPHERES } from './views.ts';
import { buildIsland } from './build.ts';
import { buildDetail } from './detail.ts';
import { buildFar } from './far.ts';
import { buildSea } from './sea.ts';
import { GardenFx } from './fx.ts';

/** The four settings (low, mid, high, max) with this island's grass. */
export const GARDEN_TIERS = makeTiers(GARDEN_ISLAND_GRASS);
/** Share of leaf cards, fallen petals and flower clumps built at each setting (the phone numbers of 2026-11-18). */
export const GARDEN_DETAIL_SHARE = [0.4, 0.65, 1, 1] as const;
/** A frame longer than this (ms) counts against the setting when the governor is on. */
export const GARDEN_BUDGET_MS = 1000 / 55;

export interface GardenIslandOptions {
  /** The chosen setting, an index into GARDEN_TIERS (`startTier(params).tier`): the top of the governor's ladder. Default 1 (mid). */
  ceiling?: number;
  /** A fixed look level 0..3 (the game's `?quality=`). The ladder then leaves the look alone and the governor is off. */
  quality?: ZhudaLookQuality;
  /** The hour of the first look. Default 10. */
  hour?: number;
  /** Default 'clear'. */
  weather?: Weather;
  /** Parts of the look turned off (`?off=fog,dof,ao,clouds,…`; see 3d/day-look). */
  off?: readonly string[];
  /** Lens f-stop of the depth of field. Default 4, or 22 when `off` has 'dof'. */
  fStop?: number;
  /** The grass field (`?grass=0`: false). Default true. */
  grass?: boolean;
  /** Leaf cards, fallen petals and flower clumps (`?detail=0`: false). Default true. */
  detail?: boolean;
  /** Share of the detail to build, 0..1. Default GARDEN_DETAIL_SHARE[ceiling]. */
  detailShare?: number;
  /** Whether the crowns' leaf cards cast shadows. Default: at high and max. */
  detailShadows?: boolean;
  /** The pond's mirror (`?mirror=0`: false). Drawn every frame at look level 2 and up, every third below. Default true. */
  mirror?: boolean;
  /** Steps the setting down while frames run long, and back up (`?governor=0`: false). Default true; never with `quality`. */
  governor?: boolean;
}

/** Someone on the island: the walker of 3d/island-walker is one. */
export interface GardenBody {
  /** Where its feet are. */
  feet: V3;
  /** Which way it goes, radians, and how fast, m/s (for the rings it leaves when it wades). */
  yaw: number;
  speed: number;
}

export interface GardenFrame {
  /** Seconds since the last frame. */
  dt: number;
  /** The hour, 0..24 (the game runs the clock). */
  hour: number;
  /** The camera's eye and the point it looks at, after the camera has been placed this frame. */
  eye: V3;
  target: V3;
  /** Who is on the island. The first is the player: petals, motes and fireflies gather round them. Grass bends and water rings for all. */
  bodies?: readonly GardenBody[];
  /** A film frame (captured one frame at a time): the look is set every frame, the mirror drawn every frame, no governor. */
  film?: boolean;
  /** This frame's f-stop instead of the option's (a film shot's lens). */
  fStop?: number;
}

export interface GardenIsland {
  readonly look: ZhudaSceneLook;
  readonly water: ZhudaWaterSurface;
  readonly fx: GardenFx;
  /** The grass field, or null without grass. Rebuilt when the setting's grass changes. */
  readonly grass: ZhudaGrassField | null;
  /** The lantern and terrace lamps' lights: lit by night, out by day. */
  readonly lights: Laya.PointLightCom[];
  /** Materials that glow by night (lantern paper, terrace lamps). */
  readonly glows: Laya.Material[];
  /** The governor's rungs, cheapest first, and the one in use. */
  readonly steps: readonly Step[];
  readonly step: Step;
  /** Seconds since the island was built (the sea, the water and the grass's wind run on it). */
  readonly seconds: number;
  /** The last update's sky: night 0..1, sun 0..1, wind, the look. */
  readonly sky: SkyState;
  /** Where a character starts (the path above the beach). */
  readonly start: readonly [number, number];
  /** Tree crowns as spheres [x, y, z, r], for a camera that keeps out of them. */
  readonly crowns: readonly (readonly [number, number, number, number])[];
  /** The ground under a place (the terrace's top, a stepping stone's top), or null off the map. */
  groundAt(x: number, z: number): number | null;
  /** Whether a character may stand there: on land, out of deep water (stepping stones yes). */
  walkable(x: number, z: number): boolean;
  /** Height of the ground mesh itself (under the terrace and the stones too; the sea floor offshore). */
  heightAt(x: number, z: number): number;
  /** Moves to a rung of the ladder: look level, render scale, particles and grass. */
  applyStep(step: Step): void;
  /** Everything after the camera is placed: the look, water, sea, lights, grass, particles, governor. */
  update(frame: GardenFrame): SkyState;
  stats(): { setting: string; renderScale: number; quality: number; grass: ZhudaGrassField['stats'] | undefined; particles: number };
  dispose(): void;
}

export function createGardenIsland(scene: Laya.Scene3D, camera: Laya.Camera, options: GardenIslandOptions = {}): GardenIsland {
  const ceiling = options.ceiling ?? 1;
  const weather: Weather = options.weather ?? 'clear';
  const mixNow: WeatherMix = { rain: weather === 'rain' ? 1 : 0, storm: weather === 'storm' ? 1 : 0, mist: weather === 'mist' ? 1 : 0 };
  const off = options.off ?? [];
  const fStop = options.fStop ?? (off.includes('dof') ? 22 : 4);
  const fixedQuality = options.quality !== undefined;
  let focus = 12;
  const quality = (fixedQuality ? options.quality : GARDEN_TIERS[ceiling].look) as ZhudaLookQuality;
  const look = new ZhudaSceneLook(scene, camera, skyAt(options.hour ?? 10, mixNow, focus, 0, fStop, off, OCEAN).look, { quality, cameraPasses: { depth: true, opaque: true } });

  // ---- the pond, the stream and the pool: one level sheet, hidden by the ground elsewhere ----
  const water = new ZhudaWaterSurface(scene, {
    position: [-1, WATER_Y, -3],
    size: [46, 34],
    flow: [-0.12, 0.07],
    color: [0.07, 0.26, 0.36],
    clarity: 1.6,
    waveMeters: 0.5,
    waves: 0.22,
    glow: 0.3,
    foamDepth: 0.05,
    resolution: 512,
    sun: { toward: look.towardSun, color: [2.2, 2.0, 1.7] },
  });
  water.camera.clearFlag = camera.clearFlag;
  water.camera.clearColor = camera.clearColor;

  // ---- the island ----
  const built = buildIsland(scene);
  const farLand = buildFar(scene);
  const sea = buildSea(scene);
  const detail = options.detail === false ? null : buildDetail(scene, options.detailShare ?? GARDEN_DETAIL_SHARE[ceiling], options.detailShadows ?? ceiling >= 2);
  const holders: Laya.Sprite3D[] = [];
  const lights: Laya.PointLightCom[] = built.lamps.map(({ at, range }) => {
    const holder = new Laya.Sprite3D('lamp');
    const light = holder.addComponent(Laya.PointLightCom);
    light.color = new Laya.Color(1, 0.8, 0.56, 1);
    light.range = range;
    light.intensity = 0;
    scene.addChild(holder);
    holder.transform.position = new Laya.Vector3(...at);
    holders.push(holder);
    return light;
  });

  // ---- grass ----
  const makeGrass = (tier: number) =>
    options.grass === false
      ? null
      : new ZhudaGrassField(scene, {
          area: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF },
          ground: (x, z) => heightAt(x, z),
          grows: (x, z) => grassGrows(x, z),
          density: GARDEN_TIERS[tier].grass.density,
          distanceM: GARDEN_TIERS[tier].grass.distanceM,
          patchM: 6,
          heightM: [0.1, 0.26],
          widthM: 0.028,
          tip: [0.38, 0.58, 0.26],
          root: [0.16, 0.3, 0.12],
          dry: [0.7, 0.66, 0.36],
          dryness: 0.12,
          wind: { directionDeg: 30, strength: 0.4, speed: 1 },
          seed: 3,
        });
  const steps: Step[] = ladder(ceiling);
  let step = steps[steps.length - 1];
  let grass = makeGrass(step.tier);
  let grassTier = step.tier;
  let settleFor = 8;
  const fx = new GardenFx(scene);
  const applyStep = (next: Step) => {
    step = next;
    settleFor = 2.5;
    if (!fixedQuality) look.setStep({ look: GARDEN_TIERS[next.tier].look, renderScale: next.renderScale });
    fx.budget = GARDEN_TIERS[next.tier].particles;
    if (next.tier !== grassTier) {
      grass?.dispose();
      grass = makeGrass(next.tier);
      grassTier = next.tier;
    }
  };
  applyStep(step);

  const governor = new ZhudaQualityGovernor({ levels: steps.length, start: steps.length - 1, budgetMs: GARDEN_BUDGET_MS });
  const governed = options.governor !== false && !fixedQuality;
  const mirror = options.mirror !== false;
  let seconds = 0,
    skyTimer = 0,
    mirrorSkip = 0;
  let sky = skyAt(options.hour ?? 10, mixNow, focus, 0, fStop, off, OCEAN);

  return {
    look,
    water,
    fx,
    get grass() {
      return grass;
    },
    lights,
    glows: built.glows,
    steps,
    get step() {
      return step;
    },
    get seconds() {
      return seconds;
    },
    get sky() {
      return sky;
    },
    start: START,
    crowns: CROWN_SPHERES,
    groundAt,
    walkable,
    heightAt,
    applyStep,
    update({ dt, hour, eye, target, bodies = [], film = false, fStop: frameStop }) {
      seconds += dt;
      const fov = camera.fieldOfView;
      focus = approach(focus, len(sub(target, eye)), 4, dt);
      // The look follows the hour.
      skyTimer -= dt;
      sky = skyAt(hour, mixNow, focus, 0, frameStop ?? fStop, off, OCEAN);
      if (skyTimer <= 0 || film) {
        skyTimer = 0.1;
        look.setLook(sky.look);
        const p = sky.sun * 2.2 + 0.2;
        water.setSun({ toward: look.towardSun, color: [p, p * 0.92, p * 0.8] });
        water.camera.clearColor = camera.clearColor;
      }
      const aspect = Laya.stage.width / Laya.stage.height;
      water.update(eye, target, fov, aspect);
      look.update(eye, target, fov, aspect, dt);
      water.setTime(seconds);
      sea.setTime(seconds);
      // A body in the water leaves rings when it wades.
      water.setRipples(
        bodies
          .filter((b) => b.feet[1] < WATER_Y + 0.02)
          .map((b) => ({ x: b.feet[0], z: b.feet[2], radius: 0.35, strength: 1, velocity: [Math.sin(b.yaw) * b.speed, Math.cos(b.yaw) * b.speed] as [number, number] })),
      );
      // The mirror draws the scene again: every frame on a strong device, every third on a weak one.
      if (mirror && (film || look.quality >= 2 || ++mirrorSkip % 3 === 0)) water.render();
      for (const m of built.glows) m.setFloat('u_EmissionStrength', 0.25 + 5 * sky.night);
      for (const l of lights) l.intensity = 1.9 * sky.night;
      const windDir = 30 + 25 * Math.sin(seconds * 0.05);
      grass?.setWind({ directionDeg: windDir, strength: sky.wind, speed: 1 });
      grass?.setBenders(bodies.filter((b) => b.feet[1] > WATER_Y).map((b) => ({ position: b.feet, radius: 0.5 })));
      grass?.update(eye, seconds);
      fx.wind = [Math.cos((windDir * Math.PI) / 180) * sky.wind * 2, Math.sin((windDir * Math.PI) / 180) * sky.wind * 2];
      fx.night = sky.night;
      fx.sun = sky.sun;
      fx.update(dt, eye, bodies[0]?.feet ?? target, camera);
      settleFor = Math.max(0, settleFor - dt);
      if (governed && !film && settleFor === 0) {
        const level = governor.sample(dt * 1000);
        if (level !== undefined && steps[level] && steps[level] !== step) applyStep(steps[level]);
      }
      return sky;
    },
    stats: () => ({ setting: GARDEN_TIERS[step.tier].id, renderScale: step.renderScale, quality: look.quality, grass: grass?.stats, particles: fx.alive }),
    dispose() {
      fx.dispose();
      grass?.dispose();
      water.dispose();
      detail?.dispose();
      farLand.dispose();
      sea.dispose();
      built.dispose();
      for (const h of holders) h.destroy(true);
      look.dispose();
    },
  };
}
