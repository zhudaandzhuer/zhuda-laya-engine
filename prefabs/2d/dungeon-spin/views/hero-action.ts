// The hero window (558×324 at 7,576): six sword poses from hero-actions-v4.png (a 3×2
// atlas, 2032×774), each with prepare / impact / recover timings, a slash flash at the
// impact, and the line on the parchment. At 'ready' the overlay hides and the hero painted
// in the template shows.
// From games/dungeon-spin (HeroActionView.ts). Changes: the atlas cell comes from
// 2d/prefab-atlas (same arithmetic); no parameter property.
import { gridCell } from '../../prefab-atlas/prefab-atlas.ts';

export type HeroPose = 'ready' | 'quick' | 'wave' | 'draw' | 'magic' | 'cleave';

export const HERO_TIMINGS: Record<HeroPose, { prepare: number; impact: number; recover: number }> = {
  ready: { prepare: 0, impact: 300, recover: 0 },
  quick: { prepare: 140, impact: 180, recover: 160 },
  wave: { prepare: 260, impact: 260, recover: 200 },
  draw: { prepare: 320, impact: 120, recover: 180 },
  magic: { prepare: 340, impact: 360, recover: 240 },
  cleave: { prepare: 180, impact: 240, recover: 180 }
};

export const POSE_CELL_MAP: Record<HeroPose, { col: number; row: number; label: string }> = {
  ready: { col: 0, row: 0, label: '前進戒備' },
  quick: { col: 1, row: 0, label: '迅劍橫斬' },
  wave: { col: 2, row: 0, label: '蒼刃劍氣' },
  draw: { col: 0, row: 1, label: '拔刀一閃' },
  magic: { col: 1, row: 1, label: '魔法召喚' },
  cleave: { col: 2, row: 1, label: '巨袋斬擊' }
};

export class HeroActionView {
  public container: any;
  public heroSprite: any;
  public slashSprite: any;
  public parchmentBox: any;
  public dialogueLabel: any;
  public currentPose: HeroPose = 'ready';

  private viewWidth: number = 558;
  private viewHeight: number = 324;
  private atlasCols: number = 3;
  private atlasRows: number = 2;
  private readonly atlasTexture?: Laya.Texture;

  constructor(atlasTexture?: Laya.Texture) {
    this.atlasTexture = atlasTexture;
    this.createHeroNode();
  }

  private createHeroNode(): void {
    if (typeof Laya === 'undefined' || !Laya.Sprite) return;

    this.container = new Laya.Sprite();
    this.container.name = 'HeroView';
    // 定位於 572x1024 視圖下半部主角窗口：x=7, y=576, w=558, h=324
    this.container.pos(7, 576);

    // 主角全彩精靈 (558x324，僅在出招 attack 姿態時覆蓋顯示，待命時由 template-v2 原稿呈現)
    this.heroSprite = new Laya.Sprite();
    this.heroSprite.size(this.viewWidth, this.viewHeight);
    this.heroSprite.visible = false;
    this.container.addChild(this.heroSprite);

    // 羊皮紙對話框背景底圖 (覆蓋於 heroSprite 上層，確保出招時台詞擁有實體卷軸襯底，永不覆蓋在主角胸膛)
    this.parchmentBox = new Laya.Sprite();
    this.parchmentBox.size(540, 96);
    this.parchmentBox.pos(9, 172);
    this.parchmentBox.visible = false;
    this.drawParchmentBackground();
    this.container.addChild(this.parchmentBox);

    // 劍氣光弧特效精靈 (跨越整個下半部)
    this.slashSprite = new Laya.Sprite();
    this.slashSprite.size(this.viewWidth, this.viewHeight);
    this.slashSprite.visible = false;
    this.container.addChild(this.slashSprite);

    // 羊皮紙對話框文字 (精確垂直置中對齊 template-v2.png 羊皮紙卷軸 y=746~846，中心 y=796 -> 視圖內 y=220)
    this.dialogueLabel = new Laya.Label();
    this.dialogueLabel.fontSize = 19;
    this.dialogueLabel.color = '#261f18';
    this.dialogueLabel.bold = true;
    this.dialogueLabel.align = 'center';
    this.dialogueLabel.valign = 'middle';
    this.dialogueLabel.width = 460;
    this.dialogueLabel.height = 30;
    this.dialogueLabel.pos(49, 220);
    this.dialogueLabel.text = '下一個遭遇，正在前方。';
    this.container.addChild(this.dialogueLabel);

    this.setPose('ready');
  }

