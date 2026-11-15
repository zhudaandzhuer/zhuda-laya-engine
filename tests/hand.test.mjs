// A hand from numbers: its measurements against the proportions it was given,
// a closed skin, a mirror for the left hand, the pose, the refusals. Pure
// checks; the draw is verify:hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createZhudaHandMesh,
  validateZhudaHand,
  ZHUDA_HAND_FLAT,
  ZHUDA_HAND_RELAXED,
  ZHUDA_HAND_DIGITS,
  ZHUDA_HAND_MALE,
  ZHUDA_HAND_FEMALE,
  ZHUDA_HAND_GRACEFUL,
  createZhudaHandSurfaces,
  setZhudaHandSkinSpace,
} from '../packages/core/procedural/Hand.ts';

const each = (chunks, fn) => {
  for (const c of chunks)
    for (let i = 0; i < c.positions.length; i += 3) fn(c.positions.subarray(i, i + 3), c, i / 3);
};
/** From the wrist's crease to the furthest point, and the width across the knuckles' level. */
function measure(hand, length) {
  let top = -1,
    lo = 1,
    hi = -1;
  const band = 0.085 * (length / 0.185);
  each(hand.skin, (p) => {
    top = Math.max(top, p[1]);
    // The thumb is not part of a hand's breadth.
    if (Math.abs(p[1] - band) < 0.0015 && p[0] > -0.05 * (length / 0.185)) {
      lo = Math.min(lo, p[0]);
      hi = Math.max(hi, p[0]);
    }
  });
  return { length: top, breadth: hi - lo };
}
/** Edges left open and edges pinched (shared by more than two triangles). */
function topology(mesh) {
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const key = `${mesh.indices[i + k]}>${mesh.indices[i + ((k + 1) % 3)]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  let open = 0,
    pinched = 0;
  for (const [key, count] of edges) {
    const [a, b] = key.split('>');
    if (!edges.has(`${b}>${a}`)) open++;
    if (count > 1) pinched++;
  }
  return { open, pinched, edges: edges.size };
}
function closed(mesh) {
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const a = mesh.indices[i + k],
        b = mesh.indices[i + ((k + 1) % 3)];
      edges.set(`${a}>${b}`, (edges.get(`${a}>${b}`) ?? 0) + 1);
    }
  for (const [key, n] of edges) {
    const [a, b] = key.split('>');
    if (n !== 1 || edges.get(`${b}>${a}`) !== 1) return false;
  }
  return true;
}

const flat = createZhudaHandMesh({ pose: ZHUDA_HAND_FLAT });

test('a flat hand measures what it was given, within 3 mm', () => {
  const m = measure(flat, 0.185);
  assert.ok(Math.abs(m.length - 0.185) < 0.003, `length ${m.length}`);
  assert.ok(Math.abs(m.breadth - 0.082) < 0.003, `breadth ${m.breadth}`);
  const small = createZhudaHandMesh({ pose: ZHUDA_HAND_FLAT, length: 0.16, breadth: 0.074 });
  const s = measure(small, 0.16);
  assert.ok(Math.abs(s.length - 0.16) < 0.003, `length ${s.length}`);
  assert.ok(Math.abs(s.breadth - 0.074) < 0.003, `breadth ${s.breadth}`);
});

test('the fingers keep their order of length, as an adult hand does', () => {
  // Measured as a hand is, with the fingers together.
  const together = createZhudaHandMesh({
    pose: { ...ZHUDA_HAND_FLAT, spread: 0 },
    cellSize: 0.002,
  });
  const y = (d) => together.tips[d][1];
  assert.ok(y('middle') > y('ring') && y('ring') > y('index') && y('index') > y('little'));
  // The little finger's tip reaches about the ring finger's end joint.
  const ringEnd = together.joints.find((j) => j.digit === 'ring' && j.index === 2).position[1];
  assert.ok(Math.abs(y('little') - ringEnd) < 0.012);
  // The thumb's tip stays below the index's knuckle.
  const indexKnuckle = together.joints.find((j) => j.digit === 'index' && j.index === 0)
    .position[1];
  assert.ok(y('thumb') < indexKnuckle);
});

test('the skin is closed, in chunks the engine draws, with a tint and a thinness a vertex', () => {
  assert.ok(flat.skin.length >= 1);
  for (const chunk of flat.skin) {
    assert.ok(chunk.positions.length / 3 <= 65535 && chunk.indices instanceof Uint16Array);
    assert.equal(chunk.colors.length, (chunk.positions.length / 3) * 4);
  }
  // Whole, at a cell coarse enough to be one chunk: nothing left open. Where two fingers
  // touch, or a crease is narrower than a cell, a few edges pinch (fewer than one in a thousand).
  const coarse = createZhudaHandMesh({ pose: ZHUDA_HAND_FLAT, cellSize: 0.0016 });
  assert.equal(coarse.skin.length, 1);
  const t = topology(coarse.skin[0]);
  assert.equal(t.open, 0, 'no edge open');
  assert.ok(t.pinched < t.edges / 1000, `${t.pinched} pinched of ${t.edges}`);
  // Thin at the web and the fingers, thick in the palm.
  const thin = (x, y, z) => {
    let best = Infinity,
      value = 0;
    each(flat.skin, (p, c, i) => {
      const d = Math.hypot(p[0] - x, p[1] - y, p[2] - z);
      if (d < best) {
        best = d;
        value = c.colors[i * 4 + 3];
      }
    });
    return value;
  };
  const palm = thin(0, 0.05, 0.02);
  const finger = thin(
    ...flat.joints
      .find((j) => j.digit === 'middle' && j.index === 2)
      .position.map((v, k) => (k === 2 ? v + 0.02 : v)),
  );
  assert.ok(palm < 0.3, `palm ${palm}`);
  assert.ok(finger > palm * 1.5, `finger ${finger}`);
  assert.equal(flat.nails.positions.length / 3 > 1000, true);
  // A plate two to three cells thick can pinch where both of its faces cross one cell: no
  // edge is left open, and fewer than one in a thousand is shared by more than two triangles.
  const edges = new Map();
  const n = flat.nails;
  for (let i = 0; i < n.indices.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const key = `${n.indices[i + k]}>${n.indices[i + ((k + 1) % 3)]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  let open = 0,
    shared = 0;
  for (const [key, count] of edges) {
    const [a, b] = key.split('>');
    if (!edges.has(`${b}>${a}`)) open++;
    if (count > 1) shared++;
  }
  assert.equal(open, 0, 'no nail left open');
  assert.ok(shared < edges.size / 1000, `${shared} pinched edges of ${edges.size}`);
});

