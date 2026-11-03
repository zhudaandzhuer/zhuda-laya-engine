/**
 * @zhuda-laya/types — Layer 1: Core Runtime & Reflection Contracts
 * 剝離 LayaAir IDE 私有型別 (editor.d.ts / editor-ui.d.ts)，提供純淨的 AI-Native 核心契約
 */

export interface ZhudaCoreDiagnostics {
  version: string;
  stageReady: boolean;
  registeredClassesCount: number;
  activeTimersCount: number;
}

export interface ZhudaClassMetadata {
  className: string;
  assetId?: string;
  category?: '2d' | '3d' | 'ui' | 'spine' | 'physics' | 'gameplay';
  description?: string;
}

export type NoSleepState =
  | 'disabled'
  | 'requesting'
  | 'enabled'
  | 'suspended'
  | 'unsupported'
  | 'denied'
  | 'error'
  | 'disposed';

export interface NoSleepWakeLockSentinel {
  readonly released?: boolean;
  release(): Promise<void> | void;
  addEventListener?(type: 'release', listener: EventListener): void;
  removeEventListener?(type: 'release', listener: EventListener): void;
}

export interface NoSleepWakeLockProvider {
  request(type: 'screen'): Promise<NoSleepWakeLockSentinel>;
}

export interface NoSleepAdapterOptions {
  /** Install pointer/touch/mouse/keyboard listeners that call enable once. */
  autoEnableOnGesture?: boolean;
  /** Release the native sentinel while the page is blurred. */
  releaseOnBlur?: boolean;
  /** Optional provider for hosts and deterministic tests. */
  wakeLockProvider?: () => NoSleepWakeLockProvider | null;
}

export interface NoSleepDiagnostics {
  state: NoSleepState;
  supported: boolean;
  desiredEnabled: boolean;
  pageVisible: boolean;
  windowFocused: boolean;
  requestCount: number;
  releaseCount: number;
  staleRequestCount: number;
  lastError: string | null;
}
