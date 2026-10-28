/**
 * @zhuda-laya/types — Layer 3: 3D Scene Graph, PBR/BlinnPhong Materials & Bullet Physics3D Contracts
 */

export type PrimitiveType3D = 'box' | 'sphere' | 'cylinder' | 'capsule' | 'plane' | 'cone';

export interface DeclarativeMaterialOptions {
  type?: 'blinn-phong' | 'pbr' | 'unlit';
  albedoColor: [number, number, number, number];
  shininess?: number;
  metallic?: number;
  smoothness?: number;
}

export interface DeclarativeCameraOptions {
  fov?: number;
  near?: number;
  far?: number;
  position: [number, number, number];
  rotationEuler?: [number, number, number];
  clearColor?: [number, number, number, number];
}

export interface DeclarativeLightOptions {
  color?: [number, number, number, number];
  intensity?: number;
  rotationEuler?: [number, number, number];
}

export interface Physics3DGuardStatus {
  bulletLoaded: boolean;
  physics3DLoaded: boolean;
  wasmInitialized: boolean;
}
