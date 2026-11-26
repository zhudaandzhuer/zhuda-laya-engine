// Auto-advance settings: 10 / 25 / 50 / 100 rounds and start.
// From games/dungeon-spin (dialogs/AutoAdvanceDialog.ts), unchanged.
export class AutoAdvanceDialog {
  public container: any;
  public onConfirm: ((count: number) => void) | null = null;
  public onClose: (() => void) | null = null;
  private selectedCount: number = 10;
  private countBtns: any[] = [];

  constructor() {
    this.createDialog();
  }

  private createDialog(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'AutoAdvanceDialog';
    this.container.size(572, 1024);
    this.container.visible = false;

    // 半透明背景遮罩
    const mask = new Laya.Sprite();
    mask.graphics.drawRect(0, 0, 572, 1024, 'rgba(0, 0, 0, 0.7)');
    mask.on('click', this, () => this.hide());
    this.container.addChild(mask);

    // 彈窗本體 (440x320)
    const dialogBox = new Laya.Sprite();
    dialogBox.size(440, 320);
    dialogBox.pos((572 - 440) / 2, (1024 - 320) / 2);
    dialogBox.graphics.drawRoundRect(0, 0, 440, 320, 16, 16, 16, 16, '#0f172a', '#38bdf8', 2);
    this.container.addChild(dialogBox);

    // 標題
    const title = new Laya.Label();
    title.text = '⚙️ 自動前進探索設定';
    title.fontSize = 20;
    title.color = '#f8fafc';
    title.bold = true;
    title.pos(30, 26);
    dialogBox.addChild(title);

    const subTitle = new Laya.Label();
    subTitle.text = '請選擇連續探索局數 (可隨時中途平穩停止)：';
    subTitle.fontSize = 13;
    subTitle.color = '#94a3b8';
    subTitle.pos(30, 62);
    dialogBox.addChild(subTitle);

    // 局數選項按鈕 (10 / 25 / 50 / 100)
    const counts = [10, 25, 50, 100];
    counts.forEach((count, idx) => {
      const btn = new Laya.Sprite();
      btn.size(80, 48);
      btn.pos(30 + idx * 96, 110);
      const isCur = count === this.selectedCount;
      btn.graphics.drawRoundRect(0, 0, 80, 48, 8, 8, 8, 8, isCur ? '#0284c7' : '#1e293b', isCur ? '#38bdf8' : '#475569', 1.5);

      const txt = new Laya.Label();
      txt.text = `${count}局`;
      txt.fontSize = 16;
      txt.color = '#fff';
      txt.bold = true;
      txt.pos(22, 14);
      btn.addChild(txt);

      btn.on('click', this, () => {
        this.selectedCount = count;
        this.updateBtnStyles();
      });
      dialogBox.addChild(btn);
      this.countBtns.push({ btn, count });
    });

    // 確認啟動按鈕
    const confirmBtn = new Laya.Sprite();
    confirmBtn.size(380, 52);
    confirmBtn.pos(30, 200);
    confirmBtn.graphics.drawRoundRect(0, 0, 380, 52, 10, 10, 10, 10, '#10b981', '#34d399', 2);

    const confirmTxt = new Laya.Label();
    confirmTxt.text = '開始自動前進';
    confirmTxt.fontSize = 18;
    confirmTxt.color = '#fff';
    confirmTxt.bold = true;
    confirmTxt.pos(140, 16);
    confirmBtn.addChild(confirmTxt);

    confirmBtn.on('click', this, () => {
      this.hide();
      if (this.onConfirm) this.onConfirm(this.selectedCount);
    });
    dialogBox.addChild(confirmBtn);

    // 關閉叉號
    const closeBtn = new Laya.Label();
    closeBtn.text = '✕';
    closeBtn.fontSize = 20;
    closeBtn.color = '#94a3b8';
    closeBtn.pos(400, 22);
    closeBtn.on('click', this, () => this.hide());
    dialogBox.addChild(closeBtn);
  }

  private updateBtnStyles(): void {
    this.countBtns.forEach((b) => {
      const isCur = b.count === this.selectedCount;
      b.btn.graphics.clear();
      b.btn.graphics.drawRoundRect(0, 0, 80, 48, 8, 8, 8, 8, isCur ? '#0284c7' : '#1e293b', isCur ? '#38bdf8' : '#475569', 1.5);
    });
  }

  public selectCount(count: number): void {
    this.selectedCount = count;
    this.updateBtnStyles();
  }

  public show(defaultCount: number = 10): void {
    this.selectedCount = defaultCount;
    this.updateBtnStyles();
    this.container.visible = true;
  }

  public hide(): void {
    this.container.visible = false;
    if (this.onClose) this.onClose();
  }

  public close(): void {
    this.hide();
  }
}
