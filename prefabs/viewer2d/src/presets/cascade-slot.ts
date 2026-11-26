// A whole scatter-pays cascade slot from the shared 2D modules, running in the browser on
// LocalSession (no server): the neutral example config, code-drawn symbols, the runtime's one
// big button, auto play, turbo, buying the feature, the receipt, the celebration and sound
// through the engine's audio adapter. This file is the thin layer a game writes.
//   ?round=seed:168        play that round on open (seed:<n>, seed:<n>:buy, seed:<n>:ante)
//   ?seed=<n>              first seed of the button's sequence (default 1)
//   ?turbo=1  ?autoplay=10  ?dialog=buy|auto|receipt  ?bet=20
// window.__SCENE__: state(), set({ spin, round, turbo, dialog, collect, bet }), plus runtime,
// session, board, player, sound, clock and spin(round?) → Promise of the outcome.
import { IframeSoundAdapter, ZhudaEngine } from 'zhuda-laya-engine';
import { setSceneHook, type ScenePreset } from '../preset.ts';
import { GameRuntime } from '../common/systems/slot-round/game-runtime.ts';
import { LocalSession } from '../common/systems/slot-round/local-session.ts';
import type { CascadeSnapshot } from '../common/2d/slot-client/protocol.ts';
import { exampleConfig } from '../common/2d/cascade-math/example-config.ts';
import { createSeedResolver, parseSeedKey, seedKey } from '../common/2d/cascade-math/seed-resolver.ts';
import { pay } from '../common/2d/cascade-math/config.ts';
import { FrameClock } from '../common/2d/slot-ui/frame-clock.ts';
import { CascadeBoard } from '../common/2d/slot-ui/cascade-board.ts';
import { Celebration } from '../common/2d/slot-ui/celebration.ts';
import { ControlBar, MeterPanel } from '../common/2d/slot-ui/control-bar.ts';
import { AutoPlayDialog, BuyFeatureDialog, ReceiptDialog } from '../common/2d/slot-ui/dialogs.ts';
import { MountSlotManager } from '../common/2d/slot-ui/mount-slots.ts';
import { SlotSoundBridge } from '../common/2d/slot-ui/sound-bridge.ts';
import { CascadeStepPlayer } from '../common/2d/slot-ui/step-player.ts';
import { shapePainter } from '../common/2d/slot-ui/symbols.ts';

const W = 1280;
const H = 720;
const BETS = [10, 20, 50, 100];

function memoryStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function text(size: number, color: string, x: number, y: number, s = '', width = 0, align: 'left' | 'center' = 'left'): Laya.Text {
  const t = new Laya.Text();
  t.fontSize = size;
  t.color = color;
  t.bold = true;
  t.align = align;
  if (width) t.width = width;
  t.text = s;
  t.pos(x, y);
  return t;
}

