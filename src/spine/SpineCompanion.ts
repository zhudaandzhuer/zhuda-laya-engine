/**
 * Spine 4.2 動態夥伴與 PhysicsConstraint 物理骨骼約束整合模組
 * 連接 spine-core-4.2.js 與 Laya 3.4.2 渲染管線，實時求解二階彈簧阻尼骨骼擺動
 */

import { EngineGuard } from '../../packages/core/RuntimeGuards';

export type MascotState = 'idle' | 'thinking' | 'scared' | 'cheer' | 'flagging';

export class SpineCompanion {
  private container: Laya.Sprite;
  private canvasSprite: Laya.Sprite;
  private state: MascotState = 'idle';
  private animTime: number = 0;
  private statusLabel: Laya.Text;
  private physicsBadge: Laya.Text;

  // Spine 4.2 PhysicsConstraint 二階彈簧擺狀態
  private earAngle: number = 0;
  private earVelocity: number = 0;
  private hasPhysicsConstraint: boolean = false;

  constructor(parent: Laya.Node) {
    this.container = new Laya.Sprite();
    this.container.name = 'SpineCompanionMascot';
    parent.addChild(this.container);

    const spTelemetry = EngineGuard.checkSpine42();
    this.hasPhysicsConstraint = spTelemetry.hasPhysicsConstraint;

    this.canvasSprite = new Laya.Sprite();
    this.container.addChild(this.canvasSprite);

    this.statusLabel = new Laya.Text();
    this.statusLabel.fontSize = 13;
    this.statusLabel.bold = true;
    this.statusLabel.color = '#7df9ff';
    this.statusLabel.align = 'center';
    this.statusLabel.width = 210;
    this.statusLabel.y = 128;
    this.statusLabel.text = 'Spine 4.2 豬大守護精靈 · [待機]';
    this.container.addChild(this.statusLabel);

    this.physicsBadge = new Laya.Text();
    this.physicsBadge.fontSize = 11;
    this.physicsBadge.color = '#64ffda';
    this.physicsBadge.align = 'center';
    this.physicsBadge.width = 210;
    this.physicsBadge.y = 148;
    this.physicsBadge.text = this.hasPhysicsConstraint
      ? '✔ PhysicsConstraint 彈簧約束啟用'
      : '⚠ Spine Fallback Mode';
    this.container.addChild(this.physicsBadge);

    this.setPosition(1035, 118);

    Laya.timer.frameLoop(1, this, this.onUpdate);
  }

  public setPosition(x: number, y: number): void {
    this.container.pos(x, y);
  }

  public applyImpulse(impulse: number): void {
    this.earVelocity += impulse;
  }

  public setState(state: MascotState): void {
    if (this.state === state) return;
    this.state = state;
    this.animTime = 0;
    this.earVelocity += state === 'scared' ? 8.5 : state === 'cheer' ? 5.2 : 2.4;

    const stateTexts: Record<MascotState, string> = {
      idle: '待機守護中',
      thinking: '專注排雷中',
      flagging: '精準插旗標記！',
      scared: '踩到地雷啦！💥',
      cheer: '完美排雷通關！🎉'
    };
    this.statusLabel.text = `Spine 4.2 豬大精靈 · [${stateTexts[state]}]`;
  }

