// 豬大守關 — the tower defence of src/core/td.ts in 3D: the pass is a film scene, the beasts are
// glTF models from the engine's model library (pooled, their Move clip paced to their speed),
// towers and shots are engine primitives, hits are the engine's ready 3D effects. Steps run at
// 30 Hz on the session's `world` layer (×2 by its time scale). Menus and markers are DOM.
//   index.html?auto=1&speed=4      the careful builder plays (recorded runs)
import {
  DirectoryAssetProvider, Zhuda3D, ZhudaEffect3D, ZhudaEngine, ZhudaFilmAssets, ZhudaModelInspector, ZhudaModelLibrary, ZhudaRuntimeProfiler,
  loadZhudaFilmScene, validateZhudaFilmScene, type ModelInstance,
} from 'zhuda-laya-engine';
import { ENEMIES, Game, PADS, START_LIVES, STEP, TOWERS, WAVES, botBuild, type Enemy, type TdEvent, type Tower, type TowerKind } from './core/td.ts';
import { Sound } from './audio/sound.ts';
import { pass } from './view/scene.ts';

interface Report {
  ready: boolean;
  error?: string;
  screen: string;
  frames: number;
  draws?: number;
  triangles?: number;
  maxDraws: number;
  pads: [number, number][];
  game?: { state: string; wave: number; coins: number; lives: number; enemies: number; towers: string; kills: number; time: number; shown: number };
  stars?: number;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, screen: 'boot', frames: 0, maxDraws: 0, pads: [] });
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const SHOW = 1.9;
const MODEL_HEIGHT: Record<string, number> = { zheng: 1.742, jiuweihu: 2.053, kui: 2.743, xuanwu: 37.095 };

