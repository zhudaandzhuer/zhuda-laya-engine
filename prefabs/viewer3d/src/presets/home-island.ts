// 豬大與豬二的小島 (games/zhuda-home-island, the hero of zhudaandzhuer.com) rebuilt from
// the library: the floating island where the redesigned Zhuda and Zhuer live. They wander,
// wave, sit and doze at night, can both be picked up and thrown, and sing and dance to
// 「ふたりの帰り道」 (73 BPM, in time with the song's own clock) when the page asks.
// The hour follows the visitor's clock; a moonlight follows the two of them at night.
//
// Address: as sky-island (?hour, ?weather, ?fx, ?governor=0, ?quality, ?dpr, ?off, ?grass=0, ?seed,
// ?distance, ?fstop), plus ?embed=1 (inside a page: no title or weather controls, the wheel
// scrolls the page, a vertical swipe scrolls it until the page says `full`), ?clock=fast
// (the game's five-minute day instead of real time), ?show=sing|wave|hands|talk|bow|sit (a view).
// The page drives it with window.zhudaIsland.command({ action }) or, as a fallback,
// postMessage({ type: 'zhuda-island', action }) from the same origin; it answers with
// postMessage events { type: 'zhuda-island', event: 'ready' | 'song' | 'sound', … }.
// window.__SCENE__ offers what the game's window.__ISLAND__ did (zhuda, zhuer, STAGE, perform, endShow,
// press, move, release, project, fx, sound, state(), set(), errors()).
import { ZhudaEngine, Zhuda3D, ZhudaModelLibrary, ZhudaQualityGovernor, DirectoryAssetProvider, type ModelInstance, type ZhudaLookQuality } from 'zhuda-laya-engine';
import { createSkyIsland } from '../common/3d/sky-island/sky-island.ts';
import { HOME_VIEW, STAGE as OPEN_LAWN, WINDMILL } from '../common/3d/sky-island/layout.ts';
import { groundAt } from '../common/3d/sky-island/ground.ts';
import { createIslandDay } from '../common/3d/sky-island/day.ts';
import { ACTS, Pig, earAndTailSprings, redesignShape, type Act } from '../common/3d/island-pig/pig.ts';
import { createHand } from '../common/3d/island-pig/hand.ts';
import { createIslandSound, SONG_FUTARI, type LineKind, type Who } from '../common/3d/island-sound/island-sound.ts';
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
const SONG = SONG_FUTARI;

