// Generated from TypeScript source; run npm run types:generate.
/**
 * Single WebAudio authority for embedded games.
 *
 * The adapter owns context creation, the master/channel mixer, autoplay
 * unlocking, bridge security and every voice's lifetime. Consumers submit
 * logical events through scheduleTone; they must not create another
 * AudioContext for the same event.
 */
import type { IframeAudioChannel, IframeSoundAdapterOptions, IframeSoundDiagnostics, IframeToneOptions, IframeSampleOptions, IframeSampleInfo } from "./index";
import type { IframeStreamOptions, IframeStreamInfo, IframeSampleBackend } from "./zhuda-audio";
import type { IframeOfflineMixOptions, IframeOfflineMix } from "./zhuda-audio";
export interface QueuedAudioTask {
    sampleId?: string;
    streamId?: string;
    id: string;
    channel: IframeAudioChannel;
    createdAt: number;
    execute: () => boolean;
}
export declare class IframeSoundAdapter {
    private static instance;
    private readonly options;
    private readonly allowedParentOrigins;
    private readonly now;
    private readonly cleanupFns;
    private readonly gestureCleanupFns;
    private ctx;
    private masterGain;
    private channelGains;
    private inIframe;
    private unlockedByGesture;
    private unlockGestureType;
    private pageVisible;
    private windowFocused;
    private autoSuspendedByBlur;
    private userMuted;
    private postMessageBridgeActive;
    private lastBridgeCommand;
    private lastError;
    private disposed;
    private unlockAttempt;
    private volumes;
    private pendingQueue;
    private queuedBeforeUnlockCount;
    private droppedQueue;
    private activeVoices;
    private droppedVoices;
    private playedEventsCount;
    private voiceSerial;
    private sampleCache?;
    private readonly samples;
    private readonly sampleLoads;
    private readonly sampleTimeoutMs;
    private readonly maxSamples;
    private readonly maxDecodedSampleBytes;
    private readonly maxRetainedStreamBytes;
    private streamCache?;
    private readonly streams;
    private readonly streamLoads;
    private readonly admissions;
    private retiredVoices;
    private sampleBackend?;
    private backendPreparing?;
    private backendContextLost;
    private offlineMix;
    static getShared(): IframeSoundAdapter;
    constructor(options?: IframeSoundAdapterOptions);
    private recordError;
    private voiceEvent;
    private validVoice;
    private admit;
    private detectIframeContext;
    private defaultAudioContextFactory;
    private ensureAudioContext;
    private getEffectiveMasterVolume;
    private setGainValue;
    private updateGainNodes;
    private syncStreamFocus;
    /** Optional state mirroring for consumers that explicitly still use Laya SoundManager. */
    private syncLayaSoundManager;
    private addEventListener;
    private removeGestureUnlockGuards;
    private installGestureUnlockGuards;
    private markUnlocked;
    private playSilentUnlockSample;
    /** Unlocks only after a real context exists and resume succeeds or is already running. */
    unlockAudio(gestureSource?: string): boolean;
    private flushPendingQueue;
    private installVisibilityAndFocusGuards;
    handleFocusOrVisibilityChange(visible: boolean, focused: boolean): void;
    private isAllowedBridgeOrigin;
    private installPostMessageBridge;
    handleBridgeMessage(msg: {
        type: string;
        channel?: IframeAudioChannel;
        volume?: number;
    }): IframeSoundDiagnostics;
    setMuted(muted: boolean): void;
    isMuted(): boolean;
    setChannelVolume(channel: IframeAudioChannel, volume: number): boolean;
    getChannelVolume(channel: IframeAudioChannel): number;
    private validateTone;
    private runSynthesis;
    private submit;
    /** Queues once before unlock, then starts one voice through the shared mixer. */
    scheduleTone(options: IframeToneOptions): boolean;
    private sampleInfo;
    /** Load and decode a provider logical ID. Repeated callers share the existing cache work. */
    loadSample(id: string, options?: {
        signal?: AbortSignal;
    }): Promise<IframeSampleInfo>;
    /** Stops this sample's queued/active voices, cancels pending loads and releases its PCM lease. */
    unloadSample(id: string): boolean;
    /** Install one sample backend before playback. No implicit fallback after
     * failure: the caller may retry or retain native playback explicitly. */
    prepareSampleBackend(backend: IframeSampleBackend, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    loadStream(id: string, options?: {
        signal?: AbortSignal;
    }): Promise<IframeStreamInfo>;
    unloadStream(id: string): boolean;
    playStream(options: IframeStreamOptions): boolean;
    playSample(options: IframeSampleOptions): boolean;
    /** Explicit offline soundtrack using loaded samples and this mixer's gain snapshot.
     * Does not play live voices, use a second live AudioContext or dispatch events. */
    renderOffline(options: IframeOfflineMixOptions): Promise<IframeOfflineMix>;
    stop(id: string, fadeOutSec?: number): boolean;
    private finishVoice;
    private stopVoice;
    stopAll(channel?: IframeAudioChannel): number;
    getDiagnostics(): IframeSoundDiagnostics;
    private syncDomTelemetry;
    /** Stops voices, removes every event listener and closes the owned context. */
    dispose(): void;
}
