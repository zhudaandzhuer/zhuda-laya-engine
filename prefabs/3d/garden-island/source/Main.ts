// Zhuda Garden Island: an island garden walked in third person. A lily pond in a
// blossom grove, a stream to a far pool, a flagstone path with lanterns, bamboo,
// a stone terrace by the sea; the day passes into a night of lamps and fireflies.
import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaModelLibrary,
  ZhudaGrassField,
  ZhudaWaterSurface,
  ZhudaSceneLook,
  ZhudaQualityGovernor,
  DirectoryAssetProvider,
  type ZhudaLookQuality,
} from 'zhuda-laya-engine';
import { HALF, POND, START, TREES, WATER_Y, grassGrows, groundAt, heightAt } from './land.ts';
import { buildIsland } from './build.ts';
import { buildDetail } from './detail.ts';
import { buildFar } from './far.ts';
import { buildSea } from './sea.ts';
import { FPS, SHOTS, type Shot } from './film.ts';
import { createFilmMode, type FilmCue } from './film-mode.ts';
import { GardenFx } from './fx.ts';
import { Walker } from './walker.ts';
import { skyAt, type Weather, type WeatherMix } from './sky.ts';
import { TIERS, ladder, startTier, type Step } from './tiers.ts';
import { add, approach, clamp, len, scale, sub, type V3 } from './math.ts';

const FOV = 42;
const BUDGET_MS = 1000 / 55;

