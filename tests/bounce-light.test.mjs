// Light bounced once off the scene: the probe grid, the picture LayaAir's
// volumetric GI reads, and the film look field. Pure checks; the draw is
// verify:film-bounce.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateZhudaProbeVolume,
  zhudaAtlasFace,
  zhudaIrradianceAtlas,
  zhudaOctahedralDirection,
  zhudaProbeCounts,
  zhudaProbeDistanceAtlas,
  zhudaProbeDistanceTile,
  ZhudaProbeVolume,
} from '../packages/core/runtime3d/ProbeVolume.ts';
import { evaluateZhudaAmbient } from '../packages/core/runtime3d/EnvironmentProbe.ts';
import {
  resolveZhudaFilmLook,
  validateZhudaFilmScene,
  zhudaFilmBounceBox,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';

test('the grid has about one probe every spacing metres, within the limits', () => {
  assert.deepEqual(zhudaProbeCounts([-6, 0, -6], [6, 3, 6]), [4, 1, 4]);
  assert.deepEqual(zhudaProbeCounts([-6, 0, -6], [6, 3, 6], 1.5), [8, 2, 8]);
  // At most 16 a side and 512 in all.
  assert.deepEqual(zhudaProbeCounts([0, 0, 0], [100, 2, 100], 1), [16, 2, 16]);
  const big = zhudaProbeCounts([0, 0, 0], [100, 100, 100], 1);
  assert.ok(big[0] * big[1] * big[2] <= 512 && big.every((n) => n <= 16));
  assert.deepEqual(
    validateZhudaProbeVolume({ min: [0, 0, 0], max: [1, 1, 1], counts: [2, 2, 2] }),
    [],
  );
  assert.deepEqual(
    validateZhudaProbeVolume({
      min: [0, 2, 0],
      max: [1, 1, 1],
      counts: [17, 1, 1],
      captureSize: 20,
      strength: 9,
    }),
    [
      'min: below max on every axis',
      'counts: use three whole numbers 1..16',
      'captureSize: use 16, 32 or 64',
      'strength: use 0..4',
    ],
  );
  const volume = new ZhudaProbeVolume({}, { min: [-3, 0, -3], max: [3, 3, 3], counts: [4, 2, 4] });
  assert.equal(volume.probes, 32);
  // Cell centres, x fastest, as LayaAir places them.
  assert.deepEqual(volume.probePosition(0), [-2.25, 0.75, -2.25]);
  assert.deepEqual(volume.probePosition(5), [-0.75, 2.25, -2.25]);
  assert.deepEqual(volume.probePosition(31), [2.25, 2.25, 2.25]);
});

test('a face is cut out of a read-back picture of tiles, mirrored when asked', () => {
  // A picture 3 tiles wide and 2 high, tiles 2 by 2; each texel holds its own column and row.
  const n = 2,
    width = 3 * n,
    height = 2 * n,
    picture = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) picture.set([x, y, 0, 1], (y * width + x) * 4);
  const columns = (face) => Array.from({ length: n * n }, (_, i) => face[i * 4]);
  const rows = (face) => Array.from({ length: n * n }, (_, i) => face[i * 4 + 1]);
  const plain = zhudaAtlasFace(picture, width, n, 2, 1);
  assert.deepEqual(columns(plain), [4, 5, 4, 5]);
  assert.deepEqual(rows(plain), [2, 2, 3, 3]);
  assert.deepEqual(columns(zhudaAtlasFace(picture, width, n, 2, 1, true)), [5, 4, 5, 4]);
  assert.deepEqual(validateZhudaProbeVolume({ min: [0, 0, 0], max: [1, 1, 1], batch: 17 }), [
    'batch: use a whole number 1..16',
  ]);
});

test('octahedral directions match LayaAir’s decoding', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(zhudaOctahedralDirection(0, 0), [0, 0, 1]));
  assert.ok(near(zhudaOctahedralDirection(1, 0), [1, 0, 0]));
  assert.ok(near(zhudaOctahedralDirection(0, -1), [0, -1, 0]));
  // The outer half folds onto the back.
  assert.ok(near(zhudaOctahedralDirection(1, 1), [0, 0, -1]));
  for (const [x, y] of [
    [0.3, -0.4],
    [-0.9, 0.6],
    [0.2, 0.95],
  ])
    assert.ok(Math.abs(Math.hypot(...zhudaOctahedralDirection(x, y)) - 1) < 1e-9);
});