test('a nail sits on the back of its finger, above the skin', () => {
  for (const digit of ZHUDA_HAND_DIGITS) {
    const end = flat.joints.find((j) => j.digit === digit && j.index === 2).position;
    const tip = flat.joints.find((j) => j.digit === digit && j.index === 3).position;
    const mid = end.map((v, k) => (v + tip[k]) / 2);
    let near = Infinity;
    for (let i = 0; i < flat.nails.positions.length; i += 3)
      near = Math.min(
        near,
        Math.hypot(...[0, 1, 2].map((k) => flat.nails.positions[i + k] - mid[k])),
      );
    assert.ok(near < 0.012, `${digit}: a nail within 12 mm of the end bone (${near})`);
  }
});

test('the left hand is the right one in a mirror', () => {
  const left = createZhudaHandMesh({ pose: ZHUDA_HAND_FLAT, side: 'left' });
  assert.equal(left.side, 'left');
  for (const digit of ZHUDA_HAND_DIGITS) {
    const r = flat.tips[digit],
      l = left.tips[digit];
    assert.ok(
      Math.abs(l[0] + r[0]) < 1e-9 && Math.abs(l[1] - r[1]) < 1e-9 && Math.abs(l[2] - r[2]) < 1e-9,
    );
  }
  assert.ok(left.tips.thumb[0] > 0 && flat.tips.thumb[0] < 0);
});

