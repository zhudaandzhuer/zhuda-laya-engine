import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prefilterZhudaEnvironment,
  evaluateZhudaAmbient,
  zhudaCubeDirection,
  zhudaCubeTexel,
} from '../packages/core/runtime3d/EnvironmentProbe.ts';

/** A cube picture from a function of the world direction. */
function cube(size, radiance) {
  const data = new Float32Array(size * size * 24);
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const d = zhudaCubeDirection(face, (2 * (i + 0.5)) / size - 1, (2 * (j + 0.5)) / size - 1);
        const length = Math.hypot(...d);
        const rgb = radiance(d.map((v) => v / length));
        data.set([...rgb, 1], (face * size * size + j * size + i) * 4);
      }
  return { size, data };
}

test('cube directions and texels are inverses on every face', () => {
  for (let face = 0; face < 6; face++)
    for (const [s, t] of [
      [0, 0],
      [0.6, -0.3],
      [-0.9, 0.8],
    ]) {
      const [f2, s2, t2] = zhudaCubeTexel(...zhudaCubeDirection(face, s, t));
      assert.equal(f2, face);
      assert.ok(Math.abs(s2 - s) < 1e-12 && Math.abs(t2 - t) < 1e-12);
    }
});

test('a uniform environment stays uniform and gives flat ambient', () => {
  const { spec, pixels } = prefilterZhudaEnvironment(
    cube(16, () => [0.5, 0.25, 1]),
    { size: 16, samples: 32 },
  );
  assert.equal(spec.levels.length, 5);
  assert.equal(
    pixels.length,
    spec.levels.reduce((n, level) => n + level.elements, 0),
  );
  for (let p = 0; p < pixels.length; p += 4) {
    assert.ok(
      Math.abs(pixels[p] - 0.5) < 1e-5 &&
        Math.abs(pixels[p + 1] - 0.25) < 1e-5 &&
        Math.abs(pixels[p + 2] - 1) < 1e-5,
    );
  }
  for (const n of [
    [1, 0, 0],
    [0, -1, 0],
    [0.6, 0.64, -0.48],
  ]) {
    const a = evaluateZhudaAmbient(spec.ambientSH, ...n);
    assert.ok(
      Math.abs(a[0] - 0.5) < 0.01 && Math.abs(a[1] - 0.25) < 0.01 && Math.abs(a[2] - 1) < 0.02,
      String(a),
    );
  }
});

test('a bright world direction lands mirrored in X and lights surfaces that face it', () => {
  // Bright toward world +X and, less, toward +Y.
  const world = cube(32, ([x, y]) => [x > 0.8 ? 10 : 0, y > 0.8 ? 4 : 0, 0]);
  const { spec, pixels } = prefilterZhudaEnvironment(world, { size: 16 });
  const centre = (face) => {
    const o = spec.levels[0].offset + (face * 256 + 8 * 16 + 8) * 4;
    return [pixels[o], pixels[o + 1]];
  };
  // Laya looks up (-x, y, z): world +X is stored on the -X face.
  assert.ok(centre(1)[0] > 9 && centre(0)[0] === 0, 'world +X is on the cube face -X');
  assert.ok(centre(2)[1] > 3.9 && centre(3)[1] === 0, '+Y stays on +Y');
  // Ambient: a surface facing +X is redder than one facing -X; up is greener than down.
  const ambient = (n) => evaluateZhudaAmbient(spec.ambientSH, ...n);
  assert.ok(ambient([1, 0, 0])[0] > ambient([-1, 0, 0])[0] + 0.5);
  assert.ok(ambient([0, 1, 0])[1] > ambient([0, -1, 0])[1] + 0.2);
  assert.ok(ambient([0, 0, 1])[0] < ambient([1, 0, 0])[0]);
});

test('rougher mips blur a small bright spot and keep its energy roughly', () => {
  const world = cube(32, ([x, y, z]) => (z > 0.98 ? [50, 50, 50] : [0, 0, 0]));
  const { spec, pixels } = prefilterZhudaEnvironment(world, { size: 32, samples: 128 });
  const peak = (m) => {
    const level = spec.levels[m];
    let max = 0;
    for (let p = level.offset; p < level.offset + level.elements; p += 4)
      max = Math.max(max, pixels[p]);
    return max;
  };
  assert.ok(peak(0) > 40);
  assert.ok(peak(2) < peak(0) && peak(4) < peak(2), `${peak(0)} ${peak(2)} ${peak(4)}`);
  // The last mip (one texel per face) is not zero on the +Z side and is dimmer elsewhere.
  const last = spec.levels[spec.levels.length - 1];
  const value = (face) => pixels[last.offset + face * 4];
  assert.ok(value(4) > value(5) && value(4) > 0);
});

test('bad input is refused', () => {
  assert.throws(
    () => prefilterZhudaEnvironment({ size: 4, data: new Float32Array(10) }),
    /Invalid cube picture/,
  );
  assert.throws(
    () =>
      prefilterZhudaEnvironment(
        cube(8, () => [1, 1, 1]),
        { size: 12 },
      ),
    /power of two/,
  );
  const bad = cube(8, () => [1, 1, 1]);
  bad.data[5] = NaN;
  assert.throws(() => prefilterZhudaEnvironment(bad, { size: 8 }), /negative or non-finite/);
});
