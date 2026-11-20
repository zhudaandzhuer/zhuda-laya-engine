// Generated from TypeScript source; run npm run types:generate.
/**
 * A scene drawn once, from where it will be seen, before it is shown.
 *
 * Whatever is drawn for the first time costs its frame more: its shader is
 * compiled for that mesh, those defines and that pass; on WebGPU its render
 * pipeline and bind groups are made; its buffers and textures go to the
 * graphics card. A game that starts walking straight away meets all of that
 * on the way, a model at a time: on a vivo V40 (WebGPU, a town of eleven
 * figures and its houses, 2026-11-20) frames of 450 to 2500 ms in the first
 * half minute, and the resolution governor pushed down to half.
 *
 * `zhudaWarmUpByDrawing` draws the scene behind the loading screen from a
 * few eyes the game names (where the player starts, the way it goes on),
 * looking all round and down from each, with a wide field of view. A draw
 * of its own the game makes (a water mirror, a reflection, a second camera)
 * compiles shaders of its own: `beforeView` is called before each view for
 * the game to put its own things where that eye would see them (levels of
 * detail, grass round the eye) and to draw such passes. Then the camera is
 * as it was.
 *
 * Unlike `zhudaWarmUpShaders` it needs no list recorded beforehand and it
 * reaches what a list does not: the WebGPU render pipelines and everything a
 * first draw sends. It warms only what those views see: a thing out of
 * every view (behind a wall, past the camera's far plane, switched off by
 * the game) is still met for the first time later. It draws whole frames,
 * so it costs seconds on a phone (V40: 30 views in about 3 s, the longest
 * view 2 s); it gives the loading screen a frame between slices.
 */
export type ZhudaWarmUpPoint = readonly [number, number, number];
/** One view: where the eye is, what it looks at, which way of the set it is. */
export interface ZhudaDrawWarmUpView {
    eye: ZhudaWarmUpPoint;
    target: ZhudaWarmUpPoint;
    /** Its place among all the views, 0-based. */
    index: number;
}
/** A way to look from an eye: turned round from +z toward +x (radians), and up (negative: down). */
export interface ZhudaWarmUpDirection {
    yaw: number;
    pitch: number;
}
/** The four ways round, a little down, and one steeply down: what a player sees from one place. */
export declare const ZHUDA_WARM_UP_DIRECTIONS: readonly ZhudaWarmUpDirection[];
/** At most this many views in one warm-up. */
export declare const ZHUDA_WARM_UP_VIEW_LIMIT = 512;
export interface ZhudaDrawWarmUpOptions {
    /** The camera the game draws with (a LayaAir `Camera`). It is moved and turned, and put back. */
    camera: any;
    /** Where to look from, in the world: where the player starts and the places it goes on to. */
    eyes: readonly ZhudaWarmUpPoint[];
    /** Which ways to look from each eye (default `ZHUDA_WARM_UP_DIRECTIONS`). */
    directions?: readonly ZhudaWarmUpDirection[];
    /** The field of view while warming up, degrees, 1..170 (default 90). */
    fieldOfView?: number;
    /**
     * Called before each view is drawn, with the camera already there: the game
     * puts its own things as that eye would see them (levels of detail, grass)
     * and draws its own passes (a water mirror) for it.
     */
    beforeView?: (view: ZhudaDrawWarmUpView) => void;
    /** Milliseconds of drawing before the next frame is let through, 1..10000 (default 50). One view is never cut. */
    budgetMs?: number;
    /** Stops between two views; the promise rejects with the signal's reason. The camera is put back. */
    signal?: AbortSignal;
    /** Called after every slice, for a loading bar. */
    onProgress?: (done: number, total: number) => void;
    /** Draws one frame (default: LayaAir's render loop once, as `ZhudaEngine.flushRenderFrames(1)`). */
    draw?: () => void;
    /** Waits for the next frame between slices (default: one frame of LayaAir's system timer). */
    wait?: () => Promise<void>;
    /** A clock in milliseconds (default `performance.now`). */
    now?: () => number;
}
export interface ZhudaDrawWarmUpReport {
    /** Views drawn. */
    views: number;
    /** Milliseconds spent drawing them, and the longest view among them. */
    ms: number;
    longestMs: number;
    /** The view that took longest. */
    slowest: ZhudaDrawWarmUpView | null;
    /** Frames the warm-up was spread over. */
    slices: number;
}
/** The views a warm-up draws, in order: each eye in turn, each direction from it. Pure. */
export declare function zhudaWarmUpViews(eyes: readonly ZhudaWarmUpPoint[], directions?: readonly ZhudaWarmUpDirection[]): ZhudaDrawWarmUpView[];
/**
 * Draws the scene from each eye, every way round, before it is shown, and
 * puts the camera back. Call it once the scene, its look and its models are
 * made, behind the loading screen; the frames it draws are under it.
 */
export declare function zhudaWarmUpByDrawing(options: ZhudaDrawWarmUpOptions, runtime?: any): Promise<ZhudaDrawWarmUpReport>;
