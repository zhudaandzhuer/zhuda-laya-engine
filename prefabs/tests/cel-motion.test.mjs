// 2d/cel-motion without the engine and without 「灰燼之庭」's data: a made-up figure of three key
// poses shows what any new character gets (key-table joints, strip travel, footwork).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Footwork, PIN, PoseTrack, curve, fixed, frame, pin, poseAt } from '../2d/cel-motion/cel-motion.ts';

// Three key poses 100 px apart on an atlas; key k has its ten pins shifted by 10·k to the right.
const pins = (k) => Array.from({ length: 10 }, (_, i) => [100 * k + 20 + 5 * i + 10 * k, 10 + 9 * i]);
const FRAMES = [0, 1, 2].map((k) => frame([100 * k, 0, 100 * k + 90, 100], [100 * k + 45, 100], ...pins(k)));
// Baked strips exist only between 0-1 (four cels) and 1-2 (three cels); a cel is [page, x, y, w, h, px, py].
const EDGES = { '0-1': [[0], [0], [0], [0]], '1-2': [[0], [0], [0]] };

test('poseAt passes through every key pose and its joints, scaled from the planted foot', () => {
  const keys = [[0, 0], [0.5, 1], [1, 2]];
  for (const [time, key] of keys) {
    const pose = poseAt(keys, time, FRAMES, 2);
    const at = time === 0 ? pose.a : pose.b;
    assert.equal(at, key);
    for (let j = 0; j < 10; j++) {
      const want = pin(FRAMES, fixed(key), j, 2);
      assert.ok(Math.hypot(pose.joints[j].x - want.x, pose.joints[j].y - want.y) < 1e-9, `key ${key} joint ${j}`);
    }
  }
  // the hand keeps moving through the middle key instead of stopping there
  const before = poseAt(keys, 0.49, FRAMES, 1).joints[PIN.hand].x,
    after = poseAt(keys, 0.51, FRAMES, 1).joints[PIN.hand].x;
  assert.ok(after - before > 0.1);
  assert.equal(curve([[0, -48], [0.5, 20], [1, -48]], 0.5), 20);
});

test('an interrupted pose travels along baked strips only, and arrives', () => {
  const track = new PoseTrack(FRAMES, EDGES, 1);
  track.sample('walk', { a: 0, b: 1, t: 0.5 }, 1 / 120);
  const seen = new Set();
  let pose;
  for (let i = 0; i < 120; i++) {
    pose = track.sample('reach', fixed(2), 1 / 120);
    if (pose.a !== pose.b) seen.add(`${Math.min(pose.a, pose.b)}-${Math.max(pose.a, pose.b)}`);
  }
  assert.deepEqual([...seen].sort(), ['0-1', '1-2'], 'went 0-1 → 1 → 1-2, never 0-2 (no strip)');
  assert.deepEqual([pose.a, pose.b], [2, 2]);
  assert.throws(() => new PoseTrack(FRAMES, { '0-1': [[0]] }, 1).sample('x', { a: 1, b: 2, t: 0.5 }, 0.01), /缺少動作影格 1-2/);
});

test('footwork eases in, plants the boots in turn by distance travelled, and brakes faster', () => {
  const feet = new Footwork(1, 156, 215);
  const planted = [];
  let x = 0;
  for (let i = 0; i < 240; i++) {
    const d = feet.move(215, 1 / 120);
    x += d;
    const boot = feet.travel(d, 1 / 120);
    if (boot) planted.push(boot);
  }
  assert.ok(planted.length >= 4);
  for (let i = 1; i < planted.length; i++) assert.notEqual(planted[i], planted[i - 1], 'alternating boots');
  assert.ok(Math.abs(feet.speed - 215) < 1e-9);
  let stopping = 0;
  while (feet.speed > 0) {
    feet.move(0, 1 / 120);
    stopping++;
  }
  assert.ok(stopping < 12, 'braking takes under 0.1 s');
  const shaped = feet.shape(feet.walkPose(), FRAMES, 1, 0, true);
  assert.equal(shaped.joints.length, 10);
});
