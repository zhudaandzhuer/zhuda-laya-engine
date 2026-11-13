#!/usr/bin/env node
// Real WebGL check that a still averages its samples in scene-linear light:
// a lamp 32 times brighter than white, far out of focus, must stay white over
// its whole disc. Averaged after tone mapping it came out mid-grey, because
// every sample had already been clipped to white before it was spread.
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_HIGHLIGHTS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-highlights'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 320,
  H = 180;
// Focused at 1.5 m with a wide aperture; the lamp is 30 m away.
const scene = (grade) => ({
  schemaVersion: 1,
  id: 'highlights',
  camera: {
    eye: [0, 1.5, 0],
    target: [0, 1.5, -30],
    focalLengthMm: 85,
    fStop: 1.4,
    focusDistanceM: 1.5,
  },
  look: { sky: [0, 0, 0], ambient: [0, 0, 0], sun: { intensity: 0 }, ...(grade ? { grade } : {}) },
  materials: { lamp: { color: [0, 0, 0], roughness: 1, emission: [8, 8, 8] } },
  nodes: [
    { id: 'lamp', type: 'box', size: [0.4, 0.4, 0.05], position: [0, 1.3, -30], material: 'lamp' },
  ],
});
const graded = scene({ exposure: 4, bloom: 0, ao: 0 });
const lit = (img) => {
  let count = 0;
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 1] > 12) count++;
  return count;
};
const centre = (img) => {
  let sum = 0;
  for (let y = H / 2 - 2; y < H / 2 + 2; y++)
    for (let x = W / 2 - 2; x < W / 2 + 2; x++) sum += img.data[(y * W + x) * 4 + 1];
  return +(sum / 16).toFixed(1);
};

const host = new ZhudaFilmHost({ outputDir: out });
const report = {};
try {
  await host.ready();
  // One sample has no aperture: the lamp is sharp, small and white.
  const preview = await host.preview(graded, { width: W, height: H });
  const sharp = PNG.sync.read(preview.png);
  report.sharp = { centre: centre(sharp), lit: lit(sharp) };
  assert.ok(report.sharp.centre > 250, 'in focus the lamp is white');

  const still = await host.still(graded, { name: 'lamp', width: W, height: H, samples: 32 });
  const disc = PNG.sync.read(fs.readFileSync(still.path));
  report.disc = { centre: centre(disc), lit: lit(disc), accumulation: still.accumulation };
  assert.equal(still.accumulation, 'scene-linear', 'a graded still averages before tone mapping');
  assert.ok(report.disc.lit > report.sharp.lit * 4, 'out of focus the lamp is a wide disc');
  assert.ok(report.disc.centre > 240, 'and the disc is still white: its light was not clipped');

  const again = await host.still(graded, { name: 'lamp-again', width: W, height: H, samples: 32 });
  assert.equal(again.sha256, still.sha256, 'the same still twice is the same file');

  // Without a grade there is no HDR chain to split: the earlier averaging applies.
  const plain = await host.still(scene(), { name: 'lamp-plain', width: W, height: H, samples: 8 });
  report.plain = { accumulation: plain.accumulation };
  assert.equal(plain.accumulation, 'display-linear');

  // A coloured lamp far brighter than the grade's lookup table holds (emission
  // 8 is 147 in the scene; the table ends at 58.85) must stay bright. It used
  // to be looked up outside the table: grey-green at 6, no red at all at 8.
  const patchOf = async (emission) => {
    const frame = PNG.sync.read(
      (
        await host.preview(
          {
            schemaVersion: 1,
            id: 'lamp-colour',
            camera: { eye: [0, 0.5, 3], target: [0, 0.5, 0] },
            look: {
              sky: [0, 0, 0],
              ambient: [0, 0, 0],
              sun: { intensity: 0 },
              grade: { exposure: 1, bloom: 0, ao: 0 },
            },
            materials: { lamp: { color: [0, 0, 0], roughness: 1, emission } },
            nodes: [
              { id: 'lamp', type: 'box', size: [1, 1, 0.1], position: [0, 0, 0], material: 'lamp' },
            ],
          },
          { width: 64, height: 64 },
        )
      ).png,
    );
    const i = (32 * 64 + 32) * 4;
    return [frame.data[i], frame.data[i + 1], frame.data[i + 2]];
  };
  report.red = {};
  for (const level of [1, 3, 6, 8])
    report.red[level] = await patchOf([level, level / 15, level / 60]);
  assert.ok(report.red[1][0] > 200 && report.red[1][1] < 30, 'a red lamp at 1 is red');
  for (const level of [3, 6, 8])
    assert.equal(report.red[level][0], 255, `a red lamp at ${level} keeps its red`);
  assert.ok(
    report.red[3][1] <= report.red[6][1] && report.red[6][1] <= report.red[8][1],
    'and only grows paler as it grows brighter',
  );

  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
