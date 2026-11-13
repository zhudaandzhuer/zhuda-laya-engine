// Automatic exposure, depth of field and motion blur: their options, the
// numbers behind them and their place in a look. Pure checks; the draw is
// verify:camera-effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveZhudaAutoExposure,
  resolveZhudaDepthOfField,
  resolveZhudaMotionBlur,
  validateZhudaAutoExposure,
  validateZhudaDepthOfField,
  validateZhudaMotionBlur,
  zhudaCameraBasis,
  zhudaDofRadiusAtInfinity,
  zhudaExposureRate,
} from '../packages/core/runtime3d/CameraEffects.ts';
import {
  resolveZhudaFilmLook,
  validateZhudaFilmScene,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';

test('automatic exposure has defaults and refuses values out of range', () => {
  assert.deepEqual(resolveZhudaAutoExposure(), {
    key: 0.18,
    min: 0.25,
    max: 4,
    speed: 1.5,
    strength: 1,
  });
  assert.deepEqual(validateZhudaAutoExposure({ key: 0.3, min: 0.5, max: 2, speed: 0 }), []);
  assert.deepEqual(validateZhudaAutoExposure({ key: 9, speed: -1, strength: 2, fast: true }), [
    'fast: unknown option (key, min, max, speed, strength)',
    'key: use 0.01..4',
    'speed: use 0..60',
    'strength: use 0..1',
  ]);
  assert.deepEqual(validateZhudaAutoExposure({ min: 3, max: 2 }), ['min: at most max']);
  // A limit given alone keeps the other on its side of it.
  assert.equal(resolveZhudaAutoExposure({ max: 0.1 }).min, 0.1);
  assert.equal(resolveZhudaAutoExposure({ min: 8 }).max, 8);
});

test('the eye adapts by the time that passed, at once with no speed', () => {
  assert.equal(zhudaExposureRate(0, 0.016), 1);
  assert.ok(Math.abs(zhudaExposureRate(1, 1) - (1 - 1 / Math.E)) < 1e-12);
  // Two half steps are one whole step: the rate does not depend on the frame rate.
  const half = zhudaExposureRate(2, 0.05),
    whole = zhudaExposureRate(2, 0.1);
  assert.ok(Math.abs(1 - (1 - half) * (1 - half) - whole) < 1e-12);
  assert.equal(zhudaExposureRate(2, -1), 0);
});

test('depth of field needs a focus distance and follows the thin lens', () => {
  assert.deepEqual(validateZhudaDepthOfField({}), ['focusDistanceM: required, in metres']);
  assert.deepEqual(validateZhudaDepthOfField({ focusDistanceM: 3, fStop: 0.1, maxRadius: 1 }), [
    'fStop: use 0.5..64',
    'maxRadius: use 0.001..0.05',
  ]);
  assert.deepEqual(validateZhudaDepthOfField({ focusDistanceM: 0.05, focalLengthMm: 85 }), [
    'focusDistanceM: beyond the focal length',
  ]);
  const lens = resolveZhudaDepthOfField({ focusDistanceM: 3 });
  assert.deepEqual(lens, {
    focusDistanceM: 3,
    fStop: 2.8,
    focalLengthMm: 50,
    sensorHeightMm: 24,
    maxRadius: 0.02,
  });
  // 50 mm at f/2.8 focused at 3 m: a point at infinity is a disc of
  // 0.05² / (2.8 × 2.95) = 0.303 mm on the sensor, 0.0063 of its height in radius.
  assert.ok(Math.abs(zhudaDofRadiusAtInfinity(lens) - 0.006306) < 1e-5);
  // Twice the aperture, twice the disc; a longer lens, a larger one.
  const open = resolveZhudaDepthOfField({ focusDistanceM: 3, fStop: 1.4 });
  assert.ok(Math.abs(zhudaDofRadiusAtInfinity(open) / zhudaDofRadiusAtInfinity(lens) - 2) < 1e-9);
  const long = resolveZhudaDepthOfField({ focusDistanceM: 3, focalLengthMm: 85 });
  assert.ok(zhudaDofRadiusAtInfinity(long) > zhudaDofRadiusAtInfinity(lens) * 2.8);
});

test('motion blur has a shutter and a longest smear', () => {
  assert.deepEqual(resolveZhudaMotionBlur(), { shutter: 0.5, maxLength: 0.04 });
  assert.deepEqual(validateZhudaMotionBlur({ shutter: 2, maxLength: 0, samples: 8 }), [
    'samples: unknown option (shutter, maxLength)',
    'shutter: use 0..1',
    'maxLength: use 0.001..0.2',
  ]);
});

test('the camera basis spans the frame and refuses a camera that looks nowhere', () => {
  const basis = zhudaCameraBasis([0, 1, 0], [0, 1, -5], 90, 2);
  assert.deepEqual(basis.forward, [0, 0, -1]);
  // At 90 degrees the frame is as far up as it is deep, and twice as wide.
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-12);
  assert.ok(near(basis.up, [0, 1, 0]));
  assert.ok(near(basis.right, [2, 0, 0]));
  assert.throws(() => zhudaCameraBasis([0, 0, 0], [0, 0, 0], 50, 1), /Invalid camera/);
  // Straight down: another axis stands in for up.
  const down = zhudaCameraBasis([0, 5, 0], [0, 0, 0], 60, 1);
  assert.ok(down.right.every(Number.isFinite) && Math.hypot(...down.right) > 0);
});

