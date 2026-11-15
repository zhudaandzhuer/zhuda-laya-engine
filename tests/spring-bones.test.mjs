// Spring bones: chains that lag, swing and settle. The solver's promises
// (a bone keeps its length; the same deltas and anchors give the same
// chains; a pause changes nothing; a long gap does no harm; no joint ends a
// step inside a body) and the owner that turns a model's nodes by it.
// Plain arithmetic, no browser; the draw is verify:spring-bones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaSpringBoneSolver } from '../packages/core/simulation/index.ts';
import { ZhudaSpringBones } from '../packages/core/runtime3d/SpringBones.ts';
import { ZhudaLayeredClock } from '../packages/core/runtime3d/Clocks.ts';
import { zhudaQuatRotate } from '../packages/core/runtime3d/Ik.ts';

const same = (a, b) =>
  Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(
    Buffer.from(b.buffer, b.byteOffset, b.byteLength),
  );
const IDENTITY = [0, 0, 0, 1];
/** A chain of `bones` bones of a tenth of a metre, pointing along `axis` at rest. */
const straight = (bones, axis = [0, -1, 0]) => ({
  rotations: Array.from({ length: bones }, () => IDENTITY),
  axes: Array.from({ length: bones }, () => axis),
  lengths: Array.from({ length: bones }, () => 0.1),
});
const joint = (solver, id, i) => Array.from(solver.tails(id).subarray(i * 3, i * 3 + 3));
/** The bones' lengths as the joints are, from the anchor on. */
const lengths = (solver, id, anchor, bones) => {
  const out = [];
  let from = anchor;
  for (let i = 0; i < bones; i++) {
    const to = joint(solver, id, i);
    out.push(Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]));
    from = to;
  }
  return out;
};
const frames = (solver, count, each) => {
  for (let f = 0; f < count; f++) {
    each?.(f);
    solver.advance(1 / 60);
  }
};

test('a chain is laid out at rest where it first hangs, and what is not one is refused', () => {
  const solver = new ZhudaSpringBoneSolver();
  assert.deepEqual([solver.step, solver.maxSteps], [1 / 120, 8]);
  const id = solver.addChain(straight(3), { gravity: [0, 0, 0] });
  solver.setAnchor(id, [1, 2, 3], IDENTITY);
  Array.from(solver.tails(id)).forEach((v, k) =>
    assert.ok(Math.abs(v - [1, 1.9, 3, 1, 1.8, 3, 1, 1.7, 3][k]) < 1e-12),
  );
  assert.deepEqual(Array.from(solver.rotations(id)), [...IDENTITY, ...IDENTITY, ...IDENTITY]);
  // With nothing to pull it away, it stays there.
  frames(solver, 120);
  for (let i = 0; i < 3; i++)
    joint(solver, id, i).forEach((v, k) =>
      assert.ok(Math.abs(v - [1, 1.9 - i * 0.1, 3][k]) < 1e-12),
    );
  assert.throws(() => solver.addChain({ rotations: [], axes: [], lengths: [] }), /1 to 256 bones/);
  assert.throws(
    () => solver.addChain({ rotations: [IDENTITY], axes: [[0, 0, 0]], lengths: [0.1] }),
    /axes\[0\] is not a direction/,
  );
  assert.throws(
    () => solver.addChain({ rotations: [IDENTITY], axes: [[0, 1, 0]], lengths: [0] }),
    /lengths\[0\]/,
  );
  assert.throws(() => solver.addChain(straight(1), { bounce: 1 }), /Unknown chain option: bounce/);
  assert.throws(() => solver.addChain(straight(1), { drag: -1 }), /Invalid drag: 0 to 100/);
  assert.throws(() => solver.setAnchor(99, [0, 0, 0], IDENTITY), /No chain 99/);
  assert.throws(() => solver.setAnchor(id, [0, 0], IDENTITY), /Invalid anchor/);
  assert.throws(
    () => new ZhudaSpringBoneSolver({ rounds: 2 }),
    /Unknown spring bone option: rounds/,
  );
  assert.throws(() => new ZhudaSpringBoneSolver({ step: 1 }), /Invalid step/);
  assert.throws(() => solver.addCollider({ type: 'sphere', center: [0, 0, 0] }), /radius/);
});

