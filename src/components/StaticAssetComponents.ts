/**
 * @zhuda-laya/core — 靜態資產 (.lh) 專屬反射組件：
 * 1. Spine42PhysicsRigComponent：掛載於 assets/prefabs/ZhudaSpine42Mascot.lh，讀取靜態校準後之骨骼配色與彈簧係數
 * 2. ZhudaParticleEmitterComponent：掛載於 assets/prefabs/MineExplosionParticle.lh，支援靜態決定性快照與運行期粒子爆發
 */

import { zhudaComponent } from '../../packages/core/DeclarativeSDK';
import {
  UNITY_CYBER_SHRINE_SCENE,
  UnityAnimatorStateMachine
} from '../../packages/core/UnityBridgePipeline';
import type { UnityAnimatorControllerSpec } from '../../packages/types/index';

interface LiveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  ageMs: number;
  maxAgeMs: number;
}

@zhudaComponent({
  className: 'Spine42PhysicsRigComponent',
  assetId: 'zhuda://Spine42PhysicsRigComponent',
  category: 'spine',
  description: 'Spine 4.2 靜態預製體骨骼物理約束組件，支援孤立靜態幀校準與運行期彈簧擺解算'
})
export class Spine42PhysicsRigComponent extends Laya.Script {
  public rigName: string = 'ZhudaGuardianPig_v4.2';
  public defaultPose: string = 'idle';
  public stiffness: number = 95.0;
  public damping: number = 0.88;
  public windAmplitude: number = 1.8;
  public earAngleRad: number = 0.0;
  public earVelocity: number = 0.0;
  public skinPrimaryColor: string = '#ff9ebb';
  public skinBorderColor: string = '#ff6b98';
  public bellyHighlightColor: string = '#ffd0df';
  public snoutColor: string = '#ffa6c2';
  public staticFreezeMode: boolean = false;

  public applyImpulse(impulse: number): void {
    this.earVelocity += impulse;
  }

  public stepPhysics(dt: number = 0.016, timeSec: number = 0): number {
    if (this.staticFreezeMode) {
      return this.earAngleRad;
    }
    const wind = Math.sin(timeSec * 3) * this.windAmplitude;
    const accel = -this.stiffness * this.earAngleRad + wind;
    this.earVelocity = (this.earVelocity + accel * dt) * this.damping;
    this.earAngleRad += this.earVelocity * dt;
    return this.earAngleRad;
  }
}

@zhudaComponent({
  className: 'ZhudaParticleEmitterComponent',
  assetId: 'zhuda://ZhudaParticleEmitterComponent',
  category: '2d',
  description: '決定性靜態粒子發射器組件，支援 t=240ms 靜態像素校準快照與運行期即時爆破特效'
})
export class ZhudaParticleEmitterComponent extends Laya.Script {
  public emitterName: string = 'TacticalMineBurst_v1';
  public burstCount: number = 24;
  public emissionRate: number = 36;
  public lifetimeMs: number = 850;
  public startSpeed: number = 165;
  public gravityY: number = 220;
  public seed: number = 20261028;
  public previewTimestampMs: number = 240;
  public primaryColor: string = '#ff5533';
  public secondaryColor: string = '#ffaa00';
  public sparkColor: string = '#64ffda';
  public coreGlowColor: string = '#231424';

  private particles: LiveParticle[] = [];
  private isPlayingBurst: boolean = false;
  private shockwaveRadius: number = 10;

