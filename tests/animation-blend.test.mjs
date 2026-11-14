import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zhudaAimTurn,
  zhudaQuatFromTo,
  zhudaQuatMultiply,
  zhudaQuatRotate,
  zhudaQuatScale,
  zhudaSolveChain,
  zhudaSolveTwoBone,
} from '../packages/core/runtime3d/Ik.ts';
import {
  zhudaBlend1D,
  zhudaBlend2D,
  zhudaBlendSeconds,
  zhudaNormalizeWeights,
} from '../packages/core/runtime3d/AnimationBlendMath.ts';

const close = (got, want, what, tolerance = 1e-6) =>
  assert.ok(
    got.length === want.length && got.every((v, i) => Math.abs(v - want[i]) <= tolerance),
    `${what}: ${[...got]} against ${want}`,
  );
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('quaternion turns: from one direction to another, composed, and part of the way', () => {
  const quarter = zhudaQuatFromTo([1, 0, 0], [0, 0, -1]);
  close(zhudaQuatRotate(quarter, [1, 0, 0]), [0, 0, -1], 'x to -z');
  close(zhudaQuatRotate(quarter, [0, 1, 0]), [0, 1, 0], 'about y: y stays');
  close(zhudaQuatFromTo([0, 2, 0], [0, 5, 0]), [0, 0, 0, 1], 'the same way: no turn');
  // Opposite directions: half a turn, about something square to them.
  const half = zhudaQuatFromTo([0, 1, 0], [0, -1, 0]);
  close(zhudaQuatRotate(half, [0, 1, 0]), [0, -1, 0], 'half a turn');
  const twice = zhudaQuatMultiply(quarter, quarter);
  close(zhudaQuatRotate(twice, [1, 0, 0]), [-1, 0, 0], 'two quarter turns');
  const eighth = zhudaQuatScale(quarter, 0.5);
  close(zhudaQuatRotate(eighth, [1, 0, 0]), [Math.SQRT1_2, 0, -Math.SQRT1_2], 'half of a quarter');
  close(zhudaQuatScale(quarter, 0), [0, 0, 0, 1], 'none of it');
  close(zhudaQuatScale(quarter, 1), quarter, 'all of it');
  // The same turn written with the other sign is still taken the short way.
  close(
    zhudaQuatRotate(
      zhudaQuatScale(
        quarter.map((v) => -v),
        0.5,
      ),
      [1, 0, 0],
    ),
    [Math.SQRT1_2, 0, -Math.SQRT1_2],
    'the short way',
  );
});

test('two bones reach a target with their lengths kept and the middle toward the pole', () => {
  // A leg hanging straight down, half a metre each bone.
  const hip = [0, 1, 0],
    knee = [0, 0.5, 0.001],
    foot = [0, 0, 0];
  const target = [0, 0.3, 0.2];
  const solved = zhudaSolveTwoBone(hip, knee, foot, target, [0, 0.5, 1]);
  assert.equal(solved.reached, true);
  close(solved.end, target, 'the foot is on the target');
  assert.ok(
    Math.abs(distance(hip, solved.mid) - distance(hip, knee)) < 1e-9,
    'the thigh keeps its length',
  );
  assert.ok(
    Math.abs(distance(solved.mid, solved.end) - distance(knee, foot)) < 1e-9,
    'the shin keeps its length',
  );
  assert.ok(solved.mid[2] > 0.1, `the knee bends toward the pole: ${solved.mid}`);
  // The turns take the old bones onto the new ones.
  close(
    zhudaQuatRotate(solved.rootTurn, [knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]]),
    [solved.mid[0] - hip[0], solved.mid[1] - hip[1], solved.mid[2] - hip[2]],
    'the thigh turned',
    1e-9,
  );
  const carried = zhudaQuatRotate(solved.rootTurn, [
    foot[0] - knee[0],
    foot[1] - knee[1],
    foot[2] - knee[2],
  ]);
  close(
    zhudaQuatRotate(solved.midTurn, carried),
    [solved.end[0] - solved.mid[0], solved.end[1] - solved.mid[1], solved.end[2] - solved.mid[2]],
    'the shin turned',
    1e-9,
  );
  // The other pole: the knee bends the other way, the foot in the same place.
  const back = zhudaSolveTwoBone(hip, knee, foot, target, [0, 0.5, -1]);
  close(back.end, target, 'the foot again');
  assert.ok(back.mid[2] < solved.mid[2], 'the knee the other way');
  // Without a pole the knee keeps the side it is bent to.
  const kept = zhudaSolveTwoBone(hip, [0, 0.5, -0.2], foot, [0, 0.2, 0]);
  assert.ok(kept.mid[2] < 0, 'the side the animation gave it');
  // Out of reach: pointed at, almost straight, and said so.
  const beyond = zhudaSolveTwoBone(hip, knee, foot, [0, -5, 0]);
  assert.equal(beyond.reached, false);
  assert.ok(
    Math.abs(distance(hip, beyond.end) - 0.9999 * (distance(hip, knee) + distance(knee, foot))) <
      1e-6,
  );
  close([beyond.end[0], beyond.end[2]], [0, 0], 'straight down');
  // The same input, the same answer.
  assert.deepEqual(zhudaSolveTwoBone(hip, knee, foot, target, [0, 0.5, 1]), solved);
  assert.throws(() => zhudaSolveTwoBone(hip, hip, foot, target), /no length/);
  assert.throws(() => zhudaSolveTwoBone(hip, knee, foot, [0, NaN, 0]), /target/);
  assert.throws(() => zhudaSolveTwoBone(hip, knee, foot, target, [1]), /pole/);
});

