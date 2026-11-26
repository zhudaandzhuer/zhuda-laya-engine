// The win count-up over corridor and hero (558×742 at 7,128): WIN / BIG (≥10× bet, 1.0 s) /
// MEGA (≥50×, 1.9 s) / SUPER (≥100×, 3.1 s), counting with a quadratic ease-out from
// performance.now on Laya frames, with a setTimeout fallback 100 ms after; a click collects
// early, and it hides 250 ms after the final amount.
// From games/dungeon-spin (WinCelebrationView.ts), unchanged.

export class WinCelebrationView {
  public container: any;
  public tierLabel: any;
  public amountLabel: any;
  private isCelebrating: boolean = false;
  private finishResolver: (() => void) | null = null;
  private fallbackTimerId: any = null;

  constructor() {
    this.createCelebrationNode();
  }

  private createCelebrationNode(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'WinCelebration';
    // 嚴格對齊原版 baseline-09：完全覆蓋走廊至控制列上方 (y=128 ~ 870)，100% 遮蔽下方角色與對話卷軸
    this.container.size(558, 742);
    this.container.pos(7, 128);
    this.container.visible = false;

    // 奢華深色地城磨砂戰利品展示背景 (純色不透光底板，徹底杜絕底層角色與文字穿模)
    const cardBg = new Laya.Sprite();
    cardBg.size(558, 742);
    cardBg.graphics.drawRoundRect(0, 0, 558, 742, 16, 16, 16, 16, '#07121b', '#b4975a', 2);
    // 上下金色細裝飾線
    cardBg.graphics.drawLine(50, 240, 508, 240, '#b4975a', 1);
    cardBg.graphics.drawLine(50, 410, 508, 410, '#b4975a', 1);
    this.container.addChild(cardBg);

    // 頂部小標
    const topSub = new Laya.Label();
    topSub.text = '✦ 冒險者戰利品 · 結算演出 ✦';
    topSub.fontSize = 13;
    topSub.color = '#93c5fd';
    topSub.bold = true;
    topSub.align = 'center';
    topSub.width = 558;
    topSub.pos(0, 48);
    this.container.addChild(topSub);

    // 獎項階層文字 (BIG WIN / MEGA WIN / SUPER WIN)
    this.tierLabel = new Laya.Label();
    this.tierLabel.fontSize = 48;
    this.tierLabel.color = '#fbbf24';
    this.tierLabel.bold = true;
    this.tierLabel.align = 'center';
    this.tierLabel.width = 558;
    this.tierLabel.pos(0, 108);
    this.container.addChild(this.tierLabel);

    // 副標題
    const subLabel = new Laya.Label();
    subLabel.text = '大獎入袋';
    subLabel.fontSize = 16;
    subLabel.color = '#f5d391';
    subLabel.bold = true;
    subLabel.align = 'center';
    subLabel.width = 558;
    subLabel.pos(0, 180);
    this.container.addChild(subLabel);

    // 跳動數值文字
    this.amountLabel = new Laya.Label();
    this.amountLabel.fontSize = 64;
    this.amountLabel.color = '#fff3cd';
    this.amountLabel.bold = true;
    this.amountLabel.align = 'center';
    this.amountLabel.width = 558;
    this.amountLabel.pos(0, 280);
    this.container.addChild(this.amountLabel);

    // 收下按鈕框
    const collectBtn = new Laya.Sprite();
    collectBtn.size(220, 48);
    collectBtn.pos((558 - 220) / 2, 450);
    collectBtn.graphics.drawRoundRect(0, 0, 220, 48, 24, 24, 24, 24, '#1b3b33', '#e5d296', 2);
    const collectTxt = new Laya.Label();
    collectTxt.text = '點擊收下';
    collectTxt.fontSize = 17;
    collectTxt.color = '#fff3cd';
    collectTxt.bold = true;
    collectTxt.align = 'center';
    collectTxt.width = 220;
    collectTxt.pos(0, 13);
    collectBtn.addChild(collectTxt);
    this.container.addChild(collectBtn);

    // 點擊任意處提早收下提示
    const hint = new Laya.Label();
    hint.text = '點擊任意處可提早收下獎勵';
    hint.fontSize = 12;
    hint.color = '#94a3b8';
    hint.align = 'center';
    hint.width = 558;
    hint.pos(0, 530);
    this.container.addChild(hint);

    this.container.on('click', this, () => this.collect());
  }

  public async playWin(winAmount: number, totalBet: number): Promise<void> {
    if (winAmount <= 0) return;

    const ratio = winAmount / totalBet;
    let tierName = 'WIN';
    let duration = 800;

    if (ratio >= 100) {
      tierName = '🌟 SUPER WIN 🌟';
      duration = 3100;
    } else if (ratio >= 50) {
      tierName = '🔥 MEGA WIN 🔥';
      duration = 1900;
    } else if (ratio >= 10) {
      tierName = '🎉 BIG WIN 🎉';
      duration = 1000;
    }

    this.tierLabel.text = tierName;
    this.container.visible = true;
    this.isCelebrating = true;

    const startTime = performance.now();
    const fromAmount = 0;
    const toAmount = winAmount;

    return new Promise<void>((resolve) => {
      this.finishResolver = resolve;

      // 雙軌時鐘兜底：即便 rAF 遭背景凍結，setTimeout 亦能在預定時間完成結算
      this.fallbackTimerId = setTimeout(() => {
        this.finishEarly(toAmount);
      }, duration + 100);

      const loop = () => {
        if (!this.isCelebrating) return;
        const now = performance.now();
        const rawProgress = Math.min(1, (now - startTime) / duration);
        // 二次緩出動態曲線：Progress = 1 - (1 - t)^2
        const easeProgress = 1 - Math.pow(1 - rawProgress, 2);
        const currentAmount = Math.floor(fromAmount + (toAmount - fromAmount) * easeProgress);

        this.amountLabel.text = `+${currentAmount.toLocaleString()}`;

        if (rawProgress < 1) {
          if (typeof Laya !== 'undefined' && Laya.timer) {
            Laya.timer.frameOnce(1, this, loop);
          } else {
            requestAnimationFrame(loop);
          }
        } else {
          this.finishEarly(toAmount);
        }
      };
      loop();
    });
  }

  public collect(): void {
    if (!this.isCelebrating) return;
    this.finishEarly();
  }

  private finishEarly(finalAmount?: number): void {
    if (!this.isCelebrating) return;
    this.isCelebrating = false;
    if (this.fallbackTimerId) {
      clearTimeout(this.fallbackTimerId);
      this.fallbackTimerId = null;
    }
    if (finalAmount !== undefined) {
      this.amountLabel.text = `+${finalAmount.toLocaleString()}`;
    }
    setTimeout(() => {
      this.container.visible = false;
      if (this.finishResolver) {
        const resolve = this.finishResolver;
        this.finishResolver = null;
        resolve();
      }
    }, 250);
  }
}