test('a rope falls to hang under its anchor, each bone its own length, each rotation the bone’s way', () => {
  const solver = new ZhudaSpringBoneSolver();
  // At rest it points sideways; with no stiffness gravity has it.
  const rest = straight(5, [1, 0, 0]);
  const id = solver.addChain(rest, { stiffness: 0, drag: 6 });
  const anchor = [0, 2, 0];
  solver.setAnchor(id, anchor, IDENTITY);
  assert.ok(Math.abs(joint(solver, id, 4)[0] - 0.5) < 1e-12, 'laid out sideways');
  frames(solver, 900);
  for (let i = 0; i < 5; i++) {
    const [x, y, z] = joint(solver, id, i);
    assert.ok(Math.abs(x) < 2e-3 && Math.abs(z) < 1e-9, `joint ${i} under the anchor (${x})`);
    assert.ok(Math.abs(y - (2 - (i + 1) * 0.1)) < 1e-4, `joint ${i} at ${y}`);
  }
  lengths(solver, id, anchor, 5).forEach((l) => assert.ok(Math.abs(l - 0.1) < 1e-12, `${l}`));
  assert.ok(solver.inspect().kineticEnergy < 1e-8, 'at rest');
  // Each bone's rotation takes its own axis to where the bone points.
  const turns = solver.rotations(id);
  let from = anchor;
  for (let i = 0; i < 5; i++) {
    const q = Array.from(turns.subarray(i * 4, i * 4 + 4));
    assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-12, 'a unit rotation');
    const to = joint(solver, id, i),
      way = zhudaQuatRotate(q, rest.axes[i]);
    way.forEach((v, k) => assert.ok(Math.abs(v - (to[k] - from[k]) / 0.1) < 1e-9));
    from = to;
  }
});

test('a chain lags behind what it hangs from, then settles; turned with its parent, it turns', () => {
  const solver = new ZhudaSpringBoneSolver();
  const id = solver.addChain(straight(5), { stiffness: 4 });
  solver.setAnchor(id, [0, 2, 0], IDENTITY);
  frames(solver, 120);
  // Carried half a metre along x in half a second.
  let behind = 0;
  frames(solver, 30, (f) => {
    const x = (f + 1) / 60;
    solver.setAnchor(id, [x, 2, 0], IDENTITY);
    behind = Math.max(behind, x - joint(solver, id, 4)[0]);
  });
  assert.ok(behind > 0.08, `the tip trails (${behind})`);
  frames(solver, 900, () => solver.setAnchor(id, [0.5, 2, 0], IDENTITY));
  assert.ok(Math.abs(joint(solver, id, 4)[0] - 0.5) < 1e-3, 'and comes to hang under it');
  assert.ok(solver.inspect().kineticEnergy < 1e-8);
  lengths(solver, id, [0.5, 2, 0], 5).forEach((l) => assert.ok(Math.abs(l - 0.1) < 1e-12));
  // The parent turned a quarter about z, no gravity, stiff: the chain points where rest now is (+x).
  const stiff = new ZhudaSpringBoneSolver();
  const turned = stiff.addChain(straight(3), { stiffness: 60, gravity: [0, 0, 0] });
  stiff.setAnchor(turned, [0, 0, 0], IDENTITY);
  const quarter = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  frames(stiff, 300, () => stiff.setAnchor(turned, [0, 0, 0], quarter));
  joint(stiff, turned, 2).forEach((v, k) => assert.ok(Math.abs(v - [0.3, 0, 0][k]) < 1e-3, `${v}`));
  // Put back at rest at once.
  stiff.setAnchor(turned, [5, 5, 5], IDENTITY);
  stiff.reset(turned);
  joint(stiff, turned, 2).forEach((v, k) => assert.ok(Math.abs(v - [5, 4.7, 5][k]) < 1e-12));
});

