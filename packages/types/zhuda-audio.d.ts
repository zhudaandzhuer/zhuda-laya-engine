import type { AssetProvider } from "./runtime3d/AssetProvider";
import type { IframeAudioChannel, IframeSampleOptions } from "./zhuda-2d-ui";

export interface IframeVoiceOptions {
  /** Higher values survive priority eviction; ties retire the oldest voice. */
  priority?: number;
  /** Explicit voice protection in addition to protected channels. */
  protected?: boolean;
}
export interface IframeVoiceEvent {
  type: "started" | "rejected" | "retiring" | "ended" | "failed";
  id: string;
  channel: IframeAudioChannel;
  reason?: string;
  replacedBy?: string;
}
export interface IframeStreamOptions extends IframeVoiceOptions {
  id: string;
  streamId: string;
  channel?: IframeAudioChannel;
  loop?: boolean;
  offsetSec?: number;
  peakGain?: number;
  fadeInSec?: number;
  replace?: boolean;
  crossFadeSec?: number;
}
export interface IframeStreamInfo {
  id: string;
  integrity: "sha256" | "transport";
  delivery: "native" | "verified-blob";
  /** Encoded bytes held by the provider lease; excludes native decoder memory. */
  retainedBytes: number;
}
/** Adapter connects output to its voice gain. Never connect to destination,
 * apply channel/master gain, create another context, or dispatch the event twice. */
export interface IframeBackendVoice {
  readonly output: AudioNode;
  onended: (() => void) | null;
  start(when: number, offsetSec: number): void;
  stop(when?: number): void;
  disconnect(): void;
}
/** Sample playback extension, suitable for an AudioWorklet implementation.
 * The adapter owns timing, voices, mixer, provider and focus. prepare must honor
 * abort; dispose must release nodes, ports and listeners even after late success. */
export interface IframeSampleBackend {
  readonly name: string;
  prepare(options: {
    context: AudioContext;
    provider: AssetProvider;
    signal: AbortSignal;
  }): Promise<void>;
  createVoice(
    buffer: AudioBuffer,
    options: Readonly<IframeSampleOptions>,
  ): IframeBackendVoice;
  dispose(): void;
}