test('a look takes the three, needs a grade for them, and drops them at the low levels', () => {
  const scene = (look) => ({
    schemaVersion: 1,
    id: 's',
    camera: { eye: [0, 1, 5], target: [0, 1, 0] },
    look,
    materials: {},
    nodes: [],
  });
  assert.deepEqual(
    validateZhudaFilmScene(
      scene({
        grade: {},
        autoExposure: true,
        motionBlur: { shutter: 0.3 },
        depthOfField: { focusDistanceM: 4 },
      }),
    ),
    [],
  );
  assert.deepEqual(
    validateZhudaFilmScene(
      scene({ autoExposure: { key: 9 }, depthOfField: true, motionBlur: 'fast' }),
    ),
    [
      'scene.look.autoExposure.key: use 0.01..4',
      'scene.look.autoExposure: needs grade (it is part of the HDR chain)',
      'scene.look.depthOfField: object or false required',
      'scene.look.motionBlur: object, true or false required',
    ],
  );
  const off = resolveZhudaFilmLook({ grade: {} });
  assert.equal(off.autoExposure, false);
  assert.equal(off.depthOfField, false);
  assert.equal(off.motionBlur, false);
  const on = resolveZhudaFilmLook({
    grade: {},
    autoExposure: true,
    motionBlur: true,
    depthOfField: { focusDistanceM: 4 },
  });
  assert.equal(on.autoExposure.key, 0.18);
  assert.equal(on.motionBlur.shutter, 0.5);
  assert.equal(on.depthOfField.fStop, 2.8);
  for (const level of [3, 2]) {
    const at = zhudaLookForQuality(on, level);
    assert.ok(at.autoExposure && at.motionBlur && at.depthOfField, `all three at level ${level}`);
  }
  const one = zhudaLookForQuality(on, 1);
  assert.ok(one.autoExposure, 'automatic exposure stays at level 1');
  assert.equal(one.depthOfField, false);
  assert.equal(one.motionBlur, false);
  const none = zhudaLookForQuality(on, 0, { keepGrade: true });
  assert.equal(none.autoExposure, false);
  // Built or not is a rebuild; the values are set in place.
  assert.equal(zhudaFilmLookRebuildReason(off, on), 'autoExposure');
  const pulled = resolveZhudaFilmLook({
    grade: {},
    autoExposure: { key: 0.3 },
    motionBlur: { shutter: 1 },
    depthOfField: { focusDistanceM: 40 },
  });
  assert.equal(zhudaFilmLookRebuildReason(on, pulled), null);
});
