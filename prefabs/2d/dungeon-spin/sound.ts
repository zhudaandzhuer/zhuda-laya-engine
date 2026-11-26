// Dungeon Spin's sound: 20 cues synthesised from oscillators and filtered noise (no sound
// files), unlocked by the first gesture, silenced when the page is hidden, at most 24
// voices (the oldest is cut). One shared instance: DungeonSoundBridge.getInstance().
// Note: it opens its own AudioContext; the engine's game-2d route asks for one
// IframeSoundAdapter per game instead (see README, limits).
// From games/dungeon-spin (src/audio/dungeon-slot/DungeonSoundBridge.ts), unchanged.

export interface SoundNote {
  at: number;
  duration: number;
  from: number;
  to: number;
  volume: number;
  wave?: OscillatorType;
  noise?: boolean;
}

function tone(at: number, duration: number, from: number, to: number, volume: number, wave: OscillatorType = 'sine'): SoundNote {
  return { at, duration, from, to, volume, wave };
}

function hiss(at: number, duration: number, from: number, to: number, volume: number): SoundNote {
  return { at, duration, from, to, volume, noise: true };
}

function chimes(notes: number[], gap: number, volume: number): SoundNote[] {
  return notes.map((hz, i) => tone(i * gap, 0.22, hz, hz * 0.985, volume));
}

function steps(times: number[], volume = 0.12): SoundNote[] {
  return times.flatMap(at => [
    hiss(at, 0.09, 480, 190, volume),
    tone(at, 0.08, 95, 48, volume, 'triangle')
  ]);
}

export const SOUND_CUES: Record<string, SoundNote[]> = {
  'walk': [...steps([0, 0.23, 0.46])],
  'quick': [hiss(0, 0.17, 1900, 500, 0.2), tone(0, 0.12, 780, 340, 0.1, 'triangle')],
  'wave': [hiss(0, 0.26, 1100, 280, 0.22), tone(0, 0.25, 160, 310, 0.09, 'triangle')],
  'draw': [hiss(0, 0.1, 3300, 700, 0.18), tone(0.02, 0.24, 1500, 950, 0.08)],
  'magic': [...chimes([440, 554.37, 659.25, 880], 0.065, 0.15), hiss(0, 0.28, 600, 1900, 0.1)],
  'cleave': [hiss(0, 0.21, 1400, 350, 0.24), tone(0.01, 0.16, 230, 90, 0.13, 'triangle')],
  'impact': [hiss(0, 0.12, 850, 180, 0.26), tone(0, 0.14, 125, 48, 0.2, 'triangle')],
  'coin': chimes([1318.51, 1760], 0.045, 0.1),
  'bag-hit': [tone(0, 0.16, 170, 60, 0.18, 'triangle'), ...chimes([1174.66, 1567.98], 0.065, 0.12)],
  'full': [tone(0, 0.22, 130, 48, 0.2, 'triangle'), ...chimes([659.25, 830.61, 987.77, 1318.51, 1760], 0.07, 0.16)],
  'dodge': [hiss(0, 0.25, 1800, 400, 0.16)],
  'guard': [tone(0, 0.15, 210, 72, 0.18, 'triangle'), hiss(0, 0.12, 400, 180, 0.13)],
  'boss': [...steps([0, 0.24, 0.49], 0.18), tone(0, 0.55, 65, 43, 0.09, 'triangle')],
  'flee': steps([0, 0.14, 0.28], 0.08),
  'result': chimes([523.25, 659.25, 783.99], 0.085, 0.16),
  'win-big': chimes([523.25, 659.25, 783.99, 1046.5], 0.09, 0.17),
  'win-mega': [...chimes([659.25, 783.99, 1046.5, 1318.51], 0.09, 0.17), tone(0, 0.4, 130.81, 130.81, 0.12, 'triangle')],
  'win-super': [...chimes([523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98], 0.095, 0.17), tone(0, 0.55, 130.81, 130.81, 0.12, 'triangle')],
  'win-count': [tone(0, 0.055, 1567.98, 1318.51, 0.065)],
  'win-collect': chimes([783.99, 1046.5, 1567.98], 0.06, 0.14)
};

