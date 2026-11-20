#!/usr/bin/env node
// Real WebGL check of what a film scene's material says about how it is put
// into the picture: `blend: 'cutout'` with a recipe's `alpha` (a disc on a
// square card: the corners are not drawn, the floor shows through, and the
// card's shadow is a disc too), `blend: 'alpha'` with `opacity` (a pane lets
// half of what is behind it through), and `doubleSided` (the inside of an
// open tube is drawn). Desktop GPU evidence only (WebGL, or WebGPU through
// verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_CUTOUT_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-cutout'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 720,
  H = 480,
  LENS = 35;
/** A card two metres square: blue where it is not the red disc. Alpha 0 outside the disc. */
const disc = {
  schemaVersion: 1,
  id: 'check-disc',
  tileMeters: [2, 2],
  base: { color: [0.02, 0.05, 0.8], roughness: 1, metallic: 0, alpha: 0 },
  layers: [
    { mask: { type: 'shape', shape: 'disc', softness: 0.02 }, color: [0.8, 0.02, 0.02], alpha: 1 },
  ],
};
const look = {
  preset: 'day',
  sun: { azimuthDeg: 0, elevationDeg: 45, intensity: 1.5 },
  shadows: { distance: 40, resolution: 4096, cascades: 2 },
  fog: false,
  grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
};
const scene = (id, camera, materials, nodes) => ({
  schemaVersion: 1,
  id,
  camera: { ...camera, focalLengthMm: LENS },
  look,
  materials: { pale: { color: [0.8, 0.8, 0.78], roughness: 1 }, ...materials },
  nodes: [{ id: 'ground', type: 'ground', size: [200, 200], material: 'pale' }, ...nodes],
});
const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const kind = (img, i) => {
  const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
  if (r > 70 && r > 2.2 * Math.max(g, b)) return 'red';
  if (b > 70 && b > 2.2 * Math.max(r, g)) return 'blue';
  return 'other';
};
const count = (img) => {
  const n = { red: 0, blue: 0, other: 0 };
  for (let i = 0; i < img.data.length; i += 4) n[kind(img, i)]++;
  return n;
};
const floorAt = (img, point, camera) => {
  const [x, y] = projectPixel(point, camera.eye, camera.target, W, H, LENS);
  let sum = 0,
    n = 0;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++, n++) {
      const i = ((y + dy) * W + x + dx) * 4;
      sum += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    }
  return Math.round(sum / n);
};

