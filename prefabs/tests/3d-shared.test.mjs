// The shared 3D pieces without a browser: the day's look, the picture settings and the nature pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const { skyAt, clockText, CLOUD_SEA, OCEAN, WEATHERS } = await import('../3d/day-look.ts');
const { makeTiers, SKY_ISLAND_GRASS, GARDEN_ISLAND_GRASS, TIER_IDS, ladder, startTier } = await import('../3d/quality-tiers.ts');
const { NATURE_PACK, naturePath } = await import('../3d/nature-pack/nature-pack.ts');

const keysOf = (o, at = '') =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keysOf(v, `${at}${k}.`) : [`${at}${k}`])).sort();

test('every hour and weather gives a look with the same keys, in both settings (the look is updated, never rebuilt)', () => {
  for (const setting of [CLOUD_SEA, OCEAN]) {
    const first = keysOf(skyAt(0, { rain: 0, storm: 0, mist: 0 }, 20, 0, 2.4, [], setting).look);
    for (let h = 0; h < 24; h += 0.5)
      for (const w of [{ rain: 0, storm: 0, mist: 0 }, { rain: 1, storm: 0, mist: 0 }, { rain: 0, storm: 1, mist: 0 }, { rain: 0, storm: 0, mist: 1 }])
        for (const flash of [0, 1]) assert.deepEqual(keysOf(skyAt(h, w, 20, flash, 2.4, [], setting).look), first, `${setting.id} ${h} ${JSON.stringify(w)}`);
  }
});

test('night is dark and day is lit; storms grey the sun; the setting decides cloud and reach', () => {
  const clear = { rain: 0, storm: 0, mist: 0 };
  const noon = skyAt(12.5, clear, 20, 0), midnight = skyAt(0, clear, 20, 0);
  assert.ok(noon.night < 0.01 && midnight.night > 0.99);
  assert.ok(noon.sun > 0.9 && midnight.sun < 0.01);
  assert.ok(skyAt(12.5, { rain: 0, storm: 1, mist: 0 }, 20, 0).look.sun.intensity < noon.look.sun.intensity * 0.5);
  const sea = skyAt(12, clear, 20, 0, 2.4, [], CLOUD_SEA).look, ocean = skyAt(12, clear, 20, 0, 2.4, [], OCEAN).look;
  assert.ok(sea.clouds.baseMeters < 0, 'cloud sea below the island');
  assert.ok(ocean.clouds.baseMeters > 0, 'cloud overhead');
  assert.equal(sea.shadows.distance, 28);
  assert.equal(ocean.shadows.distance, 55);
  assert.equal(sea.lightFog.maxDistance, 70);
  assert.equal(ocean.lightFog.maxDistance, 140);
  assert.equal(skyAt(12, clear, 20, 0, 2.4, ['clouds', 'fog']).look.clouds, false);
  assert.equal(clockText(18.25), '18:15');
  assert.deepEqual(Object.keys(WEATHERS), ['clear', 'rain', 'storm', 'mist']);
});

test('the address picks the setting; otherwise a phone starts low and a desktop mid', () => {
  assert.deepEqual(startTier(new URLSearchParams('fx=max'), false), { tier: 3, fromAddress: true });
  assert.deepEqual(startTier(new URLSearchParams('fx=low'), false), { tier: 0, fromAddress: true });
  assert.equal(startTier(new URLSearchParams(''), true).tier, 0);
  assert.equal(startTier(new URLSearchParams(''), false).tier, 1);
  assert.equal(startTier(new URLSearchParams('fx=ultra'), false).tier, 1);
});

test('the ladder goes from the cheapest rung up to the chosen setting, never above it', () => {
  for (let ceiling = 0; ceiling < TIER_IDS.length; ceiling++) {
    const steps = ladder(ceiling);
    assert.equal(steps.at(-1).tier, ceiling);
    assert.ok(steps.every((s) => s.tier <= ceiling));
    assert.equal(steps[0].tier, 0);
    for (let i = 1; i < steps.length; i++)
      assert.ok(steps[i].tier > steps[i - 1].tier || steps[i].renderScale > steps[i - 1].renderScale, 'each rung costs more than the one below');
  }
  assert.equal(ladder(3).at(-1).renderScale, 1);
  assert.ok(ladder(0).length >= 2, 'even low can still lower its resolution');
});

test('cheaper settings ask for less, with either scene grass', () => {
  for (const grass of [SKY_ISLAND_GRASS, GARDEN_ISLAND_GRASS]) {
    const tiers = makeTiers(grass);
    assert.deepEqual(tiers.map((t) => t.id), TIER_IDS);
    for (let i = 1; i < tiers.length; i++) {
      assert.ok(tiers[i].grass.density >= tiers[i - 1].grass.density);
      assert.ok(tiers[i].particles >= tiers[i - 1].particles);
      assert.ok(tiers[i].look >= tiers[i - 1].look);
      assert.ok(tiers[i].dpr >= tiers[i - 1].dpr);
    }
  }
  assert.equal(makeTiers(SKY_ISLAND_GRASS)[1].grass.density, 600);
  assert.equal(makeTiers(GARDEN_ISLAND_GRASS)[2].grass.distanceM, 48);
});

test('the nature pack lists exactly the models in its assets folder', () => {
  const dir = fileURLToPath(new URL('../3d/nature-pack/assets/', import.meta.url));
  const onDisk = fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)).sort();
  assert.deepEqual(Object.keys(NATURE_PACK).sort(), onDisk);
  for (const id of onDisk) {
    assert.equal(fs.readFileSync(dir + id + '.glb').subarray(0, 4).toString('latin1'), 'glTF', id);
    assert.equal(naturePath(id), `common/3d/nature-pack/assets/${id}.glb`);
  }
});
