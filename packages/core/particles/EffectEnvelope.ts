export type EffectPhase = 'idle' | 'attack' | 'sustain' | 'release';

/** Generic attack/sustain/release envelope. Stopping releases the effect without clearing live particles. */
export class ZhudaEffectEnvelope {
  public phase: EffectPhase = 'idle';
  public value = 0;
  private target = 1;
  private from = 0;
  private elapsed = 0;
  public readonly attack: number;
  public readonly release: number;
  constructor(attack = 0.14, release = 0.45) {
    if (![attack, release].every(v => Number.isFinite(v) && v > 0)) throw new Error('Envelope durations must be positive.');
    this.attack = attack; this.release = release;
  }
  start(strength = 1): void {
    this.setStrength(strength); this.from = this.value; this.elapsed = 0; this.phase = 'attack';
  }
  setStrength(strength: number): void {
    if (!Number.isFinite(strength) || strength < 0 || strength > 2) throw new Error('Envelope strength must be 0..2.');
    this.target = strength;
  }
  stop(): void {
    if (this.phase === 'idle' || this.phase === 'release') return;
    this.from = this.value; this.elapsed = 0; this.phase = 'release';
  }
  reset(): void { this.phase = 'idle'; this.value = 0; this.elapsed = 0; }
  update(dt: number): number {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Envelope delta must be non-negative.');
    this.elapsed += dt;
    if (this.phase === 'sustain') this.value = this.target;
    else if (this.phase === 'attack' || this.phase === 'release') {
      const t = Math.min(1, this.elapsed / (this.phase === 'attack' ? this.attack : this.release));
      const smooth = t * t * (3 - 2 * t);
      this.value = this.from + ((this.phase === 'attack' ? this.target : 0) - this.from) * smooth;
      if (t === 1) this.phase = this.phase === 'attack' ? 'sustain' : 'idle';
    }
    return this.value;
  }
}
