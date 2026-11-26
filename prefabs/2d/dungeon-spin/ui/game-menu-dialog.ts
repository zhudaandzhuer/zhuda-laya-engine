// The adventurer menu: receipt, guide, auto settings, sound, reset the play money.
// From games/dungeon-spin (dialogs/GameMenuDialog.ts), unchanged.
export class GameMenuDialog {
  public container: any;
  public onOpenReceipt: (() => void) | null = null;
  public onOpenHelp: (() => void) | null = null;
  public onOpenAuto: (() => void) | null = null;
  public onToggleSound: (() => void) | null = null;
  public onResetSave: (() => void) | null = null;

  private soundLabel: any;

  constructor() {
    this.createDialog();
  }

  private createDialog(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'GameMenuDialog';
    this.container.size(572, 1024);
    this.container.visible = false;
    this.container.zOrder = 999;

    // 半透明背景遮罩
    const mask = new Laya.Sprite();
    mask.graphics.drawRect(0, 0, 572, 1024, 'rgba(0, 0, 0, 0.78)');
    mask.on('click', this, () => this.hide());
    this.container.addChild(mask);

    // 彈窗本體 (480x520)
    const box = new Laya.Sprite();
    box.size(480, 520);
    box.pos((572 - 480) / 2, (1024 - 520) / 2);
    box.graphics.drawRoundRect(0, 0, 480, 520, 14, 14, 14, 14, '#0d1522', '#c9a462', 1.8);
    this.container.addChild(box);

    // 眉標
    const eyebrow = new Laya.Label();
    eyebrow.text = 'DUNGEON SPIN';
    eyebrow.fontSize = 12;
    eyebrow.color = '#c9a462';
    eyebrow.bold = true;
    eyebrow.pos(32, 22);
    box.addChild(eyebrow);

    // 主標題
    const title = new Laya.Label();
    title.text = '冒險者選單';
    title.fontSize = 22;
    title.color = '#f1f5f9';
    title.bold = true;
    title.pos(32, 42);
    box.addChild(title);

    // 關閉叉號
    const closeBtn = new Laya.Label();
    closeBtn.text = '✕';
    closeBtn.fontSize = 20;
    closeBtn.color = '#94a3b8';
    closeBtn.bold = true;
    closeBtn.pos(436, 22);
    closeBtn.on('click', this, () => this.hide());
    box.addChild(closeBtn);

    // 按鈕群組 (縱向排列，間距充足)
    const btnData = [
      {
        icon: '📋',
        title: '戰果明細',
        desc: '查看當前局 15 格幾何盤面與連線獲獎清冊',
        action: () => { this.hide(); this.onOpenReceipt?.(); }
      },
      {
        icon: '📖',
        title: '冒險者指南',
        desc: '查看地城規則、9 大印記與斬袋倍率手冊',
        action: () => { this.hide(); this.onOpenHelp?.(); }
      },
      {
        icon: '⚙️',
        title: '自動前進設定',
        desc: '設定 10 / 25 / 50 / 100 局自動前進',
        action: () => { this.hide(); this.onOpenAuto?.(); }
      },
      {
        icon: '🔊',
        title: '音效開關切換',
        desc: '開啟或關閉步伐、揮劍與金幣碰撞音效',
        action: () => { this.onToggleSound?.(); }
      },
      {
        icon: '↺',
        title: '重設試玩點數',
        desc: '清除本機紀錄，餘額重設為 100,000 點',
        action: () => { this.onResetSave?.(); }
      }
    ];

    let startY = 96;
    btnData.forEach((item, idx) => {
      const btn = new Laya.Sprite();
      btn.size(416, 68);
      btn.pos(32, startY + idx * 78);
      btn.graphics.drawRoundRect(0, 0, 416, 68, 10, 10, 10, 10, '#131e2d', '#223247', 1.2);

      const iconLabel = new Laya.Label();
      iconLabel.text = item.icon;
      iconLabel.fontSize = 24;
      iconLabel.pos(18, 20);
      btn.addChild(iconLabel);

      const titleLabel = new Laya.Label();
      titleLabel.text = item.title;
      titleLabel.fontSize = 16;
      titleLabel.color = '#38bdf8';
      titleLabel.bold = true;
      titleLabel.pos(58, 14);
      btn.addChild(titleLabel);

      const descLabel = new Laya.Label();
      descLabel.text = item.desc;
      descLabel.fontSize = 11;
      descLabel.color = '#94a3b8';
      descLabel.pos(58, 38);
      btn.addChild(descLabel);

      if (idx === 3) {
        this.soundLabel = titleLabel;
      }

      btn.on('click', this, item.action);
      box.addChild(btn);
    });
  }

  public setSoundState(enabled: boolean): void {
    if (this.soundLabel) {
      this.soundLabel.text = enabled ? '音效開關 (目前：開啟 🔊)' : '音效開關 (目前：靜音 🔇)';
    }
  }

  public show(): void {
    if (this.container) this.container.visible = true;
  }

  public hide(): void {
    if (this.container) this.container.visible = false;
  }

  public close(): void {
    this.hide();
  }
}
