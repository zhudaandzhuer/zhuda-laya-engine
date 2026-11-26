// 豬大狩荒 — boots the engine, mounts a hunting ground, loads 豬大 and the monster, and plays the
// rules (src/core, pure and tested) back in 3D: fixed 60 Hz steps on the runtime session's
// `world` time layer (hit-stop pauses that layer), buttons as action ids into the engine's
// input buffer, the hunter's moves as engine action frame specs.
//   index.html?quest=q1            straight into a hunt
//   index.html?quest=q2&auto=careful&speed=6&seed=3   a bot plays it (recorded runs)
//   index.html?screen=hub&demo=1   the hub with a sample save
import {
  DirectoryAssetProvider, ZhudaEffect3D, ZhudaEngine, ZhudaFilmAssets, ZhudaModelLibrary, ZhudaPointerInput, ZhudaRuntimeProfiler, Zhuda3D,
  loadZhudaFilmScene, validateZhudaFilmScene, type ZhudaFilmStage,
} from 'zhuda-laya-engine';
import { careful, masher, type Bot } from './core/bots.ts';
import { GEAR, QUESTS, forge, forgeBlock, gear, grant, loadSave, loadoutOf, newSave, questOpen, type QuestDef, type Save } from './core/data.ts';
import { Hunt, MAX_FAINTS, QUEST_SECONDS, STEP, carve, type HuntEvent } from './core/hunt.ts';
import { Sound } from './audio/sound.ts';
import { HunterView, MonsterView } from './view/actors.ts';
import { ARENAS } from './view/arena.ts';

interface Report {
  ready: boolean;
  error?: string;
  screen: string;
  frames: number;
  draws?: number;
  triangles?: number;
  hunt?: { quest: string; time: number; hp: number; stamina: number; faints: number; monster: number; state: string; move: string | null; enraged: boolean; broken: string[]; result: string; hits: number; hurts: number; dist: number; action: string | null };
  save?: Save;
  loot?: Record<string, number>;
  sound?: unknown;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, screen: 'boot', frames: 0 });
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