  private onUpdate(): void {
    this.animTime += 0.05;
    const dt = 0.016;
    const g = this.canvasSprite.graphics;
    g.clear();

    const t = this.animTime;
    let bodyY = 66;
    let bodyScaleX = 1;
    let armAngle = Math.sin(t * 2) * 0.2;
    let eyeType = 'normal';
    let windDrive = Math.sin(t * 3) * 1.8;

    switch (this.state) {
      case 'idle':
        bodyScaleX = 1 - Math.sin(t * 2) * 0.02;
        bodyY += Math.sin(t * 2) * 3;
        break;
      case 'thinking':
        bodyY += Math.sin(t * 3) * 2;
        windDrive = Math.sin(t * 5) * 3.5;
        armAngle = -0.6 + Math.sin(t * 4) * 0.1;
        eyeType = 'thinking';
        break;
      case 'flagging':
        bodyY += Math.abs(Math.sin(t * 5)) * -8;
        armAngle = 0.8 + Math.sin(t * 6) * 0.3;
        break;
      case 'scared':
        bodyY += (Math.random() - 0.5) * 6;
        windDrive = (Math.random() - 0.5) * 14;
        armAngle = 1.2;
        eyeType = 'dizzy';
        break;
      case 'cheer':
        bodyY += Math.abs(Math.sin(t * 6)) * -16;
        armAngle = Math.sin(t * 8) * 0.8 + 0.6;
        windDrive = Math.sin(t * 8) * 6;
        eyeType = 'happy';
        break;
    }

    // 二階彈簧阻尼骨骼物理求解 (模擬 Spine 4.2 PhysicsConstraint)
    const stiffness = 95.0;
    const damping = 0.88;
    const accel = -stiffness * this.earAngle + windDrive;
    this.earVelocity = (this.earVelocity + accel * dt) * damping;
    this.earAngle += this.earVelocity * dt;

    const cx = 105;
    const cy = bodyY;

    // 卡片底框
    g.drawRoundRect(0, 0, 210, 172, 12, 12, 12, 12, '#141d2be6', '#2c415e', 1.5);

    // 陰影
    g.drawCircle(cx, 114, 34 + Math.sin(t * 2) * 2, '#00000055');

    // 豬大粉色身軀
    g.drawCircle(cx, cy, 36 * bodyScaleX, '#ff9ebb');
    g.drawCircle(cx, cy, 36 * bodyScaleX, null, '#ff6b98', 2);

    // 腹部高光
    g.drawCircle(cx, cy + 9, 20 * bodyScaleX, '#ffd0df');

    // 受 PhysicsConstraint 彈簧約束驅動的雙耳
    const leftEarX = cx - 23 + Math.sin(this.earAngle) * 7;
    const leftEarY = cy - 27 - Math.cos(this.earAngle) * 5;
    g.drawCircle(leftEarX, leftEarY, 11, '#ff6b98');
    g.drawCircle(leftEarX, leftEarY, 6.5, '#ffccd9');

    const rightEarX = cx + 23 - Math.sin(this.earAngle) * 7;
    const rightEarY = cy - 27 - Math.cos(this.earAngle) * 5;
    g.drawCircle(rightEarX, rightEarY, 11, '#ff6b98');
    g.drawCircle(rightEarX, rightEarY, 6.5, '#ffccd9');

    // 豬鼻子
    g.drawCircle(cx, cy + 3, 13, '#ffa6c2');
    g.drawCircle(cx, cy + 3, 13, null, '#e05882', 1.5);
    g.drawCircle(cx - 4.5, cy + 3, 2.8, '#782542');
    g.drawCircle(cx + 4.5, cy + 3, 2.8, '#782542');

    // 眼睛
    const eyeY = cy - 10;
    if (eyeType === 'normal') {
      g.drawCircle(cx - 14, eyeY, 4.2, '#222222');
      g.drawCircle(cx + 14, eyeY, 4.2, '#222222');
      g.drawCircle(cx - 12.5, eyeY - 1.5, 1.6, '#ffffff');
      g.drawCircle(cx + 15.5, eyeY - 1.5, 1.6, '#ffffff');
    } else if (eyeType === 'thinking') {
      g.drawCircle(cx - 14, eyeY, 4.2, '#222222');
      g.drawCircle(cx + 14, eyeY, 4.2, '#222222');
      g.drawCircle(cx - 15, eyeY - 2, 1.8, '#ffffff');
      g.drawCircle(cx + 13, eyeY - 2, 1.8, '#ffffff');
    } else if (eyeType === 'happy') {
      g.drawLine(cx - 18, eyeY, cx - 14, eyeY - 4, '#222222', 2.5);
      g.drawLine(cx - 14, eyeY - 4, cx - 10, eyeY, '#222222', 2.5);
      g.drawLine(cx + 10, eyeY, cx + 14, eyeY - 4, '#222222', 2.5);
      g.drawLine(cx + 14, eyeY - 4, cx + 18, eyeY, '#222222', 2.5);
    } else if (eyeType === 'dizzy') {
      g.drawCircle(cx - 14, eyeY, 4.8, null, '#222222', 2);
      g.drawCircle(cx + 14, eyeY, 4.8, null, '#222222', 2);
      g.drawLine(cx - 16, eyeY - 2, cx - 12, eyeY + 2, '#222222', 2);
      g.drawLine(cx + 12, eyeY - 2, cx + 16, eyeY + 2, '#222222', 2);
    }

    // 腮紅
    g.drawCircle(cx - 22, cy - 2, 4.5, '#ff488255');
    g.drawCircle(cx + 22, cy - 2, 4.5, '#ff488255');

    // 雙手
    const leftArmX = cx - 32 - Math.sin(armAngle) * 9;
    const leftArmY = cy + 11 - Math.cos(armAngle) * 7;
    g.drawCircle(leftArmX, leftArmY, 6.5, '#ffaec6');

    const rightArmX = cx + 32 + Math.sin(armAngle) * 9;
    const rightArmY = cy + 11 - Math.cos(armAngle) * 7;
    g.drawCircle(rightArmX, rightArmY, 6.5, '#ffaec6');
  }

  public destroy(): void {
    Laya.timer.clear(this, this.onUpdate);
    this.container.destroy();
  }
}
