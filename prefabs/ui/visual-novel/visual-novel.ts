/**
 * Visual novel (galgame-style) story player: a background, up to two standing
 * sprites (left / right; the one talking is lit, the other dimmed), full-screen
 * event CGs, a name plate, a text box that types character by character with ▼,
 * voices, flash transitions, and Auto / Skip / Log controls.
 *
 * No game content lives here: the game passes the lines, speaker names, and
 * functions that turn keys into image URLs and play voices / sounds.
 *
 * Built by the component inside `host` (only cp-vn-* classes):
 *   <div class="cp-vn">
 *     <img class="cp-vn-bg"> <div class="cp-vn-sprite cp-vn-left"><img></div> <div class="cp-vn-sprite cp-vn-right"><img></div>
 *     <img class="cp-vn-cg"> <div class="cp-vn-flash">
 *     <div class="cp-vn-box"><div class="cp-vn-name"></div><div class="cp-vn-text"></div><div class="cp-vn-next">▼</div></div>
 *     <div class="cp-vn-controls"><button>Auto</button><button>Skip</button><button>Log</button></div>
 *     <div class="cp-vn-log"></div>
 *   </div>
 *
 * Input: a press on the stage (or Space / Enter while open) finishes the typing,
 * else goes to the next line. Controls do not advance.
 */
import { make, press } from '../dom.ts';

export interface VnLine {
  /** Also the voice id. */
  id: string;
  /** A key of `speakers`. */
  who: string;
  text: string;
  /** Change the background to this key. */
  bg?: string;
  /** Show this CG over everything; null hides it; absent keeps the current one. */
  cg?: string | null;
  /** Sprite expressions by speaker key; null clears both sprites; absent keeps them. */
  show?: Record<string, string> | null;
  sfx?: string;
  bgm?: string;
  /** A flash transition before the line: a key of `flashColors` (e.g. 'whiteout'). */
  fx?: string;
}

export interface VnSpeaker {
  /** Shown on the name plate (passed through `t`); '' hides the plate (narration). */
  name: string;
  /** Where this speaker's sprite stands. */
  slot?: 'left' | 'right';
  /** Name plate colour. */
  color?: string;
  /** Has recorded voices. */
  voiced?: boolean;
}

export interface VisualNovelOptions {
  host: HTMLElement;
  speakers: Record<string, VnSpeaker>;
  image: { bg(key: string): string; cg(key: string): string; sprite(who: string, expression: string): string };
  /** Translates line text, names and control labels (identity by default). */
  t?: (source: string) => string;
  labels?: { auto: string; skip: string; log: string; logTitle: string };
  /** Plays a line's voice; resolves when it ends. Return null when there is none. */
  voice?: (lineId: string) => Promise<void> | null;
  stopVoice?: () => void;
  sfx?: (id: string) => void;
  bgm?: (id: string) => void;
  /** Typing blip for unvoiced lines (every second character). */
  blip?: () => void;
  /** Characters per second (default 28). */
  cps?: number;
  /** Seconds Auto waits after a line (default 1.1). */
  autoDelay?: number;
  flashColors?: Record<string, string>;
}

export interface VisualNovel {
  readonly open: boolean;
  /** Plays the lines; resolves after the last one is dismissed. */
  play(lines: ReadonlyArray<VnLine>, start?: { bg?: string }): Promise<void>;
  /** Next line, or finish the typing (what a press does). */
  advance(): void;
  /** Re-reads translated labels and the current line (after a language change). */
  relabel(): void;
}