test('bending the fingers brings their tips toward the palm, the little one most at rest', () => {
  const relaxed = createZhudaHandMesh({ pose: ZHUDA_HAND_RELAXED, cellSize: 0.002 });
  for (const f of ['index', 'middle', 'ring', 'little'])
    assert.ok(relaxed.tips[f][2] < flat.tips[f][2] - 0.01, f);
  const fist = createZhudaHandMesh({ pose: { index: [80, 95, 60] }, cellSize: 0.002 });
  assert.ok(fist.tips.index[1] < 0.12, 'a curled finger ends low');
  // Deterministic.
  const again = createZhudaHandMesh({ pose: ZHUDA_HAND_RELAXED, cellSize: 0.002 });
  assert.deepEqual(again.skin[0].positions, relaxed.skin[0].positions);
});

test("a man's and a woman's hand: sizes, finger length against the palm, nails past the tips", () => {
  const male = createZhudaHandMesh({ ...ZHUDA_HAND_MALE, pose: ZHUDA_HAND_FLAT, cellSize: 0.0016 });
  const female = createZhudaHandMesh({
    ...ZHUDA_HAND_FEMALE,
    pose: ZHUDA_HAND_FLAT,
    cellSize: 0.0016,
  });
  const mm = measure(male, ZHUDA_HAND_MALE.length),
    fm = measure(female, ZHUDA_HAND_FEMALE.length);
  // The length asked for holds whatever the fingers' share of it.
  assert.ok(Math.abs(mm.length - ZHUDA_HAND_MALE.length) < 0.003, `male length ${mm.length}`);
  assert.ok(Math.abs(fm.length - ZHUDA_HAND_FEMALE.length) < 0.003, `female length ${fm.length}`);
  assert.ok(mm.breadth > fm.breadth + 0.008, "the man's hand is broader");
  // The woman's fingers are the longer share of her hand.
  const share = (hand) => {
    const knuckle = hand.joints.find((j) => j.digit === 'middle' && j.index === 0).position;
    return (hand.tips.middle[1] - knuckle[1]) / hand.tips.middle[1];
  };
  assert.ok(share(female) > share(male) + 0.03, `${share(female)} against ${share(male)}`);
  // The nails: a woman's run several millimetres past the tip, a man's hardly.
  const past = (hand) => {
    let most = -1;
    const tip = hand.tips.middle,
      end = hand.joints.find((j) => j.digit === 'middle' && j.index === 2).position;
    const dir = tip.map((v, k) => v - end[k]);
    const l = Math.hypot(...dir);
    for (let i = 0; i < hand.nails.positions.length; i += 3) {
      const p = [0, 1, 2].map((k) => hand.nails.positions[i + k] - tip[k]);
      most = Math.max(most, (p[0] * dir[0] + p[1] * dir[1] + p[2] * dir[2]) / l);
    }
    return most;
  };
  assert.ok(past(female) > 0.003, `female nail past the tip by ${past(female)}`);
  assert.ok(past(male) < 0.0015, `male nail past the tip by ${past(male)}`);
  // A graceful pose bends the little finger most.
  const graceful = createZhudaHandMesh({
    ...ZHUDA_HAND_FEMALE,
    pose: ZHUDA_HAND_GRACEFUL,
    cellSize: 0.002,
  });
  assert.ok(graceful.tips.little[2] < graceful.tips.index[2]);
});

test('build refusals name the option', () => {
  const errors = validateZhudaHand({
    build: {
      fingerWidth: 2,
      taper: 0.1,
      fingerLength: 2,
      bone: -1,
      flesh: 3,
      nailFree: 1,
      nailRound: 2,
      veins: 5,
      tendons: 9,
      flush: 9,
      nailTone: [1, 2],
    },
  });
  for (const part of [
    'fingerWidth',
    'taper',
    'fingerLength',
    'bone',
    'flesh',
    'nailFree',
    'nailRound',
    'veins',
    'tendons',
    'flush',
    'nailTone',
  ])
    assert.ok(
      errors.some((e) => e.startsWith(`build.${part}`)),
      part,
    );
});

