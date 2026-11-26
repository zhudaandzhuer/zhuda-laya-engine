// games/tools/characters/rig-motion.mjs: poses for a skeleton that is not turned in the bind pose,
// a limb that reaches a place, chains swung on springs into the keys, and what a cross-fade does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IDENTITY,
  qaxis,
  qmul,
  qrot,
  qangle,
  qeuler,
  qbetween,
  qpow,
  twistAbout,
  reach,
  worldPose,
  skinPoints,
  swingChains,
  toAnimations,
  fadeStep,
} from '../games/tools/characters/rig-motion.mjs';

const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) <= e);
const D = Math.PI / 180;

test('turns: about an axis, between two directions, a share of one, the part about an axis', () => {
  assert.ok(near(qrot(qaxis([0, 0, 1], 90 * D), [1, 0, 0]), [0, 1, 0]));
  assert.ok(
    near(qrot(qeuler(0, 90, 0), [0, 0, 1]), [1, 0, 0]),
    'a turn about y takes the front to the left hand',
  );
  assert.ok(near(qrot(qbetween([1, 0, 0], [0, 0, -2]), [1, 0, 0]), [0, 0, -1]));
  assert.ok(
    near(qrot(qbetween([1, 0, 0], [-1, 0, 0]), [1, 0, 0]), [-1, 0, 0]),
    'opposite directions',
  );
  assert.ok(Math.abs(qangle(qpow(qaxis([0, 1, 0], 80 * D), 0.25), IDENTITY) - 20) < 1e-6);
  const turn = qmul(qaxis([0, 0, 1], 30 * D), qaxis([1, 0, 0], 50 * D));
  assert.ok(
    Math.abs(qangle(twistAbout(turn, [1, 0, 0]), IDENTITY) - 50) < 1e-6,
    'swing about z, then the twist about x is found again',
  );
});

const LEG = [
  { name: 'hips', parent: -1, position: [0, 1, 0] },
  { name: 'thigh', parent: 0, position: [0.1, 0.9, 0] },
  { name: 'shin', parent: 1, position: [0.12, 0.5, 0.02] },
  { name: 'foot', parent: 2, position: [0.14, 0.1, 0] },
];

test('a leg reaches where its foot is put, whatever the hips do', () => {
  for (const [move, turn] of [
    [[0, -0.06, 0], IDENTITY],
    [[0.03, -0.02, 0.05], qeuler(4, -12, 3)],
    [[0, 0, 0], IDENTITY],
  ]) {
    const pose = [turn];
    pose.shift = { 0: move };
    const hip = worldPose(LEG, pose).positions[1],
      foot = [0.14, 0.1, 0];
    const leg = reach(
      LEG[1].position,
      LEG[2].position,
      LEG[3].position,
      qrot(
        [-turn[0], -turn[1], -turn[2], turn[3]],
        [foot[0] - hip[0], foot[1] - hip[1], foot[2] - hip[2]],
      ),
    );
    pose[1] = leg.upper;
    pose[2] = leg.lower;
    const world = worldPose(LEG, pose);
    assert.ok(near(world.positions[3], foot, 1e-6), `foot at ${world.positions[3]}`);
    // The knee bends forwards (the bind pose has it a little to the front), not backwards.
    assert.ok(world.positions[2][2] > -1e-6);
  }
  // Too far: reached for, the leg straight, no NaN.
  const far = reach(LEG[1].position, LEG[2].position, LEG[3].position, [0, -2, 0]);
  assert.ok(far.upper.every(Number.isFinite) && far.lower.every(Number.isFinite));
  // A limb that is straight in the bind pose bends towards the pole.
  const straight = reach([0, 1, 0], [0, 0.5, 0], [0, 0, 0], [0, -0.8, 0], { pole: [0, 0, 1] });
  const knee = qrot(straight.upper, [0, -0.5, 0]);
  assert.ok(knee[2] > 0.1, `knee at ${knee}`);
});

