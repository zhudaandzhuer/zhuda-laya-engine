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
type Host = {
  __ZHUDA_SPLASH__?: Partial<ZhudaSplashState>;
  addEventListener?: (type: string, listener: () => void, options?: { once?: boolean }) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
  setTimeout?: (run: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
};
/** The splash's state, or null on a page that was not built with one (a test page, a mini-game). */
export function zhudaSplashState(host: unknown = globalThis): ZhudaSplashState | null {
  const state = (host as Host | null)?.__ZHUDA_SPLASH__;
  if (!state || typeof state !== 'object') return null;
  return {
    started: state.started === true,
    completed: state.completed === true,
    loaded: state.loaded === true,
    // A page built before `gone` existed says only `completed`: the node leaves 460 ms after it.
    gone: state.gone === true,
    mode: typeof state.mode === 'string' ? state.mode : 'engine',
    durationMs: Number.isFinite(state.durationMs) ? (state.durationMs as number) : 0,
  };
}
/**
 * Resolves when the splash is out of the page: at once where there is none, or it has gone.
 * Rejects after `timeoutMs` (default 30 s; 0 waits for ever), so a page that never finishes
 * loading does not hang a script without saying why.
 */
export function whenZhudaSplashGone(
  options: { timeoutMs?: number; host?: unknown } = {},
): Promise<void> {
  const host = (options.host ?? globalThis) as Host;
  const timeoutMs = options.timeoutMs ?? 30000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw Error('Invalid timeoutMs');
  const state = host?.__ZHUDA_SPLASH__;
  if (!state || state.gone === true || state.mode === 'none') return Promise.resolve();
  if (typeof host.addEventListener !== 'function')
    return Promise.reject(Error('The splash is up and this host has no events to wait on'));
  return new Promise<void>((resolve, reject) => {
    let timer: unknown;
    const done = () => {
      if (timer !== undefined) host.clearTimeout?.(timer);
      host.removeEventListener?.('zhuda:splash-gone', done);
      resolve();
    };
    host.addEventListener!('zhuda:splash-gone', done, { once: true });
    if (timeoutMs > 0 && typeof host.setTimeout === 'function')
      timer = host.setTimeout(() => {
        host.removeEventListener?.('zhuda:splash-gone', done);
        reject(
          Error(
            `The splash had not gone after ${timeoutMs} ms (loaded: ${host.__ZHUDA_SPLASH__?.loaded === true})`,
          ),
        );
      }, timeoutMs);
    // It may have gone between the read above and the listener.
    if (host.__ZHUDA_SPLASH__?.gone === true) done();
  });
}
