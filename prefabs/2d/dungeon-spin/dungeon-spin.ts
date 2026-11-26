// Dungeon Spin · 迷宮一閃: a portrait (572×1024) line-slot told as a dungeon walk. Every
// press of the advance ball plays one round: the hero walks, the round's awards appear as
// monsters he cuts down, a treasure-bag boss gives bonus strikes, big wins count up. The
// money is a local play-money ledger that saves each round before it is shown.
//
//   const { stage } = await ZhudaEngine.boot({ width: 572, height: 1024, bgColor: '#080f19', scaleMode: 'showall', features: ['core', '2d', 'ui'] });
//   const provider = createAssetProvider();
//   const library = new ZhudaPrefabLibrary({ provider, definitions });
//   const game = new DungeonSpin(stage, library);
//   await game.init();            // mounts the three checked prefabs, builds views, UI, session and runtime
//   …
//   game.dispose(); library.dispose(); provider.dispose?.();
//
// Layers, bottom to top: the background prefab (template-v2.png, the painted corridor, hero,
// frames and buttons), Game2DLayer (the two atlas prefabs, hidden, then monsters, hero
// overlay, boss, win), UILayer (header, control bar, dialogs).
// From games/dungeon-spin (src/Main.ts, class DungeonSpinGame). Changes: the invisible 3D
// hall is not built (README: measured 0 pixels); the atlases are mounted with
// 2d/prefab-atlas; the boss reaches the header through callbacks instead of
// window.__DUNGEON_GAME__; options for storage, keyboard and sound; dispose() also removes the
// key listener.
import type { ZhudaPrefabLibrary, PrefabInstance } from 'zhuda-laya-engine';
import { GameRuntime } from '../../systems/slot-round/game-runtime.ts';
import { LocalSession } from '../../systems/slot-round/local-session.ts';
import { mountAtlasPrefab } from '../prefab-atlas/prefab-atlas.ts';
import { MathEngine } from './math.ts';
import { MonsterFieldView } from './views/monster-field.ts';
import { HeroActionView } from './views/hero-action.ts';
import { BossSealView } from './views/boss-seal.ts';
import { WinCelebrationView } from './views/win-celebration.ts';
import { LayaDungeonPresentation, type WalkStepper } from './presentation.ts';
import { HeaderPanel } from './ui/header-panel.ts';
import { ControlBar } from './ui/control-bar.ts';
import { AutoAdvanceDialog } from './ui/auto-advance-dialog.ts';
import { RulesHelpDialog } from './ui/rules-help-dialog.ts';
import { RoundReceiptDialog } from './ui/round-receipt-dialog.ts';
import { GameMenuDialog } from './ui/game-menu-dialog.ts';
import { DungeonSoundBridge } from './sound.ts';

/** The original game's save: localStorage key, lock name and rules id. */
export const SAVE_KEY = 'dungeon-spin.local-session.v1';
export const SAVE_LOCK = 'dungeon-spin.local-session';
export const RULES_ID = 'original-fixed-v1';
/** The bets the game offers (single bet; the total is ×9). */
export const BETS = [10, 20, 50] as const;
/** The design size: portrait, show-all. */
export const DESIGN = { width: 572, height: 1024 } as const;

export interface DungeonSpinOptions {
  /** Where the play-money ledger is kept (default localStorage, or a memory-less stub without it). */
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  /** Space / Enter press the advance ball (default true). */
  keyboard?: boolean;
  /** The sound (default the shared DungeonSoundBridge). */
  sound?: DungeonSoundBridge;
  /** Something to push forward while the hero walks (the original's 3D hall; default none). */
  walk?: WalkStepper | null;
}

export class DungeonSpin {
  public runtime!: GameRuntime;
  public session!: LocalSession;
  public presentation!: LayaDungeonPresentation;

  public bgSprite!: any;
  public backgroundPrefab!: PrefabInstance;
  public creaturesPrefab!: PrefabInstance;
  public heroActionsPrefab!: PrefabInstance;
  public monsterField!: MonsterFieldView;
  public heroView!: HeroActionView;
  public bossView!: BossSealView;
  public winView!: WinCelebrationView;

