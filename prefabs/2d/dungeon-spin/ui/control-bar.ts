// The bottom bar (572×174 at 0,850), over the buttons painted in template-v2.png: total bet
// with − / + (and a tap on the box cycles 10 → 20 → 50), the round's win, the auto ball,
// the burst toggle (疾行) and the big advance ball whose label follows the runtime's
// primary action; holding it 360 ms opens the auto settings.
// From games/dungeon-spin (ControlBar.ts); only the import changed.
import type { PrimaryAction } from '../../../systems/slot-round/contracts.ts';

export class ControlBar {
  public container: any;
  public advanceBtn: any;
  public advanceBtnLabel: any;
  public advanceSubLabel: any;
  public totalBetLabel: any;
  public winLabel: any;
  public winAmountLabel: any;
  public winStatusLabel: any;
  public autoCountLabel: any;
  public skipBtn: any;
  public skipLabel: any;

  public currentSingleBet: 10 | 20 | 50 = 10;
  public currentAction: PrimaryAction = 'advance';
  public isBurst: boolean = false;

  public onAdvanceClick: (() => void) | null = null;
  public onLongPress: (() => void) | null = null;
  public onBetChange: ((bet: 10 | 20 | 50) => void) | null = null;
  public onBurstToggle: ((burst: boolean) => void) | null = null;

  private pressTimer: any = null;
  private isLongPressTriggered: boolean = false;

  constructor() {
    this.createControlBar();
  }

