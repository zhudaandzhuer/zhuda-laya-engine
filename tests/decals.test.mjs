// Decals: options, the baked outline and the rectangle; the alpha blend of a
// physically based surface. Pure checks; the draw is verify:film-decals.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bakeZhudaDecalMask,
  resolveZhudaDecal,
  validateZhudaDecal,
  zhudaDecalQuad,
} from '../packages/core/runtime3d/Decals.ts';
import { createSurfaceMaterial } from '../packages/core/runtime3d/Surfaces.ts';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';

test('a decal has defaults and refuses what cannot be laid down', () => {
  assert.deepEqual(resolveZhudaDecal({ position: [1, 0, 2], size: [2, 1] }), {
    position: [1, 0, 2],
    size: [2, 1],
    normal: [0, 1, 0],
    angleDeg: 0,
    color: [0.02, 0.02, 0.02],
    opacity: 0.8,
    roughness: 0.6,
    shape: 'blob',
    edge: 0.35,
    ragged: 0.5,
    seed: 1,
    resolution: 128,
    lift: 0.004,
  });
  assert.deepEqual(validateZhudaDecal({ position: [0, 0, 0], size: [1, 1], shape: 'ring' }), []);
  assert.deepEqual(
    validateZhudaDecal({
      size: [1, 0],
      normal: [0, 0, 0],
      color: [2, 0, 0],
      opacity: 2,
      shape: 'star',
      seed: 1.5,
      resolution: 100,
      wraps: true,
    }),
    [
      'wraps: unknown option (position, size, normal, angleDeg, color, opacity, roughness, shape, edge, ragged, seed, resolution, lift)',
      'position: use [x, y, z] in metres',
      'size: use [width, length] in metres, both above 0',
      'normal: use a direction [x, y, z]',
      'color: use [r, g, b] of 0..1',
      'opacity: use 0..1',
      'shape: use blob, patch or ring',
      'seed: use a whole number of 0 or more',
      'resolution: use 64, 128 or 256',
    ],
  );
});

test('the baked outline is full in the middle, empty at the border, and repeatable', () => {
  const n = 64;
  const at = (mask, x, y) => mask[y * n + x];
  const border = (mask) => {
    let most = 0;
    for (let i = 0; i < n; i++)
      most = Math.max(most, at(mask, i, 0), at(mask, i, n - 1), at(mask, 0, i), at(mask, n - 1, i));
    return most;
  };
  const blob = bakeZhudaDecalMask({ shape: 'blob', edge: 0.3, ragged: 0, seed: 1, resolution: n });
  assert.equal(at(blob, 32, 32), 255);
  assert.equal(border(blob), 0, 'nothing reaches the border: the rectangle never shows');
  // The edge is soft: some texels are neither empty nor full.
  assert.ok([...blob].some((v) => v > 40 && v < 215));
  const patch = bakeZhudaDecalMask({
    shape: 'patch',
    edge: 0.1,
    ragged: 0,
    seed: 1,
    resolution: n,
  });
  assert.equal(at(patch, 32, 32), 255);
  assert.equal(at(patch, 6, 32), 255, 'a patch is full nearly to its edge');
  assert.equal(border(patch), 0);
  const ring = bakeZhudaDecalMask({ shape: 'ring', edge: 0.3, ragged: 0, seed: 1, resolution: n });
  assert.equal(at(ring, 32, 32), 0, 'a ring is empty in the middle');
  assert.ok(at(ring, 32, 8) > 200, 'and full on its band');
  const ragged = (seed) =>
    bakeZhudaDecalMask({ shape: 'blob', edge: 0.3, ragged: 1, seed, resolution: n });
  assert.deepEqual(ragged(3), ragged(3), 'the same seed, the same outline');
  assert.notDeepEqual(ragged(3), ragged(4));
  assert.equal(border(ragged(3)), 0);
});

