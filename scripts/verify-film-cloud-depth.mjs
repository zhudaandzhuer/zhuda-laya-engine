#!/usr/bin/env node
// Real WebGL check that a cloud layer (`look.clouds`) stays behind what is
// solid however far away it stands. Dark towers stand straight ahead at 600 m
// to 3.5 km under a layer far above them all; each tower must be as dark with
// the clouds as without them. The compose pass tells sky from solid by the
// depth picture: a fixed threshold on the stored value is crossed long before
// the far plane (0.99999 is about 2.2 km with the film stage's 0.05..4000 m
// camera), and towers beyond it come out painted over with cloud.
// Desktop GPU evidence only (WebGL, or WebGPU through verify:film-webgpu); not
// mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_CLOUD_DEPTH_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-cloud-depth'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 960,
  H = 540;
const DISTANCES = [600, 1200, 1800, 2200, 2600, 3000, 3500];
const EYE = [0, 1, 0],
  TARGET = [0, 40, -1000],
  LENS = 24;
const towers = DISTANCES.map((z, k) => ({
  id: 't' + k,
  type: 'box',
  position: [(k - 3) * z * 0.18, 0, -z],
  size: [Math.min(900, z * 0.06), Math.min(1000, z * 0.28), Math.min(900, z * 0.06)],
  material: 'dark',
}));
const scene = (clouds) => ({
  schemaVersion: 1,
  id: 'cloud-depth',
  camera: { eye: EYE, target: TARGET, focalLengthMm: LENS },
  look: {
    preset: 'day',
    fog: false,
    clouds: clouds
      ? { coverage: 0.7, baseMeters: 3000, thicknessMeters: 600, sizeMeters: 900 }
      : false,
    grade: { exposure: 1, bloom: 0 },
  },
  materials: { dark: { color: [0.05, 0.05, 0.05], roughness: 1 } },
  nodes: [{ id: 'ground', type: 'ground', size: [9000, 9000], material: 'concrete' }, ...towers],
});
const host = new ZhudaFilmHost({});
const render = async (name, clouds) => {
  const { png } = await host.preview(scene(clouds), { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
/** Mean brightness of a small patch. */
const patch = (img, [cx, cy]) => {
  let sum = 0,
    n = 0;
  for (let y = cy - 2; y <= cy + 2; y++)
    for (let x = cx - 1; x <= cx + 1; x++, n++) {
      const i = (y * W + x) * 4;
      sum += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    }
  return Math.round(sum / n);
};
const report = { towers: [] };
try {
  await host.ready();
  const clear = await render('without-clouds', false);
  const cloudy = await render('with-clouds', true);
  // The towers, found in the clear frame: dark columns, left to right in order of distance.
  const dark = (x, y) => {
    const i = (y * W + x) * 4;
    return (clear.data[i] + clear.data[i + 1] + clear.data[i + 2]) / 3 < 30;
  };
  const columns = [];
  for (let x = 2; x < W - 2; x++) {
    let rows = 0;
    for (let y = 0; y < H; y++) if (dark(x, y)) rows++;
    if (rows > 20) columns.push(x);
  }
  const groups = [];
  for (const x of columns)
    if (groups.length && x - groups.at(-1).at(-1) <= 2) groups.at(-1).push(x);
    else groups.push([x]);
  assert.equal(
    groups.length,
    towers.length,
    `control: ${towers.length} towers stand in the clear frame`,
  );
  for (const [k, group] of groups.entries()) {
    const x = group[Math.floor(group.length / 2)];
    let top = 0;
    while (top < H && !dark(x, top)) top++;
    let bottom = top;
    while (bottom < H && dark(x, bottom)) bottom++;
    // The upper part of the tower, where the cloud layer lies behind it in the frame.
    const at = [x, Math.round(top + (bottom - top) * 0.25)];
    report.towers.push({
      distance: DISTANCES[k],
      at,
      without: patch(clear, at),
      with: patch(cloudy, at),
    });
  }
  for (const t of report.towers) {
    assert.ok(
      t.without < 40,
      `control: the tower at ${t.distance} m is dark without clouds (${t.without})`,
    );
    assert.ok(
      t.with < 40,
      `the tower at ${t.distance} m stands in front of the clouds: ${t.with} with them, ${t.without} without`,
    );
  }
  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'clouds raise no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: false, gpu: host.info?.gpu, out, ...report }, null, 2));
  throw error;
} finally {
  await host.close();
}