test('the same deltas and anchors give the same chains; a pause changes nothing; a gap does no harm', () => {
  const run = () => {
    const solver = new ZhudaSpringBoneSolver();
    const a = solver.addChain(straight(6), { stiffness: 3 }),
      b = solver.addChain(straight(4, [1, 0, 0]), { stiffness: 12, drag: 2, radius: 0.03 });
    solver.addCollider({ type: 'sphere', center: [0.1, 1.7, 0], radius: 0.15 });
    for (let f = 0; f < 240; f++) {
      const x = 0.3 * Math.sin(f / 9);
      solver.setAnchor(a, [x, 2, 0], IDENTITY);
      solver.setAnchor(b, [x, 2, 0.1], [0, 0, Math.sin(f / 40), Math.cos(f / 40)]);
      solver.advance(f % 5 === 2 ? 1 / 30 : 1 / 60);
    }
    return { solver, a, b };
  };
  const one = run(),
    other = run();
  for (const id of ['a', 'b']) {
    assert.ok(same(one.solver.tails(one[id]), other.solver.tails(other[id])));
    assert.ok(same(one.solver.rotations(one[id]), other.solver.rotations(other[id])));
  }
  assert.equal(one.solver.inspect().steps, other.solver.inspect().steps);
  // Paused: zeros come, nothing moves.
  const { solver, a } = one;
  const before = Float64Array.from(solver.tails(a));
  for (let f = 0; f < 300; f++) assert.deepEqual(solver.advance(0), { steps: 0, dropped: 0 });
  assert.ok(same(solver.tails(a), before));
  for (const bad of [Number.NaN, -1, Infinity])
    assert.throws(() => solver.advance(bad), /Invalid delta/);
  // Five seconds in one delta: eight steps, the other 592 dropped; every joint finite and a bone long.
  solver.setAnchor(a, [0, 2, 0], IDENTITY);
  assert.deepEqual(solver.advance(5), { steps: 8, dropped: 592 });
  assert.ok(Array.from(solver.tails(a)).every(Number.isFinite));
  lengths(solver, a, [0, 2, 0], 6).forEach((l) => assert.ok(Math.abs(l - 0.1) < 1e-12));
});

test('no joint ends a step inside a body, and the bones keep their lengths against it', () => {
  const solver = new ZhudaSpringBoneSolver();
  const id = solver.addChain(straight(8), { stiffness: 2, radius: 0.02 });
  // A ball in the way of the swing, and a rod under it.
  const ball = solver.addCollider({ type: 'sphere', center: [0.25, 1.7, 0], radius: 0.15 });
  solver.addCollider({ type: 'capsule', a: [-0.6, 1.25, 0], b: [0.6, 1.25, 0], radius: 0.05 });
  let touched = 0;
  for (let f = 0; f < 600; f++) {
    const x = 0.45 * Math.sin(f / 20);
    solver.setAnchor(id, [x, 2.05, 0], IDENTITY);
    solver.advance(1 / 60);
    assert.equal(solver.countInside(), 0, `frame ${f}`);
    lengths(solver, id, [x, 2.05, 0], 8).forEach((l) =>
      assert.ok(Math.abs(l - 0.1) < 1e-9, `frame ${f}: ${l}`),
    );
    // It does meet the ball: some joint is within a millimetre of its grown skin.
    for (let i = 0; i < 8; i++) {
      const p = joint(solver, id, i);
      if (Math.hypot(p[0] - 0.25, p[1] - 1.7, p[2]) < 0.15 + 0.02 + 1e-3) touched++;
    }
  }
  assert.ok(touched > 50, `the chain lay against the ball (${touched})`);
  assert.equal(solver.inspect().inside, 0);
  // A body moved, a body taken away.
  solver.setCollider(ball, { type: 'sphere', center: [9, 9, 9], radius: 0.15 });
  solver.removeCollider(ball);
  assert.throws(() => solver.removeCollider(ball), /No collider/);
  assert.equal(solver.inspect().colliders, 1);
  solver.dispose();
  assert.throws(() => solver.advance(1 / 60), /Disposed spring bones/);
});

/** A node with a place and a rotation of its own: enough for the owner to read a chain and turn it. */
function node(position, parent) {
  const turned = [];
  const n = {
    parent,
    turned,
    transform: {
      position: { x: position[0], y: position[1], z: position[2] },
      localRotation: { x: 0, y: 0, z: 0, w: 1 },
      _rotation: { x: 0, y: 0, z: 0, w: 1 },
      get rotation() {
        return this._rotation;
      },
      set rotation(q) {
        this._rotation = q;
        turned.push([q.x, q.y, q.z, q.w]);
      },
    },
  };
  return n;
}

