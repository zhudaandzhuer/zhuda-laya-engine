#!/usr/bin/env node
// Real WebGL check that a colour is the same light wherever a look uses it.
// Ambient light of 0.5 with the ground's light beside it lights a floor as
// flat ambient light of 0.5 does, and fog of 0.5 fills an empty view as a sky
// of 0.5 does. Until the colours were unified, both were read as light (0.5
// gave 50 %) where every other colour is a display value (0.5 gives 21 %).
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_COLOURS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-colours'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 160,
  H = 90;
const grade = { exposure: 1, bloom: 0, ao: 0, antialias: 'none' };
const floor = (look) => ({
  schemaVersion: 1,
  id: 'colour-floor',
  camera: { eye: [0, 6, 0.01], target: [0, 0, 0] },
  look: { sky: [0, 0, 0], sun: { intensity: 0 }, shadows: false, grade, ...look },
  materials: { grey: { color: [0.8, 0.8, 0.8], roughness: 1 } },
  nodes: [
    { id: 'floor', type: 'box', size: [20, 0.2, 20], position: [0, -0.2, 0], material: 'grey' },
  ],
});
const empty = (look) => ({
  schemaVersion: 1,
  id: 'colour-sky',
  camera: { eye: [0, 2, 10], target: [0, 2, 0] },
  look: { ambient: [0, 0, 0], sun: { intensity: 0 }, shadows: false, grade, ...look },
  nodes: [],
});

const host = new ZhudaFilmHost({});
const centre = async (name, scene) => {
  const { png } = await host.preview(scene, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  const img = PNG.sync.read(png);
  const i = (Math.round(H / 2) * W + Math.round(W / 2)) * 4;
  return img.data[i + 1];
};
const report = {};
try {
  await host.ready();
  const half = [0.5, 0.5, 0.5];
  report.flatAmbient = await centre('flat-ambient', floor({ ambient: half }));
  report.skyAndGround = await centre(
    'sky-and-ground',
    floor({ ambient: half, ambientGround: half }),
  );
  report.flatAmbientFull = await centre('flat-ambient-full', floor({ ambient: [1, 1, 1] }));
  assert.ok(report.flatAmbientFull > report.flatAmbient + 30, 'the floor shows the ambient light');
  assert.ok(
    Math.abs(report.skyAndGround - report.flatAmbient) <= 3,
    'ambient light of 0.5 from sky and ground lights the floor as flat ambient light of 0.5',
  );

  report.sky = await centre('sky', empty({ sky: half }));
  // 0.735 is the display value of half the light: what fog of 0.5 drew before.
  report.skyOfHalfTheLight = await centre('sky-half-light', empty({ sky: [0.735, 0.735, 0.735] }));
  report.fog = await centre(
    'fog',
    empty({ sky: [0, 0, 0], lightFog: { density: 0.2, color: half, scatter: 0 } }),
  );
  assert.ok(report.skyOfHalfTheLight > report.sky + 20, 'the two skies differ');
  assert.ok(Math.abs(report.fog - report.sky) <= 3, 'fog of 0.5 fills the view as a sky of 0.5');

  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
