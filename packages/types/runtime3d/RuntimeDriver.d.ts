// Generated from TypeScript source; run npm run types:generate.
/** All timestamps are monotonic milliseconds in the driver's single time domain. */
export interface ZhudaRuntimeDriver {
    now(): number;
    start(frame: (nowMs: number) => void): void;
    setBackground(background: boolean): void;
    stop(): void;
    dispose(): void;
}
export declare class ZhudaRafDriver implements ZhudaRuntimeDriver {
    private frame;
    private generation;
    now(): number;
    start(callback: (nowMs: number) => void): void;
    setBackground(_background: boolean): void;
    stop(): void;
    dispose(): void;
}
export interface ZhudaWorkerDriverOptions {
    intervalMs?: number;
    /** Host/CSP integration may provide an owned Worker with the documented protocol. */
    workerFactory?: () => Worker;
    onError?: (error: Error) => void;
}
/** Worker messages only wake the one runtime clock; no game state runs there.
 * Browsers may freeze both threads. Recovery belongs to RuntimeSession policy. */
export declare class ZhudaWorkerFrameDriver implements ZhudaRuntimeDriver {
    private readonly raf;
    private readonly worker;
    private callback?;
    private generation;
    private background;
    private disposed;
    private readonly intervalMs;
    constructor(options?: ZhudaWorkerDriverOptions);
    now(): number;
    start(callback: (nowMs: number) => void): void;
    setBackground(background: boolean): void;
    private switchSource;
    stop(): void;
    dispose(): void;
}
