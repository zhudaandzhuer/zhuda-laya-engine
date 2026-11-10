// Generated from TypeScript source; run npm run types:generate.
import { type Matrix4, type Quat, type Vec3 } from "../runtime3d/Math3D";
export interface EffectKey {
    time: number;
    value: number;
}
export interface EffectTrack {
    target: string;
    parameter: string;
    keys: EffectKey[];
}
export interface EffectCue {
    time: number;
    target: string;
    action: "start" | "stop" | "event";
    name?: string;
}
export interface EffectAnchor {
    x: number;
    y: number;
    z?: number;
    rotation?: number;
    quaternion?: Quat;
    scale?: Vec3;
    worldMatrix?: Matrix4;
}
export interface EffectAttachment {
    target: string;
    source: string;
    anchor: string;
    offset?: EffectAnchor;
}
export interface EffectTimelineSpec {
    version: 1;
    duration: number;
    loop?: boolean;
    tracks?: EffectTrack[];
    cues?: EffectCue[];
    attachments?: EffectAttachment[];
}
export interface EffectBinding {
    reset(): void;
    setParameter?(name: string, value: number): void;
    start?(name?: string): void;
    stop?(): void;
    event?(name: string): void;
    resolveAnchor?(name: string): EffectAnchor | null;
    setTransform?(value: EffectAnchor): void;
}
export declare function validateEffectTimeline(s: EffectTimelineSpec): string[];
/** Serializable choreography. Bindings own scene objects, sound and Spine APIs. Seek suppresses external event cues by default. */
export declare class ZhudaEffectDirector {
    readonly spec: EffectTimelineSpec;
    time: number;
    playing: boolean;
    cycle: number;
    private initial;
    private readonly bindings;
    constructor(spec: EffectTimelineSpec, bindings: Record<string, EffectBinding>);
    reset(): void;
    play(restart?: boolean): void;
    pause(): void;
    stop(): void;
    update(dt: number): void;
    seek(time: number, dispatchEvents?: boolean): void;
    private advance;
    private apply;
}
