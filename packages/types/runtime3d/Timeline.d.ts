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
