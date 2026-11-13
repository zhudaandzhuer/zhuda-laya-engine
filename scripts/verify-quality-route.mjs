#!/usr/bin/env node
// Real WebGL check of the two example scenes of the quality route
// (docs/quality-route.md): each must draw with no advice, no metrics flag and
// no WebGL error; the day scene must show the shadows its look asks for and
// the night scene the reflection of its wet ground, over a `ground` node.
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import {
  QUALITY_ROUTE_SCENES,
  STARTER_TILE_METERS,
} from '../packages/mcp-server/quality-route.mjs';
import { lintZhudaFilmScene, measureZhudaFrame } from '../packages/mcp-server/runtime.mjs';

const out = path.resolve(
  process.env.QUALITY_ROUTE_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-quality-route'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 640,
  H = 360;
/** Mean difference in luminance (0..255) between two frames over rows `from`..`to`. */
const difference = (a, b, from = 0, to = H) => {
  let sum = 0;
  for (let i = from * W * 4; i < to * W * 4; i += 4)
    sum += Math.abs(
      0.2126 * (a.data[i] - b.data[i]) +
        0.7152 * (a.data[i + 1] - b.data[i + 1]) +
        0.0722 * (a.data[i + 2] - b.data[i + 2]),
    );
  return +(sum / ((to - from) * W)).toFixed(2);
};

const host = new ZhudaFilmHost({});
const render = async (name, scene) => {
  const { png } = await host.preview(scene, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const report = { metrics: {} };
try {
  await host.ready();
  const frames = {};
  for (const [name, scene] of Object.entries(QUALITY_ROUTE_SCENES)) {
    assert.deepEqual(
      lintZhudaFilmScene(scene, { tileMeters: STARTER_TILE_METERS }),
      [],
      name + ': a scene on the route gets no advice',
    );
    frames[name] = await render(name, scene);
    const metrics = measureZhudaFrame(frames[name].data, W, H);
    report.metrics[name] = metrics;
    assert.deepEqual(metrics.flags, [], name + ': the frame raises no metrics flag');
  }

  const day = QUALITY_ROUTE_SCENES['day-yard'];
  const unshadowed = await render('day-yard-no-shadows', {
    ...day,
    look: { ...day.look, shadows: false },
  });
  report.shadows = difference(frames['day-yard'], unshadowed);
  assert.ok(report.shadows > 0.8, 'the day scene shows the shadows of its look');

  // The lower third of the frame is wet ground with lamps above it.
  const night = QUALITY_ROUTE_SCENES['night-wet'];
  const dry = await render('night-wet-dry', {
    ...night,
    nodes: night.nodes.filter((node) => node.type !== 'reflector'),
  });
  report.reflection = difference(frames['night-wet'], dry, Math.round(H * 0.66), H);
  assert.ok(
    report.reflection > 2,
    'the night scene mirrors its lamps in the wet ground, over a ground node',
  );

  // The lamps and the spot light the night scene: without either the frame
  // changes. (A change to the scene's uniforms once left every point and spot
  // light dark in scenes like this one while a single lamp still worked.)
  const without = async (name, kind) =>
    difference(
      frames['night-wet'],
      await render(name, {
        ...QUALITY_ROUTE_SCENES['night-wet'],
        nodes: QUALITY_ROUTE_SCENES['night-wet'].nodes.filter(
          (node) => !(node.type === 'light' && node.kind === kind),
        ),
      }),
    );
  report.lamps = await without('night-wet-no-lamps', 'point');
  report.spot = await without('night-wet-no-spot', 'spot');
  assert.ok(report.lamps > 5, 'the lamps light the night scene');
  assert.ok(report.spot > 0.5, 'and so does its spot light');

  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'the route draws without a WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
