#!/usr/bin/env node
// Real WebGL check of `look.environment`: a mirror-like box must show a lit
// object where a mirror would (behind the camera, to the side, above), and a
// rough white box must pick up the colour of a light source on the side that
// faces it. Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_ENVIRONMENT_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-environment'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const W = 480,
  H = 270;
const materials = {
  mirror: { color: [1, 1, 1], metallic: 1, roughness: 0.03 },
  chalk: { color: [1, 1, 1], metallic: 0, roughness: 1 },
  red: { color: [0, 0, 0], emission: [4, 0, 0] },
  green: { color: [0, 0, 0], emission: [0, 4, 0] },
  blue: { color: [0, 0, 0], emission: [0, 0, 4] },
};
const lamp = (id, material, centre, size = 5) => ({
  id,
  type: 'box',
  size: [size, size, size],
  position: [centre[0], centre[1] - size / 2, centre[2]],
  material,
});
const scene = ({ eye, target, box = 'mirror', lamps, environment = true }) => ({
  schemaVersion: 1,
  id: 'environment-check',
  camera: { eye, target, focalLengthMm: 35 },
  look: {
    sky: [0, 0, 0],
    ambient: [0, 0, 0],
    sun: { intensity: 0 },
    shadows: false,
    ...(environment ? { environment: { position: [0, 1, 0] } } : {}),
  },
  materials,
  // The box spans -1..1 in x and z and 0..2 in y; the probe sits at its centre.
  nodes: [
    { id: 'box', type: 'box', size: [2, 2, 2], position: [0, 0, 0], material: box },
    ...lamps,
  ],
});
const host = new ZhudaFilmHost();
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const patch = (img, [x, y]) => {
  const sum = [0, 0, 0];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * W + x + dx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
    }
  return sum.map((value) => +(value / 25).toFixed(1));
};
/** Where a mirror at `point` with `normal` sends the camera's view, `distance` metres away. */
const mirrored = (eye, point, normal, distance) => {
  const v = point.map((p, i) => p - eye[i]),
    length = Math.hypot(...v),
    d = v.map((c) => c / length),
    dn = d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2];
  return point.map((p, i) => p + (d[i] - 2 * dn * normal[i]) * distance);
};
const report = {};
const check = async (name, eye, point, normal, wrong, size = 5) => {
  const right = mirrored(eye, point, normal, 12);
  const img = await render(
    name,
    scene({
      eye,
      target: point,
      lamps: [lamp('right', 'red', right, size), lamp('wrong', 'green', wrong(right), size)],
    }),
  );
  const colour = patch(img, projectPixel(point, eye, point, W, H));
  report[name] = colour;
  assert.ok(
    colour[0] > 90 && colour[0] > colour[1] * 3,
    `${name}: the mirror shows the red lamp, got ${colour}`,
  );
};
try {
  await host.ready();
  // 1. Straight on: the lamp behind the camera shows in the +Z face.
  await check('behind', [0, 1, 6], [0, 1, 1], [0, 0, 1], (p) => [p[0], p[1], -p[2]]);
  // 2. From the side: the reflection goes to -X; a lamp mirrored in X must not show.
  await check('side', [5, 1, 5], [0.3, 1, 1], [0, 0, 1], (p) => [-p[0], p[1], p[2]]);
  // 3. From above onto the top face: the reflection goes up and away; mirrored in Z must not show.
  await check('above', [0, 6, 6], [0, 2, 0.3], [0, 1, 0], (p) => [p[0], p[1], -p[2]]);
  // 4. The +X face seen from +X shows a lamp at +X and not one at -X.
  await check('east', [6, 1, 0.5], [1, 1, 0.2], [1, 0, 0], (p) => [-p[0], p[1], p[2]]);
  // 4b. Nearly straight up: the +Y face of the cube, with small lamps so that
  // a lamp mirrored in X or in Z would be missed.
  await check('zenith-x', [1.5, 8, 1.5], [0.4, 2, 0.3], [0, 1, 0], (p) => [-p[0], p[1], p[2]], 2.5);
  await check('zenith-z', [1.5, 8, 1.5], [0.4, 2, 0.3], [0, 1, 0], (p) => [p[0], p[1], -p[2]], 2.5);
  // 5. Without the environment the mirror is black.
  const none = await render(
    'no-environment',
    scene({
      eye: [0, 1, 6],
      target: [0, 1, 1],
      lamps: [lamp('right', 'red', [0, 1, 13])],
      environment: false,
    }),
  );
  report.none = patch(none, [W / 2, H / 2]);
  assert.ok(Math.max(...report.none) < 4, 'no environment, no reflection');

  // 6. Ambient: a rough white box is redder on the side facing a red lamp.
  const red = [lamp('west', 'red', [-12, 1, 0], 10)];
  const facing = await render(
    'ambient-facing',
    scene({ eye: [-6, 1, 0.01], target: [-1, 1, 0], box: 'chalk', lamps: red }),
  );
  const away = await render(
    'ambient-away',
    scene({ eye: [6, 1, 0.01], target: [1, 1, 0], box: 'chalk', lamps: red }),
  );
  report.ambient = { facing: patch(facing, [W / 2, H / 2]), away: patch(away, [W / 2, H / 2]) };
  assert.ok(
    report.ambient.facing[0] > report.ambient.away[0] + 25,
    'the side facing the lamp gets more of its light',
  );
  assert.ok(report.ambient.facing[0] > report.ambient.facing[2] * 3, 'and its colour');

  // 7. 30 mounts with and without the environment, then the first frame again.
  const first = scene({
    eye: [0, 1, 6],
    target: [0, 1, 1],
    lamps: [lamp('right', 'red', [0, 1, 13])],
  });
  const before = await render('cycle-first', first);
  for (let i = 0; i < 30; i++)
    await host.mountReport(
      scene({
        eye: [0, 1, 6],
        target: [0, 1, 1],
        lamps: [lamp('l' + i, 'blue', [0, 1, 13])],
        environment: i % 2 === 0,
      }),
    );
  assert.ok(
    (await render('cycle-again', first)).data.equals(before.data),
    'identical after 30 mounts',
  );

  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
