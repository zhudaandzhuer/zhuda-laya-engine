import { IframeSoundAdapter } from '../../packages/core/IframeSoundAdapter';

export class MinesweeperAudio {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  public readonly iframeAdapter: IframeSoundAdapter;

  constructor() {
    this.iframeAdapter = IframeSoundAdapter.getShared();
  }

  private initCtx(): AudioContext | null {
    if (this.iframeAdapter.isMuted() || this.iframeAdapter.getDiagnostics().autoSuspendedByBlur) {
      return null;
    }
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    this.iframeAdapter.setMuted(!val);
  }

  public isEnabled(): boolean {
    return this.enabled && !this.iframeAdapter.isMuted();
  }

  public playClick(): void {
    if (!this.isEnabled()) return;
    this.iframeAdapter.scheduleTone({
      id: 'sfx-click',
      channel: 'sfx',
      waveType: 'triangle',
      startFreq: 620,
      endFreq: 310,
      durationSec: 0.06,
      peakGain: 0.18
    });
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(310, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  public playFlag(): void {
    if (!this.isEnabled()) return;
    this.iframeAdapter.scheduleTone({
      id: 'sfx-flag',
      channel: 'sfx',
      waveType: 'sine',
      startFreq: 820,
      endFreq: 1240,
      durationSec: 0.08,
      peakGain: 0.2
    });
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(820, ctx.currentTime);
    osc.frequency.setValueAtTime(1240, ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  public playChord(chainStep: number = 0): void {
    if (!this.isEnabled()) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.5];
    const freq = notes[Math.min(chainStep, notes.length - 1)];
    this.iframeAdapter.scheduleTone({
      id: `sfx-chord-${chainStep}`,
      channel: 'sfx',
      waveType: 'sine',
      startFreq: freq,
      durationSec: 0.12,
      peakGain: 0.15
    });
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  public playExplode(): void {
    if (!this.isEnabled()) return;
    this.iframeAdapter.scheduleTone({
      id: 'sfx-explode',
      channel: 'sfx',
      waveType: 'sawtooth',
      startFreq: 150,
      endFreq: 30,
      durationSec: 0.6,
      peakGain: 0.4
    });
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.6);

    oscGain.gain.setValueAtTime(0.4, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);

    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, ctx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  }

  public playVictory(): void {
    if (!this.isEnabled()) return;
    this.iframeAdapter.scheduleTone({
      id: 'sfx-victory',
      channel: 'bgm',
      waveType: 'triangle',
      startFreq: 523.25,
      endFreq: 1046.5,
      durationSec: 0.45,
      peakGain: 0.22
    });
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + idx * 0.12;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }
}
