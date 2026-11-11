// Generated from TypeScript source; run npm run types:generate.
import { ZhudaPhysicalCameraRig } from './PhysicalCamera.js';
import type { ZhudaRuntimeSession } from './Runtime.js';
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
/** Owns one offscreen target and a native scene freeze. The runtime must be paused.
 * Aperture/shutter accumulation occurs after tone mapping, in display-linear RGB.
 * It is not HDR accumulation, path tracing or real-time frame-rate evidence. */
export declare class ZhudaCinematicCapture {
    private readonly scene;
    private readonly lens;
    private readonly runtime;
    private readonly target;
    private readonly width;
    private readonly height;
    private readonly timeoutMs;
    private readonly previous;
    private disposed;
    private busy;
    private controller;
    private reading;
    private released;
    constructor(scene: Laya.Scene3D, lens: ZhudaPhysicalCameraRig, runtime: ZhudaRuntimeSession, options: CinematicCaptureOptions);
    private check;
    renderFrame(request: CinematicFrameRequest): Promise<CinematicFramePixels>;
    private releaseTarget;
    dispose(): void;
}
