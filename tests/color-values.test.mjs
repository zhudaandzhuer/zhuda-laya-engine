// One meaning for the colours of a look: display values, decoded the way
// LayaAir decodes its own Color type. Pure checks; the draw is
// verify:film-colours.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zhudaDecodeColor,
  zhudaDisplayToLinear,
  zhudaEncodeColor,
  zhudaLinearToDisplay,
} from '../packages/core/film/ColorValues.ts';
import { zhudaSunRadiance } from '../packages/core/film/LiveLook.ts';
import { resolveZhudaFilmLook } from '../packages/core/film/FilmScene.ts';

const near = (actual, expected, tolerance = 1e-4) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} is not ${expected}`);

test('the decoding is LayaAir’s: the sRGB curve up to 1 and a 2.4th power above', () => {
  // Measured through the renderer: a colour of 0.5 gives 21.4 % of the light,
  // an emission of 2 gives 5.3 times white and 8 gives 147.
  near(zhudaDisplayToLinear(0), 0);
  near(zhudaDisplayToLinear(0.04), 0.04 / 12.92);
  near(zhudaDisplayToLinear(0.5), 0.214);
  near(zhudaDisplayToLinear(1), 1);
  near(zhudaDisplayToLinear(2), 5.278, 1e-3);
  near(zhudaDisplayToLinear(8), 147.03, 1e-2);
  for (const value of [0, 0.001, 0.03, 0.2, 0.5, 0.99, 1, 1.5, 4, 8])
    near(zhudaLinearToDisplay(zhudaDisplayToLinear(value)), value, 1e-9);
});

test('colours decode channel by channel, and encoding carries an old linear value over', () => {
  assert.deepEqual(
    zhudaDecodeColor([0.5, 1, 0]).map((v) => +v.toFixed(4)),
    [0.214, 1, 0],
  );
  // `ambientGround: [0.26, 0.23, 0.2]` was read as light; this display value draws the same.
  const carried = zhudaEncodeColor([0.26, 0.23, 0.2]);
  zhudaDecodeColor(carried).forEach((v, i) => near(v, [0.26, 0.23, 0.2][i], 1e-9));
});

test('the sun’s light for the engine’s own shaders is its decoded colour times its intensity', () => {
  const look = resolveZhudaFilmLook({ sun: { color: [0.5, 1, 0.25], intensity: 2 } });
  zhudaSunRadiance(look).forEach((v, i) =>
    near(v, [zhudaDisplayToLinear(0.5) * 2, 2, zhudaDisplayToLinear(0.25) * 2][i]),
  );
});
