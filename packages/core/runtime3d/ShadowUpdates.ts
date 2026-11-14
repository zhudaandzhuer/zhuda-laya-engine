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
/**
 * Keeps the shadow uniforms in the scene's uniform set on a frame that skips
 * the shadow maps while shadows are on (`Stat.enableShadow`) and the maps
 * of an earlier frame are in use; see the class comment. A frame that draws
 * the maps, and a view drawn with shadows switched off, are left as LayaAir
 * has them. Returns false where the render process is not LayaAir 3.4.2's.
 */
export function installLaya342SkippedShadowFrames(
  runtime: any = (globalThis as any).Laya,
): boolean {
  const prototype = runtime?.WebRender3DProcess?.prototype;
  if (!prototype || typeof prototype._initRenderPass !== 'function') return false;
  if (skippedPatched.has(prototype)) return true;
  const init = prototype._initRenderPass;
  prototype._initRenderPass = function (camera: any, context: any, ...rest: unknown[]) {
    const result = init.call(this, camera, context, ...rest);
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

/**
 * The shadow update rule of one `Scene3D`. One at a time per scene; dispose
 * gives the scene back LayaAir's own every-frame drawing.
 */
export class ZhudaShadowUpdates {
  private options: Required<ZhudaShadowUpdateOptions>;
  private readonly scene3D: any;
  private readonly l: any;
  private native = 1;
  private installed = false;
  private disposed = false;
  private requested = true;
  private since = 0;
  private frame = -1;
  private drawsNow = true;
  /** Frames this scene was drawn with shadows on, and how many of them drew the maps. */
  private counts = { frames: 0, drawn: 0 };

  constructor(scene3D: any, options: ZhudaShadowUpdateOptions = {}) {
    const l = (this.l = (globalThis as any).Laya);
    this.options = zhudaShadowUpdateOptions(options);
    if (!scene3D || typeof scene3D._ShadowMapupdateFrequency !== 'number')
      throw Error('Shadow update: needs a LayaAir 3.4.2 Scene3D');
    if (owners.has(scene3D)) throw Error('Shadow update: this scene has one already');
    if (!installLaya342SkippedShadowFrames(l))
      throw Error('Shadow update: this LayaAir has no 3.4.2 render process');
    this.scene3D = scene3D;
    owners.set(scene3D, this);
    this.apply();
  }

  get mode(): ZhudaShadowUpdateMode {
    return this.options.mode;
  }

  get interval(): number {
    return this.options.interval;
  }

  /** Frames drawn with shadows on since the rule was made, and how many drew the maps. */
  get stats(): { frames: number; drawn: number } {
    return { ...this.counts };
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
    Object.defineProperty(this.scene3D, '_ShadowMapupdateFrequency', {
      configurable: true,
      enumerable: true,
      get: () => (this.decide() ? 1 : Infinity),
      // What the game sets (`shadowMapFrequency`) is kept for when the rule goes.
      set: (value: number) => {
        this.native = value;
      },
    });
    this.installed = true;
  }

  private uninstall(): void {
    if (!this.installed) return;
    this.installed = false;
    Reflect.deleteProperty(this.scene3D, '_ShadowMapupdateFrequency');
    this.scene3D._ShadowMapupdateFrequency = this.native;
  }

  /** One answer a frame: every view drawn in it (a mirror, the camera) sees the same maps. */
  private decide(): boolean {
    const l = this.l;
    // A view drawn with shadows off (a depth picture) neither draws nor counts.
    if (!l.Stat.enableShadow) return true;
    const frame = l.Stat.loopCount;
    if (frame !== this.frame) {
      this.frame = frame;
      this.drawsNow = zhudaShadowFrameDraws(this.options, this.since, this.requested);
      this.requested = false;
      this.since = this.drawsNow ? 0 : this.since + 1;
      this.counts.frames++;
      if (this.drawsNow) this.counts.drawn++;
    } else if (this.requested && !this.drawsNow) {
      // Asked again within a frame (a capture drawing its samples): draw from here on.
      this.requested = false;
      this.drawsNow = true;
      this.since = 0;
      this.counts.drawn++;
    }
    return this.drawsNow;
  }
}
