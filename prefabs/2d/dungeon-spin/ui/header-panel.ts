// The top bar (572×128): player label, balance in the coin slot of template-v2.png, the
// scene title / round number over the corridor, a sound button and the hamburger menu.
// From games/dungeon-spin (HeaderPanel.ts), unchanged.
export class HeaderPanel {
  public container: any;
  public balanceLabel: any;
  public seqLabel: any;
  public soundBtn: any;
  public soundIcon: any;
  public onSoundToggle: (() => void) | null = null;
  public onHelpClick: (() => void) | null = null;

  constructor() {
    this.createHeader();
  }

  private createHeader(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'HeaderPanel';
    this.container.size(572, 128);
    this.container.pos(0, 0);

    // 1. 玩家 ID 小標籤
    const idLabel = new Laya.Label();
    idLabel.text = 'ID: pongo · 試玩餘額';
    idLabel.fontSize = 11;
    idLabel.color = '#eee2c3';
    idLabel.pos(28, 48);
    this.container.addChild(idLabel);

    // 2. 點數餘額 (精確對齊 template-v2.png 左上金幣槽位)
    this.balanceLabel = new Laya.Label();
    this.balanceLabel.text = '100,000';
    this.balanceLabel.fontSize = 20;
    this.balanceLabel.color = '#ffe3a3';
    this.balanceLabel.bold = true;
    this.balanceLabel.align = 'center';
    this.balanceLabel.width = 135;
    this.balanceLabel.pos(50, 78);
    this.container.addChild(this.balanceLabel);

    // 3. 場景與局序標籤 (位於地城走廊左上方，對齊原版 THE FORGOTTEN HALL 佈局，不破壞頂部寶石金框)
    this.seqLabel = new Laya.Label();
    this.seqLabel.text = 'THE FORGOTTEN HALL';
    this.seqLabel.fontSize = 11;
    this.seqLabel.color = '#94a3b8';
    this.seqLabel.align = 'left';
    this.seqLabel.pos(28, 138);
    this.container.addChild(this.seqLabel);

    // 4. 音效開關按鈕 (圓形小按鈕，位於右上選單左側)
    this.soundBtn = new Laya.Sprite();
    this.soundBtn.size(38, 38);
    this.soundBtn.pos(430, 42);
    this.soundBtn.graphics.drawCircle(19, 19, 18, 'rgba(15, 34, 46, 0.85)', '#476579', 1.5);
    this.soundIcon = new Laya.Label();
    this.soundIcon.text = '🔊';
    this.soundIcon.fontSize = 18;
    this.soundIcon.pos(8, 7);
    this.soundBtn.addChild(this.soundIcon);
    this.soundBtn.on('click', this, () => this.onSoundToggle?.());
    this.container.addChild(this.soundBtn);

    // 5. 右上角選單/說明按鈕 (精確覆蓋 template-v2.png 右上藍色漢堡鍵)
    const menuBtn = new Laya.Sprite();
    menuBtn.size(68, 68);
    menuBtn.pos(486, 26);
    menuBtn.graphics.drawRoundRect(0, 0, 68, 68, 8, 8, 8, 8, 'rgba(0, 0, 0, 0.01)', 'rgba(255, 255, 255, 0.01)', 1);
    menuBtn.on('click', this, () => this.onHelpClick?.());
    this.container.addChild(menuBtn);
  }

  public updateBalance(points: number): void {
    if (this.balanceLabel) {
      this.balanceLabel.text = points.toLocaleString();
    }
  }

  public updateSequence(seq: number): void {
    if (this.seqLabel) {
      this.seqLabel.text = seq > 0 ? `THE FORGOTTEN HALL · 回合 #${seq}` : 'THE FORGOTTEN HALL';
    }
  }

  public setSceneTitle(title: string): void {
    if (this.seqLabel) {
      this.seqLabel.text = title;
    }
  }
}
