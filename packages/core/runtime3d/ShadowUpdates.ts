/**
 * How often a scene's sun and spot light draw their shadow maps: every frame
 * (LayaAir's default), every few frames, or only when asked. Between two
 * drawings the receivers keep the last maps, so a still caster keeps its
 * shadow and a moving one leaves it behind until the next drawing.
 *
 * LayaAir 3.4.2 has the skipping (`Scene3D.shadowMapFrequency`), but used as
 * it is it breaks frames: on a frame that skips the maps it also takes the
 * shadow uniforms out of the scene's uniform set. On WebGPU every draw of a
 * shadowed material then fails pipeline validation and the frame is lost (the
 * canvas keeps the frame before it); on WebGL a material whose shader is first
 * compiled on such a frame reads its shadow uniforms from the wrong place for
 * good. `installLaya342SkippedShadowFrames` keeps the uniforms on those frames.
 * Its count also runs off by every hand-drawn view (a mirror, a capture), so
 * this class decides each frame itself instead of using the native count.
 *
 * The maps belong to the light, not to a camera: LayaAir has one set, fitted
 * to the camera that drew them last, and every camera reads that set. So the
 * rule keeps them for one camera, the view. Any other camera that draws the
 * scene with shadows on (a probe or a capture camera, a mirror told to draw
 * shadows of its own) draws maps of its own as it does without the rule, and
 * the view draws its maps again the next time it is drawn: it never reads
 * maps fitted to another camera. A camera named with `zhudaShadowBorrower`
 * (the engine's mirrors, unless told otherwise) reads the view's kept maps
 * instead, so a water surface costs no shadow drawing and takes nothing
 * from the view.
 *
 * Point lights draw their shadows on demand already (`ZhudaPointShadow`).
 */
export type ZhudaShadowUpdateMode = 'every' | 'interval' | 'manual';

export interface ZhudaShadowUpdateOptions {
  /** 'every' frame (default), every `interval` frames, or 'manual': on `redraw()` only. */
  mode?: ZhudaShadowUpdateMode;
  /** Frames from one drawing to the next with mode 'interval', 2..30 (default 3). */
  interval?: number;
}

/** Checked options with every default filled in. */
export function zhudaShadowUpdateOptions(
  options: ZhudaShadowUpdateOptions = {},
): Required<ZhudaShadowUpdateOptions> {
  const mode = options.mode ?? 'every',
    interval = options.interval ?? 3;
  if (mode !== 'every' && mode !== 'interval' && mode !== 'manual')
    throw Error('Shadow update: mode is every, interval or manual');
  if (!Number.isInteger(interval) || interval < 2 || interval > 30)
    throw Error('Shadow update: interval is a whole number of frames, 2..30');
  return { mode, interval };
}

/**
 * Whether a frame draws the shadow maps: `since` frames were drawn without
 * them since the last drawing, `requested` is a pending `redraw()`. Pure.
 */
export function zhudaShadowFrameDraws(
  options: Required<ZhudaShadowUpdateOptions>,
  since: number,
  requested: boolean,
): boolean {
  if (requested || options.mode === 'every') return true;
  if (options.mode === 'manual') return false;
  return since + 1 >= options.interval;
}

const skippedPatched = new WeakSet<object>();
/** The camera LayaAir is setting a render pass up for, while it does. */
let asking: any = null;
/**
 * Keeps the shadow uniforms in the scene's uniform set on a frame that skips
 * the shadow maps while shadows are on (`Stat.enableShadow`) and the maps
 * of an earlier frame are in use; see the class comment. A frame that draws
 * the maps, and a view drawn with shadows switched off, are left as LayaAir
 * has them. It also tells the rule which camera LayaAir's frame test is
 * for. Returns false where the render process is not LayaAir 3.4.2's.
 */
