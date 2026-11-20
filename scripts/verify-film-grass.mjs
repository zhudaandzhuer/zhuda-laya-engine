#!/usr/bin/env node
// Real WebGL check of a film scene's `grass` node (ZhudaGrassField through
// the scene format): bare earth turns green where the node says, stays bare
// on a `clear` strip and under a slab that lies on the ground, and the
// blades move with shot time. Desktop GPU evidence only (WebGL, or WebGPU
// through verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_GRASS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-grass'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 720,
  H = 405,
  LENS = 28;
const CAMERA = { eye: [0, 1.6, 12], target: [0, 0.4, 0] };
const scene = (id, grass) => ({
  schemaVersion: 1,
  id,
  camera: { ...CAMERA, focalLengthMm: LENS },
  look: {
    preset: 'day',
    sun: { azimuthDeg: 135, elevationDeg: 40, intensity: 1.3 },
    shadows: { distance: 60, resolution: 2048, cascades: 2 },
    fog: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  },
  materials: {
    earth: { color: [0.36, 0.25, 0.16], roughness: 1 },
    stone: { color: [0.6, 0.58, 0.55], roughness: 1 },
  },
  nodes: [
    { id: 'ground', type: 'ground', size: [300, 300], material: 'earth' },
    { id: 'slab', type: 'box', size: [3, 0.08, 3], position: [4, 0, 4], material: 'stone' },
    ...(grass
      ? [
          {
            id: 'meadow',
            type: 'grass',
            area: { minX: -40, maxX: 40, minZ: -60, maxZ: 12 },
            ...grass,
          },
        ]
      : []),
  ],
});
const host = new ZhudaFilmHost({});
const render = async (name, s, time = 0) => {
  const { png } = await host.preview(s, { width: W, height: H, time });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const isGreen = (img, i) =>
  img.data[i + 1] > img.data[i] * 1.03 && img.data[i + 1] > img.data[i + 2] * 1.3;
/** The share of green pixels in a box round a point of the ground. */
const greenAt = (img, point, half = 10) => {
  const [cx, cy] = projectPixel(point, CAMERA.eye, CAMERA.target, W, H, LENS);
  let g = 0,
    n = 0;
  for (let y = Math.max(0, cy - half); y < Math.min(H, cy + half); y++)
    for (let x = Math.max(0, cx - half); x < Math.min(W, cx + half); x++, n++)
      if (isGreen(img, (y * W + x) * 4)) g++;
  return +(g / n).toFixed(3);
};
const moved = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i + 1] - b.data[i + 1]) > 6) n++;
  return n;
};
const report = {};
try {
  await host.ready();
  report.gpu = host.info?.gpu;
  const bare = await render('bare', scene('grass-bare'));
  const ROAD = { minX: -7, maxX: -4, minZ: -60, maxZ: 12 };
  const grown = await render('grown', scene('grass-grown', { clear: [ROAD] }));
  const later = await render('grown-later', scene('grass-grown', { clear: [ROAD] }), 0.9);
  const under = await render(
    'grown-under',
    scene('grass-under', { clear: [ROAD], avoidSolids: false }),
  );
  const open = [0, 0, 5],
    road = [-5.5, 0, 5],
    beside = [1.6, 0, 4]; // just left of the slab's edge
  report.green = {
    bare: greenAt(bare, open),
    open: greenAt(grown, open),
    road: greenAt(grown, road, 6),
    far: greenAt(grown, [0, 0, -25]),
  };
  report.wind = moved(grown, later);
  // A slab 8 cm thick: stone where nothing grows under it, blades through it where grass does.
  report.block = { kept: greenAt(grown, [4, 0.08, 4], 8), under: greenAt(under, [4, 0.08, 4], 8) };
  report.beside = greenAt(grown, beside, 5);
  const g = report.green;
  assert.ok(g.bare < 0.02, `bare earth is not green (${g.bare})`);
  assert.ok(g.open > 0.8, `the meadow is green (${g.open})`);
  assert.ok(g.far > 0.6, `and green 37 m off (${g.far})`);
  assert.ok(g.road < 0.15, `the cleared strip stays earth (${g.road})`);
  assert.ok(report.beside > 0.6, `grass grows up to the slab (${report.beside})`);
  assert.ok(
    report.block.under > report.block.kept + 0.05,
    `nothing grows under the slab unless told (${report.block.kept} green on it, ${report.block.under} with avoidSolids false)`,
  );
  assert.ok(report.wind > W * H * 0.03, `the blades move with shot time (${report.wind} pixels)`);
  report.glErrors = host.takeGlErrors?.() ?? [];
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  report.ok = true;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, ...report }, null, 2));
} catch (error) {
  report.ok = false;
  report.error = String(error?.message || error);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.error(JSON.stringify({ out, ...report }, null, 2));
  process.exitCode = 1;
} finally {
  await host.close();
}
