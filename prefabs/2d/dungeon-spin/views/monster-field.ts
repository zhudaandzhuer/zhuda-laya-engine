// The corridor window (558×453 at 7,128): idle is empty (the painted corridor of the
// template shows); no award: one monster flees into the dark; awards: one to five monsters
// stand with their amount badges; the hero's strike shakes them, bursts coins and fades
// them. Monsters are cells of creatures-v3.png (5×2 grid). The hidden 15-cell board layer
// (updateBoard / highlightAward) is kept from the original for its API.
// From games/dungeon-spin (MonsterFieldView.ts). Changes: the atlas cell comes from
// 2d/prefab-atlas (same arithmetic); no parameter property.
import { gridCell } from '../../prefab-atlas/prefab-atlas.ts';

export class MonsterFieldView {
  public container: any;
  public encounterLayer: any;
  public boardLayer: any;
  public cells: any[] = [];
  public awardBadges: any[] = [];
  private cols: number = 5;
  private rows: number = 3;
  private cellWidth: number = 96;
  private cellHeight: number = 96;
  private gapX: number = 14;
  private gapY: number = 12;

  private atlasCols: number = 5;
  private atlasRows: number = 2;

  private readonly MONSTER_NAMES = [
    '星紋劍印', '深淵古龍', '咒面樹王', '古墓石像', '南瓜術士',
    '赤帽哥布林', '洞窟蝙蝠', '骸骨斥候', '青苔史萊姆'
  ];

  private activeEnemies: any[] = [];
  private readonly atlasTexture?: Laya.Texture;

  constructor(atlasTexture?: Laya.Texture) {
    this.atlasTexture = atlasTexture;
    this.createField();
  }

