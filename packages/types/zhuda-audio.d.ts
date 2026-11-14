// Generated from TypeScript source; run npm run types:generate.
import type { AssetProvider } from "./runtime3d/AssetProvider.js";
import type { IframeAudioChannel, IframeSampleOptions } from "./zhuda-2d-ui.js";
export interface IframeVoiceOptions {
    /** Higher values survive priority eviction; ties retire the oldest voice. */
    priority?: number;
    /** Explicit voice protection in addition to protected channels. */
    protected?: boolean;
}
/**
 * Where a sample sounds from, for `playSample({ spatial })`. Positions are in
 * the game's world, in the same coordinates as `setListener`. Defaults are the
 * Web Audio ones: inverse distance from 1 m, no cone.
 */
export interface IframeSpatialOptions {
    /** Where the sound is, [x, y, z] in metres. */
    position: readonly [number, number, number];
    /** The way a directional source faces; only matters with a cone (default [1, 0, 0]). */
    orientation?: readonly [number, number, number];
    /** 'HRTF' (default; binaural where the browser has it) or 'equalpower' (cheaper, for speakers). */
    panningModel?: "HRTF" | "equalpower";
    /** How the volume falls with distance (default 'inverse'). */
    distanceModel?: "linear" | "inverse" | "exponential";
    /** Closer than this the volume does not grow (default 1 m). */
    refDistance?: number;
    /** Beyond this the volume falls no further; 'linear' is silent there (default 10000 m). */
    maxDistance?: number;
    /** How fast the volume falls (default 1; at most 1 for 'linear'). */
    rolloffFactor?: number;
    /** Full volume inside this cone, in degrees (default 360: no cone). */
    coneInnerAngle?: number;
    /** Outer edge of the cone, in degrees, not less than the inner (default 360). */
    coneOuterAngle?: number;
    /** Gain outside the outer cone, 0..1 (default 0). */
    coneOuterGain?: number;
}
/** The listener for spatial samples, usually the camera, from `setListener`. */
export interface IframeListenerPose {
    /** [x, y, z] in metres. */
    position: readonly [number, number, number];
    /** The way the listener faces (default [0, 0, -1]). */
    forward?: readonly [number, number, number];
    /** The listener's up, not along forward (default [0, 1, 0]). */
    up?: readonly [number, number, number];
    /** Glide to the pose over this many seconds of audio time, 0..1 (default 0: at once). */
    rampSec?: number;
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
