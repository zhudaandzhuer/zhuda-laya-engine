import type {
  ManagedRuntimeOptions,
  ZhudaRuntimeSession,
} from "./runtime3d/Runtime";
import type { Physics2DGuardStatus } from "./zhuda-2d-ui";
import type { Physics3DGuardStatus } from "./zhuda-3d-physics";
import type { Spine42PhysicsTelemetry } from "./zhuda-spine42";

export type EngineFeatureTag =
  | "core"
  | "2d"
  | "3d"
  | "ui"
  | "ui2"
  | "physics2d"
  | "physics3d"
  | "spine42"
  | "spine3d"
  | "navmesh2d"
  | "navmesh3d"
  | "particle2d"
  | "particle3d"
  | "trail2d"
  | "trail3d"
  | "effects2d"
  | "tilemap"
  | "gltf"
  | "ik"
  | "postProcess"
  | "device"
  | "ani";
export interface EngineModuleNode {
  id: string;
  file: string;
  sizeBytes: number;
  feature: EngineFeatureTag;
  dependsOn: string[];
  conflictsWith?: string[];
  providesGlobals: string[];
  priority: number;
  painPointNote?: string;
}
export interface TopologyResolutionResult {
  orderedModules: EngineModuleNode[];
  orderedFiles: string[];
  totalSizeBytes: number;
  totalSizeKB: number;
  prunedRatioPercent: number;
  fullEngineSizeBytes: number;
  diagnostics: string[];
}
export interface EngineHealthReport {
  timestamp: number;
  engineVersion: string;
  prototypeDetoxApplied: boolean;
  buttonSetStateGuarded: boolean;
  registeredComponents: string[];
  physics2D: Physics2DGuardStatus;
  physics3D: Physics3DGuardStatus;
  spine42: Spine42PhysicsTelemetry;
  loadedGlobalModules: number;
}
export interface ZhudaBootOptions
  extends Omit<ManagedRuntimeOptions, "container"> {
  container?: HTMLElement | string;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  width?: number;
  height?: number;
  bgColor?: string;
  scaleMode?: string;
  screenMode?: string;
  features?: EngineFeatureTag[] | "all";
  beforeInit?: () => void;
}
export interface ZhudaBootContext {
  canvas: HTMLCanvasElement;
  runtime: ZhudaRuntimeSession;
  resize(): void;
  dispose(): void;
  stage: Laya.Stage;
  rootScene: Laya.Scene;
  topology: TopologyResolutionResult;
  health: EngineHealthReport;
}
export declare class ZhudaEngine {
  static boot(options?: ZhudaBootOptions): Promise<ZhudaBootContext>;
  static getContext(): ZhudaBootContext | null;
  static flushRenderFrames(frameCount?: number): void;
}
