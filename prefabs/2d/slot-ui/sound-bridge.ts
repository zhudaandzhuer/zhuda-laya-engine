// Slot sound cues through the engine's one audio authority (IframeSoundAdapter): a cue is a
// loaded sample when the game has one, otherwise a few scheduled tones, so a game makes noise
// before (or without) its recordings. No AudioContext of its own. Pure TypeScript (the adapter
// is passed in; the engine's IframeSoundAdapter fits SoundAdapterLike as is).
// The pattern is the source's (<original-cascade-slot>/client/src/audio/ (the sound bridge):
// samples first, synthesized fallback, a voice limit, unlock on first gesture). The source made
// its own AudioContext, against the engine's audio contract; its cue sounds were not carried.

export interface ToneNote {
  /** Seconds after the cue starts. */
  at: number;
  duration: number;
  from: number;
  to?: number;
  gain: number;
  wave?: OscillatorType;
}

export interface SoundCue {
  tones?: ToneNote[];
  /** A sample id loaded into the adapter (playSample); preferred when loaded. */
  sample?: string;
  sampleGain?: number;
  channel?: 'sfx' | 'ui' | 'bgm';
}

/** The part of IframeSoundAdapter the bridge uses. */
export interface SoundAdapterLike {
  scheduleTone(o: { id: string; channel?: 'master' | 'bgm' | 'sfx' | 'ui'; waveType?: OscillatorType; startFreq: number; endFreq?: number; durationSec: number; peakGain?: number; delaySec?: number }): boolean;
  playSample?(o: { id: string; sampleId: string; channel?: 'master' | 'bgm' | 'sfx' | 'ui'; peakGain?: number }): boolean;
  setMuted?(muted: boolean): void;
  unlockAudio?(source?: string): boolean;
}

const tone = (at: number, duration: number, from: number, to: number, gain: number, wave: OscillatorType = 'sine'): ToneNote => ({ at, duration, from, to, gain, wave });
const arpeggio = (notes: number[], gap: number, gain: number, wave: OscillatorType = 'triangle'): ToneNote[] => notes.map((hz, i) => tone(i * gap, 0.22, hz, hz, gain, wave));

/** Neutral placeholder cues made for this library (short tones). Replace with the game's own. */
export const NEUTRAL_CUES: Record<string, SoundCue> = {
  spin: { tones: [tone(0, 0.12, 320, 180, 0.1, 'triangle'), tone(0.08, 0.1, 260, 150, 0.08, 'triangle')] },
  tumble: { tones: [tone(0, 0.09, 880, 520, 0.09), tone(0.05, 0.12, 660, 330, 0.07, 'triangle')] },
  multiplier: { tones: arpeggio([523, 659, 784, 1046], 0.06, 0.1) },
  coin: { tones: [tone(0, 0.08, 1318, 1318, 0.08), tone(0.07, 0.12, 1760, 1760, 0.07)] },
  feature: { tones: arpeggio([392, 523, 659, 784, 1046], 0.09, 0.11, 'square') },
  'win-big': { tones: arpeggio([523, 659, 784], 0.12, 0.12) },
  'win-great': { tones: arpeggio([523, 659, 784, 1046], 0.11, 0.12) },
  'win-huge': { tones: arpeggio([440, 554, 659, 880, 1108], 0.1, 0.13) },
  'win-legend': { tones: arpeggio([392, 494, 587, 784, 988, 1174], 0.1, 0.14) },
  'win-feature': { tones: arpeggio([523, 784, 1046, 1568], 0.12, 0.12) },
  collect: { tones: [tone(0, 0.1, 990, 1480, 0.08)] },
  ui: { tones: [tone(0, 0.05, 720, 480, 0.06)], channel: 'ui' },
};

export class SlotSoundBridge {
  enabled = true;
  /** The last cue played (for checks). */
  lastCue = '';
  readonly played: string[] = [];
  private adapter: SoundAdapterLike | null;
  private cues: Record<string, SoundCue>;
  private loaded = new Set<string>();
  private serial = 0;

  constructor(adapter: SoundAdapterLike | null, cues: Record<string, SoundCue> = NEUTRAL_CUES) {
    this.adapter = adapter;
    this.cues = cues;
  }

  /** Tells the bridge a sample is loaded in the adapter (after adapter.loadSample). */
  markLoaded(sampleId: string): void {
    this.loaded.add(sampleId);
  }

  /** Call from the first pointer/key gesture. */
  unlock(source = 'pointerdown'): boolean {
    return this.adapter?.unlockAudio?.(source) ?? false;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.adapter?.setMuted?.(!on);
  }

  /** Plays a cue; false when muted, unknown or refused by the adapter. */
  play(name: string): boolean {
    const cue = this.cues[name];
    if (!this.enabled || !cue || !this.adapter) return false;
    const id = `${name}-${++this.serial}`;
    const channel = cue.channel ?? 'sfx';
    let ok = false;
    if (cue.sample && this.loaded.has(cue.sample) && this.adapter.playSample) {
      ok = this.adapter.playSample({ id, sampleId: cue.sample, channel, peakGain: cue.sampleGain ?? 0.8 });
    } else if (cue.tones?.length) {
      cue.tones.forEach((n, i) => {
        ok = this.adapter!.scheduleTone({ id: `${id}-${i}`, channel, waveType: n.wave ?? 'sine', startFreq: n.from, endFreq: n.to ?? n.from, durationSec: n.duration, peakGain: n.gain, delaySec: n.at }) || ok;
      });
    }
    if (ok) {
      this.lastCue = name;
      this.played.push(name);
      if (this.played.length > 64) this.played.shift();
    }
    return ok;
  }
}
