// 3d/layered-hosiery without a browser: the catalogue of stockings and bottoms is sound, the body
// file is what the module expects, the surface hooks keep the rules WebGPU holds them to, and the
// per-vertex layer (pull, relax, where a tear starts, the garment layer) behaves on the real body.
// What is drawn is checked in the viewer on a graphics card (the module's README says how).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/** Enough of LayaAir for ZhudaDynamicMesh: it lays the vertices out and uploads them, nothing is drawn. */
function fakeLaya() {
  class Node {
    transform = {};
    meshRenderer = {};
    constructor(mesh) {
      this.mesh = mesh;
    }
    destroy() {}
  }
  return {
    MeshSprite3D: Node,
    Vector3: class {
      constructor(x, y, z) {
        Object.assign(this, { x, y, z });
      }
    },
    Bounds: class {
      constructor(min, max) {
        Object.assign(this, { min, max });
      }
    },
    VertexMesh: { getVertexDeclaration: (text) => text },
    PrimitiveMesh: { _createMesh: (declaration, vertices, indices) => ({ declaration, vertices, indices, _vertexBuffer: { setData() {} }, destroy() {} }) },
  };
}
globalThis.Laya = fakeLaya();

const { TYPES, COLORS, tileOf, knitTile, netTile, display } = await import('../3d/layered-hosiery/patterns.ts');
const { BOTTOMS } = await import('../3d/layered-hosiery/bottoms.ts');
const { TEARS, TEAR_GLSL, TEAR_CALLS, TEAR_UNIFORMS, HOSIERY, GARMENT, SKIRT } = await import('../3d/layered-hosiery/shaders.ts');
const leg = await import('../3d/layered-hosiery/meshleg.ts');
const { BASE, TOP, SPAN, LT, toWorld, createLeg, createLayer, bridgeCrotch, pull, relax, offsetAt, outwardAt, tearOrigin, legTable, hipReach } = leg;
const file = JSON.parse(fs.readFileSync(new URL('../3d/layered-hosiery/assets/legs.json', import.meta.url), 'utf8'));

test('every kind of stocking can be torn before the pull runs out, and names known colours', () => {
  const ids = new Set();
  for (const type of TYPES) {
    assert.ok(!ids.has(type.id), `duplicate ${type.id}`);
    ids.add(type.id);
    assert.ok(type.tearAt > 0.5 && type.tearAt <= 1.1, `${type.id} tearAt ${type.tearAt}`);
    assert.ok(type.colors.length > 0 && type.colors.every((c) => c in COLORS), `${type.id} colours`);
    assert.ok(type.ladder >= 0 && type.ladder <= 1 && type.holeSize > 0);
    if (type.lace) assert.ok(type.lace[0] < type.lace[1] && type.lace[1] < 1);
    assert.ok(type.name && type.note, `${type.id} has a name and a note for the panel`);
  }
  assert.equal(TYPES.length, 15);
  for (const c of display(0x1c1a1e)) assert.ok(c >= 0 && c <= 1);
});

test('tiles are 128 square, the same every time, and a net has open holes', () => {
  for (const type of TYPES) {
    const tile = tileOf(type);
    assert.equal(tile.size, 128);
    assert.equal(tile.pixels.length, 128 * 128 * 4);
  }
  assert.deepEqual(knitTile(1).pixels, knitTile(1).pixels);
  const net = netTile(0.045).pixels;
  let open = 0;
  for (let i = 2; i < net.length; i += 4) if (net[i] < 8) open++;
  assert.ok(open / (128 * 128) > 0.5, `open share ${open / 16384}`);
  const knit = knitTile(1).pixels;
  let solid = 0;
  for (let i = 2; i < knit.length; i += 4) if (knit[i] > 64) solid++;
  assert.ok(solid / (128 * 128) > 0.2);
});

