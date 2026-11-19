#!/usr/bin/env node
// Real WebGL check of a panorama sky (`look.panorama`) along the meridian where
// the picture's left and right edges meet. LayaAir's panoramic sky finds the
// picture's column with an arc tangent, which jumps from one edge of the
// picture to the other there. To the graphics card the whole width of the
// picture then lies between two neighbouring pixels: a texture with mip levels
// is read at its smallest level, one with anisotropic filtering along its
// whole row, and the sky shows the average colour of the picture as a line
// from the horizon to the zenith. The sky here is black with a white band on
// the far side, so that average is a grey that black sky cannot hold.
// Desktop GPU evidence only (WebGL, or WebGPU through verify:film-webgpu); not
// mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_PANORAMA_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-panorama'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, { recursive: true });

// Black, with a white band a quarter of the picture wide, centred on the middle column.
const PW = 1024,
  PH = 512;
const sky = new PNG({ width: PW, height: PH });
for (let y = 0; y < PH; y++)
  for (let x = 0; x < PW; x++) {
    const white = x >= PW * 0.375 && x < PW * 0.625;
    sky.data.set(white ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * PW + x) * 4);
  }
fs.writeFileSync(path.join(assets, 'band.png'), PNG.sync.write(sky));

const W = 320,
  H = 200;
const host = new ZhudaFilmHost({ assets });
const view = async (name, target, rotationDeg) => {
  const { png } = await host.preview(
    {
      schemaVersion: 1,
      id: 'panorama-seam',
      camera: { eye: [0, 1, 0], target, focalLengthMm: 24 },
      look: {
        ambient: [0, 0, 0],
        sun: { intensity: 0 },
        shadows: false,
        panorama: { asset: 'band.png', rotationDeg },
      },
      nodes: [],
    },
    { width: W, height: H },
  );
  fs.writeFileSync(path.join(out, name + '.png'), png);
  const img = PNG.sync.read(png);
  let brightest = 0,
    lit = 0,
    white = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const value = Math.max(img.data[i], img.data[i + 1], img.data[i + 2]);
    if (value > brightest) brightest = value;
    if (value > 16) lit++;
    if (value > 200) white++;
  }
  return { brightest, lit, white };
};
// The band stands in one of the four compass directions; the meridian where
// the picture's edges meet is straight across from it, and that view must be
// black from edge to edge. `rotationDeg` turns both together.
// Each view looks a little to one side: straight down a compass direction the
// meridian would lie exactly between two pixel columns of an even-sized frame,
// where no block of four pixels straddles it and the line does not show.
const COMPASS = {
  'z+': [0.4, 1.6, 5],
  'x+': [5, 1.6, -0.4],
  'z-': [-0.4, 1.6, -5],
  'x-': [-5, 1.6, 0.4],
};
const names = Object.keys(COMPASS);
const report = { views: {} };
try {
  await host.ready();
  for (const rotationDeg of [0, 90]) {
    const seen = {};
    for (const name of names)
      seen[name] = await view(`turn-${rotationDeg}-${name}`, COMPASS[name], rotationDeg);
    // Straight up, for the record: the line runs on to the zenith.
    seen.up = await view(`turn-${rotationDeg}-up`, [0.01, 9, 0.01], rotationDeg);
    report.views[rotationDeg] = seen;
    const band = names.filter((name) => seen[name].white > (W * H) / 4);
    assert.equal(
      band.length,
      1,
      `the band fills one compass view at ${rotationDeg} degrees: ${band}`,
    );
    const across = names[(names.indexOf(band[0]) + 2) % 4];
    assert.equal(
      seen[across].lit,
      0,
      `no line down the black sky across from the band (turned ${rotationDeg}, looking ${across}): ` +
        `${seen[across].lit} pixels lit, the brightest ${seen[across].brightest}`,
    );
  }
  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'a panorama sky raises no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: false, gpu: host.info?.gpu, out, ...report }, null, 2));
  throw error;
} finally {
  await host.close();
}
