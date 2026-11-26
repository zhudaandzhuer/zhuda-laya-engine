// 豬大打鼓 — the songs. A song is written here as data (tempo, bars, a seeded melody over four
// chords, bass and drums), turned into notes, and (mix) into one mono track by rendering each
// distinct note once with the engine's synth and adding it in where it sounds. The chart the
// player hits is taken from the melody. Pure: the synth is passed in. Tested in test/beat.test.ts.
import type { ZhudaSynthRecipe } from 'zhuda-laya-engine';

export interface SongDef { id: string; name: string; bpm: number; bars: number; seed: number; scale: number[]; roots: number[]; busy: number }
export const SONGS: SongDef[] = [
  { id: 'bamboo', name: '竹林小調', bpm: 104, bars: 16, seed: 11, scale: [60, 62, 64, 67, 69, 72, 74, 76], roots: [48, 45, 41, 43], busy: 0 },
  { id: 'market', name: '夜市快板', bpm: 126, bars: 20, seed: 23, scale: [57, 60, 62, 64, 67, 69, 72, 74], roots: [45, 41, 48, 43], busy: 1 },
];
export interface Tone { at: number; instrument: 'lead' | 'bass' | 'kick' | 'snare' | 'hat'; midi: number; length: number; gain: number }
export interface ChartNote { time: number; lane: number }
export const LANES = 4;
export const SAMPLE_RATE = 22050;

const RHYTHMS = [
  [[0, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 1.5, 2, 3], [0, 1, 2]],
  [[0, 0.5, 1, 2, 3], [0, 1, 1.5, 2, 3, 3.5], [0, 0.5, 1.5, 2, 3], [0, 1, 2, 2.5, 3, 3.5]],
];
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const beatSec = (song: SongDef) => 60 / song.bpm;
export const songSeconds = (song: SongDef) => song.bars * 4 * beatSec(song) + 1.2;

