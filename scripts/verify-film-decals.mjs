#!/usr/bin/env node
// Real-GPU check of `decal` nodes: a mark laid on a floor and one on a wall
// are drawn where they lie and nowhere else, cover by their opacity, take
// the shadow of the thing above them, have soft edges, and a physically
// based surface drawn with alpha no longer throws.
// Desktop GPU evidence only (WebGL, or WebGPU through verify:film-webgpu);
// not mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_DECALS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-decals'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 480,
  H = 270;
const EYE = [0, 5, 7],
  TARGET = [0, 0.8, 0];
const scene = (decals, shadows = false) => ({
  schemaVersion: 1,
  id: 'decals-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 35 },
  look: {
    sky: [0.2, 0.2, 0.2],
    ambient: [0.5, 0.5, 0.5],
    sun: { azimuthDeg: 90, elevationDeg: 50, intensity: 1.2 },
    shadows: shadows ? { distance: 30, resolution: 2048, cascades: 1, softness: 'hard' } : false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  },
  materials: { pale: { color: [0.7, 0.7, 0.7], roughness: 0.9 } },
  nodes: [
    { id: 'floor', type: 'box', size: [20, 0.2, 20], position: [0, -0.2, 0], material: 'pale' },
    // A wall across the back, its face toward the camera at z = -2.
    { id: 'wall', type: 'box', size: [12, 3, 0.4], position: [0, 0, -2.2], material: 'pale' },
    // A post east of the floor mark: at this sun its shadow falls across the mark.
    { id: 'post', type: 'box', size: [0.3, 2, 0.3], position: [2.2, 0, 1.5], material: 'pale' },
    ...decals,
  ],
});
const stain = (more = {}) => ({
  id: 'stain',
  type: 'decal',
  position: [0, 0, 1.5],
  size: [2, 2],
  color: [0.02, 0.02, 0.02],
  opacity: 1,
  ragged: 0,
  edge: 0.3,
  ...more,
});
const line = {
  id: 'line',
  type: 'decal',
  position: [-2.5, 1.5, -2],
  size: [2, 0.4],
  normal: [0, 0, 1],
  color: [0.9, 0.1, 0.1],
  opacity: 1,
  shape: 'patch',
  edge: 0.05,
};

const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const at = (img, point) => {
  const [x, y] = projectPixel(point, EYE, TARGET, W, H);
  const i = (y * W + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const report = {};
try {
  await host.ready();
  const bare = await render('bare', scene([]));
  const marked = await render('marked', scene([stain(), line]));
  const MIDDLE = [0, 0, 1.5],
    EDGE = [0.72, 0, 1.5],
    BESIDE = [1.5, 0, 1.5],
    ON_LINE = [-2.5, 1.5, -2],
    OFF_LINE = [-2.5, 2.2, -2];
  report.floor = {
    bare: at(bare, MIDDLE)[1],
    middle: at(marked, MIDDLE)[1],
    edge: at(marked, EDGE)[1],
    beside: at(marked, BESIDE)[1],
    besideBare: at(bare, BESIDE)[1],
  };
  assert.ok(report.floor.bare > 120, `the bare floor is pale (${report.floor.bare})`);
  assert.ok(
    report.floor.middle < report.floor.bare * 0.35,
    `the stain is dark at its middle (${report.floor.middle})`,
  );
  assert.ok(
    report.floor.edge > report.floor.middle + 15 && report.floor.edge < report.floor.bare - 15,
    `and fades toward its edge (${report.floor.edge})`,
  );
  assert.ok(
    Math.abs(report.floor.beside - report.floor.besideBare) <= 2,
    `beside it the floor is as it was (${report.floor.beside} against ${report.floor.besideBare})`,
  );
  report.wall = { on: at(marked, ON_LINE), off: at(marked, OFF_LINE), offBare: at(bare, OFF_LINE) };
  assert.ok(
    // The wall faces away from the sun: the line is as dim as the wall, and red.
    report.wall.on[0] > report.wall.on[1] * 2.5 && report.wall.on[0] > report.wall.offBare[0],
    `the red line lies on the wall (${report.wall.on})`,
  );
  assert.deepEqual(report.wall.off, report.wall.offBare, 'and the wall above it is as it was');

  // Half as opaque: half way between the stain and the floor.
  const half = await render('half', scene([stain({ opacity: 0.5 })]));
  report.half = at(half, MIDDLE)[1];
  assert.ok(
    report.half > report.floor.middle + 20 && report.half < report.floor.bare - 20,
    `at opacity 0.5 the floor shows through (${report.half})`,
  );

  // A pale mark takes the post's shadow as the floor does.
  const paleMark = stain({ color: [0.9, 0.9, 0.2], position: [0.6, 0, 1.5] });
  const lit = await render('lit', scene([paleMark], false));
  const shaded = await render('shaded', scene([paleMark], true));
  const IN_SHADOW = [0.9, 0, 1.5];
  report.shadow = { without: at(lit, IN_SHADOW)[0], with: at(shaded, IN_SHADOW)[0] };
  assert.ok(
    report.shadow.with < report.shadow.without - 25,
    `the mark is darker in the post's shadow (${report.shadow.without} -> ${report.shadow.with})`,
  );

  // The same seed draws the same blob; another seed another.
  const blob = (seed) => scene([stain({ ragged: 1, seed })]);
  const first = await render('blob-1', blob(1)),
    again = await render('blob-1-again', blob(1)),
    other = await render('blob-2', blob(2));
  assert.ok(first.data.equals(again.data), 'the same seed draws the same mark');
  assert.ok(!first.data.equals(other.data), 'another seed draws another');

  for (let i = 0; i < 20; i++) await host.mountReport(scene(i % 2 ? [stain(), line] : []));
  assert.ok(
    (await render('marked-again', scene([stain(), line]))).data.equals(marked.data),
    'identical after 20 mounts with and without the marks',
  );
  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await host.close();
}
