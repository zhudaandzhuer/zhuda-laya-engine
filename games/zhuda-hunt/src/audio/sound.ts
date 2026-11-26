// Sound through the engine's one WebAudio owner (IframeSoundAdapter). Every sound is an engine
// synth recipe rendered to WAV behind a ProceduralAssetProvider: the game ships no audio file.
// Sound starts on the first tap or key (start()).
import { IframeSoundAdapter, ProceduralAssetProvider, renderZhudaSynthWav, type ZhudaSynthRecipe } from 'zhuda-laya-engine';

type Layer = ZhudaSynthRecipe['layers'][number];
const env = (attackSec: number, holdSec: number, releaseSec: number) => ({ attackSec, holdSec, releaseSec });
const tone = (wave: 'sine' | 'triangle' | 'square' | 'saw', frequencyHz: number, gain: number, e: ReturnType<typeof env>, extra: object = {}): Layer => ({ type: 'tone', wave, frequencyHz, gain, envelope: e, ...extra }) as Layer;
const noise = (color: 'white' | 'pink' | 'brown', gain: number, e: ReturnType<typeof env>, extra: object = {}): Layer => ({ type: 'noise', color, gain, envelope: e, ...extra }) as Layer;
const recipe = (id: string, durationSec: number, layers: Layer[], seed = 1): ZhudaSynthRecipe => ({ schemaVersion: 1, id, durationSec, seed, peak: 0.8, layers });

export const RECIPES: Record<string, ZhudaSynthRecipe> = {
  swing: recipe('swing', 0.28, [noise('white', 0.6, env(0.03, 0.04, 0.18), { highpassHz: 900, lowpassHz: 5200 })]),
  heavy: recipe('heavy', 0.5, [noise('pink', 0.8, env(0.1, 0.08, 0.28), { highpassHz: 300, lowpassHz: 3000 }), tone('sine', 110, 0.3, env(0.08, 0.05, 0.3))]),
  cut: recipe('cut', 0.35, [noise('white', 0.9, env(0.001, 0.02, 0.12), { highpassHz: 1400 }), tone('triangle', 240, 0.5, env(0.001, 0.03, 0.2)), noise('brown', 0.8, env(0.001, 0.03, 0.15), { lowpassHz: 400 })]),
  weak: recipe('weak', 0.5, [noise('white', 1, env(0.001, 0.03, 0.16), { highpassHz: 1800 }), tone('triangle', 520, 0.5, env(0.001, 0.04, 0.3)), tone('sine', 1560, 0.3, env(0.001, 0.02, 0.4)), noise('brown', 0.9, env(0.001, 0.04, 0.2), { lowpassHz: 300 })]),
  thud: recipe('thud', 0.4, [noise('brown', 1, env(0.001, 0.04, 0.3), { lowpassHz: 260 }), tone('sine', 70, 0.7, env(0.001, 0.05, 0.3))]),
  break: recipe('break', 0.9, [noise('white', 1, env(0.001, 0.05, 0.4), { highpassHz: 700 }), tone('square', 180, 0.35, env(0.001, 0.06, 0.5)), tone('sine', 880, 0.3, env(0.001, 0.04, 0.7)), noise('brown', 1, env(0.001, 0.1, 0.5), { lowpassHz: 200 })], 4),
  roll: recipe('roll', 0.35, [noise('pink', 0.5, env(0.04, 0.1, 0.2), { lowpassHz: 1200 })]),
  hurt: recipe('hurt', 0.45, [noise('brown', 1, env(0.001, 0.05, 0.3), { lowpassHz: 500 }), tone('saw', 150, 0.4, env(0.001, 0.05, 0.25))]),
  cue: recipe('cue', 0.6, [tone('saw', 82, 0.5, env(0.15, 0.2, 0.25), { lowpassHz: 600 }), noise('pink', 0.4, env(0.2, 0.15, 0.2), { lowpassHz: 900 })]),
  roar: recipe('roar', 1.8, [tone('saw', 62, 0.7, env(0.15, 0.9, 0.7), { lowpassHz: 520 }), tone('saw', 93, 0.5, env(0.2, 0.8, 0.7), { lowpassHz: 700 }), noise('pink', 0.8, env(0.1, 0.9, 0.7), { lowpassHz: 1400 })], 7),
  slam: recipe('slam', 1.0, [noise('brown', 1, env(0.001, 0.1, 0.8), { lowpassHz: 180 }), tone('sine', 48, 0.9, env(0.001, 0.1, 0.7)), noise('white', 0.4, env(0.001, 0.03, 0.3), { highpassHz: 1000 })], 5),
  heal: recipe('heal', 0.7, [tone('sine', 660, 0.4, env(0.02, 0.1, 0.5)), tone('sine', 990, 0.3, env(0.12, 0.1, 0.45)), tone('sine', 1320, 0.2, env(0.22, 0.1, 0.4))]),
  win: recipe('win', 2.2, [tone('triangle', 392, 0.4, env(0.01, 0.3, 0.4)), tone('triangle', 494, 0.4, env(0.35, 0.3, 0.5)), tone('triangle', 587, 0.4, env(0.7, 0.3, 0.6)), tone('triangle', 784, 0.45, env(1.05, 0.5, 0.6)), tone('sine', 196, 0.35, env(0.01, 1.4, 0.7))]),
  lose: recipe('lose', 1.8, [tone('triangle', 330, 0.4, env(0.01, 0.4, 0.5)), tone('triangle', 277, 0.4, env(0.5, 0.4, 0.5)), tone('triangle', 220, 0.45, env(1.0, 0.4, 0.4)), tone('sine', 110, 0.3, env(0.01, 1.2, 0.5))]),
  tap: recipe('tap', 0.12, [tone('triangle', 880, 0.4, env(0.001, 0.01, 0.09))]),
  wind: recipe('wind', 6, [noise('pink', 0.5, env(1.5, 3, 1.5), { lowpassHz: 700, highpassHz: 120 })], 9),
};

