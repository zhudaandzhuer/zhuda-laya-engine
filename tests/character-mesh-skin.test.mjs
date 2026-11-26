// games/tools/characters/mesh-skin.mjs: reading a mesh that was not made here, finding which of
// its vertices are one place and which pieces hang together, and weights from the bones' places.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readGlbMesh,
  weld,
  neighboursOf,
  connected,
  skinByDistance,
  shareAlongLimb,
} from '../games/tools/characters/mesh-skin.mjs';
import { writeRiggedGlb } from '../games/tools/characters/rig-glb.mjs';

// A square tube along x from 0 to 1 in `rings` rings, every ring's corners written twice (a seam).
function tube(rings = 11, offset = [0, 0, 0]) {
  const positions = [],
    indices = [],
    corner = [
      [0.1, 0.1],
      [-0.1, 0.1],
      [-0.1, -0.1],
      [0.1, -0.1],
    ];
  for (let r = 0; r < rings; r++)
    for (let c = 0; c < 4; c++)
      for (let twice = 0; twice < 2; twice++)
        positions.push(
          r / (rings - 1) + offset[0],
          corner[c][0] + offset[1],
          corner[c][1] + offset[2],
        );
  for (let r = 0; r + 1 < rings; r++)
    for (let c = 0; c < 4; c++) {
      const a = (r * 4 + c) * 2,
        b = (r * 4 + ((c + 1) % 4)) * 2 + 1,
        d = ((r + 1) * 4 + c) * 2,
        e = ((r + 1) * 4 + ((c + 1) % 4)) * 2 + 1;
      indices.push(a, d, b, b, d, e);
    }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

test('a seam is one place, and pieces that do not touch are apart', () => {
  const one = tube(),
    two = tube(5, [0, 1, 0]);
  const positions = Float32Array.from([...one.positions, ...two.positions]);
  const indices = Uint32Array.from([
    ...one.indices,
    ...Array.from(two.indices, (i) => i + one.positions.length / 3),
  ]);
  const { place, places } = weld(positions);
  assert.equal(places.length / 3, (11 + 5) * 4, 'each corner is written twice and is one place');
  assert.equal(place[0], place[1]);
  const { piece, pieces } = connected(indices, place, places.length / 3);
  assert.equal(pieces.length, 2);
  assert.deepEqual(
    pieces.map((p) => p.triangles),
    [80, 32],
    'largest first',
  );
  assert.equal(piece[place[0]], 0);
  assert.equal(piece[place[one.positions.length / 3]], 1);
  const near = neighboursOf(indices, place, places.length / 3);
  assert.ok(near.every((list) => list.length >= 3 && new Set(list).size === list.length));
});

test('weights go to the nearer bone, sum to one, and four joints hold a place at most', () => {
  const { positions, indices } = tube(),
    { place, places } = weld(positions);
  const bones = [0, 1, 2, 3, 4].map((j) => ({
    joint: j,
    from: [j / 5, 0, 0],
    to: [(j + 1) / 5, 0, 0],
  }));
  const skin = skinByDistance(places, bones, {
    neighbours: neighboursOf(indices, place, places.length / 3),
    smooth: 2,
  });
  for (let p = 0; p < places.length / 3; p++) {
    const w = [...skin.weights.subarray(p * 4, p * 4 + 4)];
    assert.ok(Math.abs(w.reduce((s, v) => s + v, 0) - 1) < 1e-5, 'sum to one');
    assert.ok(w[0] >= w[1] && w[1] >= w[2] && w[2] >= w[3], 'most first');
    // The middle of a bone's stretch is held most by that bone.
    const x = places[p * 3];
    if (Math.abs(((x * 5) % 1) - 0.5) < 0.05)
      assert.equal(skin.joints[p * 4], Math.min(4, Math.floor(x * 5)));
  }
  // Between two bones the weight is shared: no place right at a joint is held by one bone alone.
  const atJoint = [...Array(places.length / 3).keys()].filter(
    (p) => Math.abs(places[p * 3] - 0.4) < 1e-6,
  );
  assert.ok(atJoint.length && atJoint.every((p) => skin.weights[p * 4] < 0.7));
});

test('a bone holds only as far as its reach, and only what it may', () => {
  const places = Float32Array.from([0, 0.04, 0, 0, 0.3, 0, 1, 0.02, 0]);
  const bones = [
    { joint: 0, from: [0, 0, 0], to: [1, 0, 0] },
    { joint: 1, from: [0, 0.05, 0], to: [0.1, 0.05, 0], reach: 0.1 },
  ];
  const skin = skinByDistance(places, bones);
  assert.equal(skin.joints[0], 1, 'within reach, and nearer');
  assert.deepEqual(
    [skin.joints[4], skin.weights[4]],
    [0, 1],
    'out of reach: the other bone holds it all',
  );
  const refused = skinByDistance(places, bones, { allowed: (p, b) => b === 0 });
  assert.deepEqual([...refused.weights.subarray(0, 2)], [1, 0]);
  assert.throws(
    () => skinByDistance(places, [bones[1]], { allowed: () => false }),
    /may take no bone/,
  );
});

test('a loose piece moves whole', () => {
  const { positions } = tube(3);
  const { places } = weld(positions),
    rigid = new Uint32Array(places.length / 3).fill(7);
  const skin = skinByDistance(
    places,
    [
      { joint: 0, from: [0, 0, 0], to: [0.2, 0, 0] },
      { joint: 1, from: [0.8, 0, 0], to: [1, 0, 0] },
    ],
    { rigid },
  );
  for (let p = 1; p < places.length / 3; p++)
    assert.deepEqual(
      [...skin.weights.subarray(p * 4, p * 4 + 4)],
      [...skin.weights.subarray(0, 4)],
    );
});

test("a limb's weights are shared out along it to the joints laid on it", () => {
  const { positions } = tube(),
    { places } = weld(positions),
    count = places.length / 3;
  const skin = { joints: new Uint8Array(count * 4), weights: new Float32Array(count * 4) };
  for (let p = 0; p < count; p++) skin.weights[p * 4] = 1;
  shareAlongLimb(places, skin, { joint: 0, from: [0, 0, 0], to: [1, 0, 0] }, [
    { joint: 0, at: 0.2 },
    { joint: 5, at: 0.6 },
    { joint: 6, at: 1 },
  ]);
  const of = (x, joint) => {
    const p = [...Array(count).keys()].find((i) => Math.abs(places[i * 3] - x) < 1e-6);
    const k = [0, 1, 2, 3].find(
      (s) => skin.joints[p * 4 + s] === joint && skin.weights[p * 4 + s] > 0,
    );
    return k === undefined ? 0 : skin.weights[p * 4 + k];
  };
  assert.equal(of(0.1, 0), 1, "before the first stop: all the limb's own");
  assert.ok(
    Math.abs(of(0.4, 0) - 0.5) < 1e-5 && Math.abs(of(0.4, 5) - 0.5) < 1e-5,
    'half way between two stops: half each',
  );
  assert.ok(Math.abs(of(0.8, 5) - 0.5) < 1e-5 && Math.abs(of(0.8, 6) - 0.5) < 1e-5);
  assert.equal(of(1, 6), 1);
});

test('a .glb is read back as it was written, with its material and images', () => {
  const { positions, indices } = tube(3),
    count = positions.length / 3;
  const joints = new Uint8Array(count * 4),
    weights = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) weights[v * 4] = 1;
  const uvs = Float32Array.from({ length: count * 2 }, (_, i) => (i % 7) / 7);
  const normals = Float32Array.from({ length: count * 3 }, (_, i) => (i % 3 === 1 ? 1 : 0));
  const image = { mime: 'image/png', bytes: Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]) };
  const bytes = writeRiggedGlb({
    name: 't',
    joints: [{ name: 'root', parent: -1, position: [0, 0, 0] }],
    primitives: [{ positions, normals, uvs, joints, weights, indices, material: 0 }],
    materials: [
      {
        name: 'm',
        color: [1, 1, 1, 1],
        metallic: 1,
        roughness: 1,
        doubleSided: true,
        textures: { baseColor: 0 },
      },
    ],
    images: [image],
  });
  const read = readGlbMesh(new Uint8Array(bytes));
  assert.deepEqual([...read.positions], [...positions]);
  assert.deepEqual([...read.indices], [...indices]);
  assert.deepEqual([...read.uvs], [...uvs]);
  assert.equal(read.tangents, null);
  assert.equal(read.material.doubleSided, true);
  assert.deepEqual(read.textures.baseColor, 0);
  assert.deepEqual([...read.images[0].bytes], [...image.bytes]);
  assert.throws(() => readGlbMesh(new Uint8Array(16)), /Not a \.glb/);
});
