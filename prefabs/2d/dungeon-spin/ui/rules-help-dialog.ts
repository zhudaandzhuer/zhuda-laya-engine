// The rules and paytable text (冒險者指南).
// From games/dungeon-spin (dialogs/RulesHelpDialog.ts), unchanged.
export class RulesHelpDialog {
  public container: any;

  constructor() {
    this.createDialog();
  }

  private createDialog(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'RulesHelpDialog';
    this.container.size(572, 1024);
    this.container.visible = false;

    // 半透明背景遮罩
    const mask = new Laya.Sprite();
    mask.graphics.drawRect(0, 0, 572, 1024, 'rgba(0, 0, 0, 0.7)');
    mask.on('click', this, () => this.hide());
    this.container.addChild(mask);

    // 彈窗本體 (500x640)
    const box = new Laya.Sprite();
    box.size(500, 640);
    box.pos((572 - 500) / 2, (1024 - 640) / 2);
    box.graphics.drawRoundRect(0, 0, 500, 640, 16, 16, 16, 16, '#0f172a', '#38bdf8', 2);
    this.container.addChild(box);

    const title = new Laya.Label();
    title.text = '📖 迷宮一閃 · 冒險者指南與連線賠率';
    title.fontSize = 20;
    title.color = '#ffd700';
    title.bold = true;
    title.pos(30, 24);
    box.addChild(title);

    const content = new Laya.Label();
    content.text = `
【核心玩法機制】
1. 探索盤面：3 列 × 5 欄共 15 格地城魔物，支援 18 條雙向有效連線（左右雙向皆可達成）。
2. 主角劍術：依據連線數觸發迅劍 (3連)、蒼刃劍氣 (4連)、拔刀一閃 (5連)、萬刃橫掃 (多線並發) 與領域斬 (全盤)。
3. Boss 巨袋封印：盤面出現星紋印記時遭遇巨袋怪！獲得 1~27 次追擊出刀機會。
   - 單枚命中：依據印記倍率獲得獎金。
   - 四印全同：觸發大暴擊！翡翠印全同給予 500 倍巨額賞金！
   - 護袋撤退：唯一會扣除追擊機會之符號；其餘 8 款印記未命中亦不扣除出刀次數！

【主要魔物最高連線倍率】
• 深淵霸主 (ID 8)：5連 1,000 倍 / 全盤特別獎
• 遠古魔偶 (ID 7)：5連 400 倍 / 全盤 1,000 倍
• 水晶星靈 (ID 0)：星紋萬能符號，5連開門 + 巨袋追擊機會！

【操作說明】
• 短按前進：單局前進開局
• 長按前進 (>350ms)：呼出自動前進局數設定
• 演出中點擊：即刻加速跳過前搖與結算
• 大獎慶祝中點擊：提早收下獎勵點數
    `;
    content.fontSize = 13;
    content.color = '#cbd5e1';
    content.leading = 6;
    content.width = 440;
    content.pos(30, 65);
    box.addChild(content);

    // 關閉叉號
    const closeBtn = new Laya.Label();
    closeBtn.text = '✕';
    closeBtn.fontSize = 22;
    closeBtn.color = '#94a3b8';
    closeBtn.pos(456, 18);
    closeBtn.on('click', this, () => this.hide());
    box.addChild(closeBtn);
  }

  public show(): void {
    this.container.visible = true;
  }

  public hide(): void {
    this.container.visible = false;
  }

  public close(): void {
    this.hide();
  }
}
