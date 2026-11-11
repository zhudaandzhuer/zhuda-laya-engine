import { awaitAbortable } from './AsyncOperation.ts';
import { ZhudaPhysicalCameraRig } from './PhysicalCamera.ts';
import type { ZhudaRuntimeSession } from './Runtime.ts';

export interface CinematicCaptureOptions {
  width: number;
  height: number;
  /** Maximum CPU pixel working set estimate; excludes GPU/driver allocations. */
  maxWorkingBytes?: number;
  timeoutMs?: number;
}
export interface CinematicFrameRequest {
  index: number;
  fps: number;
  samples?: number;
  signal?: AbortSignal;
  /** Stateless absolute-time pose; must not trigger game events or live audio. */
  sample: (timeSeconds: number) => void;
  /**
   * Runs for every sample after the lens is set and right before the main
   * camera draws: render targets the frame reads (mirrored views) go here.
   * Must be synchronous and must not advance simulation.
   */
  prepare?: () => void;
  aperture?: boolean;
  jitter?: boolean;
}
export interface CinematicFramePixels {
  width: number;
  height: number;
  index: number;
  time: number;
  samples: number;
  colorSpace: 'srgb';
  accumulation: 'display-linear';
  alpha: 'opaque';
  /** Top-left origin. Caller owns returned bytes. */
  rgba: Uint8Array;
}
const locked = new WeakSet<Laya.Scene3D>();
type CaptureScene = Laya.Scene3D & {
  _update: () => void;
  _renderByEditor: boolean;
  _time: number;
  _shaderValues: Laya.ShaderData;
};
const halton = (index: number, base: number) => {
  let result = 0,
    fraction = 1;
  while (index > 0) {
    fraction /= base;
    result += fraction * (index % base);
    index = Math.floor(index / base);
  }
  return result;
};
const linear = Float32Array.from({ length: 256 }, (_, i) => {
  const x = i / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
});
const srgb = (x: number) =>
  Math.round(
    Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)) *
      255,
  );

/** Owns one offscreen target and a native scene freeze. The runtime must be paused.
 * Aperture/shutter accumulation occurs after tone mapping, in display-linear RGB.
 * It is not HDR accumulation, path tracing or real-time frame-rate evidence. */
