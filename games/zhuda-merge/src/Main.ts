// 豬大食堂 — the merge board of src/core/board.ts on the engine's 2D stage: a 720 × 1280 design
// fitted to the screen, the board drawn from one atlas, drags by the stage's pointer events in
// design units, the engine's vector UI, its ready 2D effects and its one audio adapter.
//   index.html?fresh=1        a new kitchen       index.html?demo=1   level 5 with a busy board
import { ZhudaEffect2D, ZhudaEngine, ZhudaUI } from 'zhuda-laya-engine';
import * as B from './core/board.ts';
import { Sound } from './audio/sound.ts';
import { advanceTweens, button, designRoot, easeBack, hot, loadTexture, node, picture, preload, rect, refreshHot, text, tween } from './ui/kit.ts';

interface Report {
  ready: boolean;
  error?: string;
  screen: string;
  frames: number;
  hot: Record<string, [number, number]>;
  /** Client position of every board cell's centre, and of the bin. */
  cells: [number, number][];
  bin?: [number, number];
  state?: B.State;
  last?: string;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, screen: 'boot', frames: 0, hot, cells: [] });
const params = new URLSearchParams(location.search);
const W = 720, H = 1280, CELL = 96, BX = 24, BY = 384;
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

async function main() {
  let fit = () => {};
  const context = await ZhudaEngine.boot({ container: '#game', features: ['core', '2d', 'ui'], dprCap: 2, targetFPS: 60, onResize: () => (fit(), report.ready && mark()) }); // boot() calls onResize before it returns: nothing below exists yet
  Laya.stage.bgColor = '#2a1c14';
  const design = designRoot(W, H);
  fit = design.fit;
  const root = design.root;
  const sound = new Sound(storage?.getItem('zhuda-merge/muted') === '1');
  void sound.load();
  const atlas = (await loadTexture('assets/items.png'))!;
  const frames = (await (await fetch('assets/items.json')).json()).frames as Record<string, [number, number, number, number]>;
  const tex: Record<string, Laya.Texture> = {};
  for (const [name, [x, y, w, h]] of Object.entries(frames)) tex[name] = Laya.Texture.createFromTexture(atlas, x, y, w, h);
  await preload(['shen-yan', 'huo-qingtang', 'ye-shuang', 'lu-xinghe', 'bai-zhi', 'han-jin', 'yan-wusheng', 'xuan-heng', 'meng-yuanzhou', 'a-heng', 'lin-qingluo'].map((id) => `assets/heroes/${id}.png`));
  const SOURCE_FRAME: Record<B.Chain, string> = { veg: 'gen-0', tea: 'gen-1', bun: 'gen-2' };

  let clockSkew = 0;
  const now = () => Date.now() + clockSkew;
  let s: B.State = B.newState(now());
  if (!params.has('fresh') && !params.has('demo')) {
    try {
      const raw = storage?.getItem('zhuda-merge/save');
      const loaded = raw ? (JSON.parse(raw) as B.State) : null;
      if (loaded?.version === 1 && loaded.cells?.length === B.CELLS) s = loaded;
    } catch {
      /* a broken save starts over */
    }
  }
  if (params.has('demo')) {
    for (let i = 0; i < 2500 && s.level < 5; i++) {
      const m = B.botMove(s);
      if (m.do === 'wait') s.energy = 60;
      else B.apply(s, m);
    }
    s.energy = 77;
    for (let i = 0; i < 14; i++) B.tap(s, s.cells.findIndex((c) => c?.kind === 'source' && c.chain === (['veg', 'tea', 'bun'] as const)[i % 3]));
  }
  const persist = () => {
    report.state = s;
    if (params.has('demo')) return;
    try {
      storage?.setItem('zhuda-merge/save', JSON.stringify(s));
    } catch {
      /* private mode */
    }
  };

  // ---- layers ----------------------------------------------------------------------------
  const bg = node(root, 0, 0, 'bg');
  bg.graphics.drawRect(0, 0, W, H, '#3a2a1e');
  bg.graphics.drawRoundRect(BX - 10, BY - 10, B.COLS * CELL + 20, B.ROWS * CELL + 20, 18, 18, 18, 18, '#5a3f2a', '#8a6844', 4);
  for (let i = 0; i < B.CELLS; i++) {
    const x = BX + (i % B.COLS) * CELL, y = BY + Math.floor(i / B.COLS) * CELL;
    bg.graphics.drawRoundRect(x + 3, y + 3, CELL - 6, CELL - 6, 12, 12, 12, 12, (i + Math.floor(i / B.COLS)) % 2 ? '#e8d8b8' : '#f2e6cc');
  }
  const board = node(root, 0, 0, 'board');
  let ui = node(root, 0, 0, 'ui');
  const dragLayer = node(root, 0, 0, 'drag');
  const fxLayer = node(root, 0, 0, 'fx');
  const overlay = node(root, 0, 0, 'overlay');
  fxLayer.mouseEnabled = dragLayer.mouseEnabled = false;
  const effects: { fx: ZhudaEffect2D; left: number }[] = [];
  let fxSeed = 1;
  const burst = (preset: string, x: number, y: number, scale = 1) => {
    if (effects.length > 6) return;
    const fx = new ZhudaEffect2D(fxLayer, preset, { x, y, scale, seed: fxSeed++ * 7919, lifeBands: 4 });
    effects.push({ fx, left: Math.max(0.8, fx.preset.seconds ?? 1.2) + 0.3 });
  };
  const toast = (message: string, color = '#fff0c8') => {
    const t = text(overlay, message, { x: 0, y: 330, w: W, size: 30, color, align: 'center', bold: true, stroke: '#2a1c14' });
    tween(t, { y: 300, alpha: 0 }, 1.5, (k) => k * k, () => t.destroy());
  };
  const cellAt = (x: number, y: number) => {
    const cx = Math.floor((x - BX) / CELL), cy = Math.floor((y - BY) / CELL);
    return cx < 0 || cy < 0 || cx >= B.COLS || cy >= B.ROWS ? -1 : cy * B.COLS + cx;
  };
  const centre = (i: number): [number, number] => [BX + (i % B.COLS) * CELL + CELL / 2, BY + Math.floor(i / B.COLS) * CELL + CELL / 2];
  const frameOf = (c: NonNullable<B.Cell>) => (c.kind === 'source' ? SOURCE_FRAME[c.chain] : `${c.chain}-${c.tier}`);
  const BIN: [number, number, number, number] = [W - 150, 1166, 126, 100];

  /** Records where the cells and the bin are on the page, for a recorded run's real drags. */
  function mark() {
    const canvas = document.querySelector('canvas')!;
    const box = canvas.getBoundingClientRect();
    const kx = box.width / Laya.stage.width, ky = box.height / Laya.stage.height;
    const page = (x: number, y: number): [number, number] => {
      const p = root.localToGlobal(new Laya.Point(x, y));
      return [Math.round(box.left + p.x * kx), Math.round(box.top + p.y * ky)];
    };
    report.cells = Array.from({ length: B.CELLS }, (_, i) => page(...centre(i)));
    report.bin = page(BIN[0] + BIN[2] / 2, BIN[1] + BIN[3] / 2);
    refreshHot();
  }

  // ---- drawing ---------------------------------------------------------------------------
  let dragging: { from: number; sprite: Laya.Sprite; moved: boolean; x0: number; y0: number } | null = null;
  let pulse = 0;
  function drawBoard() {
    const g = board.graphics;
    g.clear();
    const wanted = new Set(s.orders.flatMap((o) => o.wants.map((w) => `${w.chain}-${w.tier}`)));
    s.cells.forEach((c, i) => {
      if (!c || dragging?.from === i) return;
      const [x, y] = centre(i);
      if (c.kind === 'source') {
        g.drawRoundRect(x - 44, y - 44, 88, 88, 14, 14, 14, 14, '#c8e6a8', '#5a8a3a', 3);
        const k = 1 + Math.sin(pulse * 3 + i) * 0.03;
        g.drawTexture(tex[frameOf(c)], x - 40 * k, y - 40 * k, 80 * k, 80 * k);
      } else {
        if (wanted.has(frameOf(c))) g.drawRoundRect(x - 44, y - 44, 88, 88, 14, 14, 14, 14, '#ffe9a0', '#e0a020', 3);
        g.drawTexture(tex[frameOf(c)], x - 38, y - 38, 76, 76);
      }
    });
  }
  function drawUi() {
    ui.destroy();
    ui = node(root, 0, 0, 'ui');
    root.setChildIndex(ui, 2);
    ZhudaUI.createGlassPanel(ui, { x: 0, y: 0, width: W, height: 108, radius: 0, fillColor: '#2a1c14', borderColor: '#8a6844', borderWidth: 2 });
    text(ui, '豬大食堂', { x: 20, y: 10, size: 32, bold: true, color: '#ffd978' });
    text(ui, s.done ? '名店' : `Lv.${s.level}`, { x: 190, y: 14, size: 26, bold: true, color: '#fff0c8' });
    rect(ui, 20, 62, 300, 22, '#1a100a', 11, '#8a6844');
    rect(ui, 22, 64, Math.max(4, 296 * Math.min(1, s.xp / B.xpFor(s.level))), 18, '#58c070', 9);
    text(ui, s.done ? '已滿級' : `${s.xp}/${B.xpFor(s.level)}`, { x: 20, y: 62, w: 300, size: 18, align: 'center' });
    const chip = (x: number, frame: string, value: string) => {
      rect(ui, x, 30, 170, 48, '#1a100a', 24, '#8a6844');
      const icon = node(ui, x + 6, 34);
      icon.graphics.drawTexture(tex[frame], 0, 0, 40, 40);
      text(ui, value, { x: x + 50, y: 40, w: 110, size: 26, bold: true, align: 'right' });
    };
    chip(350, 'ui-0', `${s.energy}/${B.MAX_ENERGY}`);
    chip(535, 'ui-1', String(s.coins));
    // Orders
    s.orders.forEach((o, i) => {
      const x = 16 + i * 232, cells = B.fillable(s, o);
      ZhudaUI.createGlassPanel(ui, { x, y: 122, width: 224, height: 240, radius: 16, fillColor: cells ? '#3a5a2a' : '#4a3626', borderColor: cells ? '#a0e070' : '#8a6844', borderWidth: 3 });
      picture(ui, `assets/heroes/${o.who}.png`, x + 12, 132, 84, 84);
      o.wants.forEach((w, k) => {
        const have = s.cells.some((c) => c?.kind === 'item' && c.chain === w.chain && c.tier === w.tier);
        const ix = x + 104 + k * 58;
        rect(ui, ix, 140, 54, 54, have ? '#f2e6cc' : '#6a5440', 10, have ? '#58c070' : '#8a6844');
        const icon = node(ui, ix + 4, 144);
        icon.graphics.drawTexture(tex[`${w.chain}-${w.tier}`], 0, 0, 46, 46);
      });
      text(ui, o.wants.map((w) => B.NAMES[w.chain][w.tier]).join('＋'), { x: x + 8, y: 224, w: 208, size: 20, align: 'center', color: '#fff0c8' });
      text(ui, `🪙${o.coins}　⭐${o.xp}`.replace('🪙', '金 ').replace('⭐', '經驗 '), { x: x + 8, y: 254, w: 208, size: 18, align: 'center', color: '#d8c8a0' });
      button(ui, x + 22, 290, 180, 58, cells ? '上　菜' : '等待中', cells ? 'gold' : 'off', () => serve(i), `serve-${i}`, !!cells, 26);
    });
    // Bottom bar
    const wait = Math.ceil(B.nextEnergyIn(s, now()));
    text(ui, s.energy >= B.MAX_ENERGY ? '體力已滿' : `下一點體力 ${wait} 秒`, { x: 24, y: 1166, w: 300, size: 20, color: '#d8c8a0' });
    const can = s.coins >= B.ENERGY_PRICE.coins && s.energy <= B.MAX_ENERGY - B.ENERGY_PRICE.energy;
    button(ui, 24, 1198, 250, 64, `體力 +${B.ENERGY_PRICE.energy}（${B.ENERGY_PRICE.coins} 金）`, can ? 'blue' : 'off', () => {
      if (!B.buyEnergy(s)) return (sound.play('no', 0.4), toast(s.coins < B.ENERGY_PRICE.coins ? '金幣不足' : '體力還很多', '#e0c8a8'));
      sound.play('coin', 0.5);
      redraw();
    }, 'buy', false, 20);
    button(ui, 290, 1198, 130, 64, '提示', 'dark', showHint, 'hint', false, 24);
    button(ui, 436, 1198, 110, 64, sound.muted ? '靜音' : '聲音', 'dark', () => {
      sound.setMuted(!sound.muted);
      storage?.setItem('zhuda-merge/muted', sound.muted ? '1' : '0');
      redraw();
    }, 'mute', false, 22);
    rect(ui, BIN[0], BIN[1], BIN[2], BIN[3], '#4a3626', 16, '#8a6844');
    const bin = node(ui, BIN[0] + 33, BIN[1] + 6);
    bin.graphics.drawTexture(tex['ui-3'], 0, 0, 60, 60);
    text(ui, '拖來賣掉', { x: BIN[0], y: BIN[1] + 70, w: BIN[2], size: 18, align: 'center', color: '#d8c8a0' });
  }
  function redraw() {
    drawBoard();
    drawUi();
    persist();
    mark();
  }

  // ---- actions ---------------------------------------------------------------------------
  function serve(i: number) {
    const r = B.serve(s, i);
    if (!r) return (sound.play('no', 0.4), toast('還缺東西：看訂單上的圖', '#e0c8a8'));
    report.last = `serve:${i}`;
    sound.play('coin', 0.6);
    burst('coin-burst', 16 + i * 232 + 112, 300, 1.3);
    toast(`金幣 +${r.coins}　經驗 +${r.xp}`);
    if (r.levelUp) {
      sound.play('level', 0.7);
      burst('confetti', W / 2, 360, 1.6);
      banner(s.done ? '食堂成了名店！' : `升到 Lv.${s.level}　體力 +40`);
      if (r.arrived) toast(`新的食材來源：${B.SOURCE_NAME[r.arrived]}`, '#b8ffb0');
    }
    redraw();
  }
  function banner(message: string) {
    const t = text(overlay, message, { x: 0, y: 600, w: W, size: 54, bold: true, align: 'center', color: '#ffe08a', stroke: '#2a1c14' });
    t.scaleX = t.scaleY = 0.6;
    t.pivot(W / 2, 30);
    t.pos(W / 2, 630);
    tween(t, { scaleX: 1, scaleY: 1 }, 0.35, easeBack, () => tween(t, { alpha: 0 }, 1.6, (k) => k * k * k, () => t.destroy()));
  }
  function showHint() {
    const pair = B.hint(s);
    if (!pair) return toast('沒有能合成的：點菜籃或水龍頭', '#e0c8a8');
    for (const i of pair) {
      const [x, y] = centre(i);
      const ring = node(overlay, x, y);
      ring.graphics.drawCircle(0, 0, 46, undefined, '#ff5a3c', 6);
      tween(ring, { alpha: 0 }, 1.4, (k) => k * k, () => ring.destroy());
    }
  }
  function tapSource(i: number) {
    const r = B.tap(s, i);
    if (!r.ok) {
      sound.play('no', 0.4);
      return toast(r.why === 'energy' ? '沒體力了：等一下，或用金幣買' : '盤面滿了：合成，或把東西拖去賣', '#e0c8a8');
    }
    report.last = `spawn:${r.at}`;
    sound.play('pop', 0.5);
    // The new ingredient hops out of the source.
    const [fx, fy] = centre(i), [tx, ty] = centre(r.at);
    const hop = node(overlay, fx, fy);
    hop.graphics.drawTexture(tex[frameOf(s.cells[r.at]!)], -38, -38, 76, 76);
    const hidden = r.at;
    dragging = { from: hidden, sprite: hop, moved: false, x0: 0, y0: 0 }; // hides the cell while the hop plays
    drawBoard();
    tween(hop, { x: tx, y: ty }, 0.16, undefined, () => {
      hop.destroy();
      if (dragging?.sprite === hop) dragging = null;
      redraw();
    });
    persist();
  }

  // ---- pointer: tap a source, drag anything ------------------------------------------------
  const local = () => root.globalToLocal(new Laya.Point(Laya.stage.mouseX, Laya.stage.mouseY));
  Laya.stage.on(Laya.Event.MOUSE_DOWN, null, () => {
    sound.start('pointer');
    if (dragging) return;
    const p = local(), i = cellAt(p.x, p.y);
    const c = i >= 0 ? s.cells[i] : null;
    if (!c) return;
    const sprite = node(dragLayer, p.x, p.y);
    sprite.graphics.drawTexture(tex[frameOf(c)], -46, -46, 92, 92);
    sprite.visible = false;
    dragging = { from: i, sprite, moved: false, x0: p.x, y0: p.y };
  });
  Laya.stage.on(Laya.Event.MOUSE_MOVE, null, () => {
    if (!dragging || dragging.x0 === 0) return;
    const p = local();
    if (!dragging.moved && Math.hypot(p.x - dragging.x0, p.y - dragging.y0) > 12) {
      dragging.moved = true;
      dragging.sprite.visible = true;
      drawBoard();
    }
    dragging.sprite.pos(p.x, p.y);
  });
  const release = (cancel: boolean) => {
    if (!dragging || dragging.x0 === 0) return;
    const d = dragging;
    dragging = null;
    d.sprite.destroy();
    const p = local(), to = cellAt(p.x, p.y), from = d.from, c = s.cells[from]!;
    if (cancel) return redraw();
    if (!d.moved) {
      if (c.kind === 'source') return tapSource(from);
      return redraw();
    }
    if (p.x >= BIN[0] && p.x <= BIN[0] + BIN[2] && p.y >= BIN[1] && p.y <= BIN[1] + BIN[3]) {
      const coins = B.sell(s, from);
      if (coins) (sound.play('coin', 0.4), toast(`賣掉了　金幣 +${coins}`), (report.last = `sell:${from}`));
      else (sound.play('no', 0.4), toast('食材來源不能賣', '#e0c8a8'));
      return redraw();
    }
    if (to < 0) return redraw();
    const r = B.drag(s, from, to);
    if (r.ok) {
      report.last = `${r.what}:${from}>${to}`;
      const [x, y] = centre(to);
      if (r.what === 'merge') {
        sound.play(r.tier! >= 4 ? 'big' : 'merge', 0.6);
        burst(r.tier! >= 4 ? 'level-up' : 'sparkle', x, y, r.tier! >= 4 ? 1.4 : 1.1);
        if (r.tier === B.TOP) toast(`${B.NAMES[(s.cells[to] as { chain: B.Chain }).chain][B.TOP]}！`, '#ffe08a');
      } else sound.play('drop', 0.5);
    }
    redraw();
  };
  Laya.stage.on(Laya.Event.MOUSE_UP, null, () => release(false));
  Laya.stage.on(Laya.Event.MOUSE_OUT, null, () => release(true));
  Laya.stage.on(Laya.Event.BLUR, null, () => release(true));

  let second = 0;
  context.runtime.start((dt) => {
    const t = context.runtime.layers.sample('ui').unscaledDeltaTime || dt;
    advanceTweens(t);
    pulse += t;
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.fx.update(t);
      e.fx.render();
      if ((e.left -= t) <= 0) (e.fx.dispose(), effects.splice(i, 1));
    }
    if (!dragging?.moved) drawBoard();
    if ((second += t) >= 1) {
      second = 0;
      const before = s.energy;
      B.tick(s, now());
      if (!dragging && (before !== s.energy || s.energy < B.MAX_ENERGY)) (drawUi(), mark());
    }
    report.frames++;
  });
  (window as any).__skip = (minutes: number) => {
    clockSkew += minutes * 60_000;
    B.tick(s, now());
    redraw();
  };
  report.screen = 'board';
  redraw();
  if (!s.served && !s.merges) toast('點菜籃拿食材，把兩個一樣的拖在一起', '#fff0c8');
  report.ready = true;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  console.error(e);
});
