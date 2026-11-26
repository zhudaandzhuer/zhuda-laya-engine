// The treasure-bag boss over the corridor (558×448 at 7,128): the bag goblin (cell 9 of
// creatures-v3.png), four seal slots on the bag, the chances left, the locked seal and its
// rate, the name plate and the strike card. updateBeat() shows each bonus beat.
// From games/dungeon-spin (BossSealView.ts). Changes: the header title is set through
// onShow / onHide (the original reached for window.__DUNGEON_GAME__); the atlas cell
// comes from 2d/prefab-atlas (same arithmetic); no parameter property.
import { gridCell } from '../../prefab-atlas/prefab-atlas.ts';

export class BossSealView {
  public container: any;
  public goblinSprite: any;
  public sealSlots: any[] = [];
  public targetLabel: any;
  public oppLabel: any;
  public statusTitle: any;
  public statusDesc: any;
  public rateCalcLabel: any;
  public lockBadge: any;

  private currentTarget: number = 8; // 預設翡翠印
  private currentBet: number = 90;
  private readonly atlasTexture?: Laya.Texture;
  /** Called when the boss shows (the game titles the header THE TREASURE THIEF). */
  public onShow: (() => void) | null = null;
  /** Called when it hides (the game puts the round number back in the header). */
  public onHide: (() => void) | null = null;

  constructor(atlasTexture?: Laya.Texture) {
    this.atlasTexture = atlasTexture;
    this.createBossNode();
  }

