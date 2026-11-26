// 豬大跳跳 — the platformer of src/core on the engine's 2D stage. The level is the engine's
// ZhudaTerrain2D drawn by ZhudaTerrain2DRenderer (only the chunks in view); 豬大, the walkers
// and coins are one sprite redrawn every frame; steps run at 60 Hz on the session's world layer.
//   index.html?level=1&auto=1&speed=2    the look-ahead bot plays (recorded runs)
import { ZhudaEffect2D, ZhudaEngine, ZhudaPointerInput, ZhudaTerrain2DRenderer } from 'zhuda-laya-engine';
import { Game, STEP, TILE, bot, type JumpEvent } from './core/game.ts';
import { LEVELS } from './core/levels.ts';
import { Sound } from './audio/sound.ts';
import { advanceTweens, button, hot, loadTexture, rect, refreshHot, text } from './ui/kit.ts';

interface Report {
  ready: boolean;
  error?: string;
  screen: string;
  frames: number;
  hot: Record<string, [number, number]>;
  game?: { level: string; state: string; time: number; x: number; y: number; grounded: boolean; coins: number; of: number; chunks: number };
  best?: Record<string, number>;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, screen: 'boot', frames: 0, hot });
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
  Laya.stage.bgColor = '#8fc7e8';
  const sound = new Sound(storage?.getItem('zhuda-jump/muted') === '1');
  void sound.load();
  const tex = { pig: (await loadTexture('assets/pig.png'))!, walker: (await loadTexture('assets/walker.png'))!, coin: (await loadTexture('assets/coin.png'))! };
  const best: Record<string, number> = JSON.parse((!params.has('fresh') && storage?.getItem('zhuda-jump/best')) || '{}');

  // The world (terrain, then things) is scaled so that ten tiles fill the screen's height; the HUD is in 720-high units.
  const world = new Laya.Sprite();
  const things = new Laya.Sprite();
  const fxLayer = new Laya.Sprite();
  const hud = new Laya.Sprite();
  const overlay = new Laya.Sprite();
  for (const s of [world, hud, overlay]) Laya.stage.addChild(s);
  let VW = 1280, K = 1, WK = 1;
  let game: Game | undefined;
  let renderer: ZhudaTerrain2DRenderer | undefined;
  let screen: 'title' | 'play' | 'result' = 'title';
  let levelIndex = 0;
  const auto = params.has('auto');
  const speed = Math.max(1, Number(params.get('speed') ?? 1));
  const keys = new Set<string>();
  const touch = { left: false, right: false, jump: false };
  const effects: { fx: ZhudaEffect2D; left: number }[] = [];
  let camX = 0;

  layout = () => {
    K = Laya.stage.height / 720;
    VW = Laya.stage.width / K;
    WK = Laya.stage.height / (10 * TILE);
    world.scale(WK, WK);
    for (const s of [hud, overlay]) s.scale(K, K);
    draw();
  };

  function start(index: number) {
    levelIndex = index;
    renderer?.dispose();
    world.destroyChildren();
    game = new Game(LEVELS[index]);
    renderer = new ZhudaTerrain2DRenderer(game.terrain, { parent: world, chunkCells: 16 });
    world.addChild(things);
    world.addChild(fxLayer);
    camX = 0;
    screen = 'play';
    sound.play('tap', 0.5);
    draw();
  }
  function draw() {
    overlay.destroyChildren();
    hud.destroyChildren();
    report.screen = screen;
    if (screen === 'title') {
      const veil = rect(overlay, 0, 0, VW, 720, '#12324a');
      veil.alpha = 0.78;
      text(overlay, '豬大跳跳', { x: 0, y: 70, w: VW, size: 96, bold: true, align: 'center', color: '#ffe08a', stroke: '#3a2300' });
      text(overlay, '← → 或 A D 移動，空白鍵跳；按久一點跳得高。踩在猙的頭上。', { x: 0, y: 196, w: VW, size: 24, align: 'center', color: '#d8ecff' });
      LEVELS.forEach((l, i) => {
        const open = i === 0 || best[LEVELS[i - 1].id] !== undefined, stars = best[l.id];
        button(overlay, VW / 2 - 480 + i * 330, 290, 300, 150, `${l.name}\n${stars !== undefined ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : open ? '未通過' : '未開放'}`, open ? 'gold' : 'off', () => open && start(i), `level-${i}`, false, 30);
      });
      button(overlay, VW - 170, 20, 150, 50, sound.muted ? '聲音：關' : '聲音：開', 'dark', () => {
        sound.setMuted(!sound.muted);
        storage?.setItem('zhuda-jump/muted', sound.muted ? '1' : '0');
        draw();
      }, 'mute', false, 20);
    } else if (screen === 'result' && game) {
      const won = game.state === 'won';
      const veil = rect(overlay, 0, 0, VW, 720, '#000000');
      veil.alpha = 0.6;
      text(overlay, won ? '過關！' : '哎呀', { x: 0, y: 130, w: VW, size: 90, bold: true, align: 'center', color: won ? '#ffe08a' : '#ff9a8a', stroke: '#000000' });
      text(overlay, won ? `${'★'.repeat(game.stars())}${'☆'.repeat(3 - game.stars())}　${game.time.toFixed(1)} 秒　金幣 ${game.taken}/${game.coins.length}` : `${game.level.name}　走了 ${Math.floor((game.player.x / game.width) * 100)}%`, { x: 0, y: 270, w: VW, size: 36, align: 'center' });
      button(overlay, VW / 2 - 330, 400, 300, 84, '再一次', 'blue', () => start(levelIndex), 'again', false, 32);
      button(overlay, VW / 2 + 30, 400, 300, 84, won && levelIndex + 1 < LEVELS.length ? '下一關' : '回選單', 'gold', () => (won && levelIndex + 1 < LEVELS.length ? start(levelIndex + 1) : ((screen = 'title'), draw())), 'next', false, 32);
    } else if (screen === 'play') {
      // Touch zones, drawn faintly: left, right, jump.
      for (const [x, label] of [[20, '◀'], [170, '▶']] as const) {
        const b = rect(hud, x, 570, 130, 130, '#000000', 24, '#ffffff');
        b.alpha = 0.28;
        text(hud, label, { x, y: 606, w: 130, size: 50, align: 'center' });
      }
      const j = rect(hud, VW - 190, 550, 170, 150, '#000000', 30, '#ffffff');
      j.alpha = 0.28;
      text(hud, '跳', { x: VW - 190, y: 596, w: 170, size: 54, align: 'center', bold: true });
    }
    refreshHot();
  }
  let info: Laya.Text | null = null;

  // ---- input -----------------------------------------------------------------------------
  const JUMP_KEYS = ['Space', 'KeyW', 'ArrowUp', 'KeyJ'];
  window.addEventListener('keydown', (e) => {
    sound.start('key');
    if (!e.repeat && JUMP_KEYS.includes(e.code) && game && screen === 'play') (game.input.push('jump', game.time), e.preventDefault());
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => (keys.clear(), game?.input.clear(), (touch.left = touch.right = touch.jump = false)));
  window.addEventListener('pointerdown', () => sound.start('pointer'), { capture: true });
  const container = document.querySelector<HTMLElement>('#game')!;
  const zone = (x: number, y: number) => {
    const ux = x / K, uy = y / K;
    if (uy > 540 && ux < 160) return 'left';
    if (uy > 540 && ux < 320) return 'right';
    return ux > VW * 0.55 ? 'jump' : null;
  };
  const pointers = new ZhudaPointerInput(container, (e) => (screen === 'play' ? zone(e.clientX, e.clientY) : null), (state) => {
    const roles = new Set([...state.values()].map((s) => s.role));
    if (roles.has('jump') && !touch.jump && game) game.input.push('jump', game.time);
    touch.left = roles.has('left');
    touch.right = roles.has('right');
    touch.jump = roles.has('jump');
  });

  function play(events: JumpEvent[]) {
    const g = game!;
    for (const e of events) {
      if (e.type === 'jump') sound.play('slash', 0.35);
      if (e.type === 'coin') (sound.play('coin', 0.5), burst('sparkle', g.player.x, g.player.y - 0.6));
      if (e.type === 'stomp') (sound.play('boom', 0.5), burst('hit-spark', g.player.x, g.player.y));
      if (e.type === 'land') burst('landing-dust', g.player.x, g.player.y, 0.7);
      if (e.type === 'hurt' || e.type === 'fall') (sound.play('lose', 0.7), finish());
      if (e.type === 'flag') (sound.play('win', 0.8), finish());
    }
  }
  function finish() {
    const g = game!;
    if (g.state === 'won') {
      best[g.level.id] = Math.max(best[g.level.id] ?? 0, g.stars());
      try {
        storage?.setItem('zhuda-jump/best', JSON.stringify(best));
      } catch {
        /* private mode */
      }
    }
    report.best = best;
    screen = 'result';
    draw();
  }
  function burst(preset: string, tx: number, ty: number, scale = 1) {
    if (effects.length > 5) return;
    const fx = new ZhudaEffect2D(fxLayer, preset, { x: tx * TILE, y: ty * TILE, scale: scale * 1.4, seed: report.frames, lifeBands: 4 });
    effects.push({ fx, left: Math.max(0.6, fx.preset.seconds ?? 1) + 0.3 });
  }

  let acc = 0;
  context.runtime.start((dt) => {
    const layers = context.runtime.layers;
    const worldDt = layers.sample('world').scaledDeltaTime, ui = layers.sample('ui').unscaledDeltaTime || dt;
    advanceTweens(ui);
    const g = game;
    if (g && renderer) {
      if (screen === 'play') {
        acc = Math.min(0.2 * speed, acc + worldDt * speed);
        while (acc >= STEP && g.state === 'play') {
          acc -= STEP;
          if (auto) {
            const a = bot(g);
            if (a.jump) g.input.push('jump', g.time);
            play(g.step(a.move, a.held));
          } else {
            const move = (keys.has('KeyD') || keys.has('ArrowRight') || touch.right ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') || touch.left ? 1 : 0);
            play(g.step(move, touch.jump || JUMP_KEYS.some((k) => keys.has(k))));
          }
        }
      }
      // The camera keeps 豬大 a third of the way across, inside the level.
      const viewW = Laya.stage.width / WK, levelW = g.width * TILE;
      camX += (Math.max(0, Math.min(levelW - viewW, g.player.x * TILE - viewW * 0.36)) - camX) * Math.min(1, ui * 8);
      world.pos(-camX * WK, 0);
      renderer.setView({ x: camX, y: 0, width: viewW, height: g.height * TILE });
      renderer.flush();
      const d = things.graphics;
      d.clear();
      // The terrain renderer draws a tile as a square of its palette colour (sky, for spikes): the points and
      // the turf on top of earth are drawn here, for the columns in view.
      for (let col = Math.max(0, Math.floor(camX / TILE)); col <= Math.min(g.width - 1, Math.floor((camX + viewW) / TILE)); col++)
        for (let row = 0; row < g.height; row++) {
          const id = g.terrain.getTile('ground', col, row), x = col * TILE, y = row * TILE;
          if (id === 3) for (let k = 0; k < 3; k++) d.drawPoly(x + k * 16, y + TILE, [0, 0, 8, -30, 16, 0], '#e8ecf2', '#7a8090', 1);
          else if (id === 1 && (row === 0 || g.terrain.getTile('ground', col, row - 1) !== 1)) d.drawRect(x, y, TILE, 9, '#6aa84a');
        }
      const fx0 = g.flag.x * TILE, fy0 = g.flag.y * TILE;
      d.drawRect(fx0 - 3, fy0 - 130, 6, 130, '#5a3a1e');
      d.drawPoly(fx0 + 3, fy0 - 130, [0, 0, 56, 18, 0, 36], '#e0503a');
      for (const c of g.coins) if (!c.taken) d.drawTexture(tex.coin, c.x * TILE - 15, c.y * TILE - 15 + Math.sin(g.time * 4 + c.x) * 3, 30, 30);
      for (const w of g.walkers) if (w.alive) d.drawTexture(tex.walker, w.x * TILE - 22, w.y * TILE - 44, 44, 44);
      const p = g.player, squash = p.grounded ? 1 : 1.08;
      if (g.state !== 'dead' || Math.floor(g.time * 12) % 2) {
        const m = new Laya.Matrix(p.face, 0, 0, 1, p.x * TILE, p.y * TILE);
        d.drawTexture(tex.pig, -24 / squash, -46 * squash, 48 / squash, 46 * squash, m);
      }
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        e.fx.update(ui);
        e.fx.render();
        if ((e.left -= ui) <= 0) (e.fx.dispose(), effects.splice(i, 1));
      }
      if (screen === 'play') {
        if (!info || info.destroyed) info = text(hud, '', { x: 20, y: 16, w: 900, size: 30, bold: true, stroke: '#12324a' });
        info.text = `${g.level.name}　金幣 ${g.taken}/${g.coins.length}　${g.time.toFixed(1)} 秒`;
      }
      report.game = { level: g.level.id, state: g.state, time: Math.round(g.time * 10) / 10, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, grounded: p.grounded, coins: g.taken, of: g.coins.length, chunks: renderer.residentChunks };
    }
    report.frames++;
  });
  layout();
  report.best = best;
  const direct = params.get('level');
  if (direct !== null || auto) start(Math.max(0, Math.min(LEVELS.length - 1, Number(direct ?? 1) - 1)));
  void pointers;
  report.ready = true;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  console.error(e);
});
