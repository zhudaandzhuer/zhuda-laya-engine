#!/usr/bin/env node
// Real draw check of a film scene's picture material: a `.png` among the
// scene's assets as a surface's colour, repeated every `tileMeters`, with a
// normal map. The pictures are written by this script (stripes of red and
// blue; a normal map of ridges), so nothing is shipped. Checked: the stripes
// are drawn at the stated size and colours; `tint` multiplies them; the
// normal map changes the shading, and the two conventions shade opposite
// ways; an asset that is not there is refused by name. Desktop GPU evidence
// only (WebGL, or WebGPU through verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_PICTURE_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-picture'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets', 'tiles');
fs.mkdirSync(assets, { recursive: true });

// Four stripes across the picture: red, blue, red, blue.
const S = 64;
const stripes = new PNG({ width: S, height: S }),
  ridges = new PNG({ width: S, height: S });
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4,
      red = Math.floor((x / S) * 4) % 2 === 0;
    stripes.data.set(red ? [220, 30, 30, 255] : [30, 30, 220, 255], o);
    // Ridges running across the picture: the normal leans up and down it (green), OpenGL convention.
    const lean = Math.sin((y / S) * Math.PI * 2 * 4) * 0.6;
    const l = Math.hypot(lean, 1);
    ridges.data.set(
      [128, Math.round((lean / l) * 127 + 128), Math.round((1 / l) * 127 + 128), 255],
      o,
    );
  }
fs.writeFileSync(path.join(assets, 'stripes.png'), PNG.sync.write(stripes));
fs.writeFileSync(path.join(assets, 'ridges.png'), PNG.sync.write(ridges));

const W = 640,
  H = 360;
const TOP = { eye: [0.01, 10, 0], target: [0, 0, 0], focalLengthMm: 35 };
const scene = (id, material, camera = TOP, sun = { azimuthDeg: 0, elevationDeg: 30 }) => ({
  schemaVersion: 1,
  id,
  camera,
  look: {
    preset: 'day',
    sun: { ...sun, intensity: 1.4 },
    shadows: false,
    fog: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  },
  materials: { subject: material },
  nodes: [{ id: 'ground', type: 'ground', size: [60, 60], material: 'subject' }],
});
const host = new ZhudaFilmHost({
  assets: path.join(out, 'assets'),
  renderer: process.env.ZHUDA_FILM_RENDERER,
});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const at = (img, x, y) => [...img.data.slice((y * W + x) * 4, (y * W + x) * 4 + 3)];
const meanLuma = (img) => {
  let sum = 0;
  for (let i = 0; i < img.data.length; i += 4)
    sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
  return +(sum / (W * H)).toFixed(2);
};
const report = {};
try {
  await host.ready();
  report.gpu = host.info?.gpu;
  const PICTURE = { picture: 'tiles/stripes.png', tileMeters: [4, 4], roughness: 1 };
  const plain = await render('stripes', scene('picture-stripes', PICTURE));
  // From above the picture's u runs up the screen. Down the middle column: a
  // change of colour every metre (four stripes in a 4 m tile).
  const column = W >> 1;
  const count = (img) => {
    let n = 0,
      last = null;
    for (let y = 0; y < H; y++) {
      const [r, , b] = at(img, column, y),
        red = r > b;
      if (last !== null && red !== last) n++;
      last = red;
    }
    return n;
  };
  const changes = count(plain);
  // The view is about 6.9 m tall at 10 m with a 35 mm lens: six or seven changes.
  // The reddest and the bluest pixel of the column (the middle of a stripe, not its edge).
  const pick = (img, wantRed) => {
    let best = null,
      most = -Infinity;
    for (let y = 0; y < H; y++) {
      const c = at(img, column, y),
        score = wantRed ? c[0] - c[2] : c[2] - c[0];
      if (score > most) [most, best] = [score, c];
    }
    return best;
  };
  report.stripes = { changesDown: changes, red: pick(plain, true), blue: pick(plain, false) };
  assert.ok(changes >= 5 && changes <= 8, `a stripe a metre (${changes} changes down the view)`);
  assert.ok(
    report.stripes.blue && report.stripes.blue[2] > 100 && report.stripes.blue[0] < 60,
    `the picture's blue is drawn blue (${report.stripes.blue})`,
  );
  assert.ok(
    report.stripes.red && report.stripes.red[0] > 100 && report.stripes.red[2] < 60,
    `and its red red (${report.stripes.red})`,
  );

  // Half the tile size: twice the stripes.
  const small = await render(
    'stripes-2m',
    scene('picture-small', { ...PICTURE, tileMeters: [2, 2] }),
  );
  const smallChanges = count(small);
  report.stripes.changesAtHalfTile = smallChanges;
  assert.ok(smallChanges >= changes * 2 - 2, `half the tile, twice the stripes (${smallChanges})`);

  // A tint that takes the red out leaves the red stripes dark.
  const tinted = await render(
    'stripes-tint',
    scene('picture-tint', { ...PICTURE, tint: [0, 1, 1, 1] }),
  );
  let brightestRed = 0;
  for (let y = 0; y < H; y++) brightestRed = Math.max(brightestRed, at(tinted, column, y)[0]);
  report.tint = { brightestRed };
  assert.ok(brightestRed < 40, `a tint without red draws no red (${brightestRed})`);

  // A normal map of ridges across the picture, lit by a low sun from the south (+Z): the
  // ridges' faces toward the sun are brighter, so the picture has bands. Turned the other
  // way round (the other convention) the bands change places.
  const LOW = { azimuthDeg: 180, elevationDeg: 20 };
  const flat = await render('normal-none', scene('picture-flat', PICTURE, TOP, LOW));
  const withMap = { ...PICTURE, normal: 'tiles/ridges.png' };
  const gl = await render('normal-opengl', scene('picture-gl', withMap, TOP, LOW)),
    dx = await render(
      'normal-directx',
      scene('picture-dx', { ...withMap, normalConvention: 'directx' }, TOP, LOW),
    );
  const differ = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) > 10) n++;
    return +(n / (W * H)).toFixed(3);
  };
  report.normal = {
    mapAgainstNone: differ(gl, flat),
    openglAgainstDirectx: differ(gl, dx),
    meanLuma: { none: meanLuma(flat), opengl: meanLuma(gl), directx: meanLuma(dx) },
  };
  assert.ok(
    report.normal.mapAgainstNone > 0.2,
    `the normal map shades the surface (${report.normal.mapAgainstNone} of pixels)`,
  );
  assert.ok(
    report.normal.openglAgainstDirectx > 0.2,
    `the two conventions shade opposite ways (${report.normal.openglAgainstDirectx} of pixels)`,
  );
  const weak = await render(
    'normal-weak',
    scene('picture-weak', { ...withMap, normalStrength: 0.2 }, TOP, LOW),
  );
  report.normal.weakAgainstNone = differ(weak, flat);
  assert.ok(
    report.normal.weakAgainstNone < report.normal.mapAgainstNone,
    'a weaker normal map shades less',
  );

  // A picture that is not among the assets is refused by its name.
  await assert.rejects(
    host.preview(scene('picture-missing', { picture: 'tiles/nothing.png', tileMeters: [1, 1] }), {
      width: 64,
      height: 36,
    }),
    /nothing\.png/,
  );
  report.glErrors = host.takeGlErrors?.() ?? [];
  assert.deepEqual(report.glErrors, [], 'no graphics errors');
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.error = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  await host.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  console.log('Pictures: ' + out);
}