/** The melody: for every onset its beat, its place in the scale and its length in beats. Seeded. */
export function melody(song: SongDef): { beat: number; degree: number; beats: number }[] {
  const next = random(song.seed), out: { beat: number; degree: number; beats: number }[] = [];
  let degree = 2;
  for (let bar = 0; bar < song.bars; bar++) {
    const last = bar === song.bars - 1;
    const rhythm = last ? [0] : bar % 4 === 3 ? RHYTHMS[song.busy][3] : RHYTHMS[song.busy][Math.floor(next() * 3)];
    rhythm.forEach((b, i) => {
      degree = i === 0 && bar % 4 === 0 ? [0, 2, 4][Math.floor(next() * 3)] : Math.max(0, Math.min(song.scale.length - 1, degree + [-2, -1, -1, 1, 1, 2][Math.floor(next() * 6)]));
      out.push({ beat: bar * 4 + b, degree, beats: last ? 3 : (rhythm[i + 1] ?? 4) - b });
    });
  }
  return out;
}
/** Everything that sounds, in seconds. */
export function tones(song: SongDef): Tone[] {
  const beat = beatSec(song), out: Tone[] = [];
  for (const m of melody(song)) out.push({ at: m.beat * beat, instrument: 'lead', midi: song.scale[m.degree], length: Math.min(1.2, m.beats * beat), gain: 0.5 });
  for (let bar = 0; bar < song.bars; bar++) {
    const root = song.roots[bar % song.roots.length], t = bar * 4 * beat;
    for (const b of [0, 2]) out.push({ at: t + b * beat, instrument: 'bass', midi: root - 12, length: beat * 1.6, gain: 0.42 });
    if (bar === song.bars - 1) continue;
    for (const b of [0, 2]) out.push({ at: t + b * beat, instrument: 'kick', midi: 0, length: 0.25, gain: 0.6 });
    for (const b of [1, 3]) out.push({ at: t + b * beat, instrument: 'snare', midi: 0, length: 0.18, gain: 0.3 });
    for (let b = 0; b < 4; b += song.busy ? 0.5 : 1) out.push({ at: t + b * beat, instrument: 'hat', midi: 0, length: 0.06, gain: 0.12 });
  }
  return out.sort((a, b) => a.at - b.at);
}
/** What the player hits: the melody's onsets (on the beat only when easy), a lane by pitch, never three in a row in one lane. */
export function chart(song: SongDef, hard: boolean): ChartNote[] {
  const beat = beatSec(song), out: ChartNote[] = [];
  for (const m of melody(song)) {
    if (!hard && m.beat % 1 !== 0) continue;
    let lane = m.degree % LANES;
    const n = out.length;
    if (n >= 2 && out[n - 1].lane === lane && out[n - 2].lane === lane) lane = (lane + 1) % LANES;
    out.push({ time: m.beat * beat, lane });
    if (hard && m.beat % 8 === 0 && m.beat > 0) out.push({ time: m.beat * beat, lane: (lane + 2) % LANES });
  }
  return out;
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** The engine synth recipe of one tone. Its id is what it is cached by. */
export function recipeOf(t: Tone): ZhudaSynthRecipe {
  const len = Math.round(t.length * 100) / 100;
  const base = { schemaVersion: 1 as const, sampleRate: SAMPLE_RATE, peak: 0.9, seed: 3 };
  if (t.instrument === 'lead')
    return { ...base, id: `lead-${t.midi}-${Math.round(len * 100)}`, durationSec: len + 0.25, layers: [
      { type: 'tone', wave: 'triangle', frequencyHz: hz(t.midi), gain: 1, envelope: { attackSec: 0.005, holdSec: len * 0.5, releaseSec: 0.22 } },
      { type: 'tone', wave: 'sine', frequencyHz: hz(t.midi) * 2, gain: 0.25, envelope: { attackSec: 0.005, holdSec: 0.03, releaseSec: 0.15 } },
    ] };
  if (t.instrument === 'bass')
    return { ...base, id: `bass-${t.midi}-${Math.round(len * 100)}`, durationSec: len + 0.1, layers: [{ type: 'tone', wave: 'square', frequencyHz: hz(t.midi), gain: 1, lowpassHz: 420, envelope: { attackSec: 0.01, holdSec: len * 0.6, releaseSec: 0.2 } }] };
  if (t.instrument === 'kick')
    return { ...base, id: 'kick', durationSec: 0.3, layers: [{ type: 'tone', wave: 'sine', frequencyHz: 130, endFrequencyHz: 42, gain: 1, envelope: { attackSec: 0.001, holdSec: 0.03, releaseSec: 0.2 } }] };
  if (t.instrument === 'snare')
    return { ...base, id: 'snare', durationSec: 0.22, layers: [{ type: 'noise', color: 'white', gain: 1, highpassHz: 1200, envelope: { attackSec: 0.001, holdSec: 0.02, releaseSec: 0.14 } }, { type: 'tone', wave: 'triangle', frequencyHz: 190, gain: 0.5, envelope: { attackSec: 0.001, holdSec: 0.01, releaseSec: 0.08 } }] };
  return { ...base, id: 'hat', durationSec: 0.08, layers: [{ type: 'noise', color: 'white', gain: 1, highpassHz: 6000, envelope: { attackSec: 0.001, holdSec: 0.005, releaseSec: 0.04 } }] };
}
export type Render = (recipe: ZhudaSynthRecipe) => { sampleRate: number; samples: Float32Array };
/** The whole song as one mono track: every distinct tone rendered once, added in where it sounds, levelled to a 0.85 peak. */
export function mix(song: SongDef, render: Render): { sampleRate: number; samples: Float32Array; rendered: number } {
  const out = new Float32Array(Math.ceil(songSeconds(song) * SAMPLE_RATE));
  const cache = new Map<string, Float32Array>();
  for (const t of tones(song)) {
    const r = recipeOf(t);
    let s = cache.get(r.id);
    if (!s) cache.set(r.id, (s = render(r).samples));
    const start = Math.round(t.at * SAMPLE_RATE);
    for (let i = 0; i < s.length && start + i < out.length; i++) out[start + i] += s[i] * t.gain;
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.85 / peak;
  return { sampleRate: SAMPLE_RATE, samples: out, rendered: cache.size };
}
