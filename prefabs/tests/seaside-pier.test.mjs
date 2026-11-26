// 3d/seaside-pier: the four files hold the nodes and the triangles the module says, carry no
// textures, and the places in the module agree with the models (the pier's deck, the raft).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOCK, GEAR_BONE, PIER_END, RAFT, SEA, SEA_TALL, SEASIDE_FILES, SEASIDE_LOOK, WATER_Y, seasidePath, seasideWater } from '../3d/seaside-pier/seaside-pier.ts';

function readGlb(file) {
  const bytes = fs.readFileSync(new URL(`../3d/seaside-pier/assets/${file}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${file} is a GLB`);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  return { bytes, json };
}
/** The box of a named root node's meshes, in the model's own coordinates. */
function boxOf(json, name) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const visit = (index, offset) => {
    const node = json.nodes[index], t = node.translation ?? [0, 0, 0], at = offset.map((v, k) => v + t[k]);
    if (node.mesh !== undefined)
      for (const primitive of json.meshes[node.mesh].primitives) {
        const a = json.accessors[primitive.attributes.POSITION];
        for (let k = 0; k < 3; k++) (lo[k] = Math.min(lo[k], a.min[k] + at[k])), (hi[k] = Math.max(hi[k], a.max[k] + at[k]));
      }
    for (const child of node.children ?? []) visit(child, at);
  };
  visit(json.nodes.findIndex((n) => n.name === name), [0, 0, 0]);
  return { lo, hi };
}

test('each file holds its root nodes and its triangles, and no texture', () => {
  let total = 0;
  for (const [id, entry] of Object.entries(SEASIDE_FILES)) {
    const { json, bytes } = readGlb(entry.file);
    const roots = json.scenes.flatMap((s) => s.nodes).map((n) => json.nodes[n].name).sort();
    assert.deepEqual(roots, [...entry.nodes].sort(), id);
    const triangles = json.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + json.accessors[p.indices].count / 3, 0);
    assert.equal(triangles, entry.triangles, id);
    assert.equal((json.images ?? []).length, 0, `${id}: colours are materials, not pictures`);
    assert.ok(bytes.length < 320_000, `${id}: ${bytes.length} bytes`);
    assert.equal(seasidePath(id), `common/3d/seaside-pier/assets/${entry.file}`);
    total += triangles;
  }
  assert.equal(total, 27302);
});

test('the places in the module are where the models are', () => {
  const { json } = readGlb('dock.glb');
  const dock = boxOf(json, 'dock'), raft = boxOf(json, 'raft');
  // The deck's top is the pier's highest wide surface: posts may stand a little above it.
  assert.ok(dock.hi[1] >= DOCK.top && dock.hi[1] < DOCK.top + 0.8, `dock top ${dock.hi[1]}`);
  assert.ok(dock.lo[0] < DOCK.x0 + 0.5 && dock.hi[0] > DOCK.x1 - 0.5, `dock x ${dock.lo[0]}..${dock.hi[0]}`);
  // The raft floats where RAFT says, on the water.
  const middle = [(raft.lo[0] + raft.hi[0]) / 2, (raft.lo[2] + raft.hi[2]) / 2];
  assert.ok(Math.hypot(middle[0] - RAFT.x, middle[1] - RAFT.z) < 0.4, `raft middle ${middle}`);
  assert.ok(raft.lo[1] < WATER_Y + 0.1 && raft.hi[1] > WATER_Y, 'the raft sits in the water');
  assert.ok(PIER_END[0] < DOCK.x1 && PIER_END[0] > DOCK.x0 && PIER_END[2] > DOCK.z0 && PIER_END[2] < DOCK.z1);
  for (const sea of [SEA, SEA_TALL]) assert.ok(sea.minX > DOCK.x1 && sea.maxX > sea.minX && sea.maxZ > sea.minZ, 'the open water is beyond the pier');
});

test('the props are modelled on their own origins, and every piece of gear names a bone', () => {
  const { json } = readGlb('props.glb');
  const pole = boxOf(json, 'pole'), ring = boxOf(json, 'ring');
  assert.ok(Math.abs(pole.hi[1] - pole.lo[1] - 1) < 0.08, `the pole is a metre along +Y: ${pole.hi[1] - pole.lo[1]}`);
  assert.ok(Math.abs(ring.hi[0] - ring.lo[0] - 0.84) < 0.03, `the ring is 0.84 m across outside: ${ring.hi[0] - ring.lo[0]}`);
  assert.ok(ring.hi[1] - ring.lo[1] < 0.3, 'the ring lies flat');
  assert.deepEqual(Object.keys(GEAR_BONE).sort(), [...SEASIDE_FILES.gear.nodes].sort());
  for (const bone of Object.values(GEAR_BONE)) assert.ok(['head', 'spine'].includes(bone));
});

test('the look and the water are plain data a game can spread into the engine calls', () => {
  assert.equal(SEASIDE_LOOK.preset, 'day');
  assert.equal(seasideWater().resolution, 1024);
  assert.equal(seasideWater(true).resolution, 512);
  assert.equal(seasideWater().position[1], WATER_Y);
});