test('a chain reaches a target by steps, its root fixed and its lengths kept', () => {
  const chain = [
    [0, 0, 0],
    [0, 1, 0],
    [0, 2, 0],
    [0, 3, 0],
    [0, 4, 0],
  ];
  const target = [2, 2, 1];
  const solved = zhudaSolveChain(chain, target);
  assert.equal(solved.reached, true);
  assert.ok(solved.error <= 1e-4);
  close(solved.joints[0], [0, 0, 0], 'the root stays');
  for (let i = 1; i < chain.length; i++)
    assert.ok(
      Math.abs(distance(solved.joints[i], solved.joints[i - 1]) - 1) < 1e-9,
      `bone ${i} keeps its length`,
    );
  assert.ok(distance(solved.joints[4], target) <= 1e-4);
  assert.deepEqual(chain[4], [0, 4, 0], 'the input is not changed');
  // Out of reach: a straight line toward it.
  const beyond = zhudaSolveChain(chain, [10, 0, 0]);
  assert.equal(beyond.reached, false);
  close(beyond.joints[4], [4, 0, 0], 'stretched toward the target');
  assert.ok(Math.abs(beyond.error - 6) < 1e-9);
  assert.deepEqual(zhudaSolveChain(chain, target), solved, 'the same input, the same answer');
  assert.throws(() => zhudaSolveChain([[0, 0, 0]], target), /2\.\.64 joints/);
  assert.throws(
    () =>
      zhudaSolveChain(
        [
          [0, 0, 0],
          [0, 0, 0],
        ],
        target,
      ),
    /no length/,
  );
  assert.throws(() => zhudaSolveChain(chain, target, 0), /iterations/);
});

test('an aim turns a bone toward a point, by at most an angle and a share', () => {
  const whole = zhudaAimTurn([0, 0, 1], [0, 0, 0], [5, 0, 0]);
  close(zhudaQuatRotate(whole, [0, 0, 1]), [1, 0, 0], 'turned to face it');
  const limited = zhudaAimTurn([0, 0, 1], [0, 0, 0], [5, 0, 0], 30);
  close(
    zhudaQuatRotate(limited, [0, 0, 1]),
    [0.5, 0, Math.sqrt(3) / 2],
    'thirty degrees of the ninety',
  );
  const shared = zhudaAimTurn([0, 0, 1], [0, 0, 0], [5, 0, 0], 180, 0.5);
  close(zhudaQuatRotate(shared, [0, 0, 1]), [Math.SQRT1_2, 0, Math.SQRT1_2], 'half the way');
  close(zhudaAimTurn([0, 0, 1], [0, 0, 0], [0, 0, 0]), [0, 0, 0, 1], 'nothing to face');
  close(zhudaAimTurn([0, 0, 1], [1, 1, 1], [1, 1, 9]), [0, 0, 0, 1], 'already facing it');
  assert.throws(() => zhudaAimTurn([0, 0, 1], [0, 0, 0], [1, 0, 0], 200), /maxDeg/);
  assert.throws(() => zhudaAimTurn([0, 0, 1], [0, 0, 0], [1, 0, 0], 90, 2), /weight/);
});