async function main() {
  const container = $('#game');
  const context = await ZhudaEngine.boot({ container, features: ['core', '3d', 'gltf', 'postProcess'], dprCap: 1.5, targetFPS: 60, antialias: false });
  const sound = new Sound(localStorage.getItem('zhuda-guard/muted') === '1');
  void sound.load();
  const library = new ZhudaModelLibrary({ provider: new DirectoryAssetProvider({ baseUrl: 'assets/models/', timeoutMs: 120_000, maxBytes: 64 * 1024 * 1024 }), timeoutMs: 120_000 });
  const scene = pass();
  const issues = validateZhudaFilmScene(scene);
  if (issues.length) throw Error(issues.join('; '));
  const stage = await loadZhudaFilmScene(context.rootScene, scene, { assets: new ZhudaFilmAssets(new DirectoryAssetProvider({ baseUrl: 'assets/', timeoutMs: 120_000, maxBytes: 64 * 1024 * 1024 }), { timeoutMs: 120_000 }) });
  const world = new Laya.Sprite3D('world');
  stage.scene3D.addChild(world);
  const CAM = { eye: [0, 47, -45] as [number, number, number], target: [0, 0, 0] as [number, number, number] };

  // ---- the beasts: a pool of models per kind ---------------------------------------------
  interface Body { model: ModelInstance; inspector: ZhudaModelInspector; move?: { path: string; seconds: number }; uid: number; scale: number }
  const pools: Record<string, Body[]> = {};
  async function body(id: string): Promise<Body> {
    const model = await library.instantiate(`${id}.glb`, { independentMaterials: true });
    const inspector = new ZhudaModelInspector(model);
    const clip = inspector.inspect().animations.find((a) => a.name === 'Move');
    const scale = (ENEMIES[id].height * SHOW) / MODEL_HEIGHT[id]; // drawn larger than the rules' metres: the camera is far
    model.node.transform.localScale = new Laya.Vector3(scale, scale, scale);
    model.node.active = false;
    world.addChild(model.node);
    const b: Body = { model, inspector, move: clip ? { path: clip.path, seconds: clip.durationSeconds } : undefined, uid: 0, scale };
    if (b.move) (inspector.play(b.move.path, 'Move'), inspector.setAnimationSpeed(b.move.path, 1));
    return b;
  }
  /** Enough bodies for the most of each kind a wave can have on the road at once (capped: the rest walk unseen for a moment). */
  const CAP: Record<string, number> = { zheng: 12, jiuweihu: 12, kui: 8, xuanwu: 1 };
  for (const id of Object.keys(ENEMIES)) pools[id] = [];
  async function fill(wave: number) {
    const need: Record<string, number> = {};
    for (const [id, count] of WAVES[Math.min(wave, WAVES.length - 1)]) need[id] = Math.min(CAP[id], (need[id] ?? 0) + count);
    for (const [id, n] of Object.entries(need)) while (pools[id].length < n) pools[id].push(await body(id));
  }
  await fill(0);

  // ---- towers and shots: primitives ------------------------------------------------------
  const mat = (albedoColor: [number, number, number, number], smoothness = 0.2, metallic = 0) => Zhuda3D.createMaterial({ type: 'pbr', albedoColor, smoothness, metallic });
  const glow = (albedoColor: [number, number, number, number]) => Zhuda3D.createMaterial({ type: 'unlit', albedoColor });
  const M = { stone: mat([0.62, 0.6, 0.56, 1]), wood: mat([0.42, 0.28, 0.16, 1]), red: mat([0.7, 0.16, 0.1, 1], 0.4), iron: mat([0.25, 0.25, 0.28, 1], 0.6, 1), ember: glow([1, 0.5, 0.12, 1]), ice: mat([0.6, 0.85, 1, 1], 0.9), frost: glow([0.7, 0.92, 1, 1]), arrow: glow([1, 0.95, 0.7, 1]) };
  const MESH = { cyl: Zhuda3D.createPrimitiveMesh('cylinder', { radius: 1, height: 1 }), cone: Zhuda3D.createPrimitiveMesh('cone', { radius: 1, height: 1 }), box: Zhuda3D.createPrimitiveMesh('box', { width: 1, height: 1, depth: 1 }), ball: Zhuda3D.createPrimitiveMesh('sphere', { radius: 1 }) };
  const part = (parent: Laya.Sprite3D, mesh: Laya.Mesh, material: Laya.Material, y: number, sx: number, sy: number, sz: number, shadow = true) => {
    const n = new Laya.MeshSprite3D(mesh);
    n.meshRenderer.sharedMaterial = material;
    n.meshRenderer.castShadow = shadow;
    n.meshRenderer.receiveShadow = true;
    n.transform.localPosition = new Laya.Vector3(0, y, 0);
    n.transform.localScale = new Laya.Vector3(sx, sy, sz);
    parent.addChild(n);
    return n;
  };
  const towerNodes = new Map<number, { key: string; node: Laya.Sprite3D; head: Laya.Sprite3D }>();
  function towerNode(t: Tower) {
    const key = `${t.kind}${t.level}`, old = towerNodes.get(t.pad);
    if (old?.key === key) return old;
    old?.node.destroy(true);
    const node = new Laya.Sprite3D(`tower-${t.pad}`), head = new Laya.Sprite3D('head');
    const [x, z] = PADS[t.pad], h = 3.4 + t.level * 1.0, k = 1.45 + t.level * 0.16;
    node.transform.position = new Laya.Vector3(x, 0.3, z);
    if (t.kind === 'arrow') {
      part(node, MESH.cyl, M.stone, h / 2, 0.9 * k, h, 0.9 * k);
      part(node, MESH.box, M.wood, h + 0.25, 2.1 * k, 0.5, 2.1 * k);
      part(node, MESH.cone, M.red, h + 1.1, 1.5 * k, 1.2, 1.5 * k);
      part(head, MESH.box, M.iron, h + 0.55, 0.16, 0.16, 1.5);
    } else if (t.kind === 'fire') {
      part(node, MESH.cyl, M.iron, h * 0.35, 1.3 * k, h * 0.7, 1.3 * k);
      part(node, MESH.cyl, M.stone, h * 0.75, 1.45 * k, 0.3, 1.45 * k);
      part(head, MESH.ball, M.ember, h * 0.95, 0.7 * k, 0.7 * k, 0.7 * k, false);
    } else {
      part(node, MESH.cyl, M.stone, 0.3, 1.2 * k, 0.6, 1.2 * k);
      part(node, MESH.cone, M.ice, 0.6 + h * 0.6, 0.8 * k, h * 1.2, 0.8 * k);
      part(head, MESH.ball, M.frost, h * 1.25 + 0.6, 0.3 * k, 0.3 * k, 0.3 * k, false);
    }
    node.addChild(head);
    world.addChild(node);
    const made = { key, node, head };
    towerNodes.set(t.pad, made);
    return made;
  }
  const shotNodes: Laya.MeshSprite3D[] = [];
  const effects: { fx: ZhudaEffect3D; left: number }[] = [];
  const spawn = (preset: string, x: number, y: number, z: number, scale: number) => {
    if (effects.length >= 8) return;
    const fx = new ZhudaEffect3D(stage.scene3D, preset, { position: [x, y, z], scale, seed: report.frames });
    effects.push({ fx, left: Math.max(0.6, fx.preset.seconds ?? 1) });
  };

  // ---- DOM: markers, menu, HUD -----------------------------------------------------------
  /** Where a point of the world is on the page, by the stage's own camera (off-screen when it is behind it). */
  function project(x: number, y: number, z: number): [number, number] {
    const p = stage.worldToScreen([x, y, z], { width: container.clientWidth, height: container.clientHeight });
    return p ? [p.x, p.y] : [-9999, -9999];
  }
  const marks = $('#marks'), menu = $('#menu');
  const padEls = PADS.map((_, i) => {
    const el = document.createElement('div');
    el.className = 'pad';
    el.dataset.pad = String(i);
    el.addEventListener('click', (e) => (e.stopPropagation(), openMenu(i)));
    marks.appendChild(el);
    return el;
  });
  const hpEls = new Map<number, HTMLElement>();
  let game = new Game();
  let selected = -1;
  let auto = params.has('auto');
  let speed = Math.max(1, Number(params.get('speed') ?? 1));
  const closeMenu = () => ((selected = -1), menu.classList.add('hide'), padEls.forEach((p) => p.classList.remove('sel')));
  window.addEventListener('click', closeMenu);
  function openMenu(pad: number) {
    sound.start('click');
    sound.play('tap', 0.4);
    selected = pad;
    padEls.forEach((p, i) => p.classList.toggle('sel', i === pad));
    const t = game.towerAt(pad);
    const opt = (id: string, title: string, sub: string, ok: boolean) => `<button data-do="${id}" ${ok ? '' : 'disabled'}>${title}<small>${sub}</small></button>`;
    if (!t) menu.innerHTML = (Object.keys(TOWERS) as TowerKind[]).map((k) => opt(`build:${k}`, `${TOWERS[k].name} ${TOWERS[k].cost[0]}`, TOWERS[k].text, game.coins >= TOWERS[k].cost[0])).join('');
    else {
      const up = game.upgradeCost(pad), d = TOWERS[t.kind];
      menu.innerHTML = (up === null ? opt('none', '已滿級', `${d.name} Lv.3`, false) : opt('up', `升級 ${up}`, `${d.name} Lv.${t.level + 1} → ${t.level + 2}　傷害 ${d.damage[t.level]}→${d.damage[t.level + 1]}`, game.coins >= up)) + opt('sell', `拆除 +${Math.floor(t.spent * 0.7)}`, '退回七成', true);
    }
    for (const b of menu.querySelectorAll<HTMLButtonElement>('button'))
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.dataset.do!;
        const ok = act.startsWith('build:') ? game.build(pad, act.slice(6) as TowerKind) : act === 'up' ? game.upgrade(pad) : act === 'sell' ? game.sell(pad) > 0 : false;
        if (ok) sound.play(act === 'sell' ? 'tap' : 'break', 0.5);
        if (act === 'sell') (towerNodes.get(pad)?.node.destroy(true), towerNodes.delete(pad));
        closeMenu();
      });
    const [x, y] = project(PADS[pad][0], 0.3, PADS[pad][1]);
    menu.style.left = `${Math.max(170, Math.min(container.clientWidth - 170, x))}px`;
    menu.style.top = `${Math.min(container.clientHeight - 130, y)}px`;
    menu.classList.remove('hide');
  }
  let bannerTimer = 0;
  const banner = (message: string) => {
    const el = $('#banner');
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => el.classList.remove('on'), 1800);
  };
  const float = (message: string, x: number, z: number) => {
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = message;
    const [px, py] = project(x, 2, z);
    (el.style.left = `${px}px`), (el.style.top = `${py}px`);
    marks.appendChild(el);
    setTimeout(() => el.remove(), 820);
  };
  $('#send').addEventListener('click', (e) => (e.stopPropagation(), send()));
  $('#speed').addEventListener('click', (e) => (e.stopPropagation(), (speed = speed >= 2 ? 1 : 2), ($('#speed').textContent = `×${speed}`)));
  $('#speed').textContent = `×${speed}`;
  $('#mute').addEventListener('click', (e) => {
    e.stopPropagation();
    sound.start('click');
    sound.setMuted(!sound.muted);
    localStorage.setItem('zhuda-guard/muted', sound.muted ? '1' : '0');
    $('#mute').textContent = sound.muted ? '靜音' : '聲音';
  });
  let filling = false;
  async function send() {
    if (game.state !== 'build' || filling) return;
    sound.start('click');
    filling = true;
    await fill(game.wave); // the wave's bodies are loaded before it walks
    filling = false;
    if (game.send()) (sound.play('roar', 0.6), banner(`第 ${game.wave + 1} 波`));
  }
  const screens = $('#screens');
  function show(screen: string, html = '') {
    report.screen = screen;
    $('#hud').classList.toggle('hide', screen !== 'play');
    screens.classList.toggle('hide', screen === 'play');
    screens.innerHTML = html;
    for (const b of screens.querySelectorAll<HTMLElement>('[data-go]')) b.addEventListener('click', (e) => (e.stopPropagation(), sound.start('click'), restart()));
  }
  function restart() {
    for (const t of towerNodes.values()) t.node.destroy(true);
    towerNodes.clear();
    for (const pool of Object.values(pools)) for (const b of pool) (b.uid = 0), (b.model.node.active = false);
    game = new Game();
    show('play');
  }
  function play(events: TdEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'shoot':
          if (speed <= 2) sound.play(e.kind === 'fire' ? 'heavy' : e.kind === 'frost' ? 'heal' : 'swing', 0.18);
          break;
        case 'hit':
          if (e.kind === 'fire') (spawn('explosion', e.x, 0.8, e.z, 0.5), speed <= 2 && sound.play('thud', 0.4));
          else if (e.kind === 'frost') spawn('sparks', e.x, 1, e.z, 0.7);
          break;
        case 'kill':
          float(`+${e.coins}`, e.x, e.z);
          if (e.boss) (spawn('explosion', e.x, 2, e.z, 2.4), sound.play('slam', 0.9));
          break;
        case 'leak':
          banner(`村口 −${e.lives}`);
          sound.play('hurt', 0.8);
          break;
        case 'cleared':
          sound.play('heal', 0.6);
          banner('守住了');
          break;
        case 'won':
        case 'lost': {
          const won = e.type === 'won';
          report.stars = game.stars();
          sound.play(won ? 'win' : 'lose', 0.8);
          show('result', `<div class="panel"><h1>${won ? '守住了' : '村口失守'}</h1>${won ? `<div class="stars">${'★'.repeat(game.stars())}${'☆'.repeat(3 - game.stars())}</div>` : ''}
            <p>${won ? `十二波全數擋下，村口還剩 ${game.lives}/${START_LIVES}。` : `倒在第 ${game.wave + 1} 波。厚皮的夔和玄武要用火爐，成群的九尾狐先用冰塔拖住。`}<br>擊倒 ${game.kills} 隻</p><button class="go" data-go="1">再守一次</button></div>`);
          break;
        }
      }
    }
  }

  // ---- the frame -------------------------------------------------------------------------
  const profiler = new ZhudaRuntimeProfiler({ capacity: 120 });
  const renderEngine = (globalThis as any).Laya?.LayaGL?.renderEngine;
  const gl = renderEngine?.getDevice?.() ?? renderEngine?.gl ?? null;
  if (gl) typeof gl.createQuerySet === 'function' ? profiler.attachWebGPU(gl) : profiler.attach(gl);
  let frameOpen = false, acc = 0, clock = 0;
  const DEG = 180 / Math.PI;

  context.runtime.start((dt) => {
    const layers = context.runtime.layers;
    layers.setTimeScale('world', speed);
    const worldDt = layers.sample('world').scaledDeltaTime, real = layers.sample('ui').unscaledDeltaTime || dt;
    clock += real;
    if (report.screen === 'play') {
      if (auto && game.state === 'build' && !filling) (botBuild(game), void send());
      acc = Math.min(0.5 * speed, acc + worldDt);
      while (acc >= STEP) {
        acc -= STEP;
        play(game.step());
        if (game.state !== 'wave') break;
      }
      // Bodies: every enemy keeps one while there are enough; the furthest along are served first.
      const alive = new Set(game.enemies.map((e) => e.uid));
      for (const pool of Object.values(pools)) for (const b of pool) if (b.uid && !alive.has(b.uid)) (b.uid = 0), (b.model.node.active = false);
      let shown = 0;
      const seen = new Set<number>();
      for (const e of [...game.enemies].sort((a, b) => b.dist - a.dist)) {
        const pool = pools[e.def.id];
        const b = pool.find((x) => x.uid === e.uid) ?? pool.find((x) => !x.uid);
        if (!b) continue;
        if (b.uid !== e.uid) {
          b.uid = e.uid;
          b.model.node.active = true;
          if (b.move) b.inspector.setAnimationSpeed(b.move.path, Math.max(0.6, e.def.speed / (e.def.height * 1.6)));
        }
        shown += 1;
        seen.add(e.uid);
        b.model.setTint(e.slow > 0 ? [0.6, 0.8, 1, 1] : [1, 1, 1, 1]);
        b.model.node.transform.position = new Laya.Vector3(e.x, 0.06, e.z);
        b.model.node.transform.localRotationEuler = new Laya.Vector3(0, e.yaw * DEG, 0);
        placeHp(e);
      }
      for (const [uid, el] of hpEls) if (!seen.has(uid)) (el.remove(), hpEls.delete(uid));
      for (const t of game.towers) {
        const n = towerNode(t);
        n.head.transform.localRotationEuler = new Laya.Vector3(0, t.aim * DEG, 0);
        if (t.kind !== 'arrow') n.head.transform.localPosition = new Laya.Vector3(0, Math.sin(clock * 3 + t.pad) * 0.08, 0);
      }
      while (shotNodes.length < game.shots.length) {
        const n = new Laya.MeshSprite3D(MESH.ball);
        n.meshRenderer.castShadow = false;
        world.addChild(n);
        shotNodes.push(n);
      }
      shotNodes.forEach((n, i) => {
        const s = game.shots[i];
        n.active = !!s;
        if (!s) return;
        n.meshRenderer.sharedMaterial = s.kind === 'fire' ? M.ember : s.kind === 'frost' ? M.frost : M.arrow;
        const r = s.kind === 'fire' ? 0.42 : 0.16;
        n.transform.localScale = new Laya.Vector3(r, r, r);
        n.transform.position = new Laya.Vector3(s.x, s.y, s.z);
      });
      // HUD
      $('#wave').innerHTML = `<b>第 ${Math.min(game.wave + 1, WAVES.length)}/${WAVES.length} 波</b>`;
      $('#coins').textContent = String(game.coins);
      $('#lives').textContent = `${game.lives}/${START_LIVES}`;
      ($('#send') as HTMLButtonElement).disabled = game.state !== 'build' || filling;
      $('#tip').textContent = game.state === 'build' ? (game.towers.length ? '點石台蓋塔或升級，準備好就送出下一波' : '點路邊的石台蓋第一座塔') : '';
      padEls.forEach((el, i) => {
        const [x, y] = project(PADS[i][0], 0.3, PADS[i][1]), t = game.towerAt(i);
        (el.style.left = `${x}px`), (el.style.top = `${y}px`);
        el.classList.toggle('has', !!t);
        el.textContent = t ? '★'.repeat(t.level + 1) : '＋';
        report.pads[i] = [Math.round(x), Math.round(y)];
      });
      report.game = { state: game.state, wave: game.wave, coins: game.coins, lives: game.lives, enemies: game.enemies.length, towers: game.towers.map((t) => `${t.pad}:${t.kind}${t.level + 1}`).join(' '), kills: game.kills, time: Math.round(game.time), shown };
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.fx.update(real);
      e.fx.render(stage.camera);
      if ((e.left -= real) <= 0) (e.fx.dispose(), effects.splice(i, 1));
    }
    stage.setCamera({ ...CAM, focalLengthMm: 28 });
    stage.setTime(clock);
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    stage.prepare(aspect);
    if (frameOpen) {
      const sample = profiler.endFrame(dt * 1000, dt * 1000);
      report.draws = sample.drawCalls;
      report.triangles = sample.triangles;
      if (game.state === 'wave') report.maxDraws = Math.max(report.maxDraws, sample.drawCalls);
    }
    report.frames++;
    profiler.beginFrame();
    frameOpen = true;
  });
  function placeHp(e: Enemy) {
    let el = hpEls.get(e.uid);
    if (!el) {
      el = document.createElement('div');
      el.className = `hp${e.def.id === 'xuanwu' ? ' boss' : ''}`;
      el.innerHTML = '<i></i>';
      marks.appendChild(el);
      hpEls.set(e.uid, el);
    }
    const [x, y] = project(e.x, e.def.height * SHOW + 0.6, e.z);
    (el.style.left = `${x}px`), (el.style.top = `${y}px`);
    el.style.visibility = e.hp < e.maxHp ? 'visible' : 'hidden';
    (el.firstChild as HTMLElement).style.width = `${(e.hp / e.maxHp) * 100}%`;
  }

  $('#loading').classList.add('hide');
  if (auto) show('play');
  else show('title', `<div class="panel"><h1>豬大守關</h1><p>荒獸沿山路衝向村口。<br>在路邊的石台蓋箭樓、火爐、冰塔，守住十二波。<br>箭射不穿厚皮；火燒一片；冰拖住跑得快的。</p><button class="go" data-go="1">佈　防</button></div>`);
  report.ready = true;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  console.error(e);
});