  /**
   * 於指定座標觸發一次即時粒子爆發 (後組裝運行期調用，支援爆破、揭開、勝利及 M4 特效藍圖庫)
   */
  public playBurst(
    worldX: number,
    worldY: number,
    paletteMode: 'explode' | 'reveal' | 'victory' | 'coin-fountain' | 'sword-slash' | 'levelup-aura' = 'explode'
  ): void {
    const sp = this.owner as Laya.Sprite;
    if (!sp) return;

    sp.pos(worldX - 88, worldY - 88);
    sp.visible = true;
    this.particles = [];
    this.shockwaveRadius = 12;
    this.isPlayingBurst = true;

    let c1 = this.primaryColor;
    let c2 = this.secondaryColor;
    let c3 = this.sparkColor;

    if (paletteMode === 'reveal' || paletteMode === 'sword-slash') {
      c1 = '#00e5ff';
      c2 = '#7df9ff';
      c3 = '#ffffff';
    } else if (paletteMode === 'victory' || paletteMode === 'coin-fountain') {
      c1 = '#fbbf24';
      c2 = '#fef08a';
      c3 = '#4ade80';
    } else if (paletteMode === 'levelup-aura') {
      c1 = '#a855f7';
      c2 = '#e9d5ff';
      c3 = '#64ffda';
    }

    let rngState = this.seed;
    const nextRand = () => {
      rngState = (rngState * 1664525 + 1013904223) >>> 0;
      return rngState / 0xffffffff;
    };

    const count = paletteMode === 'reveal' ? 14 : this.burstCount;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (nextRand() - 0.5) * 0.25;
      const speed = this.startSpeed * (0.55 + nextRand() * 0.55);
      this.particles.push({
        x: 88,
        y: 88,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + (i % 3) * 1.5,
        color: i % 3 === 0 ? c2 : i % 3 === 1 ? c1 : c3,
        alpha: 1,
        ageMs: 0,
        maxAgeMs: this.lifetimeMs * (0.7 + nextRand() * 0.3)
      });
    }
  }

  public onUpdate(): void {
    if (!this.isPlayingBurst) return;
    const sp = this.owner as Laya.Sprite;
    if (!sp || !sp.graphics) return;

    const dtMs = 16.67;
    const dtSec = dtMs / 1000;
    const g = sp.graphics;
    g.clear();

    this.shockwaveRadius += 190 * dtSec;
    if (this.shockwaveRadius < 82) {
      g.drawCircle(88, 88, this.shockwaveRadius, null, this.sparkColor, 1.8);
    }

    let alive = 0;
    for (const p of this.particles) {
      p.ageMs += dtMs;
      if (p.ageMs >= p.maxAgeMs) continue;
      alive++;
      p.vy += this.gravityY * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      const lifeRatio = 1 - p.ageMs / p.maxAgeMs;
      const r = Math.max(1.2, p.radius * lifeRatio);
      g.drawCircle(p.x, p.y, r, p.color);
    }

    if (alive === 0) {
      this.isPlayingBurst = false;
      sp.visible = false;
    }
  }
}

@zhudaComponent({
  className: 'ZhudaAnimatorControllerComponent',
  assetId: 'zhuda://ZhudaAnimatorControllerComponent',
  category: '3d',
  description: 'M5 Unity AnimatorController 跨引擎狀態機組件，支援 Float/Bool/Trigger 條件轉移與 Spine 4.2 聯動'
})
export class ZhudaAnimatorControllerComponent extends Laya.Script {
  public controllerName: string = 'CrystalGuardian.controller';
  public defaultState: string = 'Idle';
  public unityGuid: string = 'u-crystal-004';
  public layaPosRH: string = '2.2,1.8,1.5';
  public layaEulerRH: string = '15,-45,-15';
  public spine42RigFile: string = 'ZhudaGuardianPig_v4.2.skel';
  public statesJson: string = '';
  public transitionsJson: string = '';
  public parametersJson: string = '';

  private fsm: UnityAnimatorStateMachine | null = null;
  private cycleStep: number = 0;

  private ensureFsm(): UnityAnimatorStateMachine {
    if (!this.fsm) {
      const defaultSpec = UNITY_CYBER_SHRINE_SCENE.nodes.find((n) => Boolean(n.animatorController))!
        .animatorController!;
      let spec: UnityAnimatorControllerSpec = defaultSpec;
      if (this.statesJson && this.transitionsJson && this.parametersJson) {
        try {
          spec = {
            controllerName: this.controllerName,
            defaultState: this.defaultState,
            states: JSON.parse(this.statesJson),
            transitions: JSON.parse(this.transitionsJson),
            parameters: JSON.parse(this.parametersJson)
          };
        } catch (_e) {
          spec = defaultSpec;
        }
      }
      this.fsm = new UnityAnimatorStateMachine(spec);
    }
    return this.fsm;
  }

  public getCurrentStateName(): string {
    return this.ensureFsm().getCurrentState().name;
  }

  public getStateTrace(): string[] {
    return this.ensureFsm().getStateHistory();
  }

  public stepAnimatorCycle(): { stateName: string; spineAnim: string; tintHex: string } {
    const fsm = this.ensureFsm();
    this.cycleStep = (this.cycleStep + 1) % 3;
    if (this.cycleStep === 1) {
      fsm.setFloat('Speed', 0.9);
      fsm.setBool('Overcharge', false);
    } else if (this.cycleStep === 2) {
      fsm.setFloat('Speed', 0.9);
      fsm.setBool('Overcharge', true);
    } else {
      fsm.setBool('Overcharge', false);
      fsm.setFloat('Speed', 0.0);
    }
    const st = fsm.getCurrentState();
    return {
      stateName: st.name,
      spineAnim: st.spineAnimationName || 'idle',
      tintHex: st.tintHex || '#38bdf8'
    };
  }
}
