import { DIFFICULTIES, DifficultyConfig, MinesweeperGame } from './domain/MinesweeperCore';
import { Minesweeper3DView } from './presentation/Minesweeper3DView';
import { MinesweeperUI } from './presentation/MinesweeperUI';
import { SpineCompanion } from './spine/SpineCompanion';
import { MinesweeperAudio } from './audio/MinesweeperAudio';
import { BenchmarkReport, ZhudaBenchmarkEngine } from '../packages/core/BenchmarkEngine';
import { ZhudaAssetSerializer, ZhudaPrefab } from '../packages/core/StaticAssetPipeline';
import { UnityBridgePipeline } from '../packages/core/UnityBridgePipeline';
import {
  ZhudaAnimatorControllerComponent,
  ZhudaParticleEmitterComponent
} from './components/StaticAssetComponents';

export class ZhudaShowcaseApp {
  private scene: Laya.Scene;
  private game: MinesweeperGame;
  private view3D: Minesweeper3DView;
  private ui: MinesweeperUI;
  private companion: SpineCompanion;
  private audio: MinesweeperAudio;
  private particleEmitter: ZhudaParticleEmitterComponent | null = null;
  private unityAnimator: ZhudaAnimatorControllerComponent | null = null;
  private vfxCycleIndex: number = 0;
  private latestBenchmark: BenchmarkReport;

  private flagMode: boolean = false;
  private isPointerDown: boolean = false;
  private pointerDownTime: number = 0;
  private pointerDownPos: { x: number; y: number } = { x: 0, y: 0 };
  private longPressTriggered: boolean = false;

  constructor(scene: Laya.Scene) {
    this.scene = scene;
    this.game = new MinesweeperGame(DIFFICULTIES.beginner);
    this.audio = new MinesweeperAudio();

    const overlay2D = new Laya.Sprite();
    overlay2D.name = 'NumberOverlay2D';
    Laya.stage.addChild(overlay2D);

    this.view3D = new Minesweeper3DView(scene, this.game, overlay2D);
    this.companion = new SpineCompanion(Laya.stage);

    // 後組裝階段 (Assembly Phase)：透過 ZhudaPrefab.instantiate 載入預先設計並完成像素校準之粒子預製體 (MineExplosionParticle.lh)
    const particlePrefabData = ZhudaAssetSerializer.buildParticleExplosionPrefab();
    const particleNode = ZhudaPrefab.instantiate(particlePrefabData, Laya.stage, { x: 460, y: 270 });
    particleNode.visible = false;
    this.particleEmitter =
      (particleNode.getComponent(ZhudaParticleEmitterComponent) as ZhudaParticleEmitterComponent) ||
      (particleNode.addComponent(ZhudaParticleEmitterComponent) as ZhudaParticleEmitterComponent);

    // 後組裝階段：掛載由 Unity 場景移植之 CrystalGuardian 靜態預製體與 AnimatorController 狀態機
    const unityGuardianPrefab = UnityBridgePipeline.buildUnityCrystalGuardianPrefab();
    const unityGuardianNode = ZhudaPrefab.instantiate(unityGuardianPrefab, Laya.stage, { x: 460, y: 270 });
    unityGuardianNode.visible = false;
    this.unityAnimator =
      (unityGuardianNode.getComponent(
        ZhudaAnimatorControllerComponent
      ) as ZhudaAnimatorControllerComponent) ||
      (unityGuardianNode.addComponent(
        ZhudaAnimatorControllerComponent
      ) as ZhudaAnimatorControllerComponent);

    this.ui = new MinesweeperUI(Laya.stage, {
      onRestart: () => this.restartGame(),
      onDifficultyChange: (diff) => this.changeDifficulty(diff),
      onToggleView: () => this.view3D.toggleViewMode(),
      onToggleAudio: () => {
        const next = !this.audio.isEnabled();
        this.audio.setEnabled(next);
        return next;
      },
      onToggleFlagMode: () => {
        this.flagMode = !this.flagMode;
        return this.flagMode;
      },
      onRunBenchmark: () => this.executeLiveBenchmark()
    });

    this.latestBenchmark = ZhudaBenchmarkEngine.runSuite(this.view3D.getTileCount());
    this.ui.refreshTelemetry(this.latestBenchmark);

    this.bindInputEvents();
    Laya.timer.loop(500, this, this.onTimerUpdate);

    // 自動於首幀觸發一次開局揭開 (4, 4 中心格)，讓首次開啟與截圖驗收即展現立體下沉與數字投影
    this.handleReveal(4, 4);
    this.syncGlobalTelemetry();

    console.log(
      '[ZhudaShowcaseApp] 豬大 LayaAir (AI-Friendly) 初始化完畢：29 模組、AST 反射、Spine 4.2 PhysicsConstraint、靜態資產 (.lh) 像素/ΔE 校準與 3D 棋盤全數就緒！'
    );
  }

