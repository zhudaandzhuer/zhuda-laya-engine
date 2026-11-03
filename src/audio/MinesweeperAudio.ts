import { IframeSoundAdapter } from '../../packages/core/IframeSoundAdapter';

/**
 * Showcase audio submits events to the engine mixer. It intentionally owns no
 * AudioContext or destination node of its own, so mute/blur/lifecycle policy
 * applies to every sound consistently.
 */
export class MinesweeperAudio {
  private enabled = true;
  public readonly iframeAdapter: IframeSoundAdapter;

  constructor(adapter: IframeSoundAdapter = IframeSoundAdapter.getShared()) {
    this.iframeAdapter = adapter;
  }

  public setEnabled(value: boolean): void {
    this.enabled = Boolean(value);
    this.iframeAdapter.setMuted(!this.enabled);
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
  }

  public playChord(chainStep = 0): void {
    if (!this.isEnabled()) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.5];
    const index = Math.max(0, Math.min(Math.floor(chainStep), notes.length - 1));
    this.iframeAdapter.scheduleTone({
      id: `sfx-chord-${index}`,
      channel: 'sfx',
      waveType: 'sine',
      startFreq: notes[index],
      durationSec: 0.12,
      peakGain: 0.15
    });
  }

  public playExplode(): void {
    if (!this.isEnabled()) return;
    // The shared mixer owns the primitive. Asset/noise-buffer playback can be
    // added later through the same service without creating another context.
    this.iframeAdapter.scheduleTone({
      id: 'sfx-explode',
      channel: 'sfx',
      waveType: 'sawtooth',
      startFreq: 150,
      endFreq: 30,
      durationSec: 0.6,
      peakGain: 0.4
    });
  }

  public playVictory(): void {
    if (!this.isEnabled()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      this.iframeAdapter.scheduleTone({
        id: `sfx-victory-${index}`,
        channel: 'bgm',
        waveType: 'triangle',
        startFreq: frequency,
        durationSec: 0.35,
        delaySec: index * 0.12,
        peakGain: 0.2
      });
    });
  }

  public dispose(): void {
    this.iframeAdapter.stopAll();
  }
}