test('the atlas has one 8 by 8 tile per probe, its border copied across the opposite edges', () => {
  // Light from -X only: a probe that sees a red wall on that side.
  const sh = new Array(27).fill(0);
  sh[0] = sh[1] = sh[2] = 0.3; // even part
  sh[9] = 0.2; // the X band, red channel
  const atlas = zhudaIrradianceAtlas([2, 1, 2], () => sh, 2);
  assert.equal(atlas.width, 2 * 1 * 8);
  assert.equal(atlas.height, 2 * 8);
  const texel = (column, row, p, q) =>
    Array.from(
      atlas.data.subarray(
        ((row * 8 + q) * atlas.width + column * 8 + p) * 4,
        ((row * 8 + q) * atlas.width + column * 8 + p) * 4 + 3,
      ),
    );
  // The texel LayaAir reads for a normal along -X (inner column 1, middle rows)
  // holds what the nine colours give that normal, X mirrored as measured, times strength.
  const minusX = evaluateZhudaAmbient(sh, 1, 0, 0).map((v) => v * 2);
  const read = texel(0, 0, 1, 3).map((v, i) => (v + texel(0, 0, 1, 4)[i]) / 2);
  assert.ok(Math.abs(read[0] - minusX[0]) < 0.05, `${read} / ${minusX}`);
  // Borders repeat the texel across the edge: top row reversed, corners diagonal.
  for (let p = 1; p < 7; p++) {
    assert.deepEqual(texel(1, 1, p, 0), texel(1, 1, 7 - p, 1));
    assert.deepEqual(texel(1, 1, p, 7), texel(1, 1, 7 - p, 6));
    assert.deepEqual(texel(1, 1, 0, p), texel(1, 1, 1, 7 - p));
    assert.deepEqual(texel(1, 1, 7, p), texel(1, 1, 6, 7 - p));
  }
  assert.deepEqual(texel(0, 0, 3, 0), texel(0, 0, 4, 1));
  assert.deepEqual(texel(0, 0, 0, 3), texel(0, 0, 1, 4));
  assert.deepEqual(texel(0, 0, 0, 0), texel(0, 0, 6, 6));
  assert.deepEqual(texel(0, 0, 7, 7), texel(0, 0, 1, 1));
  // Every alpha is 1.
  for (let i = 3; i < atlas.data.length; i += 4) assert.equal(atlas.data[i], 1);
});

test('a film look takes bounce light; its box defaults to the objects and lights', () => {
  const scene = (look, nodes = []) => ({
    schemaVersion: 1,
    id: 'bounce',
    camera: { eye: [0, 2, 8], target: [0, 1, 0] },
    look,
    nodes: [{ id: 'ground', type: 'ground', size: [40, 40], material: 'asphalt' }, ...nodes],
  });
  const context = { props: [], recipes: ['asphalt'] };
  assert.deepEqual(validateZhudaFilmScene(scene({ bounceLight: { spacing: 2 } }), context), []);
  assert.deepEqual(
    validateZhudaFilmScene(
      scene({ bounceLight: { spacing: 0.5, min: [0, 0, 0], strenght: 1 } }),
      context,
    ),
    [
      'scene.look.bounceLight.strenght: unknown field (did you mean strength?)',
      'scene.look.bounceLight.spacing: use 1..20',
      'scene.look.bounceLight: give min and max together',
    ],
  );
  assert.equal(resolveZhudaFilmLook({}).bounceLight, false);
  assert.deepEqual(resolveZhudaFilmLook({ bounceLight: {} }).bounceLight, {
    spacing: 3,
    strength: 1,
    visibility: false,
  });
  const on = resolveZhudaFilmLook({ preset: 'day', bounceLight: {} });
  assert.equal(zhudaLookForQuality(on, 1).bounceLight.spacing, 3);
  assert.equal(zhudaLookForQuality(on, 0).bounceLight, false);
  // It is captured when the scene is mounted: changing it needs a mount.
  assert.equal(
    zhudaFilmLookRebuildReason(
      on,
      resolveZhudaFilmLook({ preset: 'day', bounceLight: { strength: 2 } }),
    ),
    'bounceLight',
  );
  assert.equal(zhudaFilmBounceBox(scene({})), null);
  const box = zhudaFilmBounceBox(
    scene({}, [
      { id: 'wall', type: 'box', size: [0.3, 3, 6], position: [-2, 0, 0], material: 'asphalt' },
      { id: 'lamp', type: 'light', kind: 'point', position: [2, 3, 1] },
      // A slab used as ground is left out.
      { id: 'slab', type: 'box', size: [30, 0.2, 30], position: [0, -0.2, 0], material: 'asphalt' },
    ]),
  );
  const reach = Math.hypot(0.3, 6) / 2;
  const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  // The wall's half diagonal around it, the lamp's place, 2 m around, 1.5 m above.
  assert.ok(close(box.min, [-2 - reach - 2, 0, -reach - 2]), `${box.min}`);
  assert.ok(close(box.max, [2.5 + 2, 3.5 + 1.5, reach + 2]), `${box.max}`);
});