export const homeIsland: ScenePreset = {
  id: 'home-island',
  title: '豬大與豬二的小島',
  summary: '官網首頁（zhudaandzhuer.com）的浮島版本：改版豬大和豬二住在島上，自己走、打招呼、坐、晚上打瞌睡，都能抓起來丟；頁面可叫他們唱歌跳舞（跟著《ふたりの帰り道》的拍子）、打招呼、牽手、聊天、鞠躬、坐下。時間跟訪客的時鐘，晚上有月光跟著兩兄妹。',
  modules: ['3d/sky-island', '3d/island-pig', '3d/island-sound', 'ui/scene-controls', '3d/day-look', '3d/quality-tiers', '3d/zhuda-characters', '3d/nature-pack', '3d/math'],
  views: {
    首頁嵌入: 'embed=1',
    白天: 'hour=10.5&fx=high',
    打招呼: 'hour=10.5&fx=high&show=wave',
    唱歌跳舞: 'hour=10.5&fx=high&show=sing',
    牽手: 'hour=10.5&fx=high&show=hands',
    聊天: 'hour=10.5&fx=high&show=talk',
    黃昏: 'hour=18.15&fx=high',
    夜晚: 'hour=22.5&fx=high&show=sit',
    雨天: 'hour=15&weather=rain&fx=high',
    五分鐘一天: 'clock=fast',
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

    // ---- weather and time: the visitor's own clock ----
    const rand = random(Number(params.get('seed')) || 5);
    let sound: ReturnType<typeof createIslandSound>;
    const now = new Date();
    const day = createIslandDay({
      hour: params.has('hour') ? Number(params.get('hour')) : now.getHours() + now.getMinutes() / 60,
      weather: (params.get('weather') as Weather) || 'clear',
      clockRuns: !params.has('hour'),
      // The island's day goes at the visitor's own pace (?clock=fast: the game's five-minute day).
      hoursPerSecond: params.get('clock') === 'fast' ? 0.08 : 1 / 3600,
      rand,
      onBolt: (far) => setTimeout(() => sound.effect(far < 0.35 ? 'thunder-1' : far < 0.7 ? 'thunder-2' : 'thunder-3', undefined, 1 - far * 0.4), 150 + far * 2200),
    });
    /** Inside the homepage: no title or weather controls, the page scrolls past it, the page drives it. */
    const embed = params.get('embed') === '1';
    let focus = 20;
    const off = (params.get('off') || '').split(',');
    const fStop = off.includes('dof') ? 22 : Number(params.get('fstop')) || 2.4;
    const quality = (params.has('quality') ? Number(params.get('quality')) : TIERS[ceiling].look) as ZhudaLookQuality;
    const steps0 = ladder(ceiling);
    const grassFor = (tier: number) => (params.get('grass') === '0' ? null : TIERS[tier].grass);

    // ---- the island, and the two of them loaded with it ----
    const provider = new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 240_000, maxBytes: 256 * 1024 * 1024 });
    const models = new ZhudaModelLibrary({ provider, timeoutMs: 240_000 });
    sound = createIslandSound({ provider, voices: ['zhuda', 'zhuer'], song: SONG, storageKey: 'zhuda-home-island.sound' });
    const note = loadingNote(container, '豬大與豬二的小島載入中…');
    const island = await createSkyIsland(scene, camera, {
      look: skyAt(day.hour, day.mix, focus, 0, fStop, off).look,
      quality,
      fov: FOV,
      models,
      alsoLoad: [
        { path: characterPath('zhuda'), independentMaterials: true },
        { path: characterPath('zhuer'), independentMaterials: true },
      ],
      grass: grassFor(steps0[steps0.length - 1].tier),
      moonlight: true,
      onProgress: note.progress,
    });
    note.remove();
    await styled;
    const { look, fx } = island;
    const [zhudaModel, zhuerModel] = island.extra;

    let steps: Step[] = steps0;
    let step = steps[steps.length - 1];
    let chosenByPlayer = false;
    let settleFor = 8;
    const applyStep = (next: Step) => {
      step = next;
      settleFor = 2.5;
      island.setQuality({ look: params.has('quality') ? null : TIERS[next.tier].look, renderScale: next.renderScale, particles: TIERS[next.tier].particles, grass: grassFor(next.tier) });
    };
    applyStep(step);

    const eyeNow = (): V3 => {
      const p = camera.transform.position;
      return [p.x, p.y, p.z];
    };
    let shakeCamera = 0;
    let talkClock = 25;
    let lastWeather = day.weather;
    let saidNight = false;
    let impact = 0;
    let impactAt: V3 = [0, 0, 0];
    let springDt = 1 / 60;

    // ---- Zhuda and Zhuer ----
    interface Actor {
      who: Who;
      name: string;
      pig: Pig;
      model: ModelInstance;
      springs: ReturnType<typeof earAndTailSprings>;
      lastState: string;
      shook: boolean;
      cheerTimer: number;
    }
    const actors: Actor[] = [];
    const other = (a: Actor) => actors.find((o) => o !== a)!;
    const say = (a: Actor, kind: LineKind, force = false) => sound.say(a.who, kind, a.pig.head, force);
    const tell = (message: Record<string, unknown>) => {
      if (window.parent !== window) window.parent.postMessage({ type: 'zhuda-island', ...message }, location.origin);
    };
    const hud = createSceneControls(container, {
      embed,
      title: { kicker: 'ZHUDA ENGINE · LIVE', name: 'Zhuda & Zhuer', em: 'Island', sub: '豬大與豬二的小島' },
      weathers: Object.entries(WEATHERS).map(([id, label]) => ({ id, label })),
      weather: day.weather,
      hour: day.hour,
      clock: clockText,
      levels: TIERS.map((t) => t.label),
      level: ceiling,
      soundOn: sound.on,
      hint: embed ? '按住豬大或豬二可以抓起來・拖曳轉鏡頭' : '按住豬大或豬二把牠抓起來・甩一甩・放手丟出去　｜　拖曳空白處轉鏡頭、滾輪縮放',
      labels: { time: '時間', run: '時間流動', drop: '從天上掉一隻', quality: '畫質', qualityTip: '畫質：低／中／高／滿（網址可加 ?fx=low|mid|high|max）', soundOn: '🔊 聲音', soundOff: '🔇 靜音' },
      onWeather: (w) => {
        day.weather = w as Weather;
        hud.say({ clear: '放晴了', rain: '下雨了，豬大和豬二的耳朵會濕', storm: '雷雨！小心閃電', mist: '起霧了' }[w as Weather]);
      },
      onHour: (h) => (day.hour = h),
      onClockRuns: (r) => (day.clockRuns = r),
      onLevel: (level) => {
        ceiling = level;
        chosenByPlayer = true;
        steps = ladder(ceiling);
        applyStep(steps[steps.length - 1]);
      },
      onDrop: () => {
        const free = actors.filter((a) => !a.pig.held);
        free[Math.floor(rand() * free.length)]?.pig.respawn();
      },
      onSound: () => {
        const on = sound.toggle();
        tell({ event: 'sound', on });
        return on;
      },
    });
    const shade = (node: Laya.Node) => {
      const r = (node as Laya.Sprite3D).getComponent?.(Laya.MeshRenderer) as Laya.MeshRenderer | null;
      if (r) (r.castShadow = true), (r.receiveShadow = true);
      const sr = (node as Laya.Sprite3D).getComponent?.(Laya.SkinnedMeshRenderer) as Laya.SkinnedMeshRenderer | null;
      if (sr) (sr.castShadow = true), (sr.receiveShadow = true);
      for (let i = 0; i < node.numChildren; i++) shade(node.getChildAt(i));
    };
    const makeActor = (who: Who, model: ModelInstance, start: [number, number], yaw: number, head: number) => {
      const a = { who, name: who === 'zhuda' ? '豬大' : '豬二', model, lastState: '', shook: false, cheerTimer: 0 } as Actor;
      a.pig = new Pig(
        model,
        island.world,
        {
          grab: (at) => {
            sound.effect('grab', at);
            sound.effect('sparkle', at, 0.5);
            sound.say(who, 'grab', at, true);
            fx.sparks.burst(at);
            fx.sweat.burst(add(at, [0, 0.15, 0]));
            hud.say(`抓到${a.name}了！甩一甩、放手丟出去`);
          },
          land: (at, speed, roof) => {
            sound.effect(roof ? 'roof' : speed > 8 ? 'thump-hard' : 'thump', at, clamp(speed / 9, 0.3, 1));
            if (roof) sound.say(who, 'roof', at, true);
            else if (speed > 9 && !a.pig.arriving) setTimeout(() => say(a, 'dizzy', true), 500);
            else if (speed > 4.5) sound.say(who, 'land', at, true);
            const s = clamp(speed / 7, 0.2, 2);
            fx.dust.burst(at, s);
            if (speed > 3) fx.shock.burst(add(at, [0, 0.04, 0]), 1);
            if (speed > 6) shakeCamera = Math.min(0.5, speed * 0.03);
            if (!roof && speed > 2) (impact = clamp(speed / 10, 0.3, 1)), (impactAt = [at[0], at[1], at[2]]);
            if (speed > 9 && !a.pig.arriving) hud.say(roof ? `咚！${a.name}掉到屋頂上了` : `砰！${a.name}頭暈了`);
          },
          splash: (at, speed) => {
            if (speed > 1.5) {
              sound.effect('splash', at);
              setTimeout(() => say(a, 'splash', true), 350);
            } else sound.effect('paddle', at, 0.6);
            const s = clamp(speed / 6, 0.15, 2);
            fx.droplets.burst(at, s);
            if (speed > 1.5) fx.waterRing.burst(add(at, [0, 0.015, 0]), 1), hud.say(`噗通！${a.name}掉進池塘了`);
            else fx.ripples.burst(add(at, [0, 0.012, 0]), 1);
          },
          drip: (at) => fx.drips.burst(at),
          shake: (at) => {
            fx.shakeDrops.burst(at);
            if (!a.shook) (a.shook = true), sound.effect('shake', at), sound.say(who, 'shake', at);
          },
          stars: (h) => {
            fx.stars.burst(h);
            sound.effect('dizzy', h, 0.35);
          },
          lost: (at) => {
            sound.effect('poof', at);
            sound.say(who, 'lost', at, true);
            fx.poof.burst(at);
            hud.say(`${a.name}掉進雲海了……又從天上掉回來！`);
          },
          respawn: (at) => {
            fx.sparks.burst(at);
            sound.effect('slide-whistle', at);
            setTimeout(() => say(a, 'respawn', true), 900);
          },
          footstep: (at, wet) => {
            if (wet || day.mix.rain > 0.3) fx.splashes.burst(add(at, [0, 0.03, 0]), 0.5);
            sound.effect(wet || day.mix.rain > 0.5 ? 'squish' : 'step-1', at, 0.45);
          },
        },
        rand,
        eyeNow,
        // The 2026 models stand about 1.05 m with big heads: shown a little larger, held at the back of the head.
        { ...redesignShape(head), start, yaw, others: () => actors.filter((o) => o !== a).map((o) => o.pig.feet) },
      );
      scene.addChild(a.pig.root);
      shade(a.pig.root);
      a.springs = earAndTailSprings(model, () => springDt);
      actors.push(a);
      return a;
    };
    makeActor('zhuda', zhudaModel, [0.6, 2.2], 0.5, 0.95);
    makeActor('zhuer', zhuerModel, [-0.7, 2.8], 0.9, 1.0);

    // ---- what the page asks for: the song, a wave, a bow, a talk, holding hands ----
    /** A clear place for a character near (x, z), searched outwards. */
    const spotNear = (a: Actor, x: number, z: number): [number, number] => {
      for (let r = 0; r <= 2.5; r += 0.25)
        for (let k = 0; k < (r ? 12 : 1); k++) {
          const t = (k / 12) * Math.PI * 2;
          const px = x + Math.cos(t) * r,
            pz = z + Math.sin(t) * r;
          if (a.pig.free(px, pz, 0.4)) return [px, pz];
        }
      return [a.pig.feet[0], a.pig.feet[2]];
    };
    const faceCamera = (a: Actor) => () => {
      const e = eyeNow();
      return Math.atan2(e[0] - a.pig.feet[0], e[2] - a.pig.feet[2]);
    };
    const faceOther = (a: Actor) => () => {
      const o = other(a).pig.feet;
      return Math.atan2(o[0] - a.pig.feet[0], o[2] - a.pig.feet[2]);
    };
    /** Where they perform (an open patch of grass) and the side the camera looks from; checks may move it. */
    const STAGE = { center: [...OPEN_LAWN.center] as [number, number], yaw: OPEN_LAWN.yaw, distance: OPEN_LAWN.distance };
    /** Two places side by side on the stage, a metre apart across the view. */
    const stage = (): [[number, number], [number, number]] => {
      const yaw = STAGE.yaw;
      const [cx, cz] = STAGE.center;
      const rx = Math.cos(yaw) * 0.55,
        rz = -Math.sin(yaw) * 0.55;
      const left = spotNear(actors[0], cx - rx, cz - rz);
      const right = spotNear(actors[1], cx + rx, cz + rz);
      return [left, right];
    };
    /** Until when the camera frames the stage. */
    let staged = -1;
    let show: { kind: string; started: number; until: number; heard: boolean } | null = null;
    /** Seconds into the song: the song's own clock when it plays, else the time since the show began (muted: they still dance). */
    const showTime = () => sound.songTime() ?? (show ? seconds - show.started : null);
    const beat = (clip: Act) => () => {
      const t = showTime();
      return t === null ? null : ((t - SONG.offset) * SONG.bpm) / 60 / ACTS[clip];
    };
    const endShow = () => {
      if (!show) return;
      show = null;
      staged = seconds + 4;
      sound.stopSong();
      for (const a of actors) a.pig.rest();
      tell({ event: 'song', playing: false });
    };
    const perform = (kind: string) => {
      const [l, r] = stage();
      const [zd, ze] = actors;
      endShow();
      hand.idle = 0;
      // The camera comes round to the stage (the short way) unless it is only a talk where they are.
      if (kind !== 'talk') {
        const turn = ((STAGE.yaw - orbitGoal.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        orbitGoal.yaw += turn;
        orbitGoal.pitch = 0.2;
        orbitGoal.distance = STAGE.distance * narrow;
        staged = seconds + (kind === 'sing' ? Infinity : 14);
      }
      if (kind === 'sing') {
        show = { kind, started: seconds, until: seconds + SONG.seconds + 2, heard: false };
        sound.wake();
        sound.sing();
        zd.pig.goAct(l, 'Sing', Infinity, faceCamera(zd), beat('Sing'));
        ze.pig.goAct(r, 'Dance', Infinity, faceCamera(ze), beat('Dance'));
        hud.say('豬大唱歌、豬二跳舞：《ふたりの帰り道》');
        tell({ event: 'song', playing: true });
      } else if (kind === 'hands') {
        // Side by side, each reaching to the other (a character's own left is the view's right).
        zd.pig.goAct(l, 'ReachLeft', 12, faceCamera(zd));
        ze.pig.goAct(r, 'ReachRight', 12, faceCamera(ze));
      } else if (kind === 'talk') {
        const f = zd.pig.feet;
        const yaw = orbitGoal.yaw;
        zd.pig.act('Talk', 9, faceOther(zd));
        ze.pig.goAct(spotNear(ze, f[0] + Math.cos(yaw) * 1.1, f[2] - Math.sin(yaw) * 1.1), 'Talk', 9, faceOther(ze));
        setTimeout(() => say(zd, 'idle', true), 900);
        setTimeout(() => say(ze, 'idle', true), 3600);
      } else {
        const clip = ({ wave: 'Wave', bow: 'Bow', point: 'Point', sit: 'Sit', sleep: 'Sleep' } as Record<string, Act>)[kind];
        if (!clip) return;
        const seconds = clip === 'Bow' ? 1.0 : clip === 'Sit' || clip === 'Sleep' ? 20 : 3.5;
        zd.pig.goAct(l, clip, seconds, faceCamera(zd));
        ze.pig.goAct(r, clip, seconds, faceCamera(ze));
        if (clip === 'Wave') setTimeout(() => say(rand() < 0.5 ? zd : ze, 'cheer', true), 1200);
      }
    };

    // ---- the camera: orbit by dragging empty space, zoom by wheel or pinch ----
    const narrow = Math.max(1, Math.pow((height / width) * 0.75, 0.9));
    const orbit = { yaw: HOME_VIEW.yaw, pitch: HOME_VIEW.pitch, distance: Number(params.get('distance')) || (embed ? 19 : HOME_VIEW.distance) * narrow, target: [...HOME_VIEW.target] as V3 };
    const orbitGoal = { yaw: orbit.yaw, pitch: orbit.pitch, distance: orbit.distance };
    const homeView = { pitch: orbit.pitch, distance: orbit.distance };
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const hand = createHand({
      canvas,
      camera,
      orbit: orbitGoal,
      yaw: () => orbit.yaw,
      pickable: () => actors.map((a) => a.pig),
      ground: groundAt,
      minDistance: 6,
      maxDistance: 45 * narrow,
      // In the homepage the wheel scrolls the page, not the island.
      wheel: !embed,
      bringForwardTo: () => orbit.target,
      onGrab: (_p, at) => hud.hand(at, true),
      onCarry: (at) => hud.hand(at, true),
      onRelease: () => hud.hand(null, false),
    });
    const heldActor = () => actors.find((a) => a.pig === hand.held) ?? null;

    // ---- the frame ----
    let governor = new ZhudaQualityGovernor({ levels: steps.length, start: steps.length - 1, budgetMs: BUDGET_MS });
    let governorFor = steps;
    const governed = params.get('governor') !== '0' && !params.has('quality');
    let seconds = 0,
      frames = 0,
      since = 0,
      lastFps = 0,
      nightNow = 0,
      asked = params.get('show');
    const backend = String((context as unknown as { backend?: string }).backend ?? params.get('renderer') ?? '');
    const hook = {
      ready: false,
      zhuda: actors[0].pig,
      zhuer: actors[1].pig,
      island,
      STAGE,
      perform,
      endShow,
      press: hand.press,
      move: hand.move,
      release: hand.release,
      project: hand.project,
      fx,
      sound,
      state: () => ({ actors: actors.map((a) => ({ who: a.who, state: a.pig.state, acting: a.pig.acting, feet: a.pig.feet })), show: show?.kind ?? null, songTime: sound.songTime(), weather: day.weather, hour: day.hour, fps: lastFps, grass: island.grass?.stats, particles: fx.alive, quality: look.quality, setting: TIERS[step.tier].id, ceiling: TIERS[ceiling].id, renderScale: step.renderScale, dpr: window.devicePixelRatio }),
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
    // ---- the page around it (zhudaandzhuer.com): commands in, events out, same origin only ----
    // The page calls zhudaIsland.command() directly inside its own click, so the browser counts
    // the click for starting sound; postMessage is the fallback.
    const setFull = (on: boolean) => {
      // Inline in the page, a vertical swipe scrolls the page; opened full, every touch is the island's.
      canvas.style.touchAction = embed && !on ? 'pan-y' : 'none';
    };
    setFull(false);
    const command = (d: { action?: string; on?: boolean; hour?: number; tier?: string }) => {
      switch (d.action) {
        case 'sing':
        case 'wave':
        case 'bow':
        case 'talk':
        case 'hands':
        case 'point':
        case 'sit':
        case 'sleep':
          perform(d.action);
          break;
        case 'stop':
          endShow();
          break;
        case 'sound':
          if (d.on !== undefined && d.on !== sound.on) hud.setSound(sound.toggle());
          if (sound.on) sound.wake();
          tell({ event: 'sound', on: sound.on });
          break;
        case 'visible':
          // Scrolled out of view: stop drawing (and the song's dance keeps its place by the song's own clock).
          context.runtime.setPaused(d.on === false);
          Laya.stage.renderingEnabled = d.on !== false;
          break;
        case 'full':
          setFull(Boolean(d.on));
          break;
        case 'hour':
          if (typeof d.hour === 'number' && Number.isFinite(d.hour)) (day.hour = ((d.hour % 24) + 24) % 24), (day.clockRuns = false);
          break;
      }
    };
    Reflect.set(window, 'zhudaIsland', { command, state: () => ({ show: show?.kind ?? null, sound: sound.on, hour: day.hour }) });
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const d = e.data as { type?: string; action?: string };
      if (d && d.type === 'zhuda-island') command(d);
    });
    // 'ready' waits for the first frames (shaders compile on them): the page fades the island in on it.
    let readyIn = 40;

    context.runtime.start((dt: number) => {
      if (readyIn > 0 && --readyIn === 0) (hook.ready = true), tell({ event: 'ready', sound: sound.on });
      seconds += dt;
      springDt = dt;
      // time and weather
      day.step(dt);
      hud.flash(day.flash * (0.55 + 0.45 * Math.sin(seconds * 60) ** 2));
      // Zhuda and Zhuer
      for (const a of actors) {
        const pig = a.pig;
        pig.night = nightNow;
        pig.update(dt, seconds);
        // Their voices follow what happens to them.
        if (pig.state !== a.lastState) {
          if (pig.state === 'fall' && a.lastState === 'held') {
            sound.effect('whoosh', pig.center, clamp(pig.speed / 8, 0.3, 1));
            if (pig.speed > 3.5) sound.say(a.who, 'throw', pig.center, true);
          }
          if (pig.state === 'cheer') {
            say(a, 'cheer');
            sound.effect('heart', pig.head, 0.4);
          }
          if (pig.state !== 'shake') a.shook = false;
          a.lastState = pig.state;
        }
        if (pig.held) {
          if (pig.swing > 3.2) say(a, 'swing');
          else if (pig.stillFor > 2.5) say(a, 'dangle');
          if (Math.floor(seconds * 1.5) !== Math.floor((seconds - dt) * 1.5) && rand() < 0.6) fx.sweat.burst(pig.head);
        }
        if (pig.state === 'cheer') {
          a.cheerTimer -= dt;
          if (a.cheerTimer <= 0) (a.cheerTimer = 0.7), fx.hearts.burst(add(pig.head, [0, 0.2, 0]));
        }
        // Thrown during the song: back to its place once it is on its feet.
        if (show?.kind === 'sing' && pig.state === 'idle') {
          const [l, r] = stage();
          if (a.who === 'zhuda') pig.goAct(l, 'Sing', Infinity, faceCamera(a), beat('Sing'));
          else pig.goAct(r, 'Dance', Infinity, faceCamera(a), beat('Dance'));
        }
      }
      hand.update(dt);
      // The song: heard once it starts; over when it ends (or, muted, after a while).
      if (show?.kind === 'sing') {
        if (sound.songTime() !== null) show.heard = true;
        else if (!show.heard && sound.on) sound.sing();
        if ((show.heard && sound.songTime() === null) || (!show.heard && seconds - show.started > 120) || seconds > show.until) endShow();
      }
      talkClock -= dt;
      const chatty = actors.filter((a) => a.pig.state === 'idle' || a.pig.state === 'walk');
      if (talkClock <= 0 && chatty.length && !show) {
        talkClock = 22 + rand() * 25;
        const h = ((day.hour % 24) + 24) % 24;
        const mix = day.mix;
        say(chatty[Math.floor(rand() * chatty.length)], mix.storm > 0.5 ? 'storm' : mix.rain > 0.5 ? 'rain' : mix.mist > 0.5 ? 'morning' : h > 21 || h < 4.5 ? 'night' : 'idle');
      }
      if (day.weather !== lastWeather) {
        lastWeather = day.weather;
        const w = day.weather;
        if (w === 'rain' || w === 'storm') setTimeout(() => say(actors[rand() < 0.5 ? 0 : 1], w === 'storm' ? 'storm' : 'rain', true), 1500);
      }
      if (!saidNight && day.hour > 21 && day.hour < 22) (saidNight = true), say(actors[1], 'night');
      if (day.hour < 20) saidNight = false;
      // They press the grass down where they stand, and a hard landing flattens a ring of it for a moment.
      impact = Math.max(0, impact - dt * 1.4);
      const benders: { position: V3; radius: number }[] = [];
      for (const { pig } of actors) if (pig.state !== 'fall' && pig.state !== 'swim') benders.push({ position: [pig.feet[0], pig.feet[1], pig.feet[2]], radius: 0.5 });
      if (impact > 0.01) benders.push({ position: impactAt, radius: 0.3 + 1.6 * impact });
      // speed lines behind a flying one
      const held = heldActor();
      const flying = actors.find((a) => a.pig.state === 'fall');
      const watched = held ?? flying ?? null;
      const c: V3 = watched ? watched.pig.center : scale(add(actors[0].pig.center, actors[1].pig.center), 0.5);
      if (flying) fx.speed.system.setTransform(flying.pig.center[0], flying.pig.center[1], flying.pig.center[2]);
      fx.speed.system.intensity = flying ? 1 : 0;
      // the camera
      hand.idle += dt;
      if (hand.idle > 12 && !held && seconds > staged) orbitGoal.yaw += dt * 0.05;
      orbit.yaw = approach(orbit.yaw, orbitGoal.yaw, 6, dt);
      orbit.pitch = approach(orbit.pitch, orbitGoal.pitch, 6, dt);
      orbit.distance = approach(orbit.distance, orbitGoal.distance, 5, dt);
      // The camera keeps still while one is held (the hand moves it, not the view); it follows a flying one a little.
      const follow = held ? 0 : flying ? 0.3 : 0.12;
      if (staged > 0 && seconds >= staged) (staged = -1), (orbitGoal.distance = homeView.distance), (orbitGoal.pitch = homeView.pitch);
      const onStage = seconds < staged && !watched;
      const home: V3 = onStage ? [STAGE.center[0], (groundAt(STAGE.center[0], STAGE.center[1]) ?? 0) + 0.75, STAGE.center[1]] : HOME_VIEW.target;
      const tgoal: V3 = onStage ? home : [lerpN(home[0], c[0], follow), lerpN(home[1], clamp(c[1], -2, 6), follow), lerpN(home[2], c[2], follow)];
      orbit.target = [approach(orbit.target[0], tgoal[0], 2, dt), approach(orbit.target[1], tgoal[1], 2, dt), approach(orbit.target[2], tgoal[2], 2, dt)];
      const jolt: V3 = shakeCamera > 0 ? [Math.sin(seconds * 70) * shakeCamera * 0.15, Math.cos(seconds * 83) * shakeCamera * 0.15, 0] : [0, 0, 0];
      shakeCamera = Math.max(0, shakeCamera - dt * 1.5);
      const dir: V3 = [Math.sin(orbit.yaw) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.cos(orbit.yaw) * Math.cos(orbit.pitch)];
      const eye = add(add(orbit.target, scale(dir, orbit.distance)), jolt);
      camera.transform.position = new Laya.Vector3(...eye);
      camera.transform.lookAt(new Laya.Vector3(...orbit.target), new Laya.Vector3(0, 1, 0), false);
      focus = approach(focus, len(sub(c, eye)), 4, dt);
      // the island: the look, water, lights (and the moonlight over the two of them), wind, grass, particles
      const sky = skyAt(day.hour, day.mix, focus, day.flash, fStop, off);
      nightNow = sky.night;
      const pair = scale(add(actors[0].pig.feet, actors[1].pig.feet), 0.5);
      const moonlightAt: V3 = [pair[0] + Math.sin(orbit.yaw) * 1.6, pair[1] + 2.2, pair[2] + Math.cos(orbit.yaw) * 1.6];
      island.update({ dt, seconds, eye, target: orbit.target, sky, flash: day.flash, storm: day.mix.storm, benders, moonlightAt });
      const look3 = new Laya.Vector3();
      camera.transform.getForward(look3);
      sound.update(eye, [look3.x, look3.y, look3.z], { day: 1 - sky.night, night: sky.night, rain: day.mix.rain + day.mix.storm, storm: day.mix.storm, wind: sky.wind }, WINDMILL);
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
      // ?show=… (a view): the page's command, once they are settled.
      if (asked && seconds > 1) perform(asked), (asked = null);
    });
    window.addEventListener(
      'pagehide',
      () => {
        sound.dispose();
        for (const a of actors) a.springs.dispose(), a.pig.dispose();
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
