// 「灰燼之庭」 (games/ashfall-duel, author CCW) rebuilt from the library: the page of
// court-page.ts in place of the viewer's <main id="game">, then startAshfallDuel() — the
// same order of work as the original src/Main.ts. Everything the original game does works
// here: title demo, duel, keyboard, mouse charge, two-thumb touch, pause menu, sound
// settings, victory and defeat.
//
// ?view=<name> jumps to a moment by driving the duel's own rules (no extra drawing):
//   duel · impact · heavy · charge · evade · paused · sound · help · victory · defeat
// impact / heavy / charge / evade stop the duel at that moment (S.set({ freeze: false }) resumes).
//
// window.__SCENE__: state() (the page's meters and mode, as the original page shows them, and
// the duel's numbers), set({ view, freeze, simulate }), errors(), ready (after the engine's
// LayaAir splash has left and 10 frames ran), and `duel` (the AshfallDuel handle: game,
// picture, controls, audio, arena, simulate()).
import { setSceneHook, type ScenePreset, type SceneHook } from '../preset.ts';
import { mountCourtPage } from '../common/2d/ashfall-duel/court-page.ts';
import { startAshfallDuel, type AshfallDuel } from '../common/2d/ashfall-duel/ashfall-duel.ts';

const VIEWS = ['duel', 'impact', 'heavy', 'charge', 'evade', 'paused', 'sound', 'help', 'victory', 'defeat'] as const;

/** What the page itself shows (the same fields a DOM-only hook reads on the original game). */
export function pageState() {
  const $ = (id: string) => document.getElementById(id)!;
  const meter = (id: string) => Number($(id).getAttribute('aria-valuenow'));
  const result = $('result-line');
  return {
    mode: $('theatre').dataset.mode,
    hp: meter('hp'),
    stamina: meter('stamina'),
    foe: meter('foe-hp'),
    overlay: !$('overlay').hidden,
    title: $('dialog-title').textContent,
    result: result.hidden ? '' : result.textContent,
    strike: $('strike-button').dataset.held,
    hint: $('strike-button').querySelector('small')!.textContent,
    pad: $('stride-pad').dataset.direction,
  };
}

function applyView(duel: AshfallDuel, view: string) {
  const { game, controls } = duel;
  const until = (done: () => boolean, limit = 3) => {
    for (let t = 0; t < limit && !done(); t += 1 / 120) duel.simulate(1 / 120);
  };
  duel.frozen = false;
  if (view === 'help') return void controls.toggleMenu();
  controls.start();
  if (view === 'impact' || view === 'heavy') {
    game.press();
    if (view === 'heavy') duel.simulate(0.79);
    game.release();
    until(() => game.hits > 0);
    duel.simulate(view === 'heavy' ? 0.1 : 0.08); // hit-stop, then the plate at its deepest
    duel.frozen = true;
  } else if (view === 'charge') {
    game.press();
    duel.simulate(0.8);
    duel.frozen = true;
  } else if (view === 'evade') {
    game.evade();
    duel.simulate(0.13);
    duel.frozen = true;
  } else if (view === 'paused' || view === 'sound') {
    duel.simulate(0.6);
    controls.toggleMenu();
    if (view === 'sound') controls.openSound();
  } else if (view === 'victory') {
    for (let i = 0; i < 12 && game.mode === 'duel'; i++) {
      game.press();
      duel.simulate(i === 0 ? 0.75 : 0);
      game.release();
      duel.simulate(1);
    }
    duel.simulate(1);
  } else if (view === 'defeat') {
    until(() => game.mode === 'defeat', 40);
    duel.simulate(1);
  }
  duel.draw();
}

export const ashfallDuel: ScenePreset = {
  id: 'ashfall-duel',
  title: '灰燼之庭',
  summary:
    '寫實側視單人決鬥（原作者 CCW）：城門廢墟裡流浪騎士對城門守衛，關鍵姿勢圖集＋烘好的中間幀、劍刃沿畫出的刃分段判定、胸甲凹陷回彈、灰塵碎屑、鍵盤／滑鼠蓄力／雙拇指觸控、暫停選單與音效設定。和原遊戲逐像素相同。',
  modules: ['2d/ashfall-duel', '2d/cel-motion', 'input/hold-input', 'ui/game-menu', 'ui/settings-form', 'systems/storage', 'ui/dom'],
  views: {
    標題: '',
    開戰: 'view=duel',
    命中凹痕: 'view=impact',
    蓄力: 'view=charge',
    蓄力重擊: 'view=heavy',
    後撤閃避: 'view=evade',
    暫停選單: 'view=paused',
    音效設定: 'view=sound',
    操作說明: 'view=help',
    勝利: 'view=victory',
    落敗: 'view=defeat',
  },
  async start(container, params) {
    // The viewer's own base style colours #game; the original page has no such rule.
    const neutral = document.createElement('style');
    neutral.textContent = '#theatre>#game{background:none}';
    document.head.append(neutral);
    const host = await mountCourtPage({ replace: container });
    const pageErrors: string[] = [];
    window.addEventListener('error', (e) => pageErrors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => pageErrors.push(String(e.reason)));
    let frames = 0;
    const splashGone = () => !document.getElementById('zhudaLogoSplash');
    const hook: SceneHook = {
      ready: false,
      state: () => ({
        ...pageState(),
        time: duel.game.time,
        hits: duel.game.hits,
        knight: duel.game.view.knight.x,
        warden: duel.game.view.warden.x,
        wardAction: duel.game.wardAction,
        dent: duel.game.view.dent.displacement,
        bend: duel.game.view.blade.bend,
        frozen: duel.frozen,
        viewport: duel.viewport,
        frames,
      }),
      set(options: { view?: string; freeze?: boolean; simulate?: number }) {
        if (options.view) applyView(duel, options.view);
        if (options.simulate) duel.simulate(options.simulate);
        if (options.freeze !== undefined) duel.frozen = options.freeze;
      },
      errors: () => [...duel.context.renderer.errors.slice(0, 6), ...pageErrors.slice(0, 6)],
    };
    const duel = await startAshfallDuel(host, {
      onFrame() {
        if (++frames >= 10 && !hook.ready && splashGone()) hook.ready = true;
      },
    });
    hook.duel = duel;
    setSceneHook(hook);
    const view = params.get('view');
    if (view && (VIEWS as readonly string[]).includes(view)) applyView(duel, view);
  },
};
