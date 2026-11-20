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
export const ZHUDA_WARM_UP_DIRECTIONS: readonly ZhudaWarmUpDirection[] = Object.freeze([
  { yaw: 0, pitch: -0.3 },
  { yaw: Math.PI / 2, pitch: -0.3 },
  { yaw: Math.PI, pitch: -0.3 },
  { yaw: -Math.PI / 2, pitch: -0.3 },
  { yaw: 0, pitch: -1.2 },
]);

/** At most this many views in one warm-up. */
export const ZHUDA_WARM_UP_VIEW_LIMIT = 512;

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

const finitePoint = (point: unknown): point is ZhudaWarmUpPoint =>
  Array.isArray(point) &&
  point.length === 3 &&
  point.every((v) => typeof v === 'number' && Number.isFinite(v));

/** The views a warm-up draws, in order: each eye in turn, each direction from it. Pure. */
export function zhudaWarmUpViews(
  eyes: readonly ZhudaWarmUpPoint[],
  directions: readonly ZhudaWarmUpDirection[] = ZHUDA_WARM_UP_DIRECTIONS,
): ZhudaDrawWarmUpView[] {
  if (!Array.isArray(eyes) || !eyes.length || !eyes.every(finitePoint))
    throw Error('zhudaWarmUpByDrawing: eyes must be [x, y, z] points, at least one');
  if (
    !Array.isArray(directions) ||
    !directions.length ||
    !directions.every(
      (d) =>
        d && Number.isFinite(d.yaw) && Number.isFinite(d.pitch) && Math.abs(d.pitch) < Math.PI / 2,
    )
  )
    throw Error('zhudaWarmUpByDrawing: directions must have a finite yaw and a pitch within ±90°');
  if (eyes.length * directions.length > ZHUDA_WARM_UP_VIEW_LIMIT)
    throw Error(`zhudaWarmUpByDrawing: at most ${ZHUDA_WARM_UP_VIEW_LIMIT} views`);
  const views: ZhudaDrawWarmUpView[] = [];
  for (const eye of eyes)
    for (const { yaw, pitch } of directions)
      views.push({
        eye: [eye[0], eye[1], eye[2]],
        // ten metres along the way: only the direction matters to the camera
        target: [
          eye[0] + Math.sin(yaw) * Math.cos(pitch) * 10,
          eye[1] + Math.sin(pitch) * 10,
          eye[2] + Math.cos(yaw) * Math.cos(pitch) * 10,
        ],
        index: views.length,
      });
  return views;
}

/**
 * Draws the scene from each eye, every way round, before it is shown, and
 * puts the camera back. Call it once the scene, its look and its models are
 * made, behind the loading screen; the frames it draws are under it.
 */
export async function zhudaWarmUpByDrawing(
  options: ZhudaDrawWarmUpOptions,
  runtime: any = (globalThis as any).Laya,
): Promise<ZhudaDrawWarmUpReport> {
  const camera = options.camera;
  const transform = camera?.transform;
  if (!transform || typeof transform.lookAt !== 'function' || !('fieldOfView' in camera))
    throw Error('zhudaWarmUpByDrawing: camera must be a LayaAir Camera');
  const fov = options.fieldOfView ?? 90;
  if (typeof fov !== 'number' || !Number.isFinite(fov) || fov < 1 || fov > 170)
    throw Error('zhudaWarmUpByDrawing: fieldOfView must be 1..170');
  const budget = options.budgetMs ?? 50;
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 1 || budget > 10000)
    throw Error('zhudaWarmUpByDrawing: budgetMs must be 1..10000');
  const views = zhudaWarmUpViews(options.eyes, options.directions);
  const Vector3 = runtime?.Vector3;
  if (typeof Vector3 !== 'function') throw Error('zhudaWarmUpByDrawing: LayaAir is not loaded');
  const draw =
    options.draw ??
    (() => {
      const render = runtime.Render;
      if (typeof render?.loop === 'function') render.loop.call(render, performance.now());
    });
  const wait =
    options.wait ??
    (() =>
      new Promise<void>((resolve) => {
        const timer = runtime.systemTimer ?? runtime.timer;
        if (typeof timer?.frameOnce === 'function') timer.frameOnce(1, null, resolve);
        else setTimeout(resolve, 0);
      }));
  const now = options.now ?? (() => performance.now());
  const aborted = () => {
    if (options.signal?.aborted)
      throw options.signal.reason ?? new DOMException('Cancelled', 'AbortError');
  };

  // What is put back: where the camera is, which way it turns, how wide it sees.
  const position = transform.position.clone();
  const rotation = transform.rotation.clone();
  const fovWas = camera.fieldOfView;
  const up = new Vector3(0, 1, 0);
  const report: ZhudaDrawWarmUpReport = { views: 0, ms: 0, longestMs: 0, slowest: null, slices: 0 };
  try {
    let index = 0;
    while (index < views.length) {
      aborted();
      report.slices++;
      const sliceStart = now();
      // One view at least in every slice.
      do {
        const view = views[index++];
        camera.fieldOfView = fov;
        transform.position = new Vector3(view.eye[0], view.eye[1], view.eye[2]);
        transform.lookAt(new Vector3(view.target[0], view.target[1], view.target[2]), up);
        const from = now();
        options.beforeView?.(view);
        draw();
        const ms = now() - from;
        report.views++;
        report.ms += ms;
        if (ms > report.longestMs) ((report.longestMs = ms), (report.slowest = view));
      } while (index < views.length && now() - sliceStart < budget);
      options.onProgress?.(index, views.length);
      if (index < views.length) await wait();
    }
  } finally {
    camera.fieldOfView = fovWas;
    transform.position = position;
    transform.rotation = rotation;
  }
  report.ms = Math.round(report.ms * 10) / 10;
  report.longestMs = Math.round(report.longestMs * 10) / 10;
  return report;
}
