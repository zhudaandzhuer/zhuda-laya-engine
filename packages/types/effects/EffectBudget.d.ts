// Generated from TypeScript source; run npm run types:generate.
export interface EffectBudgetSpec {
    maxParticles: number;
    maxCoverage: number;
    targetFrameMs?: number;
    minQuality?: number;
}
export interface EffectBudgetRequest {
    id: string;
    particles: number;
    coverage: number;
    priority: number;
    visible?: boolean;
    distance?: number;
    /** Reserve this fraction before cosmetic extras. Consumer defines importance. */
    minimumScale?: number;
    /** Consumer-owned simplified telegraph/preset to show if the minimum cannot fit. */
    fallbackId?: string;
}
export interface EffectAllocation {
    id: string;
    particleLimit: number;
    emissionScale: number;
    mode: 'full' | 'reduced' | 'fallback' | 'culled';
    fallbackRequired: boolean;
    fallbackId?: string;
}
/**
 * Nanoseconds the GPU spent in a frame's render passes, from their begin and
 * end stamps (`used` pairs). Passes that follow each other within one
 * timestamp step are taken as one stretch, from the first's begin to the last's
 * end, so rounding costs at most a step a stretch instead of a step a pass;
 * idle time between stretches is not counted. A pass begun and never handed
 * over leaves zeros and is skipped. Pure.
 */
export declare function zhudaPassesBusyNs(stamps: ArrayLike<bigint>, used: number): bigint;
export declare class ZhudaEffectBudget {
    readonly spec: EffectBudgetSpec;
    quality: number;
    private slow;
    private fast;
    constructor(spec: EffectBudgetSpec);
    observeFrame(ms: number): void;
    allocate(requests: readonly EffectBudgetRequest[]): EffectAllocation[];
}
export interface RuntimeFrameSample {
    frameMs: number;
    cpuMs: number;
    drawCalls: number;
    triangles: number;
    /**
     * WebGL: how often the frame went to another render target (a framebuffer
     * bound that was not the one bound before). Each is a pass a tile-based
     * phone GPU starts and ends. Not counted on WebGPU.
     */
    renderTargets?: number;
    /** Only populated by a valid, non-disjoint GPU timer query. */
    gpuMs?: number;
    /** Optional caller-measured JS heap, never inferred GPU/native memory. */
    heapBytes?: number;
}
export interface RuntimeProfilerOptions {
    capacity?: number;
}
export interface RuntimePercentiles {
    p50: number | null;
    p95: number | null;
    p99: number | null;
}
/**
 * Bounded raw window. Timings are caller-supplied; draw counts are intercepted
 * draw calls (WebGL: on a context; WebGPU: on every render pass of the realm).
 */
export declare class ZhudaRuntimeProfiler {
    private calls;
    private triangles;
    private targets;
    private countsTargets;
    private contexts;
    private contextCount;
    private restore;
    private samples;
    private next;
    private total;
    private duration;
    readonly capacity: number;
    private gpu?;
    /** WebGPU timestamp queries: one pair a render pass, resolved a frame later. */
    private gpuPasses?;
    private webgpu;
    private gpuReason;
    /** The newest GPU time resolved and not yet taken (`takeGpuMs`). */
    private newestGpuMs;
    private frameOpen;
    constructor(options?: RuntimeProfilerOptions);
    attach(gl: any): void;
    /**
     * WebGPU: counts the draws and triangles of every render pass begun in
     * this realm while attached (a render pass does not say which device it
     * belongs to). `device` is the `GPUDevice`; `env` is where the browser's
     * WebGPU classes are, the global object by default.
     *
     * Triangles are counted for triangle lists and strips. A pipeline made
     * before this was attached counts as a triangle list, which is what
     * WebGPU makes when nothing else is asked for. Indirect draws are counted
     * as draws; how many triangles they are is on the GPU.
     */
    attachWebGPU(device: any, env?: any): void;
    /**
     * Optional GPU timer. Never blocks on completion or substitutes CPU elapsed time.
     *
     * WebGL 2: one disjoint timer query round the frame. WebGPU (pass the
     * `GPUDevice`): a pair of timestamps on each render pass begun between
     * `beginFrame()` and `endFrame()`, summed; a frame's time arrives a frame
     * or more later. It needs the device's `timestamp-query` feature, times
     * the first 32 render passes of a frame, and leaves compute passes and
     * copies out.
     */
    enableGpuTiming(gl: WebGL2RenderingContext | any, env?: any): boolean;
    private enableWebGPUTiming;
    /**
     * The frame that ended: its timestamps are read once its passes have been
     * handed to the GPU, which is by the time the next frame begins.
     */
    private resolvePasses;
    private pollGpu;
    private pollQueries;
    beginFrame(): void;
    endFrame(frameMs: number, cpuMs: number, extra?: {
        heapBytes?: number;
    }): RuntimeFrameSample;
    /**
     * The newest GPU frame time resolved since the last call, in
     * milliseconds, or undefined when none arrived (no GPU timing, a frame
     * still on its way back, a disjoint or lost query). For a governor fed
     * once a frame: `governor.sample(frameMs, profiler.takeGpuMs())`. A frame's
     * time arrives a frame or more after the frame.
     */
    takeGpuMs(): number | undefined;
    report(): {
        measured: boolean;
        sources: {
            frame: string;
            cpu: string;
            draw: string;
            heap: string;
            gpu: string;
        };
        totalSamples: number;
        retainedSamples: number;
        droppedSamples: number;
        durationMs: number;
        retainedDurationMs: number;
        frame: RuntimePercentiles;
        cpu: RuntimePercentiles;
        gpu: RuntimePercentiles;
        frameP95Ms: number | null;
        gpuTimeMs: number | null;
        gpuTimeReason: string;
        samples: {
            frameMs: number;
            cpuMs: number;
            drawCalls: number;
            triangles: number;
            /**
             * WebGL: how often the frame went to another render target (a framebuffer
             * bound that was not the one bound before). Each is a pass a tile-based
             * phone GPU starts and ends. Not counted on WebGPU.
             */
            renderTargets?: number;
            /** Only populated by a valid, non-disjoint GPU timer query. */
            gpuMs?: number;
            /** Optional caller-measured JS heap, never inferred GPU/native memory. */
            heapBytes?: number;
        }[];
    };
    exportJSON(metadata?: Record<string, unknown>): string;
    dispose(): void;
}