export const cascadeSlot: ScenePreset = {
  id: 'cascade-slot',
  title: '連消老虎機（中性範例）',
  summary: '隨處消除、連消補位、倍數球、免費遊戲：共用執行骨架＋連消數學＋程式繪製的中性外觀，在瀏覽器的本地存檔上跑（不需要伺服器）。每一局都是種子局，和 Go 伺服器同種子同結果。',
  modules: ['systems/slot-round', '2d/slot-client', '2d/cascade-math', '2d/slot-ui'],
  views: {
    待機: '',
    '一局（4 波連消＋×4）': 'round=seed:168',
    '7 波連消': 'round=seed:1457',
    '自然觸發免費遊戲': 'round=seed:592',
    '購買免費遊戲': 'round=seed:22:buy',
    極速: 'round=seed:168&turbo=1',
    '自動 10 局': 'autoplay=10',
    購買確認: 'dialog=buy',
    自動設定: 'dialog=auto',
    本局明細: 'round=seed:168&dialog=receipt',
  },
  async start(container, params) {
    const context = await ZhudaEngine.boot({ container, width: W, height: H, features: ['core', '2d', 'ui'], bgColor: '#0b1020', scaleMode: 'showall' });
    const cfg = exampleConfig();
    const clock = new FrameClock();
    const errors: string[] = [];

    // --- stage -------------------------------------------------------------------------
    const bg = new Laya.Sprite();
    for (let i = 0; i < 12; i++) bg.graphics.drawRect(0, (i * H) / 12, W, H / 12 + 1, `rgb(${11 + i},${16 + i * 2},${32 + i * 3})`);
    Laya.stage.addChild(bg);
    const mounts = new MountSlotManager(Laya.stage);
    const center = mounts.getSlot('CENTER_STAGE_OVERLAY');
    const side = mounts.getSlot('SIDE_PROMO_WIDGET');
    const modal = mounts.getSlot('MODAL_POPUP_LAYER');
    mounts.getSlot('TOP_REGULATORY_BAR').addChild(text(22, '#e2e8f0', 40, 18, '連消示範 · 中性範例設定（prefabs）'));

    const painter = shapePainter();
    const board = new CascadeBoard({ cols: cfg.cols, rows: cfg.rows, clock, multiplierSymbol: cfg.multiplierSymbol, painter, cell: 88, gap: 6 });
    board.root.pos((W - board.width) / 2, 64);
    center.addChild(board.root);

    const meter = new MeterPanel({ width: 240 });
    meter.root.pos(40, 64);
    side.addChild(meter.root);

    // paytable panel (8+ / 11+ / 14+ at bet 10)
    const table = new Laya.Sprite();
    table.graphics.drawRoundRect(0, 0, 250, 470, 18, 18, 18, 18, 'rgba(10,14,28,0.88)', '#3b4a6b', 2);
    table.addChild(text(18, '#fbbf24', 0, 12, '賠率（下注 10）', 250, 'center'));
    table.addChild(text(16, '#94a3b8', 0, 36, '任何位置 8+ / 11+ / 14+ 個', 250, 'center'));
    cfg.paySymbols.forEach((s, i) => {
      painter(table.graphics, s, 40, 86 + i * 47, 40);
      const pays = [8, 11, 14].map((n) => pay(cfg, s, n, 10)).join(' / ');
      table.addChild(text(20, '#e2e8f0', 72, 75 + i * 47, pays));
    });
    table.pos(W - 290, 64);
    side.addChild(table);

    const buyButton = new Laya.Sprite();
    buyButton.size(240, 54);
    buyButton.graphics.drawRoundRect(0, 0, 240, 54, 14, 14, 14, 14, 'rgba(250,204,21,0.12)', '#fbbf24', 2);
    buyButton.addChild(text(20, '#fde68a', 0, 15, `購買免費遊戲 ×${cfg.buyCostMultiplier}`, 240, 'center'));
    buyButton.pos(40, 306);
    side.addChild(buyButton);
    const receiptButton = new Laya.Sprite();
    receiptButton.size(240, 54);
    receiptButton.graphics.drawRoundRect(0, 0, 240, 54, 14, 14, 14, 14, 'rgba(255,255,255,0.06)', '#94a3b8', 2);
    receiptButton.addChild(text(20, '#e2e8f0', 0, 15, '本局明細', 240, 'center'));
    receiptButton.pos(40, 374);
    side.addChild(receiptButton);
    const seedLabel = text(16, '#64748b', 40, 446, '', 240);
    side.addChild(seedLabel);

    const bar = new ControlBar({ width: W, height: 120, bets: BETS, clock });
    bar.root.pos(0, H - 120);
    mounts.getSlot('BOTTOM_CONTROL_DECK').addChild(bar.root);

    const celebration = new Celebration({ width: W, height: H, clock });
    const autoDialog = new AutoPlayDialog(W, H);
    const buyDialog = new BuyFeatureDialog(W, H);
    const receipt = new ReceiptDialog(W, H, { painter, names: cfg.names });
    for (const d of [autoDialog.root, buyDialog.root, receipt.root, celebration.root]) modal.addChild(d);

    // --- sound: the engine's one audio authority, placeholder tones ---------------------
    let adapter: IframeSoundAdapter | null = null;
    try {
      adapter = new IframeSoundAdapter({ voiceOverflow: 'fifo', maxActiveVoices: 24 });
    } catch (e) {
      errors.push(`audio: ${(e as Error).message}`);
    }
    const sound = new SlotSoundBridge(adapter);
    window.addEventListener('pointerdown', () => sound.unlock('pointerdown'), { once: true });

    // --- session, runtime, presentation --------------------------------------------------
    const session = new LocalSession({
      storage: params.get('persist') === '1' ? localStorage : memoryStorage(),
      saveKey: 'commonprefabs.cascade-slot.v1',
      rules: 'cascade-example-v1',
      resolve: createSeedResolver(cfg),
      bets: BETS,
      now: () => 0,
      uuid: (() => {
        let n = 0;
        return () => `r${++n}`;
      })(),
    });
    await session.open();
    const player = new CascadeStepPlayer({
      board,
      celebration,
      hud: {
        setWin: (n) => bar.setWin(n),
        setTitle: (t) => bar.setTitle(t),
        setMultiplier: (m) => meter.setMultiplier(m),
        setFreeSpins: (s, t) => meter.setFreeSpins(s, t),
      },
      sound,
      wait: (ms) => clock.wait(ms),
      onAccelerate: (on) => (clock.speed = on ? 4 : 1),
    });
    // every round takes the next seed, unless one was asked for (spin(round), buying)
    let nextSeed = Number(params.get('seed')) || 1;
    let asked: string | null = null;
    const runtime = new GameRuntime<CascadeSnapshot>({
      presentation: player,
      bets: BETS,
      initial: { fixture: seedKey(nextSeed) },
      fsm: true,
      beforeRound: () => {
        const fixture = asked ?? seedKey(nextSeed++);
        asked = null;
        return { fixture };
      },
      delayMs: 450,
      timer: (fn, ms) => void clock.wait(ms).then(fn),
      cancelTimer: () => {},
    });
    runtime.attachSession(session);
    const bet = Number(params.get('bet'));
    if (BETS.includes(bet)) {
      runtime.configure({ singleBet: bet });
      bar.setBet(bet);
    }
    bar.setBalance(session.points);
    runtime.subscribe((event) => {
      const s = event.state;
      bar.updateAction(s.primary);
      bar.updateAutoCount(s.auto.remaining);
      // the session has already saved the win (commit before play); show it when the round has been shown
      if (event.type === 'round.accepted' && runtime.last) bar.setBalance(runtime.last.pointsAfter - runtime.last.win);
      else if (s.points !== null && (event.type === 'session.restored' || event.type === 'operation.finished')) bar.setBalance(s.points);
      if (s.last) seedLabel.text = `${s.last.fixture} · 第 ${s.last.sequence} 局`;
      if (event.type === 'round.presented' && runtime.last) receipt.update(runtime.last);
      if (event.type === 'round.rejected') errors.push(String(event.message));
    });

    /** Plays one round (the given key, or the next seed). */
    const spin = async (round?: string) => {
      if (runtime.state.primary !== 'advance') return false;
      asked = round ?? null;
      return runtime.advance();
    };
    bar.onAdvance = () => void runtime.advance();
    bar.onLongPress = () => (runtime.state.auto.running ? runtime.stopAuto() : autoDialog.showWith(runtime.lastAutoCount));
    bar.onBetChange = (b) => runtime.configure({ singleBet: b });
    bar.onBurstToggle = (on) => runtime.configure({ mode: on ? 'burst' : 'normal' });
    bar.onInfo = () => receipt.show();
    autoDialog.onConfirm = (count) => void runtime.startAuto(count);
    buyButton.on(Laya.Event.CLICK, null, () => {
      const selection = runtime.selection;
      buyDialog.open(selection.singleBet * cfg.buyCostMultiplier, session.points, () => void spin(seedKey(nextSeed++, 'buy')));
    });
    receiptButton.on(Laya.Event.CLICK, null, () => receipt.show());

    const shown = runtime.last?.p.spin ?? createSeedResolver(cfg)(seedKey(nextSeed), runtime.selection.singleBet).p.spin;
    board.show(runtime.last ? shown.finalGrid : shown.grid, runtime.last ? shown.finalOrbs : shown.orbs);

    // --- hook --------------------------------------------------------------------------
    let frames = 0;
    let lastOutcome: unknown = null;
    const hook = {
      ready: false,
      runtime,
      session,
      board,
      player,
      sound,
      clock,
      celebration,
      spin: async (round?: string) => (lastOutcome = await spin(round)),
      state: () => {
        const s = runtime.state;
        const last = runtime.last;
        return {
          frames,
          time: Math.round(clock.time * 100) / 100,
          phase: s.phase,
          fsm: s.fsmState,
          primary: s.primary,
          busy: s.busy,
          balance: session.points,
          sequence: session.state?.sequence ?? 0,
          last: last && { fixture: last.fixture, bet: last.bet, win: last.win, mainWin: last.mainWin, bonusWin: last.bonusWin, waves: last.p.spin.waves.length, multiplier: last.p.spin.multiplier, freeSpins: last.b.spins.length, presented: last.presented },
          auto: { running: s.auto.running, completed: s.auto.completed, remaining: s.auto.remaining, reason: s.auto.reason },
          trace: [...player.trace],
          celebrating: celebration.playing,
          meter: meter.multiplier,
          dialogs: { auto: autoDialog.visible, buy: buyDialog.visible, receipt: receipt.visible },
          sounds: sound.played.slice(-8),
          lastOutcome,
        };
      },
      set: (o: Record<string, unknown>) => {
        if (o.turbo !== undefined) {
          runtime.configure({ mode: o.turbo ? 'burst' : 'normal' });
          if (bar.model.burst !== Boolean(o.turbo)) bar.model.toggleBurst();
          bar.refresh();
        }
        if (typeof o.bet === 'number') {
          runtime.configure({ singleBet: o.bet });
          bar.setBet(o.bet);
        }
        if (o.collect) runtime.collect();
        if (o.dialog === 'buy') buyDialog.open(runtime.selection.singleBet * cfg.buyCostMultiplier, session.points, () => void spin(seedKey(nextSeed++, 'buy')));
        if (o.dialog === 'auto') autoDialog.showWith(runtime.lastAutoCount);
        if (o.dialog === 'receipt') receipt.show();
        if (o.dialog === 'none') [autoDialog, buyDialog, receipt].forEach((d) => d.hide());
        if (typeof o.round === 'string' || o.spin) void hook.spin(typeof o.round === 'string' ? o.round : undefined);
        if (typeof o.autoplay === 'number') void runtime.startAuto(o.autoplay);
      },
      errors: () => [...errors, ...context.renderer.errors.slice(0, 6)],
    };
    setSceneHook(hook);

    // what the address asks for, once the engine's splash is over
    const turbo = params.get('turbo') === '1';
    const round = params.get('round');
    const dialog = params.get('dialog');
    const autoplay = Number(params.get('autoplay'));
    if (round && !parseSeedKey(round)) errors.push(`round=${round} is not seed:<n>[:buy|:ante]`);
    let started = false;
    context.runtime.start((dt: number) => {
      clock.update(Math.min(dt, 0.1));
      frames++;
      if (!started && clock.time > 5.5) {
        started = true;
        hook.ready = true;
        if (turbo) hook.set({ turbo: true });
        if (round && parseSeedKey(round)) void hook.spin(round).then(() => dialog === 'receipt' && receipt.show());
        else if (autoplay > 0) hook.set({ autoplay });
        if (dialog && dialog !== 'receipt') hook.set({ dialog });
      }
    });
  },
};