  private drawParchmentBackground(): void {
    if (!this.parchmentBox) return;
    const g = this.parchmentBox.graphics;
    g.clear();
    // 羊皮紙柔和米黃襯底 + 雙重古典金框
    g.drawRoundRect(0, 0, 540, 96, 12, 12, 12, 12, '#faf4e4', '#cca86a', 2);
    // 右上角對話框指示箭頭 (指向發話主角)
    g.drawPoly(0, 0, [440, 0, 455, -14, 468, 0], '#faf4e4', '#cca86a', 1.5);
    // 內層細金邊
    g.drawRoundRect(5, 5, 530, 86, 8, 8, 8, 8, null, 'rgba(180, 151, 90, 0.4)', 1);
  }

  public setDialogue(text: string): void {
    if (this.dialogueLabel) {
      this.dialogueLabel.text = text;
    }
  }

  public setPose(pose: HeroPose): void {
    this.currentPose = pose;

    // 當處於 ready 待命姿態時，隱藏覆蓋精靈與羊皮紙補償板，展現 template-v2 原稿的高清立繪與底座
    if (pose === 'ready') {
      if (this.heroSprite) this.heroSprite.visible = false;
      if (this.parchmentBox) this.parchmentBox.visible = false;
      return;
    }

    if (this.parchmentBox) this.parchmentBox.visible = true;

    if (typeof Laya === 'undefined' || !Laya.loader) return;

    const tex = this.atlasTexture;
    if (tex && Laya.Texture) {
      const { col, row } = POSE_CELL_MAP[pose] || POSE_CELL_MAP.ready;
      const subTex = gridCell(tex, this.atlasCols, this.atlasRows, col, row); // cells ~677.33 × 387
      this.heroSprite.graphics.clear();
      this.heroSprite.graphics.drawTexture(subTex, 0, 0, this.viewWidth, this.viewHeight);
      this.heroSprite.visible = true;
    }
  }

  /**
   * 執行完整劍術動作時序 (前搖 -> 打擊點出劍氣 -> 收勢復位)
   */
  public async playAttack(pose: HeroPose, onImpact?: () => void): Promise<void> {
    const timing = HERO_TIMINGS[pose] || HERO_TIMINGS.quick;
    this.setPose(pose);
    this.setDialogue(this.getAttackDialogue(pose));

    // 1. 前搖等待
    if (timing.prepare > 0) {
      await new Promise<void>((r) => setTimeout(r, timing.prepare));
    }

    // 2. 打擊點：震屏 + 劍氣光效 + 回呼結算
    this.showSlashVFX(pose);
    if (onImpact) onImpact();

    if (timing.impact > 0) {
      await new Promise<void>((r) => setTimeout(r, timing.impact));
    }

    // 3. 收勢等待並回歸戒備姿態
    if (timing.recover > 0) {
      await new Promise<void>((r) => setTimeout(r, timing.recover));
    }
    this.setPose('ready');
    this.setDialogue('劍還鋒利，再走一段吧。');
  }

  private getAttackDialogue(pose: HeroPose): string {
    switch (pose) {
      case 'quick': return '「迅劍橫斬！」';
      case 'wave': return '「接招！蒼刃劍氣！」';
      case 'draw': return '「拔刀一閃，破除迷霧！」';
      case 'magic': return '「召喚・萬刃橫掃！」';
      case 'cleave': return '「斬開藏寶巨袋！」';
      default: return '「石廊深處，傳來了腳步聲。」';
    }
  }

  private showSlashVFX(pose: HeroPose): void {
    if (!this.slashSprite) return;
    this.slashSprite.graphics.clear();

    // 繪製強烈亮藍白劍光弧
    this.slashSprite.graphics.drawLine(40, 260, 520, 40, '#a5f3fc', 8);
    this.slashSprite.graphics.drawLine(50, 265, 510, 45, '#ffffff', 4);
    this.slashSprite.visible = true;
    this.slashSprite.alpha = 1;

    let frames = 0;
    const fade = () => {
      frames++;
      this.slashSprite.alpha -= 0.15;
      if (frames < 6 && this.slashSprite.alpha > 0) {
        if (Laya.timer) Laya.timer.frameOnce(2, this, fade);
      } else {
        this.slashSprite.visible = false;
        this.slashSprite.alpha = 1;
      }
    };
    fade();
  }
}