test('the rectangle lies in the surface, lifted off it, and faces the way the surface does', () => {
  const corners = (quad) =>
    [0, 1, 2, 3].map((i) =>
      [...quad.positions.subarray(i * 3, i * 3 + 3)].map((v) => +v.toFixed(6)),
    );
  const floor = zhudaDecalQuad(resolveZhudaDecal({ position: [1, 0, 2], size: [2, 4] }));
  // Width along X, length along Z, 4 mm up.
  assert.deepEqual(
    corners(floor).map((p) => p[1]),
    [0.004, 0.004, 0.004, 0.004],
  );
  const xs = corners(floor).map((p) => p[0]),
    zs = corners(floor).map((p) => p[2]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [0, 2]);
  assert.deepEqual([Math.min(...zs), Math.max(...zs)], [0, 4]);
  // The engine's winding: cross(v1 - v0, v2 - v0) points away from the normal.
  const facing = (quad) => {
    const p = corners(quad),
      [a, b, c] = [...quad.indices.subarray(0, 3)].map((i) => p[i]);
    const u = b.map((v, i) => v - a[i]),
      w = c.map((v, i) => v - a[i]);
    const face = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    return face.reduce((s, v, i) => s + v * quad.normals[i], 0);
  };
  assert.ok(facing(floor) < 0);
  // On a wall that faces +Z: in the wall's plane, 4 mm in front of it.
  const wall = zhudaDecalQuad(
    resolveZhudaDecal({ position: [0, 1.5, -2], size: [2, 0.4], normal: [0, 0, 5] }),
  );
  assert.ok(corners(wall).every((p) => Math.abs(p[2] - -1.996) < 1e-6));
  assert.ok(facing(wall) < 0);
  // Turned a quarter: width and length change places.
  const turned = zhudaDecalQuad(
    resolveZhudaDecal({ position: [0, 0, 0], size: [2, 4], angleDeg: 90 }),
  );
  const tx = corners(turned).map((p) => p[0]);
  assert.deepEqual([Math.min(...tx), Math.max(...tx)], [-2, 2]);
});

test('a physically based surface can be drawn with alpha', () => {
  const saved = globalThis.Laya;
  class Material {
    renderMode = 'unset';
  }
  class PBRStandardMaterial extends Material {}
  class UnlitMaterial extends Material {
    static RENDERMODE_TRANSPARENT = 'unlit-transparent';
  }
  globalThis.Laya = {
    PBRStandardMaterial,
    UnlitMaterial,
    PBRRenderMode: { Opaque: 0, Cutout: 1, Fade: 2, Transparent: 3 },
    Color: class {
      constructor(...rgba) {
        this.rgba = rgba;
      }
    },
    RenderState: { CULL_NONE: 0 },
  };
  try {
    // LayaAir 3.4.2 has no PBRStandardMaterial.RENDERMODE_TRANSPARENT: this once set `undefined`.
    const lit = createSurfaceMaterial({ type: 'pbr', blend: 'alpha', color: [1, 1, 1, 0.5] });
    assert.equal(lit.renderMode, 2);
    assert.equal(lit.depthWrite, false);
    const flat = createSurfaceMaterial({ type: 'unlit', blend: 'alpha' });
    assert.equal(flat.renderMode, 'unlit-transparent');
  } finally {
    globalThis.Laya = saved;
  }
});

test('a film scene takes decal nodes', () => {
  const scene = (nodes) => ({
    schemaVersion: 1,
    id: 'marks',
    camera: { eye: [0, 2, 8], target: [0, 1, 0] },
    nodes: [{ id: 'ground', type: 'ground', size: [20, 20], material: 'asphalt' }, ...nodes],
  });
  const context = { props: [], recipes: ['asphalt'] };
  assert.deepEqual(
    validateZhudaFilmScene(
      scene([
        { id: 'oil', type: 'decal', position: [0, 0, 0], size: [1.5, 1], roughness: 0.1 },
        {
          id: 'line',
          type: 'decal',
          position: [0, 1, -2],
          size: [2, 0.2],
          normal: [0, 0, 1],
          shape: 'patch',
          color: [0.9, 0.8, 0.1],
        },
      ]),
      context,
    ),
    [],
  );
  assert.deepEqual(
    validateZhudaFilmScene(
      scene([{ id: 'bad', type: 'decal', position: [0, 0, 0], size: [1], material: 'asphalt' }]),
      context,
    ),
    [
      'scene.nodes[1].material: unknown option (position, size, normal, angleDeg, color, opacity, roughness, shape, edge, ragged, seed, resolution, lift)',
      'scene.nodes[1].size: use [width, length] in metres, both above 0',
    ],
  );
});
