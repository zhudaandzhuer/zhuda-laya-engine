// Generated from TypeScript source; run npm run types:generate.
export type TimelineValue = number | boolean | string | readonly number[];
export type TimelineTrackKind = 'number' | 'boolean' | 'vector' | 'event';
export interface TimelineKey<T extends TimelineValue = TimelineValue> {
    time: number;
    value: T;
}
export interface TimelineTrack {
    id: string;
    target: string;
    kind: TimelineTrackKind;
    interpolation?: 'step' | 'linear';
    keys: readonly TimelineKey[];
}
export interface ZhudaTimelineSpec {
    schemaVersion: 1;
    duration: number;
    tracks: readonly TimelineTrack[];
}
export interface ZhudaTimelineBinding {
    set?(value: TimelineValue, time: number, track: Readonly<TimelineTrack>): void;
    cue?(value: string, time: number, track: Readonly<TimelineTrack>): void;
}
export interface ZhudaTimelineSeekOptions {
    emitEvents?: boolean;
}
export interface ZhudaOfflineFrame {
    readonly index: number;
    readonly time: number;
    readonly deltaSeconds: number;
}
export interface ZhudaOfflineFrameCapture {
    readonly ready: true;
    readonly imagePath: string;
    readonly imageSha256?: string;
    readonly referenceSha256?: string;
    readonly metrics?: Readonly<Record<string, number>>;
}
export interface ZhudaOfflineFrameRecorderOptions {
    /** Total duration, including the frame at t=0. */
    readonly durationSeconds: number;
    /** Fixed output rate. durationSeconds * fps must be an integer. */
    readonly fps: number;
    readonly maxFrames?: number;
    /** Deadline per callback; callbacks receive the run signal. Default 15000ms. */
    readonly stepTimeoutMs?: number;
    readonly signal?: AbortSignal;
    /** Advance the consumer timeline by the supplied fixed frame. */
    readonly advance: (frame: ZhudaOfflineFrame, signal: AbortSignal) => void | Promise<void>;
    /** Capture one frame after advance has completed. */
    readonly capture: (frame: ZhudaOfflineFrame, signal: AbortSignal) => ZhudaOfflineFrameCapture | Promise<ZhudaOfflineFrameCapture>;
}
export declare function validateTimelineSpec(spec: unknown): string[];
/** Deterministic presentation timeline. The consumer supplies the clock and bindings. */
export declare class ZhudaTimelineSequencer {
    readonly spec: Readonly<ZhudaTimelineSpec>;
    private readonly bindings;
    private time;
    private disposed;
    constructor(spec: ZhudaTimelineSpec, bindings: Record<string, ZhudaTimelineBinding>);
    private check;
    private apply;
    sample(time: number): Readonly<Record<string, TimelineValue>>;
    seek(time: number, options?: ZhudaTimelineSeekOptions): void;
    update(deltaSeconds: number): number;
    reset(): void;
    get currentTime(): number;
    get complete(): boolean;
    dispose(): void;
}
/**
 * Fixed-step capture driver for cinematic evidence and offline producers.
 * It advances a consumer callback; it does not own a renderer, clock, file
 * system or encoder. The caller remains responsible for real pixel capture.
 */
export declare class ZhudaOfflineFrameRecorder {
    private readonly options;
    private readonly frameCount;
    private disposed;
    private recording;
    private controller;
    constructor(options: ZhudaOfflineFrameRecorderOptions);
    private check;
    record(): Promise<readonly (ZhudaOfflineFrame & {
        readonly capture: ZhudaOfflineFrameCapture;
    })[]>;
    dispose(): void;
}