test('thirteen bottoms: skirts hang below the waist, garments end on the leg, ready-made rips lie on the garment', () => {
  assert.equal(BOTTOMS.length, 13);
  assert.equal(new Set(BOTTOMS.map((b) => b.id)).size, 13);
  assert.equal(BOTTOMS.filter((b) => b.spec.kind === 'none').length, 1);
  for (const { id, name, note, spec } of BOTTOMS) {
    assert.ok(name && typeof note === 'string', id);
    if (spec.kind === 'skirt') {
      assert.ok(spec.hem < TOP - 0.3 && spec.hem > BASE, `${id} hem ${spec.hem}`);
      assert.ok(spec.rows >= 8 && spec.windDrag > 0, id);
      if (spec.pattern) assert.ok(spec.color2 !== undefined, `${id}: a pattern needs its second colour`);
    }
    if (spec.kind === 'pants') {
      // Shorts end on the thigh; trousers go on just past the ankle (BASE).
      assert.ok(spec.from < 0.72 && spec.from >= BASE - 0.05, `${id} ends at ${spec.from}`);
      assert.ok(spec.tearAt > 0.5 && spec.tearAt <= 1.1 && spec.holeSize > 0 && spec.reach > 0, id);
      for (const rip of spec.rips ?? []) {
        assert.ok(Math.abs(rip.side) === 1 && rip.u >= 0 && rip.u <= 1, `${id} rip`);
        assert.ok(rip.y > spec.from && rip.y < TOP, `${id}: a rip at ${rip.y} is on the garment`);
      }
      assert.ok((spec.rips ?? []).length <= TEARS);
    }
  }
});

