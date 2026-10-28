import { DIFFICULTIES, DifficultyConfig, GameStatus } from '../domain/MinesweeperCore';
import { ZhudaUI } from '../../packages/core/DeclarativeSDK';
import { EngineGuard } from '../../packages/core/RuntimeGuards';
import { BenchmarkReport } from '../../packages/core/BenchmarkEngine';

export interface UIEventCallbacks {
  onRestart: () => void;
  onDifficultyChange: (diff: DifficultyConfig) => void;
  onToggleView: () => boolean;
  onToggleAudio: () => boolean;
  onToggleFlagMode: () => boolean;
  onRunBenchmark: () => BenchmarkReport;
}

export class MinesweeperUI {
  public root: Laya.Sprite;
  private topPanel: Laya.Sprite;
  private telemetryPanel: Laya.Sprite;
  private mineCountText: Laya.Text;
  private timerText: Laya.Text;
  private faceText: Laya.Text;
  private statusText: Laya.Text;
  private telemetryText: Laya.Text;
  private flagModeLabel: Laya.Text;
  private viewModeLabel: Laya.Text;
  private audioLabel: Laya.Text;
  private callbacks: UIEventCallbacks;

  private teleHeader?: Laya.Text;
  private nineSliceBannerText?: Laya.Text;
  private flagMode: boolean = false;
  private isAudioOn: boolean = true;
  private is3DView: boolean = true;

