// Generated from TypeScript source; run npm run types:generate.
import { ZhudaLayeredClock, ZhudaRealtimeClock, ZhudaTimerScheduler, type ZhudaClockSample } from './Clocks';
import { ZhudaSceneMutationQueue } from './SceneMutation';
import { type ZhudaRuntimeDriver } from './RuntimeDriver';
export interface ManagedRuntimeOptions {
    container?: HTMLElement;
    dprCap?: number;
    /** Omit for responsive CSS-pixel units. A fixed design is fitted into the container. */
    designSize?: {
        width: number;
        height: number;
    };
    scaleMode?: string;
    /** Owned by this session; defaults to RAF. */
    driver?: ZhudaRuntimeDriver;
    backgroundPolicy?: 'pause' | 'continue';
    /** Foreground recovery never replays an unbounded suspended interval. */
    recoveryPolicy?: 'discard' | 'bounded';
    maxFrameDeltaSec?: number;
    onResume?: (report: {
        elapsedSec: number;
        advancedSec: number;
        discardedSec: number;
    }) => void;
    targetFPS?: 30 | 60;
    timeScale?: number;
    clearInput?: () => void;
    onPause?: (paused: boolean) => void;
    onContextLost?: () => void;
    onResize?: (size: {
        width: number;
        height: number;
        dpr: number;
    }) => void;
}
/** Opaque-origin frames cannot access origin storage. Provide realm-local memory
 * so Laya initialization can proceed. Durable saves belong to the trusted host. */
export declare function installSandboxStorageFallback(): Record<string, "persistent" | "memory">;
/** Owns one update task and its listeners. Laya rendering remains on the engine scheduler. */
export declare class ZhudaRuntimeSession {
    readonly canvas: HTMLCanvasElement;
    readonly options: ManagedRuntimeOptions;
    paused: boolean;
    contextLost: boolean;
    disposed: boolean;
    readonly clock: ZhudaRealtimeClock;
    /** Named channels driven by the same RAF clock as `clock` and `timers`. */
    readonly layers: ZhudaLayeredClock;
    readonly timers: ZhudaTimerScheduler;
    readonly mutations: ZhudaSceneMutationQueue;
    private cleanups;
    private started;
    private previous;
    private readonly driver;
    private background;
    private manuallyPaused;
    private suspendedAt?;
    private recoveryDelta;
    private task;
    private observer?;
    constructor(canvas: HTMLCanvasElement, options?: ManagedRuntimeOptions);
    /** Shared WebGL context/WebGPU device-loss path; a new realm owns recovery. */
    notifyContextLost(): void;
    setPaused(value: boolean): void;
    private setBackground;
    resize(): void;
    start(update: (dt: number, sample?: ZhudaClockSample) => void): void;
    dispose(): void;
}
/** Separate JavaScript/WebGL realm; replacing a failed frame releases its engine, tasks and listeners. */
export declare class ZhudaRuntimeHost {
    readonly container: HTMLElement;
    readonly url: string;
    readonly options: {
        sandbox?: string;
        onReady?: (generation: number) => void;
        onMessage?: (value: any) => void;
    };
    frame: HTMLIFrameElement | null;
    generation: number;
    restarts: number;
    private disposed;
    private cleanup;
    private state;
    constructor(container: HTMLElement, url: string, options?: {
        sandbox?: string;
        onReady?: (generation: number) => void;
        onMessage?: (value: any) => void;
    });
    send(type: string, state?: unknown): void;
    restart(state?: unknown): void;
    dispose(): void;
}
export interface PointerRoleState {
    pointerId: number;
    role: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
}
/** Pointer IDs own independent roles. DOM UI can be excluded before capture; cancel/blur always release. */
export declare class ZhudaPointerInput {
    readonly element: HTMLElement;
    readonly chooseRole: (e: PointerEvent) => string | null;
    readonly changed: (state: ReadonlyMap<number, PointerRoleState>) => void;
    readonly pointers: Map<number, PointerRoleState>;
    private cleanup;
    constructor(element: HTMLElement, chooseRole: (e: PointerEvent) => string | null, changed: (state: ReadonlyMap<number, PointerRoleState>) => void);
    clear(): void;
    dispose(): void;
}
