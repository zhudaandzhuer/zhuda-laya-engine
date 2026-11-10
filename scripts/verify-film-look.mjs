#!/usr/bin/env node
// Real WebGL check of film looks and operator packs (native Laya features):
// shadows, procedural sky, fog, practical lights, remount stability and a
// --film-pack prop. Each feature is switched on and off and the pixel change
// asserted. Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.FILM_LOOK_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-look'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const W = 320,
  H = 200;
const scene = (look, extra = []) => ({
  schemaVersion: 1,
  id: 'look-check',
  camera: { eye: [12, 6, 16], target: [0, 1.2, 0] },
  look,
  materials: {
    stone: { color: [0.6, 0.58, 0.55], roughness: 0.8 },
    'roof-red': { color: [0.5, 0.08, 0.05] },
  },
  nodes: [
    { id: 'ground', type: 'ground', size: [400, 400], material: 'concrete' },
    { id: 'pillar', type: 'box', size: [1, 5, 1], position: [3, 0, 3], material: 'stone' },
    { id: 'c', type: 'prop', prop: 'container20', position: [-2, 0, -1], seed: 1 },
    ...[30, 60, 90].map((z, i) => ({
      id: 'far' + i,
      type: 'box',
      size: [3, 6, 3],
      position: [-8 - i * 4, 0, -z],
      material: 'stone',
    })),
    ...extra,
  ],
});
const host = new ZhudaFilmHost({ packs: [path.join(engineRoot, 'tests/fixtures/film-pack.mjs')] });
const frames = {};
const render = async (name, s, camera) => {
  const { png } = await host.preview(s, { width: W, height: H, camera });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return (frames[name] = PNG.sync.read(png));
};
const lum = (img, i) => (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
const spread = (img) => {
  let s = 0,
    s2 = 0;
  const n = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    const v = lum(img, i);
    s += v;
    s2 += v * v;
  }
  return Math.sqrt(s2 / n - (s / n) ** 2);
};
const changed = (a, b, threshold, sign = 0) => {
  let count = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const d = lum(b, i) - lum(a, i);
    if (sign === 0 ? Math.abs(d) > threshold : sign * d > threshold) count++;
  }
  return count / (a.width * a.height);
};
const report = {};
try {
  await host.ready();
  report.gpu = host.info.gpu;
  report.packProps = host.info.props;
  assert.ok(host.info.props.includes('test-kiosk'), 'pack prop is listed');
  assert.ok(host.info.recipes.includes('test-check'), 'pack recipe is listed');

  // Remounting stays stable: alternate plain and full looks; every frame has geometry.
  const order = [];
  for (let i = 0; i < 3; i++) {
    order.push(spread(await render(`remount-plain-${i}`, scene(undefined))));
    order.push(spread(await render(`remount-day-${i}`, scene({ preset: 'day' }))));
    order.push(spread(await render(`remount-dusk-${i}`, scene({ preset: 'dusk' }))));
  }
  report.remountSpread = order.map((v) => +v.toFixed(1));
  assert.ok(
    order.every((v) => v > 8),
    'every remounted frame draws geometry',
  );

  // A low side sun so shadows fall into view.
  const shadowOn = await render(
    'shadow-on',
    scene({
      preset: 'day',
      sun: { azimuthDeg: 100, elevationDeg: 25 },
      atmosphere: false,
      fog: false,
    }),
  );
  const shadowOff = await render(
    'shadow-off',
    scene({
      preset: 'day',
      sun: { azimuthDeg: 100, elevationDeg: 25 },
      atmosphere: false,
      fog: false,
      shadows: false,
    }),
  );
  report.shadowDarker = +changed(shadowOff, shadowOn, 12, -1).toFixed(4);
  report.shadowBrighter = +changed(shadowOff, shadowOn, 12, 1).toFixed(4);
  assert.ok(report.shadowDarker > 0.01, 'shadows darken part of the frame');
  assert.ok(report.shadowBrighter < 0.002, 'shadows never brighten');

  const sky = await render('sky', scene({ preset: 'day', fog: false, shadows: false }), {
    eye: [0, 1.5, 20],
    target: [0, 6, -40],
  });
  const row = (img, y) => {
    let s = 0;
    for (let x = 0; x < img.width; x++) s += lum(img, (y * img.width + x) * 4);
    return s / img.width;
  };
  report.skyTopVsLow = [+row(sky, 2).toFixed(1), +row(sky, 60).toFixed(1)];
  assert.ok(
    Math.abs(report.skyTopVsLow[0] - report.skyTopVsLow[1]) > 10,
    'procedural sky has a vertical gradient',
  );

  const clear = await render(
    'fog-off',
    scene({ preset: 'day', fog: false, shadows: false, atmosphere: false }),
  );
  const foggy = await render(
    'fog-on',
    scene({
      preset: 'day',
      fog: { color: [0.8, 0.8, 0.85], start: 5, end: 60 },
      shadows: false,
      atmosphere: false,
    }),
  );
  report.fogChanged = +changed(clear, foggy, 10).toFixed(4);
  assert.ok(report.fogChanged > 0.2, 'fog changes the distant frame');

  const dark = await render('night', scene({ preset: 'night' }));
  const lit = await render(
    'night-lamp',
    scene({ preset: 'night' }, [
      {
        id: 'lamp',
        type: 'light',
        kind: 'point',
        position: [6, 1.5, 7],
        color: [1, 0.6, 0.3],
        intensity: 4,
        range: 10,
      },
    ]),
  );
  report.lampBrighter = +changed(dark, lit, 15, 1).toFixed(4);
  assert.ok(report.lampBrighter > 0.03, 'a point light brightens the ground near it');

  const kiosk = await render(
    'pack-prop',
    scene({ preset: 'day' }, [
      { id: 'kiosk', type: 'prop', prop: 'test-kiosk', position: [6, 0, 6] },
    ]),
  );
  report.packChanged = +changed(frames['remount-day-0'], kiosk, 15).toFixed(4);
  assert.ok(report.packChanged > 0.01, 'the pack prop is drawn');
  report.passed = true;
} finally {
  await host.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(`PASS film looks on ${report.gpu}: ${JSON.stringify(report)}`);
