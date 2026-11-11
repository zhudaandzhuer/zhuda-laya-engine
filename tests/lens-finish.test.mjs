import test from 'node:test';
import assert from 'node:assert/strict';
import { validateZhudaLensFinish, zhudaVignette } from '../packages/core/runtime3d/LensFinish.ts';

test('the vignette leaves the centre alone and darkens the corners smoothly', () => {
  assert.equal(zhudaVignette(0.5, 0, 0), 1);
  const edge = zhudaVignette(0.5, 1, 0),
    corner = zhudaVignette(0.5, 1, 1);
  assert.ok(edge < 1 && corner < edge, `${edge} ${corner}`);
  assert.ok(Math.abs(corner - (1 - 0.5 * 0.85)) < 1e-9, 'full strength at the corner');
  assert.equal(zhudaVignette(0, 1, 1), 1);
  let previous = 1;
  for (let r = 0; r <= 1; r += 0.05) {
    const value = zhudaVignette(1, r, r);
    assert.ok(value <= previous + 1e-12);
    previous = value;
  }
});

test('lens finish options are validated', () => {
  assert.deepEqual(validateZhudaLensFinish({}), []);
  assert.deepEqual(validateZhudaLensFinish({ grain: 0.3, vignette: 1, fringe: 0 }), []);
  const issues = validateZhudaLensFinish({ grain: 2, vignette: -1, fringe: 'x' });
  for (const key of ['grain', 'vignette', 'fringe'])
    assert.ok(
      issues.some((issue) => issue.startsWith(key + ':')),
      key,
    );
});