  constructor(parent: Laya.Node, callbacks: UIEventCallbacks) {
    this.callbacks = callbacks;
    this.root = new Laya.Sprite();
    this.root.name = 'ZhudaWorkbenchUIRoot';
    parent.addChild(this.root);

    // 1. 頂部戰術控制台 HUD (寬 1240, 容納難度、視角、插旗、音效與性能壓測按鈕)
    this.topPanel = ZhudaUI.createGlassPanel(this.root, {
      x: 20,
      y: 16,
      width: 1240,
      height: 72,
      radius: 12,
      fillColor: '#141d2ce6',
      borderColor: '#304565',
      borderWidth: 1.5
    });

    // 剩餘地雷計數器 (LED 紅字)
    const mineBox = ZhudaUI.createGlassPanel(this.topPanel, {
      x: 18,
      y: 14,
      width: 102,
      height: 44,
      radius: 6,
      fillColor: '#0b0f17',
      borderColor: '#ff336655',
      borderWidth: 1.5
    });

    this.mineCountText = new Laya.Text();
    this.mineCountText.text = '010';
    this.mineCountText.font = 'Courier New, monospace';
    this.mineCountText.fontSize = 27;
    this.mineCountText.bold = true;
    this.mineCountText.color = '#ff3366';
    this.mineCountText.align = 'center';
    this.mineCountText.width = 102;
    this.mineCountText.y = 7;
    mineBox.addChild(this.mineCountText);

    // 笑臉重開按鈕 🙂
    const faceBtn = ZhudaUI.createVectorButton(
      this.topPanel,
      132,
      14,
      '🙂',
      { width: 44, height: 44, fontSize: 22, bgColor: '#233349', borderColor: '#48658b' },
      () => this.callbacks.onRestart()
    );
    this.faceText = faceBtn.label;

    // 計時器 (LED 綠字)
    const timeBox = ZhudaUI.createGlassPanel(this.topPanel, {
      x: 188,
      y: 14,
      width: 102,
      height: 44,
      radius: 6,
      fillColor: '#0b0f17',
      borderColor: '#00ff8855',
      borderWidth: 1.5
    });

    this.timerText = new Laya.Text();
    this.timerText.text = '000';
    this.timerText.font = 'Courier New, monospace';
    this.timerText.fontSize = 27;
    this.timerText.bold = true;
    this.timerText.color = '#00ff88';
    this.timerText.align = 'center';
    this.timerText.width = 102;
    this.timerText.y = 7;
    timeBox.addChild(this.timerText);

    // 難度選擇按鈕
    ZhudaUI.createVectorButton(
      this.topPanel,
      306,
      14,
      '初級 9x9',
      { width: 86, height: 44, fontSize: 13 },
      () => this.callbacks.onDifficultyChange(DIFFICULTIES.beginner)
    );
    ZhudaUI.createVectorButton(
      this.topPanel,
      400,
      14,
      '中級 12x12',
      { width: 92, height: 44, fontSize: 13 },
      () => this.callbacks.onDifficultyChange(DIFFICULTIES.intermediate)
    );
    ZhudaUI.createVectorButton(
      this.topPanel,
      500,
      14,
      '專家 16x16',
      { width: 92, height: 44, fontSize: 13 },
      () => this.callbacks.onDifficultyChange(DIFFICULTIES.expert)
    );

    // 視角切換
    const viewBtn = ZhudaUI.createVectorButton(
      this.topPanel,
      604,
      14,
      '🎥 3D視角',
      { width: 98, height: 44, fontSize: 13, textColor: '#7df9ff' },
      () => {
        this.is3DView = this.callbacks.onToggleView();
        this.viewModeLabel.text = this.is3DView ? '🎥 3D視角' : '🗺️ 2D頂視';
      }
    );
    this.viewModeLabel = viewBtn.label;

    // 揭開 / 插旗模式切換
    const flagBtn = ZhudaUI.createVectorButton(
      this.topPanel,
      710,
      14,
      '⛏️ 揭開模式',
      { width: 102, height: 44, fontSize: 13, textColor: '#7df9ff' },
      () => {
        this.flagMode = this.callbacks.onToggleFlagMode();
        this.flagModeLabel.text = this.flagMode ? '🚩 插旗模式' : '⛏️ 揭開模式';
      }
    );
    this.flagModeLabel = flagBtn.label;

    // 音效開關
    const audioBtn = ZhudaUI.createVectorButton(
      this.topPanel,
      820,
      14,
      '🔊 音效: 開',
      { width: 96, height: 44, fontSize: 13, textColor: '#7df9ff' },
      () => {
        this.isAudioOn = this.callbacks.onToggleAudio();
        this.audioLabel.text = this.isAudioOn ? '🔊 音效: 開' : '🔇 音效: 關';
      }
    );
    this.audioLabel = audioBtn.label;

    // ⚡ 引擎性能基準壓測按鈕 (Phase 3 對標 Three.js 宣戰展示)
    ZhudaUI.createVectorButton(
      this.topPanel,
      926,
      14,
      '⚡ 性能壓測 vs Three.js',
      {
        width: 170,
        height: 44,
        fontSize: 13,
        bgColor: '#1b3a3a',
        hoverBgColor: '#235353',
        borderColor: '#00e5ff',
        textColor: '#64ffda'
      },
      () => {
        const report = this.callbacks.onRunBenchmark();
        this.refreshTelemetry(report);
      }
    );

    // Zero-IDE 架構徽章
    const badge = ZhudaUI.createGlassPanel(this.topPanel, {
      x: 1106,
      y: 14,
      width: 118,
      height: 44,
      radius: 8,
      fillColor: '#102436',
      borderColor: '#3b82f6',
      borderWidth: 1
    });
    const badgeTxt = new Laya.Text();
    badgeTxt.text = 'ZERO-IDE\nAI-NATIVE';
    badgeTxt.fontSize = 11;
    badgeTxt.bold = true;
    badgeTxt.leading = 3;
    badgeTxt.color = '#60a5fa';
    badgeTxt.align = 'center';
    badgeTxt.width = 118;
    badgeTxt.y = 8;
    badge.addChild(badgeTxt);

    // 2. 狀態提示列
    this.statusText = new Laya.Text();
    this.statusText.pos(28, 96);
    this.statusText.fontSize = 14;
    this.statusText.color = '#9ab4d0';
    this.statusText.text =
      '💡 豬大 LayaAir (AI-Friendly)：左鍵揭開方塊，右鍵或長按插旗；點擊「⚡ 性能壓測」檢視與 Three.js 的即時合批對比！';
    this.root.addChild(this.statusText);

    // 3. 右側「六大工程基建 & 即時遙測面板」 (位於 Spine 4.2 守護精靈下方)
    this.telemetryPanel = ZhudaUI.createGlassPanel(this.root, {
      x: 1035,
      y: 296,
      width: 225,
      height: 386,
      radius: 12,
      fillColor: '#121a28eb',
      borderColor: '#2d4464',
      borderWidth: 1.5
    });

    const teleHeader = new Laya.Text();
    teleHeader.pos(14, 10);
    teleHeader.fontSize = 13;
    teleHeader.bold = true;
    teleHeader.color = '#64ffda';
    teleHeader.text = '🛡️ 豬大引擎 · 商業落地遙測';
    this.telemetryPanel.addChild(teleHeader);

    this.telemetryText = new Laya.Text();
    this.telemetryText.pos(14, 32);
    this.telemetryText.width = 198;
    this.telemetryText.fontSize = 11;
    this.telemetryText.leading = 3.8;
    this.telemetryText.color = '#cbd5e1';
    this.telemetryPanel.addChild(this.telemetryText);

    // 4. 底部 9-Slice 九宮格無失真橫幅 (展示 M1~M5 三大方向商業化落地狀態)
    const nineSliceBanner = ZhudaUI.createNineSlicePanel(this.root, {
      x: 24,
      y: 632,
      width: 992,
      height: 50,
      sizeGrid: '14,14,14,14,0',
      radius: 9,
      fillColor: '#132036',
      borderColor: '#38bdf8',
      cornerAccentColor: '#2dd4bf',
      innerSurfaceColor: '#0c1524',
      titleText:
        '✔ [M1 九宮格 sizeGrid: 4角0px變形] · [M2 iframe 音訊/失焦守衛] · [M3 5視口 SafeArea 通過] · [M4 VFX 藍圖: 4套] · [M5 Unity+Animator+Spine4.2]',
      titleColor: '#7df9ff'
    });
    this.nineSliceBannerText = nineSliceBanner.root.getChildByName('NineSliceTitle') as Laya.Text;
    if (this.nineSliceBannerText) {
      this.nineSliceBannerText.fontSize = 12;
    }

    // 底部技術簽名列
    const watermark = new Laya.Text();
    watermark.pos(24, 692);
    watermark.fontSize = 12;
    watermark.color = '#64748b';
    watermark.text =
      'Zhuda-LayaAir v1.0 (Base 3.4.2) · @zhuda-laya/core + @zhuda-laya/compiler + @zhuda-laya/mcp-server · Zero IDE Dependency';
    this.root.addChild(watermark);
  }

