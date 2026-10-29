/** Serializable, renderer-independent particle descriptors. Units: pixels, seconds, radians. */
export type ParticleRange = number | [number, number];
export interface ParticleCurveKey { time: number; value: number; }
export interface ParticleColorKey { time: number; color: string; }
export interface ParticleTransform { x: number; y: number; rotation: number; }
export type ParticleShape = { type: 'point' } | { type: 'box'; width: number; height: number }
  | { type: 'circle'; radius: number; edge?: boolean };

export interface ParticleEmitterSpec {
  id: string;
  texture: string;
  maxParticles: number;
  seed: number;
  space: 'world' | 'local';
  blend: 'additive' | 'alpha';
  shape: ParticleShape;
  rate: number;
  rateOverDistance?: number;
  bursts?: Array<{ time: number; count: number }>;
  duration?: number;
  loop?: boolean;
  lifetime: ParticleRange;
  speed: ParticleRange;
  angle: ParticleRange;
  size: ParticleRange;
  rotation?: ParticleRange;
  angularVelocity?: ParticleRange;
  acceleration?: { x: number; y: number };
  drag?: number;
  turbulence?: { strength: number; frequency: number };
  stretch?: number;
  alignToVelocity?: boolean;
  sizeOverLife?: ParticleCurveKey[];
  alphaOverLife?: ParticleCurveKey[];
  colorOverLife?: ParticleColorKey[];
}

export interface ParticleEffectSpec {
  schemaVersion: 1;
  emitters: ParticleEmitterSpec[];
}

/** Borrowed pooled particle; copy it if retaining it beyond a frame. */
export interface ParticleState {
  x: number; y: number; vx: number; vy: number;
  age: number; lifetime: number; baseSize: number; size: number;
  rotation: number; angularVelocity: number; phase: number;
}

export function sampleParticleCurve(keys: ParticleCurveKey[] | undefined, time: number, fallback = 1): number {
  if (!keys?.length) return fallback;
  if (time <= keys[0].time) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].time) {
      const a = keys[i - 1], b = keys[i];
      return a.value + (b.value - a.value) * (time - a.time) / (b.time - a.time);
    }
  }
  return keys[keys.length - 1].value;
}

export function sampleParticleColor(keys: ParticleColorKey[] | undefined, time: number): string {
  if (!keys?.length) return '#ffffff';
  if (time <= keys[0].time) return keys[0].color;
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].time) {
      const a = keys[i - 1], b = keys[i];
      const t = (time - a.time) / (b.time - a.time);
      let hex = '#';
      for (let c = 1; c < 7; c += 2) {
        const av = parseInt(a.color.slice(c, c + 2), 16), bv = parseInt(b.color.slice(c, c + 2), 16);
        hex += Math.round(av + (bv - av) * t).toString(16).padStart(2, '0');
      }
      return hex;
    }
  }
  return keys[keys.length - 1].color;
}

