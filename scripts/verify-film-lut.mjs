#!/usr/bin/env node
// Real WebGL check of a colour table (`grade.lut`) on a picture with smooth
// gradients and fine texture: a dusk sky over textured ground. A table that
// changes nothing (identity) must leave the frame as it was. The table lies in
// its texture as blue slices side by side, and the shader's coordinate jumps
// from one slice to the next between neighbouring pixels; a texture read that
// spreads along that jump (anisotropic filtering) brings in colours of other
// slices: dashed lines across the sky's gradient and specks on the ground.
// Desktop GPU evidence only (WebGL, or WebGPU through verify:film-webgpu); not
// mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_LUT_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-lut'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, { recursive: true });
const identity = (n) => {
  const lines = [`LUT_3D_SIZE ${n}`];
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++)
        lines.push([r, g, b].map((v) => (v / (n - 1)).toFixed(6)).join(' '));
  return lines.join('\n') + '\n';
};
fs.writeFileSync(path.join(assets, 'identity-17.cube'), identity(17));
fs.writeFileSync(path.join(assets, 'identity-33.cube'), identity(33));

const W = 480,
  H = 270;
const scene = (lut) => ({
  schemaVersion: 1,
  id: 'lut-check',
  camera: { eye: [0, 2, 0], target: [0, 3.2, -10], focalLengthMm: 24 },
  look: {
    preset: 'dusk',
    grade: { exposure: 1.1, bloom: 0, ...(lut ? { lut: { asset: lut, intensity: 1 } } : {}) },
  },
  nodes: [{ id: 'ground', type: 'ground', size: [400, 400], material: 'concrete' }],
});
const host = new ZhudaFilmHost({ assets });
const render = async (name, lut) => {
  const { png } = await host.preview(scene(lut), { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const report = {};
try {
  await host.ready();
  const plain = await render('none');
  for (const size of [17, 33]) {
    const graded = await render(`identity-${size}`, `identity-${size}.cube`);
    let worst = 0,
      changed = 0;
    for (let i = 0; i < plain.data.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(plain.data[i + c] - graded.data[i + c]));
      if (d > worst) worst = d;
      // Eight-bit tables (where half floats cannot be filtered) round by a step or two.
      if (d > 4) changed++;
    }
    report[`identity${size}`] = { worst, changed };
    assert.equal(
      changed,
      0,
      `an identity table of ${size} leaves the frame as it was: ${changed} pixels changed by more than 4, the worst by ${worst}`,
    );
  }
  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'a colour table raises no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: false, gpu: host.info?.gpu, out, ...report }, null, 2));
  throw error;
} finally {
  await host.close();
}