export function installLaya342SkippedShadowFrames(
  runtime: any = (globalThis as any).Laya,
): boolean {
  const prototype = runtime?.WebRender3DProcess?.prototype;
  if (!prototype || typeof prototype._initRenderPass !== 'function') return false;
  if (skippedPatched.has(prototype)) return true;
  const init = prototype._initRenderPass;
  prototype._initRenderPass = function (camera: any, context: any, ...rest: unknown[]) {
    const outer = asking;
    asking = camera;
    let result: unknown;
    try {
      result = init.call(this, camera, context, ...rest);
    } finally {
      asking = outer;
    }
    const pass = this._renderPass;
    if (
      pass &&
      !pass.shadowCastPass &&
      runtime.Stat?.enableShadow &&
      (pass.enableDirectLightShadow || pass.enableSpotLightShadowPass)
    )
      context?.preDrawUniformMaps?.add('Shadow');
    return result;
  };
  skippedPatched.add(prototype);
  return true;
}

const owners = new WeakMap<object, ZhudaShadowUpdates>();
const borrowers = new WeakSet<object>();

/**
 * Names a camera that reads the maps a rule keeps for its view instead of
 * drawing maps of its own: a mirror of that view, whose picture shows the
 * same part of the world. It borrows only while the kept maps are the
 * view's and no drawing is pending (`ZhudaShadowUpdates.lends`); otherwise,
 * and in a scene without a rule, it draws its own like any camera. The
 * engine's mirrors (`ZhudaPlanarReflection`, the water and wet surfaces) are
 * named unless their `shadows` / `mirrorShadows` option says otherwise.
 * `borrows: false` takes the name away.
 */
export function zhudaShadowBorrower(camera: any, borrows = true): void {
  if (!camera || typeof camera !== 'object') throw Error('Shadow update: a camera is required');
  if (borrows) borrowers.add(camera);
  else borrowers.delete(camera);
}

/**
 * The shadow update rule of one `Scene3D`. One at a time per scene; dispose
 * gives the scene back LayaAir's own every-frame drawing.
 */
export class ZhudaShadowUpdates {
  private options: Required<ZhudaShadowUpdateOptions>;
  private readonly scene3D: any;
  private readonly view: any;
  private readonly l: any;
  private native = 1;
  private installed = false;
  private disposed = false;
  private requested = true;
  private since = 0;
  private frame = -1;
  private drawsNow = true;
  /** The camera the maps in place were drawn for. */
  private mapsFor: any = null;
  private counts = { frames: 0, drawn: 0, taken: 0 };

  /**
   * `camera` is the view the maps are kept for (a look gives its own).
   * Without one, every camera that draws to the canvas is a view; two of
   * them take the maps from each other and nothing is saved.
   */
  constructor(scene3D: any, options: ZhudaShadowUpdateOptions = {}, camera?: any) {
    const l = (this.l = (globalThis as any).Laya);
    this.options = zhudaShadowUpdateOptions(options);
    if (!scene3D || typeof scene3D._ShadowMapupdateFrequency !== 'number')
      throw Error('Shadow update: needs a LayaAir 3.4.2 Scene3D');
    if (camera !== undefined && (camera === null || typeof camera !== 'object'))
      throw Error('Shadow update: the view is a camera');
    if (owners.has(scene3D)) throw Error('Shadow update: this scene has one already');
    if (!installLaya342SkippedShadowFrames(l))
      throw Error('Shadow update: this LayaAir has no 3.4.2 render process');
    this.scene3D = scene3D;
    this.view = camera;
    owners.set(scene3D, this);
    this.apply();
  }

  get mode(): ZhudaShadowUpdateMode {
    return this.options.mode;
  }

  get interval(): number {
    return this.options.interval;
  }

  /**
   * Since the rule was made: `frames` the view was drawn in with shadows on,
   * `drawn` how many of them drew the maps, and `taken` how many of those
   * only because another camera had drawn maps of its own since (a mirror
   * with shadows of its own, a probe, a capture). `taken` rising with
   * `frames` means the rule saves nothing in this scene.
   */
  get stats(): { frames: number; drawn: number; taken: number } {
    return { ...this.counts };
  }