  private createBossNode(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'BossSealView';
    // 鎖定上層石廊舞台空間 (y=128~576, 寬 558)
    this.container.size(558, 448);
    this.container.pos(7, 128);
    this.container.visible = false;

    // 追擊機會徽章 (右上角)
    const oppBox = new Laya.Sprite();
    oppBox.size(114, 28);
    oppBox.pos(424, 8);
    oppBox.graphics.drawRoundRect(0, 0, 114, 28, 14, 14, 14, 14, 'rgba(10, 20, 30, 0.9)', '#b4975a', 1.5);

    this.oppLabel = new Laya.Label();
    this.oppLabel.text = '追擊機會 1';
    this.oppLabel.fontSize = 13;
    this.oppLabel.color = '#fde68a';
    this.oppLabel.bold = true;
    this.oppLabel.align = 'center';
    this.oppLabel.width = 114;
    this.oppLabel.pos(0, 5);
    oppBox.addChild(this.oppLabel);
    this.container.addChild(oppBox);

    // 2. 巨袋哥布林 Boss 立繪 (assets/creatures-v3.png 第 10 格: col=4, row=1)
    this.goblinSprite = new Laya.Sprite();
    this.goblinSprite.size(310, 310);
    this.goblinSprite.pos(124, 24);
    this.container.addChild(this.goblinSprite);
    this.renderGoblinTexture();

    // 3. 袋身四印槽位 (2x2 矩陣覆蓋於左側大麻袋上)
    this.lockBadge = new Laya.Sprite();
    this.lockBadge.size(68, 20);
    this.lockBadge.pos(118, 68);
    this.lockBadge.graphics.drawRoundRect(0, 0, 68, 20, 4, 4, 4, 4, 'rgba(15, 23, 42, 0.95)', '#38bdf8', 1.5);
    const lockTxt = new Laya.Label();
    lockTxt.text = '本刀鎖定';
    lockTxt.fontSize = 11;
    lockTxt.color = '#38bdf8';
    lockTxt.bold = true;
    lockTxt.align = 'center';
    lockTxt.width = 68;
    lockTxt.pos(0, 3);
    this.lockBadge.addChild(lockTxt);
    this.container.addChild(this.lockBadge);

    // 4 個印記槽 (Slot 0..3)
    const slotCoords = [
      { x: 122, y: 92 },
      { x: 172, y: 92 },
      { x: 122, y: 142 },
      { x: 172, y: 142 }
    ];

    slotCoords.forEach((coord, i) => {
      const slot = new Laya.Sprite();
      slot.size(44, 44);
      slot.pos(coord.x, coord.y);
      slot.graphics.drawRoundRect(0, 0, 44, 44, 8, 8, 8, 8, 'rgba(15, 23, 42, 0.9)', '#38bdf8', 1.5);

      const slotText = new Laya.Label();
      slotText.fontSize = 13;
      slotText.color = '#ffffff';
      slotText.bold = true;
      slotText.align = 'center';
      slotText.valign = 'middle';
      slotText.width = 44;
      slotText.height = 44;
      slotText.pos(0, 0);
      slotText.text = '印';
      slot.addChild(slotText);

      this.container.addChild(slot);
      this.sealSlots.push({ slot, slotText });
    });

    // 4. 巨袋藏寶怪牌匾
    const namePlate = new Laya.Sprite();
    namePlate.size(110, 24);
    namePlate.pos((558 - 110) / 2, 332);
    namePlate.graphics.drawRoundRect(0, 0, 110, 24, 12, 12, 12, 12, 'rgba(15, 23, 42, 0.95)', '#b4975a', 1.5);
    const nameTxt = new Laya.Label();
    nameTxt.text = '巨袋藏寶怪';
    nameTxt.fontSize = 12;
    nameTxt.color = '#f1f5f9';
    nameTxt.bold = true;
    nameTxt.align = 'center';
    nameTxt.width = 110;
    nameTxt.pos(0, 4);
    namePlate.addChild(nameTxt);
    this.container.addChild(namePlate);

    // 5. 底部出刀說明卡片
    const infoCard = new Laya.Sprite();
    infoCard.size(520, 84);
    infoCard.pos(19, 360);
    infoCard.graphics.drawRoundRect(0, 0, 520, 84, 8, 8, 8, 8, 'rgba(6, 17, 24, 0.94)', '#1e293b', 1.5);

    this.targetLabel = new Laya.Label();
    this.targetLabel.text = '本刀鎖定 翡翠印 · 每枚 ×2';
    this.targetLabel.fontSize = 12;
    this.targetLabel.color = '#94a3b8';
    this.targetLabel.align = 'center';
    this.targetLabel.width = 520;
    this.targetLabel.pos(0, 8);
    infoCard.addChild(this.targetLabel);

    this.statusTitle = new Laya.Label();
    this.statusTitle.text = '等待出刀';
    this.statusTitle.fontSize = 18;
    this.statusTitle.color = '#38bdf8';
    this.statusTitle.bold = true;
    this.statusTitle.align = 'center';
    this.statusTitle.width = 520;
    this.statusTitle.pos(0, 26);
    infoCard.addChild(this.statusTitle);

    this.statusDesc = new Laya.Label();
    this.statusDesc.text = '看準袋口印記，斬開同印封印';
    this.statusDesc.fontSize = 12;
    this.statusDesc.color = '#cbd5e1';
    this.statusDesc.align = 'center';
    this.statusDesc.width = 520;
    this.statusDesc.pos(0, 47);
    infoCard.addChild(this.statusDesc);

    this.rateCalcLabel = new Laya.Label();
    this.rateCalcLabel.text = '倍率合計 × 總投注 90';
    this.rateCalcLabel.fontSize = 11;
    this.rateCalcLabel.color = '#64748b';
    this.rateCalcLabel.align = 'center';
    this.rateCalcLabel.width = 520;
    this.rateCalcLabel.pos(0, 65);
    infoCard.addChild(this.rateCalcLabel);

    this.container.addChild(infoCard);
  }

  private renderGoblinTexture(): void {
    if (typeof Laya === 'undefined') return;
    const tex = this.atlasTexture;
    if (tex && Laya.Texture) {
      const subTex = gridCell(tex, 5, 2, 4, 1);
      this.goblinSprite.graphics.clear();
      this.goblinSprite.graphics.drawTexture(subTex, 0, 0, 310, 310);
    }
  }

