// How Dungeon Spin shows a round (the PresentationPort of systems/slot-round): walk
// (700 ms, 90 in burst), monsters appear for each award or one flees, the hero strikes
// (pose timings in views/hero-action.ts), coins, the treasure-bag boss when the round has
// bonus beats, and a BIG / MEGA / SUPER WIN count-up when the win is 10× the bet or more
// (not in burst). Timing uses setTimeout, as in the original game.
// From games/dungeon-spin (LayaDungeonPresentation.ts). Change: the invisible 3D hall is not
// part of it (see README); `hall3D` stays as an optional { advanceStep(ms) } hook.
import type { PresentationPort, PresentationContext, RoundView } from '../../systems/slot-round/contracts.ts';
import type { MonsterFieldView } from './views/monster-field.ts';
import type { HeroActionView, HeroPose } from './views/hero-action.ts';
import type { BossSealView } from './views/boss-seal.ts';
import type { WinCelebrationView } from './views/win-celebration.ts';
import { DungeonSoundBridge } from './sound.ts';

/** Something that pushes forward while the hero walks (the original's invisible 3D hall had this). */
export interface WalkStepper {
  advanceStep(durationMs: number): void;
}

export class LayaDungeonPresentation implements PresentationPort {
  public hall3D: WalkStepper | null;
  public monsterField: MonsterFieldView;
  public heroView: HeroActionView;
  public bossView: BossSealView;
  public winView: WinCelebrationView;
  public soundBridge: DungeonSoundBridge;
  public controlBar?: any;
  public receiptDialog?: any;
  private isAccelerated: boolean = false;

  constructor(options: {
    hall3D?: WalkStepper | null;
    monsterField: MonsterFieldView;
    heroView: HeroActionView;
    bossView: BossSealView;
    winView: WinCelebrationView;
  }) {
    this.hall3D = options.hall3D ?? null;
    this.monsterField = options.monsterField;
    this.heroView = options.heroView;
    this.bossView = options.bossView;
    this.winView = options.winView;
    this.soundBridge = DungeonSoundBridge.getInstance();
  }

  public accepted(round: Readonly<RoundView>, context: PresentationContext): void {
    this.isAccelerated = false;
    this.monsterField.setIdle();
  }

