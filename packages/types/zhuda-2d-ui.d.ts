/**
 * @zhuda-laya/types — Layer 2: 2D Rendering, Vector UI & Physics2D (Box2D) Contracts
 * 包含 AutoBitmap 安全防護介面與宣告式 2D UI 建構器型別
 */

export interface VectorButtonStyle {
  width: number;
  height: number;
  radius?: number;
  bgColor?: string;
  hoverBgColor?: string;
  activeBgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  textColor?: string;
  hoverTextColor?: string;
  fontSize?: number;
  bold?: boolean;
}

export interface GlassPanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

/**
 * LayaAir 3.4.2 九宮格 (9-Slice / sizeGrid) 設定：
 * [top, right, bottom, left, repeat(0|1)] 或 "16,16,16,16,0"
 */
export type NineSliceGridInput = string | [number, number, number, number, number?];

export interface NineSlicePanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  sizeGrid: NineSliceGridInput;
  baseWidth?: number;
  baseHeight?: number;
  radius?: number;
  fillColor?: string;
  borderColor?: string;
  cornerAccentColor?: string;
  innerSurfaceColor?: string;
  skin?: string;
  titleText?: string;
  titleColor?: string;
}

export type IframeAudioChannel = 'master' | 'bgm' | 'sfx' | 'ui';

export interface IframeSoundDiagnostics {
  inIframe: boolean;
  contextState: 'suspended' | 'running' | 'closed' | 'uninitialized';
  unlockedByGesture: boolean;
  unlockGestureType: string;
  pageVisible: boolean;
  windowFocused: boolean;
  autoSuspendedByBlur: boolean;
  userMuted: boolean;
  volumes: Record<IframeAudioChannel, number>;
  queuedBeforeUnlockCount: number;
  playedEventsCount: number;
  postMessageBridgeActive: boolean;
  lastBridgeCommand: string;
}

export type ViewportDeviceId =
  | 'desktop-fhd-16-9'
  | 'iphone-15-pro-portrait'
  | 'iphone-15-pro-landscape'
  | 'ipad-air-4-3'
  | 'ultrawide-21-9';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportDeviceSpec {
  id: ViewportDeviceId;
  name: string;
  aspectLabel: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  safeArea: SafeAreaInsets;
}

export interface ViewportLayoutReport {
  deviceId: ViewportDeviceId;
  deviceName: string;
  aspectLabel: string;
  viewportWidth: number;
  viewportHeight: number;
  safeArea: SafeAreaInsets;
  safeZoneRect: { x: number; y: number; width: number; height: number };
  orientation: 'landscape' | 'portrait';
  scaleFactor: number;
  recommendedCameraFov: number;
  recommendedCameraDist: number;
  hudTopBarRect: { x: number; y: number; width: number; height: number };
  mascotRect: { x: number; y: number; width: number; height: number };
  telemetryRect: { x: number; y: number; width: number; height: number };
  boardViewportRect: { x: number; y: number; width: number; height: number };
  safeAreaCompliant: boolean;
  zeroOverflowPassed: boolean;
}

export interface Physics2DGuardStatus {
  physics2DLoaded: boolean;
  box2DFactoryMounted: boolean;
  tilemapShapeRegistered: boolean;
}
