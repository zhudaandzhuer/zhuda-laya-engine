// Clouds as a look option and two finishes of a surface material. Pure
// checks; the draws are verify:film-clouds and verify:film-finishes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveZhudaClouds, validateZhudaClouds } from '../packages/core/runtime3d/Clouds.ts';
import { createSurfaceMaterial } from '../packages/core/runtime3d/Surfaces.ts';
import {
  resolveZhudaFilmLook,
  validateZhudaFilmScene,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';

test('clouds have defaults and refuse values out of range', () => {
  assert.deepEqual(resolveZhudaClouds(), {
    coverage: 0.5,
    baseMeters: 1500,
    thicknessMeters: 900,
    sizeMeters: 2600,
    density: 1,
    wind: [8, 0],
    steps: 32,
    distanceMeters: 40000,
    sunToward: [0, 1, 0],
    sunColor: [1, 1, 1],
    skyColor: [0.35, 0.4, 0.5],
  });
  assert.deepEqual(validateZhudaClouds({ coverage: 0.8, wind: [-20, 5], steps: 16 }), []);
  assert.deepEqual(
    validateZhudaClouds({
      coverage: 2,
      baseMeters: 1,
      wind: [1],
      steps: 12.5,
      sunToward: [0, 0, 0],
      skyColor: [-1, 0, 0],
      rain: true,
    }),
    [
      'rain: unknown option (coverage, baseMeters, thicknessMeters, sizeMeters, density, wind, steps, distanceMeters, sunToward, sunColor, skyColor)',
      'coverage: use 0..1',
      'baseMeters: use 50..20000',
      'wind: use [x, z] in metres a second, each within 300',
      'steps: use a whole number 8..64',
      'sunToward: use a direction [x, y, z]',
      'skyColor: use [r, g, b] of 0 or more',
    ],
  );
});

test('a look takes clouds, lights them itself, and thins them at the low levels', () => {
  const scene = (look) => ({
    schemaVersion: 1,
    id: 's',
    camera: { eye: [0, 1, 5], target: [0, 1, 0] },
    look,
    materials: {},
    nodes: [],
  });
  assert.deepEqual(validateZhudaFilmScene(scene({ grade: {}, clouds: true })), []);
  assert.deepEqual(validateZhudaFilmScene(scene({ grade: {}, clouds: { coverage: 0.7 } })), []);
  assert.deepEqual(
    validateZhudaFilmScene(scene({ clouds: { coverage: 3, sunColor: [1, 1, 1] } })),
    [
      'scene.look.clouds.coverage: use 0..1',
      'scene.look.clouds: needs grade (it is part of the HDR chain)',
      "scene.look.clouds.sunColor: comes from the look's sun and ambient light",
    ],
  );
  const off = resolveZhudaFilmLook({ grade: {} });
  assert.equal(off.clouds, false);
  const on = resolveZhudaFilmLook({ grade: {}, clouds: { coverage: 0.7 } });
  assert.deepEqual(on.clouds, {
    coverage: 0.7,
    baseMeters: 1500,
    thicknessMeters: 900,
    sizeMeters: 2600,
    density: 1,
    wind: [8, 0],
    steps: 32,
    distanceMeters: 40000,
  });
  assert.equal(zhudaLookForQuality(on, 3).clouds.steps, 32);
  assert.equal(zhudaLookForQuality(on, 2).clouds.steps, 16);
  assert.equal(zhudaLookForQuality(on, 1).clouds.steps, 11);
  assert.equal(zhudaLookForQuality(on, 0, { keepGrade: true }).clouds, false);
  assert.equal(zhudaFilmLookRebuildReason(off, on), 'clouds');
  assert.equal(
    zhudaFilmLookRebuildReason(on, resolveZhudaFilmLook({ grade: {}, clouds: { coverage: 0.2 } })),
    null,
    'how much cloud there is changes in place',
  );
});

test('a surface takes a clear coat and a drawn-out highlight', () => {
  const saved = globalThis.Laya;
  class PBRStandardMaterial {}
  class UnlitMaterial {}
  globalThis.Laya = {
    PBRStandardMaterial,
    UnlitMaterial,
    PBRRenderMode: { Fade: 2 },
    Color: class {},
    RenderState: { CULL_NONE: 0 },
  };
  try {
    const plain = createSurfaceMaterial({ type: 'pbr' });
    assert.equal(plain.clearCoatEnable, undefined, 'nothing is switched on unless asked');
    assert.equal(plain.anisotropyEnable, undefined);
    const lacquer = createSurfaceMaterial({ type: 'pbr', clearCoat: 0.8, anisotropy: 0.6 });
    assert.equal(lacquer.clearCoatEnable, true);
    assert.equal(lacquer.clearCoat, 0.8);
    assert.equal(lacquer.clearCoatRoughness, 0.1);
    assert.equal(lacquer.anisotropyEnable, true);
    assert.equal(lacquer.anisotropy, 0.6);
    assert.throws(() => createSurfaceMaterial({ type: 'pbr', clearCoat: 2 }), /clearCoat 0\.\.1/);
    assert.throws(
      () => createSurfaceMaterial({ type: 'pbr', anisotropy: -0.5 }),
      /anisotropy 0\.\.1/,
    );
    assert.throws(
      () => createSurfaceMaterial({ type: 'unlit', clearCoat: 1 }),
      /physically based surfaces/,
    );
  } finally {
    globalThis.Laya = saved;
  }
  const scene = (finish) => ({
    schemaVersion: 1,
    id: 's',
    camera: { eye: [0, 1, 5], target: [0, 1, 0] },
    materials: { finish },
    nodes: [{ id: 'b', type: 'box', size: [1, 1, 1], position: [0, 0, 0], material: 'finish' }],
  });
  assert.deepEqual(
    validateZhudaFilmScene(
      scene({ color: [0.5, 0.1, 0.1], clearCoat: 1, clearCoatRoughness: 0.05, anisotropy: 0.4 }),
    ),
    [],
  );
  assert.deepEqual(
    validateZhudaFilmScene(scene({ color: [0.5, 0.1, 0.1], clearCoat: 2, anisotropy: -1 })),
    ['scene.materials.finish.clearCoat: use 0..1', 'scene.materials.finish.anisotropy: use 0..1'],
  );
});
