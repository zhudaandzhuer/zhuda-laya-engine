import { ZhudaEffectDirector } from 'zhuda-laya-engine';
import type { EffectBinding, EffectTimelineSpec, PrefabInstance } from 'zhuda-laya-engine';

export type SlotSymbolState = 'idle' | 'selected' | 'win' | 'jackpot';

const bind = (node: Laya.Sprite): EffectBinding => ({
  reset: () => {},
  setParameter: (name, value) => {
    if (name === 'alpha') node.alpha = value;
    else if (name === 'scale') { node.scaleX = value; node.scaleY = value; }
    else if (name === 'rotation') node.rotation = value;
  },
  event: () => {},
});

const timeline = (state: SlotSymbolState): EffectTimelineSpec => {
  if (state === 'idle') return { version: 1, duration: 1.4, loop: true, tracks: [] };
  if (state === 'selected') return { version: 1, duration: 1.1, loop: true, tracks: [
    { target: 'art', parameter: 'scale', keys: [{ time: 0, value: 1.02 }, { time: 0.55, value: 1.07 }, { time: 1.1, value: 1.02 }] },
  ] };
  if (state === 'win') return { version: 1, duration: 1.2, loop: false, tracks: [
    { target: 'art', parameter: 'scale', keys: [{ time: 0, value: 1.02 }, { time: 0.32, value: 1.18 }, { time: 1.2, value: 1.04 }] },
  ] };
  return { version: 1, duration: 1.8, loop: true, tracks: [
    { target: 'art', parameter: 'scale', keys: [{ time: 0, value: 1.08 }, { time: 0.45, value: 1.2 }, { time: 0.9, value: 1.08 }, { time: 1.8, value: 1.2 }] },
  ] };
};

export class SlotSymbolEffect {
  private director: ZhudaEffectDirector;
  private state: SlotSymbolState = 'idle';
  private readonly bindings: Record<string, EffectBinding>;

  constructor(private readonly instance: PrefabInstance) {
    this.bindings = {
      art: bind(instance.find('Art')),
    };
    this.director = new ZhudaEffectDirector(timeline('idle'), this.bindings);
    this.play('idle');
  }

  play(state: SlotSymbolState): void {
    this.state = state;
    this.instance.applyState(state);
    this.director.stop();
    this.director = new ZhudaEffectDirector(timeline(state), this.bindings);
    this.director.play(true);
  }

  update(dt: number): void { this.director.update(dt); }
  get currentState(): SlotSymbolState { return this.state; }
  dispose(): void { this.director.stop(); }
}