test('points follow their joints as a skin does', () => {
  const joints = [
    { parent: -1, position: [0, 0, 0] },
    { parent: 0, position: [1, 0, 0] },
  ];
  const points = Float32Array.from([1.5, 0, 0, 0.5, 0, 0]),
    skin = {
      joints: Uint8Array.from([1, 0, 0, 0, 0, 1, 0, 0]),
      weights: Float32Array.from([1, 0, 0, 0, 0.5, 0.5, 0, 0]),
    };
  const out = skinPoints(
    points,
    skin,
    joints,
    worldPose(joints, [undefined, qaxis([0, 0, 1], 90 * D)]),
  );
  assert.ok(
    near([...out.subarray(0, 3)], [1, 0.5, 0]),
    'held by the turned joint: round its place',
  );
  assert.ok(
    near([...out.subarray(3, 6)], [0.75, -0.25, 0]),
    'held by both: half way between where each would take it',
  );
});

// A body joint that swings, and a chain of three hanging from it.
const HANG = [
  { name: 'body', parent: -1, position: [0, 2, 0] },
  { name: 'hair 1', parent: 0, position: [0, 1.9, 0] },
  { name: 'hair 2', parent: 1, position: [0, 1.7, 0] },
  { name: 'hair 3', parent: 2, position: [0, 1.5, 0] },
];
const CHAIN = { joints: [1, 2, 3], end: [0, 1.3, 0], stiffness: 0.1, drag: 0.15 };
const swaying = (frames, degrees = 20) =>
  Array.from({ length: frames + 1 }, (_, f) => [
    qaxis([0, 0, 1], degrees * D * Math.sin((2 * Math.PI * f) / frames)),
  ]);

test('a chain lags behind what carries it, keeps its length, and a loop closes on itself', () => {
  const frames = swaying(60);
  swingChains(HANG, frames, [CHAIN], { fps: 30, loop: true });
  // It moves: every link turns, and not all alike (the end lags the root).
  for (const j of CHAIN.joints)
    assert.ok(Math.max(...frames.map((f) => qangle(f[j], IDENTITY))) > 2, `joint ${j} turns`);
  // The bones keep their length: the joints' places follow from turns alone, so only the turns are checked to be turns.
  for (const f of frames)
    for (const j of CHAIN.joints) assert.ok(Math.abs(Math.hypot(...f[j]) - 1) < 1e-9);
  // The loop's last frame is its first, and the step into it is like the steps before it.
  for (const j of CHAIN.joints) {
    assert.equal(frames[60][j], frames[0][j]);
    const last = qangle(frames[59][j], frames[60][j]),
      before = qangle(frames[58][j], frames[59][j]),
      first = qangle(frames[0][j], frames[1][j]);
    assert.ok(
      last < 1.5 * Math.max(before, first) + 0.05,
      `joint ${j}: steps ${before}, ${last}, ${first}`,
    );
  }
  // Still frames leave it still.
  const still = Array.from({ length: 20 }, () => [IDENTITY]);
  swingChains(HANG, still, [CHAIN], { fps: 30 });
  assert.ok(still.every((f) => CHAIN.joints.every((j) => qangle(f[j], IDENTITY) < 1e-6)));
});

test("a clip goes on from where the one before left the chain; a draught moves a still body's chain", () => {
  // One sway cut in two clips gives what it gives in one.
  const whole = swaying(30),
    first = swaying(30).slice(0, 16),
    second = swaying(30).slice(16);
  swingChains(HANG, whole, [CHAIN], { fps: 30 });
  const state = swingChains(HANG, first, [CHAIN], { fps: 30 });
  swingChains(HANG, second, [CHAIN], { fps: 30, state });
  for (const j of CHAIN.joints)
    for (const [f, frame] of second.entries())
      assert.ok(qangle(frame[j], whole[16 + f][j]) < 1e-3, `joint ${j} frame ${16 + f}`);
  // Without what the first left behind, the second begins at rest: not the same.
  const fresh = swaying(30).slice(16);
  swingChains(HANG, fresh, [CHAIN], { fps: 30 });
  assert.ok(qangle(fresh[0][1], whole[16][1]) > 1);
  const blown = Array.from({ length: 40 }, () => [IDENTITY]);
  swingChains(HANG, blown, [{ ...CHAIN, push: () => [3, 0, 0] }], { fps: 30 });
  assert.ok(
    qangle(blown[39][1], IDENTITY) > 1 && qrot(blown[39][1], [0, -1, 0])[0] > 0,
    'pushed towards +x',
  );
  assert.throws(
    () => swingChains(HANG, blown, [{ ...CHAIN, joints: [1, 3] }], { fps: 30 }),
    /not the child/,
  );
});