  public showEncounter(opportunities: number = 1, target: number = 8, totalBet: number = 90): void {
    this.currentTarget = target;
    this.currentBet = totalBet;
    this.renderGoblinTexture();
    this.container.visible = true;

    this.onShow?.();

    this.oppLabel.text = `追擊機會 ${opportunities}`;
    const SEAL_NAMES = ['護袋撤退', '日輪印', '月牙印', '雷霆印', '焰心印', '翠葉印', '冰晶印', '潮汐印', '翡翠印'];
    const SEAL_RATES = [0, 2, 1, 0.7, 0.5, 0.2, 0.1, 0.05, 2];
    const sealName = SEAL_NAMES[target] || '翡翠印';
    const rate = SEAL_RATES[target] ?? 2;

    this.targetLabel.text = `本刀鎖定 ${sealName} · 每枚 ×${rate}`;
    this.statusTitle.text = '等待出刀';
    this.statusTitle.color = '#38bdf8';
    this.statusDesc.text = '看準袋口印記，斬開同印封印';
    this.rateCalcLabel.text = `倍率合計 × 總投注 ${totalBet}`;

    // 初始化 4 槽
    this.sealSlots.forEach((s) => {
      s.slot.graphics.clear();
      s.slot.graphics.drawRoundRect(0, 0, 44, 44, 8, 8, 8, 8, 'rgba(15, 23, 42, 0.9)', '#38bdf8', 1.5);
      s.slotText.text = sealName.slice(0, 2);
    });
  }

  public show(opportunities?: number, target?: number, totalBet?: number): void {
    this.showEncounter(opportunities ?? 1, target ?? 8, totalBet ?? 90);
  }

  public hideEncounter(): void {
    this.container.visible = false;
    this.onHide?.();
  }

  public hide(): void {
    this.hideEncounter();
  }

  public updateBeat(beat: any): void {
    const SEAL_NAMES = ['護袋撤退', '日輪印', '月牙印', '雷霆印', '焰心印', '翠葉印', '冰晶印', '潮汐印', '翡翠印'];
    const SEAL_COLORS = ['#94a3b8', '#fbbf24', '#c084fc', '#fde047', '#fb923c', '#4ade80', '#38bdf8', '#60a5fa', '#10b981'];

    if (beat.target !== undefined) this.currentTarget = beat.target;
    const targetName = SEAL_NAMES[this.currentTarget] || '翡翠印';
    this.oppLabel.text = `追擊機會 ${beat.remaining ?? 1}`;
    this.targetLabel.text = `本刀鎖定 ${targetName} · 每枚 ×2`;

    const slots = beat.slots || [8, 8, 3, 4];
    const hitIndices = beat.hitIndices || [];

    slots.forEach((sym: number, i: number) => {
      const s = this.sealSlots[i];
      if (!s) return;
      const isHit = hitIndices.includes(i) || sym === this.currentTarget;
      const symName = SEAL_NAMES[sym]?.slice(0, 2) || '印';
      const color = SEAL_COLORS[sym] || '#38bdf8';

      s.slotText.text = symName;
      s.slot.graphics.clear();
      if (isHit) {
        s.slot.graphics.drawRoundRect(0, 0, 44, 44, 8, 8, 8, 8, 'rgba(16, 185, 129, 0.5)', '#10b981', 2.5);
      } else {
        s.slot.graphics.drawRoundRect(0, 0, 44, 44, 8, 8, 8, 8, 'rgba(15, 23, 42, 0.9)', color, 1.5);
      }
    });

    if (hitIndices.length > 0) {
      this.statusTitle.text = `命中 ${hitIndices.length} 枚封印！`;
      this.statusTitle.color = '#34d399';
    } else {
      this.statusTitle.text = '等待出刀';
      this.statusTitle.color = '#38bdf8';
    }
  }
}
