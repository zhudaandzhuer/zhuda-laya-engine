import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zhudaMirrorProjection,
  validateZhudaReflectiveSurface,
} from '../packages/core/shaders/ReflectiveSurface.ts';

const apply = (columns, p) =>
  [0, 1, 3].map(
    (row) =>
      columns[0][row] * p[0] + columns[1][row] * p[1] + columns[2][row] * p[2] + columns[3][row],
  );

test('the mirror projection sends a point and its reflection to matching places', () => {
  const eye = [1, 3, 8],
    target = [0, 0.5, -4],
    planeY = 0.25,
    fov = 40,
    aspect = 16 / 9;
  const mirror = zhudaMirrorProjection(eye, target, planeY, fov, aspect);
  // The same camera, not mirrored: reflect the inputs back through the plane.
  const direct = zhudaMirrorProjection(
    [eye[0], 2 * planeY - eye[1], eye[2]],
    [target[0], 2 * planeY - target[1], target[2]],
    planeY,
    fov,
    aspect,
  );
  // The target is at the centre of the direct view.
  const [tx, ty, tw] = apply(direct, target);
  assert.ok(Math.abs(tx / tw) < 1e-9 && Math.abs(ty / tw) < 1e-9 && tw > 0);
  // A point above the plane seen by the mirrored camera lands where its
  // reflection lands for the real camera, with the vertical axis flipped.
  for (const p of [
    [2, 2.5, -6],
    [-3, 7, -20],
    [0.5, 0.3, 2],
  ]) {
    const [mx, my, mw] = apply(mirror, p);
    const [dx, dy, dw] = apply(direct, [p[0], 2 * planeY - p[1], p[2]]);
    assert.ok(mw > 0 && Math.abs(mw - dw) < 1e-9);
    assert.ok(Math.abs(mx / mw - dx / dw) < 1e-9, 'same horizontal place');
    assert.ok(Math.abs(my / mw + dy / dw) < 1e-9, 'mirrored vertical place');
  }
  // A point on the plane is the same point for both cameras.
  const on = [4, planeY, -3];
  const [ax, , aw] = apply(mirror, on),
    [bx, , bw] = apply(direct, on);
  assert.ok(Math.abs(ax / aw - bx / bw) < 1e-9);
  // The field of view and aspect scale the picture.
  const edge = [eye[0], planeY, eye[2] - 10];
  const wide = apply(zhudaMirrorProjection(eye, edge, planeY, 90, 1), [
    eye[0] + 10,
    2 * planeY - eye[1],
    eye[2] - 10,
  ]);
  assert.ok(
    Math.abs(Math.abs(wide[0] / wide[2]) - 1) < 0.35,
    'a 90 degree view reaches 45 degrees to the side',
  );
  // Looking straight down stays finite.
  const down = zhudaMirrorProjection([0, 5, 0], [0, 0, 0], 0, 40, 1);
  assert.ok(down.flat().every(Number.isFinite));
});

test('reflective surface options are validated', () => {
  assert.deepEqual(validateZhudaReflectiveSurface({ position: [0, 0, 0], size: [10, 10] }), []);
  const issues = validateZhudaReflectiveSurface({
    position: [0, 0],
    size: [0, 10],
    strength: 5,
    wetness: 2,
    roughness: -1,
    ripple: 3,
    patternMeters: 0,
    resolution: 100,
    layer: 31,
  });
  for (const key of [
    'position',
    'size',
    'strength',
    'wetness',
    'roughness',
    'ripple',
    'patternMeters',
    'resolution',
    'layer',
  ])
    assert.ok(
      issues.some((issue) => issue.startsWith(key + ':')),
      key,
    );
});
