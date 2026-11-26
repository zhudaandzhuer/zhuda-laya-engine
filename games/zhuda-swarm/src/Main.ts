// 豬大割草 — the run of src/core/run.ts on the engine's 2D stage. The whole field (ground, drops,
// enemies, shots, rings) is one sprite redrawn every frame from one atlas texture, so that
// hundreds of tokens are a handful of draws; the HUD and menus are the engine's vector UI.
// Steps run at 60 Hz on the session's `world` layer, which the level-up choice pauses.
//   index.html?auto=1&speed=4&seed=3    a bot plays (recorded runs)
import { ZhudaEffect2D, ZhudaEngine, ZhudaPointerInput, ZhudaRuntimeProfiler, ZhudaUI } from 'zhuda-laya-engine';
import { META_MAX, PASSIVES, RUN_SECONDS, Run, STEP, WEAPONS, bot, botChoose, choiceText, metaCost, type Meta, type RunEvent } from './core/run.ts';
import { Sound } from './audio/sound.ts';
import { advanceTweens, button, clickable, hot, loadTexture, node, rect, refreshHot, text, tween } from './ui/kit.ts';

interface Report {
  ready: boolean;
  error?: string;
  screen: string;
  frames: number;
  hot: Record<string, [number, number]>;
  draws?: number;
  maxDraws: number;
  run?: { time: number; state: string; hp: number; level: number; kills: number; enemies: number; peak: number; drops: number; shots: number; weapons: string; passives: string };
  save?: { coins: number; meta: Meta; best: number; runs: number };
  payout?: number;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, screen: 'boot', frames: 0, hot, maxDraws: 0 });
const params = new URLSearchParams(location.search);
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