export class Sound {
  private readonly provider = new ProceduralAssetProvider();
  private readonly audio: IframeSoundAdapter;
  private readonly ready = new Set<string>();
  private started = false;
  private voice = 0;

  constructor(public muted: boolean) {
    for (const [name, r] of Object.entries(RECIPES)) this.provider.register(`synth/${name}.wav`, () => renderZhudaSynthWav(r), 'audio');
    this.audio = new IframeSoundAdapter({ sampleProvider: this.provider, maxActiveVoices: 14, voiceOverflow: 'fifo', protectedChannels: ['bgm'] });
    this.audio.setMuted(muted);
  }

  async load(): Promise<void> {
    await Promise.all(Object.keys(RECIPES).map((name) => this.audio.loadSample(`synth/${name}.wav`).then(() => void this.ready.add(name), (e) => console.warn('sound', name, e))));
    if (this.started) this.loop();
  }

  /** From a tap or a key: unlocks audio and starts the field's wind. */
  start(gesture: string): void {
    this.audio.unlockAudio(gesture);
    if (this.started) return;
    this.started = true;
    this.loop();
  }

  private loop(): void {
    if (this.ready.has('wind')) this.audio.playSample({ id: 'wind', sampleId: 'synth/wind.wav', channel: 'bgm', loop: true, peakGain: 0.3, fadeInSec: 2 });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.audio.setMuted(muted);
    if (!muted && this.started) this.loop();
  }

  play(name: string, gain = 0.7): void {
    if (!this.started || !this.ready.has(name)) return;
    this.audio.playSample({ id: `v${this.voice++ % 12}`, sampleId: `synth/${name}.wav`, channel: 'sfx', peakGain: Math.min(0.9, gain) });
  }

  diagnostics() {
    return this.audio.getDiagnostics();
  }
}
