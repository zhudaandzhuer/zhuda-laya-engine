// 豬大浮島 (games/zhuda-sky-island) rebuilt from the library: the floating island,
// one Zhuda who wanders, can be picked up by the scruff, swung and thrown, the
// weather and the hour, the overlay, the sounds and the picture budget.
//
// Address: ?hour=18 (fixed hour; else the clock runs, a five-minute day), ?weather=rain|storm|mist,
// ?fx=low|mid|high|max, ?governor=0, ?quality=0..3 (fixes the look's level), ?dpr=1,
// ?off=fog,dof,blur,ssr,ao,clouds,exposure,flare,shafts,msaa, ?grass=0, ?seed=5, ?distance=,
// ?fstop=, ?cast=zhuda2|zhuer (the redesigned Zhuda or Zhuer instead of the film's Zhuda).
// window.__SCENE__ offers what the game's window.__ISLAND__ did: pig, press, move, release,
// project, fx, sound, state(), set({hour, weather, run, yaw, pitch, distance}), errors().
import { ZhudaEngine, Zhuda3D, ZhudaModelLibrary, ZhudaQualityGovernor, DirectoryAssetProvider, type ZhudaLookQuality } from 'zhuda-laya-engine';
import { createSkyIsland } from '../common/3d/sky-island/sky-island.ts';
import { HOME_VIEW, WINDMILL } from '../common/3d/sky-island/layout.ts';
import { groundAt } from '../common/3d/sky-island/ground.ts';
import { createIslandDay } from '../common/3d/sky-island/day.ts';
import { Pig, SKY_ISLAND_GAME_PIG, earAndTailSprings } from '../common/3d/island-pig/pig.ts';
import { createHand } from '../common/3d/island-pig/hand.ts';
import { createIslandSound } from '../common/3d/island-sound/island-sound.ts';
import { createSceneControls } from '../common/ui/scene-controls/scene-controls.ts';
import { skyAt, clockText, WEATHERS, type Weather } from '../common/3d/day-look.ts';
import { makeTiers, SKY_ISLAND_GRASS, ladder, startTier, type Step } from '../common/3d/quality-tiers.ts';
import { characterPath } from '../common/3d/zhuda-characters/zhuda-characters.ts';
import { add, approach, clamp, len, random, scale, sub, type V3 } from '../common/3d/math.ts';
import { setSceneHook, type ScenePreset } from '../preset.ts';
import { loadingNote, linkStyle } from '../page.ts';

const FOV = 38;
const TIERS = makeTiers(SKY_ISLAND_GRASS);
/** Frames averaging over this (times the governor's 1.12) step the picture down: below about 49 fps. */
const BUDGET_MS = 1000 / 55;
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;

