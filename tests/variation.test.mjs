// Brightness variation that hides the repeat of a tiled surface. Pure checks;
// the draw is verify:film-variation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeZhudaVariation, validateZhudaVariation } from '../packages/core/procedural/Variation.ts';
import { createZhudaProceduralMaterial } from '../packages/core/procedural/ProceduralMaterial.ts';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';

const decode = (value) => {
  const x = value / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
// What LayaAir multiplies the surface colour by for a detail texel.
const factor = (value) => decode(value) * 4.5947938;

test('the picture is neutral on average, bounded by its amount and the same every time', () => {
  const flat = bakeZhudaVariation({ amount: 0 });
  assert.equal(flat.size, 256);
  assert.ok(flat.pixels.every((v, i) => (i % 4 === 3 ? v === 255 : v === 128)));
  const full = bakeZhudaVariation({ amount: 1, seed: 7 });
  let min = 255,
    max = 0,
    sum = 0;
  for (let i = 0; i < full.pixels.length; i += 4) {
    const v = full.pixels[i];
    assert.equal(full.pixels[i + 1], v, 'grey: the surface keeps its hue');
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += factor(v);
  }
  assert.ok(factor(min) >= 0.64 && factor(max) <= 1.36, `${factor(min)}..${factor(max)}`);
  assert.ok(factor(max) - factor(min) > 0.3, 'it does vary');
  assert.ok(Math.abs(sum / (full.pixels.length / 4) - 1) < 0.06, 'and leaves the surface as bright');
  assert.deepEqual(bakeZhudaVariation({ amount: 1, seed: 7 }).pixels, full.pixels);
  assert.notDeepEqual(bakeZhudaVariation({ amount: 1, seed: 8 }).pixels, full.pixels);
  const half = bakeZhudaVariation({ amount: 0.5, seed: 7, size: 64 });
  assert.equal(half.pixels.length, 64 * 64 * 4);
});

test('the picture tiles: its edges meet as smoothly as its inside', () => {
  const { size, pixels } = bakeZhudaVariation({ amount: 1, seed: 3 });
  const at = (x, y) => pixels[(((y + size) % size) * size + ((x + size) % size)) * 4];
  let inside = 0,
    seam = 0;
  for (let i = 0; i < size; i++) {
    inside = Math.max(inside, Math.abs(at(60, i) - at(61, i)), Math.abs(at(i, 60) - at(i, 61)));
    inside = Math.max(inside, Math.abs(at(130, i) - at(131, i)), Math.abs(at(i, 130) - at(i, 131)));
    seam = Math.max(seam, Math.abs(at(size - 1, i) - at(0, i)), Math.abs(at(i, size - 1) - at(i, 0)));
  }
  assert.ok(seam <= inside + 2, `seam ${seam}, inside ${inside}`);
});

test('options are checked', () => {
  assert.deepEqual(validateZhudaVariation({ amount: 0.5, size: 64, seed: 2 }), []);
  assert.deepEqual(validateZhudaVariation({ amount: 2, size: 100, seed: -1 }), [
    'amount: use 0..1',
    'size: use 32, 64, 128 or 256',
    'seed: use a whole number 0 or above',
  ]);
  assert.throws(() => bakeZhudaVariation({}), /amount/);
});

test('a procedural material carries it as its detail map, at its own scale', () => {
  class Texture2D {
    constructor(width, height) {
      Object.assign(this, { width, height });
    }
    setPixelsData(pixels) {
      this.pixels = pixels;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  const saved = globalThis.Laya;
  globalThis.Laya = {
    Texture2D,
    PBRStandardMaterial: class {
      destroy() {}
    },
    UnlitMaterial: class {},
    TextureFormat: { R8G8B8A8: 'rgba8' },
    Color: class {
      constructor(...rgba) {
        this.rgba = rgba;
      }
    },
    Vector4: class {
      constructor(...v) {
        this.v = v;
      }
    },
    RenderState: {},
  };
  try {
    const set = {
      size: 4,
      tileMeters: [2, 4],
      normalConvention: 'directx',
      albedo: new Uint8Array(64),
      normal: new Uint8Array(64),
      metallicGloss: new Uint8Array(64),
    };
    const plain = createZhudaProceduralMaterial(set);
    assert.equal(plain.textures.length, 3);
    assert.equal(plain.material.detailAlbedoTexture, undefined);
    const varied = createZhudaProceduralMaterial(set, { variation: { amount: 0.5, meters: 8 } });
    assert.equal(varied.textures.length, 4);
    const detail = varied.material.detailAlbedoTexture;
    assert.equal(detail, varied.textures[3]);
    assert.equal(detail.width, 256);
    assert.equal(detail.anisoLevel, 8);
    // Mesh UVs are in metres: one repeat of the picture every 8 m.
    assert.deepEqual(varied.material.detailTilingOffset.v, [1 / 8, 1 / 8, 0, 0]);
    // UVs that span one tile: the tile is 2 m by 4 m.
    const tiled = createZhudaProceduralMaterial(set, {
      uvUnit: 'tile',
      variation: { amount: 0.5, meters: 8 },
    });
    assert.deepEqual(tiled.material.detailTilingOffset.v, [2 / 8, 4 / 8, 0, 0]);
    varied.dispose();
    assert.ok(detail.destroyed, 'the material owns its detail map');
    assert.throws(
      () => createZhudaProceduralMaterial(set, { variation: { amount: 0.5, meters: 0 } }),
      /meters/,
    );
    // Nothing to lay over the surface: no fourth texture.
    assert.equal(
      createZhudaProceduralMaterial(set, { variation: { amount: 0, meters: 8 } }).textures.length,
      3,
    );
  } finally {
    globalThis.Laya = saved;
  }
});

test('a film material takes variation between 0 and 1', () => {
  const scene = (variation) => ({
    schemaVersion: 1,
    id: 'variation',
    camera: { eye: [0, 2, 8], target: [0, 1, 0] },
    materials: { road: { recipe: 'asphalt', variation } },
    nodes: [{ id: 'ground', type: 'ground', size: [20, 20], material: 'road' }],
  });
  const context = { props: [], recipes: ['asphalt'] };
  assert.deepEqual(validateZhudaFilmScene(scene(0.5), context), []);
  assert.deepEqual(validateZhudaFilmScene(scene(2), context), [
    'scene.materials.road.variation: use 0..1',
  ]);
});
