/**
 * LayaAir's own statistics panel (frames a second, draw calls, triangles,
 * memory of its resources), shown over the page while a person is looking
 * for what costs. It is LayaAir's panel as it is: a small canvas of its own
 * over the page, updated once a second, with LayaAir's counters, which are
 * what LayaAir submits and not what a GPU measured (`ZhudaRuntimeProfiler`
 * is for that).
 */

/** What `showZhudaStats` gives back. */
export interface ZhudaStatsPanel {
  /** Takes the panel off the page. */
  hide(): void;
}

/**
 * Shows the panel at `x`, `y` (CSS pixels from the page's top left corner).
 * One panel a page: showing it again moves it.
 */
export function showZhudaStats(options: { x?: number; y?: number } = {}): ZhudaStatsPanel {
  const stat = (globalThis as any).Laya?.Stat;
  if (typeof stat?.show !== 'function')
    throw Error('The statistics panel needs LayaAir (ZhudaEngine.boot first)');
  const x = options.x ?? 0,
    y = options.y ?? 0;
  if (![x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 100000))
    throw Error('Invalid statistics panel: x and y are 0..100000');
  stat.show(x, y);
  return { hide: () => hideZhudaStats() };
}

/** Takes the panel off the page; nothing happens when it is not shown. */
export function hideZhudaStats(): void {
  (globalThis as any).Laya?.Stat?.hide?.();
}
