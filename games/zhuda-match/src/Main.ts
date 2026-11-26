// 豬大果園 — the match-three board of src/core/board.ts on the engine's 2D stage: a 720 × 1280
// design fitted to the screen, every fruit drawn from one atlas on one sprite, a move played back
// round by round (swap, burst, fall) from what the rules returned.
//   index.html?level=2&seed=7     a given board        index.html?auto=1   the best-move player plays
import { ZhudaEffect2D, ZhudaEngine } from 'zhuda-laya-engine';
import { Board, LEVELS, SIZE, bestMove, type Round } from './core/board.ts';
import { Sound } from './audio/sound.ts';
import { advanceTweens, button, designRoot, easeBack, hot, loadTexture, rect, refreshHot, text, tween } from './ui/kit.ts';

interface Report {
  ready: boolean;
  error?: string;
  screen: string;
  frames: number;
  hot: Record<string, [number, number]>;
  /** Client position of every board cell's centre. */
  cells: [number, number][];
  game?: { level: string; state: string; score: number; target: number; movesLeft: number; busy: boolean; moves: number; refused: number; chains: number; specials: number; shuffles: number; hint: [number, number] | null };
  best?: Record<string, number>;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, screen: 'boot', frames: 0, hot, cells: [] });
const params = new URLSearchParams(location.search);
const W = 720, H = 1280, CELL = 84, BX = 24, BY = 360;
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();
interface View { id: number; kind: number; special: string; x: number; y: number; scale: number; alpha: number }