const report = {};
try {
  await host.ready();
  report.gpu = host.info?.gpu;

  // 1. The card face on: a disc of red. Opaque, the square's corners are blue; cut out, they are not drawn.
  const FRONT = { eye: [0, 1, 7], target: [0, 1, 0] };
  const card = (material) => [
    { id: 'card', type: 'box', size: [2, 2, 0.02], position: [0, 0, 0], material },
  ];
  const opaque = count(
    await render(
      'card-opaque',
      scene('card-opaque', FRONT, { card: { recipe: disc, size: 256 } }, card('card')),
    ),
  );
  const cut = count(
    await render(
      'card-cutout',
      scene(
        'card-cutout',
        FRONT,
        { card: { recipe: disc, size: 256, blend: 'cutout' } },
        card('card'),
      ),
    ),
  );
  report.card = { opaque, cut };
  assert.ok(
    opaque.red > 2000 && opaque.blue > 400,
    `opaque: the disc and the square's corners (${JSON.stringify(opaque)})`,
  );
  assert.ok(
    Math.abs(cut.red - opaque.red) < opaque.red * 0.08,
    `cut out: the disc is as it was (${cut.red} against ${opaque.red})`,
  );
  assert.ok(
    cut.blue < opaque.blue * 0.03,
    `cut out: the corners are not drawn (${cut.blue} blue pixels)`,
  );

  // 2. Its shadow on the floor behind it has the card's outline: about pi / 4 of the square's.
  //    (Where on the card the disc sits depends on the box's UV origin; the area does not.)
  const ABOVE = { eye: [7, 9, 3], target: [0, 0, -1] };
  const shadowOf = async (name, blend) => {
    const img = await render(
      name,
      scene(
        name,
        ABOVE,
        { card: { recipe: disc, size: 256, ...(blend ? { blend } : {}) } },
        card('card'),
      ),
    );
    const open = floorAt(img, [3.5, 0, -1], ABOVE);
    let dark = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
      // Floor in shadow: grey, and well under the open floor.
      if (
        Math.max(r, g, b) - Math.min(r, g, b) < 16 &&
        (r + g + b) / 3 < open - 30 &&
        (r + g + b) / 3 > 60
      )
        dark++;
    }
    return { open, dark };
  };
  report.shadow = {
    opaque: await shadowOf('shadow-opaque', undefined),
    cut: await shadowOf('shadow-cutout', 'cutout'),
  };
  const sh = report.shadow;
  assert.ok(
    sh.opaque.dark > 800,
    `opaque: the square shades the floor (${JSON.stringify(sh.opaque)})`,
  );
  assert.ok(
    sh.cut.dark > sh.opaque.dark * 0.62 && sh.cut.dark < sh.opaque.dark * 0.92,
    `cut out: the shadow has the disc's share of the square's, about 0.785 (${sh.cut.dark} against ${sh.opaque.dark})`,
  );

  // 3. A pane blended over a red wall: half of the wall comes through.
  const pane = (material) => [
    { id: 'wall', type: 'box', size: [4, 3, 0.2], position: [0, 0, -2], material: 'red' },
    { id: 'pane', type: 'box', size: [2, 2, 0.02], position: [0, 0.4, 0], material },
  ];
  const middle = (img) => {
    const i = (Math.round(H * 0.42) * W + W / 2) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  const mats = { red: { color: [0.8, 0.02, 0.02], roughness: 1 } };
  report.pane = {
    solid: middle(
      await render(
        'pane-solid',
        scene(
          'pane-solid',
          FRONT,
          { ...mats, glass: { color: [0.02, 0.05, 0.8], roughness: 1 } },
          pane('glass'),
        ),
      ),
    ),
    blended: middle(
      await render(
        'pane-alpha',
        scene(
          'pane-alpha',
          FRONT,
          {
            ...mats,
            glass: { color: [0.02, 0.05, 0.8], roughness: 1, blend: 'alpha', opacity: 0.5 },
          },
          pane('glass'),
        ),
      ),
    ),
    none: middle(
      await render('pane-none', scene('pane-none', FRONT, mats, pane('red').slice(0, 1))),
    ),
  };
  const pn = report.pane;
  assert.ok(pn.solid[2] > pn.solid[0] * 2, `a solid pane hides the wall (${pn.solid})`);
  assert.ok(
    pn.blended[0] > pn.solid[0] + 25 &&
      pn.blended[0] < pn.none[0] - 15 &&
      pn.blended[2] > pn.none[2] + 15,
    `a blended pane lets part of the wall through (pane ${pn.solid}, blended ${pn.blended}, wall ${pn.none})`,
  );

  // 4. Inside an open tube: its wall is drawn from inside only when both faces are.
  const INSIDE = { eye: [0, 1, 0], target: [0, 1, -1] };
  const tube = (material) => [
    {
      id: 'tube',
      type: 'lathe',
      profile: [
        [1.5, 0],
        [1.5, 2.5],
      ],
      segments: 32,
      position: [0, 0, 0],
      material,
    },
  ];
  report.tube = {
    oneSided: count(
      await render(
        'tube-one-sided',
        scene(
          'tube-one-sided',
          INSIDE,
          { wall: { color: [0.8, 0.02, 0.02], roughness: 1 } },
          tube('wall'),
        ),
      ),
    ),
    twoSided: count(
      await render(
        'tube-two-sided',
        scene(
          'tube-two-sided',
          INSIDE,
          { wall: { color: [0.8, 0.02, 0.02], roughness: 1, doubleSided: true } },
          tube('wall'),
        ),
      ),
    ),
  };
  assert.ok(
    report.tube.twoSided.red > report.tube.oneSided.red + W * H * 0.2,
    `the inside of the tube is drawn with doubleSided (${report.tube.twoSided.red} red pixels against ${report.tube.oneSided.red})`,
  );

  report.ok = true;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, ...report }, null, 2));
} catch (error) {
  report.ok = false;
  report.error = String(error?.message || error);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.error(JSON.stringify({ out, ...report }, null, 2));
  process.exitCode = 1;
} finally {
  await host.close();
}
