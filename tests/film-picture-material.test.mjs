import test from 'node:test';
import assert from 'node:assert/strict';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';

test('a film material may be a picture among the assets, with a normal map and a tile size', () => {
  const scene = (material) => ({
    schemaVersion: 1,
    id: 'picture-material-check',
    camera: { eye: [0, 1, 6], target: [0, 1, 0], focalLengthMm: 35 },
    materials: { wall: material },
    nodes: [{ id: 'ground', type: 'ground', size: [10, 10], material: 'wall' }],
  });
  const assets = ['tiles/brick/albedo.png', 'tiles/brick/normal.png', 'models/a.glb'];
  const issues = (material) => validateZhudaFilmScene(scene(material), { assets });
  const base = { picture: 'tiles/brick/albedo.png', tileMeters: [2, 2] };
  assert.deepEqual(issues(base), []);
  assert.deepEqual(
    issues({
      ...base,
      normal: 'tiles/brick/normal.png',
      normalConvention: 'directx',
      normalStrength: 1.5,
      roughness: 0.6,
      metallic: 0.1,
      tint: [1, 0.9, 0.8, 1],
      blend: 'cutout',
      alphaCutoff: 0.4,
      doubleSided: true,
    }),
    [],
  );
  assert.match(
    issues({ ...base, picture: 'tiles/none.png' })[0],
    /picture: unknown asset tiles\/none\.png/,
  );
  assert.match(
    issues({ ...base, picture: 'models/a.glb' })[0],
    /picture: use a logical asset id ending in \.png or \.jpg/,
  );
  assert.match(issues({ ...base, picture: '../x.png' })[0], /picture: use a logical asset id/);
  assert.match(issues({ ...base, normal: 'tiles/none.png' })[0], /normal: unknown asset/);
  assert.match(
    issues({ picture: 'tiles/brick/albedo.png' })[0],
    /tileMeters: use \[width, height\]/,
  );
  assert.match(issues({ ...base, tileMeters: [0, 2] })[0], /tileMeters/);
  assert.match(
    issues({ ...base, normalConvention: 'unity' })[0],
    /normalConvention: use opengl or directx/,
  );
  assert.match(issues({ ...base, roughness: 2 })[0], /roughness: use 0\.\.1/);
  assert.match(issues({ ...base, normalStrength: 3 })[0], /normalStrength: use 0\.\.2/);
  assert.match(issues({ ...base, recipe: 'concrete' }).join(' '), /materials\.wall/);
  // Without a list of assets (a program that mounts its own) the id's form is still checked.
  assert.deepEqual(validateZhudaFilmScene(scene(base)), []);
});