test('refusals name the option', () => {
  assert.deepEqual(validateZhudaHand({}), []);
  const errors = validateZhudaHand({
    side: 'middle',
    length: 0.5,
    breadth: 0.01,
    cellSize: 0.0001,
    forearm: 1,
    tone: [2, 0, 0],
    pose: { index: [0, 200, 0], thumb: [1, 2], spread: 40, thumbOut: -5 },
  });
  for (const part of [
    'side',
    'length',
    'breadth',
    'cellSize',
    'forearm',
    'tone',
    'pose.index[1]',
    'pose.thumb',
    'pose.spread',
    'pose.thumbOut',
  ])
    assert.ok(
      errors.some((e) => e.startsWith(part)),
      part,
    );
  assert.throws(() => createZhudaHandMesh({ length: 1 }), /Invalid hand: length/);
});

test('the hand surfaces: a skin and a nail spec, refusals named', () => {
  const { skin, nail } = createZhudaHandSurfaces({ name: 'TestHand', detail: 0.5 });
  assert.equal(skin.name, 'TestHandSkin');
  assert.equal(nail.name, 'TestHandNail');
  assert.ok(skin.surface.includes('s.vertexColor.a') && skin.surface.includes('dFdx'));
  assert.ok(skin.subsurface && skin.common);
  assert.deepEqual(skin.uniforms.u_ZhudaSkinX.value, [1, 0, 0, 0]);
  assert.throws(
    () => createZhudaHandSurfaces({ name: '1bad', detail: 5, roughness: 0 }),
    /name must be.*detail must be.*roughness must be/,
  );
});

test("the skin space: a point of the hand goes back to where it was, whatever the hand's place", () => {
  // A hand turned 40 degrees about y, scaled 1.5 and moved, in LayaAir's order.
  const c = Math.cos(0.7),
    sn = Math.sin(0.7),
    k = 1.5;
  const world = [c * k, 0, -sn * k, 0, 0, k, 0, 0, sn * k, 0, c * k, 0, 0.3, -0.2, 1.1, 1];
  const got = {};
  setZhudaHandSkinSpace({ set: (name, value) => (got[name] = value) }, world);
  const local = [0.01, 0.12, -0.004];
  const w = [0, 1, 2].map(
    (i) => world[i] * local[0] + world[4 + i] * local[1] + world[8 + i] * local[2] + world[12 + i],
  );
  const back = ['u_ZhudaSkinX', 'u_ZhudaSkinY', 'u_ZhudaSkinZ'].map(
    (n) => got[n][0] * w[0] + got[n][1] * w[1] + got[n][2] * w[2] + got[n][3],
  );
  back.forEach((v, i) => assert.ok(Math.abs(v - local[i]) < 1e-12));
  assert.throws(() => setZhudaHandSkinSpace({ set() {} }, [1, 2]), /16 numbers/);
  assert.throws(() => setZhudaHandSkinSpace({ set() {} }, Array(16).fill(0)), /cannot be inverted/);
});

test("the little finger's edge of the hand widens steadily from the wrist to the knuckle", () => {
  // The wrist's bones were once wider than the hand above them: a bulge, then a waist.
  for (const preset of [ZHUDA_HAND_MALE, ZHUDA_HAND_FEMALE]) {
    const hand = createZhudaHandMesh({ ...preset, pose: ZHUDA_HAND_FLAT, cellSize: 0.0016 });
    const knuckle = hand.joints.find((j) => j.digit === 'little' && j.index === 0).position[1];
    const edge = [];
    for (let y = 0.012; y < knuckle - 0.012; y += 0.004) {
      let most = -1;
      each(hand.skin, (p) => {
        if (Math.abs(p[1] - y) < 0.0012) most = Math.max(most, p[0]);
      });
      edge.push(most);
    }
    for (let i = 1; i < edge.length; i++)
      assert.ok(
        edge[i] > Math.max(...edge.slice(0, i)) - 0.0005,
        `${preset.length}: ${edge.map((v) => (v * 1000).toFixed(1))}`,
      );
  }
});
