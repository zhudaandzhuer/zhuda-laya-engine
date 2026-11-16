#!/usr/bin/env node
// Real-GPU check of a film look under water (`look.underwater`), through the
// film host on WebGL or WebGPU (ZHUDA_FILM_RENDERER=webgpu), with the
// example scene tests/fixtures/film/underwater.json:
// - under water the view is dimmed per channel (red first) and filled with
//   the water's colour: blue-green where the dry scene is not, more so far
//   off than near;
// - sunlight on the floor is gathered into caustics: the floor varies more
//   in brightness with them than without, and they move with shot time;
// - looking up, the sky shows through the window in the surface and the
//   water's own colour beyond it;
// - above the surface (a scene whose water lies below everything) nothing
//   changes: the frame is byte-identical to the scene without water;
// - no WebGL error and no WebGPU error.
// Desktop GPU evidence only; no phone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { measureZhudaFrame } from '../packages/mcp-server/runtime.mjs';

const renderer = process.env.ZHUDA_FILM_RENDERER === 'webgpu' ? 'webgpu' : 'webgl';
const out = path.resolve(
  process.env.UNDERWATER_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-underwater', renderer),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const scene = JSON.parse(
  fs.readFileSync(new URL('../tests/fixtures/film/underwater.json', import.meta.url), 'utf8'),
);
const W = 480,
  H = 270;
const variant = (id, underwater) => ({
  ...scene,
  id,
  look: { ...scene.look, ...(underwater === undefined ? {} : { underwater }) },
});
const dry = variant('underwater-dry', false);
const flat = variant('underwater-flat', { ...scene.look.underwater, caustics: false });
const host = new ZhudaFilmHost({ renderer });
const report = { renderer };
const frames = {};
const render = async (name, s, camera, time) => {
  const { png } = await host.preview(s, { width: W, height: H, camera, time });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return (frames[name] = PNG.sync.read(png));
};
/** Mean colour over a box of the frame (fractions of width and height). */
const mean = (img, x0, y0, x1, y1) => {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++)
    for (let x = Math.floor(x0 * W); x < Math.floor(x1 * W); x++) {
      const i = (y * W + x) * 4;
      sum[0] += img.data[i];
      sum[1] += img.data[i + 1];
      sum[2] += img.data[i + 2];
      n++;
    }
  return sum.map((v) => +(v / n).toFixed(1));
};
/** Standard deviation of luminance over a box. */
const spread = (img, x0, y0, x1, y1) => {
  const values = [];
  for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++)
    for (let x = Math.floor(x0 * W); x < Math.floor(x1 * W); x++) {
      const i = (y * W + x) * 4;
      values.push(0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]);
    }
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return +Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length).toFixed(2);
};
const differing = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2]
    )
      n++;
  return n;
};
const FLOOR = { eye: [0, 2.6, 9], target: [0.5, 0, 0], focalLengthMm: 24 };
// Pitched 50° up: the window (within 48.6° of overhead) at the top, total reflection below it.
const UP = { eye: [0, 2, 4], target: [0, 9.66, -2.43], focalLengthMm: 18 };
const ABOVE = { eye: [0, 12, 22], target: [0, 1, 0], focalLengthMm: 28 };
try {
  await host.ready();
  report.gpu = host.info.gpu;
  const wet = await render('view-wet', scene);
  const dryView = await render('view-dry', dry);
  report.view = {
    wet: { far: mean(wet, 0, 0, 1, 0.25), near: mean(wet, 0, 0.8, 1, 1) },
    dry: { far: mean(dryView, 0, 0, 1, 0.25), near: mean(dryView, 0, 0.8, 1, 1) },
    metrics: measureZhudaFrame(wet.data, W, H),
  };
  const floorCaustics = await render('floor-caustics', scene, FLOOR, 0);
  const floorLater = await render('floor-caustics-later', scene, FLOOR, 0.6);
  const floorFlat = await render('floor-flat', flat, FLOOR, 0);
  report.caustics = {
    spreadWith: spread(floorCaustics, 0.1, 0.55, 0.9, 1),
    spreadWithout: spread(floorFlat, 0.1, 0.55, 0.9, 1),
    movedPixels: differing(floorCaustics, floorLater),
  };
  const up = await render('look-up', scene, UP, 0);
  report.window = {
    window: mean(up, 0.2, 0.02, 0.8, 0.2),
    reflected: mean(up, 0.2, 0.75, 0.8, 0.95),
  };

  const deepWater = variant('underwater-below-all', { ...scene.look.underwater, surfaceY: -5 });
  const above = await render('above-water-below-all', deepWater, ABOVE, 0);
  const aboveDry = await render('above-dry', dry, ABOVE, 0);
  report.above = { differingPixels: differing(above, aboveDry) };
  report.glErrors = host.takeGlErrors();
} finally {
  await host.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');

const v = report.view;
// Per channel: under water red is taken first, blue last.
assert.ok(
  v.wet.near[0] < v.dry.near[0] * 0.8 && v.wet.near[2] >= v.wet.near[0],
  `red goes first near the eye (wet ${v.wet.near}, dry ${v.dry.near})`,
);
const blueOverRed = (c) => (c[2] + 1) / (c[0] + 1);
assert.ok(
  blueOverRed(v.wet.far) > blueOverRed(v.wet.near),
  `farther water is bluer (far ${v.wet.far}, near ${v.wet.near})`,
);
assert.ok(
  v.wet.far[1] > v.wet.far[0] && v.wet.far[2] > v.wet.far[0],
  `the far view is the water's blue-green (${v.wet.far})`,
);
const c = report.caustics;
assert.ok(
  c.spreadWith > c.spreadWithout * 1.15,
  `caustics put light and dark on the floor (spread ${c.spreadWith} against ${c.spreadWithout})`,
);
assert.ok(c.movedPixels > W * H * 0.05, `caustics move with time (${c.movedPixels} pixels)`);
const lum = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
assert.ok(
  lum(report.window.window) > lum(report.window.reflected) * 1.3,
  `the window overhead is brighter than the surface beyond it (${report.window.window} against ${report.window.reflected})`,
);
assert.equal(report.above.differingPixels, 0, 'above the surface nothing changes');
assert.deepEqual(report.glErrors, [], 'no WebGL error');
console.log(
  `PASS film underwater on ${renderer} (${report.gpu}): ` +
    JSON.stringify({
      view: { wet: v.wet, dry: v.dry, vivid: v.metrics.vivid, flags: v.metrics.flags },
      caustics: c,
      window: report.window,
      above: report.above,
    }) +
    `\nPictures: ${out}`,
);
