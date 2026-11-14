// Generated from TypeScript source; run npm run types:generate.
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
export declare function showZhudaStats(options?: {
    x?: number;
    y?: number;
}): ZhudaStatsPanel;
/** Takes the panel off the page; nothing happens when it is not shown. */
export declare function hideZhudaStats(): void;
