// Generated from TypeScript source; run npm run types:generate.
/**
 * The engine's opening screen (the splash a built page shows) and when it has gone.
 *
 * A built page keeps `window.__ZHUDA_SPLASH__`: `completed` when the splash starts to leave,
 * `gone` when its node is out of the page, and it sends `zhuda:splash-gone` on `window` once.
 * A script that presses or photographs the page waits for that and not for a fixed time.
 */
export interface ZhudaSplashState {
    readonly started: boolean;
    readonly completed: boolean;
    readonly loaded: boolean;
    readonly gone: boolean;
    readonly mode: string;
    readonly durationMs: number;
}
/** The splash's state, or null on a page that was not built with one (a test page, a mini-game). */
export declare function zhudaSplashState(host?: unknown): ZhudaSplashState | null;
/**
 * Resolves when the splash is out of the page: at once where there is none, or it has gone.
 * Rejects after `timeoutMs` (default 30 s; 0 waits for ever), so a page that never finishes
 * loading does not hang a script without saying why.
 */
export declare function whenZhudaSplashGone(options?: {
    timeoutMs?: number;
    host?: unknown;
}): Promise<void>;
