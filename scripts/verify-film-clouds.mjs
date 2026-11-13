#!/usr/bin/env node
// Real-GPU check of `look.clouds`: a layer of clouds is drawn in the sky and
// not in front of what is solid, covers by `coverage`, is lit by the look's
// sun, drifts with shot time and draws the same sky at the same time.
// Desktop GPU evidence only (WebGL, or WebGPU through verify:film-webgpu);
// not mobile, frame times or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_CLOUDS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-clouds'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 480,
  H = 270;
const EYE = [0, 1.7, 0],
  TARGET = [0, 6, -10];
const scene = (clouds, more = {}) => ({
  schemaVersion: 1,
  id: 'clouds-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 24 },
  look: {
    sky: [0.15, 0.3, 0.7],
    ambient: [0.5, 0.55, 0.65],
    sun: { azimuthDeg: 200, elevationDeg: 50, intensity: 2, color: [1, 0.97, 0.9] },
    shadows: false,
    fog: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
    ...(clouds ? { clouds } : {}),
    ...more,
  },
  materials: { stone: { color: [0.5, 0.5, 0.5], roughness: 1 } },
  nodes: [
    { id: 'ground', type: 'box', size: [200, 0.2, 200], position: [0, -0.2, 0], material: 'stone' },
    // A tower in the left of the view, in front of the sky.
    { id: 'tower', type: 'box', size: [3, 30, 3], position: [-7, 0, -18], material: 'stone' },
  ],
});
const host = new ZhudaFilmHost({});
const render = async (name, s, time) => {
  const { png } = await host.preview(s, { width: W, height: H, time });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
/** Mean colour of the sky to the right of the tower, upper two thirds of the frame. */
const sky = (img) => {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = 10; y < 170; y += 2)
    for (let x = 220; x < 470; x += 2) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
      n++;
    }
  return sum.map((v) => +(v / n).toFixed(1));
};
const diff = (a, b) => {
  let s = 0,
    n = 0;
  for (let y = 10; y < 170; y += 2)
    for (let x = 220; x < 470; x += 2) {
      const i = (y * W + x) * 4;
      s += Math.abs(a.data[i] - b.data[i]);
      n++;
    }
  return +(s / n).toFixed(2);
};
const at = (img, point) => {
  const [x, y] = projectPixel(point, EYE, TARGET, W, H, 24);
  const i = (y * W + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const LAYER = { baseMeters: 400, thicknessMeters: 300, sizeMeters: 500, steps: 48 };
const report = {};
try {
  await host.ready();
  const clear = await render('clear', scene());
  const overcast = await render('overcast', scene({ ...LAYER, coverage: 1 }));
  const broken = await render('broken', scene({ ...LAYER, coverage: 0.5 }));
  const none = await render('none', scene({ ...LAYER, coverage: 0 }));
  report.sky = { clear: sky(clear), overcast: sky(overcast), broken: sky(broken), none: sky(none) };
  const blue = ([r, , b]) => b - r;
  assert.ok(blue(report.sky.clear) > 60, `the clear sky is blue (${report.sky.clear})`);
  assert.ok(
    blue(report.sky.overcast) < blue(report.sky.clear) * 0.4 && report.sky.overcast[0] > 80,
    `full cover turns it to cloud (${report.sky.overcast})`,
  );
  assert.ok(
    blue(report.sky.broken) < blue(report.sky.clear) - 8 &&
      blue(report.sky.broken) > blue(report.sky.overcast) + 8,
    `half cover lies between (${report.sky.broken})`,
  );
  assert.ok(diff(none, clear) < 1, `no cover is the clear sky (${diff(none, clear)})`);

  // What is solid stands in front: the tower is as it was.
  const TOWER = [-7, 12, -16.5];
  report.tower = { clear: at(clear, TOWER), overcast: at(overcast, TOWER) };
  assert.deepEqual(report.tower.overcast, report.tower.clear, 'the tower is not clouded over');
  assert.ok(
    Math.abs(report.tower.clear[0] - report.tower.clear[2]) < 40,
    `and the place measured is the tower, not the sky (${report.tower.clear})`,
  );

  // The sun lights them.
  const dim = await render(
    'overcast-no-sun',
    scene({ ...LAYER, coverage: 1 }, { sun: { azimuthDeg: 200, elevationDeg: 50, intensity: 0 } }),
  );
  report.sun = { with: sky(overcast)[0], without: sky(dim)[0] };
  assert.ok(
    report.sun.with > report.sun.without + 20,
    `the sun lights the clouds (${report.sun.without} -> ${report.sun.with})`,
  );

  // They drift with shot time, and the same time is the same sky.
  const windy = scene({ ...LAYER, coverage: 0.5, wind: [60, 0] });
  const t0 = await render('drift-0', windy, 0),
    t5 = await render('drift-5', windy, 5),
    again = await render('drift-0-again', windy, 0);
  report.drift = { moved: diff(t0, t5), same: diff(t0, again) };
  assert.ok(report.drift.moved > 3, `five seconds of wind move them (${report.drift.moved})`);
  assert.equal(report.drift.same, 0, 'the same time draws the same sky');

  for (let i = 0; i < 12; i++)
    await host.mountReport(scene(i % 2 ? { ...LAYER, coverage: 1 } : undefined));
  assert.ok(
    (await render('overcast-again', scene({ ...LAYER, coverage: 1 }))).data.equals(overcast.data),
    'identical after 12 mounts with and without clouds',
  );
  assert.ok(
    (await render('clear-again', scene())).data.equals(clear.data),
    'and so is the clear sky',
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