export class DungeonSoundBridge {
  private static instance: DungeonSoundBridge | null = null;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  public enabled: boolean = true;
  private voices: Set<{ cancel: () => void }> = new Set();
  public lastCue: string = '';

  public static getInstance(): DungeonSoundBridge {
    if (!DungeonSoundBridge.instance) {
      DungeonSoundBridge.instance = new DungeonSoundBridge();
    }
    return DungeonSoundBridge.instance;
  }

  constructor() {
    this.setupPageVisibility();
  }

  private setupPageVisibility(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.pause();
        } else {
          this.resume();
        }
      });
    }
  }

  public async unlock(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      if (!this.context) {
        const AudioCtxClass = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
        if (!AudioCtxClass) return false;
        this.context = new AudioCtxClass();
        this.master = this.context!.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.context!.destination);

        // 預分配白噪聲緩衝區
        const sr = this.context!.sampleRate;
        this.noise = this.context!.createBuffer(1, Math.ceil(sr * 0.6), sr);
        const data = this.noise.getChannelData(0);
        let seed = 137;
        for (let i = 0; i < data.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          data[i] = seed / 2147483648 - 1;
        }

        this.context!.onstatechange = () => {
          if (this.context?.state !== 'running') this.stop();
        };
      }
      const context = this.context;
      if (!context) return false;
      if (context.state === 'suspended') {
        await context.resume();
      }
      return true;
    } catch {
      return false;
    }
  }

  public resume(): void {
    if (this.enabled && this.context?.state === 'suspended') {
      void this.context.resume().catch(() => {});
    }
  }

  public pause(): void {
    this.stop();
    if (this.context?.state === 'running') {
      void this.context.suspend().catch(() => {});
    }
  }

  public stop(): void {
    for (const voice of [...this.voices]) {
      voice.cancel();
    }
    this.voices.clear();
    this.lastCue = '';
  }

  public play(name: string): boolean {
    if (!this.enabled || !this.context || this.context.state !== 'running' || !SOUND_CUES[name]) {
      return false;
    }
    try {
      const cue = SOUND_CUES[name];
      // 聲道並發封頂 24（Gate 6），超額以 FIFO 回收
      while (this.voices.size + cue.length > 24) {
        const earliest = this.voices.values().next().value;
        if (earliest) earliest.cancel();
      }

      const time = this.context.currentTime;
      for (const note of cue) {
        this.schedule(note, time);
      }
      this.lastCue = name;
      return true;
    } catch {
      return false;
    }
  }

  private schedule(note: SoundNote, time: number): void {
    if (!this.context || !this.master) return;
    const context = this.context;
    const source: any = note.noise ? context.createBufferSource() : context.createOscillator();
    const gain = context.createGain();
    const filter = note.noise ? context.createBiquadFilter() : null;

    const start = time + note.at;
    const end = start + note.duration;

    if (note.noise) {
      source.buffer = this.noise;
      filter!.type = 'lowpass';
      filter!.Q.value = 0.65;
      filter!.frequency.setValueAtTime(note.from, start);
      filter!.frequency.exponentialRampToValueAtTime(note.to, end);
      source.connect(filter!);
      filter!.connect(gain);
    } else {
      source.type = note.wave || 'sine';
      source.frequency.setValueAtTime(note.from, start);
      source.frequency.exponentialRampToValueAtTime(note.to, end);
      source.connect(gain);
    }

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(note.volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(this.master);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      this.voices.delete(voice);
      try {
        source.disconnect();
        filter?.disconnect();
        gain.disconnect();
      } catch {}
    };

    const voice = {
      cancel: () => {
        cleanup();
        try { source.stop(0); } catch {}
      }
    };
    this.voices.add(voice);

    try {
      source.start(start);
      source.stop(end);
      setTimeout(cleanup, (note.at + note.duration + 0.05) * 1000);
    } catch {
      cleanup();
    }
  }
}
