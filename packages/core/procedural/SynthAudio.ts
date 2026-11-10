/**
 * Synthesised sound effects from a JSON recipe: layered noise and tones with
 * envelopes and one-pole filters, rendered deterministically to mono PCM and
 * optionally wrapped as a 16-bit WAV. Feed the bytes to the existing sample
 * path through an `AssetProvider`; do not open another AudioContext.
 */
import { createZhudaRandom } from './Random.ts';

export interface ZhudaSynthEnvelope {
  /** Linear rise to full level. */
  attackSec?: number;
  /** Time held at full level after the attack. */
  holdSec?: number;
  /** Exponential fall; the level is about 1% after this long. */
  releaseSec: number;
}
interface SynthLayerBase {
  /** Linear gain, 0..4. */
  gain: number;
  envelope: ZhudaSynthEnvelope;
  /** Delay before this layer starts. */
  startSec?: number;
  lowpassHz?: number;
  highpassHz?: number;
}
export type ZhudaSynthLayer =
  | (SynthLayerBase & { type: 'noise'; color?: 'white' | 'pink' | 'brown' })
  | (SynthLayerBase & {
      type: 'tone';
      wave?: 'sine' | 'square' | 'saw' | 'triangle';
      frequencyHz: number;
      /** Glide target reached at the end of the sound. */
      endFrequencyHz?: number;
    });
export interface ZhudaSynthRecipe {
  schemaVersion: 1;
  id: string;
  durationSec: number;
  sampleRate?: number;
  seed?: number;
  layers: ZhudaSynthLayer[];
  /** Peak level after normalisation, 0..1 (default 0.9). */
  peak?: number;
}

const ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000];
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const within = (value: unknown, min: number, max: number): value is number =>
  finite(value) && value >= min && value <= max;

export function validateZhudaSynthRecipe(recipe: unknown): string[] {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe))
    return ['recipe must be an object'];
  const r = recipe as Record<string, unknown>,
    issues: string[] = [];
  if (r.schemaVersion !== 1) issues.push('schemaVersion: must be 1');
  if (typeof r.id !== 'string' || !ID.test(r.id))
    issues.push('id: use lowercase letters, digits, dot, dash or underscore (1..64)');
  if (!within(r.durationSec, 0.01, 10)) issues.push('durationSec: use 0.01..10 seconds');
  if (r.sampleRate !== undefined && !RATES.includes(r.sampleRate as number))
    issues.push(`sampleRate: use one of ${RATES.join(', ')}`);
  if (r.seed !== undefined && !(Number.isInteger(r.seed) && (r.seed as number) >= 0))
    issues.push('seed: use a non-negative integer');
  if (r.peak !== undefined && !(finite(r.peak) && r.peak > 0 && r.peak <= 1))
    issues.push('peak: use a level above 0 and at most 1');
  if (!Array.isArray(r.layers) || r.layers.length < 1 || r.layers.length > 16) {
    issues.push('layers: use 1..16 layers');
    return issues;
  }
  r.layers.forEach((layer: unknown, index: number) => {
    const path = `layers[${index}]`;
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
      issues.push(`${path}: layer must be an object`);
      return;
    }
    const l = layer as Record<string, unknown>;
    if (!within(l.gain, 0, 4)) issues.push(`${path}.gain: use 0..4`);
    const e = l.envelope as Record<string, unknown> | undefined;
    if (!e || typeof e !== 'object') issues.push(`${path}.envelope: required`);
    else {
      if (e.attackSec !== undefined && !within(e.attackSec, 0, 10))
        issues.push(`${path}.envelope.attackSec: use 0..10`);
      if (e.holdSec !== undefined && !within(e.holdSec, 0, 10))
        issues.push(`${path}.envelope.holdSec: use 0..10`);
      if (!(finite(e.releaseSec) && e.releaseSec > 0 && e.releaseSec <= 10))
        issues.push(`${path}.envelope.releaseSec: use a time above 0 and at most 10`);
    }
    if (l.startSec !== undefined && !within(l.startSec, 0, 10))
      issues.push(`${path}.startSec: use 0..10`);
    for (const key of ['lowpassHz', 'highpassHz'] as const)
      if (l[key] !== undefined && !within(l[key], 20, 20000))
        issues.push(`${path}.${key}: use 20..20000`);
    if (l.type === 'noise') {
      if (l.color !== undefined && !['white', 'pink', 'brown'].includes(l.color as string))
        issues.push(`${path}.color: use white, pink or brown`);
    } else if (l.type === 'tone') {
      if (l.wave !== undefined && !['sine', 'square', 'saw', 'triangle'].includes(l.wave as string))
        issues.push(`${path}.wave: use sine, square, saw or triangle`);
      if (!within(l.frequencyHz, 20, 20000)) issues.push(`${path}.frequencyHz: use 20..20000`);
      if (l.endFrequencyHz !== undefined && !within(l.endFrequencyHz, 20, 20000))
        issues.push(`${path}.endFrequencyHz: use 20..20000`);
    } else issues.push(`${path}.type: use noise or tone`);
  });
  return issues;
}

