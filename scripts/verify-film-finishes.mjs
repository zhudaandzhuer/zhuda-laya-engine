#!/usr/bin/env node
// Real-GPU check of two finishes of a flat film material on a ball under one
// sun: `clearCoat` puts a sharp highlight on a rough surface, and
// `anisotropy` draws a metal's highlight out into a band.
// Desktop GPU evidence only (WebGL, or WebGPU through verify:film-webgpu);
// not mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_FINISHES_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-finishes'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 480,
  H = 270;
// A ball of radius 1 standing on y = 0: its outline from the bottom up.
const ball = Array.from({ length: 25 }, (_, i) => {
  const a = (i / 24) * Math.PI;
  return [+Math.max(Math.sin(a), 0).toFixed(5), +(1 - Math.cos(a)).toFixed(5)];
});
const scene = (material) => ({
  schemaVersion: 1,
  id: 'finishes-check',
  camera: { eye: [0, 1.6, 5], target: [0, 1, 0], focalLengthMm: 50 },
  look: {
    sky: [0, 0, 0],
    ambient: [0.05, 0.05, 0.05],
    // From the camera's upper left.
    sun: { azimuthDeg: 320, elevationDeg: 40, intensity: 3, color: [1, 1, 1] },
    shadows: false,
    fog: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  },
  materials: { finish: material },
  nodes: [
    {
      id: 'ball',
      type: 'lathe',
      profile: ball,
      segments: 64,
      position: [0, 0, 0],
      material: 'finish',
    },
  ],
});
const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const luma = (img, i) => 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
/** The brightest value, and the width and height of what is at least 70 percent as bright. */
const highlight = (img) => {
  let peak = 0;
  for (let i = 0; i < W * H * 4; i += 4) peak = Math.max(peak, luma(img, i));
  let x0 = W,
    x1 = 0,
    y0 = H,
    y1 = 0,
    count = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (luma(img, (y * W + x) * 4) >= peak * 0.7) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        count++;
      }
  return { peak: +peak.toFixed(1), width: x1 - x0 + 1, height: y1 - y0 + 1, count };
};
const report = {};
try {
  await host.ready();
  // Clear coat: a matt dark ball, then the same under a glossy layer.
  const matt = { color: [0.2, 0.05, 0.05], roughness: 1 };
  report.matt = highlight(await render('matt', scene(matt)));
  report.coated = highlight(
    await render('coated', scene({ ...matt, clearCoat: 1, clearCoatRoughness: 0.05 })),
  );
  assert.ok(report.matt.peak < 130, `the matt ball has no bright highlight (${report.matt.peak})`);
  assert.ok(
    report.coated.peak > report.matt.peak + 60,
    `under a clear coat it has one (${report.matt.peak} -> ${report.coated.peak})`,
  );
  assert.ok(
    report.coated.count < report.matt.count * 0.5,
    `and a small one: a sharp reflection, not a brighter ball (${report.coated.count} px against ${report.matt.count})`,
  );

  // Anisotropy: a metal ball's highlight, round, then drawn out each way.
  const metal = { color: [0.8, 0.8, 0.8], metallic: 1, roughness: 0.35 };
  report.round = highlight(await render('round', scene(metal)));
  report.drawn = highlight(await render('drawn-out', scene({ ...metal, anisotropy: 0.9 })));
  report.half = highlight(await render('drawn-out-half', scene({ ...metal, anisotropy: 0.45 })));
  assert.ok(
    report.round.peak > 150,
    `the metal ball has a highlight (${JSON.stringify(report.round)})`,
  );
  assert.ok(
    Math.abs(report.round.width - report.round.height) <= 4,
    `and it is round (${report.round.width} by ${report.round.height})`,
  );
  // On a ball turned on a lathe the tangent runs round the axis: the
  // highlight becomes a band about it, far wider than it is high.
  assert.ok(
    report.drawn.width > report.round.width * 2 && report.drawn.width > report.drawn.height * 1.6,
    `drawn out, it is a band (${report.drawn.width} by ${report.drawn.height})`,
  );
  assert.ok(
    report.half.width > report.round.width * 1.2 && report.half.width < report.drawn.width,
    `half as much lies between (${report.half.width} wide)`,
  );

  for (let i = 0; i < 12; i++)
    await host.mountReport(scene(i % 2 ? { ...metal, anisotropy: 0.9 } : matt));
  assert.deepEqual(
    highlight(await render('round-again', scene(metal))),
    report.round,
    'the plain metal is as it was after 12 mounts of the others',
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
