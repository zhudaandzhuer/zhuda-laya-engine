/**
 * A fly-through: a mounted film stage drawn along a camera path frame by
 * frame, each frame timed on the CPU and, where the browser gives it, on the
 * GPU (`ZhudaRuntimeProfiler`: WebGPU timestamps, WebGL's disjoint timer
 * query); then the frames at fixed poses read back as pictures, outside the
 * timing. `summarizeZhudaFlythrough` checks the times against a budget.
 *
 * Frames are drawn as a game draws them, one sample each (no jitter, no
 * depth of field), into a target of the size asked for, with the scene's
 * time set to the frame's time. A few frames drawn first and not timed take
 * shader compiles and first uploads out of the numbers.
 */
import { ZhudaCinematicCapture } from '../runtime3d/CinematicCapture.ts';
import { ZhudaRuntimeProfiler } from '../effects/EffectBudget.ts';
import type { ZhudaRuntimeSession } from '../runtime3d/Runtime.ts';
import {
  sampleZhudaFilmCameraPath,
  validateZhudaFilmCameraPath,
  type ZhudaFilmCameraKey,
} from './FilmScene.ts';
import type { ZhudaFilmStage } from './FilmStage.ts';
import type { ZhudaFlythroughFrame } from './FlythroughReport.ts';

export interface ZhudaFlythroughOptions {
  cameraPath: readonly ZhudaFilmCameraKey[];
  /** Seconds of the move to run (default: the last key's time). */
  durationSec?: number;
  /** Frames a second of the move (default 30); the run is durationSec × fps frames. */
  fps?: number;
  width: number;
  height: number;
  /** Times along the path whose frames are read back as pictures, after the timed run. */
  poses?: readonly number[];
  /** Frames drawn before the timed run and not timed (default 10). */
  warmupFrames?: number;
  /**
   * Where GPU time comes from: the `GPUDevice` on WebGPU or the WebGL 2
   * context. Default: LayaAir's own (its device, or its context); `null`
   * measures no GPU time.
   */
  gpu?: unknown;
  signal?: AbortSignal;
}

export interface ZhudaFlythroughResult {
  frames: ZhudaFlythroughFrame[];
  pictures: { time: number; width: number; height: number; rgba: Uint8Array }[];
  gpuTiming: { available: boolean; source: string; reason?: string };
}

const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Runs the stage along `cameraPath`. The runtime is paused while it runs
 * (as `ZhudaFilmRenderer` does) and its state is restored after.
 */
export async function runZhudaFlythrough(
  stage: ZhudaFilmStage,
  runtime: ZhudaRuntimeSession,
  options: ZhudaFlythroughOptions,
): Promise<ZhudaFlythroughResult> {
  const issues = validateZhudaFilmCameraPath(options?.cameraPath);
  if (issues.length) throw Error('Fly-through: ' + issues.join('; '));
  const path = options.cameraPath;
  const fps = options.fps ?? 30,
    duration = options.durationSec ?? path[path.length - 1].time,
    warmup = options.warmupFrames ?? 10,
    { width, height } = options;
  if (!Number.isInteger(fps) || fps < 1 || fps > 240) throw Error('Fly-through: fps is 1..240');
  if (!(duration > 0) || duration * fps > 36000)
    throw Error('Fly-through: durationSec above 0, at most 36 000 frames');
  if (![width, height].every((v) => Number.isInteger(v) && v >= 16 && v <= 3840))
    throw Error('Fly-through: width and height are 16..3840');
  if (!Number.isInteger(warmup) || warmup < 0 || warmup > 600)
    throw Error('Fly-through: warmupFrames is 0..600');
  const poses = options.poses ?? [];
  if (!Array.isArray(poses) || poses.length > 64 || !poses.every((t) => t >= 0 && t <= duration))
    throw Error('Fly-through: up to 64 poses, each a time within the run');
  const count = Math.round(duration * fps);
  const wasPaused = runtime.paused;
  runtime.setPaused(true);
  const capture = new ZhudaCinematicCapture(stage.scene3D, stage.lens, runtime, {
    width,
    height,
  });
  const profiler = new ZhudaRuntimeProfiler({ capacity: count + 8 });
  const engine = (globalThis as any).Laya?.LayaGL?.renderEngine;
  const gpuSource =
    options.gpu !== undefined ? options.gpu : (engine?.getDevice?.() ?? engine?.gl ?? null);
  const isWebGPU = typeof (gpuSource as any)?.createQuerySet === 'function';
  let gpuTiming: ZhudaFlythroughResult['gpuTiming'];
  try {
    if (gpuSource) {
      if (isWebGPU) profiler.attachWebGPU(gpuSource);
      else profiler.attach(gpuSource);
    }
    const draw = (index: number) =>
      capture.drawFrame({
        index,
        fps,
        sample: (seconds) => {
          stage.setTime(seconds);
          stage.setCamera(sampleZhudaFilmCameraPath(path, seconds));
        },
        prepare: () => stage.prepare(width / height, { width, height, index }),
      });
    const check = () => {
      if (options.signal?.aborted)
        throw options.signal.reason ?? new DOMException('Cancelled', 'AbortError');
    };
    for (let i = 0; i < warmup; i++) {
      check();
      draw(i % count);
      await turn();
    }
    const available = gpuSource ? profiler.enableGpuTiming(gpuSource) : false;
    for (let i = 0; i < count; i++) {
      check();
      profiler.beginFrame();
      const started = performance.now();
      draw(i);
      const ms = performance.now() - started;
      profiler.endFrame(ms, ms);
      // Lets timer queries and timestamp reads come back; not part of a frame's time.
      await turn();
    }
    // The last frames' GPU times: one more (empty) frame resolves them.
    for (let i = 0; i < 4; i++) {
      profiler.beginFrame();
      profiler.endFrame(0, 0);
      await turn();
    }
    const report = profiler.report();
    const samples = report.samples.slice(0, count);
    const frames: ZhudaFlythroughFrame[] = samples.map((s: any, i: number) => ({
      index: i,
      time: i / fps,
      cpuMs: s.cpuMs,
      ...(s.gpuMs === undefined ? {} : { gpuMs: s.gpuMs }),
      drawCalls: s.drawCalls,
      triangles: s.triangles,
    }));
    const timed = frames.some((f) => f.gpuMs !== undefined);
    gpuTiming = {
      available: timed,
      source: report.sources.gpu,
      ...(timed
        ? {}
        : {
            reason: gpuSource
              ? available
                ? report.gpuTimeReason
                : 'GPU timing unavailable: ' + report.gpuTimeReason
              : 'no GPU device or context',
          }),
    };
    const pictures: ZhudaFlythroughResult['pictures'] = [];
    for (const time of poses) {
      check();
      draw(Math.min(count - 1, Math.round(time * fps)));
      pictures.push({ time, width, height, rgba: await capture.readFrame() });
    }
    return { frames, pictures, gpuTiming };
  } finally {
    profiler.dispose();
    capture.dispose();
    runtime.setPaused(wasPaused);
  }
}
