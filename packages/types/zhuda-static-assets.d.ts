/**
 * @zhuda-laya/types — Layer 5: Static Asset Pipeline (.lh / .ls), Isolated Micro-Preview & Pixel/ΔE Calibration Contracts
 *
 * 支援「先設計、轉靜態資產、孤立微預覽、像素/色差 (ΔE) 校準，最後再組裝」的 AI-Native 工作流：
 * - LayaAir 3.4.2 原生 HierarchyParser (.lh / .ls) 對稱序列化契約
 * - Spine 4.2 PhysicsConstraint 靜態骨骼資產與 Particle 靜態粒子發射器藍圖
 * - Tight Bounding Box 像素邊界與 CIE L*a*b* ΔE 色差度量報告
 */

export type StaticAssetCategory =
  | 'ui-prefab'
  | 'nine-slice-ui'
  | 'scene-lh'
  | 'spine42-rig'
  | 'particle-emitter'
  | 'vfx-blueprint'
  | 'unity-migrated';

export interface LayaGraphicsCmdData {
  _$type:
    | 'DrawRoundRectCmd'
    | 'DrawRectCmd'
    | 'DrawCircleCmd'
    | 'DrawEllipseCmd'
    | 'DrawLineCmd'
    | 'DrawPolyCmd'
    | 'DrawPieCmd'
    | 'FillTextCmd';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  lt?: number;
  rt?: number;
  lb?: number;
  rb?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  points?: number[];
  startAngle?: number;
  endAngle?: number;
  fillColor?: string | null;
  lineColor?: string | null;
  lineWidth?: number;
  percent?: boolean;
  text?: string;
  font?: string;
  color?: string;
  align?: string;
}

export interface LayaComponentData {
  _$type: string;
  _$id?: string;
  [key: string]: unknown;
}

export interface LayaHierarchyNodeData {
  _$ver?: number;
  _$id: string;
  _$type: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  alpha?: number;
  visible?: boolean;
  mouseEnabled?: boolean;
  text?: string;
  font?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  align?: string;
  valign?: string;
  leading?: number;
  skin?: string;
  sizeGrid?: string;
  _gcmds?: LayaGraphicsCmdData[];
  _$comp?: LayaComponentData[];
  _$child?: LayaHierarchyNodeData[];
  _zhudaMeta?: {
    assetId: string;
    category: StaticAssetCategory;
    version: string;
    designCanvas: { width: number; height: number; padding: number };
    targetSpec?: PixelCalibrationSpec;
    nineSliceSpec?: {
      sizeGrid: [number, number, number, number, number];
      baseWidth: number;
      baseHeight: number;
    };
  };
}

export interface Spine42StaticRigConfig {
  rigName: string;
  defaultPose: 'idle' | 'thinking' | 'flagging' | 'scared' | 'cheer';
  stiffness: number;
  damping: number;
  windAmplitude: number;
  earAngleRad: number;
  skinPrimaryColor: string;
  skinBorderColor: string;
  bellyHighlightColor: string;
  snoutColor: string;
}

export interface ParticleEmitterStaticConfig {
  emitterName: string;
  burstCount: number;
  emissionRate: number;
  lifetimeMs: number;
  startSpeed: number;
  gravityY: number;
  seed: number;
  previewTimestampMs: number;
  primaryColor: string;
  secondaryColor: string;
  sparkColor: string;
  coreGlowColor: string;
}

export interface PixelCalibrationSpec {
  assetName: string;
  expectedBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  expectedPadding?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  targetColors: {
    primaryFill: string;
    borderStroke?: string;
    accentOrText?: string;
  };
  tolerancePx?: number;
  toleranceDeltaE?: number;
}

export interface ColorLab {
  L: number;
  a: number;
  b: number;
}

export interface AutoFixPatch {
  targetPath: string;
  property: string;
  currentValue: number | string;
  suggestedValue: number | string;
  reason: string;
}

export interface PixelCalibrationReport {
  assetName: string;
  category: StaticAssetCategory;
  passed: boolean;
  measuredBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  expectedBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pixelErrors: {
    xDiffPx: number;
    yDiffPx: number;
    widthDiffPx: number;
    heightDiffPx: number;
    maxAbsErrorPx: number;
  };
  colorMetrics: {
    measuredPrimaryFill: string;
    targetPrimaryFill: string;
    primaryDeltaE76: number;
    primaryDeltaE2000: number;
    measuredBorderStroke: string;
    targetBorderStroke: string;
    borderDeltaE2000: number;
    measuredAccentOrText: string;
    targetAccentOrText: string;
    accentDeltaE2000: number;
    maxDeltaE2000: number;
  };
  pixelBufferTelemetry?: {
    canvasWidth: number;
    canvasHeight: number;
    nonTransparentPixels: number;
    coveragePercent: number;
    sampledDominantHex: string;
  };
  autoFixPatches: AutoFixPatch[];
  summary: string;
}

