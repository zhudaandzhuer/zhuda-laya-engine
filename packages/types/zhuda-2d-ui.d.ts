// Generated from TypeScript source; run npm run types:generate.
import type { IframeVoiceOptions } from './zhuda-audio.js';
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
export interface IframeSoundAdapterOptions {
    /** Borrowed provider; the adapter owns decoded sample leases, not this provider. */
    sampleProvider?: import('./runtime3d/AssetProvider.js').AssetProvider;
    sampleTimeoutMs?: number;
    maxSamples?: number;
    /** Total retained decoded PCM bound (channels * frames * 4). Default 64 MiB. */
    maxDecodedSampleBytes?: number;
    /** Encoded stream-lease budget, separate from decoded PCM. Default 64 MiB. */
    maxRetainedStreamBytes?: number;
    /** Parent origins accepted by the postMessage bridge. Same-origin is used when omitted. */
    allowedParentOrigins?: readonly string[];
    /** Maximum age of a pre-gesture event before it is discarded. Defaults to 500 ms. */
    queueMaxAgeMs?: number;
    /** Maximum number of pending events retained before unlock. Defaults to 32. */
    maxPendingQueue?: number;
    /** Maximum number of simultaneously active voices. Defaults to 32. */
    maxActiveVoices?: number;
    /** Overflow defaults to reject for compatibility. */
    voiceOverflow?: 'reject' | 'fifo' | 'priority';
    protectedChannels?: readonly IframeAudioChannel[];
    /** Eviction fade, default 0.005 seconds. A fading voice still occupies its slot. */
    retireFadeSec?: number;
    onVoiceEvent?: (event: import('./zhuda-audio.js').IframeVoiceEvent) => void;
    /** Borrowed provider; defaults to sampleProvider. */
    streamProvider?: import('./runtime3d/AssetProvider.js').AssetProvider;
    /** Injectable for platform integration and tests. One element per live stream voice. */
    mediaElementFactory?: () => HTMLAudioElement;
    /** Optional factory used by hosts and deterministic tests. */
    audioContextFactory?: () => AudioContext | null;
    /** Clock used for queue expiry; production defaults to Date.now. */
    now?: () => number;
    /** Opt in to mirroring volume/mute state to Laya's SoundManager. */
    syncLayaSoundManager?: boolean;
}
export interface IframeToneOptions extends IframeVoiceOptions {
    id: string;
    channel?: IframeAudioChannel;
    waveType?: OscillatorType;
    startFreq: number;
    endFreq?: number;
    durationSec: number;
    peakGain?: number;
    delaySec?: number;
}
export interface IframeSampleInfo {
    id: string;
    durationSec: number;
    channels: number;
    sampleRate: number;
    frames: number;
    decodedBytes: number;
}
export interface IframeSampleOptions extends IframeVoiceOptions {
    /** Logical event/voice identity, distinct from the provider asset ID. */
    id: string;
    sampleId: string;
    channel?: IframeAudioChannel;
    loop?: boolean;
    loopStartSec?: number;
    loopEndSec?: number;
    offsetSec?: number;
    durationSec?: number;
    peakGain?: number;
    fadeInSec?: number;
    fadeOutSec?: number;
    /** Start the new voice before stopping matching IDs; requires a free voice slot. */
    replace?: boolean;
    crossFadeSec?: number;
}
export interface AudioVoiceHandle {
    readonly id: string;
    readonly channel: IframeAudioChannel;
    readonly stopped: boolean;
    stop(): boolean;
}
export interface IframeSoundDiagnostics {
    loadedStreams: number;
    pendingStreamLoads: number;
    retainedStreamBytes: number;
    pendingAdmissions: number;
    retiredVoices: number;
    sampleBackend: string;
    loadedSamples: number;
    pendingSampleLoads: number;
    decodedSampleBytes: number;
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
    pendingQueue: number;
    droppedQueue: number;
    activeVoices: number;
    droppedVoices: number;
    playedEventsCount: number;
    postMessageBridgeActive: boolean;
    lastBridgeCommand: string;
    backend: 'webaudio' | 'unavailable';
    contextAvailable: boolean;
    lastError: string | null;
}
export type ViewportDeviceId = 'desktop-fhd-16-9' | 'iphone-15-pro-portrait' | 'iphone-15-pro-landscape' | 'ipad-air-4-3' | 'ultrawide-21-9';
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
    safeZoneRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    orientation: 'landscape' | 'portrait';
    scaleFactor: number;
    recommendedCameraFov: number;
    recommendedCameraDist: number;
    hudTopBarRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    mascotRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    telemetryRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    boardViewportRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    safeAreaCompliant: boolean;
    zeroOverflowPassed: boolean;
}
export interface Physics2DGuardStatus {
    physics2DLoaded: boolean;
    box2DFactoryMounted: boolean;
    tilemapShapeRegistered: boolean;
}