  public async play(round: Readonly<RoundView>, context: PresentationContext): Promise<void> {
    const isBurst = context.mode === 'burst' || this.isAccelerated;
    context.phase('walking');

    // 1. 探索前進 (3D 石廊推進 + 腳步音效，此時石廊空曠乾淨無怪)
    this.monsterField.setIdle();
    this.soundBridge.play('walk');
    const stepDuration = isBurst ? 90 : 700;
    this.hall3D?.advanceStep(stepDuration);
    await new Promise<void>((r) => setTimeout(r, stepDuration));

    // 2. 主角出招姿態與動態遭遇解析
    context.phase('revealing');
    const attackPose: HeroPose = this.mapAttackToPose(round.p.attack);
    this.playAttackAudio(attackPose);

    // 動態敵人生成：若中獎生成 1~5 隻目標敵人；若未中獎生成 1 隻逃跑小怪
    if (round.p.awards && round.p.awards.length > 0) {
      this.monsterField.showEncounter(round.p.awards, round.p.board);
      this.heroView.setDialogue(this.getAttackDialogue(round.p.attack));
    } else {
      const fleeSym = (round.p.board && round.p.board.find((s: number) => s > 0)) ?? 8;
      this.monsterField.showFlee(fleeSym);
      this.heroView.setDialogue('牠溜進迷宮深處了，繼續前進。');
    }

    // 主角揮劍與打擊點反饋
    await this.heroView.playAttack(attackPose, () => {
      this.monsterField.triggerDefeat();
      this.soundBridge.play('impact');
    });

    // 更新戰果明細彈窗快照
    if (this.receiptDialog) {
      this.receiptDialog.updateReceipt(round);
    }

    // 3. 盤面結算金幣聲
    context.phase('resolving');
    if (round.p.awards && round.p.awards.length > 0) {
      this.soundBridge.play('coin');
      await new Promise<void>((r) => setTimeout(r, isBurst ? 100 : 400));
    }

    // 4. Boss 巨袋封印階段 (若有觸發)
    if (round.p.opportunities > 0 && round.b.beats.length > 0) {
      context.phase('bonus');
      this.monsterField.container.visible = false;
      if (this.controlBar) this.controlBar.setRibbonTitle('Bonus 累計');
      this.heroView.setPose('cleave');
      this.heroView.setDialogue('瞄準翡翠印，每個同印封印都是 ×2。');

      this.bossView.showEncounter(round.p.opportunities, round.b.beats[0]?.target ?? 8, round.bet);
      this.soundBridge.play('boss');
      await new Promise<void>((r) => setTimeout(r, isBurst ? 150 : 500));

      for (const beat of round.b.beats) {
        this.bossView.updateBeat(beat);
        this.heroView.playAttack('cleave');
        this.soundBridge.play(beat.isFull ? 'full' : 'bag-hit');
        await new Promise<void>((r) => setTimeout(r, isBurst ? 150 : 600));
      }
      this.bossView.hideEncounter();
      this.monsterField.container.visible = true;
      if (this.controlBar) this.controlBar.setRibbonTitle('本局戰果');
      this.heroView.setPose('ready');
      this.heroView.setDialogue('戰利品已收下。下一段路，等你前進。');
    }

    // 5. 大獎跳動慶祝 (BIG WIN / MEGA WIN / SUPER WIN)
    if (round.win >= round.bet * 10 && !isBurst) {
      context.phase('celebration');
      this.monsterField.container.visible = false;
      this.heroView.container.visible = false;
      await this.winView.playWin(round.win, round.bet);
      this.monsterField.container.visible = true;
      this.heroView.container.visible = true;
    }
  }

  public complete(round: Readonly<RoundView>, context: PresentationContext): void {
    this.monsterField.setIdle();
    this.heroView.setPose('ready');
    this.heroView.setDialogue('戰利品已收下。下一段路，等你前進。');
    context.phase('idle');
  }

  public recover(round: Readonly<RoundView>, error: Error, context: PresentationContext): void {
    console.warn('[LayaDungeonPresentation] 演出異常恢復:', error);
    this.monsterField.setIdle();
    this.bossView.hideEncounter();
    context.phase('idle');
  }

  public accelerate(): void {
    this.isAccelerated = true;
    this.winView.collect();
  }

  public collect(): void {
    this.winView.collect();
  }

  public interrupt(reason?: string): void {
    this.winView.collect();
  }

  public finalize(): void {
    this.isAccelerated = false;
  }

  private mapAttackToPose(attack: string): HeroPose {
    switch (attack) {
      case '迅劍': return 'quick';
      case '蒼刃劍氣': return 'wave';
      case '拔刀一閃': return 'draw';
      case '召喚・萬刃橫掃': return 'magic';
      case '斬袋追擊':
      case '領域斬':
      case '破封聖劍': return 'cleave';
      default: return 'ready';
    }
  }

  private getAttackDialogue(attack: string): string {
    switch (attack) {
      case '迅劍': return '看我的迅劍橫斬！';
      case '蒼刃劍氣': return '接下這一記蒼刃劍氣！';
      case '拔刀一閃': return '迷宮深處，拔刀一閃！';
      case '召喚・萬刃橫掃': return '萬刃橫掃，陣法啟動！';
      default: return '看我的！';
    }
  }

  private playAttackAudio(pose: HeroPose): void {
    switch (pose) {
      case 'quick': this.soundBridge.play('quick'); break;
      case 'wave': this.soundBridge.play('wave'); break;
      case 'draw': this.soundBridge.play('draw'); break;
      case 'magic': this.soundBridge.play('magic'); break;
      case 'cleave': this.soundBridge.play('cleave'); break;
    }
  }
}