test('the hooks: one zhudaSurface each, twelve named tears, and no derivative where WGSL forbids it', () => {
  assert.equal(TEARS, 12);
  const uniforms = TEAR_UNIFORMS();
  assert.equal(Object.keys(uniforms).length, TEARS * 2 + 1);
  for (let i = 0; i < TEARS; i++) assert.ok(uniforms[`u_ZhudaTearPlace${i}`] && uniforms[`u_ZhudaTearShape${i}`]);
  assert.equal(uniforms.u_ZhudaTearCount.type, 'float');
  // The lit surface's shader contract includes starting values: all of one name must start the same.
  assert.deepEqual(TEAR_UNIFORMS(), uniforms);
  const calls = TEAR_CALLS('ladder').split('\n');
  assert.equal(calls.length, TEARS);
  calls.forEach((line, i) => assert.match(line, new RegExp(`^\\s*if \\(u_ZhudaTearCount > ${i}\\.5\\) zhudaTear\\(u_ZhudaTearPlace${i}, u_ZhudaTearShape${i},`)));
  for (const [name, hook] of Object.entries({ HOSIERY, GARMENT, SKIRT })) {
    assert.equal(hook.match(/void zhudaSurface\(inout ZhudaLitSurface s/g)?.length, 1, `${name} defines the hook once`);
    assert.equal((hook.match(/\{/g) || []).length, (hook.match(/\}/g) || []).length, `${name}: braces balance`);
    assert.ok(!/\$\{|undefined|NaN/.test(hook), `${name}: every number was written in`);
  }
  // zhudaTear runs under `if (count > i)`: a derivative there compiles on WebGL and fails on WebGPU
  // ("must only be called from uniform control flow"), and the material then draws without tears.
  assert.ok(!/\b(fwidth|dFdx|dFdy)\s*\(/.test(TEAR_GLSL), 'no derivative inside the tear functions');
  for (const [name, hook] of Object.entries({ HOSIERY, GARMENT })) {
    const body = hook.slice(hook.indexOf('void zhudaSurface('));
    const firstTear = body.indexOf('zhudaTear(');
    assert.ok(firstTear > 0, `${name} calls the tears`);
    assert.ok(/\b(fwidth|dFdx|dFdy)\s*\(/.test(body.slice(0, firstTear)), `${name} takes its derivatives before the tears`);
  }
});

test('the body file: two legs of the modelled mesh, a stocking shape outside the skin, the joints the module reads', () => {
  assert.match(file.source, /MPFB/);
  assert.deepEqual(file.legs.map((l) => l.side).sort(), [-1, 1]);
  assert.ok(Array.isArray(file.joints.crotch) && file.joints.crotch[1] > 0.7 && file.joints.crotch[1] < 0.8);
  for (const l of file.legs) {
    const n = l.positions.length / 3;
    assert.ok(Number.isInteger(n) && n > 7000 && n < 65535, `${n} vertices fit one dynamic mesh`);
    assert.equal(l.normals.length, n * 3);
    assert.equal(l.sock.length, n * 3);
    assert.equal(l.indices.length % 3, 0);
    assert.ok(l.indices.length / 3 > 15000);
    assert.ok(l.indices.every((i) => i >= 0 && i < n));
    let low = Infinity,
      high = -Infinity,
      far = 0,
      outward = 0;
    for (let i = 0; i < n; i++) {
      low = Math.min(low, l.positions[i * 3 + 1]);
      high = Math.max(high, l.positions[i * 3 + 1]);
      // Each leg stays on its side of the midline (the split left no vertex across it).
      assert.ok(l.positions[i * 3] * l.side >= -1e-6);
      const d = [0, 1, 2].map((k) => l.sock[i * 3 + k] - l.positions[i * 3 + k]);
      far = Math.max(far, Math.hypot(...d));
      if (d[0] * l.normals[i * 3] + d[1] * l.normals[i * 3 + 1] + d[2] * l.normals[i * 3 + 2] >= -1e-6) outward++;
    }
    assert.ok(low >= 0 && low < 0.01, `soles on the floor (${low})`);
    assert.ok(Math.abs(high - file.waist) < 0.001, `cut at the waistband (${high})`);
    assert.ok(far < 0.005, `the stocking is within 5 mm of the skin (${far})`);
    assert.ok(outward / n > 0.99, `the stocking is outside the skin (${outward / n})`);
  }
});

const scene = { addChild() {} };
const legs = [-1, 1].map((side) => createLeg(scene, file.legs.find((l) => l.side === side)));
// The front of the thigh, half way up it.
const U = 0.5,
  V = (0.2 - BASE) / SPAN;

test('a leg: the texture goes once round it, and where it wraps at the back the vertices are copied with u + 1', () => {
  for (const l of legs) {
    assert.equal(l.rest.length, l.count * 3);
    let twins = 0;
    for (let i = 0; i < l.count; i++) {
      const u = l.uvs[i * 2],
        twin = l.twinOf[i];
      assert.ok(Number.isFinite(l.turn[i]) && Number.isFinite(l.ys[i]));
      if (twin < 0) assert.ok(u >= 0 && u <= 1, `u ${u}`);
      else {
        twins++;
        assert.ok(Math.abs(u - (l.uvs[twin * 2] + 1)) < 1e-6 && l.uvs[i * 2 + 1] === l.uvs[twin * 2 + 1], 'a copy carries its original one turn on');
        assert.deepEqual(Array.from(l.rest.subarray(i * 3, i * 3 + 3)), Array.from(l.rest.subarray(twin * 3, twin * 3 + 3)));
      }
    }
    assert.ok(twins > 50 && twins < l.count * 0.05, `${twins} copies along the back seam`);
    assert.ok(l.count < 65535);
  }
});

test('a pull lifts the layer off the front of the thigh, leaves the foot and the back alone, and relax puts it back', () => {
  for (const l of legs) {
    assert.deepEqual(offsetAt(l, U, V), [0, 0, 0]);
    const out = outwardAt(l, U, V);
    assert.ok(Math.abs(Math.hypot(...out) - 1) < 1e-3 && out[2] > 0.9, `the front faces +z (${out})`);
    pull(l, 1, U, V, null);
    const pulled = offsetAt(l, U, V);
    // A full pull is 1.17 units times the surface's reach (1 for a stocking), straight out.
    assert.ok(Math.abs(Math.hypot(...pulled) - 1.17 * l.reach) < 0.05, `pulled ${pulled}`);
    assert.ok(pulled[2] > 1.1 && Math.abs(pulled[0]) < 0.05);
    let moved = 0;
    for (let i = 0; i < l.count; i++) {
      const d = Math.hypot(l.current[i * 3] - l.rest[i * 3], l.current[i * 3 + 1] - l.rest[i * 3 + 1], l.current[i * 3 + 2] - l.rest[i * 3 + 2]);
      if (d < 1e-6) continue;
      moved++;
      assert.ok(l.ys[i] >= BASE, 'the foot does not move');
      assert.ok(Math.abs(Math.atan2(Math.sin(l.turn[i]), Math.cos(l.turn[i]))) <= 1.7, 'the back of the leg does not move');
    }
    assert.ok(moved > 300 && moved < l.count * 0.2, `a pull is local: ${moved} of ${l.count} vertices`);
    assert.ok(l.current.every(Number.isFinite));
    assert.ok(Math.max(...l.strain) > 1, 'the stretch is recorded for the hook and for where a tear starts');
    const [tu, tv] = tearOrigin(l, U, V);
    assert.ok(Math.abs(tu - U) < 0.03 && Math.abs(tv - V) < 0.03, `a tear starts at the grip's most stretched point (${tu}, ${tv})`);
    // Toward a direction: the layer follows the finger, here to +x and a little up.
    pull(l, 1, U, V, [1, 0.2, 0.3]);
    const sideways = offsetAt(l, U, V);
    assert.ok(sideways[0] > 1 && sideways[1] > 0.1, `pulled sideways ${sideways}`);
    relax(l);
    assert.deepEqual(offsetAt(l, U, V), [0, 0, 0]);
    assert.deepEqual(Array.from(l.current), Array.from(l.rest));
    assert.equal(Math.max(...l.strain.map(Math.abs)), 0);
  }
});

test('the legs as bodies for cloth and as hips for a skirt', () => {
  for (const l of legs) {
    const table = legTable(l, -0.6, 0.015);
    assert.equal(table.type, 'table');
    assert.equal(table.radii.length, table.rows * table.columns);
    assert.ok(table.height > 0.5 && table.radii.every((r) => Number.isFinite(r) && r > 0 && r < 0.3), 'radii in metres');
    assert.ok(Math.sign(table.origin[0]) === l.side, 'each table stands on its own side');
  }
  // Round the hips, in leg units, front / right / back / left.
  const at = (y) => [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => hipReach(legs, y, angle));
  const waist = at(TOP - 0.3),
    seat = at(1.2);
  for (const ring of [waist, seat]) {
    assert.ok(ring.every((r) => r > 0 && r < 1), `${ring}`);
    assert.ok(Math.abs(ring[1] - ring[3]) < 0.01, 'left and right agree');
  }
  assert.ok(seat[1] > waist[1] + 0.1 && seat[2] > waist[2] + 0.1, `the seat is wider and deeper than the waist (${waist} / ${seat})`);
  assert.equal(toWorld(0, BASE - 0.38, 0)[1], 0);
  assert.ok(Math.abs(toWorld(0, TOP, 0)[1] - file.waist) < 0.035, 'the waistband in metres is where the mesh was cut');
});

test('a garment layer stands off the leg by its fit and is pulled on its own', () => {
  const fit = () => 0.05;
  const layers = legs.map((l) => createLayer(scene, l, fit, 0.6));
  bridgeCrotch(legs, layers, fit);
  layers.forEach((layer, k) => {
    const l = legs[k];
    assert.equal(layer.count, l.count);
    assert.equal(layer.reach, 0.6);
    assert.notEqual(layer.hosiery, l.hosiery);
    // On the thigh the garment lies outside the stocking: 0.05 off the skin against the stocking's 0.011.
    let seen = 0;
    for (let i = 0; i < l.count; i += 3) {
      if (l.ys[i] < 0 || l.ys[i] > 0.6) continue;
      seen++;
      const d = [0, 1, 2].map((c) => layer.rest[i * 3 + c] - l.rest[i * 3 + c]);
      assert.ok(d[0] * l.outX[i] + d[2] * l.outZ[i] > 0 && Math.hypot(...d) > 0.03, `vertex ${i} is ${Math.hypot(...d)} outside`);
    }
    assert.ok(seen > 100);
    pull(layer, 1, U, V, null);
    assert.ok(Math.abs(Math.hypot(...offsetAt(layer, U, V)) - 1.17 * 0.6) < 0.05, 'a garment is carried as far as its reach');
    assert.deepEqual(offsetAt(l, U, V), [0, 0, 0], 'the stocking under it did not move');
    relax(layer);
  });
});
