import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveZhudaPhotoMaterial,
  validateZhudaPhotoMaterial,
} from '../packages/core/procedural/PhotoMaterial.ts';

/** A grey picture with one dark vertical groove and one dark horizontal groove. */
function grooved(width, height) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dark = Math.abs(x - width / 2) < 2 || Math.abs(y - height / 4) < 2;
      const o = (y * width + x) * 4;
      rgba[o] = rgba[o + 1] = rgba[o + 2] = dark ? 30 : 150;
      rgba[o + 3] = 255;
    }
  return rgba;
}
const options = {
  id: 'test-stone',
  tileMeters: [1, 1],
  size: 64,
  reliefMm: 10,
  seam: 0,
  flatten: 0,
};

test('a flat picture gives a flat surface', () => {
  const rgba = new Uint8Array(32 * 32 * 4).fill(128);
  const set = deriveZhudaPhotoMaterial(rgba, 32, 32, options);
  assert.equal(set.size, 64);
  assert.equal(set.albedo.length, 64 * 64 * 4);
  for (let p = 0; p < 64 * 64; p++) {
    assert.equal(set.normal[p * 4], 128);
    assert.equal(set.normal[p * 4 + 1], 128);
    assert.equal(set.normal[p * 4 + 2], 255);
    assert.equal(set.albedo[p * 4], 128);
  }
  assert.ok(Math.max(...set.height) - Math.min(...set.height) < 1e-9);
});

test('dark grooves are low, rough and tilt the normals toward them', () => {
  const set = deriveZhudaPhotoMaterial(grooved(64, 64), 64, 64, options);
  const at = (x, y) => y * 64 + x;
  const groove = set.height[at(32, 40)],
    face = set.height[at(12, 40)];
  assert.ok(groove < face - 0.004, `groove ${groove} is lower than the face ${face}`);
  assert.ok(Math.abs(Math.min(...set.height) + 0.01) < 0.002, 'depth follows reliefMm');
  // Smoothness (alpha of the metallic-gloss map) is lower in the groove.
  assert.ok(set.metallicGloss[at(32, 40) * 4 + 3] < set.metallicGloss[at(12, 40) * 4 + 3]);
  // Left of the vertical groove the surface slopes down toward +x: normal.x > 0.
  assert.ok(set.normal[at(29, 40) * 4] > 140, 'left bank leans toward the groove');
  assert.ok(set.normal[at(35, 40) * 4] < 116, 'right bank leans the other way');
  // The horizontal groove tilts v: opposite signs for the two conventions.
  const gl = deriveZhudaPhotoMaterial(grooved(64, 64), 64, 64, {
    ...options,
    normalConvention: 'opengl',
  });
  const dx = set.normal[at(12, 13) * 4 + 1] - 128,
    ogl = gl.normal[at(12, 13) * 4 + 1] - 128;
  assert.ok(Math.abs(dx) > 10 && Math.sign(dx) === -Math.sign(ogl));
  assert.equal(gl.normalConvention, 'opengl');
});

test('the seam option makes opposite edges meet and the result is deterministic', () => {
  const rgba = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const o = (y * 64 + x) * 4;
      rgba[o] = rgba[o + 1] = rgba[o + 2] = 40 + x * 3; // dark on the left, bright on the right
      rgba[o + 3] = 255;
    }
  const raw = deriveZhudaPhotoMaterial(rgba, 64, 64, options);
  const joined = deriveZhudaPhotoMaterial(rgba, 64, 64, { ...options, seam: 0.1 });
  const gap = (set) => Math.abs(set.albedo[(20 * 64 + 0) * 4] - set.albedo[(20 * 64 + 63) * 4]);
  assert.ok(gap(raw) > 100, 'the raw picture has a visible seam');
  assert.ok(gap(joined) <= 2, 'the blended picture wraps');
  // The middle is untouched.
  assert.equal(joined.albedo[(20 * 64 + 32) * 4], raw.albedo[(20 * 64 + 32) * 4]);
  const again = deriveZhudaPhotoMaterial(rgba, 64, 64, { ...options, seam: 0.1 });
  assert.deepEqual([...again.normal.subarray(0, 256)], [...joined.normal.subarray(0, 256)]);
});

test('flatten evens out a broad gradient but keeps fine detail', () => {
  const rgba = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const o = (y * 128 + x) * 4;
      const value = 90 + 60 * Math.sin((x / 128) * Math.PI * 2) + (x % 8 < 1 ? -50 : 0);
      rgba[o] = rgba[o + 1] = rgba[o + 2] = Math.max(0, value);
      rgba[o + 3] = 255;
    }
  const spread = (set) => {
    const a = set.albedo[(64 * 128 + 28) * 4],
      b = set.albedo[(64 * 128 + 92) * 4];
    return Math.abs(a - b);
  };
  const base = { id: 'x', tileMeters: [2, 2], size: 128, seam: 0 };
  const kept = deriveZhudaPhotoMaterial(rgba, 128, 128, { ...base, flatten: 0 });
  const evened = deriveZhudaPhotoMaterial(rgba, 128, 128, { ...base, flatten: 1 });
  assert.ok(spread(evened) < spread(kept) * 0.5, `${spread(evened)} against ${spread(kept)}`);
  // The thin dark lines are still much darker than their neighbours.
  assert.ok(evened.albedo[(64 * 128 + 28) * 4] - evened.albedo[(64 * 128 + 32) * 4] > 30);
});

test('options and pixel data are validated', () => {
  assert.deepEqual(validateZhudaPhotoMaterial({ id: 'ok', tileMeters: [1, 1] }), []);
  const issues = validateZhudaPhotoMaterial({
    id: 'Bad Name',
    tileMeters: [1],
    size: 100,
    reliefMm: -1,
    detail: 1,
    seam: 0.5,
    roughness: [2, 0],
  });
  for (const key of ['id', 'tileMeters', 'size', 'reliefMm', 'detail', 'seam', 'roughness'])
    assert.ok(
      issues.some((issue) => issue.startsWith(key + ':')),
      key,
    );
  assert.throws(
    () => deriveZhudaPhotoMaterial(new Uint8Array(10), 32, 32, options),
    /does not match/,
  );
  assert.throws(() => deriveZhudaPhotoMaterial(new Uint8Array(4 * 16), 4, 4, options), /8\.\.8192/);
});