async function main() {
  let layout = () => {};
  const context = await ZhudaEngine.boot({ container: '#game', features: ['core', '2d', 'ui'], dprCap: 2, targetFPS: 60, onResize: () => layout() });
  Laya.stage.bgColor = '#16210f';
  const sound = new Sound(storage?.getItem('zhuda-swarm/muted') === '1');
  void sound.load();
  const atlas = (await loadTexture('assets/atlas.png'))!;
  const ground = (await loadTexture('assets/ground.jpg'))!;
  const frames = (await (await fetch('assets/atlas.json')).json()).frames as Record<string, [number, number, number, number]>;
  const tex: Record<string, Laya.Texture> = {};
  for (const [name, [x, y, w, h]] of Object.entries(frames)) tex[name] = Laya.Texture.createFromTexture(atlas, x, y, w, h);

  const save = { coins: 0, meta: { might: 0, vitality: 0, greed: 0 } as Meta, best: 0, runs: 0 };
  try {
    Object.assign(save, JSON.parse((!params.has('fresh') && storage?.getItem('zhuda-swarm/save')) || '{}'));
  } catch {
    /* a broken save starts over */
  }
  const persist = () => {
    report.save = save;
    try {
      storage?.setItem('zhuda-swarm/save', JSON.stringify(save));
    } catch {
      /* private mode */
    }
  };

  // The view shows 720 units of the field's height whatever the screen; the HUD is laid out in the same units.
  const field = new Laya.Sprite();
  const fxLayer = new Laya.Sprite();
  const hud = new Laya.Sprite();
  const overlay = new Laya.Sprite();
  for (const s of [field, fxLayer, hud, overlay]) Laya.stage.addChild(s);
  fxLayer.mouseEnabled = false;
  let VW = 1280, VH = 720, K = 1;
  layout = () => {
    K = Laya.stage.height / 720;
    VH = 720;
    VW = Laya.stage.width / K;
    for (const s of [field, fxLayer, hud, overlay]) s.scale(K, K);
    drawScreen();
  };

  let run: Run | undefined;
  let screen: 'title' | 'play' | 'choose' | 'result' = 'title';
  let auto = params.has('auto');
  const speed = Math.max(1, Number(params.get('speed') ?? 1));
  let seed = Number(params.get('seed') ?? 0);
  const effects: { fx: ZhudaEffect2D; left: number; wx: number; wy: number }[] = [];
  const stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let shake = 0;

  // ---- input: drag anywhere for a stick; WASD or arrows ----------------------------------
  let origin: { x: number; y: number } | null = null;
  const container = document.querySelector<HTMLElement>('#game')!;
  const pointers = new ZhudaPointerInput(container, () => (screen === 'play' ? 'stick' : null), (state) => {
    const p = [...state.values()].find((s) => s.role === 'stick');
    if (!p) return void ((origin = null), (stick.x = stick.y = 0));
    origin ??= { x: p.x, y: p.y };
    const dx = p.x - origin.x, dy = p.y - origin.y, d = Math.hypot(dx, dy), k = Math.min(1, d / 50) / (d || 1);
    stick.x = dx * k;
    stick.y = dy * k;
  });
  window.addEventListener('keydown', (e) => (keys.add(e.code), sound.start('key')));
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => (keys.clear(), (stick.x = stick.y = 0)));
  window.addEventListener('pointerdown', () => sound.start('pointer'), { capture: true });
  const steer = () => {
    let x = stick.x, y = stick.y;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    return { mx: x, my: y };
  };

  // ---- screens ---------------------------------------------------------------------------
  function start() {
    run = new Run(seed || (Date.now() % 100000) + 1, save.meta);
    screen = 'play';
    context.runtime.layers.setPaused('world', false);
    sound.play('tap', 0.5);
    drawScreen();
  }
  function drawScreen() {
    overlay.destroyChildren();
    report.screen = screen;
    if (screen === 'title') {
      const veil = rect(overlay, 0, 0, VW, VH, '#0b1208');
      veil.alpha = 0.72;
      text(overlay, '豬大割草', { x: 0, y: 70, w: VW, size: 92, bold: true, align: 'center', color: '#ffe08a', stroke: '#3a2300' });
      text(overlay, '山海荒獸潮・撐過五分鐘', { x: 0, y: 186, w: VW, size: 30, align: 'center', color: '#d8e8c0' });
      text(overlay, `金幣 ${save.coins}　最佳 ${Math.floor(save.best / 60)}:${String(Math.floor(save.best % 60)).padStart(2, '0')}　出戰 ${save.runs} 次`, { x: 0, y: 240, w: VW, size: 24, align: 'center', color: '#ffd978' });
      button(overlay, VW / 2 - 170, 296, 340, 84, '出　發', 'gold', start, 'start', false, 36);
      const ups: [keyof Meta, string, string][] = [['might', '練力', '傷害 +6%'], ['vitality', '養膘', '生命 +12'], ['greed', '貪財', '掉金幣 +1.2%']];
      ups.forEach(([id, name, what], i) => {
        const x = VW / 2 - 480 + i * 330, level = save.meta[id], cost = metaCost(level), maxed = level >= META_MAX;
        ZhudaUI.createGlassPanel(overlay, { x, y: 420, width: 300, height: 190, radius: 16, fillColor: '#1a2414', borderColor: '#5a7a40', borderWidth: 2 });
        text(overlay, `${name}　${'●'.repeat(level)}${'○'.repeat(META_MAX - level)}`, { x: x + 20, y: 436, w: 260, size: 26, bold: true });
        text(overlay, what, { x: x + 20, y: 478, w: 260, size: 22, color: '#b8d8a0' });
        button(overlay, x + 20, 526, 260, 64, maxed ? '已滿' : `${cost} 金幣`, !maxed && save.coins >= cost ? 'blue' : 'off', () => {
          if (maxed || save.coins < cost) return;
          save.coins -= cost;
          save.meta[id] += 1;
          sound.play('level', 0.5);
          persist();
          drawScreen();
        }, `meta-${id}`, false, 24);
      });
      text(overlay, '拖曳螢幕或 WASD 移動，武器會自己攻擊。', { x: 0, y: 640, w: VW, size: 22, align: 'center', color: '#a8b898' });
      button(overlay, VW - 170, 20, 150, 50, sound.muted ? '聲音：關' : '聲音：開', 'dark', () => {
        sound.setMuted(!sound.muted);
        storage?.setItem('zhuda-swarm/muted', sound.muted ? '1' : '0');
        drawScreen();
      }, 'mute', false, 20);
    } else if (screen === 'choose' && run) {
      const veil = rect(overlay, 0, 0, VW, VH, '#000000');
      veil.alpha = 0.55;
      clickable(veil, VW, VH, () => {});
      text(overlay, `升級！Lv.${run.player.level}`, { x: 0, y: 90, w: VW, size: 56, bold: true, align: 'center', color: '#ffe08a', stroke: '#3a2300' });
      run.choices.forEach((c, i) => {
        const t = choiceText(c), x = VW / 2 - 500 + i * 340, evo = c.kind === 'evolve';
        const card = node(overlay, x, 200);
        card.graphics.drawRoundRect(0, 0, 320, 360, 18, 18, 18, 18, evo ? '#4a3208' : '#1c2740', evo ? '#ffd24a' : '#6a86c0', 4);
        rect(card, 20, 20, 110, 36, evo ? '#ffd24a' : c.kind === 'weapon' ? '#c8433a' : c.kind === 'passive' ? '#3d8a50' : '#8a6a3d', 8);
        text(card, t.tag, { x: 20, y: 24, w: 110, size: 22, bold: true, align: 'center', color: evo ? '#3a2300' : '#ffffff' });
        text(card, t.title, { x: 0, y: 110, w: 320, size: 44, bold: true, align: 'center', color: evo ? '#ffe9a8' : '#ffffff' });
        text(card, t.text, { x: 30, y: 200, w: 260, size: 24, align: 'center', wrap: true, color: '#c8d4ec', leading: 8 });
        clickable(card, 320, 360, () => pick(i), `choice-${i}`);
      });
    } else if (screen === 'result' && run) {
      const won = run.state === 'won';
      const veil = rect(overlay, 0, 0, VW, VH, '#000000');
      veil.alpha = 0.7;
      text(overlay, won ? '撐過了！' : '力盡', { x: 0, y: 120, w: VW, size: 84, bold: true, align: 'center', color: won ? '#ffe08a' : '#ff9a8a', stroke: '#000000' });
      const t = Math.floor(run.time);
      text(overlay, `存活 ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}　等級 ${run.player.level}　擊倒 ${run.player.kills}`, { x: 0, y: 250, w: VW, size: 32, align: 'center' });
      text(overlay, [...run.weapons].map(([id, w]) => (w.evolved ? WEAPONS[id].evolved : `${WEAPONS[id].name} Lv.${w.level}`)).join('　'), { x: 0, y: 310, w: VW, size: 26, align: 'center', color: '#c8d4ec' });
      text(overlay, `金幣 +${report.payout}`, { x: 0, y: 370, w: VW, size: 40, bold: true, align: 'center', color: '#ffd978' });
      button(overlay, VW / 2 - 170, 470, 340, 84, '回營地', 'gold', () => ((screen = 'title'), (run = undefined), drawScreen()), 'home', false, 34);
    }
    refreshHot();
  }
  function pick(i: number) {
    if (!run || run.state !== 'choose') return;
    const c = run.choices[i];
    run.choose(i);
    sound.play(c.kind === 'evolve' ? 'evolve' : 'tap', 0.6);
    if (c.kind === 'evolve') burst('confetti', run.player.x, run.player.y - 200, 1.6);
    screen = 'play';
    context.runtime.layers.setPaused('world', false);
    drawScreen();
  }
  function finish() {
    if (!run) return;
    const coins = run.payout();
    report.payout = coins;
    save.coins += coins;
    save.best = Math.max(save.best, run.time);
    save.runs += 1;
    persist();
    sound.play(run.state === 'won' ? 'win' : 'lose', 0.8);
    screen = 'result';
    drawScreen();
  }
  function burst(preset: string, wx: number, wy: number, scale = 1) {
    if (effects.length > 10 || params.has('nofx')) return; // a budget: the field is busy enough
    // In this game the `level-up`, `confetti` and `explosion` presets leave the frame at 60–90 draws from then on, even
    // with no effect alive (3 without; docs/evidence/draws-*; HANDOFF.md open list, cause not found). `sparkle` and
    // `hit-spark` do not, so they stand in. ?fxfull=1 plays the presets asked for (the repro); ?fxpreset=<id> forces one.
    const LIGHT: Record<string, string> = { 'level-up': 'sparkle', confetti: 'sparkle', explosion: 'hit-spark' };
    const fx = new ZhudaEffect2D(fxLayer, params.get('fxpreset') ?? (params.has('fxfull') ? preset : LIGHT[preset] ?? preset), { x: 0, y: 0, scale: scale * 1.6, seed: (report.frames * 31) % 99991, lifeBands: Number(params.get('bands') ?? 4) });
    effects.push({ fx, left: Math.max(0.8, fx.preset.seconds ?? 1.2) + 0.3, wx, wy });
  }
  let gemSound = 0;
  function play(events: RunEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'fire':
          if (speed === 1) sound.play(e.weapon === 'blade' ? 'slash' : e.weapon === 'thunder' ? 'thunder' : 'shot', 0.25);
          break;
        case 'kill':
          if (e.boss) (burst('explosion', e.x, e.y, 3), sound.play('boom', 0.9), (shake = 1));
          break;
        case 'hurt':
          sound.play('hurt', 0.7);
          shake = Math.max(shake, 0.5);
          break;
        case 'pickup':
          if (run!.time - gemSound > 0.06) ((gemSound = run!.time), sound.play('gem', 0.2));
          break;
        case 'coin':
          sound.play('coin', 0.4);
          break;
        case 'levelup':
          sound.play('level', 0.7);
          burst('level-up', run!.player.x, run!.player.y, 1.6);
          if (auto) run!.choose(botChoose(run!));
          else ((screen = 'choose'), context.runtime.layers.setPaused('world', true), drawScreen());
          break;
        case 'boss':
          sound.play('boss', 0.9);
          banner('刑天來了');
          break;
        case 'elite':
          banner('饕餮出現');
          break;
        case 'evolve':
          banner('武器進化！');
          break;
        case 'won':
        case 'dead':
          finish();
          break;
      }
    }
  }
  function banner(message: string) {
    const t = text(hud, message, { x: 0, y: 150, w: VW, size: 60, bold: true, align: 'center', color: '#ff7a4a', stroke: '#000000' });
    tween(t, { alpha: 0 }, 2.2, (k) => k * k * k, () => t.destroy());
  }

  // ---- the field, redrawn every frame ----------------------------------------------------
  const cam = { x: 0, y: 0 };
  const g = field.graphics;
  const put = (name: string, x: number, y: number, size: number, alpha = 1) => {
    const t = tex[name];
    const h = (size * t.height) / t.width;
    g.drawTexture(t, x - cam.x - size / 2, y - cam.y - h / 2, size, h, undefined, alpha);
  };
  function drawField(r: Run) {
    const pl = r.player;
    cam.x = pl.x - VW / 2 + (shake ? (Math.sin(r.time * 90) * shake * 8) : 0);
    cam.y = pl.y - VH / 2 + (shake ? (Math.cos(r.time * 70) * shake * 8) : 0);
    g.clear();
    const T = 256, x0 = Math.floor(cam.x / T) * T, y0 = Math.floor(cam.y / T) * T;
    for (let x = x0; x < cam.x + VW; x += T) for (let y = y0; y < cam.y + VH; y += T) g.drawTexture(ground, x - cam.x, y - cam.y, T + 1, T + 1);
    const seen = (x: number, y: number, m: number) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;
    const vine = r.weapons.get('vine');
    if (vine) put('ring-vine', pl.x, pl.y, (96 + vine.level * 12) * r.area * 2, 0.7);
    for (const d of r.drops) if (seen(d.x, d.y, 30)) put(d.kind === 'gem' ? ['gem-s', 'gem-m', 'gem-l'][d.tier] : d.kind, d.x, d.y, d.kind === 'gem' ? [22, 28, 36][d.tier] : 30);
    for (const e of r.enemies) if (seen(e.x, e.y, 120)) put('shadow', e.x, e.y + e.def.radius * 0.8, e.def.radius * 2.2, 0.8);
    put('shadow', pl.x, pl.y + 30, 80);
    for (const e of r.enemies) {
      if (!seen(e.x, e.y, 120)) continue;
      put(e.def.id, e.x, e.y, e.def.radius * 2.3, e.flash > 0 && !params.has('noflash') ? 0.55 : 1);
      if (e.def.boss || e.def.id === 'taotie') {
        g.drawRect(e.x - cam.x - 50, e.y - cam.y - e.def.radius - 22, 100, 9, '#000000');
        g.drawRect(e.x - cam.x - 49, e.y - cam.y - e.def.radius - 21, 98 * Math.max(0, e.hp / e.maxHp), 7, '#e0503a');
      }
    }
    const fire = r.weapons.get('fire');
    if (fire) {
      const n = 1 + fire.level, radius = (92 + (fire.evolved ? 40 : 0)) * r.area;
      for (let i = 0; i < n; i++) put('fire', pl.x + Math.cos(r.orbit + (i / n) * Math.PI * 2) * radius, pl.y + Math.sin(r.orbit + (i / n) * Math.PI * 2) * radius, fire.evolved ? 76 : 58);
    }
    for (const s of r.shots) put('shot', s.x, s.y, s.boom ? 44 : 32);
    for (const z of r.zones) {
      const k = z.life / (z.kind === 'slash' ? 0.2 : 0.3);
      if (z.kind === 'slash') {
        // The arc texture opens upwards; turn it to the swing's direction about the player.
        const m = new Laya.Matrix();
        m.rotate(z.angle + Math.PI / 2);
        m.translate(z.x - cam.x, z.y - cam.y);
        const size = z.radius * 2.1;
        g.drawTexture(tex.slash, -size / 2, -size / 2, size, size, m, k);
        if (z.span > 6) {
          const m2 = new Laya.Matrix();
          m2.rotate(z.angle - Math.PI / 2);
          m2.translate(z.x - cam.x, z.y - cam.y);
          g.drawTexture(tex.slash, -size / 2, -size / 2, size, size, m2, k);
        }
      } else {
        put(z.kind === 'thunder' ? 'ring-thunder' : 'fire', z.x, z.y, z.radius * 2, k);
        if (z.kind === 'thunder') put('bolt', z.x, z.y - z.radius * 0.9, z.radius * 1.1, k);
      }
    }
    put('pig', pl.x, pl.y, 76, pl.grace > 0 && Math.floor(pl.grace * 20) % 2 ? 0.45 : 1);
    // Health under 豬大.
    g.drawRect(VW / 2 - 40, VH / 2 + 46, 80, 9, '#000000');
    g.drawRect(VW / 2 - 39, VH / 2 + 47, 78 * (pl.hp / pl.maxHp), 7, pl.hp / pl.maxHp > 0.35 ? '#5fd070' : '#e0503a');
  }
  const hudText = { time: null as Laya.Text | null, info: null as Laya.Text | null, kit: null as Laya.Text | null };
  const xp = { back: null as Laya.Sprite | null, fill: null as Laya.Sprite | null };
  function drawHud(r: Run) {
    if (!hudText.time || hudText.time.destroyed) {
      xp.back = rect(hud, 0, 0, 10, 16, '#0a0d14');
      xp.fill = rect(hud, 0, 2, 10, 12, '#58c8ff');
      hudText.time = text(hud, '', { x: 0, y: 24, w: 300, size: 44, bold: true, align: 'center', stroke: '#000000' });
      hudText.info = text(hud, '', { x: 20, y: 28, w: 500, size: 26, bold: true, stroke: '#000000' });
      hudText.kit = text(hud, '', { x: 20, y: 0, w: 900, size: 20, color: '#e8f0d8', stroke: '#000000' });
    }
    xp.back!.scaleX = VW / 10;
    xp.fill!.scaleX = (VW / 10) * Math.min(1, r.player.xp / r.player.next);
    const left = Math.max(0, RUN_SECONDS - r.time);
    hudText.time.x = VW / 2 - 150;
    hudText.time.text = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    hudText.info!.text = `Lv.${r.player.level}　擊倒 ${r.player.kills}　金幣 ${r.player.coins}`;
    hudText.kit!.y = VH - 34;
    hudText.kit!.text = [...r.weapons].map(([id, w]) => (w.evolved ? `★${WEAPONS[id].evolved}` : `${WEAPONS[id].name}${w.level}`)).join('・') + '　｜　' + [...r.passives].map(([id, l]) => `${PASSIVES[id].name}${l}`).join('・');
  }

  const profiler = new ZhudaRuntimeProfiler({ capacity: 120 });
  const renderEngine = (globalThis as any).Laya?.LayaGL?.renderEngine;
  const gl = renderEngine?.getDevice?.() ?? renderEngine?.gl ?? null;
  if (gl) typeof gl.createQuerySet === 'function' ? profiler.attachWebGPU(gl) : profiler.attach(gl);
  let frameOpen = false, acc = 0, idle: Run | undefined;

  context.runtime.start((dt) => {
    const layers = context.runtime.layers;
    const world = layers.sample('world').scaledDeltaTime, ui = layers.sample('ui').unscaledDeltaTime || dt;
    advanceTweens(ui);
    shake = Math.max(0, shake - ui * 3);
    if (run && (screen === 'play' || screen === 'choose')) {
      acc = Math.min(0.2 * speed, acc + world * speed);
      while (acc >= STEP && run.state === 'play' && screen === 'play') {
        acc -= STEP;
        play(run.step(auto ? bot(run) : steer()));
      }
      if (run) (drawField(run), drawHud(run));
      if (run) report.run = { time: Math.round(run.time * 10) / 10, state: run.state, hp: Math.round(run.player.hp), level: run.player.level, kills: run.player.kills, enemies: run.enemies.length, peak: run.peak, drops: run.drops.length, shots: run.shots.length,
        weapons: [...run.weapons].map(([k, w]) => `${k}${w.level}${w.evolved ? '*' : ''}`).join(' '), passives: [...run.passives].map(([k, l]) => `${k}${l}`).join(' ') };
    } else if (screen === 'title') {
      // Behind the title: a bot's run, as an attract mode.
      idle ??= new Run(7);
      if (idle.state === 'choose') idle.choose(botChoose(idle));
      else if (idle.state === 'play') for (let i = 0; i < 2; i++) idle.step(bot(idle));
      else idle = undefined;
      if (idle) drawField(idle);
      hud.destroyChildren();
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      if (!params.has('fxstill')) e.fx.setPosition(e.wx - cam.x, e.wy - cam.y);
      e.fx.update(ui);
      if (!params.has('fxnorender')) e.fx.render();
      if ((e.left -= ui) <= 0) (e.fx.dispose(), effects.splice(i, 1));
    }
    if (frameOpen) {
      const sample = profiler.endFrame(dt * 1000, dt * 1000);
      report.draws = sample.drawCalls;
      if (screen === 'play') report.maxDraws = Math.max(report.maxDraws, sample.drawCalls);
    }
    (report as any).fx = effects.length;
    (report as any).zones = run?.zones.map((z) => z.kind).join(',') ?? '';
    report.frames++;
    profiler.beginFrame();
    frameOpen = true;
  });
  layout();
  persist();
  if (auto) start();
  void pointers;
  report.ready = true;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  console.error(e);
});
