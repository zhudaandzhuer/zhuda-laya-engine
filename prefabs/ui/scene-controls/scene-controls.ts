/**
 * The overlay of a live 3D scene (the floating islands'): a title at the top left; at the
 * top right a status line, weather buttons, the time (clock, slider, pause), and buttons for
 * an extra action, the picture setting and sound; a hint at the bottom; a hand that follows
 * the pointer while it holds something; a flash for lightning. `embed: true` keeps only the
 * picture and sound buttons and a short hint (a scene inside another page).
 *
 * Built by the component inside `container`: <div class="cp-sc"> … </div>. Every text comes
 * from the game, already translated. Link scene-controls.css before the game's own styles.
 */
import { make, press } from '../dom.ts';

export interface SceneControlsOptions {
  /** The title: a small line with a live dot, the name (with an italic part) and a line under it. */
  title: { kicker: string; name: string; em?: string; sub: string };
  /** Weather buttons in order: id and label; the id given first is shown chosen. */
  weathers: ReadonlyArray<{ id: string; label: string }>;
  weather: string;
  /** Starting hour (0..24) and how a clock shows an hour. */
  hour: number;
  clock: (hour: number) => string;
  /** Picture setting names, cheapest first, and which one is chosen. */
  levels: readonly string[];
  level: number;
  soundOn: boolean;
  hint: string;
  embed?: boolean;
  labels: {
    /** Before the clock, e.g. 時間. */
    time: string;
    /** The pause button's tooltip. */
    run: string;
    /** The extra action's button (null: no such button), e.g. 再丟一隻豬大. */
    drop: string | null;
    /** Before the picture setting's name, e.g. 畫質; and its tooltip. */
    quality: string;
    qualityTip: string;
    soundOn: string;
    soundOff: string;
  };
  onWeather(id: string): void;
  onHour(hour: number): void;
  onClockRuns(run: boolean): void;
  onLevel(level: number): void;
  onDrop?(): void;
  /** The sound button: toggles and returns whether sound is now on. */
  onSound(): boolean;
}

/** A status line in pieces: plain text, or { value } shown bold with even digits. */
export type StatusPart = string | { value: string };

export interface SceneControls {
  readonly root: HTMLElement;
  status(parts: readonly StatusPart[]): void;
  clock(hour: number): void;
  say(text: string): void;
  /** 0..1: how white the lightning flash is now. */
  flash(amount: number): void;
  /** A hand at the pointer while it holds something (null hides it). */
  hand(at: readonly [number, number] | null, closed: boolean): void;
  /** Shows the sound button's state (when the page turned sound on or off). */
  setSound(on: boolean): void;
}

export function createSceneControls(container: HTMLElement, options: SceneControlsOptions): SceneControls {
  const { labels } = options;
  const root = make('div', options.embed ? 'cp-sc cp-sc-embed' : 'cp-sc');
  const flashEl = make('div', 'cp-sc-flash');
  const handEl = make('div', 'cp-sc-hand', '✊');
  // title
  const title = make('div', 'cp-sc-title');
  const kicker = make('span', 'cp-sc-kicker');
  kicker.append(make('span', 'cp-sc-live'), document.createTextNode(options.title.kicker));
  const name = make('span', 'cp-sc-name', options.title.name);
  if (options.title.em) name.append(document.createTextNode(' '), make('span', 'cp-sc-em', options.title.em));
  title.append(kicker, name, make('span', 'cp-sc-sub', options.title.sub));
  // the panel: status, weather, time, buttons
  const panel = make('div', 'cp-sc-panel');
  const row = (extra = '') => make('div', 'cp-sc-row' + (extra ? ' ' + extra : ''));
  const statusEl = make('span', 'cp-sc-pill cp-sc-status', '…');
  const statusRow = row();
  statusRow.append(statusEl);
  const weatherRow = row('cp-sc-weathers');
  const buttons = new Map<string, HTMLElement>();
  const button = (className: string, text: string, onPress: () => void) => {
    const b = make('span', className, text);
    b.setAttribute('role', 'button');
    press(b, onPress);
    return b;
  };
  for (const w of options.weathers) {
    const b = button('cp-sc-pill cp-sc-btn' + (w.id === options.weather ? ' cp-sc-on' : ''), w.label, () => {
      for (const other of buttons.values()) other.classList.remove('cp-sc-on');
      b.classList.add('cp-sc-on');
      options.onWeather(w.id);
    });
    buttons.set(w.id, b);
    weatherRow.append(b);
  }
  const timeRow = row();
  const time = make('span', 'cp-sc-pill cp-sc-time');
  const clockEl = make('span', 'cp-sc-num', '--:--');
  const slider = make('input', 'cp-sc-slider');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '24';
  slider.step = '0.05';
  slider.value = String(options.hour);
  slider.addEventListener('input', () => options.onHour(Number(slider.value)));
  let running = true;
  const run = button('cp-sc-btn', '❚❚', () => {
    running = !running;
    run.textContent = running ? '❚❚' : '▶';
    options.onClockRuns(running);
  });
  run.setAttribute('title', labels.run);
  time.append(document.createTextNode(labels.time + ' '), clockEl, slider, run);
  timeRow.append(time);
  const actionRow = row();
  if (labels.drop !== null) actionRow.append(button('cp-sc-pill cp-sc-btn cp-sc-drop', labels.drop, () => options.onDrop?.()));
  let level = Math.max(0, Math.min(options.levels.length - 1, options.level));
  const fx = button('cp-sc-pill cp-sc-btn', `${labels.quality} ${options.levels[level]}`, () => {
    level = (level + 1) % options.levels.length;
    fx.textContent = `${labels.quality} ${options.levels[level]}`;
    options.onLevel(level);
  });
  fx.setAttribute('title', labels.qualityTip);
  const soundButton = button('cp-sc-pill cp-sc-btn', '', () => showSound(options.onSound()));
  const showSound = (on: boolean) => (soundButton.textContent = on ? labels.soundOn : labels.soundOff);
  showSound(options.soundOn);
  actionRow.append(fx, soundButton);
  panel.append(statusRow, weatherRow, timeRow, actionRow);
  const hint = make('div', 'cp-sc-hint', options.hint);
  root.append(flashEl, handEl, title, panel, hint);
  container.append(root);
  let hintTimer = 0;
  return {
    root,
    status(parts) {
      statusEl.innerHTML = '';
      for (const p of parts) statusEl.append(typeof p === 'string' ? document.createTextNode(p) : make('span', 'cp-sc-num', p.value));
    },
    clock(h) {
      clockEl.textContent = options.clock(h);
      if (document.activeElement !== slider) slider.value = String(((h % 24) + 24) % 24);
    },
    say(text) {
      hint.textContent = text;
      hint.style.opacity = '1';
      clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => (hint.style.opacity = '0.65'), 2600);
    },
    hand(at, closed) {
      if (!at) return void (handEl.style.display = 'none');
      handEl.style.display = 'block';
      handEl.textContent = closed ? '✊' : '🖐️';
      handEl.style.left = at[0] + 'px';
      handEl.style.top = at[1] + 'px';
    },
    flash(amount) {
      flashEl.style.opacity = String(Math.max(0, Math.min(0.85, amount)));
    },
    setSound(on) {
      showSound(on);
    },
  };
}
