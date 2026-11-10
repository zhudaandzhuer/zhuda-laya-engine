// Generated from TypeScript source; run npm run types:generate.
import type { AssetProvider } from "./runtime3d/AssetProvider.js";
import type { IframeAudioChannel, IframeSampleOptions } from "./zhuda-2d-ui.js";
export interface IframeVoiceOptions {
    /** Higher values survive priority eviction; ties retire the oldest voice. */
    priority?: number;
    /** Explicit voice protection in addition to protected channels. */
    protected?: boolean;
}
export interface IframeOfflineCue {
    id: string;
    sampleId: string;
    atSec: number;
    durationSec: number;
    offsetSec?: number;
    loop?: boolean;
    loopStartSec?: number;
    loopEndSec?: number;
    channel?: IframeAudioChannel;
    peakGain?: number;
    fadeInSec?: number;
    fadeOutSec?: number;
}
export interface IframeOfflineMixOptions {
    durationSec: number;
    sampleRate?: number;
    channels?: 1 | 2;
    maxOutputBytes?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
    cues: readonly IframeOfflineCue[];
}
export interface IframeOfflineMix {
    sampleRate: number;
    channels: number;
    frames: number;
    durationSec: number;
    format: "wav-f32";
    peak: number;
    /** Float WAV preserves over-range samples; encoder/consumer chooses limiting. */
    overRangeSamples: number;
    wav: Uint8Array;
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
    createVoice(buffer: AudioBuffer, options: Readonly<IframeSampleOptions>): IframeBackendVoice;
    dispose(): void;
}
