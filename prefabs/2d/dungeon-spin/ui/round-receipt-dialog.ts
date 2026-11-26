// The round receipt: the 5×3 board of the last round by symbol id, the awards and the
// main + bonus total (the board is shown only here, never over the corridor).
// From games/dungeon-spin (dialogs/RoundReceiptDialog.ts), unchanged.
export class RoundReceiptDialog {
  public container: any;
  private box: any;
  private infoLabel: any;
  private boardContainer: any;
  private awardsContainer: any;
  private totalLabel: any;

  private readonly MONSTER_NAMES = [
    '星紋劍印', '深淵古龍', '咒面樹王', '古墓石像', '南瓜術士',
    '赤帽哥布林', '洞窟蝙蝠', '骸骨斥候', '青苔史萊姆'
  ];

  constructor() {
    this.createDialog();
  }

  private createDialog(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'RoundReceiptDialog';
    this.container.size(572, 1024);
    this.container.visible = false;
    this.container.zOrder = 1000;

    // 半透明背景遮罩
    const mask = new Laya.Sprite();
    mask.graphics.drawRect(0, 0, 572, 1024, 'rgba(0, 0, 0, 0.78)');
    mask.on('click', this, () => this.hide());
    this.container.addChild(mask);

    // 彈窗本體 (500x640)
    this.box = new Laya.Sprite();
    this.box.size(500, 640);
    this.box.pos((572 - 500) / 2, (1024 - 640) / 2);
    this.box.graphics.drawRoundRect(0, 0, 500, 640, 14, 14, 14, 14, '#0d1522', '#c9a462', 1.8);
    this.container.addChild(this.box);

    // 眉標
    const eyebrow = new Laya.Label();
    eyebrow.text = 'ROUND RECEIPT';
    eyebrow.fontSize = 12;
    eyebrow.color = '#c9a462';
    eyebrow.bold = true;
    eyebrow.pos(28, 20);
    this.box.addChild(eyebrow);

    // 主標題
    const title = new Laya.Label();
    title.text = '原盤面與戰利品明細';
    title.fontSize = 20;
    title.color = '#f1f5f9';
    title.bold = true;
    title.pos(28, 38);
    this.box.addChild(title);

    // 關閉按鈕
    const closeBtn = new Laya.Label();
    closeBtn.text = '✕';
    closeBtn.fontSize = 20;
    closeBtn.color = '#94a3b8';
    closeBtn.bold = true;
    closeBtn.pos(456, 20);
    closeBtn.on('click', this, () => this.hide());
    this.box.addChild(closeBtn);

    // 局況與下注資訊
    this.infoLabel = new Laya.Label();
    this.infoLabel.text = '尚無前進紀錄，請先探索一局。';
    this.infoLabel.fontSize = 12;
    this.infoLabel.color = '#94a3b8';
    this.infoLabel.pos(28, 74);
    this.box.addChild(this.infoLabel);

    // 15 格幾何盤面容器 (5 欄 × 3 列)
    this.boardContainer = new Laya.Sprite();
    this.boardContainer.pos(24, 104);
    this.box.addChild(this.boardContainer);

    // 獎項明細清單容器
    this.awardsContainer = new Laya.Sprite();
    this.awardsContainer.pos(28, 330);
    this.box.addChild(this.awardsContainer);

    // 底部總計文字
    this.totalLabel = new Laya.Label();
    this.totalLabel.text = '';
    this.totalLabel.fontSize = 15;
    this.totalLabel.color = '#ffe386';
    this.totalLabel.bold = true;
    this.totalLabel.pos(28, 590);
    this.box.addChild(this.totalLabel);

    // 預設渲染空盤
    this.renderEmptyBoard();
  }

