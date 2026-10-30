export interface EffectBudgetSpec { maxParticles: number; maxCoverage: number; targetFrameMs?: number; minQuality?: number; }
export interface EffectBudgetRequest { id: string; particles: number; coverage: number; priority: number; visible?: boolean; distance?: number; }
export interface EffectAllocation { id: string; particleLimit: number; emissionScale: number; }
/** Global admission plan. Lower limits stop new births; living particles drain naturally. */
export class ZhudaEffectBudget {
  readonly spec: EffectBudgetSpec;
  quality = 1;
  private slow = 0; private fast = 0;
  constructor(spec: EffectBudgetSpec) {
    if (!Number.isInteger(spec.maxParticles) || spec.maxParticles < 0 || !Number.isFinite(spec.maxCoverage) || spec.maxCoverage < 0 || (spec.targetFrameMs !== undefined && (!Number.isFinite(spec.targetFrameMs) || spec.targetFrameMs <= 0)) || (spec.minQuality !== undefined && (!Number.isFinite(spec.minQuality) || spec.minQuality <= 0 || spec.minQuality > 1))) throw new Error('Invalid effect budget.');
    this.spec = { ...spec };
  }
  observeFrame(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) throw new Error('Invalid frame measurement.');
    const target = this.spec.targetFrameMs || 16.67;
    this.slow = ms > target * 1.25 ? this.slow + 1 : 0; this.fast = ms < target * .9 ? this.fast + 1 : 0;
    if (this.slow >= 15) { this.quality = Math.max(this.spec.minQuality ?? .25, this.quality - .1); this.slow = 0; }
    if (this.fast >= 120) { this.quality = Math.min(1, this.quality + .05); this.fast = 0; }
  }
  allocate(requests: readonly EffectBudgetRequest[]): EffectAllocation[] {
    const seen = new Set<string>();
    for (const r of requests) { if (!r.id || seen.has(r.id) || !Number.isInteger(r.particles) || r.particles < 0 || ![r.coverage, r.priority, r.distance ?? 0].every(Number.isFinite) || r.coverage < 0 || (r.distance ?? 0) < 0) throw new Error('Invalid or duplicate effect request.'); seen.add(r.id); }
    let particles = Math.floor(this.spec.maxParticles * this.quality), coverage = this.spec.maxCoverage * this.quality;
    const result = new Map<string, EffectAllocation>();
    for (const r of [...requests].sort((a, b) => b.priority - a.priority || (a.distance || 0) - (b.distance || 0) || a.id.localeCompare(b.id))) {
      const scale = r.visible === false ? 0 : Math.max(0, Math.min(1, r.particles ? particles / r.particles : 1, r.coverage ? coverage / r.coverage : 1));
      const limit = Math.floor(r.particles * scale), effective = r.particles ? limit / r.particles : scale;
      particles -= limit; coverage -= r.coverage * effective;
      result.set(r.id, { id: r.id, particleLimit: limit, emissionScale: effective });
    }
    return requests.map(r => result.get(r.id)!);
  }
}
export interface RuntimeFrameSample { frameMs: number; cpuMs: number; drawCalls: number; triangles: number; }
/** Measures actual intercepted WebGL calls; does not infer GPU completion from CPU elapsed time. */
export class ZhudaRuntimeProfiler {
  private calls = 0; private triangles = 0;
  private contexts = new WeakSet<object>();
  private restore: Array<() => void> = [];
  private samples: RuntimeFrameSample[] = [];
  attach(gl: any): void {
    if (!gl) throw new Error('A WebGL context is required.');
    if (this.contexts.has(gl)) return; this.contexts.add(gl);
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      if (typeof gl[name] !== 'function') continue;
      const original = gl[name], profiler = this;
      const wrapper = function(...args: any[]) { profiler.calls++; const count = name.startsWith('drawElements') ? args[1] : args[2]; const instances = name.endsWith('Instanced') ? args[name === 'drawArraysInstanced' ? 3 : 4] : 1; if (args[0] === gl.TRIANGLES) profiler.triangles += Math.floor(count / 3) * instances; return original.apply(gl, args); };
      gl[name] = wrapper; this.restore.push(() => { if (gl[name] === wrapper) gl[name] = original; });
    }
  }
  beginFrame(): void { this.calls = this.triangles = 0; }
  endFrame(frameMs: number, cpuMs: number): RuntimeFrameSample {
    if (![frameMs, cpuMs].every(v => Number.isFinite(v) && v >= 0)) throw new Error('Invalid frame timing.');
    const sample = { frameMs, cpuMs, drawCalls: this.calls, triangles: this.triangles }; this.samples.push(sample); if (this.samples.length > 600) this.samples.shift(); return sample;
  }
  report(): { measured: boolean; gpuTimeMs: null; gpuTimeReason: string; samples: RuntimeFrameSample[]; frameP95Ms: number | null } { const sorted = this.samples.map(s => s.frameMs).sort((a, b) => a - b); return { measured: true, gpuTimeMs: null, gpuTimeReason: 'GPU timer queries are not collected by this profiler.', samples: this.samples.map(s => ({ ...s })), frameP95Ms: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null }; }
  dispose(): void { this.restore.forEach(fn => fn()); this.restore = []; this.contexts = new WeakSet(); }
}