async function main() {
  const params = new URLSearchParams(location.search);
  const container = document.querySelector<HTMLElement>('#game')!;
  const width = Number(params.get('width')) || window.innerWidth || 1280,
    height = Number(params.get('height')) || window.innerHeight || 720;
  container.style.position = 'relative';
  const start = startTier(params);
  const ceiling = start.tier;
  const context = await ZhudaEngine.boot({
    container,
    width,
    height,
    dprCap: Number(params.get('dpr')) || TIERS[ceiling].dpr,
    features: ['core', '3d', 'gltf', 'postProcess'],
    bgColor: '#9fb6d2',
    maxLights: 16,
  });
  const scene = Zhuda3D.createScene3D(context.rootScene);
  const camera = Zhuda3D.createCamera(scene, { position: [9, 9, 30], rotationEuler: [-20, 10, 0], fov: FOV, near: 0.15, far: 1500 });

  // ---- hour and weather ----
  const weather: Weather = (params.get('weather') as Weather) || 'clear';
  let hour = Number(params.get('hour') ?? 10);
  let clockRuns = !params.has('hour');
  const mixNow: WeatherMix = { rain: weather === 'rain' ? 1 : 0, storm: weather === 'storm' ? 1 : 0, mist: weather === 'mist' ? 1 : 0 };
  let focus = 12;
  const off = (params.get('off') || '').split(',');
  const fStop = off.includes('dof') ? 22 : Number(params.get('fstop')) || 4;
  const quality = (params.has('quality') ? Number(params.get('quality')) : TIERS[ceiling].look) as ZhudaLookQuality;
  const look = new ZhudaSceneLook(scene, camera, skyAt(hour, mixNow, focus, 0, fStop, off).look, { quality, cameraPasses: { depth: true, opaque: true } });

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
  const island = buildIsland(scene);
  const farLand = buildFar(scene);
  const sea = buildSea(scene);
  const detail = params.get('detail') === '0' ? null : buildDetail(scene, [0.4, 0.65, 1, 1][ceiling], ceiling >= 2);
  const lights: Laya.PointLightCom[] = island.lamps.map(({ at, range }) => {
    const holder = new Laya.Sprite3D('lamp');
    const light = holder.addComponent(Laya.PointLightCom);
    light.color = new Laya.Color(1, 0.8, 0.56, 1);
    light.range = range;
    light.intensity = 0;
    scene.addChild(holder);
    holder.transform.position = new Laya.Vector3(...at);
    return light;
  });

  // ---- grass ----
  const makeGrass = (tier: number) =>
    params.get('grass') === '0'
      ? null
      : new ZhudaGrassField(scene, {
          area: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF },
          ground: (x, z) => heightAt(x, z),
          grows: (x, z) => grassGrows(x, z),
          density: TIERS[tier].grass.density,
          distanceM: TIERS[tier].grass.distanceM,
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
  let steps: Step[] = ladder(ceiling);
  let step = steps[steps.length - 1];
  let grass = makeGrass(step.tier);
  let grassTier = step.tier;
  let settleFor = 8;
  const fx = new GardenFx(scene);
  const applyStep = (next: Step) => {
    step = next;
    settleFor = 2.5;
    if (!params.has('quality')) look.setStep({ look: TIERS[next.tier].look, renderScale: next.renderScale });
    fx.budget = TIERS[next.tier].particles;
    if (next.tier !== grassTier) {
      grass?.dispose();
      grass = makeGrass(next.tier);
      grassTier = next.tier;
    }
  };
  applyStep(step);

  // ---- the character ----
  const provider = new DirectoryAssetProvider({ baseUrl: './assets/', timeoutMs: 240_000, maxBytes: 256 * 1024 * 1024 });
  const models = new ZhudaModelLibrary({ provider, timeoutMs: 240_000 });
  const pigModel = await models.instantiate('characters/zhuda.glb', { retries: 2, independentMaterials: true });
  const walker = new Walker(pigModel, START);
  scene.addChild(walker.root);
  const shade = (node: Laya.Node) => {
    const sr = (node as Laya.Sprite3D).getComponent?.(Laya.SkinnedMeshRenderer) as Laya.SkinnedMeshRenderer | null;
    if (sr) (sr.castShadow = true), (sr.receiveShadow = true);
    for (let i = 0; i < node.numChildren; i++) shade(node.getChildAt(i));
  };
  shade(walker.root);

  // ---- camera and input: drag turns the view, wheel or pinch zooms, keys or a held touch walk ----
  const orbit = { yaw: 0.25, pitch: 0.32, distance: Number(params.get('distance')) || 8 };
  const goal = { ...orbit };
  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  const canvas = container.querySelector('canvas') as HTMLCanvasElement;
  const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; left: boolean }>();
  let pinch = 0;
  let touchStick: [number, number] = [0, 0];
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    // A touch on the left third of the screen is the walking stick; anything else turns the view.
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, left: e.pointerType === 'touch' && e.clientX - rect.left < rect.width * 0.38 });
    pinch = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.left) {
      const l = Math.hypot(p.x - p.sx, p.y - p.sy);
      const k = Math.min(1, l / 60) / (l || 1);
      touchStick = [(p.x - p.sx) * k, (p.y - p.sy) * k];
      return;
    }
    const turning = [...pointers.values()].filter((q) => !q.left);
    if (turning.length === 2) {
      const span = Math.hypot(turning[0].x - turning[1].x, turning[0].y - turning[1].y);
      if (pinch) goal.distance = clamp(goal.distance * (pinch / span), 3, 40);
      pinch = span;
      return;
    }
    goal.yaw -= dx * 0.006;
    goal.pitch = clamp(goal.pitch + dy * 0.004, 0.02, 1.3);
  });
  const lift = (e: PointerEvent) => {
    if (pointers.get(e.pointerId)?.left) touchStick = [0, 0];
    pointers.delete(e.pointerId);
    pinch = 0;
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      goal.distance = clamp(goal.distance * Math.exp(e.deltaY * 0.001), 3, 40);
    },
    { passive: false },
  );

  // ---- the frame ----
  let governor = new ZhudaQualityGovernor({ levels: steps.length, start: steps.length - 1, budgetMs: BUDGET_MS });
  const governed = params.get('governor') !== '0' && !params.has('quality');
  let seconds = 0,
    frames = 0,
    since = 0,
    lastFps = 0,
    skyTimer = 0,
    mirrorSkip = 0;
  let target: V3 = [walker.feet[0], walker.feet[1] + 1, walker.feet[2]];
  let lookAt: V3 | null = null;
  const mirror = params.get('mirror') !== '0';
  // The browser's bars come and go on a phone: the picture follows the window.
  window.addEventListener('resize', () => context.resize());
  let boom = orbit.distance;
  const crowns = TREES.map((t) => [t.x + t.lean * t.height * 0.5, (groundAt(t.x, t.z) ?? 0) + t.height, t.z, t.crown * 1.05] as [number, number, number, number]);
  Reflect.set(window, '__ISLAND__', {
    walker,
    fx,
    state: () => ({ backend: context.renderer.selected, view: [Laya.stage.width, Laya.stage.height, window.innerWidth, window.innerHeight], feet: walker.feet, hour, fps: lastFps, grass: grass?.stats, particles: fx.alive, quality: look.quality, setting: TIERS[step.tier].id, renderScale: step.renderScale }),
    set: (o: { hour?: number; run?: boolean; yaw?: number; pitch?: number; distance?: number; at?: [number, number]; walkTo?: [number, number]; lookAt?: V3 | null; face?: number }) => {
      if (o.hour !== undefined) hour = o.hour;
      if (o.run !== undefined) clockRuns = o.run;
      if (o.yaw !== undefined) orbit.yaw = goal.yaw = o.yaw;
      if (o.pitch !== undefined) orbit.pitch = goal.pitch = o.pitch;
      if (o.distance !== undefined) orbit.distance = goal.distance = o.distance;
      if (o.at) (walker.feet = [o.at[0], groundAt(o.at[0], o.at[1]) ?? 0, o.at[1]]), (target = [walker.feet[0], walker.feet[1] + 1, walker.feet[2]]);
      if (o.walkTo) walker.goal = o.walkTo;
      if (o.lookAt !== undefined) lookAt = o.lookAt;
      if (o.face !== undefined) walker.yaw = o.face;
    },
    errors: () => context.renderer.errors.slice(0, 6),
  });
  // ---- film mode (?film=1): time moves one frame at a time, when the capture asks (src/film-mode.ts) ----
  const film = createFilmMode(container, SHOTS, params, FPS);
  const filming = film.active;
  film.reportErrors(() => context.renderer.errors.slice(0, 6));
  let filmStop = fStop;
  const applyShot = ({ shot, cut, local, u, ease }: FilmCue<Shot>) => {
    if (cut) {
      // A cut: the character and the eye are put in place at once.
      walker.feet = [shot.at[0], groundAt(shot.at[0], shot.at[1]) ?? 0, shot.at[1]];
      walker.yaw = shot.face;
      walker.speed = 0;
      walker.goal = shot.walkTo ?? null;
      walker.act = null;
      const first = shot.from.lookAt ?? ([walker.feet[0], walker.feet[1] + 1, walker.feet[2]] as V3);
      target = [first[0], first[1], first[2]];
      boom = shot.from.distance;
    }
    walker.act = shot.act && local >= (shot.actAt ?? 0) ? shot.act : null;
    hour = shot.hour[0] + (shot.hour[1] - shot.hour[0]) * u;
    orbit.yaw = goal.yaw = shot.from.yaw + (shot.to.yaw - shot.from.yaw) * ease;
    orbit.pitch = goal.pitch = shot.from.pitch + (shot.to.pitch - shot.from.pitch) * ease;
    orbit.distance = goal.distance = shot.from.distance + (shot.to.distance - shot.from.distance) * ease;
    const a = shot.from.lookAt,
      b = shot.to.lookAt ?? a;
    lookAt = a && b ? [a[0] + (b[0] - a[0]) * ease, a[1] + (b[1] - a[1]) * ease, a[2] + (b[2] - a[2]) * ease] : null;
    filmStop = shot.fStop ?? 4;
  };
  context.runtime.start((frameDt: number) => {
    let dt = frameDt;
    if (filming) {
      clockRuns = false;
      const cue = film.step();
      dt = cue ? 1 / film.fps : 0;
      if (cue) applyShot(cue);
    }
    seconds += dt;
    if (clockRuns) hour = (hour + dt * 0.06) % 24;
    // Walking: keys and the touch stick are read against the way the camera faces.
    let kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + touchStick[0],
      kz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + touchStick[1];
    const kl = Math.hypot(kx, kz);
    if (kl > 1) (kx /= kl), (kz /= kl);
    const fwd: [number, number] = [-Math.sin(orbit.yaw), -Math.cos(orbit.yaw)],
      right: [number, number] = [Math.cos(orbit.yaw), -Math.sin(orbit.yaw)];
    walker.update(dt, [right[0] * kx - fwd[0] * kz, right[1] * kx - fwd[1] * kz]);
    // The camera follows the character, above the ground.
    orbit.yaw = approach(orbit.yaw, goal.yaw, 8, dt);
    orbit.pitch = approach(orbit.pitch, goal.pitch, 8, dt);
    orbit.distance = approach(orbit.distance, goal.distance, 6, dt);
    const want: V3 = lookAt ?? [walker.feet[0], walker.feet[1] + 1.0, walker.feet[2]];
    target = [approach(target[0], want[0], 6, dt), approach(target[1], want[1], 6, dt), approach(target[2], want[2], 6, dt)];
    const dir: V3 = [Math.sin(orbit.yaw) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.cos(orbit.yaw) * Math.cos(orbit.pitch)];
    // A crown between the eye and the character brings the eye in front of it.
    let reach = orbit.distance;
    // (Not in a film: its shots are framed by hand, and a far wide shot would be pulled into the trees.)
    for (let d = 1.5; d < orbit.distance && !filming; d += 0.5) {
      const p = add(target, scale(dir, d));
      if (crowns.some((c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < c[3])) {
        // Only when that still leaves a view: closer than this the eye stays where it is, inside the leaves for a moment.
        reach = Math.max(3, d - 0.6);
        break;
      }
    }
    boom = reach < boom ? reach : approach(boom, reach, 3, dt);
    const eye = add(target, scale(dir, boom));
    const floor = (groundAt(eye[0], eye[2]) ?? 0) + 0.4;
    if (eye[1] < floor) eye[1] = floor;
    camera.transform.position = new Laya.Vector3(...eye);
    camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0), false);
    focus = approach(focus, len(sub(target, eye)), 4, dt);
    // The look follows the hour.
    skyTimer -= dt;
    const sky = skyAt(hour, mixNow, focus, 0, filming ? filmStop : fStop, off);
    if (skyTimer <= 0 || filming) {
      skyTimer = 0.1;
      look.setLook(sky.look);
      const p = sky.sun * 2.2 + 0.2;
      water.setSun({ toward: look.towardSun, color: [p, p * 0.92, p * 0.8] });
      water.camera.clearColor = camera.clearColor;
    }
    const aspect = Laya.stage.width / Laya.stage.height;
    water.update(eye, target, FOV, aspect);
    look.update(eye, target, FOV, aspect, dt);
    water.setTime(seconds);
    sea.setTime(seconds);
    // The body in the water leaves rings when it wades.
    water.setRipples(walker.feet[1] < WATER_Y + 0.02 ? [{ x: walker.feet[0], z: walker.feet[2], radius: 0.35, strength: 1, velocity: [Math.sin(walker.yaw) * walker.speed, Math.cos(walker.yaw) * walker.speed] }] : []);
    // The mirror draws the scene again: every frame on a strong device, every third on a weak one.
    if (mirror && (filming || look.quality >= 2 || ++mirrorSkip % 3 === 0)) water.render();
    for (const m of island.glows) m.setFloat('u_EmissionStrength', 0.25 + 5 * sky.night);
    for (const l of lights) l.intensity = 1.9 * sky.night;
    const windDir = 30 + 25 * Math.sin(seconds * 0.05);
    grass?.setWind({ directionDeg: windDir, strength: sky.wind, speed: 1 });
    grass?.setBenders(walker.feet[1] > WATER_Y ? [{ position: walker.feet, radius: 0.5 }] : []);
    grass?.update(eye, seconds);
    fx.wind = [Math.cos((windDir * Math.PI) / 180) * sky.wind * 2, Math.sin((windDir * Math.PI) / 180) * sky.wind * 2];
    fx.night = sky.night;
    fx.sun = sky.sun;
    fx.update(dt, eye, walker.feet, camera);
    settleFor = Math.max(0, settleFor - dt);
    if (governed && !filming && settleFor === 0) {
      const level = governor.sample(dt * 1000);
      if (level !== undefined && steps[level] && steps[level] !== step) applyStep(steps[level]);
    }
    frames++;
    since += dt;
    if (since >= 0.5) {
      lastFps = Math.round(frames / since);
      frames = since = 0;
    }
    void governor;
    void POND;
  });
  void steps;
  window.addEventListener(
    'pagehide',
    () => {
      walker.dispose();
      fx.dispose();
      grass?.dispose();
      water.dispose();
      detail?.dispose();
      farLand.dispose();
      sea.dispose();
      island.dispose();
      look.dispose();
      pigModel.dispose();
      models.dispose();
      provider.dispose();
      context.dispose();
    },
    { once: true },
  );
}

void main().catch((error) => {
  console.error(error);
  const box = document.createElement('pre');
  box.style.cssText = 'position:absolute;left:12px;bottom:12px;color:#fff;background:rgba(120,0,0,.7);padding:8px;white-space:pre-wrap;max-width:80%;z-index:9';
  box.textContent = String(error?.stack || error);
  document.body.appendChild(box);
});