  /**
   * Whether a borrowing camera (`zhudaShadowBorrower`) drawn now reads the
   * kept maps: the rule keeps maps, those in place are the view's, and no
   * drawing is pending.
   */
  get lends(): boolean {
    return this.installed && !this.requested && this.mapsFor !== null && this.isView(this.mapsFor);
  }

  /** Changes the rule in place; the next frame draws the maps. */
  set(options: ZhudaShadowUpdateOptions): void {
    if (this.disposed) throw Error('Disposed shadow update');
    this.options = zhudaShadowUpdateOptions(options);
    this.requested = true;
    this.apply();
  }

  /**
   * The next frame draws the maps (a caster or the sun moved, the camera
   * went somewhere else). Several calls before that frame draw once.
   */
  redraw(): void {
    if (this.disposed) throw Error('Disposed shadow update');
    this.requested = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.uninstall();
    owners.delete(this.scene3D);
  }

  /** 'every' is LayaAir's own path; the others answer LayaAir's frame test themselves. */
  private apply(): void {
    if (this.options.mode === 'every') return this.uninstall();
    if (this.installed) return;
    this.native = this.scene3D._ShadowMapupdateFrequency;
    // LayaAir tests `Scene3D._updateMark % frequency === 0` once per camera
    // drawn; the mark is at least 1 there, so Infinity never divides it.
    // Read from anywhere else (`shadowMapFrequency`), it is what the game set.
    Object.defineProperty(this.scene3D, '_ShadowMapupdateFrequency', {
      configurable: true,
      enumerable: true,
      get: () => (asking ? (this.decide(asking) ? 1 : Infinity) : this.native),
      // What the game sets (`shadowMapFrequency`) is kept for when the rule goes.
      set: (value: number) => {
        this.native = value;
      },
    });
    this.installed = true;
  }

  private uninstall(): void {
    this.mapsFor = null;
    if (!this.installed) return;
    this.installed = false;
    Reflect.deleteProperty(this.scene3D, '_ShadowMapupdateFrequency');
    this.scene3D._ShadowMapupdateFrequency = this.native;
  }

  /** The camera the maps are kept for; without one, any camera drawing to the canvas. */
  private isView(camera: any): boolean {
    return this.view ? camera === this.view : !camera.renderTarget;
  }

  /** Whether the camera LayaAir is about to draw draws the maps first. */
  private decide(camera: any): boolean {
    const l = this.l;
    // A view drawn with shadows off (a depth picture) neither draws nor counts.
    if (!l.Stat.enableShadow) return true;
    if (!this.isView(camera)) {
      // A mirror of the view reads the view's maps while they are in place.
      if (borrowers.has(camera) && this.lends) return false;
      // Any other camera draws maps of its own, as it does without the rule.
      this.mapsFor = camera;
      return true;
    }
    // Maps another camera drew since are fitted to that camera: not kept.
    const taken = this.mapsFor !== camera;
    const frame = l.Stat.loopCount;
    if (frame !== this.frame) {
      this.frame = frame;
      const due = zhudaShadowFrameDraws(this.options, this.since, this.requested);
      this.drawsNow = due || taken;
      this.requested = false;
      this.since = this.drawsNow ? 0 : this.since + 1;
      this.counts.frames++;
      if (this.drawsNow) this.counts.drawn++;
      if (taken && !due) this.counts.taken++;
    } else if (!this.drawsNow && (this.requested || taken)) {
      // Asked, or the maps taken, within a frame that kept them: drawn from here on.
      if (!this.requested) this.counts.taken++;
      this.requested = false;
      this.drawsNow = true;
      this.since = 0;
      this.counts.drawn++;
    }
    if (this.drawsNow) this.mapsFor = camera;
    return this.drawsNow;
  }
}