export interface NineSliceCalibrationReport {
  assetName: string;
  sizeGrid: [number, number, number, number, number];
  baseSize: { width: number; height: number };
  stretchedSize: { width: number; height: number };
  stretchRatioX: number;
  stretchRatioY: number;
  cornerPins: {
    topLeft: { x: number; y: number; width: number; height: number };
    topRight: { x: number; y: number; width: number; height: number };
    bottomLeft: { x: number; y: number; width: number; height: number };
    bottomRight: { x: number; y: number; width: number; height: number };
  };
  maxCornerDistortionPx: number;
  centerSliceSize: { width: number; height: number };
  passed: boolean;
}

export type VfxBlueprintId =
  | 'MineExplosionParticle.lh'
  | 'CoinFountainVfx.lh'
  | 'SwordSlashTrailVfx.lh'
  | 'LevelUpAuraVfx.lh';

export interface UnityAnimatorParameter {
  name: string;
  type: 'float' | 'int' | 'bool' | 'trigger';
  defaultValue: number | boolean;
}

export interface UnityAnimatorCondition {
  parameter: string;
  mode: 'If' | 'IfNot' | 'Greater' | 'Less' | 'Equals';
  threshold?: number;
}

export interface UnityAnimatorTransition {
  fromState: string;
  toState: string;
  durationSec: number;
  hasExitTime: boolean;
  conditions: UnityAnimatorCondition[];
}

export interface UnityAnimatorState {
  name: string;
  motionClip: string;
  speed: number;
  loop: boolean;
  spineAnimationName?: string;
  scalePulseAmplitude?: number;
  rotationSpeedDeg?: number;
  tintHex?: string;
}

export interface UnityAnimatorControllerSpec {
  controllerName: string;
  defaultState: string;
  parameters: UnityAnimatorParameter[];
  states: UnityAnimatorState[];
  transitions: UnityAnimatorTransition[];
}

export interface UnityNodeSpec {
  guid: string;
  name: string;
  unityType: 'Camera' | 'DirectionalLight' | 'MeshRenderer' | 'Spine42SkeletonAnimation' | 'CanvasUI';
  positionLH: [number, number, number];
  rotationEulerLH: [number, number, number];
  scale: [number, number, number];
  primitiveType?: 'box' | 'sphere' | 'cylinder' | 'capsule' | 'cone' | 'plane';
  material?: {
    shader: 'Universal Render Pipeline/Lit' | 'Standard' | 'Legacy Shaders/BlinnPhong' | 'Unlit/Color';
    albedoColor: [number, number, number, number];
    metallic?: number;
    smoothness?: number;
    emissionHex?: string;
  };
  animatorController?: UnityAnimatorControllerSpec;
  spine42Asset?: {
    skeletonFile: string;
    atlasFile: string;
    skin: string;
    defaultAnimation: string;
    physicsConstraintsCount: number;
    stiffness: number;
    damping: number;
  };
}

export interface UnitySceneDescriptor {
  sceneName: string;
  unityVersion: string;
  coordinateSystem: 'LeftHanded_YUp';
  ambientColor: [number, number, number, number];
  nodes: UnityNodeSpec[];
}

export interface UnityMigrationReport {
  sourceSceneName: string;
  targetSceneAsset: string;
  targetPrefabAsset: string;
  convertedNodesCount: number;
  handednessConvertedNodes: Array<{
    name: string;
    unityPosLH: [number, number, number];
    layaPosRH: [number, number, number];
    unityEulerLH: [number, number, number];
    layaEulerRH: [number, number, number];
  }>;
  mappedMaterials: Array<{
    nodeName: string;
    unityShader: string;
    layaMaterialClass: string;
  }>;
  animatorVerification: {
    controllerName: string;
    statesCount: number;
    transitionsCount: number;
    simulatedTransitionTrace: string[];
    transitionPassed: boolean;
  };
  spine42Verification: {
    skeletonFile: string;
    physicsConstraintsMounted: number;
    compatibleWithRuntime42: boolean;
  };
  passed: boolean;
}