  private createField(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'MonsterField';
    this.container.size(558, 453);
    this.container.pos(7, 128); // 上半部石廊窗口視口區間

    // 1. 動態遭遇層 (預設主要舞台)
    this.encounterLayer = new Laya.Sprite();
    this.encounterLayer.name = 'EncounterLayer';
    this.encounterLayer.size(558, 453);
    this.container.addChild(this.encounterLayer);

    // 2. 15 格傳統盤面層 (預設隱藏，維持 API 相容性)
    this.boardLayer = new Laya.Sprite();
    this.boardLayer.name = 'BoardLayer';
    this.boardLayer.visible = false;
    this.container.addChild(this.boardLayer);

    const totalW = this.cols * this.cellWidth + (this.cols - 1) * this.gapX; // 526px
    const totalH = this.rows * this.cellHeight + (this.rows - 1) * this.gapY; // 312px
    const startX = Math.floor((558 - totalW) / 2); // 16px
    const startY = Math.floor((453 - totalH) / 2) + 10; // 80px
    this.boardLayer.pos(startX, startY);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = new Laya.Sprite();
        cell.size(this.cellWidth, this.cellHeight);
        cell.pos(c * (this.cellWidth + this.gapX), r * (this.cellHeight + this.gapY));
        cell.graphics.drawRoundRect(0, 0, this.cellWidth, this.cellHeight, 8, 8, 8, 8, 'rgba(10, 24, 28, 0.75)', '#243a42', 1.5);

        const icon = new Laya.Sprite();
        icon.size(82, 82);
        icon.pos(7, 7);
        cell.addChild(icon);

        const moneyLabel = new Laya.Label();
        moneyLabel.fontSize = 15;
        moneyLabel.color = '#ffe386';
        moneyLabel.bold = true;
        moneyLabel.align = 'center';
        moneyLabel.width = this.cellWidth;
        moneyLabel.pos(0, -18);
        moneyLabel.visible = false;
        cell.addChild(moneyLabel);

        const nameLabel = new Laya.Label();
        nameLabel.fontSize = 11;
        nameLabel.color = '#94b3ba';
        nameLabel.align = 'center';
        nameLabel.width = this.cellWidth;
        nameLabel.pos(0, this.cellHeight - 16);
        nameLabel.visible = false;
        cell.addChild(nameLabel);

        this.boardLayer.addChild(cell);
        this.cells.push({ cell, icon, moneyLabel, nameLabel, symbol: -1, origX: cell.x });
      }
    }
  }

  /**
   * 進入待命狀態：清空動態敵人，展現乾淨 3D 石廊
   */
  public setIdle(): void {
    if (this.encounterLayer) {
      this.encounterLayer.removeChildren();
    }
    this.activeEnemies = [];
    if (this.boardLayer) {
      this.boardLayer.visible = false;
    }
  }

  /**
   * 未中獎遭遇：單隻小怪由石廊向深處倉皇逃跑
   */
  public showFlee(symbolId: number = 8): void {
    this.setIdle();
    const enemyNode = this.createCreatureSprite(symbolId, 120, 120);
    enemyNode.pos(219, 210);
    this.encounterLayer.addChild(enemyNode);

    // 逃跑動畫：縮小、上升、漸隱
    if (typeof Laya !== 'undefined' && Laya.Tween) {
      Laya.Tween.to(enemyNode, {
        x: 239,
        y: 140,
        scaleX: 0.15,
        scaleY: 0.15,
        alpha: 0
      }, 700, Laya.Ease?.quadIn, Laya.Handler?.create(this, () => {
        enemyNode.removeSelf();
      }));
    }
  }

  /**
   * 動態生成 1～5 隻遭遇目標魔物 (依據當局有效連線)
   */
  public showEncounter(awards: any[], board?: number[]): void {
    this.setIdle();

    if (!awards || awards.length === 0) {
      const fleeSym = (board && board.find((s: number) => s > 0)) ?? 8;
      this.showFlee(fleeSym);
      return;
    }

    // 限制同時最多 5 隻敵人於石廊舞台
    const displayAwards = awards.slice(0, 5);
    const count = displayAwards.length;

    // 5 大終端黃金站位座標表 (寬 558, 高 453)
    const layouts: Record<number, Array<{ x: number; y: number; scale: number }>> = {
      1: [{ x: 219, y: 190, scale: 1.25 }],
      2: [{ x: 120, y: 195, scale: 1.1 }, { x: 318, y: 195, scale: 1.1 }],
      3: [{ x: 219, y: 185, scale: 1.2 }, { x: 80, y: 210, scale: 1.0 }, { x: 358, y: 210, scale: 1.0 }],
      4: [{ x: 160, y: 180, scale: 1.05 }, { x: 278, y: 180, scale: 1.05 }, { x: 60, y: 215, scale: 0.95 }, { x: 378, y: 215, scale: 0.95 }],
      5: [{ x: 219, y: 175, scale: 1.15 }, { x: 125, y: 195, scale: 1.0 }, { x: 313, y: 195, scale: 1.0 }, { x: 38, y: 220, scale: 0.9 }, { x: 400, y: 220, scale: 0.9 }]
    };

    const targetPosList = layouts[count] || layouts[1];

    displayAwards.forEach((award, idx) => {
      const pos = targetPosList[idx] || { x: 219, y: 190, scale: 1.0 };
      const sym = award.symbol !== undefined ? award.symbol : ((board && board[0]) ?? 1);

      const wrapper = new Laya.Sprite();
      wrapper.size(120, 150);
      wrapper.pos(pos.x, pos.y);
      wrapper.scale(pos.scale, pos.scale);

      // 1. 魔物切片圖案 (120x120)
      const creature = this.createCreatureSprite(sym, 120, 120);
      creature.pos(0, 20);
      wrapper.addChild(creature);

      // 2. 獲獎金額小旗幟 (頭頂上方)
      const badge = new Laya.Sprite();
      badge.size(90, 26);
      badge.pos(15, -6);
      badge.graphics.drawRoundRect(0, 0, 90, 26, 6, 6, 6, 6, 'rgba(15, 34, 46, 0.92)', '#ffd700', 1.2);

      const amountLabel = new Laya.Label();
      amountLabel.text = `+${(award.amount || 0).toLocaleString()}`;
      amountLabel.fontSize = 13;
      amountLabel.color = '#ffe386';
      amountLabel.bold = true;
      amountLabel.align = 'center';
      amountLabel.width = 90;
      amountLabel.pos(0, 4);
      badge.addChild(amountLabel);
      wrapper.addChild(badge);

      // 3. 怪物名稱
      const nameLabel = new Laya.Label();
      nameLabel.text = this.MONSTER_NAMES[sym] || '地城魔物';
      nameLabel.fontSize = 11;
      nameLabel.color = '#cbd5e1';
      nameLabel.align = 'center';
      nameLabel.width = 120;
      nameLabel.pos(0, 138);
      wrapper.addChild(nameLabel);

      this.encounterLayer.addChild(wrapper);
      this.activeEnemies.push({ wrapper, creature, badge, amount: award.amount });
    });
  }

  /**
   * 主角出招打擊反饋：全體敵人受擊震顫、碎裂與爆金幣
   */
  public triggerDefeat(): void {
    if (!this.activeEnemies || this.activeEnemies.length === 0) return;

    this.activeEnemies.forEach((item) => {
      const { wrapper, creature } = item;
      if (!wrapper || !creature) return;

      // 1. 白閃與劇烈震顫
      const origX = wrapper.x;
      let step = 0;
      const shake = () => {
        step++;
        wrapper.x = origX + (step % 2 === 0 ? 6 : -6);
        if (step < 8) {
          if (Laya.timer) Laya.timer.frameOnce(2, this, shake);
        } else {
          wrapper.x = origX;
        }
      };
      shake();

      // 2. 金幣飛濺微粒子
      this.spawnCoinBurst(wrapper.x + 60, wrapper.y + 60);

      // 3. 碎裂消散
      if (typeof Laya !== 'undefined' && Laya.Tween) {
        Laya.Tween.to(creature, {
          scaleX: 1.3,
          scaleY: 1.3,
          alpha: 0
        }, 320, Laya.Ease?.quadOut, Laya.Handler?.create(this, () => {
          creature.visible = false;
        }));
      }
    });
  }

  /**
   * 噴射 8~10 枚金色小圓幣飛濺粒子
   */
  private spawnCoinBurst(cx: number, cy: number): void {
    if (!this.encounterLayer) return;

    for (let i = 0; i < 8; i++) {
      const coin = new Laya.Sprite();
      coin.graphics.drawCircle(0, 0, 4, '#ffe386', '#b47618', 1);
      coin.pos(cx, cy);
      this.encounterLayer.addChild(coin);

      const targetX = cx + (Math.random() - 0.5) * 110;
      const targetY = cy - 40 - Math.random() * 50;

      if (typeof Laya !== 'undefined' && Laya.Tween) {
        Laya.Tween.to(coin, {
          x: targetX,
          y: targetY,
          alpha: 0
        }, 500, Laya.Ease?.quadOut, Laya.Handler?.create(this, () => {
          coin.removeSelf();
        }));
      }
    }
  }

  /**
   * 建立單隻怪物紋理切片精靈
   */
  private createCreatureSprite(sym: number, w: number, h: number): any {
    const icon = new Laya.Sprite();
    icon.size(w, h);

    const tex = this.atlasTexture;

    if (tex && Laya.Texture) {
      const col = sym % this.atlasCols;
      const row = Math.floor(sym / this.atlasCols);
      const subTex = gridCell(tex, this.atlasCols, this.atlasRows, col, row);
      icon.graphics.drawTexture(subTex, 0, 0, w, h);
    } else {
      icon.graphics.drawRoundRect(0, 0, w, h, 8, 8, 8, 8, '#1e293b', '#38bdf8', 1);
      const label = new Laya.Label();
      label.text = this.MONSTER_NAMES[sym] || `怪${sym}`;
      label.fontSize = 14;
      label.color = '#fff';
      label.align = 'center';
      label.width = w;
      label.pos(0, h / 2 - 8);
      icon.addChild(label);
    }
    return icon;
  }

  public clearEncounter(): void {
    this.setIdle();
  }

  // ---- 保持與原測試套件相容之舊接口 ----
  public updateBoard(board: number[]): void {
    const tex = this.atlasTexture;

    for (let i = 0; i < 15; i++) {
      const sym = board[i] ?? 0;
      const c = this.cells[i];
      if (!c) continue;
      c.symbol = sym;
      c.moneyLabel.visible = false;

      if (tex && Laya.Texture) {
        const col = sym % this.atlasCols;
        const row = Math.floor(sym / this.atlasCols);
        const subTex = gridCell(tex, this.atlasCols, this.atlasRows, col, row);
        c.icon.graphics.clear();
        c.icon.graphics.drawTexture(subTex, 0, 0, 82, 82);
        c.nameLabel.text = this.MONSTER_NAMES[sym] || '';
        c.nameLabel.visible = false;
      }
    }
  }

  public highlightAward(path: number[], amountText?: string): void {
    path.forEach((idx) => {
      const c = this.cells[idx];
      if (!c) return;
      c.cell.graphics.clear();
      c.cell.graphics.drawRoundRect(0, 0, this.cellWidth, this.cellHeight, 8, 8, 8, 8, 'rgba(255, 215, 0, 0.35)', '#ffd700', 3);
      if (amountText) {
        c.moneyLabel.text = amountText;
        c.moneyLabel.visible = true;
      }
    });
  }

  public clearHighlights(): void {
    this.cells.forEach((c) => {
      c.cell.graphics.clear();
      c.cell.graphics.drawRoundRect(0, 0, this.cellWidth, this.cellHeight, 8, 8, 8, 8, 'rgba(10, 24, 28, 0.75)', '#243a42', 1.5);
      c.moneyLabel.visible = false;
    });
  }
}