async function main() {
  let fit = () => {};
  const context = await ZhudaEngine.boot({ container: '#game', features: ['core', '2d', 'ui'], dprCap: 2, targetFPS: 60, onResize: () => (fit(), report.ready && mark()) });
  Laya.stage.bgColor = '#1d2b1a';
  const design = designRoot(W, H);
  fit = design.fit;
  const root = design.root;
  const sound = new Sound(storage?.getItem('zhuda-match/muted') === '1');
  void sound.load();
  const atlas = (await loadTexture('assets/items.png'))!;
  const frames = (await (await fetch('assets/items.json')).json()).frames as Record<string, [number, number, number, number]>;
  const tex: Record<string, Laya.Texture> = {};
  for (const [name, [x, y, w, h]] of Object.entries(frames)) tex[name] = Laya.Texture.createFromTexture(atlas, x, y, w, h);
  const best: Record<string, number> = JSON.parse((!params.has('fresh') && storage?.getItem('zhuda-match/best')) || '{}');

  const back = new Laya.Sprite(), fruit = new Laya.Sprite(), fxLayer = new Laya.Sprite(), ui = new Laya.Sprite(), overlay = new Laya.Sprite();
  for (const s of [back, fruit, fxLayer, ui, overlay]) root.addChild(s);
  let screen: 'title' | 'play' | 'result' = 'title';
  let board: Board | undefined;
  let levelIndex = 0;
  let busy = false;
  let idle = 0;
  let selected = -1;
  const views = new Map<number, View>();
  const counts = { moves: 0, refused: 0, chains: 0, specials: 0 };
  const effects: { fx: ZhudaEffect2D; left: number }[] = [];
  const auto = params.has('auto');
  const cx = (i: number) => BX + (i % SIZE) * CELL + CELL / 2, cy = (i: number) => BY + Math.floor(i / SIZE) * CELL + CELL / 2;
  let scoreText: Laya.Text, movesText: Laya.Text, bar: Laya.Sprite, toast: Laya.Text;

  function mark() {
    refreshHot();
    const canvas = document.querySelector('canvas') as HTMLCanvasElement, box = canvas.getBoundingClientRect();
    report.cells = Array.from({ length: SIZE * SIZE }, (_, i) => {
      const p = root.localToGlobal(new Laya.Point(cx(i), cy(i)));
      return [Math.round(box.left + (p.x * box.width) / Laya.stage.width), Math.round(box.top + (p.y * box.height) / Laya.stage.height)] as [number, number];
    });
  }
  function start(index: number, seed = Number(params.get('seed') ?? 1 + Math.floor(Math.random() * 1e6))) {
    levelIndex = index;
    board = new Board(LEVELS[index], seed);
    views.clear();
    board.cells.forEach((c, i) => views.set(c.id, { id: c.id, kind: c.kind, special: c.special, x: cx(i), y: cy(i) - 700 - (SIZE - Math.floor(i / SIZE)) * 30, scale: 1, alpha: 1 }));
    busy = true;
    let left = views.size;
    board.cells.forEach((c, i) => tween(views.get(c.id)!, { y: cy(i) }, 0.45 + (i % SIZE) * 0.03, undefined, () => --left || (busy = false)));
    Object.assign(counts, { moves: 0, refused: 0, chains: 0, specials: 0 });
    selected = -1;
    screen = 'play';
    sound.play('tap', 0.5);
    draw();
  }
  function draw() {
    for (const s of [back, ui, overlay]) s.destroyChildren();
    report.screen = screen;
    rect(back, 0, 0, W, H, '#1d2b1a');
    if (screen === 'title') {
      text(overlay, '豬大果園', { x: 0, y: 150, w: W, size: 92, bold: true, align: 'center', color: '#ffe08a', stroke: '#3a2300' });
      text(overlay, '拖一顆水果和旁邊的交換，三顆連成一線就收成。\n四顆留下閃電，五顆留下星星。', { x: 60, y: 290, w: W - 120, size: 26, align: 'center', color: '#d4e8c8' });
      LEVELS.forEach((l, i) => {
        const open = i === 0 || best[LEVELS[i - 1].id] !== undefined, stars = best[l.id];
        button(overlay, 110, 440 + i * 150, 500, 120, `${l.name}　${l.moves} 步 ${l.target} 分\n${stars !== undefined ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : open ? '未通過' : '未開放'}`, open ? 'gold' : 'off', () => open && start(i), `level-${i}`, false, 30);
      });
      button(overlay, W - 190, 30, 160, 56, sound.muted ? '聲音：關' : '聲音：開', 'dark', () => {
        sound.setMuted(!sound.muted);
        storage?.setItem('zhuda-match/muted', sound.muted ? '1' : '0');
        draw();
      }, 'mute', false, 22);
    } else {
      const b = board!;
      rect(back, BX - 10, BY - 10, SIZE * CELL + 20, SIZE * CELL + 20, '#2f4428', 22, '#5d8048', 3);
      for (let i = 0; i < SIZE * SIZE; i++) if ((i + Math.floor(i / SIZE)) % 2) rect(back, cx(i) - CELL / 2, cy(i) - CELL / 2, CELL, CELL, '#38502f', 10);
      text(ui, b.level.name, { x: 30, y: 40, w: 400, size: 44, bold: true, color: '#ffe08a' });
      button(ui, W - 170, 36, 140, 56, '選單', 'dark', () => ((screen = 'title'), draw()), 'menu', false, 24);
      rect(ui, 30, 130, W - 60, 36, '#10180e', 18, '#5d8048');
      bar = rect(ui, 34, 134, W - 68, 28, '#e0a93a', 14);
      scoreText = text(ui, '', { x: 30, y: 184, w: 420, size: 34, bold: true });
      movesText = text(ui, '', { x: W - 330, y: 184, w: 300, size: 34, bold: true, align: 'right' });
      toast = text(ui, '', { x: 0, y: 264, w: W, size: 40, bold: true, align: 'center', color: '#ffe08a', stroke: '#3a2300' });
      toast.alpha = 0;
      hud();
      if (screen === 'result') {
        const won = b.state === 'won';
        const veil = rect(overlay, 0, 0, W, H, '#000000');
        veil.alpha = 0.66;
        veil.mouseEnabled = true;
        text(overlay, won ? '豐收！' : '步數用完了', { x: 0, y: 380, w: W, size: 84, bold: true, align: 'center', color: won ? '#ffe08a' : '#ff9a8a', stroke: '#000000' });
        text(overlay, won ? `${'★'.repeat(b.stars())}${'☆'.repeat(3 - b.stars())}\n${b.score} 分，剩 ${b.movesLeft} 步` : `${b.score} / ${b.level.target} 分`, { x: 0, y: 520, w: W, size: 40, align: 'center' });
        button(overlay, 70, 720, 270, 96, '再一次', 'blue', () => start(levelIndex), 'again', false, 34);
        const more = won && levelIndex + 1 < LEVELS.length;
        button(overlay, 380, 720, 270, 96, more ? '下一園' : '回選單', 'gold', () => (more ? start(levelIndex + 1) : ((screen = 'title'), draw())), 'next', false, 34);
      }
    }
    mark();
  }
  function hud() {
    const b = board!;
    scoreText.text = `${b.score} / ${b.level.target} 分`;
    movesText.text = `剩 ${b.movesLeft} 步`;
    bar.scaleX = Math.max(0.02, Math.min(1, b.score / b.level.target));
  }
  function say(words: string) {
    toast.text = words;
    toast.alpha = 1;
    toast.scale(1, 1);
    tween(toast, { alpha: 0 }, 1.1);
  }
  function burst(preset: string, x: number, y: number, scale = 1) {
    if (effects.length > 7) return;
    const fx = new ZhudaEffect2D(fxLayer, preset, { x, y, scale, seed: report.frames, lifeBands: 4 });
    effects.push({ fx, left: Math.max(0.6, fx.preset.seconds ?? 1) + 0.3 });
  }

  /** Plays a move: the swap, then each round the rules returned, then the end of the level if it came. */
  function tryMove(a: number, b: number) {
    const g = board!;
    if (busy || screen !== 'play' || g.state !== 'play' || !Board.adjacent(a, b)) return;
    const va = views.get(g.cells[a].id)!, vb = views.get(g.cells[b].id)!;
    busy = true;
    idle = 0;
    selected = -1;
    const rounds = g.move(a, b);
    tween(va, { x: cx(b), y: cy(b) }, 0.14);
    tween(vb, { x: cx(a), y: cy(a) }, 0.14, undefined, () => {
      if (!rounds) {
        counts.refused++;
        sound.play('no', 0.5);
        tween(va, { x: cx(a), y: cy(a) }, 0.14);
        tween(vb, { x: cx(b), y: cy(b) }, 0.14, undefined, () => (busy = false));
        return;
      }
      counts.moves++;
      hud();
      playRound(rounds, 0);
    });
  }
  function playRound(rounds: Round[], n: number) {
    const g = board!;
    if (n >= rounds.length) {
      // The rules may have shuffled a board with nothing to do: every fruit goes to where it now is.
      let moved = false;
      g.cells.forEach((c, i) => {
        const v = views.get(c.id);
        if (v && (Math.abs(v.x - cx(i)) > 1 || Math.abs(v.y - cy(i)) > 1)) ((moved = true), tween(v, { x: cx(i), y: cy(i) }, 0.4));
      });
      if (moved) say('重新洗牌');
      const done = () => {
        busy = false;
        if (g.state !== 'play') {
          if (g.state === 'won') {
            best[g.level.id] = Math.max(best[g.level.id] ?? 0, g.stars());
            try {
              storage?.setItem('zhuda-match/best', JSON.stringify(best));
            } catch {
              /* private mode */
            }
          }
          report.best = best;
          sound.play(g.state === 'won' ? 'level' : 'no', 0.8);
          screen = 'result';
          draw();
        }
      };
      if (moved) tween({ k: 0 }, { k: 1 }, 0.45, undefined, done);
      else done();
      return;
    }
    const round = rounds[n];
    if (n > 0) (counts.chains++, say(`連鎖 ×${n + 1}`));
    counts.specials += round.made.length;
    sound.play(round.burst.length > 5 ? 'big' : n > 0 ? 'merge' : 'pop', 0.6);
    const staying = new Set(round.after.map((c) => c.id));
    let shown = 0;
    for (const v of views.values())
      if (!staying.has(v.id)) {
        if (shown++ % 2 === 0) burst(round.burst.length > 8 ? 'hit-spark' : 'sparkle', v.x, v.y, 1.2);
        tween(v, { scale: 0, alpha: 0 }, 0.18, undefined, () => views.delete(v.id));
      }
    tween({ k: 0 }, { k: 1 }, 0.2, undefined, () => {
      hud();
      const fresh: number[] = new Array(SIZE).fill(0);
      for (let i = SIZE * SIZE - 1; i >= 0; i--) {
        const c = round.after[i];
        let v = views.get(c.id);
        if (!v) {
          const made = round.made.find((m) => c.special !== 'none' && c.special === m.special && !views.has(c.id));
          if (made && c.special !== 'none') v = { id: c.id, kind: c.kind, special: c.special, x: cx(made.at), y: cy(made.at), scale: 0.2, alpha: 1 };
          else v = { id: c.id, kind: c.kind, special: c.special, x: cx(i), y: BY - CELL / 2 - fresh[i % SIZE]++ * CELL, scale: 1, alpha: 1 };
          views.set(c.id, v);
          if (made) tween(v, { scale: 1 }, 0.25, easeBack);
        }
        tween(v, { x: cx(i), y: cy(i) }, 0.24);
      }
      tween({ k: 0 }, { k: 1 }, 0.3, undefined, () => playRound(rounds, n + 1));
    });
  }

  // ---- pointer: drag a fruit towards a neighbour, or tap one and then the neighbour --------------
  const local = () => root.globalToLocal(new Laya.Point(Laya.stage.mouseX, Laya.stage.mouseY));
  const cellAt = (p: Laya.Point) => {
    const x = Math.floor((p.x - BX) / CELL), y = Math.floor((p.y - BY) / CELL);
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? y * SIZE + x : -1;
  };
  let down: { cell: number; x: number; y: number } | null = null;
  Laya.stage.on(Laya.Event.MOUSE_DOWN, null, () => {
    sound.start('pointer');
    if (screen !== 'play' || busy) return;
    const p = local(), cell = cellAt(p);
    if (cell < 0) return void (selected = -1);
    if (selected >= 0 && Board.adjacent(selected, cell)) return tryMove(selected, cell);
    selected = cell;
    down = { cell, x: p.x, y: p.y };
  });
  Laya.stage.on(Laya.Event.MOUSE_MOVE, null, () => {
    if (!down) return;
    const p = local(), dx = p.x - down.x, dy = p.y - down.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.4) return;
    const x = down.cell % SIZE, y = Math.floor(down.cell / SIZE);
    const tx = x + (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0), ty = y + (Math.abs(dx) > Math.abs(dy) ? 0 : Math.sign(dy));
    const from = down.cell;
    down = null;
    if (tx >= 0 && ty >= 0 && tx < SIZE && ty < SIZE) tryMove(from, ty * SIZE + tx);
  });
  for (const e of [Laya.Event.MOUSE_UP, Laya.Event.MOUSE_OUT, Laya.Event.BLUR]) Laya.stage.on(e, null, () => (down = null));

  context.runtime.start((dt) => {
    const step = context.runtime.layers.sample('ui').unscaledDeltaTime || dt;
    advanceTweens(step);
    const g = board;
    const d = fruit.graphics;
    d.clear();
    if (g && screen !== 'title') {
      idle += busy ? 0 : step;
      if (auto && !busy && g.state === 'play' && idle > 0.25) {
        const m = bestMove(g);
        if (m) tryMove(m[0], m[1]);
      }
      const hint = !busy && idle > 4 && g.state === 'play' ? g.hint() : null;
      const pulse = 1 + Math.sin(report.frames * 0.2) * 0.07;
      if (selected >= 0 && !busy) d.drawRect(cx(selected) - CELL / 2 + 3, cy(selected) - CELL / 2 + 3, CELL - 6, CELL - 6, null, '#ffe08a', 4);
      for (const v of views.values()) {
        const at = hint && (g.cells[hint[0]].id === v.id || g.cells[hint[1]].id === v.id);
        const size = (CELL - 12) * v.scale * (at ? pulse : 1);
        const t = v.special === 'star' ? tex['fx-1'] : tex[`gem-${v.kind}`];
        d.drawTexture(t, v.x - size / 2, v.y - size / 2, size, size, undefined, v.alpha);
        if (v.special === 'bolt') d.drawTexture(tex['fx-0'], v.x - size * 0.1, v.y - size * 0.1, size * 0.62, size * 0.62, undefined, v.alpha);
      }
      report.game = { level: g.level.id, state: g.state, score: g.score, target: g.level.target, movesLeft: g.movesLeft, busy, ...counts, shuffles: g.shuffles, hint: busy ? null : g.hint() };
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.fx.update(step);
      e.fx.render();
      if ((e.left -= step) <= 0) (e.fx.dispose(), effects.splice(i, 1));
    }
    report.frames++;
  });
  fit();
  draw();
  report.best = best;
  const direct = params.get('level');
  if (direct !== null || auto) start(Math.max(0, Math.min(LEVELS.length - 1, Number(direct ?? 1) - 1)));
  report.ready = true;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  console.error(e);
});