export const skyIsland: ScenePreset = {
  id: 'sky-island',
  title: '豬大浮島',
  summary: '雲海上的小浮島：風車小屋、池塘、大樹、會被風吹的草，晴雨雷霧與一天的時間。豬大自己走來走去，按住牠可以拎起來甩、放手丟出去（落地、頭暈、掉池塘游泳甩水、滑下屋頂、掉進雲海再從天而降）。',
  modules: ['3d/sky-island', '3d/island-pig', '3d/island-sound', 'ui/scene-controls', '3d/day-look', '3d/quality-tiers', '3d/zhuda-characters', '3d/nature-pack', '3d/math'],
  views: {
    白天: 'hour=10.5&fx=high',
    抓起來: 'hour=10.5&fx=high&distance=9&grab=1',
    雷雨: 'hour=16&weather=storm&fx=high',
    黃昏: 'hour=18.15&fx=high',
    夜晚: 'hour=22.5&fx=high',
    晨霧: 'hour=7.2&weather=mist&fx=high',
    改版豬大: 'hour=10.5&cast=zhuda2',
    豬二: 'hour=10.5&cast=zhuer',
    低畫質: 'fx=low',
  },
  async start(container, params) {
    const width = Number(params.get('width')) || window.innerWidth || 1280,
      height = Number(params.get('height')) || window.innerHeight || 720;
    container.style.position = 'relative';
    // The picture setting: ?fx=low|mid|high|max, else low on a phone and mid elsewhere.
    const start = startTier(params);
    let ceiling = start.tier;
    const context = await ZhudaEngine.boot({
      container,
      width,
      height,
      dprCap: Number(params.get('dpr')) || TIERS[ceiling].dpr,
      features: ['core', '3d', 'gltf', 'postProcess'],
      bgColor: '#9fb6d2',
    });
    const scene = Zhuda3D.createScene3D(context.rootScene);
    const camera = Zhuda3D.createCamera(scene, { position: [9, 7, 14], rotationEuler: [-20, 30, 0], fov: FOV, near: 0.1, far: 600 });
    const styled = linkStyle('common/ui/scene-controls/scene-controls.css');

    // ---- weather and time ----
    const rand = random(Number(params.get('seed')) || 5);
    let sound: ReturnType<typeof createIslandSound>;
    const day = createIslandDay({
      hour: Number(params.get('hour') ?? 9.5),
      weather: (params.get('weather') as Weather) || 'clear',
      clockRuns: !params.has('hour'),
      rand,
      // thunder after the flash, later the farther the bolt
      onBolt: (far) => setTimeout(() => sound.effect(far < 0.35 ? 'thunder-1' : far < 0.7 ? 'thunder-2' : 'thunder-3', undefined, 1 - far * 0.4), 150 + far * 2200),
    });
    let focus = 20;
    const off = (params.get('off') || '').split(',');
    const fStop = off.includes('dof') ? 22 : Number(params.get('fstop')) || 2.4;
    // ?quality=0..3 still fixes the look's level alone (for comparisons; the frame budget then leaves it).
    const quality = (params.has('quality') ? Number(params.get('quality')) : TIERS[ceiling].look) as ZhudaLookQuality;
    const steps0 = ladder(ceiling);
    const grassFor = (tier: number) => (params.get('grass') === '0' ? null : TIERS[tier].grass);

    // ---- the island, and Zhuda loaded with it ----
    const provider = new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 240_000, maxBytes: 256 * 1024 * 1024 });
    // A first visit on a slow line can take minutes: wait long and try again.
    const models = new ZhudaModelLibrary({ provider, timeoutMs: 240_000 });
    sound = createIslandSound({ provider, voices: ['zhuda'], storageKey: 'zhuda-sky-island.sound' });
    // ?cast=zhuda2 (the 2026 redesign of Zhuda) or ?cast=zhuer plays that character instead of the film's Zhuda.
    const cast = characterPath(({ zhuda2: 'zhuda', zhuer: 'zhuer' } as const)[params.get('cast') as 'zhuda2' | 'zhuer'] ?? 'zhuda-watchman');
    const note = loadingNote(container, '豬大浮島載入中…');
    const island = await createSkyIsland(scene, camera, {
      look: skyAt(day.hour, day.mix, focus, 0, fStop, off).look,
      quality,
      fov: FOV,
      models,
      alsoLoad: [{ path: cast, independentMaterials: true }],
      grass: grassFor(steps0[steps0.length - 1].tier),
      onProgress: note.progress,
    });
    note.remove();
    await styled;
    const { look, fx } = island;
    const [pigModel] = island.extra;

    // What is applied now: a rung of the ladder (a setting and a resolution).
    let steps: Step[] = steps0;
    let step = steps[steps.length - 1];
    let chosenByPlayer = false;
    // Loading, first shader compiles and the first grass are slow frames that say nothing about the device.
    let settleFor = 8;
    /** Puts a rung in place: the look's level and resolution at once, the grass only when its setting changes. */
    const applyStep = (next: Step) => {
      step = next;
      // A change itself costs frames (new shaders, a new field of grass): the budget waits before judging again.
      settleFor = 2.5;
      island.setQuality({ look: params.has('quality') ? null : TIERS[next.tier].look, renderScale: next.renderScale, particles: TIERS[next.tier].particles, grass: grassFor(next.tier) });
    };
    applyStep(step);

    // ---- Zhuda ----
    const eyeNow = (): V3 => {
      const p = camera.transform.position;
      return [p.x, p.y, p.z];
    };
    let shakeCamera = 0;
    let shook = false;
    let lastState = '';
    let talkClock = 25;
    let lastWeather = day.weather;
    let saidNight = false;
    let impact = 0;
    let impactAt: V3 = [0, 0, 0];
    const hud = createSceneControls(container, {
      title: { kicker: 'ZHUDA ENGINE · LIVE', name: 'Zhuda', em: 'Sky Island', sub: '豬大浮島' },
      weathers: Object.entries(WEATHERS).map(([id, label]) => ({ id, label })),
      weather: day.weather,
      hour: day.hour,
      clock: clockText,
      levels: TIERS.map((t) => t.label),
      level: ceiling,
      soundOn: sound.on,
      hint: '按住豬大把牠抓起來・甩一甩・放手丟出去　｜　拖曳空白處轉鏡頭、滾輪縮放',
      labels: { time: '時間', run: '時間流動', drop: '再丟一隻豬大', quality: '畫質', qualityTip: '畫質：低／中／高／滿（網址可加 ?fx=low|mid|high|max）', soundOn: '🔊 聲音', soundOff: '🔇 靜音' },
      onWeather: (w) => {
        day.weather = w as Weather;
        hud.say({ clear: '放晴了', rain: '下雨了，豬大的耳朵會濕', storm: '雷雨！小心閃電', mist: '起霧了' }[w as Weather]);
      },
      onHour: (h) => (day.hour = h),
      onClockRuns: (r) => (day.clockRuns = r),
      onLevel: (level) => {
        // The player's own choice is kept: the frame budget no longer moves it.
        ceiling = level;
        chosenByPlayer = true;
        steps = ladder(ceiling);
        applyStep(steps[steps.length - 1]);
      },
      onDrop: () => {
        if (!pig.held) pig.respawn();
      },
      onSound: () => sound.toggle(),
    });
    const pig: Pig = new Pig(
      pigModel,
      island.world,
      {
        grab: (at) => {
          sound.effect('grab', at);
          sound.effect('sparkle', at, 0.5);
          sound.say('zhuda', 'grab', at, true);
          fx.sparks.burst(at);
          fx.sweat.burst(add(at, [0, 0.15, 0]));
          hud.say('抓到豬大了！甩一甩、放手丟出去');
        },
        land: (at, speed, roof) => {
          sound.effect(roof ? 'roof' : speed > 8 ? 'thump-hard' : 'thump', at, clamp(speed / 9, 0.3, 1));
          if (roof) sound.say('zhuda', 'roof', at, true);
          else if (speed > 9) setTimeout(() => sound.say('zhuda', 'dizzy', pig.head, true), 500);
          else if (speed > 4.5) sound.say('zhuda', 'land', at, true);
          const s = clamp(speed / 7, 0.2, 2);
          fx.dust.burst(at, s);
          if (speed > 3) fx.shock.burst(add(at, [0, 0.04, 0]), 1);
          if (speed > 6) shakeCamera = Math.min(0.5, speed * 0.03);
          if (!roof && speed > 2) (impact = clamp(speed / 10, 0.3, 1)), (impactAt = [at[0], at[1], at[2]]);
          if (speed > 9) hud.say(roof ? '咚！掉到屋頂上了' : '砰！豬大頭暈了');
        },
        splash: (at, speed) => {
          if (speed > 1.5) {
            sound.effect('splash', at);
            setTimeout(() => sound.say('zhuda', 'splash', pig.head, true), 350);
          } else sound.effect('paddle', at, 0.6);
          const s = clamp(speed / 6, 0.15, 2);
          fx.droplets.burst(at, s);
          if (speed > 1.5) fx.waterRing.burst(add(at, [0, 0.015, 0]), 1), hud.say('噗通！掉進池塘了');
          else fx.ripples.burst(add(at, [0, 0.012, 0]), 1);
        },
        drip: (at) => fx.drips.burst(at),
        shake: (at) => {
          fx.shakeDrops.burst(at);
          if (!shook) (shook = true), sound.effect('shake', at), sound.say('zhuda', 'shake', at);
        },
        stars: (head) => {
          fx.stars.burst(head);
          sound.effect('dizzy', head, 0.35);
        },
        lost: (at) => {
          sound.effect('poof', at);
          sound.say('zhuda', 'lost', at, true);
          fx.poof.burst(at);
          hud.say('豬大掉進雲海了……又從天上掉回來！');
        },
        respawn: (at) => {
          fx.sparks.burst(at);
          sound.effect('slide-whistle', at);
          setTimeout(() => sound.say('zhuda', 'respawn', pig.head, true), 900);
        },
        footstep: (at, wet) => {
          if (wet || day.mix.rain > 0.3) fx.splashes.burst(add(at, [0, 0.03, 0]), 0.5);
          sound.effect(wet || day.mix.rain > 0.5 ? 'squish' : 'step-1', at, 0.45);
        },
      },
      rand,
      eyeNow,
      SKY_ISLAND_GAME_PIG,
    );
    scene.addChild(pig.root);
    const shade = (node: Laya.Node) => {
      const r = (node as Laya.Sprite3D).getComponent?.(Laya.MeshRenderer) as Laya.MeshRenderer | null;
      if (r) (r.castShadow = true), (r.receiveShadow = true);
      const sr = (node as Laya.Sprite3D).getComponent?.(Laya.SkinnedMeshRenderer) as Laya.SkinnedMeshRenderer | null;
      if (sr) (sr.castShadow = true), (sr.receiveShadow = true);
      for (let i = 0; i < node.numChildren; i++) shade(node.getChildAt(i));
    };
    shade(pig.root);
    let springDt = 1 / 60;
    const springs = earAndTailSprings(pigModel, () => springDt);
    let cheerTimer = 0;

    // ---- the camera: orbit by dragging empty space, zoom by wheel or pinch ----
    // A narrow (portrait) screen sees less across: the camera stands back so the whole island fits.
    const narrow = Math.max(1, Math.pow((height / width) * 0.75, 0.9));
    const orbit = { yaw: HOME_VIEW.yaw, pitch: HOME_VIEW.pitch, distance: Number(params.get('distance')) || HOME_VIEW.distance * narrow, target: [...HOME_VIEW.target] as V3 };
    const orbitGoal = { yaw: orbit.yaw, pitch: orbit.pitch, distance: orbit.distance };
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const hand = createHand({
      canvas,
      camera,
      orbit: orbitGoal,
      yaw: () => orbit.yaw,
      pickable: () => [pig],
      ground: groundAt,
      minDistance: 6,
      maxDistance: 45 * narrow,
      onGrab: (_p, at) => hud.hand(at, true),
      onCarry: (at) => hud.hand(at, true),
      onRelease: () => hud.hand(null, false),
    });

    // ---- the frame ----
    let governor = new ZhudaQualityGovernor({ levels: steps.length, start: steps.length - 1, budgetMs: BUDGET_MS });
    let governorFor = steps;
    const governed = params.get('governor') !== '0' && !params.has('quality');
    let seconds = 0,
      frames = 0,
      since = 0,
      lastFps = 0,
      grabbedOnce = !params.has('grab');
    const backend = String((context as unknown as { backend?: string }).backend ?? params.get('renderer') ?? '');
    // For checks: drive the pig, the camera, the hour and the weather from a script.
    const hook = {
      ready: false,
      pig,
      island,
      press: hand.press,
      move: hand.move,
      release: hand.release,
      project: hand.project,
      fx,
      sound,
      state: () => ({ state: pig.state, feet: pig.feet, weather: day.weather, hour: day.hour, fps: lastFps, grass: island.grass?.stats, particles: fx.alive, quality: look.quality, setting: TIERS[step.tier].id, ceiling: TIERS[ceiling].id, renderScale: step.renderScale, dpr: window.devicePixelRatio }),
      set: (o: { hour?: number; weather?: Weather; run?: boolean; yaw?: number; pitch?: number; distance?: number }) => {
        if (o.hour !== undefined) day.hour = o.hour;
        if (o.weather) day.setWeatherNow(o.weather);
        if (o.run !== undefined) day.clockRuns = o.run;
        if (o.yaw !== undefined) orbit.yaw = orbitGoal.yaw = o.yaw;
        if (o.pitch !== undefined) orbit.pitch = orbitGoal.pitch = o.pitch;
        if (o.distance !== undefined) orbit.distance = orbitGoal.distance = o.distance;
      },
      errors: () => context.renderer.errors.slice(0, 6),
    };
    setSceneHook(hook);
    context.runtime.start((dt: number) => {
      seconds += dt;
      springDt = dt;
      // time and weather
      day.step(dt);
      hud.flash(day.flash * (0.55 + 0.45 * Math.sin(seconds * 60) ** 2));
      // the pig
      pig.update(dt, seconds);
      // Zhuda's voice follows what happens to him.
      if (pig.state !== lastState) {
        if (pig.state === 'fall' && lastState === 'held') {
          sound.effect('whoosh', pig.center, clamp(pig.speed / 8, 0.3, 1));
          if (pig.speed > 3.5) sound.say('zhuda', 'throw', pig.center, true);
        }
        if (pig.state === 'cheer') {
          sound.say('zhuda', 'cheer', pig.head);
          sound.effect('heart', pig.head, 0.4);
        }
        if (pig.state !== 'shake') shook = false;
        lastState = pig.state;
      }
      if (pig.held) {
        if (pig.swing > 3.2) sound.say('zhuda', 'swing', pig.head);
        else if (pig.stillFor > 2.5) sound.say('zhuda', 'dangle', pig.head);
      }
      talkClock -= dt;
      if (talkClock <= 0 && (pig.state === 'idle' || pig.state === 'walk')) {
        talkClock = 22 + rand() * 25;
        const h = ((day.hour % 24) + 24) % 24;
        const mix = day.mix;
        sound.say('zhuda', mix.storm > 0.5 ? 'storm' : mix.rain > 0.5 ? 'rain' : mix.mist > 0.5 ? 'morning' : h > 21 || h < 4.5 ? 'night' : 'idle', pig.head);
      }
      if (day.weather !== lastWeather) {
        lastWeather = day.weather;
        const w = day.weather;
        if (w === 'rain' || w === 'storm') setTimeout(() => sound.say('zhuda', w === 'storm' ? 'storm' : 'rain', pig.head, true), 1500);
      }
      if (!saidNight && day.hour > 21 && day.hour < 22) (saidNight = true), sound.say('zhuda', 'night', pig.head);
      if (day.hour < 20) saidNight = false;
      if (pig.held) {
        hand.update(dt);
        if (Math.floor(seconds * 1.5) !== Math.floor((seconds - dt) * 1.5) && rand() < 0.6) fx.sweat.burst(pig.head);
      }
      // Zhuda presses the grass down where he stands, and a hard landing flattens a ring of it for a moment.
      impact = Math.max(0, impact - dt * 1.4);
      const benders: { position: V3; radius: number }[] = [];
      if (pig.state !== 'fall' && pig.state !== 'swim') benders.push({ position: [pig.feet[0], pig.feet[1], pig.feet[2]], radius: 0.55 });
      if (impact > 0.01) benders.push({ position: impactAt, radius: 0.3 + 1.6 * impact });
      if (pig.state === 'cheer') {
        cheerTimer -= dt;
        if (cheerTimer <= 0) (cheerTimer = 0.7), fx.hearts.burst(add(pig.head, [0, 0.2, 0]));
      }
      // speed lines behind a flying pig
      const c = pig.center;
      fx.speed.system.setTransform(c[0], c[1], c[2]);
      fx.speed.system.intensity = pig.state === 'fall' ? 1 : 0;
      // the camera
      hand.idle += dt;
      if (hand.idle > 12 && !pig.held) orbitGoal.yaw += dt * 0.05;
      orbit.yaw = approach(orbit.yaw, orbitGoal.yaw, 6, dt);
      orbit.pitch = approach(orbit.pitch, orbitGoal.pitch, 6, dt);
      orbit.distance = approach(orbit.distance, orbitGoal.distance, 5, dt);
      // The camera keeps still while the pig is held (the hand moves it, not the view); it follows a flying pig a little.
      const follow = pig.held ? 0 : pig.state === 'fall' ? 0.3 : 0.12;
      const home = HOME_VIEW.target;
      const tgoal: V3 = [lerpN(home[0], c[0], follow), lerpN(home[1], clamp(c[1], -2, 6), follow), lerpN(home[2], c[2], follow)];
      orbit.target = [approach(orbit.target[0], tgoal[0], 2, dt), approach(orbit.target[1], tgoal[1], 2, dt), approach(orbit.target[2], tgoal[2], 2, dt)];
      const jolt: V3 = shakeCamera > 0 ? [Math.sin(seconds * 70) * shakeCamera * 0.15, Math.cos(seconds * 83) * shakeCamera * 0.15, 0] : [0, 0, 0];
      shakeCamera = Math.max(0, shakeCamera - dt * 1.5);
      const dir: V3 = [Math.sin(orbit.yaw) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.cos(orbit.yaw) * Math.cos(orbit.pitch)];
      const eye = add(add(orbit.target, scale(dir, orbit.distance)), jolt);
      camera.transform.position = new Laya.Vector3(...eye);
      camera.transform.lookAt(new Laya.Vector3(...orbit.target), new Laya.Vector3(0, 1, 0), false);
      focus = approach(focus, len(sub(c, eye)), 4, dt);
      // the island: the look, water, lights, wind, grass, particles
      const sky = skyAt(day.hour, day.mix, focus, day.flash, fStop, off);
      island.update({ dt, seconds, eye, target: orbit.target, sky, flash: day.flash, storm: day.mix.storm, benders });
      const look3 = new Laya.Vector3();
      camera.transform.getForward(look3);
      sound.update(eye, [look3.x, look3.y, look3.z], { day: 1 - sky.night, night: sky.night, rain: day.mix.rain + day.mix.storm, storm: day.mix.storm, wind: sky.wind }, WINDMILL);
      // Frames over budget step down (resolution, then the look, then the grass) and back up to the setting.
      settleFor = Math.max(0, settleFor - dt);
      if (governed && !chosenByPlayer && settleFor === 0) {
        if (governorFor !== steps) {
          governor = new ZhudaQualityGovernor({ levels: steps.length, start: steps.indexOf(step) < 0 ? steps.length - 1 : steps.indexOf(step), budgetMs: BUDGET_MS });
          governorFor = steps;
        }
        const level = governor.sample(dt * 1000);
        if (level !== undefined && steps[level] && steps[level] !== step) applyStep(steps[level]);
      }
      frames++;
      since += dt;
      if (since >= 0.5) {
        lastFps = Math.round(frames / since);
        const setting = `畫質 ${TIERS[step.tier].label}${step.renderScale < 1 ? ' ' + Math.round(step.renderScale * 100) + '%' : ''}${chosenByPlayer || !governed ? '' : '・自動'}${backend ? ' · ' + backend : ''}`;
        hud.status([{ value: String(lastFps) }, ' FPS · 草 ', { value: (island.grass?.stats.blades ?? 0).toLocaleString() }, ' 根 · 粒子 ', { value: fx.alive.toLocaleString() }, ' · ' + setting]);
        hud.clock(day.hour);
        frames = since = 0;
      }
      // ?grab=1 (a view): Zhuda is held up in front of the camera once he is in view.
      if (!grabbedOnce && seconds > 1.5) {
        grabbedOnce = true;
        const [x, y] = hand.project(pig.center);
        hand.press(1, x, y);
        hand.move(1, x, y - 90);
      }
      if (seconds > 0.5 && !hook.ready) hook.ready = true;
    });
    window.addEventListener(
      'pagehide',
      () => {
        sound.dispose();
        springs.dispose();
        pig.dispose();
        hand.dispose();
        island.dispose();
        models.dispose();
        provider.dispose();
        context.dispose();
      },
      { once: true },
    );
  },
};
