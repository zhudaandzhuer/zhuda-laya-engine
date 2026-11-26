// Sound through the engine's one WebAudio owner (IframeSoundAdapter). A song is mixed in the page
// from engine synth recipes (src/core/song.ts) into one WAV behind a ProceduralAssetProvider and
// played as one sample. Time: the sample is started at the offset the page clock says, and from
// then on the adapter's getSamplePositionSec is the song's time (see Main.ts).
import { IframeSoundAdapter, ProceduralAssetProvider, encodeZhudaWav, renderZhudaSynth, renderZhudaSynthWav, type ZhudaSynthRecipe } from 'zhuda-laya-engine';
import { SONGS, mix, type SongDef } from '../core/song.ts';

const sfx = (id: string, durationSec: number, layers: ZhudaSynthRecipe['layers']): ZhudaSynthRecipe => ({ schemaVersion: 1, id, durationSec, peak: 0.8, layers });
const RECIPES: Record<string, ZhudaSynthRecipe> = {
  tap: sfx('tap', 0.1, [{ type: 'tone', wave: 'triangle', frequencyHz: 880, gain: 0.4, envelope: { attackSec: 0.001, holdSec: 0.01, releaseSec: 0.07 } }]),
  tick: sfx('tick', 0.08, [{ type: 'tone', wave: 'square', frequencyHz: 1200, gain: 0.3, envelope: { attackSec: 0.001, holdSec: 0.01, releaseSec: 0.05 } }]),
  done: sfx('done', 1.2, [523, 659, 784, 1047].map((f, i) => ({ type: 'tone' as const, wave: 'triangle' as const, frequencyHz: f, gain: 0.4, startSec: i * 0.14, envelope: { attackSec: 0.01, holdSec: 0.1, releaseSec: 0.4 } }))),
};

export class Sound {
  private readonly provider = new ProceduralAssetProvider();
  private readonly audio: IframeSoundAdapter;
  private readonly ready = new Set<string>();
  /** Milliseconds each song took to mix, for the report. */
  readonly mixMs: Record<string, number> = {};
  private voice = 0;

  constructor(public muted: boolean) {
    for (const [name, r] of Object.entries(RECIPES)) this.provider.register(`synth/${name}.wav`, () => renderZhudaSynthWav(r), 'audio');
    for (const song of SONGS)
      this.provider.register(`song/${song.id}.wav`, () => {
        const t = performance.now();
        const m = mix(song, renderZhudaSynth);
        const wav = encodeZhudaWav(m.samples, m.sampleRate);
        this.mixMs[song.id] = Math.round(performance.now() - t);
        return wav;
      }, 'audio');
    this.audio = new IframeSoundAdapter({ sampleProvider: this.provider, maxActiveVoices: 10, voiceOverflow: 'fifo', protectedChannels: ['bgm'] });
    this.audio.setMuted(muted);
  }
  async load(): Promise<void> {
    const ids = [...Object.keys(RECIPES).map((n) => `synth/${n}.wav`), ...SONGS.map((s) => `song/${s.id}.wav`)];
    for (const id of ids) await this.audio.loadSample(id).then(() => void this.ready.add(id), (e) => console.warn('sound', id, e));
  }
  has(song: SongDef): boolean {
    return this.ready.has(`song/${song.id}.wav`);
  }
  start(gesture: string): void {
    this.audio.unlockAudio(gesture);
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.audio.setMuted(muted);
  }
  play(name: string, gain = 0.6): void {
    if (this.ready.has(`synth/${name}.wav`)) this.audio.playSample({ id: `sfx-${this.voice++ % 6}`, sampleId: `synth/${name}.wav`, channel: 'sfx', peakGain: gain });
  }
  /** Starts (or restarts) the song at a place in it. False when it could not (muted, not loaded, past its end). */
  playSong(song: SongDef, offsetSec: number): boolean {
    return this.has(song) && this.audio.playSample({ id: 'song', sampleId: `song/${song.id}.wav`, channel: 'bgm', offsetSec: Math.max(0, offsetSec), peakGain: 0.9, replace: true });
  }
  /** Where the song is by the audio clock, in seconds; null while it is not sounding (not started, muted, stopped). */
  songPosition(): number | null {
    return this.audio.getSamplePositionSec('song');
  }
  /** The host's own figure for schedule-to-speaker delay, in seconds (0 when it gives none). */
  outputLatency(): number {
    return this.audio.getOutputLatencySec();
  }
  stopSong(): void {
    this.audio.stop('song', 0.05);
  }
  diagnostics() {
    return this.audio.getDiagnostics();
  }
}