/** Renders the recipe to mono samples in -1..1. Same recipe, same samples. */
export function renderZhudaSynth(recipe: ZhudaSynthRecipe): {
  sampleRate: number;
  samples: Float32Array;
} {
  const issues = validateZhudaSynthRecipe(recipe);
  if (issues.length) throw Error(`Invalid synth recipe: ${issues.join('; ')}`);
  const sampleRate = recipe.sampleRate ?? 22050,
    count = Math.max(1, Math.round(recipe.durationSec * sampleRate)),
    samples = new Float32Array(count);
  recipe.layers.forEach((layer, index) => {
    const random = createZhudaRandom((recipe.seed ?? 0) + index * 977 + 1),
      start = Math.round((layer.startSec ?? 0) * sampleRate),
      attack = layer.envelope.attackSec ?? 0,
      hold = layer.envelope.holdSec ?? 0,
      release = layer.envelope.releaseSec,
      lowpass = layer.lowpassHz ? 1 - Math.exp((-2 * Math.PI * layer.lowpassHz) / sampleRate) : 1,
      highpass = layer.highpassHz
        ? 1 - Math.exp((-2 * Math.PI * layer.highpassHz) / sampleRate)
        : 0;
    let low = 0,
      high = 0,
      phase = 0,
      b0 = 0,
      b1 = 0,
      b2 = 0,
      brown = 0;
    for (let n = start; n < count; n++) {
      const t = (n - start) / sampleRate;
      let x: number;
      if (layer.type === 'noise') {
        const white = random.next() * 2 - 1;
        if (layer.color === 'pink') {
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.963 * b1 + white * 0.2965164;
          b2 = 0.57 * b2 + white * 1.0526913;
          x = (b0 + b1 + b2 + white * 0.1848) * 0.25;
        } else if (layer.color === 'brown') {
          brown = (brown + 0.02 * white) / 1.02;
          x = brown * 3.5;
        } else x = white;
      } else {
        const progress = count - start > 1 ? (n - start) / (count - start - 1) : 0,
          frequency =
            layer.frequencyHz + ((layer.endFrequencyHz ?? layer.frequencyHz) - layer.frequencyHz) * progress;
        phase += frequency / sampleRate;
        phase -= Math.floor(phase);
        x =
          layer.wave === 'square'
            ? phase < 0.5
              ? 1
              : -1
            : layer.wave === 'saw'
              ? phase * 2 - 1
              : layer.wave === 'triangle'
                ? 1 - 4 * Math.abs(phase - 0.5)
                : Math.sin(phase * Math.PI * 2);
      }
      low += lowpass * (x - low);
      high += highpass * (low - high);
      const level =
        t < attack ? t / attack : t < attack + hold ? 1 : Math.exp((-4.6 * (t - attack - hold)) / release);
      samples[n] += (low - high) * level * layer.gain;
    }
  });
  let loudest = 0;
  for (let n = 0; n < count; n++) loudest = Math.max(loudest, Math.abs(samples[n]));
  if (loudest > 0) {
    const scale = (recipe.peak ?? 0.9) / loudest;
    for (let n = 0; n < count; n++) samples[n] *= scale;
  }
  return { sampleRate, samples };
}

/** Wraps mono samples as a 16-bit PCM WAV file. */
export function encodeZhudaWav(samples: Float32Array, sampleRate: number): Uint8Array {
  if (!(samples instanceof Float32Array) || !samples.length) throw Error('WAV needs samples');
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
    throw Error('WAV sample rate must be 8000..192000');
  const bytes = new Uint8Array(44 + samples.length * 2),
    view = new DataView(bytes.buffer),
    text = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
    };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return bytes;
}

/** Convenience: recipe straight to WAV bytes. */
export function renderZhudaSynthWav(recipe: ZhudaSynthRecipe): Uint8Array {
  const { sampleRate, samples } = renderZhudaSynth(recipe);
  return encodeZhudaWav(samples, sampleRate);
}
