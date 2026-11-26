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
  tap: recipe('tap', 0.12, [tone('triangle', 880, 0.4, env(0.001, 0.01, 0.09))]),
  coin: recipe('coin', 0.4, [tone('square', 1320, 0.25, env(0.001, 0.03, 0.1)), tone('square', 1760, 0.25, env(0.08, 0.05, 0.25))]),
  hit: recipe('hit', 0.25, [noise('white', 0.8, env(0.001, 0.02, 0.1), { highpassHz: 1200 }), noise('brown', 0.9, env(0.001, 0.03, 0.15), { lowpassHz: 400 })]),
  crit: recipe('crit', 0.4, [noise('white', 1, env(0.001, 0.03, 0.14), { highpassHz: 1600 }), tone('triangle', 520, 0.5, env(0.001, 0.04, 0.3)), noise('brown', 0.9, env(0.001, 0.04, 0.2), { lowpassHz: 300 })]),
  level: recipe('level', 0.5, [tone('triangle', 523, 0.4, env(0.001, 0.05, 0.12)), tone('triangle', 659, 0.4, env(0.09, 0.05, 0.12)), tone('triangle', 784, 0.4, env(0.18, 0.08, 0.2))]),
  flip: recipe('flip', 0.2, [noise('pink', 0.5, env(0.01, 0.03, 0.14), { highpassHz: 500, lowpassHz: 4000 })]),
  purple: recipe('purple', 0.8, [tone('sine', 660, 0.4, env(0.01, 0.1, 0.5)), tone('sine', 990, 0.3, env(0.1, 0.1, 0.5))]),
  gold: recipe('gold', 1.8, [tone('triangle', 523, 0.4, env(0.01, 0.2, 0.3)), tone('triangle', 659, 0.4, env(0.2, 0.2, 0.3)), tone('triangle', 784, 0.4, env(0.4, 0.2, 0.4)), tone('triangle', 1047, 0.45, env(0.6, 0.5, 0.6)), tone('sine', 262, 0.3, env(0.01, 1.2, 0.5)), noise('white', 0.25, env(0.6, 0.3, 0.8), { highpassHz: 5000 })]),
  win: recipe('win', 0.9, [tone('triangle', 392, 0.4, env(0.01, 0.1, 0.2)), tone('triangle', 587, 0.4, env(0.15, 0.1, 0.2)), tone('triangle', 784, 0.45, env(0.3, 0.2, 0.4))]),
  lose: recipe('lose', 0.9, [tone('triangle', 330, 0.4, env(0.01, 0.15, 0.3)), tone('triangle', 247, 0.45, env(0.3, 0.2, 0.4))]),
  wind: recipe('wind', 6, [tone('sine', 196, 0.12, env(1.5, 3, 1.5)), tone('sine', 294, 0.08, env(2, 2.5, 1.5)), noise('pink', 0.15, env(1.5, 3, 1.5), { lowpassHz: 500 })], 9),
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

  /** From a tap or a key: unlocks audio and starts the lobby's hum. */
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
