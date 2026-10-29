/**
 * @zhuda-laya/types — Layer 4: Spine 4.2 Skeletal Animation & PhysicsConstraint Contracts
 * 專為 LayaAir 3.4.2 + Spine 4.2 (spine-core-4.2.js + laya.spine.js + laya.spine3D.js) 設計
 */

export interface Spine42PhysicsTelemetry {
  runtimeVersion: string;
  hasPhysicsConstraint: boolean;
  hasAnimationState: boolean;
  hasSkeleton: boolean;
  layaSpineAdapterReady: boolean;
  layaSpine3DReady: boolean;
  pendulumAngleRad: number;
  pendulumVelocity: number;
  springTension: number;
}
export interface Spine42SpringConfig {
  inertia: number;
  strength: number;
  damping: number;
  wind: number;
  gravity: number;
}