  private createControlBar(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'ControlBar';
    this.container.size(572, 174);
    // 在 572x1024 畫布底部 y=850 處
    this.container.pos(0, 850);

    // 1. 左側注額顯示 (精確對齊 template-v2.png 黑底圓角注額框：y=62~93，中心置中 y=77.5)
    this.totalBetLabel = new Laya.Label();
    this.totalBetLabel.text = '總投注 90';
    this.totalBetLabel.fontSize = 18;
    this.totalBetLabel.color = '#fff2d3';
    this.totalBetLabel.bold = true;
    this.totalBetLabel.align = 'center';
    this.totalBetLabel.valign = 'middle';
    this.totalBetLabel.width = 176;
    this.totalBetLabel.height = 24;
    this.totalBetLabel.pos(18, 76);
    this.container.addChild(this.totalBetLabel);

    // 注額框整體點擊切換 (循環切換 10 -> 20 -> 50 -> 10)
    const betBoxTouch = new Laya.Sprite();
    betBoxTouch.size(196, 44);
    betBoxTouch.pos(12, 60);
    betBoxTouch.graphics.drawRoundRect(0, 0, 196, 44, 8, 8, 8, 8, 'rgba(0,0,0,0.01)', 'rgba(0,0,0,0.01)', 1);
    betBoxTouch.on('click', this, () => this.stepBet(1, true));
    this.container.addChild(betBoxTouch);

    // [-] 步進按鈕 (降注：50 -> 20 -> 10)
    const betDownBtn = new Laya.Sprite();
    betDownBtn.size(50, 48);
    betDownBtn.pos(17, 108);
    betDownBtn.graphics.drawRoundRect(0, 0, 50, 48, 6, 6, 6, 6, 'rgba(0,0,0,0.01)', 'rgba(255,255,255,0.01)', 1);
    betDownBtn.on('click', this, () => this.stepBet(-1));
    this.container.addChild(betDownBtn);

    // 中間金字 BET 標籤 (精確居中於金色 BET 按鈕：y=106~145，中心 y=125.5)
    const betCaption = new Laya.Label();
    betCaption.text = 'BET';
    betCaption.fontSize = 24;
    betCaption.bold = true;
    betCaption.color = '#f4da90';
    betCaption.align = 'center';
    betCaption.valign = 'middle';
    betCaption.width = 75;
    betCaption.height = 26;
    betCaption.pos(68, 122);
    this.container.addChild(betCaption);

    // [+] 步進按鈕 (加注：10 -> 20 -> 50)
    const betUpBtn = new Laya.Sprite();
    betUpBtn.size(50, 48);
    betUpBtn.pos(144, 108);
    betUpBtn.graphics.drawRoundRect(0, 0, 50, 48, 6, 6, 6, 6, 'rgba(0,0,0,0.01)', 'rgba(255,255,255,0.01)', 1);
    betUpBtn.on('click', this, () => this.stepBet(1));
    this.container.addChild(betUpBtn);

    // 2. 中央戰果展示面板 (精確對齊 template-v2.png 中央戰果金色緞帶 y=48~70 與紅黑底框)
    this.winLabel = new Laya.Label();
    this.winLabel.text = '本局戰果';
    this.winLabel.fontSize = 12;
    this.winLabel.color = '#f5d391';
    this.winLabel.bold = true;
    this.winLabel.align = 'center';
    this.winLabel.valign = 'middle';
    this.winLabel.width = 144;
    this.winLabel.height = 18;
    this.winLabel.pos(213, 54);
    this.container.addChild(this.winLabel);

    this.winAmountLabel = new Laya.Label();
    this.winAmountLabel.text = '—';
    this.winAmountLabel.fontSize = 26;
    this.winAmountLabel.color = '#fff0c0';
    this.winAmountLabel.bold = true;
    this.winAmountLabel.align = 'center';
    this.winAmountLabel.valign = 'middle';
    this.winAmountLabel.width = 144;
    this.winAmountLabel.height = 32;
    this.winAmountLabel.pos(213, 84);
    this.container.addChild(this.winAmountLabel);

    this.winStatusLabel = new Laya.Label();
    this.winStatusLabel.text = '準備出發';
    this.winStatusLabel.fontSize = 11;
    this.winStatusLabel.color = '#ffe5ad';
    this.winStatusLabel.align = 'center';
    this.winStatusLabel.width = 144;
    this.winStatusLabel.pos(213, 126);
    this.container.addChild(this.winStatusLabel);

    // 3. 自動前進按鈕 (精確對齊 template-v2.png 綠色圓球槽位：center=(402, 52))
    const autoBtn = new Laya.Sprite();
    autoBtn.size(52, 52);
    autoBtn.pos(376, 28);
    autoBtn.graphics.drawCircle(26, 26, 25, 'rgba(0,0,0,0.01)', 'rgba(255,255,255,0.01)', 1);

    const autoTitle = new Laya.Label();
    autoTitle.text = '自動';
    autoTitle.fontSize = 11;
    autoTitle.color = '#dcfce7';
    autoTitle.bold = true;
    autoTitle.stroke = 1;
    autoTitle.strokeColor = '#064e3b';
    autoTitle.align = 'center';
    autoTitle.width = 52;
    autoTitle.pos(0, 10);
    autoBtn.addChild(autoTitle);

    this.autoCountLabel = new Laya.Label();
    this.autoCountLabel.text = '0';
    this.autoCountLabel.fontSize = 18;
    this.autoCountLabel.color = '#86efac';
    this.autoCountLabel.bold = true;
    this.autoCountLabel.stroke = 1;
    this.autoCountLabel.strokeColor = '#064e3b';
    this.autoCountLabel.align = 'center';
    this.autoCountLabel.width = 52;
    this.autoCountLabel.pos(0, 24);
    autoBtn.addChild(this.autoCountLabel);

    autoBtn.on('click', this, () => {
      this.onLongPress?.();
    });
    this.container.addChild(autoBtn);

    // 4. 疾行開關按鈕 (精確對齊 template-v2.png 藍色圓鈕槽位：center=(406, 120))
    this.skipBtn = new Laya.Sprite();
    this.skipBtn.size(52, 52);
    this.skipBtn.pos(380, 94);
    this.skipBtn.graphics.drawCircle(26, 26, 25, 'rgba(0,0,0,0.01)', 'rgba(255,255,255,0.01)', 1);

    this.skipLabel = new Laya.Label();
    this.skipLabel.text = '疾行\n關';
    this.skipLabel.fontSize = 11;
    this.skipLabel.color = '#ffffff';
    this.skipLabel.bold = true;
    this.skipLabel.stroke = 1.5;
    this.skipLabel.strokeColor = '#0d2238';
    this.skipLabel.align = 'center';
    this.skipLabel.leading = 2;
    this.skipLabel.width = 52;
    this.skipLabel.pos(0, 10);
    this.skipBtn.addChild(this.skipLabel);

    this.skipBtn.on('click', this, () => {
      this.isBurst = !this.isBurst;
      this.skipLabel.text = this.isBurst ? '疾行\n開' : '疾行\n關';
      this.skipLabel.color = this.isBurst ? '#fbbf24' : '#ffffff';
      this.onBurstToggle?.(this.isBurst);
    });
    this.container.addChild(this.skipBtn);

    // 5. 核心前進大光球 (精確對齊 template-v2.png 右下巨型藍色發光寶球：center=(490, 74))
    this.advanceBtn = new Laya.Sprite();
    this.advanceBtn.size(116, 116);
    this.advanceBtn.pos(432, 16);
    // 圓形可點擊區域
    this.advanceBtn.graphics.drawCircle(58, 58, 56, 'rgba(0,0,0,0.01)', 'rgba(255,255,255,0.01)', 1);

    this.advanceBtnLabel = new Laya.Label();
    this.advanceBtnLabel.text = '前進';
    this.advanceBtnLabel.fontSize = 38;
    this.advanceBtnLabel.color = '#fffef2';
    this.advanceBtnLabel.bold = true;
    this.advanceBtnLabel.stroke = 3;
    this.advanceBtnLabel.strokeColor = '#0c2b3d';
    this.advanceBtnLabel.align = 'center';
    this.advanceBtnLabel.width = 116;
    this.advanceBtnLabel.pos(0, 36);
    this.advanceBtn.addChild(this.advanceBtnLabel);

    this.advanceSubLabel = new Laya.Label();
    this.advanceSubLabel.text = 'A D V A N C E';
    this.advanceSubLabel.fontSize = 11;
    this.advanceSubLabel.color = '#ffffff';
    this.advanceSubLabel.bold = true;
    this.advanceSubLabel.stroke = 1.5;
    this.advanceSubLabel.strokeColor = '#081e2b';
    this.advanceSubLabel.align = 'center';
    this.advanceSubLabel.width = 116;
    this.advanceSubLabel.pos(0, 80);
    this.advanceBtn.addChild(this.advanceSubLabel);

    this.setupAdvanceGestures();
    this.container.addChild(this.advanceBtn);
  }