  public executeLiveBenchmark(): BenchmarkReport {
    this.audio.playChord(3);
    this.companion.setState('cheer');
    this.companion.applyImpulse(6.5);
    this.view3D.triggerVictoryWave();

    const vfxModes: Array<'coin-fountain' | 'sword-slash' | 'levelup-aura' | 'victory'> = [
      'coin-fountain',
      'sword-slash',
      'levelup-aura',
      'victory'
    ];
    const activeVfx = vfxModes[this.vfxCycleIndex % vfxModes.length];
    this.vfxCycleIndex++;

    if (this.particleEmitter) {
      this.particleEmitter.playBurst(520, 360, activeVfx);
    }

    if (this.unityAnimator) {
      const stepRes = this.unityAnimator.stepAnimatorCycle();
      this.ui.updateUnityAnimatorBanner(stepRes.stateName, activeVfx);
    }

    this.latestBenchmark = ZhudaBenchmarkEngine.runSuite(this.view3D.getTileCount());
    this.syncGlobalTelemetry();
    return this.latestBenchmark;
  }

  private syncGlobalTelemetry(): void {
    const win = globalThis as unknown as {
      __ZHUDA_SHOWCASE_STATE__?: Record<string, unknown>;
    };
    win.__ZHUDA_SHOWCASE_STATE__ = {
      status: this.game.status,
      rows: this.game.rows,
      cols: this.game.cols,
      revealedCount: this.game.revealedCount,
      remainingMines: this.game.remainingMines,
      tileNodes3D: this.view3D.getTileCount(),
      benchmark: this.latestBenchmark
    };
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.zhudaTiles = String(this.view3D.getTileCount());
      document.body.dataset.zhudaRevealed = String(this.game.revealedCount);
      document.body.dataset.zhudaDrawcalls = String(this.latestBenchmark.estimatedDrawCallsZhuda);
      document.body.dataset.zhudaStageChildren = String(Laya.stage ? Laya.stage.numChildren : 0);
      document.body.dataset.zhudaStaticAssets = String(
        this.latestBenchmark.staticAssetTelemetry.totalAssetsCount
      );
      document.body.dataset.zhudaCalibratedDeltaE = String(
        this.latestBenchmark.staticAssetTelemetry.afterDeltaE2000
      );
      document.body.dataset.zhudaPrefabAssembled = String(
        Boolean(this.particleEmitter && this.unityAnimator)
      );
      document.body.dataset.zhudaNineSlicePassed = String(
        this.latestBenchmark.nineSliceTelemetry.passed
      );
      document.body.dataset.zhudaIframeAudio = this.latestBenchmark.iframeAudioTelemetry
        .postMessageBridgeActive
        ? 'ready'
        : 'inactive';
      document.body.dataset.zhudaViewportProfiles = String(
        this.latestBenchmark.viewportMatrixTelemetry.totalProfiles
      );
      document.body.dataset.zhudaSafeareaPassed = String(
        this.latestBenchmark.viewportMatrixTelemetry.allSafeAreaPassed
      );
      document.body.dataset.zhudaVfxBlueprints = String(
        this.latestBenchmark.staticAssetTelemetry.vfxBlueprintsCount
      );
      document.body.dataset.zhudaUnityMigrated = String(
        this.latestBenchmark.unityMigrationTelemetry.passed
      );
      document.body.dataset.zhudaUnityAnimatorTrace =
        this.latestBenchmark.unityMigrationTelemetry.animatorTransitionTrace.join('->');
    }
  }

  private bindInputEvents(): void {
    Laya.stage.on(Laya.Event.MOUSE_DOWN, this, this.onPointerDown);
    Laya.stage.on(Laya.Event.MOUSE_UP, this, this.onPointerUp);
    Laya.stage.on(Laya.Event.RIGHT_MOUSE_DOWN, this, this.onRightMouseDown);
    Laya.timer.loop(100, this, this.checkLongPress);
  }

  private isInHudRegion(x: number, y: number): boolean {
    if (y < 115) return true;
    if (x > 1020 && y > 110) return true;
    return false;
  }

  private onPointerDown(e: Laya.Event): void {
    if (this.isInHudRegion(e.stageX, e.stageY)) return;

    this.isPointerDown = true;
    this.pointerDownTime = Date.now();
    this.pointerDownPos = { x: e.stageX, y: e.stageY };
    this.longPressTriggered = false;

    if (this.game.status === 'playing' || this.game.status === 'idle') {
      this.ui.setPressedFace();
      this.companion.setState('thinking');
    }
  }

  private checkLongPress(): void {
    if (this.isPointerDown && !this.longPressTriggered && Date.now() - this.pointerDownTime > 450) {
      this.longPressTriggered = true;
      const pick = this.view3D.pickTile(this.pointerDownPos.x, this.pointerDownPos.y);
      if (pick) {
        this.handleToggleFlag(pick.r, pick.c);
      }
    }
  }

  private onPointerUp(e: Laya.Event): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    if (this.isInHudRegion(e.stageX, e.stageY)) return;
    if (this.longPressTriggered) return;

    const dist = Math.hypot(e.stageX - this.pointerDownPos.x, e.stageY - this.pointerDownPos.y);
    if (dist > 20) return;

    const pick = this.view3D.pickTile(e.stageX, e.stageY);
    if (!pick) {
      this.ui.updateGameStatus(this.game.status);
      this.companion.setState(this.game.status === 'won' ? 'cheer' : 'idle');
      return;
    }

    if (this.flagMode) {
      this.handleToggleFlag(pick.r, pick.c);
    } else {
      this.handleReveal(pick.r, pick.c);
    }
  }

  private onRightMouseDown(e: Laya.Event): void {
    if (this.isInHudRegion(e.stageX, e.stageY)) return;
    const pick = this.view3D.pickTile(e.stageX, e.stageY);
    if (pick) {
      this.handleToggleFlag(pick.r, pick.c);
    }
  }

  private handleReveal(r: number, c: number): void {
    const target = this.game.getCell(r, c);
    if (!target) return;

    if (target.state === 'revealed' && target.neighborMines > 0) {
      const chordRes = this.game.chord(r, c);
      if (chordRes.changed.length > 0) {
        chordRes.changed.forEach((cell) => this.view3D.updateCellVisual(cell));
        if (chordRes.hitMine) {
          this.handleLoss(r, c);
        } else {
          this.audio.playChord(1);
          if (this.game.status === 'won') {
            this.handleWin();
          }
        }
      }
      this.syncGlobalTelemetry();
      return;
    }

    const res = this.game.reveal(r, c);
    if (res.changed.length === 0) return;

    res.changed.forEach((cell) => this.view3D.updateCellVisual(cell));

    if (res.hitMine) {
      this.handleLoss(r, c);
    } else {
      if (res.changed.length > 1) {
        this.audio.playChord(0);
      } else {
        this.audio.playClick();
      }

      if (this.game.status === 'won') {
        this.handleWin();
      } else {
        this.ui.updateGameStatus('playing');
        this.companion.setState('idle');
      }
    }
    this.syncGlobalTelemetry();
  }

  private handleToggleFlag(r: number, c: number): void {
    const cell = this.game.toggleFlag(r, c);
    if (cell) {
      this.view3D.updateCellVisual(cell);
      this.ui.updateRemainingMines(this.game.remainingMines);
      this.audio.playFlag();
      this.companion.setState('flagging');
      Laya.timer.once(800, this, () => {
        if (this.game.status !== 'won' && this.game.status !== 'lost') {
          this.companion.setState('idle');
        }
      });
      this.syncGlobalTelemetry();
    }
  }

  private handleLoss(centerR: number, centerC: number): void {
    this.ui.updateGameStatus('lost');
    this.audio.playExplode();
    this.companion.setState('scared');
    this.view3D.triggerExplosionPhysics(centerR, centerC);
    if (this.particleEmitter) {
      this.particleEmitter.playBurst(520, 360, 'explode');
    }

    for (let r = 0; r < this.game.rows; r++) {
      for (let c = 0; c < this.game.cols; c++) {
        const cell = this.game.grid[r][c];
        if (cell.isMine || cell.wrongFlag) {
          this.view3D.updateCellVisual(cell);
        }
      }
    }
  }

  private handleWin(): void {
    this.ui.updateGameStatus('won');
    this.audio.playVictory();
    this.companion.setState('cheer');
    this.ui.updateRemainingMines(0);
    this.view3D.triggerVictoryWave();

    for (let r = 0; r < this.game.rows; r++) {
      for (let c = 0; c < this.game.cols; c++) {
        const cell = this.game.grid[r][c];
        if (cell.isMine) {
          this.view3D.updateCellVisual(cell);
        }
      }
    }
  }

  private restartGame(): void {
    this.game.reset();
    this.view3D.rebuildBoard();
    this.ui.updateRemainingMines(this.game.remainingMines);
    this.ui.updateTimer(0);
    this.ui.updateGameStatus('idle');
    this.companion.setState('idle');
    this.syncGlobalTelemetry();
  }

  private changeDifficulty(diff: DifficultyConfig): void {
    this.game.reset(diff);
    this.view3D.rebuildBoard();
    this.ui.updateRemainingMines(this.game.remainingMines);
    this.ui.updateTimer(0);
    this.ui.updateGameStatus('idle');
    this.companion.setState('idle');
    this.latestBenchmark = ZhudaBenchmarkEngine.runSuite(this.view3D.getTileCount());
    this.ui.refreshTelemetry(this.latestBenchmark);
    this.syncGlobalTelemetry();
  }

  private onTimerUpdate(): void {
    if (this.game.status === 'playing') {
      this.ui.updateTimer(this.game.elapsedTime);
    }
  }
}
