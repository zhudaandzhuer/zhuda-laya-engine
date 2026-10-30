export interface ManagedRuntimeOptions {
    container?: HTMLElement;
    dprCap?: number;
    targetFPS?: 30 | 60;
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
    private cleanups;
    private frame;
    private previous;
    private task;
    private observer?;
    constructor(canvas: HTMLCanvasElement, options?: ManagedRuntimeOptions);
    setPaused(value: boolean): void;
    resize(): void;
    start(update: (dt: number) => void): void;
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