test('hair that lies on the back stays on the back when the head turns', () => {
  // chest - head - hair: the head turns 40 degrees about the vertical; the hair hangs behind.
  const joints = [
    { name: 'chest', parent: -1, position: [0, 1.4, 0] },
    { name: 'head', parent: 0, position: [0, 1.6, 0] },
    { name: 'hair 1', parent: 1, position: [0, 1.6, -0.1] },
    { name: 'hair 2', parent: 2, position: [0, 1.45, -0.12] },
  ];
  const chain = { joints: [2, 3], end: [0, 1.3, -0.13], stiffness: 0.3, drag: 0.4 };
  const turned = () => Array.from({ length: 90 }, () => [undefined, qeuler(0, 40, 0)]);
  const endOf = (frames) => {
    const w = worldPose(joints, frames.at(-1));
    const tip = qrot(w.rotations[3], [0, -0.15, -0.01]);
    return [w.positions[3][0] + tip[0], w.positions[3][1] + tip[1], w.positions[3][2] + tip[2]];
  };
  const free = turned(),
    lying = turned();
  swingChains(joints, free, [chain], { fps: 30 });
  swingChains(joints, lying, [{ ...chain, lies: { on: 0, share: [0.6, 1] } }], { fps: 30 });
  assert.ok(Math.abs(endOf(free)[0]) > 0.07, 'carried round with the head');
  assert.ok(Math.abs(endOf(lying)[0]) < 0.02, `stays behind the chest: ${endOf(lying)}`);
});

test('clips are written with a key on every frame, and a joint that is moved gets its places', () => {
  const joints = [
    { name: 'root', parent: -1, position: [0, 0, 0] },
    { name: 'hips', parent: 0, position: [0, 1, 0] },
    { name: 'still', parent: 1, position: [0, 1.2, 0] },
  ];
  const frames = Array.from({ length: 31 }, (_, f) => {
    const pose = [undefined, qaxis([0, 1, 0], f * 12 * D)];
    pose.shift = { 1: [0, -0.01 * f, 0] };
    return pose;
  });
  const [clip] = toAnimations([{ name: 'Turn', frames }], 30, joints);
  assert.equal(clip.times.length, 31);
  assert.ok(Math.abs(clip.times[30] - 1) < 1e-6);
  assert.deepEqual(
    clip.channels.map((c) => `${c.joint} ${c.path}`),
    ['1 rotation', '1 translation'],
  );
  // A whole turn: neighbouring keys stay on the same side, so that a reader goes the short way.
  const q = clip.channels[0].values;
  for (let f = 1; f < 31; f++)
    assert.ok(
      q[f * 4] * q[f * 4 - 4] +
        q[f * 4 + 1] * q[f * 4 - 3] +
        q[f * 4 + 2] * q[f * 4 - 2] +
        q[f * 4 + 3] * q[f * 4 - 1] >
        0,
    );
  assert.ok(
    near([...clip.channels[1].values.subarray(30 * 3)], [0, 0.7, 0], 1e-6),
    'its place at rest, moved',
  );
  const [all] = toAnimations([{ name: 'Turn', frames }], 30, joints, { every: true });
  assert.equal(all.channels.filter((c) => c.path === 'rotation').length, 3);
  assert.throws(() => toAnimations([{ name: 'Turn', frames }], 30), /needs the joints/);
});

test('a cross-fade between two clips that agree does not jump; one between two that do not, does', () => {
  const joints = [
    { parent: -1, position: [0, 0, 0] },
    { parent: 0, position: [0, 1, 0] },
    { parent: 1, position: [0, 2, 0] },
  ];
  const sway = (phase, lean = 0) => ({
    frames: Array.from({ length: 61 }, (_, f) => [
      qaxis([0, 0, 1], (lean + 5 * Math.sin((2 * Math.PI * f) / 60 + phase)) * D),
      undefined,
      undefined,
    ]),
  });
  const same = fadeStep(joints, sway(0), sway(0.05), { fps: 30, seconds: 0.18, at: 0 });
  assert.ok(same.inFade < 1.5 * same.alone, `${same.inFade} against ${same.alone}`);
  const apart = fadeStep(joints, sway(0), sway(0, 70), { fps: 30, seconds: 0.18, at: 0 });
  assert.ok(apart.inFade > 5 * apart.alone);
});
