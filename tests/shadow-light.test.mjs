// WP22 (docs/plans/records/threejs-gap-audit/plan.md): a light that casts
// shadows is the scene's main light, ahead of a brighter one that does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installLaya342ShadowLightFirst } from '../packages/core/runtime3d/Laya342Adapters.ts';

function runtime() {
  // LayaAir 3.4.2's LightQueue as far as the choice goes.
  class LightQueue {
    constructor(lights) {
      this._elements = lights;
      this._length = lights.length;
    }
    getBrightestLight() {
      let index,
        best = -1;
      for (let i = 0; i < this._length; i++)
        if (best < this._elements[i]._intensity) {
          best = this._elements[i]._intensity;
          index = i;
        }
      return index;
    }
  }
  return { LightQueue, ShadowMode: { None: 0, Hard: 1, SoftLow: 2 } };
}
const light = (intensity, shadowMode = 0) => ({ _intensity: intensity, shadowMode });

test('a shadow-casting sun stays the main light beside brighter rim lights', () => {
  const laya = runtime();
  assert.equal(installLaya342ShadowLightFirst(laya), true);
  assert.equal(installLaya342ShadowLightFirst(laya), false, 'once');
  const queue = (lights) => new laya.LightQueue(lights).getBrightestLight();
  // The issue's scene: a sun at 1.8 with its shadow, two rims at 2.4 and 3.6.
  assert.equal(queue([light(2.4), light(1.8, 1), light(3.6)]), 1);
  // Two that cast shadows: the brighter of them.
  assert.equal(queue([light(1.2, 2), light(3.6), light(1.8, 1)]), 2);
  // None casts shadows: the brightest, as LayaAir chose.
  assert.equal(queue([light(1), light(3), light(2)]), 1);
  assert.equal(queue([]), undefined);
  // Only the queue's length counts, as in LayaAir.
  const short = new laya.LightQueue([light(1), light(5, 1)]);
  short._length = 1;
  assert.equal(short.getBrightestLight(), 0);
});
