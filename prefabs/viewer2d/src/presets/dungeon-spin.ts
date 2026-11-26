// 迷宮一閃 (Dungeon Spin) from the library, as the original game booted it: 572×1024
// portrait, show-all, the three checked prefabs from one provider, then the scene.
// The thin layer a game writes is everything in start() up to setSceneHook.
//
// Addresses (all optional):
//   ?fixture=three|empty|multi|five|four|full|group|word|boss|allzero   which fixed round the button plays (the game itself always plays multi)
//   ?bet=10|20|50   ?burst=1   ?open=menu|receipt|rules|auto   ?play=1 (one round)   ?auto=<rounds>
//   ?save=memory    a fresh ledger every visit (default: localStorage, like the game)
//   (?width=&height=, which tools/play.mjs adds, are ignored: the design is always 572×1024 show-all)
//
// window.__SCENE__: ready, state(), set({ fixture, bet, burst, open, close, play, auto, stop, sound, reset }),
// errors(), game (the DungeonSpin: runtime, session, views, panels, dialogs, as in the original's
// window.__DUNGEON_GAME__), provenance() (the three prefab instances).
import { ZhudaEngine, ZhudaPrefabLibrary } from 'zhuda-laya-engine';
import { setSceneHook, type ScenePreset } from '../preset.ts';
import { DungeonSpin, DESIGN, BETS } from '../common/2d/dungeon-spin/dungeon-spin.ts';
import { createAssetProvider, definitions } from '../common/2d/dungeon-spin/prefabs.ts';
import { FIXTURE_TRUTHS } from '../common/2d/dungeon-spin/math.ts';

type Dialog = 'menu' | 'receipt' | 'rules' | 'auto';
const ERROR_EVENTS = ['observer.error', 'presentation.control-error', 'round.presentation-error', 'round.rejected', 'preferences.error'];

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, String(v)) };
}

function dialogs(game: DungeonSpin): Record<Dialog, { container: any }> {
  return { menu: game.menuDialog, receipt: game.receiptDialog, rules: game.rulesDialog, auto: game.autoDialog };
}

function snapshot(game: DungeonSpin, ready: boolean) {
  const rt = game.runtime.state;
  const last = rt.last;
  return {
    ready,
    points: game.session.points,
    sequence: game.session.state?.sequence ?? 0,
    phase: rt.phase,
    primary: rt.primary,
    selection: { ...rt.selection },
    auto: { running: rt.auto.running, remaining: rt.auto.remaining, completed: rt.auto.completed, reason: rt.auto.reason },
    last: last ? { fixture: last.fixture, singleBet: last.singleBet, bet: last.bet, win: last.win, mainWin: last.mainWin, bonusWin: last.bonusWin, presented: last.presented } : null,
    open: (Object.entries(dialogs(game)) as [Dialog, { container: any }][]).filter(([, d]) => d.container.visible).map(([name]) => name),
    title: game.headerPanel.seqLabel.text,
    balance: game.headerPanel.balanceLabel.text,
    totalBet: game.controlBar.totalBetLabel.text,
    button: game.controlBar.advanceBtnLabel.text,
    dialogue: game.heroView.dialogueLabel.text,
    pose: game.heroView.currentPose,
    monsters: game.monsterField.encounterLayer.numChildren,
    boss: game.bossView.container.visible,
    win: game.winView.container.visible ? `${game.winView.tierLabel.text} ${game.winView.amountLabel.text}` : null,
  };
}

function apply(game: DungeonSpin, o: Record<string, unknown>) {
  if (typeof o.fixture === 'string') {
    if (!FIXTURE_TRUTHS[o.fixture]) throw Error(`unknown fixture ${o.fixture}; one of ${Object.keys(FIXTURE_TRUTHS).join(', ')}`);
    game.runtime.configure({ fixture: o.fixture });
  }
  if (o.bet !== undefined) {
    const bet = Number(o.bet);
    if (!(BETS as readonly number[]).includes(bet)) throw Error(`bet is one of ${BETS.join(', ')}`);
    // the − / + buttons, as a player would press them
    while (game.controlBar.currentSingleBet !== bet) game.controlBar.stepBet(bet > game.controlBar.currentSingleBet ? 1 : -1);
  }
  if (o.burst !== undefined && Boolean(o.burst) !== game.controlBar.isBurst) game.controlBar.skipBtn.event('click');
  if (o.sound !== undefined && Boolean(o.sound) !== game.sound.enabled) game.headerPanel.onSoundToggle?.();
  if (o.close) for (const d of Object.values(dialogs(game))) d.container.visible = false;
  if (o.open === 'menu') game.headerPanel.onHelpClick?.();
  else if (o.open === 'receipt') game.receiptDialog.show();
  else if (o.open === 'rules') game.rulesDialog.show();
  else if (o.open === 'auto') game.autoDialog.show(game.runtime.lastAutoCount);
  else if (o.open !== undefined) throw Error('open is one of menu, receipt, rules, auto');
  if (o.reset) void game.menuDialog.onResetSave?.();
  if (o.stop) game.runtime.stopAuto();
  if (o.play) void game.runtime.advance();
  if (o.auto) void game.runtime.startAuto(Number(o.auto));
}

