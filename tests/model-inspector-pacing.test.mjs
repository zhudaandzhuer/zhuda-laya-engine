// ZhudaModelInspector: a clip played in a given time. A fake animator stands in for LayaAir's:
// the arithmetic and the refusals are checked here, not a pose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaModelInspector } from '../packages/core/runtime3d/ModelInspector.ts';

function fixture(playing) {
  const calls = [];
  const clips = { Slash: 0.8, Idle: 2, Empty: 0 };
  const animator = {
    speed: 1,
    controllerLayerCount: 1,
    getControllerLayer: () => ({
      getAnimatorState: (name) =>
        name in clips ? { clip: { duration: () => clips[name] } } : null,
    }),
    getCurrentAnimatorPlayState: () =>
      playing ? { animatorState: { clip: { duration: () => clips[playing] } } } : null,
    play: (...args) => calls.push(['play', ...args]),
    crossFade: (...args) => calls.push(['crossFade', ...args]),
  };
  class Animator {}
  globalThis.Laya = { Animator };
  const node = {
    destroyed: false,
    numChildren: 0,
    getComponent: (type) => (type === Animator ? animator : null),
  };
  return { inspector: new ZhudaModelInspector({ node }), animator, calls };
}

test('durationSeconds plays the whole clip in that time', () => {
  const { inspector, animator, calls } = fixture();
  inspector.play('$', 'Slash', { durationSeconds: 0.4 });
  assert.equal(animator.speed, 2);
  assert.deepEqual(calls, [['play', 'Slash', 0, 0]]);
  inspector.play('$', 'Idle', { durationSeconds: 8, normalizedTime: 0.5 });
  assert.equal(animator.speed, 0.25);
  // Without it play() is as it was: speed 1 unless given.
  inspector.play('$', 'Idle');
  assert.equal(animator.speed, 1);
  inspector.play('$', 'Idle', { speed: 3 });
  assert.equal(animator.speed, 3);
});

test('a cross-fade paces the new clip and leaves the speed alone without it', () => {
  const { inspector, animator, calls } = fixture('Idle');
  animator.speed = 1.5;
  inspector.crossFade('$', 'Slash', { seconds: 0.1 });
  assert.equal(animator.speed, 1.5);
  inspector.crossFade('$', 'Slash', { seconds: 0.1, durationSeconds: 0.2 });
  assert.equal(animator.speed, 4);
  // The fade is still a share of the clip that is playing (Idle, 2 s).
  assert.deepEqual(calls.at(-1), ['crossFade', 'Slash', 0.05, 0, 0]);
});

test('what cannot be paced is refused', () => {
  const { inspector } = fixture();
  assert.throws(() => inspector.play('$', 'Slash', { durationSeconds: 0 }), /durationSeconds/);
  assert.throws(() => inspector.play('$', 'Slash', { durationSeconds: -1 }), /durationSeconds/);
  assert.throws(() => inspector.play('$', 'Empty', { durationSeconds: 1 }), /length/);
  assert.throws(() => inspector.play('$', 'Slash', { durationSeconds: 1, speed: 2 }), /not both/);
  assert.throws(() => inspector.crossFade('$', 'Empty', { durationSeconds: 1 }), /length/);
  assert.throws(
    () => inspector.play('$', 'Missing', { durationSeconds: 1 }),
    /Unknown animation state/,
  );
});