test('blend weights on a line: the two neighbours share, the ends take all', () => {
  const speeds = [0, 1.5, 4];
  assert.deepEqual(zhudaBlend1D(speeds, 0), [1, 0, 0]);
  assert.deepEqual(zhudaBlend1D(speeds, -3), [1, 0, 0]);
  assert.deepEqual(zhudaBlend1D(speeds, 9), [0, 0, 1]);
  assert.deepEqual(zhudaBlend1D(speeds, 1.5), [0, 1, 0]);
  close(zhudaBlend1D(speeds, 0.75), [0.5, 0.5, 0], 'between idle and walk');
  close(zhudaBlend1D(speeds, 3.5), [0, 0.2, 0.8], 'between walk and run');
  for (let v = -1; v <= 5; v += 0.37) {
    const weights = zhudaBlend1D(speeds, v);
    assert.ok(
      Math.abs(weights.reduce((s, w) => s + w, 0) - 1) < 1e-12 && weights.every((w) => w >= 0),
    );
  }
  assert.deepEqual(zhudaBlend1D([2], 7), [1]);
  assert.throws(() => zhudaBlend1D([1, 1], 0), /ascending/);
  assert.throws(() => zhudaBlend1D([], 0), /positions/);
  assert.throws(() => zhudaBlend1D([0, 1], NaN), /finite/);
});

test('blend weights on a plane: a clip has its own point, neighbours share, the sum is 1', () => {
  // Idle in the middle; forward, back, left and right round it.
  const points = [
    [0, 0],
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
  ];
  close(zhudaBlend2D(points, 0, 0), [1, 0, 0, 0, 0], 'at idle');
  close(zhudaBlend2D(points, 0, 1), [0, 1, 0, 0, 0], 'at forward');
  close(zhudaBlend2D(points, 0, 0.5), [0.5, 0.5, 0, 0, 0], 'half way to forward');
  const diagonal = zhudaBlend2D(points, 0.5, 0.5);
  assert.ok(
    Math.abs(diagonal[1] - diagonal[4]) < 1e-12 && diagonal[1] > 0.2,
    `forward and right alike: ${diagonal}`,
  );
  assert.equal(diagonal[2], 0);
  assert.equal(diagonal[3], 0);
  for (let x = -1.5; x <= 1.5; x += 0.3)
    for (let y = -1.5; y <= 1.5; y += 0.3) {
      const weights = zhudaBlend2D(points, x, y);
      assert.ok(
        Math.abs(weights.reduce((s, w) => s + w, 0) - 1) < 1e-9 && weights.every((w) => w >= 0),
        `${x},${y}`,
      );
    }
  // Far beyond a clip, that clip.
  close(zhudaBlend2D(points, 0, 30), [0, 1, 0, 0, 0], 'far forward');
  assert.deepEqual(zhudaBlend2D([[3, 3]], 0, 0), [1]);
  assert.throws(
    () =>
      zhudaBlend2D(
        [
          [0, 0],
          [0, 0],
        ],
        0,
        0,
      ),
    /one point/,
  );
  assert.throws(() => zhudaBlend2D([[0]], 0, 0), /two finite/);
});

test("weights are made to add up to 1 and a round of a blend is its clips' lengths weighed", () => {
  close(zhudaNormalizeWeights([2, 1, 1]), [0.5, 0.25, 0.25], 'normalized');
  assert.throws(() => zhudaNormalizeWeights([0, 0]), /every weight is 0/);
  assert.throws(() => zhudaNormalizeWeights([1, -1]), /0 or more/);
  // A walk of a second and a run of 0.6: half and half is a round of 0.8.
  assert.ok(Math.abs(zhudaBlendSeconds([1, 1], [1, 0.6]) - 0.8) < 1e-12);
  assert.equal(zhudaBlendSeconds([0, 3], [1, 0.6]), 0.6);
  assert.throws(() => zhudaBlendSeconds([1], [1, 2]), /length for each/);
  assert.throws(() => zhudaBlendSeconds([1, 1], [1, 0]), /above 0/);
});
