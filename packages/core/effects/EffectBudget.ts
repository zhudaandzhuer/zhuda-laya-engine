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
export class ZhudaEffectBudget {
  readonly spec: EffectBudgetSpec;
  quality = 1;
  private slow = 0;
  private fast = 0;
  constructor(spec: EffectBudgetSpec) {
    if (
      !Number.isInteger(spec.maxParticles) ||
      spec.maxParticles < 0 ||
      !Number.isFinite(spec.maxCoverage) ||
      spec.maxCoverage < 0 ||
      (spec.targetFrameMs !== undefined &&
        (!Number.isFinite(spec.targetFrameMs) || spec.targetFrameMs <= 0)) ||
      (spec.minQuality !== undefined &&
        (!Number.isFinite(spec.minQuality) || spec.minQuality <= 0 || spec.minQuality > 1))
    )
      throw new Error('Invalid effect budget.');
    this.spec = { ...spec };
  }
  observeFrame(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) throw new Error('Invalid frame measurement.');
    const target = this.spec.targetFrameMs || 16.67;
    this.slow = ms > target * 1.25 ? this.slow + 1 : 0;
    this.fast = ms < target * 0.9 ? this.fast + 1 : 0;
    if (this.slow >= 15) {
      this.quality = Math.max(this.spec.minQuality ?? 0.25, this.quality - 0.1);
      this.slow = 0;
    }
    if (this.fast >= 120) {
      this.quality = Math.min(1, this.quality + 0.05);
      this.fast = 0;
    }
  }
  allocate(requests: readonly EffectBudgetRequest[]): EffectAllocation[] {
    const seen = new Set<string>();
    for (const r of requests) {
      if (
        !r.id ||
        seen.has(r.id) ||
        !Number.isInteger(r.particles) ||
        r.particles < 0 ||
        ![r.coverage, r.priority, r.distance ?? 0, r.minimumScale ?? 0].every(Number.isFinite) ||
        r.coverage < 0 ||
        (r.distance ?? 0) < 0 ||
        (r.minimumScale ?? 0) < 0 ||
        (r.minimumScale ?? 0) > 1 ||
        (r.fallbackId !== undefined && !r.fallbackId)
      )
        throw new Error('Invalid or duplicate effect request.');
      seen.add(r.id);
    }
    if (!Number.isFinite(this.quality) || this.quality < 0 || this.quality > 1)
      throw Error('Invalid effect quality.');
    let particles = Math.floor(this.spec.maxParticles * this.quality),
      coverage = this.spec.maxCoverage * this.quality;
    const ordered = [...requests].sort(
      (a, b) =>
        b.priority - a.priority ||
        (a.distance || 0) - (b.distance || 0) ||
        a.id.localeCompare(b.id),
    );
    const result = new Map<string, EffectAllocation>();
    // First reserve minima. Lower-priority warnings cannot be eaten by cosmetic extras.
    for (const r of ordered) {
      const limit = Math.ceil(r.particles * (r.minimumScale ?? 0));
      const scale = r.particles ? limit / r.particles : (r.minimumScale ?? 0);
      const hidden = r.visible === false;
      const unmet = !hidden && (limit > particles || r.coverage * scale > coverage + 1e-10);
      const admitted = !hidden && !unmet;
      if (admitted) {
        particles -= limit;
        coverage -= r.coverage * scale;
      }
      result.set(r.id, {
        id: r.id,
        particleLimit: admitted ? limit : 0,
        emissionScale: admitted ? scale : 0,
        mode: hidden ? 'culled' : unmet ? 'fallback' : 'reduced',
        fallbackRequired: unmet,
        ...(unmet && r.fallbackId ? { fallbackId: r.fallbackId } : {}),
      });
    }
    for (const r of ordered) {
      const a = result.get(r.id)!;
      if (a.mode === 'culled' || a.fallbackRequired) continue;
      const extra = Math.max(
        0,
        Math.min(
          1 - a.emissionScale,
          r.particles ? particles / r.particles : 1,
          r.coverage ? coverage / r.coverage : 1,
        ),
      );
      const limit = Math.min(
        r.particles - a.particleLimit,
        Math.floor(r.particles * extra + 1e-10),
      );
      const effective = r.particles ? limit / r.particles : extra;
      a.particleLimit += limit;
      a.emissionScale += effective;
      particles -= limit;
      coverage = Math.max(0, coverage - r.coverage * effective);
      a.mode = a.emissionScale >= 1 - 1e-10 ? 'full' : 'reduced';
    }
    return requests.map((r) => result.get(r.id)!);
  }
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
function percentiles(values: number[]): RuntimePercentiles {
  values.sort((a, b) => a - b);
  const at = (p: number) => (values.length ? values[Math.ceil(values.length * p) - 1] : null);
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99) };
}
interface GpuQuery {
  query: WebGLQuery;
  sample?: RuntimeFrameSample;
}
/** Bounded raw window. Timings are caller-supplied; draw counts are intercepted WebGL calls. */
export class ZhudaRuntimeProfiler {
  private calls = 0;
  private triangles = 0;
  private contexts = new WeakSet<object>();
  private contextCount = 0;
  private restore: Array<() => void> = [];
  private samples: RuntimeFrameSample[] = [];
  private next = 0;
  private total = 0;
  private duration = 0;
  readonly capacity: number;
  private gpu?: {
    gl: WebGL2RenderingContext;
    timeElapsed: number;
    disjoint: number;
    pending: GpuQuery[];
    active?: GpuQuery;
  };
  private gpuReason = 'GPU timer queries not enabled.';
  private frameOpen = false;
  constructor(options: RuntimeProfilerOptions = {}) {
    this.capacity = options.capacity ?? 600;
    if (!Number.isInteger(this.capacity) || this.capacity < 1 || this.capacity > 1_000_000)
      throw Error('Invalid profiler capacity.');
  }
  attach(gl: any): void {
    if (!gl) throw new Error('A WebGL context is required.');
    if (this.contexts.has(gl)) return;
    this.contexts.add(gl);
    this.contextCount++;
    const wrap = (target: any, names: string[]) => {
      for (const name of names) {
        if (typeof target[name] !== 'function') continue;
        const original = target[name],
          profiler = this;
        const wrapper = function (...args: number[]) {
          profiler.calls++;
          const count = name.startsWith('drawElements') ? args[1] : args[2];
          const instances = name.includes('Instanced')
            ? args[name.startsWith('drawArrays') ? 3 : 4]
            : 1;
          if (args[0] === gl.TRIANGLES) profiler.triangles += Math.floor(count / 3) * instances;
          else if (args[0] === gl.TRIANGLE_STRIP || args[0] === gl.TRIANGLE_FAN)
            profiler.triangles += Math.max(0, count - 2) * instances;
          return original.apply(target, args);
        };
        target[name] = wrapper;
        this.restore.push(() => {
          if (target[name] === wrapper) target[name] = original;
        });
      }
    };
    wrap(gl, ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']);
    if (!gl.drawArraysInstanced) {
      const angle = gl.getExtension?.('ANGLE_instanced_arrays');
      if (angle) wrap(angle, ['drawArraysInstancedANGLE', 'drawElementsInstancedANGLE']);
    }
  }
  /** Optional WebGL2 timer. Never blocks on completion or substitutes CPU elapsed time. */
  enableGpuTiming(gl: WebGL2RenderingContext): boolean {
    if (this.gpu) throw Error('GPU timing already enabled.');
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext || typeof gl.createQuery !== 'function') {
      this.gpuReason = 'EXT_disjoint_timer_query_webgl2 unavailable.';
      return false;
    }
    this.gpu = {
      gl,
      timeElapsed: ext.TIME_ELAPSED_EXT,
      disjoint: ext.GPU_DISJOINT_EXT,
      pending: [],
    };
    this.gpuReason = 'No completed valid GPU queries in retained window.';
    return true;
  }
  private pollGpu(): void {
    const g = this.gpu;
    if (!g) return;
    const invalid = g.gl.isContextLost() || g.gl.getParameter(g.disjoint);
    for (let i = g.pending.length - 1; i >= 0; i--) {
      const q = g.pending[i];
      if (invalid || g.gl.getQueryParameter(q.query, g.gl.QUERY_RESULT_AVAILABLE)) {
        if (!invalid && q.sample) {
          const ms = Number(g.gl.getQueryParameter(q.query, g.gl.QUERY_RESULT)) / 1e6;
          if (Number.isFinite(ms) && ms >= 0) q.sample.gpuMs = ms;
        }
        g.gl.deleteQuery(q.query);
        g.pending.splice(i, 1);
      }
    }
    if (invalid) this.gpuReason = 'GPU disjoint or context lost; affected queries discarded.';
  }
  beginFrame(): void {
    if (this.frameOpen) throw Error('End the previous profiler frame first.');
    this.frameOpen = true;
    this.calls = this.triangles = 0;
    this.pollGpu();
    const g = this.gpu;
    if (
      g &&
      !g.gl.isContextLost() &&
      !g.gl.getParameter(g.disjoint) &&
      g.pending.length < 64 &&
      !g.gl.getQuery(g.timeElapsed, g.gl.CURRENT_QUERY)
    ) {
      const query = g.gl.createQuery();
      if (query) {
        g.active = { query };
        g.gl.beginQuery(g.timeElapsed, query);
      }
    }
  }
  endFrame(frameMs: number, cpuMs: number, extra: { heapBytes?: number } = {}): RuntimeFrameSample {
    if (![frameMs, cpuMs, extra.heapBytes ?? 0].every((v) => Number.isFinite(v) && v >= 0))
      throw new Error('Invalid frame timing or heap.');
    const sample: RuntimeFrameSample = {
      frameMs,
      cpuMs,
      drawCalls: this.calls,
      triangles: this.triangles,
      ...(extra.heapBytes === undefined ? {} : { heapBytes: extra.heapBytes }),
    };
    const g = this.gpu;
    if (g?.active) {
      g.gl.endQuery(g.timeElapsed);
      g.active.sample = sample;
      g.pending.push(g.active);
      g.active = undefined;
    }
    this.frameOpen = false;
    this.samples[this.next] = sample;
    this.next = (this.next + 1) % this.capacity;
    this.total++;
    this.duration += frameMs;
    // Do not expose mutable retained samples to callers.
    return { ...sample };
  }
  report() {
    this.pollGpu();
    const samples = (
      this.samples.length < this.capacity
        ? this.samples
        : [...this.samples.slice(this.next), ...this.samples.slice(0, this.next)]
    ).map((s) => ({ ...s }));
    const frame = percentiles(samples.map((s) => s.frameMs)),
      cpu = percentiles(samples.map((s) => s.cpuMs));
    const gpu = percentiles(samples.flatMap((s) => (s.gpuMs === undefined ? [] : [s.gpuMs])));
    return {
      measured: this.total > 0,
      sources: {
        frame: 'caller elapsed frame interval',
        cpu: 'caller timed work scope',
        draw: this.contextCount ? 'intercepted WebGL calls' : 'unavailable: no context attached',
        heap: 'optional caller JS heap bytes',
        gpu: 'optional disjoint timer query',
      },
      totalSamples: this.total,
      retainedSamples: samples.length,
      droppedSamples: this.total - samples.length,
      durationMs: this.duration,
      retainedDurationMs: samples.reduce((n, s) => n + s.frameMs, 0),
      frame,
      cpu,
      gpu,
      frameP95Ms: frame.p95,
      gpuTimeMs: gpu.p50,
      gpuTimeReason:
        gpu.p50 === null
          ? this.gpuReason
          : 'Median of valid completed GPU queries in retained window.',
      samples,
    };
  }
  exportJSON(metadata: Record<string, unknown> = {}): string {
    return JSON.stringify({ schemaVersion: 1, metadata, ...this.report() });
  }
  dispose(): void {
    const g = this.gpu;
    if (g) {
      if (g.active) {
        if (!g.gl.isContextLost()) g.gl.endQuery(g.timeElapsed);
        g.gl.deleteQuery(g.active.query);
      }
      for (const q of g.pending) g.gl.deleteQuery(q.query);
      this.gpu = undefined;
    }
    this.frameOpen = false;
    this.restore.forEach((fn) => fn());
    this.restore = [];
    this.contexts = new WeakSet();
    this.contextCount = 0;
  }
}