  public stepBet(direction: number, loop: boolean = false): void {
    const list: (10 | 20 | 50)[] = [10, 20, 50];
    const curIdx = list.indexOf(this.currentSingleBet);
    let nextIdx = curIdx + direction;
    if (loop) {
      if (nextIdx > 2) nextIdx = 0;
      if (nextIdx < 0) nextIdx = 2;
    } else {
      if (nextIdx < 0) nextIdx = 0;
      if (nextIdx > 2) nextIdx = 2;
    }
    const nextBet = list[nextIdx];
    if (nextBet !== this.currentSingleBet) {
      this.currentSingleBet = nextBet;
      const total = nextBet * 9;
      this.totalBetLabel.text = `總投注 ${total}`;
      this.onBetChange?.(nextBet);
    }
  }

  private setupAdvanceGestures(): void {
    this.advanceBtn.on('mousedown', this, () => {
      this.isLongPressTriggered = false;
      this.advanceBtn.scale(0.95, 0.95);
      if (this.currentAction === 'advance') {
        this.pressTimer = setTimeout(() => {
          this.isLongPressTriggered = true;
          this.onLongPress?.();
        }, 360);
      }
    });

    const onRelease = () => {
      this.advanceBtn.scale(1.0, 1.0);
      if (this.pressTimer) {
        clearTimeout(this.pressTimer);
        this.pressTimer = null;
      }
    };

    this.advanceBtn.on('mouseup', this, () => {
      onRelease();
      if (!this.isLongPressTriggered) {
        this.onAdvanceClick?.();
      }
    });

    this.advanceBtn.on('mouseout', this, () => {
      onRelease();
    });
  }

  public updateAction(action: PrimaryAction): void {
    this.currentAction = action;
    switch (action) {
      case 'stop':
        this.advanceBtnLabel.text = '停止';
        this.advanceSubLabel.text = 'STOP';
        this.advanceBtnLabel.color = '#f87171';
        break;
      case 'collect-next':
        this.advanceBtnLabel.text = '收下';
        this.advanceSubLabel.text = 'COLLECT';
        this.advanceBtnLabel.color = '#facc15';
        break;
      case 'accelerate':
        this.advanceBtnLabel.text = '加速';
        this.advanceSubLabel.text = 'FAST';
        this.advanceBtnLabel.color = '#38bdf8';
        break;
      case 'wait':
        this.advanceBtnLabel.text = '···';
        this.advanceSubLabel.text = 'WAIT';
        this.advanceBtnLabel.color = '#94a3b8';
        break;
      default:
        this.advanceBtnLabel.text = '前進';
        this.advanceSubLabel.text = 'A D V A N C E';
        this.advanceBtnLabel.color = '#fffef2';
        break;
    }
  }

  public updateWinDisplay(win: number, statusText: string = '已結算'): void {
    this.winAmountLabel.text = win > 0 ? `+${win.toLocaleString()}` : '—';
    this.winStatusLabel.text = statusText;
  }

  public setRibbonTitle(title: string): void {
    if (this.winLabel) {
      this.winLabel.text = title;
    }
  }

  public updateAutoCount(count: number): void {
    this.autoCountLabel.text = `${count}`;
  }
}
