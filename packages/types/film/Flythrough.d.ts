// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaRuntimeSession } from '../runtime3d/Runtime.js';
import { type ZhudaFilmCameraKey } from './FilmScene.js';
import type { ZhudaFilmStage } from './FilmStage.js';
import type { ZhudaFlythroughFrame } from './FlythroughReport.js';
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
    pictures: {
        time: number;
        width: number;
        height: number;
        rgba: Uint8Array;
    }[];
    gpuTiming: {
        available: boolean;
        source: string;
        reason?: string;
    };
}
/**
 * Runs the stage along `cameraPath`. The runtime is paused while it runs
 * (as `ZhudaFilmRenderer` does) and its state is restored after.
 */
export declare function runZhudaFlythrough(stage: ZhudaFilmStage, runtime: ZhudaRuntimeSession, options: ZhudaFlythroughOptions): Promise<ZhudaFlythroughResult>;