export function createVisualNovel(options: VisualNovelOptions): VisualNovel {
  const t = options.t ?? ((s: string) => s);
  const labels = options.labels ?? { auto: 'Auto', skip: 'Skip', log: 'Log', logTitle: 'Log' };
  const cps = options.cps ?? 28, autoDelay = (options.autoDelay ?? 1.1) * 1000;
  const flashColors = options.flashColors ?? { whiteout: '#ffffff', fade_light: '#ffd9a8' };

  const root = make('div', 'cp-vn');
  const bg = make('img', 'cp-vn-bg'), cg = make('img', 'cp-vn-cg'), flash = make('div', 'cp-vn-flash');
  const left = make('div', 'cp-vn-sprite cp-vn-left'), right = make('div', 'cp-vn-sprite cp-vn-right');
  const leftImg = make('img'), rightImg = make('img');
  left.append(leftImg); right.append(rightImg);
  const box = make('div', 'cp-vn-box'), name = make('div', 'cp-vn-name'), text = make('div', 'cp-vn-text'), next = make('div', 'cp-vn-next', '▼');
  box.append(name, text, next);
  const controls = make('div', 'cp-vn-controls');
  const bAuto = make('button', 'cp-vn-auto'), bSkip = make('button', 'cp-vn-skip'), bLog = make('button', 'cp-vn-logbtn');
  for (const b of [bAuto, bSkip, bLog]) { b.type = 'button'; controls.append(b); }
  const log = make('div', 'cp-vn-log');
  for (const el of [bg, cg, flash]) el.setAttribute('alt', '');
  root.append(bg, left, right, cg, flash, box, controls, log);
  options.host.append(root);
  root.hidden = true;

  let lines: ReadonlyArray<VnLine> = [], i = -1, typing = false, busy = false, auto = false, skip = false, logOpen = false;
  let timer: ReturnType<typeof setTimeout> | undefined, full = '', onTyped: () => void = () => {}, finish: (() => void) | null = null;
  let bgKey = '', exp: Record<string, string | null> = {};
  const history: VnLine[] = [];
  const slotOf = (who: string) => options.speakers[who]?.slot;

  const setLabels = () => {
    bAuto.textContent = t(labels.auto); bSkip.textContent = t(labels.skip); bLog.textContent = t(labels.log);
    bAuto.classList.toggle('on', auto); bSkip.classList.toggle('on', skip);
  };
  const setBg = (key?: string) => { if (key && key !== bgKey) { bgKey = key; bg.src = options.image.bg(key); } };
  const applyShow = (show: VnLine['show']) => {
    if (show === null) exp = {};
    else if (show) Object.assign(exp, show);
    for (const [slot, el, img] of [['left', left, leftImg], ['right', right, rightImg]] as const) {
      const who = Object.keys(exp).find((k) => exp[k] && slotOf(k) === slot);
      el.classList.toggle('cp-vn-off', !who);
      if (who) { img.src = options.image.sprite(who, exp[who]!); el.dataset.who = who; } else delete el.dataset.who;
    }
  };
  const highlight = (who: string) => {
    for (const el of [left, right]) { const on = el.dataset.who === who; el.classList.toggle('cp-vn-dim', !on); el.classList.toggle('cp-vn-talk', on); }
  };
  const stopTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const type = (source: string, blip: boolean, done: () => void) => {
    const chars = [...source];
    let k = 0;
    typing = true; full = source; onTyped = done; text.textContent = ''; next.style.visibility = 'hidden';
    const tick = () => {
      if (!typing) return;
      k = skip ? chars.length : k + 1;
      text.textContent = chars.slice(0, k).join('');
      if (blip && k % 2 === 0) options.blip?.();
      if (k >= chars.length) { typing = false; done(); } else timer = setTimeout(tick, 1000 / cps);
    };
    tick();
  };
  const showLine = (n: number) => {
    stopTimer(); options.stopVoice?.(); i = n;
    const L = lines[n];
    const run = () => {
      setBg(L.bg);
      if ('cg' in L) { if (L.cg) { cg.src = options.image.cg(L.cg); cg.classList.add('cp-vn-on'); } else cg.classList.remove('cp-vn-on'); }
      if ('show' in L) applyShow(L.show);
      if (L.bgm) options.bgm?.(L.bgm);
      if (L.sfx) options.sfx?.(L.sfx);
      highlight(L.who);
      const sp = options.speakers[L.who] ?? { name: '' };
      name.textContent = sp.name ? t(sp.name) : '';
      name.hidden = !sp.name;
      name.style.background = sp.color ?? '';
      text.classList.toggle('cp-vn-narration', !sp.name);
      history.push(L);
      const v = sp.voiced && !skip ? options.voice?.(L.id) ?? null : null;
      type(t(L.text), !v, () => {
        next.style.visibility = 'visible';
        if (skip) timer = setTimeout(advance, 150);
        else if (auto) void (v ?? Promise.resolve()).then(() => { if (auto && i === n && !typing && !busy) timer = setTimeout(advance, autoDelay); });
      });
    };
    const color = L.fx ? flashColors[L.fx] : undefined;
    if (color) {
      flash.style.background = color; flash.classList.add('cp-vn-on'); busy = true;
      timer = setTimeout(() => { busy = false; run(); flash.classList.remove('cp-vn-on'); }, 750);
    } else run();
  };
  function advance() {
    if (busy || logOpen || root.hidden) return;
    if (typing) { stopTimer(); typing = false; text.textContent = full; onTyped(); return; }
    options.sfx?.('ui_click');
    if (i + 1 < lines.length) showLine(i + 1);
    else { root.hidden = true; options.stopVoice?.(); const f = finish; finish = null; f?.(); }
  }
  const closeLog = () => { logOpen = false; log.classList.remove('cp-vn-on'); };
  root.addEventListener('pointerdown', () => advance());
  press(bAuto, () => { auto = !auto; setLabels(); if (auto && !typing) advance(); });
  press(bSkip, () => { skip = !skip; setLabels(); if (skip && !typing) advance(); });
  press(bLog, () => {
    if (logOpen) return closeLog();
    logOpen = true; log.classList.add('cp-vn-on'); log.innerHTML = '';
    log.append(make('div', 'cp-vn-log-title', t(labels.logTitle)));
    for (const L of history) {
      const row = make('div', 'cp-vn-log-line'), sp = options.speakers[L.who];
      if (sp?.name) row.append(make('b', '', t(sp.name)));
      row.append(make('span', '', t(L.text)));
      if (sp?.voiced) press(row, () => void options.voice?.(L.id));
      log.append(row);
    }
  });
  // a press on the log (outside a voiced line) closes it without advancing
  log.addEventListener('pointerdown', (event: Event) => { event.stopPropagation(); closeLog(); });
  controls.addEventListener('pointerdown', (event: Event) => event.stopPropagation());
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (root.hidden) return;
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); advance(); }
    if (event.key === 'Escape' && logOpen) closeLog();
  });
  setLabels();

  return {
    get open() { return !root.hidden; },
    play(next, start) {
      lines = next; i = -1; exp = {}; bgKey = ''; history.length = 0; applyShow(null); cg.classList.remove('cp-vn-on'); closeLog();
      setBg(start?.bg);
      root.hidden = false;
      return new Promise<void>((resolve) => { finish = resolve; if (lines.length) showLine(0); else advance(); });
    },
    advance,
    relabel() {
      setLabels();
      const L = lines[i];
      if (L && !root.hidden) { const sp = options.speakers[L.who]; name.textContent = sp?.name ? t(sp.name) : ''; full = t(L.text); if (!typing) text.textContent = full; }
    },
  };
}
