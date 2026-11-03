export type ZhudaActionPhase = "startup" | "active" | "recovery" | "complete";
/** A half-open frame interval: `from` is included and `until` is excluded. */
export interface ZhudaFrameWindow {
    from: number;
    until: number;
}
export interface ZhudaActionCancelWindow extends ZhudaFrameWindow {
    actions: readonly string[];
}
export interface ZhudaActionFrameEvent {
    frame: number;
    id: string;
    payload?: unknown;
}
/** A renderer-neutral socket declaration. The model adapter resolves `bone`. */
export interface ZhudaBoneSocketDefinition {
    id: string;
    bone: string;
    offset?: {
        x: number;
        y: number;
        z?: number;
    };
}
/**
 * Consumer-authored frame data for one action. The engine validates and plays
 * timing; movement, damage and animation pose remain consumer responsibilities.
 */
export interface ZhudaActionFrameSpec {
    id: string;
    frameRate: number;
    frameCount: number;
    startup: ZhudaFrameWindow;
    active: ZhudaFrameWindow;
    recovery: ZhudaFrameWindow;
    cancelWindows?: readonly ZhudaActionCancelWindow[];
    events?: readonly ZhudaActionFrameEvent[];
    sockets?: readonly ZhudaBoneSocketDefinition[];
}
/** Returns actionable errors instead of throwing so tools can show all issues at once. */
export declare function validateActionFrameSpec(spec: ZhudaActionFrameSpec): string[];
/** Deterministic frame clock for one consumer-authored action. */
export declare class ZhudaActionStateMachine {
    readonly spec: ZhudaActionFrameSpec;
    private currentFrame;
    private eventIndex;
    private playing;
    constructor(spec: ZhudaActionFrameSpec);
    get frame(): number;
    get isPlaying(): boolean;
    get isComplete(): boolean;
    get phase(): ZhudaActionPhase;
    get normalizedTime(): number;
    get active(): boolean;
    reset(): void;
    play(reset?: boolean): void;
    stop(): void;
    advance(deltaSeconds: number): ZhudaActionFrameEvent[];
    canCancelInto(actionId: string): boolean;
    getSocket(id: string): ZhudaBoneSocketDefinition | null;
}
