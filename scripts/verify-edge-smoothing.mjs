#!/usr/bin/env node
// Real WebGL check of edge smoothing (`grade.antialias: "fxaa"`, which is also
// what quality level 1 draws with) at the frame's border: the pass reads the
// pixels round each pixel, and at the border it must not read across to the
// other side of the picture. A bright bar stands at the right edge of a grey
// frame; the left edge must stay the grey of the sky, and the bar must keep
// its brightness.
// Desktop GPU evidence only; not WebGPU or mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.EDGE_SMOOTHING_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-edge-smoothing'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 320,
  H = 200;
const scene = (antialias) => ({
  schemaVersion: 1,
  id: 'edge-smoothing-border',
  camera: { eye: [0, 1, 6], target: [0, 1, 0], focalLengthMm: 35 },
  look: {
    sky: [0.25, 0.25, 0.25],
    ambient: [0, 0, 0],
    sun: { intensity: 0 },
    shadows: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias },
  },
  materials: { white: { color: [0, 0, 0], emission: [1.5, 1.5, 1.5] } },
  nodes: [
    { id: 'bar', type: 'box', size: [0.5, 30, 0.5], position: [3.3, -15, 0], material: 'white' },
  ],
});

const host = new ZhudaFilmHost({});
const report = {};
try {
  await host.ready();
  report.gpu = host.info.gpu;
  const draw = async (antialias) => {
    const { png } = await host.preview(scene(antialias), { width: W, height: H });
    fs.writeFileSync(path.join(out, `${antialias}.png`), png);
    const image = PNG.sync.read(png);
    const column = (x) => {
      let least = 255,
        most = 0;
      for (let y = 20; y < H - 20; y++) {
        const v = image.data[(y * W + x) * 4];
        least = Math.min(least, v);
        most = Math.max(most, v);
      }
      return { least, most };
    };
    return { left: column(0), sky: column(40), right: column(W - 1) };
  };
  // Without smoothing: what the two edges are.
  const plain = (report.none = await draw('none'));
  assert.ok(plain.right.least > plain.sky.most + 100, 'the bar stands at the right edge');
  assert.ok(plain.left.most <= plain.sky.most + 2, 'unsmoothed, the left edge is the sky');
  const smoothed = (report.fxaa = await draw('fxaa'));
  assert.ok(
    smoothed.left.most <= smoothed.sky.most + 2,
    `smoothing reads nothing across the frame: the left edge is ${smoothed.left.most}, the sky ${smoothed.sky.most}`,
  );
  assert.ok(
    smoothed.right.least >= plain.right.least - 2,
    `and the bar at the right edge keeps its brightness: ${smoothed.right.least} against ${plain.right.least}`,
  );
  report.passed = true;
} finally {
  report.glErrors = await host.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