export function validateParticleEffect(value: unknown): string[] {
  const issues: string[] = [];
  const spec = value as ParticleEffectSpec;
  if (!spec || spec.schemaVersion !== 1 || !Array.isArray(spec.emitters) || !spec.emitters.length) {
    return ['Expected schemaVersion: 1 and a non-empty emitters array.'];
  }
  const ids = new Set<string>();
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  for (const e of spec.emitters) {
    if (!e || typeof e !== 'object') { issues.push('Emitter must be an object.'); continue; }
    const id = e.id || '(unnamed)';
    if (typeof e.id !== 'string' || !e.id || ids.has(e.id)) issues.push(`${id}: id must be unique and non-empty.`);
    ids.add(e.id);
    if (typeof e.texture !== 'string' || !e.texture) issues.push(`${id}: texture is required.`);
    if (!Number.isInteger(e.maxParticles) || e.maxParticles < 1 || e.maxParticles > 16383) issues.push(`${id}: maxParticles must be 1..16383.`);
    if (!Number.isInteger(e.seed)) issues.push(`${id}: seed must be an integer.`);
    if (!['world', 'local'].includes(e.space) || !['alpha', 'additive'].includes(e.blend)) issues.push(`${id}: explicit space and blend are required.`);
    if (!finite(e.rate) || e.rate < 0) issues.push(`${id}: rate must be non-negative.`);
    for (const key of ['lifetime', 'speed', 'angle', 'size', 'rotation', 'angularVelocity'] as const) {
      const v = e[key];
      if (v === undefined && ['rotation', 'angularVelocity'].includes(key)) continue;
      const range = Array.isArray(v) ? v : [v, v];
      if (range.length !== 2 || !range.every(finite) || range[0] > range[1]) issues.push(`${id}: invalid ${key} range.`);
      else if ((key === 'lifetime' || key === 'size') && range[0] <= 0) issues.push(`${id}: ${key} must be positive.`);
    }
    if (!e.shape || !['point', 'box', 'circle'].includes(e.shape.type)) issues.push(`${id}: invalid shape.`);
    else if (e.shape.type === 'box' && (![e.shape.width, e.shape.height].every(finite) || e.shape.width < 0 || e.shape.height < 0)) issues.push(`${id}: invalid box dimensions.`);
    else if (e.shape.type === 'circle' && (!finite(e.shape.radius) || e.shape.radius < 0)) issues.push(`${id}: invalid circle radius.`);
    for (const key of ['drag', 'rateOverDistance', 'stretch'] as const) {
      if (e[key] !== undefined && (!finite(e[key]) || e[key] < 0)) issues.push(`${id}: ${key} must be non-negative.`);
    }
    if (e.duration !== undefined && (!finite(e.duration) || e.duration <= 0)) issues.push(`${id}: duration must be positive.`);
    if (e.loop !== undefined && typeof e.loop !== 'boolean') issues.push(`${id}: loop must be boolean.`);
    if (e.loop && e.duration !== undefined && e.duration < 1 / 120) issues.push(`${id}: looping duration must be at least 1/120 second.`);
    if (e.acceleration && ![e.acceleration.x, e.acceleration.y].every(finite)) issues.push(`${id}: acceleration must be finite.`);
    if (e.turbulence && (![e.turbulence.strength, e.turbulence.frequency].every(finite) || e.turbulence.strength < 0 || e.turbulence.frequency < 0)) issues.push(`${id}: invalid turbulence.`);
    if (e.bursts !== undefined && (!Array.isArray(e.bursts) || e.bursts.some(b => !b || !finite(b.time) || b.time < 0 || !Number.isInteger(b.count) || b.count < 0))) issues.push(`${id}: invalid bursts.`);
    if (Array.isArray(e.bursts) && finite(e.duration) && e.bursts.some(b => b && b.time > e.duration!)) issues.push(`${id}: burst time exceeds duration.`);
    for (const key of ['sizeOverLife', 'alphaOverLife', 'colorOverLife'] as const) {
      const keys = e[key];
      if (keys === undefined) continue;
      if (!Array.isArray(keys) || !keys.length) { issues.push(`${id}: ${key} must be non-empty.`); continue; }
      let previous = -1;
      for (const k of keys) {
        if (!k || !finite(k.time) || k.time < 0 || k.time > 1 || k.time <= previous) { issues.push(`${id}: ${key} times must increase within 0..1.`); break; }
        previous = k.time;
        if (key === 'colorOverLife') {
          if (!/^#[0-9a-f]{6}$/i.test((k as ParticleColorKey).color)) issues.push(`${id}: colors must use #rrggbb.`);
        } else if (!finite((k as ParticleCurveKey).value) || (k as ParticleCurveKey).value < 0 || (key === 'alphaOverLife' && (k as ParticleCurveKey).value > 1)) issues.push(`${id}: invalid ${key} value.`);
      }
    }
  }
  return issues;
}