test('the owner reads a chain off a model’s nodes, turns all but the last, and follows the clock', () => {
  const saved = globalThis.Laya;
  globalThis.Laya = {
    Quaternion: class {
      constructor(x, y, z, w) {
        Object.assign(this, { x, y, z, w });
      }
    },
  };
  try {
    const head = node([0, 2, 0]);
    const chain = [node([0, 2, -0.1], head)];
    for (let i = 1; i < 4; i++) chain.push(node([0, 2 - i * 0.1, -0.1], chain[i - 1]));
    const springs = new ZhudaSpringBones({
      chains: [{ nodes: chain, stiffness: 5 }],
      colliders: [
        { node: head, type: 'sphere', center: [0, -0.3, 0], radius: 0.12 },
        { type: 'plane', point: [0, 0, 0], normal: [0, 1, 0] },
      ],
    });
    // Laid out as the nodes are, but for the joint that was inside the body that
    // goes with the head: it is moved out of it there and then, a bone's length kept.
    assert.deepEqual(springs.solver.inspect(), {
      chains: 1,
      bones: 3,
      colliders: 2,
      steps: 0,
      dropped: 0,
      pendingSeconds: 0,
      inside: 0,
      kineticEnergy: 0,
    });
    const laid = Array.from(springs.solver.tails(1));
    laid.slice(0, 3).forEach((v, k) => assert.ok(Math.abs(v - [0, 1.9, -0.1][k]) < 1e-9));
    assert.ok(Math.hypot(laid[6], laid[7] - 1.7, laid[8]) >= 0.12 + 0.02 - 1e-6, 'out of the body');
    assert.ok(
      Math.abs(Math.hypot(laid[6] - laid[3], laid[7] - laid[4], laid[8] - laid[5]) - 0.1) < 1e-9,
    );
    const layers = new ZhudaLayeredClock();
    layers.advance(1 / 60);
    assert.deepEqual(springs.updateFrom(layers), { steps: 2, dropped: 0 });
    assert.deepEqual(
      chain.map((n) => n.turned.length),
      [1, 1, 1, 0],
      'every bone turned once, the end not at all',
    );
    // Paused: nothing runs and nothing is turned.
    layers.setPaused('world', true);
    layers.advance(1 / 60);
    assert.deepEqual(springs.updateFrom(layers), { steps: 0, dropped: 0 });
    assert.deepEqual(
      chain.map((n) => n.turned.length),
      [1, 1, 1, 0],
    );
    assert.throws(() => springs.updateFrom(layers, 'hair'), /Unknown time layer: hair/);
    // The body goes with its node: carried onto the chain, it pushes the joints away.
    head.transform.position.z = -0.1;
    head.transform.position.y = 2.2;
    for (let f = 0; f < 60; f++) springs.update(1 / 60);
    assert.equal(springs.solver.countInside(), 0);
    springs.reset();
    springs.dispose();
    springs.dispose();
    assert.throws(() => springs.update(1 / 60), /Disposed spring bones/);
    // What is not a chain is refused.
    assert.throws(() => new ZhudaSpringBones({}), /chains/);
    assert.throws(
      () => new ZhudaSpringBones({ chains: [{ nodes: [head] }] }),
      /a chain is 2 to 257 nodes/,
    );
    assert.throws(
      () => new ZhudaSpringBones({ chains: [{ nodes: [chain[0], chain[2]] }] }),
      /a child of the one before/,
    );
    assert.throws(
      () => new ZhudaSpringBones({ chains: [{ nodes: [head, node([0, 2.2, -0.1], head)] }] }),
      /two joints of a chain are in one place/,
    );
    assert.throws(
      () =>
        new ZhudaSpringBones({
          chains: [{ nodes: chain }],
          colliders: [{ node: head, type: 'plane', point: [0, 0, 0], normal: [0, 1, 0] }],
        }),
      /a sphere or a capsule/,
    );
  } finally {
    globalThis.Laya = saved;
  }
});
