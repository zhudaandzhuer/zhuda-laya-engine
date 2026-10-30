export interface EffectKey { time: number; value: number; }
export interface EffectTrack { target: string; parameter: string; keys: EffectKey[]; }
export interface EffectCue { time: number; target: string; action: 'start' | 'stop' | 'event'; name?: string; }
export interface EffectAnchor { x: number; y: number; z?: number; rotation?: number; }
export interface EffectAttachment { target: string; source: string; anchor: string; offset?: EffectAnchor; }
export interface EffectTimelineSpec { version: 1; duration: number; loop?: boolean; tracks?: EffectTrack[]; cues?: EffectCue[]; attachments?: EffectAttachment[]; }
export interface EffectBinding {
  reset(): void;
  setParameter?(name: string, value: number): void;
  start?(name?: string): void;
  stop?(): void;
  event?(name: string): void;
  resolveAnchor?(name: string): EffectAnchor | null;
  setTransform?(value: EffectAnchor): void;
}
export function validateEffectTimeline(s: EffectTimelineSpec): string[] {
  const errors: string[] = [];
  if (!s || s.version !== 1 || !Number.isFinite(s.duration) || s.duration < 1 / 120) return ['Timeline requires version 1 and duration >= 1/120.'];
  for (const key of ['tracks','cues','attachments']) if (s[key] !== undefined && !Array.isArray(s[key])) return [`${key} must be an array.`];
  if (s.loop !== undefined && typeof s.loop !== 'boolean') errors.push('loop must be boolean.');
  for (const t of s.tracks || []) {
    if (!t.target || !t.parameter || !Array.isArray(t.keys) || !t.keys.length) { errors.push('Track needs target, parameter and keys.'); continue; }
    let previous = -1;
    for (const k of t.keys) { if (!Number.isFinite(k.time) || k.time < 0 || k.time > s.duration || k.time <= previous || !Number.isFinite(k.value)) errors.push('Invalid or unordered track key.'); previous = k.time; }
  }
  for (const c of s.cues || []) if (!c.target || !['start', 'stop', 'event'].includes(c.action) || !Number.isFinite(c.time) || c.time < 0 || c.time > s.duration || (c.action === 'event' && !c.name)) errors.push('Invalid cue.');
  for (const a of s.attachments || []) if (!a.target || !a.source || !a.anchor || (a.offset && ![a.offset.x, a.offset.y, a.offset.z ?? 0, a.offset.rotation ?? 0].every(Number.isFinite))) errors.push('Invalid attachment.');
  return errors;
}
/** Serializable choreography. Bindings own scene objects, sound and Spine APIs. Seek suppresses external event cues by default. */
export class ZhudaEffectDirector {
  readonly spec: EffectTimelineSpec;
  time = 0; playing = false; cycle = 0;
  private initial = true;
  private readonly bindings: Record<string, EffectBinding>;
  constructor(spec: EffectTimelineSpec, bindings: Record<string, EffectBinding>) {
    const errors = validateEffectTimeline(spec); if (errors.length) throw new Error(errors.join(' | '));
    this.spec = JSON.parse(JSON.stringify(spec)); this.bindings = bindings;
    for (const t of spec.tracks || []) if (!bindings[t.target]?.setParameter) throw new Error(`Missing parameter binding: ${t.target}`);
    for (const c of spec.cues || []) if (!bindings[c.target]?.[c.action]) throw new Error(`Missing ${c.action} binding: ${c.target}`);
    for (const a of spec.attachments || []) if (!bindings[a.source]?.resolveAnchor || !bindings[a.target]?.setTransform) throw new Error('Missing attachment binding.');
  }
  reset(): void { for (const b of Object.values(this.bindings)) b.reset(); this.time = this.cycle = 0; this.initial = true; this.playing = false; this.apply(); }
  play(restart = false): void { if (restart || this.time >= this.spec.duration) this.reset(); this.playing = true; this.advance(0, true); }
  pause(): void { this.playing = false; }
  stop(): void { this.playing = false; for (const b of Object.values(this.bindings)) b.stop?.(); }
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0 || dt > 10) throw new Error('Timeline delta must be 0..10 seconds.');
    if (this.playing) this.advance(dt, true); else this.apply();
  }
  seek(time: number, dispatchEvents = false): void {
    if (!Number.isFinite(time) || time < 0 || time > this.spec.duration) throw new Error('Seek outside timeline.');
    this.reset(); this.advance(time, dispatchEvents); this.playing = false;
  }
  private advance(dt: number, dispatchEvents: boolean): void {
    let remaining = dt, events = 0;
    do {
      const end = Math.min(this.spec.duration, this.time + remaining);
      const cues = (this.spec.cues || []).filter(c => (c.time > this.time || (this.initial && c.time === 0)) && c.time <= end).sort((a, b) => a.time - b.time);
      for (const c of cues) {
        if (++events > 4096) throw new Error('Timeline cue budget exceeded.');
        if (c.action !== 'event' || dispatchEvents) {
          const b = this.bindings[c.target]; if (c.action === 'event') b.event!(c.name!); else if (c.action === 'start') b.start!(c.name); else b.stop!();
        }
      }
      remaining -= end - this.time; this.time = end; this.initial = false; this.apply();
      if (this.time >= this.spec.duration) {
        if (this.spec.loop && remaining > 1e-10) { this.cycle++; this.time = 0; this.initial = true; }
        else { if (!this.spec.loop) this.playing = false; break; }
      }
    } while (remaining > 1e-10);
  }
  private apply(): void {
    for (const t of this.spec.tracks || []) {
      let value = t.keys[0].value;
      for (let i = 0; i < t.keys.length; i++) { const a = t.keys[i], b = t.keys[i + 1]; if (this.time >= a.time) value = !b || this.time >= b.time ? a.value : a.value + (b.value - a.value) * (this.time - a.time) / (b.time - a.time); }
      this.bindings[t.target].setParameter!(t.parameter, value);
    }
    for (const a of this.spec.attachments || []) {
      const p = this.bindings[a.source].resolveAnchor!(a.anchor); if (!p) continue;
      const o = a.offset || { x: 0, y: 0 }, r = p.rotation || 0, c = Math.cos(r), s = Math.sin(r);
      this.bindings[a.target].setTransform!({ x: p.x + o.x * c - o.y * s, y: p.y + o.x * s + o.y * c, z: (p.z || 0) + (o.z || 0), rotation: r + (o.rotation || 0) });
    }
  }
}
