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
/** Admission plan for future births. Existing particles drain; fallback costs need their own budget. */
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
/** Bounded raw window. Timings are caller-supplied; draw counts are intercepted WebGL calls. */
export declare class ZhudaRuntimeProfiler {
    private calls;
    private triangles;
    private contexts;
    private contextCount;
    private restore;
    private samples;
    private next;
    private total;
    private duration;
    readonly capacity: number;
    private gpu?;
    private gpuReason;
    private frameOpen;
    constructor(options?: RuntimeProfilerOptions);
    attach(gl: any): void;
    /** Optional WebGL2 timer. Never blocks on completion or substitutes CPU elapsed time. */
    enableGpuTiming(gl: WebGL2RenderingContext): boolean;
    private pollGpu;
    beginFrame(): void;
    endFrame(frameMs: number, cpuMs: number, extra?: {
        heapBytes?: number;
    }): RuntimeFrameSample;
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
            /** Only populated by a valid, non-disjoint GPU timer query. */
            gpuMs?: number;
            /** Optional caller-measured JS heap, never inferred GPU/native memory. */
            heapBytes?: number;
        }[];
    };
    exportJSON(metadata?: Record<string, unknown>): string;
    dispose(): void;
}