  private renderEmptyBoard(): void {
    this.boardContainer.graphics.clear();
    const cellW = 86;
    const cellH = 64;
    const gap = 5;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const x = c * (cellW + gap);
        const y = r * (cellH + gap);
        this.boardContainer.graphics.drawRoundRect(x, y, cellW, cellH, 6, 6, 6, 6, '#131e2d', '#1e293b', 1);
      }
    }
  }

  /**
   * 根據回合快照刷新 15 格盤面與獎項收據
   */
  public updateReceipt(round: any): void {
    if (!round || !round.p) return;

    const p = round.p || {};
    const b = round.b || {};
    const totalBet = round.bet ?? p.totalBet ?? 90;
    const singleBet = p.singleBet ?? Math.max(1, Math.floor(totalBet / 9));
    this.infoLabel.text = `單注 ${singleBet} × 9 ＝ 總投注 ${totalBet} · 原符號 ID (每軸由上至下)`;

    // 收集所有中獎格子的 index (0~14)
    const winningIndices = new Set<number>();
    if (p.awards && Array.isArray(p.awards)) {
      p.awards.forEach((award: any) => {
        if (award.path && Array.isArray(award.path)) {
          award.path.forEach((idx: number) => winningIndices.add(idx));
        }
      });
    }

    // 重繪 15 格盤面
    this.boardContainer.graphics.clear();
    this.boardContainer.removeChildren();

    const cellW = 86;
    const cellH = 64;
    const gap = 5;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        const sym = p.board ? p.board[idx] : 0;
        const isHit = winningIndices.has(idx);
        const x = c * (cellW + gap);
        const y = r * (cellH + gap);

        const bgColor = isHit ? 'rgba(234, 179, 8, 0.22)' : '#131e2d';
        const borderColor = isHit ? '#fbbf24' : '#223247';
        const borderWidth = isHit ? 2 : 1;
        this.boardContainer.graphics.drawRoundRect(x, y, cellW, cellH, 6, 6, 6, 6, bgColor, borderColor, borderWidth);

        // 格內文字：符號 ID 與簡稱
        const label = new Laya.Label();
        label.text = `${sym} · ${this.MONSTER_NAMES[sym]?.slice(0, 3) || '未知'}`;
        label.fontSize = 11;
        label.color = isHit ? '#fef08a' : '#cbd5e1';
        label.align = 'center';
        label.width = cellW;
        label.pos(x, y + 24);
        this.boardContainer.addChild(label);
      }
    }

    // 重繪獎項清單 (最多顯示 5 筆)
    this.awardsContainer.removeChildren();
    this.awardsContainer.graphics.clear();

    const header = new Laya.Label();
    header.text = '獎項清單                   對應符號                   金額';
    header.fontSize = 12;
    header.color = '#94a3b8';
    header.pos(0, 0);
    this.awardsContainer.addChild(header);

    // 分隔線
    this.awardsContainer.graphics.drawLine(0, 22, 444, 22, '#1e293b', 1);

    let startY = 30;
    if (p.awards && p.awards.length > 0) {
      p.awards.slice(0, 6).forEach((award: any, i: number) => {
        const itemY = startY + i * 26;
        let lineText = award.label || '特殊盤面獎';
        if (award.kind === 'line' && !award.label) {
          const lNum = (award.lineIndex ?? award.line ?? 0) + 1;
          lineText = `線 ${lNum} · ${award.count || 3}連`;
        }
        const symText = award.symbol !== null && award.symbol !== undefined ? `${award.symbol} · ${this.MONSTER_NAMES[award.symbol] || '怪'}` : '全盤獎勵';
        const amountText = `+${(award.amount || 0).toLocaleString()}`;

        const rowLabel = new Laya.Label();
        rowLabel.text = `${lineText.padEnd(20, ' ')}  ${symText.padEnd(16, ' ')}  ${amountText}`;
        rowLabel.fontSize = 12;
        rowLabel.color = '#38bdf8';
        rowLabel.pos(0, itemY);
        this.awardsContainer.addChild(rowLabel);
      });
    } else {
      const emptyLabel = new Laya.Label();
      emptyLabel.text = '本局未達成有效連線 (未獲戰利品)';
      emptyLabel.fontSize = 13;
      emptyLabel.color = '#64748b';
      emptyLabel.pos(0, startY + 10);
      this.awardsContainer.addChild(emptyLabel);
    }

    // 總結算
    const mainWin = p.mainWin ?? p.totalWin ?? round.win ?? 0;
    const bonusWin = b?.total ?? 0;
    const totalWin = mainWin + bonusWin;
    this.totalLabel.text = `主局 ${mainWin.toLocaleString()} ＋ Bonus ${bonusWin.toLocaleString()} ＝ 總戰利品 ${totalWin.toLocaleString()} 點`;
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
