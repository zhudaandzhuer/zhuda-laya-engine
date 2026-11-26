// Where a world point is on a film camera's picture. Pure checks; the handedness
// and the lens were checked against a drawn frame (docs/plans/records/round-9-consumer-fixes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectZhudaFilmPoint } from '../packages/core/film/Projection.ts';
import { physicalCameraMetrics } from '../packages/core/runtime3d/PhysicalCamera.ts';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const camera = { eye: [0, 0, 0], target: [0, 0, 10], focalLengthMm: 35 };

test('the point looked at is the middle of the picture, at its distance', () => {
  const p = projectZhudaFilmPoint({ eye: [3, 7, -2], target: [10, 1, 9] }, [10, 1, 9], 16 / 9);
  near(p.x, 0.5);
  near(p.y, 0.5);
  near(p.depth, Math.hypot(7, 6, 11));
  assert.equal(p.inView, true);
});

test('right-handed: looking along +Z, +X is on the left and +Y is up', () => {
  const left = projectZhudaFilmPoint(camera, [1, 0, 10], 1);
  const up = projectZhudaFilmPoint(camera, [0, 1, 10], 1);
  assert.ok(left.x < 0.5 && Math.abs(left.y - 0.5) < 1e-9);
  assert.ok(up.y < 0.5 && Math.abs(up.x - 0.5) < 1e-9);
  // Looking along -Z the sides swap.
  assert.ok(projectZhudaFilmPoint({ ...camera, target: [0, 0, -10] }, [1, 0, -10], 1).x > 0.5);
});

test("the top edge is the lens's vertical field of view; a wider picture moves points towards its middle", () => {
  const fov = physicalCameraMetrics({ focalLengthMm: 35 }, 24).verticalFovDegrees;
  const y = 10 * Math.tan((fov * Math.PI) / 360);
  near(projectZhudaFilmPoint(camera, [0, y, 10], 2).y, 0, 1e-9);
  near(projectZhudaFilmPoint(camera, [0, -y, 10], 2).y, 1, 1e-9);
  // The same vertical lens whatever the aspect: x scales with it.
  near(projectZhudaFilmPoint(camera, [-y, 0, 10], 1).x, 1, 1e-9);
  near(projectZhudaFilmPoint(camera, [-y, 0, 10], 2).x, 0.75, 1e-9);
  // A longer lens brings the edge in; the default lens is 35 mm.
  assert.ok(projectZhudaFilmPoint({ ...camera, focalLengthMm: 70 }, [0, y, 10], 1).y < 0);
  near(projectZhudaFilmPoint({ eye: camera.eye, target: camera.target }, [0, y, 10], 1).y, 0, 1e-9);
});

test('behind the camera and outside the picture are told apart', () => {
  const behind = projectZhudaFilmPoint(camera, [0, 0, -5], 1);
  assert.ok(behind.depth < 0 && behind.inView === false);
  const beside = projectZhudaFilmPoint(camera, [50, 0, 10], 1);
  assert.ok(beside.depth > 0 && beside.inView === false && beside.x < 0);
});

test('a camera looking straight down keeps +X on the left, as when tipped there from +Z; bad input is refused', () => {
  const down = { eye: [0, 30, 0], target: [0, 0, 0] };
  assert.ok(projectZhudaFilmPoint(down, [5, 0, 0], 1).x < 0.5);
  assert.throws(() => projectZhudaFilmPoint(camera, [0, 0, 1], 0), /aspect/);
  assert.throws(
    () => projectZhudaFilmPoint({ eye: [1, 1, 1], target: [1, 1, 1] }, [0, 0, 1], 1),
    /own eye/,
  );
});