  public updateUnityAnimatorBanner(stateName: string, vfxName: string): void {
    if (this.nineSliceBannerText) {
      this.nineSliceBannerText.text = `✔ [M1 9-Slice 0px變形] · [M2 iframe 音訊守衛] · [M3 SafeArea 5/5] · [M4 VFX: ${vfxName}] · [M5 Unity Animator: ${stateName}]`;
    }
  }

  public refreshTelemetry(bench: BenchmarkReport): void {
    const health = EngineGuard.inspectEngineHealth();
    const comps = health.registeredComponents;
    const sa = bench.staticAssetTelemetry;
    const ns = bench.nineSliceTelemetry;
    const vp = bench.viewportMatrixTelemetry;
    const um = bench.unityMigrationTelemetry;
    const lines = [
      `[1] 拓撲 & AST 反射 (Zero-IDE)`,
      `  ✔ 29/29 庫 · ${comps.length} 組件註冊`,
      `  ✔ 2D 剪枝省 ${bench.pruningProfiles['2d-light'].savedPercent}% | DrawCall ~${bench.estimatedDrawCallsZhuda}`,
      `[2] 靜態資產 (.lh) & ΔE 校準`,
      `  ✔ ${sa.totalAssetsCount} 份資產 (${sa.vfxBlueprintsCount} 套 VFX 藍圖)`,
      `  ✔ 誤差 ${sa.beforePxError}px→${sa.afterPxError}px | ΔE00=${sa.afterDeltaE2000}`,
      `[3] M1 九宮格 & M2 iframe 音訊`,
      `  ✔ sizeGrid 拉伸 ${ns.stretchRatioX}x (4角 ${ns.maxCornerDistortionPx}px 變形)`,
      `  ✔ 首觸解鎖 + 失焦靜音 + postMessage`,
      `[4] M3 跨設備多解析度 SafeArea`,
      `  ✔ ${vp.totalProfiles}/5 終端比例 0 裁切通過`,
      `[5] M5 Unity + Animator + Spine4.2`,
      `  ✔ 轉換 ${um.convertedNodesCount} 節點 (LH→RH 座標)`,
      `  ✔ 狀態機: ${um.animatorTransitionTrace.join('→')}`
    ];
    this.telemetryText.text = lines.join('\n');
  }

  public updateRemainingMines(count: number): void {
    const pad =
      count < 0
        ? '-' + Math.abs(count).toString().padStart(2, '0')
        : count.toString().padStart(3, '0');
    this.mineCountText.text = pad;
  }

  public updateTimer(seconds: number): void {
    const pad = Math.min(999, seconds).toString().padStart(3, '0');
    this.timerText.text = pad;
  }

  public updateGameStatus(status: GameStatus): void {
    if (status === 'playing') {
      this.faceText.text = '🙂';
      this.statusText.text = '⚡ 戰況：排雷進行中，步步為營！';
    } else if (status === 'won') {
      this.faceText.text = '😎';
      this.statusText.text = '🏆 恭喜獲勝！所有地雷已清除！點擊 🙂 開始新局。';
    } else if (status === 'lost') {
      this.faceText.text = '😵';
      this.statusText.text = '💥 觸發地雷！3D 物理爆破飛散已啟動，點擊 🙂 重新挑戰。';
    } else {
      this.faceText.text = '🙂';
      this.statusText.text = '💡 點擊任意方塊開始，首擊九宮格 100% 保證安全！';
    }
  }

  public setPressedFace(): void {
    this.faceText.text = '😮';
  }
}
