// The cloth's kinds and wind (systems/cloth): what the MagicCloth plugin's presets taught (a game's cloth falls
// under well less than real gravity, loses its swing soon, is held to a few metres a second), as the engine's
// cloth options; and a wind that is the same for the same seconds and differs from cloth to cloth.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOTH_PRESETS, clothOptions } from '../systems/cloth/presets.ts';
import { windAt } from '../systems/cloth/wind.ts';

test('every preset is a game cloth: light gravity, a speed limit, settles before it is shown', () => {
  for (const [name, p] of Object.entries(CLOTH_PRESETS)) {
    assert.ok(p.gravity > 0 && p.gravity < 9.81, name);
    assert.ok(p.maxSpeed > 0 && p.maxSpeed <= 6, name);
    assert.ok(p.settleSeconds > 0, name);
    const o = clothOptions(p);
    assert.deepEqual(o.gravity, [0, -p.gravity, 0]);
    assert.equal(o.compliance.structural, 0);
    assert.equal(o.compliance.bend, p.bend);
  }
  // a soft skirt folds more easily than a skirt
  assert.ok(CLOTH_PRESETS.softSkirt.bend > CLOTH_PRESETS.skirt.bend);
});

test('the wind: the same seconds give the same air; another cloth is elsewhere in the gusts; none is none', () => {
  const zone = { direction: [1, 0], main: 3, turbulence: 1, frequency: 1 };
  assert.deepEqual(windAt(zone, 12.5, 0.2, 0), windAt(zone, 12.5, 0.2, 0));
  assert.notDeepEqual(windAt(zone, 12.5, 0.2, 0), windAt(zone, 12.5, 0.2, 1));
  assert.deepEqual(windAt(zone, 3, 0, 0).map((v) => Math.abs(v)), [0, 0, 0]);
  // never more than the main wind times the share felt
  for (let t = 0; t < 30; t += 0.37) assert.ok(Math.hypot(...windAt(zone, t, 0.5, 0.3)) <= 3 * 0.5 * 1.3 + 1e-9);
});