export class ZhudaCinematicCapture {
  private readonly scene: CaptureScene;
  private readonly lens: ZhudaPhysicalCameraRig;
  private readonly runtime: ZhudaRuntimeSession;
  private readonly target: Laya.RenderTexture;
  private readonly width: number;
  private readonly height: number;
  private readonly timeoutMs: number;
  private readonly previous: {
    update: () => void;
    editor: boolean;
    time: number;
  };
  private disposed = false;
  private busy = false;
  private controller: AbortController | null = null;
  private reading = false;
  private released = false;
  constructor(
    scene: Laya.Scene3D,
    lens: ZhudaPhysicalCameraRig,
    runtime: ZhudaRuntimeSession,
    options: CinematicCaptureOptions,
  ) {
    const l = (globalThis as unknown as { Laya: typeof Laya }).Laya;
    const { width, height } = options,
      limit = options.maxWorkingBytes ?? 512 * 1024 * 1024,
      timeout = options.timeoutMs ?? 30000;
    if (
      ![width, height].every((v) => Number.isInteger(v) && v > 0 && v <= 8192) ||
      !Number.isSafeInteger(limit) ||
      limit <= 0 ||
      width * height * 24 > limit
    )
      throw Error('Cinematic pixel budget exceeded');
    if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 2147483647)
      throw Error('Invalid cinematic deadline');
    if (
      scene.destroyed ||
      !scene.parent ||
      lens.camera.scene !== scene ||
      locked.has(scene) ||
      !runtime.paused
    )
      throw Error('Capture requires a mounted unowned scene and paused runtime');
    if (lens.camera.taa) throw Error('Disable temporal AA for independently sampled capture');
    this.scene = scene as CaptureScene;
    this.lens = lens;
    this.runtime = runtime;
    this.width = width;
    this.height = height;
    this.timeoutMs = timeout;
    this.target = new l.RenderTexture(
      width,
      height,
      l.RenderTargetFormat.R8G8B8A8,
      l.RenderTargetFormat.DEPTH_16,
      false,
      1,
      false,
      true,
    );
    this.previous = {
      update: this.scene._update,
      editor: this.scene._renderByEditor,
      time: this.scene._time,
    };
    this.scene._update = () => {};
    this.scene._renderByEditor = true;
    locked.add(scene);
  }
  private check() {
    if (this.disposed || this.scene.destroyed || this.lens.camera.destroyed || !this.runtime.paused)
      throw Error('Capture is disposed or runtime resumed');
    if (this.lens.camera.taa) throw Error('Disable temporal AA for independently sampled capture');
  }
  async renderFrame(request: CinematicFrameRequest): Promise<CinematicFramePixels> {
    this.check();
    if (this.busy || this.reading)
      throw Error('Cinematic capture is already rendering or draining readback');
    const count = request.samples ?? 1;
    if (
      !Number.isSafeInteger(request.index) ||
      request.index < 0 ||
      !Number.isFinite(request.fps) ||
      request.fps < 1 ||
      request.fps > 1000 ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 256 ||
      typeof request.sample !== 'function'
    )
      throw Error('Invalid cinematic frame request');
    if (request.signal?.aborted)
      throw request.signal.reason ?? new DOMException('Cancelled', 'AbortError');
    this.busy = true;
    const controller = (this.controller = new AbortController());
    const abort = () =>
      controller.abort(request.signal?.reason ?? new DOMException('Cancelled', 'AbortError'));
    request.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(new DOMException('Cinematic capture timed out', 'TimeoutError')),
      this.timeoutMs,
    );
    const l = (globalThis as unknown as { Laya: typeof Laya }).Laya;
    const pixels = new Uint8Array(this.width * this.height * 4),
      sum = new Float32Array(this.width * this.height * 3);
    const time = request.index / request.fps;
    try {
      for (let i = 0; i < count; i++) {
        this.check();
        if (controller.signal.aborted) throw controller.signal.reason;
        // Forward shutter interval; no negative time or cross-cut history dependency.
        const seconds =
          time +
          ((count === 1 ? 0 : (i + 0.5) / count) * this.lens.spec.shutterAngle) / 360 / request.fps;
        const sampled = request.sample(seconds) as unknown;
        if (sampled && typeof (sampled as PromiseLike<unknown>).then === 'function') {
          void Promise.resolve(sampled).catch(() => {});
          throw Error('Cinematic sample must be synchronous; load assets before capture');
        }
        this.check();
        this.lens.apply(this.width / this.height);
        this.scene._time = seconds;
        this.scene._shaderValues.setNumber(l.Shader3D.propertyNameToID('u_Time'), seconds);
        const radius = Math.sqrt(halton(i + 1, 5)),
          angle = 2 * Math.PI * halton(i + 1, 7),
          aperture = count > 1 && request.aperture !== false;
        const restore = this.lens.sample(
          aperture ? radius * Math.cos(angle) : 0,
          aperture ? radius * Math.sin(angle) : 0,
          count > 1 && request.jitter !== false ? halton(i + 1, 2) - 0.5 : 0,
          count > 1 && request.jitter !== false ? halton(i + 1, 3) - 0.5 : 0,
          this.width,
          this.height,
        );
        try {
          // Native skin/culling caches key off this render marker, not u_Time.
          // Advancing it invalidates draw caches without advancing simulation.
          l.Stat.loopCount++;
          l.LayaGL.renderEngine.startFrame();
          const previousTarget = this.lens.camera.renderTarget;
          try {
            request.prepare?.();
            l.Camera.drawRenderTextureByScene(this.lens.camera, this.scene, this.target);
          } finally {
            this.lens.camera.renderTarget = previousTarget;
            this.scene.recaculateCullCamera();
            l.LayaGL.renderEngine.endFrame();
          }
        } finally {
          restore();
        }
        const readback = this.target.getDataAsync(0, 0, this.width, this.height, pixels);
        this.reading = true;
        const drained = () => {
          this.reading = false;
          this.releaseTarget();
        };
        void readback.then(drained, drained);
        await awaitAbortable(readback, controller.signal);
        this.check();
        for (let p = 0, q = 0; p < pixels.length; p += 4, q += 3) {
          sum[q] += linear[pixels[p]];
          sum[q + 1] += linear[pixels[p + 1]];
          sum[q + 2] += linear[pixels[p + 2]];
        }
        // Let cancellation/deadline events run even with synchronous WebGL reads.
        // This yields IO work only; absolute scene time remains unchanged.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        this.check();
        if (controller.signal.aborted) throw controller.signal.reason;
      }
      const output = new Uint8Array(pixels.length);
      // Native camera target rendering already compensates target Y orientation.
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) {
          const src = (y * this.width + x) * 3,
            dest = (y * this.width + x) * 4;
          output[dest] = srgb(sum[src] / count);
          output[dest + 1] = srgb(sum[src + 1] / count);
          output[dest + 2] = srgb(sum[src + 2] / count);
          output[dest + 3] = 255;
        }
      return {
        width: this.width,
        height: this.height,
        index: request.index,
        time,
        samples: count,
        colorSpace: 'srgb',
        accumulation: 'display-linear',
        alpha: 'opaque',
        rgba: output,
      };
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', abort);
      this.busy = false;
      this.controller = null;
      this.releaseTarget();
    }
  }
  private releaseTarget() {
    if (this.disposed && !this.busy && !this.reading && !this.released) {
      this.released = true;
      locked.delete(this.scene);
      this.target.destroy();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller?.abort(new DOMException('Capture disposed', 'AbortError'));
    if (!this.scene.destroyed) {
      this.scene._update = this.previous.update;
      this.scene._renderByEditor = this.previous.editor;
      this.scene._time = this.previous.time;
      const l = (globalThis as unknown as { Laya: typeof Laya }).Laya;
      this.scene._shaderValues.setNumber(l.Shader3D.propertyNameToID('u_Time'), this.previous.time);
    }
    this.releaseTarget();
  }
}