export const dungeonSpin: ScenePreset = {
  id: 'dungeon-spin',
  title: '迷宮一閃',
  summary:
    '直式 572×1024 的地城連線拉霸：按「前進」主角就走一段，中獎的連線變成怪物被斬、巨袋寶箱怪給 Bonus 追擊、大獎跳數；本機試玩點數先記帳再演出。和原遊戲 games/dungeon-spin 逐像素相同（觀看台不載 3D，原遊戲的 3D 石廊被背景整張蓋住）。',
  modules: ['2d/dungeon-spin', '2d/prefab-atlas', 'systems/slot-round'],
  views: {
    待命: '',
    '多線＋SUPER WIN': 'save=memory&play=1',
    '巨袋寶箱怪 Bonus': 'save=memory&fixture=boss&play=1',
    '沒中（怪物逃跑）': 'save=memory&fixture=empty&play=1',
    '五連・拔刀一閃': 'save=memory&fixture=five&play=1',
    '疾行＋單注 50': 'save=memory&fixture=four&burst=1&bet=50&play=1',
    '自動前進 10 局': 'save=memory&fixture=three&auto=10',
    選單: 'open=menu',
    戰果明細: 'open=receipt',
    冒險者指南: 'open=rules',
    自動設定: 'open=auto',
  },
  async start(container, params) {
    // Booted as the original did: no container, so Laya's own show-all fits the 572×1024 design
    // into the window (a CSS scale of the canvas). With `container` and no `designSize` the
    // runtime sizes the stage to the container instead: at 1280×720 the game then sits at 1:1,
    // cut off below (measured; README). The canvas is moved into the container afterwards, and
    // the page takes the game's letterbox colour.
    const context = await ZhudaEngine.boot({
      width: DESIGN.width,
      height: DESIGN.height,
      bgColor: '#080f19',
      scaleMode: 'showall',
      features: ['core', '2d', 'ui'],
    });
    container.appendChild(context.canvas);
    document.body.style.background = container.style.background = '#07111f';
    const provider = createAssetProvider();
    const library = new ZhudaPrefabLibrary({ provider, definitions });
    const game = new DungeonSpin(context.stage, library, params.get('save') === 'memory' ? { storage: memoryStorage() } : {});
    await game.init();

    let ready = false;
    const hook = {
      ready,
      game,
      state: () => snapshot(game, hook.ready),
      set: (options: Record<string, unknown>) => apply(game, options),
      errors: () => [
        ...context.renderer.errors.slice(0, 6),
        ...game.runtime.diagnostics.entries.filter((e) => ERROR_EVENTS.includes(e.type)).slice(0, 6),
      ],
      provenance: () => [game.backgroundPrefab, game.creaturesPrefab, game.heroActionsPrefab].map((i) => i.provenance),
    };
    setSceneHook(hook);

    window.addEventListener('resize', () => Laya.stage?.updateCanvasSize(false));
    window.addEventListener(
      'pagehide',
      () => {
        game.dispose();
        library.dispose();
        provider.dispose?.();
      },
      { once: true },
    );
    ZhudaEngine.flushRenderFrames(4);

    const query: Record<string, unknown> = {};
    for (const key of ['fixture', 'bet', 'open', 'auto']) if (params.has(key)) query[key] = params.get(key);
    if (params.get('burst') === '1') query.burst = true;
    if (params.get('play') === '1') query.play = true;
    apply(game, query);

    // ready after ten drawn frames
    let frames = 0;
    const count = () => (++frames >= 10 ? (hook.ready = ready = true) : requestAnimationFrame(count));
    requestAnimationFrame(count);
  },
};
