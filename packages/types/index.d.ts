/// <reference path="./vendor/LayaAir.runtime.d.ts" />
/// <reference path="./vendor/spine.runtime.d.ts" />

export * from './zhuda-core';
export * from './zhuda-bootstrap';
export * from './zhuda-2d-ui';
export * from './zhuda-3d-physics';
export * from './zhuda-spine42';
export * from './zhuda-static-assets';
export * from './zhuda-visual-contract';
export * from './zhuda-particles';
export * from './zhuda-effects';

export * from './runtime3d/index';
export * from './zhuda-declarative';
export * from './prefabs/index';

export * from "./terrain/index";
export * from "./shaders/index";

/** Runtime audio mixer exported by packages/core/IframeSoundAdapter. */
export declare class IframeSoundAdapter {
  static getShared(): IframeSoundAdapter;
  constructor(options?: import('./zhuda-2d-ui').IframeSoundAdapterOptions);
  unlockAudio(gestureSource?: string): boolean;
  handleFocusOrVisibilityChange(visible: boolean, focused: boolean): void;
  handleBridgeMessage(msg: { type: string; channel?: import('./zhuda-2d-ui').IframeAudioChannel; volume?: number }): import('./zhuda-2d-ui').IframeSoundDiagnostics;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  setChannelVolume(channel: import('./zhuda-2d-ui').IframeAudioChannel, volume: number): boolean;
  getChannelVolume(channel: import('./zhuda-2d-ui').IframeAudioChannel): number;
  scheduleTone(options: import('./zhuda-2d-ui').IframeToneOptions): boolean;
  prepareSampleBackend(backend: import('./zhuda-audio').IframeSampleBackend, options?: { signal?: AbortSignal }): Promise<void>;
  loadStream(id: string, options?: { signal?: AbortSignal }): Promise<import('./zhuda-audio').IframeStreamInfo>;
  unloadStream(id: string): boolean;
  playStream(options: import('./zhuda-audio').IframeStreamOptions): boolean;
  loadSample(id: string, options?: { signal?: AbortSignal }): Promise<import('./zhuda-2d-ui').IframeSampleInfo>;
  unloadSample(id: string): boolean;
  playSample(options: import('./zhuda-2d-ui').IframeSampleOptions): boolean;
  stop(id: string, fadeOutSec?: number): boolean;
  stopAll(channel?: import('./zhuda-2d-ui').IframeAudioChannel): number;
  getDiagnostics(): import('./zhuda-2d-ui').IframeSoundDiagnostics;
  dispose(): void;
}

/** Native Screen Wake Lock / NoSleep-compatible lifecycle service. */
export declare class NoSleepAdapter {
  constructor(options?: import('./zhuda-core').NoSleepAdapterOptions);
  enable(): Promise<boolean>;
  disable(): void;
  isEnabled(): boolean;
  getDiagnostics(): import('./zhuda-core').NoSleepDiagnostics;
  dispose(): void;
}

export type * from './zhuda-audio';
export type * from './zhuda-branding';