async function main() {
  const container = $('#game');
  const context = await ZhudaEngine.boot({ container, features: ['core', '3d', 'gltf', 'postProcess'], dprCap: 1.5, targetFPS: 60, antialias: false });
  const sound = new Sound(storage?.getItem('zhuda-hunt/muted') === '1');
  void sound.load();
  const modelProvider = new DirectoryAssetProvider({ baseUrl: 'assets/models/', timeoutMs: 120_000, maxBytes: 64 * 1024 * 1024 });
  const library = new ZhudaModelLibrary({ provider: modelProvider, timeoutMs: 120_000 });
  const sceneProvider = new DirectoryAssetProvider({ baseUrl: 'assets/', timeoutMs: 120_000, maxBytes: 64 * 1024 * 1024 });
  const filmAssets = new ZhudaFilmAssets(sceneProvider, { timeoutMs: 120_000 });

  let save = loadSave(storage);
  if (params.has('demo')) {
    save = newSave();
    save.coins = 2400;
    save.items = { 饕餮厚皮: 7, 饕餮巨齒: 2, 饕餮尾: 1, 窮奇毛皮: 3, 窮奇牙: 2 };
    save.cleared = { q1: { best: 231, times: 3 } };
    forge(save, 'w1');
  }
  const persist = () => {
    try {
      if (!params.has('demo')) storage?.setItem('zhuda-hunt/save', JSON.stringify(save));
    } catch {
      /* private mode: the hunt still plays */
    }
    report.save = save;
  };

  // ---- the stage -------------------------------------------------------------------------
  let stage: ZhudaFilmStage | undefined;
  let arenaId = '';
  async function mountArena(id: string) {
    if (arenaId === id && stage) return;
    stage?.dispose();
    stage = undefined;
    const scene = ARENAS[id]();
    const issues = validateZhudaFilmScene(scene);
    if (issues.length) throw Error(`arena ${id}: ${issues.join('; ')}`);
    stage = await loadZhudaFilmScene(context.rootScene, scene, { assets: filmAssets });
    arenaId = id;
  }

  // ---- a hunt ----------------------------------------------------------------------------
  let hunt: Hunt | undefined;
  let quest: QuestDef | undefined;
  let hunterView: HunterView | undefined;
  let monsterView: MonsterView | undefined;
  let actorRoot: Laya.Sprite3D | undefined;
  let bot: Bot | undefined;
  let seed = 1;
  let accumulator = 0;
  let hits = 0, hurts = 0;
  const speed = Math.max(1, Number(params.get('speed') ?? 1));
  const effects: { fx: ZhudaEffect3D; left: number }[] = [];
  const cam = { yaw: 0, eye: [0, 4, -18] as [number, number, number], target: [0, 1.5, 0] as [number, number, number], shake: 0 };
  const stick = { x: 0, y: 0 };
  const keys = new Set<string>();

  // Ground marks for a strike about to land: a lane for a charge, a disc for a slam or a sweep.
  const markMaterial = Zhuda3D.createMaterial({ type: 'unlit', albedoColor: [1, 0.12, 0.05, 0.2] });
  markMaterial.materialRenderMode = Laya.MaterialRenderMode.RENDERMODE_TRANSPARENT;
  const disc = new Laya.MeshSprite3D(Zhuda3D.createPrimitiveMesh('cylinder', { radius: 1, height: 0.04 }));
  const lane = new Laya.MeshSprite3D(Zhuda3D.createPrimitiveMesh('box', { width: 1, height: 0.04, depth: 1 }));
  for (const m of [disc, lane]) (m.meshRenderer.sharedMaterial = markMaterial), (m.meshRenderer.castShadow = false), (m.active = false);

  function clearHunt() {
    for (const e of effects) e.fx.dispose();
    effects.length = 0;
    disc.removeSelf();
    lane.removeSelf();
    actorRoot?.destroy(true);
    actorRoot = undefined;
    hunt?.input.dispose();
    hunt = undefined;
    hunterView = monsterView = undefined;
    context.runtime.layers.setPaused('world', false);
  }

  async function startHunt(q: QuestDef) {
    show('loading');
    clearHunt();
    await mountArena(q.arena);
    seed = Number(params.get('seed') ?? (Date.now() % 100000));
    const h = new Hunt(q.monster, loadoutOf(save), seed);
    actorRoot = new Laya.Sprite3D('actors');
    stage!.scene3D.addChild(actorRoot);
    actorRoot.addChild(disc);
    actorRoot.addChild(lane);
    [hunterView, monsterView] = await Promise.all([HunterView.load(library, actorRoot), MonsterView.load(library, actorRoot, h.monster)]);
    hunt = h;
    quest = q;
    hits = hurts = 0;
    accumulator = 0;
    cam.yaw = 0;
    const auto = params.get('auto');
    bot = auto === 'masher' ? masher : auto ? careful(auto === 'head' ? 'head' : 'legs') : undefined;
    $('#mname').textContent = `${'★'.repeat(q.stars)} ${h.monster.def.name}`;
    $('#gear').textContent = `${gear(save.weapon).name}・${gear(save.armor).name}`;
    $('#status').textContent = '';
    show('hunt');
    banner('狩獵開始', 1400);
  }

  // ---- input -----------------------------------------------------------------------------
  const press = (action: 'light' | 'heavy' | 'dodge' | 'potion') => {
    sound.start('press');
    hunt?.press(action);
  };
  const KEYMAP: Record<string, 'light' | 'heavy' | 'dodge' | 'potion'> = { KeyJ: 'light', KeyK: 'heavy', Space: 'dodge', KeyL: 'dodge', KeyE: 'potion' };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    const a = KEYMAP[e.code];
    if (a && report.screen === 'hunt') (e.preventDefault(), press(a));
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => (keys.clear(), hunt?.input.clear(), (stick.x = stick.y = 0)));
  const touchLayer = $('#hud');
  const stickEl = $('#stick'), knob = $('#knob');
  let stickOrigin: { x: number; y: number } | null = null;
  // The left half of the screen is the stick (it starts where the thumb lands); buttons are DOM.
  const pointers = new ZhudaPointerInput(
    container,
    (e) => (report.screen === 'hunt' && e.clientX < window.innerWidth * 0.5 ? 'stick' : null),
    (state) => {
      const p = [...state.values()].find((s) => s.role === 'stick');
      if (!p) {
        stickOrigin = null;
        stick.x = stick.y = 0;
        knob.style.transform = '';
        return;
      }
      stickOrigin ??= { x: p.x, y: p.y };
      const dx = p.x - stickOrigin.x, dy = p.y - stickOrigin.y, d = Math.hypot(dx, dy), k = Math.min(1, d / 56) / (d || 1);
      stick.x = dx * k;
      stick.y = -dy * k;
      knob.style.transform = `translate(${stick.x * 45}px,${-stick.y * 45}px)`;
    },
  );
  void stickEl;
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') document.body.classList.add('touch');
    sound.start('pointer');
  }, { capture: true });
  if (params.has('touch') || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  for (const b of touchLayer.querySelectorAll<HTMLElement>('[data-act]')) {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press(b.dataset.act as 'light');
    });
  }

  // ---- HUD -------------------------------------------------------------------------------
  const nums = $('#nums');
  function project(x: number, y: number, z: number): { x: number; y: number } | null {
    const [ex, ey, ez] = cam.eye, [tx, ty, tz] = cam.target;
    let fx = tx - ex, fy = ty - ey, fz = tz - ez;
    const fl = Math.hypot(fx, fy, fz);
    (fx /= fl), (fy /= fl), (fz /= fl);
    // right = forward × up, up' = right × forward (right-handed, y up)
    let rx = -fz, rz = fx;
    const rl = Math.hypot(rx, rz) || 1;
    (rx /= rl), (rz /= rl);
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    const dx = x - ex, dy = y - ey, dz = z - ez;
    const depth = dx * fx + dy * fy + dz * fz;
    if (depth < 0.2) return null;
    const w = container.clientWidth, h = container.clientHeight;
    const f = 1 / Math.tan(((stage?.camera.fieldOfView ?? 50) * Math.PI) / 360);
    const sx = ((dx * rx + dz * rz) / depth) * f * (h / w), sy = ((dx * ux + dy * uy + dz * uz) / depth) * f;
    return { x: (0.5 + sx * 0.5) * w, y: (0.5 - sy * 0.5) * h }; // +x is to the left of a camera looking along +z (right-handed)
  }
  function popup(text: string, cls: string, x: number, y: number, z: number) {
    const p = project(x, y, z);
    if (!p) return;
    const el = document.createElement('div');
    el.className = `num ${cls}`;
    el.textContent = text;
    el.style.left = `${p.x + (Math.random() - 0.5) * 30}px`;
    el.style.top = `${p.y}px`;
    nums.appendChild(el);
    setTimeout(() => el.remove(), 720);
  }
  let bannerTimer = 0;
  function banner(text: string, ms: number) {
    const el = $('#banner');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => el.classList.remove('on'), ms);
  }
  let cueTimer = 0;
  function cue(text: string) {
    const el = $('#cue');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(cueTimer);
    cueTimer = window.setTimeout(() => el.classList.remove('on'), 900);
  }
  const PART_NAME: Record<string, string> = { head: '頭', body: '身', legs: '腳', tail: '尾' };

  /** Freezes the world layer for a moment: the blade bites. Timers on the unscaled channel end it. */
  function hitStop(seconds: number) {
    const layers = context.runtime.layers;
    layers.setPaused('world', true);
    context.runtime.timers.scheduleOnce(seconds, () => layers.setPaused('world', false), { channel: 'unscaled' });
  }
  function spawn(preset: string, x: number, y: number, z: number, scale: number) {
    if (!stage) return;
    const fx = new ZhudaEffect3D(stage.scene3D, preset, { position: [x, y, z], scale, seed: (hits * 31 + effects.length) | 0 });
    effects.push({ fx, left: Math.max(0.6, fx.preset.seconds ?? 1.2) });
  }

  function play(events: HuntEvent[]) {
    const h = hunt!;
    for (const e of events) {
      switch (e.type) {
        case 'action':
          hunterView!.act(e.action);
          sound.play(e.action === 'dodge' ? 'roll' : e.action === 'heavy' ? 'heavy' : e.action === 'potion' ? 'tap' : 'swing', 0.5);
          break;
        case 'hit': {
          hits += 1;
          const y = h.monster.def.height * (e.part === 'legs' ? 0.25 : e.part === 'head' ? 0.5 : 0.4);
          popup(String(e.damage), e.weak ? 'weak' : '', e.x, y + 0.4, e.z);
          spawn(e.weak ? 'sparks' : 'hit', e.x, y, e.z, e.mv > 50 ? 1.8 : 1.1);
          monsterView!.hit(e.weak);
          sound.play(e.kind === 'blunt' ? 'thud' : e.weak ? 'weak' : 'cut', 0.5 + e.mv / 160);
          if (speed === 1) hitStop(0.035 + e.mv / 1100);
          cam.shake = Math.max(cam.shake, e.mv / 260);
          break;
        }
        case 'break':
          popup(`${PART_NAME[e.part]}部破壞`, 'note', h.monster.x, h.monster.def.height, h.monster.z);
          spawn('explosion', h.monster.x, h.monster.def.height * 0.5, h.monster.z, 0.8);
          sound.play('break', 0.9);
          cam.shake = 0.5;
          break;
        case 'stun':
          popup('暈眩', 'note', h.monster.x, h.monster.def.height, h.monster.z);
          break;
        case 'topple':
          popup('倒地', 'note', h.monster.x, h.monster.def.height, h.monster.z);
          sound.play('slam', 0.7);
          break;
        case 'enrage':
          cue('怒！');
          sound.play('roar', 0.9);
          cam.shake = 0.7;
          break;
        case 'telegraph':
          cue(h.monster.move?.name ?? '');
          sound.play('cue', 0.6);
          break;
        case 'strike':
          if (e.move === 'slam' || e.move === 'stomp' || e.move === 'charge') (sound.play('slam', 0.8), (cam.shake = Math.max(cam.shake, 0.6)), spawn('dust-motes', h.monster.x, 0.3, h.monster.z, 2.5));
          break;
        case 'hurt':
          hurts += 1;
          popup(`-${e.damage}`, 'hurt', h.hunter.x, 1.8, h.hunter.z);
          hunterView!.hurt();
          sound.play('hurt', 0.9);
          cam.shake = 0.8;
          $('#vignette').style.opacity = '1';
          setTimeout(() => ($('#vignette').style.opacity = '0'), 260);
          break;
        case 'heal':
          spawn('heal', h.hunter.x, 0.2, h.hunter.z, 1);
          sound.play('heal', 0.7);
          break;
        case 'faint':
          banner(`力盡 ${h.hunter.faints}/${MAX_FAINTS}`, 1800);
          break;
        case 'slain':
          banner('討伐完成', 3000);
          sound.play('win', 0.8);
          context.runtime.timers.scheduleOnce(speed > 1 ? 0.6 : 3.4, finish, { channel: 'unscaled' });
          break;
        case 'fail':
        case 'timeout':
          banner(e.type === 'fail' ? '任務失敗' : '時間到', 3000);
          sound.play('lose', 0.8);
          context.runtime.timers.scheduleOnce(speed > 1 ? 0.6 : 3, finish, { channel: 'unscaled' });
          break;
      }
    }
  }

  function finish() {
    if (!hunt || !quest) return;
    const won = hunt.result === 'won';
    const loot = won ? carve(hunt, seed) : {};
    if (won) grant(save, quest, loot, Math.round(hunt.time));
    report.loot = loot;
    persist();
    resultScreen(won, loot);
  }

  // ---- screens ---------------------------------------------------------------------------
  const screens = $('#screens');
  function show(screen: string) {
    report.screen = screen;
    $('#loading').classList.toggle('hide', screen !== 'loading');
    $('#hud').classList.toggle('hide', screen !== 'hunt');
    screens.classList.toggle('hide', screen === 'hunt' || screen === 'loading');
  }
  const el = (html: string) => {
    screens.innerHTML = html;
    for (const b of screens.querySelectorAll<HTMLElement>('[data-go]')) b.addEventListener('click', () => (sound.start('click'), sound.play('tap', 0.4), go(b.dataset.go!)));
  };
  function go(to: string) {
    if (to === 'hub') return hubScreen();
    if (to === 'title') return titleScreen();
    if (to.startsWith('quest:')) return void startHunt(QUESTS.find((q) => q.id === to.slice(6))!).catch(fail);
    if (to.startsWith('forge:')) {
      if (forge(save, to.slice(6))) (persist(), sound.play('break', 0.5));
      return hubScreen();
    }
    if (to.startsWith('equip:')) {
      const g = gear(to.slice(6));
      if (g.kind === 'weapon') save.weapon = g.id;
      else save.armor = g.id;
      persist();
      return hubScreen();
    }
  }
  function titleScreen() {
    show('title');
    el(`<div class="panel" style="background:#12171ea0;text-align:center"><h1>豬大狩荒</h1><div class="sub">山海巨獸・共鬥狩獵</div>
      <p style="line-height:1.9;opacity:.9">看清牠的起手，在最後一刻翻滾穿過去；<br>牠收招的空檔，才是你出刀的時候。<br>破壞部位、剝取素材，打造下一把刀。</p>
      <div class="center"><button class="go" data-go="hub">出　發</button></div></div>`);
  }
  const itemsHtml = (items: Record<string, number>) => Object.entries(items).filter(([, n]) => n > 0).map(([k, n]) => `<span>${k} ×${n}</span>`).join('') || '<span>（無）</span>';
  function hubScreen() {
    show('hub');
    const quests = QUESTS.map((q) => {
      const open = questOpen(save, q), c = save.cleared[q.id];
      return `<div class="card ${open ? '' : 'locked'}" ${open ? `data-go="quest:${q.id}"` : ''}><span class="tag">${c ? `最佳 ${Math.floor(c.best / 60)}:${String(c.best % 60).padStart(2, '0')}・${c.times} 次` : open ? '未討伐' : '未開放'}</span>
        <span class="stars">${'★'.repeat(q.stars)}</span> <b>${q.name}</b><small>${q.text}</small><small>報酬 ${q.coins} 金・限時 ${QUEST_SECONDS / 60} 分・力盡 ${MAX_FAINTS} 次失敗</small></div>`;
    }).join('');
    const forgeHtml = GEAR.map((g) => {
      const owned = save.owned.includes(g.id), on = save.weapon === g.id || save.armor === g.id, block = forgeBlock(save, g);
      const stat = g.kind === 'weapon' ? `攻擊 ${g.attack}` : `防禦 ${g.defense}`;
      const needs = Object.entries(g.needs).map(([k, n]) => `${k}×${n}`).join('、');
      return `<div class="card ${owned || !block ? '' : 'locked'}" ${owned ? (on ? '' : `data-go="equip:${g.id}"`) : block ? '' : `data-go="forge:${g.id}"`}>
        <span class="tag">${on ? '裝備中' : owned ? '點選裝備' : block || '可打造'}</span><b>${g.name}</b>　${stat}${owned ? '' : `<small>${g.coins} 金${needs ? '・' + needs : ''}</small>`}</div>`;
    }).join('');
    el(`<div class="panel"><div class="cols"><div><h2>任務看板</h2>${quests}</div>
      <div><h2>鍛冶屋　<span style="font-size:16px;letter-spacing:0">${save.coins} 金</span></h2><div class="items">${itemsHtml(save.items)}</div>${forgeHtml}</div></div></div>`);
  }
  function resultScreen(won: boolean, loot: Record<string, number>) {
    show('result');
    const h = hunt!, t = Math.round(h.time);
    const broken = Object.entries(h.monster.parts).filter(([, p]) => p.broken).map(([k]) => PART_NAME[k]);
    el(`<div class="panel" style="width:min(92vw,560px);text-align:center"><h2>${won ? '討伐完成' : h.result === 'timeout' ? '時間到' : '任務失敗'}</h2>
      <p>${quest!.name}　${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}　力盡 ${h.hunter.faints} 次</p>
      <p>破壞部位：${broken.join('、') || '無'}</p>
      ${won ? `<p>報酬 ${quest!.coins} 金</p><div class="items" style="justify-content:center">${itemsHtml(loot)}</div>` : '<p style="opacity:.8">牠起手時先別出刀：等牠收招。</p>'}
      <div class="center"><button class="go" data-go="hub">回據點</button>　<button class="ghost" data-go="quest:${quest!.id}">再戰</button></div></div>`);
  }
  const mute = $('#mute');
  const muteLabel = () => (mute.textContent = `聲音：${sound.muted ? '關' : '開'}`);
  muteLabel();
  mute.addEventListener('click', () => {
    sound.start('click');
    sound.setMuted(!sound.muted);
    storage?.setItem('zhuda-hunt/muted', sound.muted ? '1' : '0');
    muteLabel();
  });

  // ---- the frame -------------------------------------------------------------------------
  const profiler = new ZhudaRuntimeProfiler({ capacity: 120 });
  const renderEngine = (globalThis as any).Laya?.LayaGL?.renderEngine;
  const gl = renderEngine?.getDevice?.() ?? renderEngine?.gl ?? null;
  if (gl) typeof gl.createQuerySet === 'function' ? profiler.attachWebGPU(gl) : profiler.attach(gl);
  let frameOpen = false;
  let clock = 0;
  let hpShown = 100;

  function stickWorld(): { mx: number; mz: number } {
    let x = stick.x, y = stick.y;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) (x /= l), (y /= l);
    // Stick up is away from the camera. The camera looks along (sin yaw, cos yaw); its right is (-cos yaw, sin yaw)
    // in this engine's right-handed world as seen on screen.
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    return { mx: s * y - c * x, mz: c * y + s * x };
  }

  context.runtime.start((dt) => {
    if (!stage) return;
    const layers = context.runtime.layers;
    const world = layers.sample('world').scaledDeltaTime;
    const real = layers.sample('ui').unscaledDeltaTime || dt;
    clock += real;
    if (hunt && hunterView && monsterView && report.screen === 'hunt') {
      const h = hunt;
      // Fixed steps on the world layer; a slow frame catches up at most a quarter second.
      accumulator = Math.min(0.25 * speed, accumulator + world * speed);
      while (accumulator >= STEP) {
        accumulator -= STEP;
        if (h.result !== 'running') break;
        play(h.step(bot ? bot(h) : stickWorld()));
      }
      const dist = Math.hypot(h.monster.x - h.hunter.x, h.monster.z - h.hunter.z);
      hunterView.update(world * speed, h);
      monsterView.update(world * speed, h.monster, dist);

      // Marks on the ground while it winds up.
      const m = h.monster, mv = m.move;
      const warn = m.state === 'windup' && mv && mv.shape !== 'cone';
      disc.active = !!warn && mv!.shape !== 'charge';
      lane.active = !!warn && mv!.shape === 'charge';
      if (warn) {
        const grow = 0.35 + 0.65 * Math.min(1, m.t / m.span);
        if (mv!.shape === 'charge') {
          const len = (mv!.range + m.def.reach) * grow;
          lane.transform.position = new Laya.Vector3(m.x + Math.sin(m.yaw) * len * 0.5, 0.06, m.z + Math.cos(m.yaw) * len * 0.5);
          lane.transform.localRotationEuler = new Laya.Vector3(0, (m.yaw * 180) / Math.PI, 0);
          lane.transform.localScale = new Laya.Vector3(mv!.width ?? 2, 1, len);
        } else {
          disc.transform.position = new Laya.Vector3(m.x, 0.06, m.z);
          disc.transform.localScale = new Laya.Vector3(mv!.range * grow, 1, mv!.range * grow);
        }
      }

      // The camera stands behind the hunter on the line from the monster, eased, lifted with distance.
      const want = Math.atan2(m.x - h.hunter.x, m.z - h.hunter.z);
      cam.yaw += Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw)) * (1 - Math.exp(-2.2 * real));
      const back = 6.5 + Math.min(5, dist * 0.22), up = 3.1 + Math.min(3, dist * 0.1) + m.def.height * 0.12;
      cam.shake = Math.max(0, cam.shake - real * 3);
      const jx = (Math.sin(clock * 71) * cam.shake) / 6, jy = (Math.cos(clock * 53) * cam.shake) / 6;
      cam.eye = [h.hunter.x - Math.sin(cam.yaw) * back + jx, up + jy, h.hunter.z - Math.cos(cam.yaw) * back];
      const look = Math.min(dist, 9) * 0.45;
      cam.target = [h.hunter.x + Math.sin(cam.yaw) * look, 1.2 + m.def.height * 0.16, h.hunter.z + Math.cos(cam.yaw) * look];

      // HUD
      $('#hp').style.transform = `scaleX(${h.hunter.hp / h.hunter.maxHp})`;
      hpShown += (h.hunter.hp - hpShown) * Math.min(1, real * 3);
      $('#hp-lag').style.transform = `scaleX(${Math.max(h.hunter.hp, hpShown) / h.hunter.maxHp})`;
      $('#st').style.transform = `scaleX(${h.hunter.stamina / 100})`;
      $('#potions').textContent = String(h.hunter.potions);
      $('#faints').textContent = String(h.hunter.faints);
      const left = Math.max(0, QUEST_SECONDS - h.time);
      $('#clock').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      const broken = Object.entries(m.parts).filter(([, p]) => p.broken).map(([k]) => k);
      $('#status').textContent = [m.enraged > 0 ? '發怒' : m.exhausted > 0 ? '疲憊' : '', m.state === 'stun' ? '暈眩' : m.state === 'topple' ? '倒地' : '', ...broken.map((b) => `${PART_NAME[b]}破`)].filter(Boolean).join('・');
      report.hunt = { quest: quest!.id, time: Math.round(h.time * 10) / 10, hp: h.hunter.hp, stamina: Math.round(h.hunter.stamina), faints: h.hunter.faints, monster: Math.round((m.hp / m.def.hp) * 1000) / 10,
        state: m.state, move: mv?.id ?? null, enraged: m.enraged > 0, broken, result: h.result, hits, hurts, dist: Math.round(dist * 10) / 10, action: h.hunter.action };
    } else {
      // Menus: a slow turn round the empty field.
      const a = clock * 0.06;
      cam.eye = [Math.sin(a) * 26, 7, Math.cos(a) * 26];
      cam.target = [0, 2, 0];
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.fx.update(real);
      e.fx.render(stage.camera);
      if ((e.left -= real) <= 0) (e.fx.dispose(), effects.splice(i, 1));
    }
    stage.setCamera({ eye: cam.eye, target: cam.target, focalLengthMm: 26 });
    stage.setTime(clock);
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    stage.prepare(aspect);
    if (frameOpen) {
      const sample = profiler.endFrame(dt * 1000, dt * 1000);
      report.draws = sample.drawCalls;
      report.triangles = sample.triangles;
    }
    report.frames++;
    profiler.beginFrame();
    frameOpen = true;
  });

  const fail = (e: unknown) => {
    report.error = String((e as Error)?.stack ?? e);
    console.error(e);
  };
  report.save = save;
  const direct = QUESTS.find((q) => q.id === params.get('quest'));
  if (direct) await startHunt(direct);
  else {
    await mountArena('plain');
    if (params.get('screen') === 'hub') hubScreen();
    else titleScreen();
  }
  $('#loading').classList.add('hide');
  report.sound = sound.diagnostics();
  report.ready = true;
  void pointers;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  console.error(e);
});
