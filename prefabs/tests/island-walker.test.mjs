// The walker's camera and input without a browser: a stand-in Laya.Vector3 and camera, the fake DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { El, installDom } from './fake-dom.mjs';

installDom();
globalThis.Laya ??= {};
globalThis.Laya.Vector3 ??= class {
  constructor(x = 0, y = 0, z = 0) {
    Object.assign(this, { x, y, z });
  }
};
const { FollowCamera } = await import('../3d/island-walker/follow-camera.ts');
const { WalkInput } = await import('../3d/island-walker/walk-input.ts');

const fakeCamera = () => {
  const seen = { position: null, lookAt: null };
  return { seen, transform: { set position(v) { seen.position = v; }, lookAt(v) { seen.lookAt = v; } } };
};
const settle = (follow, feet, seconds = 6) => {
  let eye;
  for (let i = 0; i < seconds * 60; i++) eye = follow.update(1 / 60, feet);
  return eye;
};

test('the follow camera orbits the feet at its distance, looks 1 m above them and moves the camera', () => {
  const camera = fakeCamera();
  const follow = new FollowCamera(camera, [0, 0, 0], { ground: () => 0, orbit: { yaw: 0, pitch: 0.3, distance: 8 } });
  const eye = settle(follow, [0, 0, 0]);
  assert.ok(Math.abs(Math.hypot(eye[0], eye[1] - 1, eye[2]) - 8) < 1e-6, 'at its distance from the target');
  assert.ok(eye[2] > 7 && Math.abs(eye[0]) < 1e-9, 'yaw 0 puts the eye to the south (+z)');
  assert.deepEqual(follow.target.map((v) => Math.round(v * 1e6) / 1e6), [0, 1, 0]);
  assert.deepEqual([camera.seen.position.x, camera.seen.position.y, camera.seen.position.z], eye);
  assert.equal(camera.seen.lookAt.y, follow.target[1]);
});

test('an obstacle between eye and character pulls the eye in front of it, never nearer than `nearest`; off when avoid is false', () => {
  const crown = [0, 3, 5, 1.5];
  const follow = new FollowCamera(fakeCamera(), [0, 0, 0], { ground: () => 0, obstacles: [crown], orbit: { yaw: 0, pitch: 0.3, distance: 12 } });
  settle(follow, [0, 0, 0]);
  assert.ok(follow.boom < 12 && follow.boom >= 3, `pulled in to ${follow.boom}`);
  follow.avoid = false;
  settle(follow, [0, 0, 0]);
  assert.ok(Math.abs(follow.boom - 12) < 1e-3, 'back out without avoiding');
});

test('the eye stays above the ground, and set()/snap() move at once', () => {
  const follow = new FollowCamera(fakeCamera(), [0, 0, 0], { ground: () => 5, orbit: { yaw: 0, pitch: 0.05, distance: 8 } });
  const eye = settle(follow, [0, 0, 0]);
  assert.ok(eye[1] >= 5.4 - 1e-9, 'clearance over the ground');
  follow.set({ yaw: 1, distance: 20 });
  assert.equal(follow.orbit.yaw, 1);
  assert.equal(follow.goal.distance, 20);
  follow.snap([10, 2, -3]);
  assert.deepEqual(follow.target, [10, 3, -3]);
});

test('keys walk against the camera: W walks away from the eye, D to its right, both together at most a full push', () => {
  const canvas = new El('canvas');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
  const goal = { yaw: 0, pitch: 0.3, distance: 8 };
  const input = new WalkInput(canvas, goal);
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(input.stick(0), [0, 0]));
  window.dispatch('keydown', { key: 'W' });
  assert.ok(near(input.stick(0), [0, -1]), 'yaw 0: the eye is south, W goes north');
  assert.ok(near(input.stick(Math.PI / 2), [-1, 0]), 'yaw 90°: the eye is east, W goes west');
  window.dispatch('keydown', { key: 'd' });
  const both = input.stick(0);
  assert.ok(Math.abs(Math.hypot(...both) - 1) < 1e-9 && both[0] > 0 && both[1] < 0);
  window.dispatch('blur');
  assert.ok(near(input.stick(0), [0, 0]), 'blur lets go of the keys');
  input.dispose();
  window.dispatch('keydown', { key: 'w' });
  assert.ok(near(input.stick(0), [0, 0]), 'disposed: keys are no longer heard');
});

test('a touch on the left is the stick; a drag elsewhere turns the view; the wheel zooms within limits', () => {
  const canvas = new El('canvas');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
  const goal = { yaw: 0, pitch: 0.3, distance: 8 };
  const input = new WalkInput(canvas, goal);
  canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 500 });
  canvas.dispatch('pointermove', { pointerId: 1, clientX: 320, clientY: 500 });
  const s = input.stick(0);
  assert.ok(Math.abs(s[0] - 1) < 1e-9 && Math.abs(s[1]) < 1e-9, 'a drag of 60 px or more is a full push');
  assert.equal(goal.yaw, 0, 'the stick does not turn the view');
  canvas.dispatch('pointerup', { pointerId: 1 });
  assert.deepEqual(input.stick(0).map(Math.abs), [0, 0]);
  canvas.dispatch('pointerdown', { pointerId: 2, pointerType: 'mouse', clientX: 800, clientY: 300 });
  canvas.dispatch('pointermove', { pointerId: 2, clientX: 900, clientY: 350 });
  assert.ok(Math.abs(goal.yaw + 0.6) < 1e-9 && Math.abs(goal.pitch - 0.5) < 1e-9);
  canvas.dispatch('pointerup', { pointerId: 2 });
  for (let i = 0; i < 50; i++) canvas.dispatch('wheel', { deltaY: 500 });
  assert.equal(goal.distance, 40);
  for (let i = 0; i < 50; i++) canvas.dispatch('wheel', { deltaY: -500 });
  assert.equal(goal.distance, 3);
  input.dispose();
});