test('a probe keeps how far it sees: a tile of mean and mean squared distances', () => {
  // A cube picture of distances: 2 m toward +X, 10 m everywhere else.
  const n = 16,
    data = new Float32Array(n * n * 24);
  for (let face = 0; face < 6; face++)
    for (let i = 0; i < n * n; i++) data[(face * n * n + i) * 4] = face === 0 ? 2 : 10;
  const tile = zhudaProbeDistanceTile({ size: n, data });
  assert.equal(tile.length, 16 * 16 * 2);
  // The texel of a direction: inner texels 1..14 span -1..1 of the octahedron.
  const at = (x, y) => {
    const p = Math.round(((x + 1) / 2) * 14 + 0.5),
      q = Math.round(((y + 1) / 2) * 14 + 0.5);
    return [tile[(q * 16 + p) * 2], tile[(q * 16 + p) * 2 + 1]];
  };
  // +X is (1, 0) on the octahedron's rim; -X is (-1, 0); +Z the middle.
  const [toward, towardSquare] = at(0.93, 0),
    [away, awaySquare] = at(-0.93, 0),
    [up] = at(0, 0);
  assert.ok(Math.abs(toward - 2) < 0.6, `about 2 m toward the near wall (${toward})`);
  assert.ok(Math.abs(away - 10) < 0.01 && Math.abs(up - 10) < 0.6, 'and 10 m the other ways');
  // Where all the lobe sees one distance the two means agree: no spread.
  assert.ok(Math.abs(awaySquare - away * away) < 0.01);
  assert.ok(
    towardSquare >= toward * toward - 1e-6,
    'the mean square is never under the squared mean',
  );
  // The border repeats the texel across the edge, as the irradiance tile does.
  assert.equal(tile[(0 * 16 + 5) * 2], tile[(1 * 16 + 10) * 2]);
});

test('the distance picture tests the probes that have a tile and silences the ones that are off', () => {
  const tile = new Float32Array(16 * 16 * 2).fill(3);
  const atlas = zhudaProbeDistanceAtlas([2, 1, 1], [false, true], [tile, undefined]);
  assert.deepEqual([atlas.width, atlas.height], [32, 16]);
  const texel = (probe, p, q) => [
    ...atlas.data.subarray((q * 32 + probe * 16 + p) * 4, (q * 32 + probe * 16 + p) * 4 + 4),
  ];
  assert.deepEqual(
    texel(0, 4, 4),
    [3, 3, 1, 1],
    'mean, mean square, and the mark that it is tested',
  );
  assert.deepEqual(
    texel(1, 4, 4).map((v) => +v.toFixed(4)),
    [0.0001, 0, 1, 1],
    'an off probe sees nothing',
  );
  // Without tiles nothing is tested, as before.
  const plain = zhudaProbeDistanceAtlas([2, 1, 1], [false, false]);
  assert.ok(plain.data.every((v) => v === 0));
});

test('visibility is an option of the volume and of the look', () => {
  assert.deepEqual(
    validateZhudaProbeVolume({ min: [0, 0, 0], max: [1, 1, 1], visibility: 'yes' }),
    ['visibility: true or false'],
  );
  assert.equal(resolveZhudaFilmLook({ bounceLight: {} }).bounceLight.visibility, false);
  assert.equal(
    resolveZhudaFilmLook({ bounceLight: { visibility: true } }).bounceLight.visibility,
    true,
  );
  assert.ok(
    validateZhudaFilmScene({
      schemaVersion: 1,
      id: 's',
      camera: { eye: [0, 1, 5], target: [0, 1, 0] },
      look: { bounceLight: { visibility: 1 } },
      materials: {},
      nodes: [],
    }).includes('scene.look.bounceLight.visibility: true or false'),
  );
});