  public headerPanel!: HeaderPanel;
  public controlBar!: ControlBar;
  public autoDialog!: AutoAdvanceDialog;
  public rulesDialog!: RulesHelpDialog;
  public receiptDialog!: RoundReceiptDialog;
  public menuDialog!: GameMenuDialog;

  public readonly stage: any;
  public readonly sound: DungeonSoundBridge;
  private readonly prefabLibrary: ZhudaPrefabLibrary;
  private readonly options: DungeonSpinOptions;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(stage: any, prefabLibrary: ZhudaPrefabLibrary, options: DungeonSpinOptions = {}) {
    this.stage = stage;
    this.prefabLibrary = prefabLibrary;
    this.options = options;
    this.sound = options.sound ?? DungeonSoundBridge.getInstance();
  }

  public async init(): Promise<void> {
    // 1. The checked background prefab, visible, straight on the stage.
    this.backgroundPrefab = await this.prefabLibrary.instantiate('visual/template-background', {
      state: 'idle',
      parent: this.stage,
    });
    this.bgSprite = this.backgroundPrefab.root;
    this.bgSprite.name = 'TemplateBackgroundLayer';

    // 2. The game layer: monsters, hero, boss, win.
    const game2DLayer = new Laya.Sprite();
    game2DLayer.name = 'Game2DLayer';
    this.stage.addChild(game2DLayer);

    // The two atlases are the checked prefabs themselves, mounted hidden; the views draw
    // cells of their decoded textures (no second URL, no second cache).
    const creatures = await mountAtlasPrefab(this.prefabLibrary, 'visual/creatures-atlas', 'CreaturesAtlas', game2DLayer);
    this.creaturesPrefab = creatures.instance;
    const heroActions = await mountAtlasPrefab(this.prefabLibrary, 'visual/hero-actions', 'HeroActions', game2DLayer);
    this.heroActionsPrefab = heroActions.instance;

    this.monsterField = new MonsterFieldView(creatures.texture);
    game2DLayer.addChild(this.monsterField.container);

    this.heroView = new HeroActionView(heroActions.texture);
    game2DLayer.addChild(this.heroView.container);

    this.bossView = new BossSealView(creatures.texture);
    game2DLayer.addChild(this.bossView.container);

    this.winView = new WinCelebrationView();
    game2DLayer.addChild(this.winView.container);

    this.presentation = new LayaDungeonPresentation({
      hall3D: this.options.walk ?? null,
      monsterField: this.monsterField,
      heroView: this.heroView,
      bossView: this.bossView,
      winView: this.winView,
    });

    // 3. Header, control bar and dialogs.
    const uiLayer = new Laya.Sprite();
    uiLayer.name = 'UILayer';
    this.stage.addChild(uiLayer);

    this.headerPanel = new HeaderPanel();
    uiLayer.addChild(this.headerPanel.container);

    this.controlBar = new ControlBar();
    uiLayer.addChild(this.controlBar.container);
    this.presentation.controlBar = this.controlBar;

    this.autoDialog = new AutoAdvanceDialog();
    uiLayer.addChild(this.autoDialog.container);

    this.rulesDialog = new RulesHelpDialog();
    uiLayer.addChild(this.rulesDialog.container);

    this.receiptDialog = new RoundReceiptDialog();
    uiLayer.addChild(this.receiptDialog.container);
    this.presentation.receiptDialog = this.receiptDialog;

    this.menuDialog = new GameMenuDialog();
    uiLayer.addChild(this.menuDialog.container);

    this.bossView.onShow = () => this.headerPanel.setSceneTitle('THE TREASURE THIEF');
    this.bossView.onHide = () => this.headerPanel.updateSequence(this.session?.state?.sequence || 0);

    // 4. The play-money ledger and the round runtime.
    const storage =
      this.options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {} });

    this.session = new LocalSession({
      storage,
      resolve: (fixtureKey, bet) => MathEngine.resolve(fixtureKey, bet),
      saveKey: SAVE_KEY,
      lockName: SAVE_LOCK,
      rules: RULES_ID,
      bets: BETS,
    });
    await this.session.open();

    this.runtime = new GameRuntime({
      presentation: this.presentation,
      bets: BETS,
      initial: { fixture: 'multi', singleBet: 10, mode: 'normal' },
    });
    this.runtime.attachSession(this.session);

    this.bindRuntimeEvents();
    this.bindInteractions();

    // 5. Waiting: an empty corridor, the hero ready, the receipt prepared with the 'three' board.
    const initialMath = MathEngine.resolve('three', 10);
    this.receiptDialog.updateReceipt(initialMath);
    this.monsterField.setIdle();
    this.heroView.setPose('ready');
    this.heroView.setDialogue('石廊深處，傳來了腳步聲。');
    this.headerPanel.updateBalance(this.session.points);
    this.headerPanel.updateSequence(this.session.state?.sequence || 0);
  }

  /** Stops auto, removes the key listener and releases the three prefab instances. */
  public dispose(): void {
    this.runtime?.stopAuto();
    if (this.keyListener && typeof window !== 'undefined') window.removeEventListener('keydown', this.keyListener);
    this.keyListener = null;
    this.backgroundPrefab?.dispose();
    this.creaturesPrefab?.dispose();
    this.heroActionsPrefab?.dispose();
  }

  private bindRuntimeEvents(): void {
    this.runtime.subscribe((event) => {
      const state = event.state;
      this.controlBar.updateAction(state.primary);
      if (state.points !== null) {
        this.headerPanel.updateBalance(state.points);
      }
      if (state.last?.sequence) {
        this.headerPanel.updateSequence(state.last.sequence);
      }
      if (state.last?.win !== undefined) {
        this.controlBar.updateWinDisplay(state.last.win);
      }
      this.controlBar.updateAutoCount(state.auto?.remaining || 0);
    });
  }

  private bindInteractions(): void {
    const sound = this.sound;

    // A press of the advance ball.
    this.controlBar.onAdvanceClick = async () => {
      await sound.unlock();
      void this.runtime.advance();
    };

    // Holding it (or the auto ball): open the auto settings, or stop a running batch.
    this.controlBar.onLongPress = () => {
      if (this.runtime.state.auto.running) {
        this.runtime.stopAuto();
      } else {
        this.autoDialog.show(this.runtime.lastAutoCount);
      }
    };

    this.controlBar.onBetChange = (bet) => {
      this.runtime.configure({ singleBet: bet });
    };

    this.controlBar.onBurstToggle = (burst) => {
      this.runtime.configure({ mode: burst ? 'burst' : 'normal' });
    };

    this.autoDialog.onConfirm = async (count) => {
      await sound.unlock();
      void this.runtime.startAuto(count);
    };

    // The hamburger opens the menu.
    this.headerPanel.onHelpClick = () => {
      this.menuDialog.setSoundState(sound.enabled);
      this.menuDialog.show();
    };

    this.menuDialog.onOpenReceipt = () => {
      this.receiptDialog.show();
    };
    this.menuDialog.onOpenHelp = () => {
      this.rulesDialog.show();
    };
    this.menuDialog.onOpenAuto = () => {
      this.autoDialog.show(this.runtime.lastAutoCount);
    };
    this.menuDialog.onToggleSound = () => {
      sound.enabled = !sound.enabled;
      if (this.headerPanel.soundIcon) {
        this.headerPanel.soundIcon.text = sound.enabled ? '🔊' : '🔇';
      }
      this.menuDialog.setSoundState(sound.enabled);
    };
    this.menuDialog.onResetSave = async () => {
      await this.session.reset();
      this.headerPanel.updateBalance(this.session.points);
      this.headerPanel.updateSequence(0);
      this.heroView.setDialogue('已重設本地存檔至 100,000 點。');
      this.menuDialog.hide();
    };

    this.headerPanel.onSoundToggle = () => {
      sound.enabled = !sound.enabled;
      if (this.headerPanel.soundIcon) {
        this.headerPanel.soundIcon.text = sound.enabled ? '🔊' : '🔇';
      }
      this.menuDialog.setSoundState(sound.enabled);
    };

    // Space / Enter press the advance ball (a held key does not repeat it).
    if (this.options.keyboard !== false && typeof window !== 'undefined') {
      this.keyListener = (e: KeyboardEvent) => {
        if (e.repeat) return;
        if (e.code === 'Space' || e.code === 'Enter') {
          void sound.unlock();
          void this.runtime.advance();
        }
      };
      window.addEventListener('keydown', this.keyListener);
    }
  }
}
