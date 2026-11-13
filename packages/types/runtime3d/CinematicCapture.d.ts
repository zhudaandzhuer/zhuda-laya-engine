// Generated from TypeScript source; run npm run types:generate.
import { ZhudaPhysicalCameraRig } from './PhysicalCamera.js';
import type { ZhudaRuntimeSession } from './Runtime.js';
/**
 * What a capture needs from an HDR chain to average its samples in
 * scene-linear light: the samples are drawn without the display stage (tone
 * mapping, lens finish), and their average is then drawn through the display
 * stage once. `ZhudaFilmicPipeline.linearChain()` is one.
 */
export interface CinematicLinearChain {
    /** Samples follow: the frame comes out scene-linear. */
    beginSamples(): void;
    /**
     * The resolve follows: `average` (RGBA float, scene-linear, rows from the
     * top of the picture) replaces the scene and only the display stage runs.
     */
    beginResolve(average: Float32Array, width: number, height: number): void;
    /** Puts the chain back as it was. Safe to call again. */
    end(): void;
}
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
    /**
     * With more than one sample: average them in scene-linear light, before
     * tone mapping, through this chain. Without it the samples are averaged
     * after tone mapping, which dims every highlight that depth of field or
     * motion spreads out (a lamp out of focus turns grey instead of staying
     * bright).
     */
    linear?: CinematicLinearChain;
}
export interface CinematicFramePixels {
    width: number;
    height: number;
    index: number;
    time: number;
    samples: number;
    colorSpace: 'srgb';
    /**
     * Where the samples were averaged: `scene-linear` before tone mapping (the
     * request carried a `linear` chain), else `display-linear` after it.
     */
    accumulation: 'display-linear' | 'scene-linear';
    alpha: 'opaque';
    /** Top-left origin. Caller owns returned bytes. */
    rgba: Uint8Array;
}
/** Owns one offscreen target and a native scene freeze. The runtime must be paused.
 * Aperture/shutter samples are averaged in scene-linear light when the request
 * carries the HDR chain's `linear` handle, else after tone mapping, in
 * display-linear RGB. It is not path tracing or real-time frame-rate evidence. */
export declare class ZhudaCinematicCapture {
    private readonly scene;
    private readonly lens;
    private readonly runtime;
    private readonly target;
    /** Half-float target of the scene-linear samples; made when first needed. */
    private linearTarget;
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
