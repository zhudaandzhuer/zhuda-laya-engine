#!/usr/bin/env node
// Real WebGL check of the film `reflector` node: a lit box above the surface
// must appear mirrored at the projected position, and nowhere else. Desktop
// GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { floorGlb } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_REFLECTOR_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-reflector'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'floor.glb'), floorGlb({ uv1: false }));

const W = 480,
  H = 270;
const EYE = [0, 3, 8],
  TARGET = [0, 0.5, -4];
const MIRROR_Y = 0.01;
const look = { sky: [0, 0, 0], ambient: [0.1, 0.1, 0.1], sun: { intensity: 0 }, shadows: false };
const reflectorNode = (extra = {}) => ({
  id: 'wet',
  type: 'reflector',
  position: [0, MIRROR_Y, -2],
  size: [30, 30],
  strength: 1,
  wetness: 1,
  ripple: 0,
  roughness: 0,
  ...extra,
});
const scene = (nodes) => ({
  schemaVersion: 1,
  id: 'reflector-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 35 },
  look,
  materials: { lamp: { color: [1, 0.1, 0.05], emission: [3, 0.2, 0.05] } },
  nodes: [
    // A red lamp box from y = 2 to 3, four metres behind the target.
    { id: 'lamp', type: 'box', size: [1.2, 1, 1.2], position: [2, 2, -6], material: 'lamp' },
    ...nodes,
  ],
});

/** Pinhole projection of a world point for the scene camera (35 mm on a 24 mm tall sensor). */
function project(point) {
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (a) => a.map((v) => v / Math.hypot(...a));
  const forward = unit(sub(TARGET, EYE)),
    right = unit(cross(forward, [0, 1, 0])),
    up = cross(right, forward);
  const d = sub(point, EYE),
    depth = dot(d, forward),
    f = 35 / 12;
  return [
    Math.round((0.5 + (dot(d, right) / depth) * f * (H / W) * 0.5) * W),
    Math.round((0.5 - (dot(d, up) / depth) * f * 0.5) * H),
  ];
}
const patch = (img, [x, y]) => {
  const sum = [0, 0, 0];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * W + x + dx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
    }
  return sum.map((value) => +(value / 25).toFixed(1));
};

const host = new ZhudaFilmHost({ assets });
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const LAMP = project([2, 2.5, -6]),
  MIRRORED = project([2, 2 * MIRROR_Y - 2.5, -6]),
  // On the surface, to the side: reflects only the black sky.
  ASIDE = project([-5, MIRROR_Y, -1]);
const report = { pixels: { LAMP, MIRRORED, ASIDE } };
try {
  await host.ready();
  const plain = await render('plain', scene([]));
  const wet = await render('reflector', scene([reflectorNode()]));
  report.plain = {
    lamp: patch(plain, LAMP),
    mirrored: patch(plain, MIRRORED),
    aside: patch(plain, ASIDE),
  };
  report.reflector = {
    lamp: patch(wet, LAMP),
    mirrored: patch(wet, MIRRORED),
    aside: patch(wet, ASIDE),
  };
  assert.ok(report.plain.lamp[0] > 200, 'the lamp is where the projection says');
  assert.ok(report.plain.mirrored[0] < 5, 'nothing below the lamp without a reflector');
  assert.ok(report.reflector.mirrored[0] > 120, 'the lamp is mirrored at the projected position');
  assert.ok(
    report.reflector.mirrored[0] > report.reflector.mirrored[2] * 3,
    'the mirrored lamp keeps its colour',
  );
  assert.ok(report.reflector.aside[0] < 5, 'no light where only the black sky is mirrored');
  assert.deepEqual(report.reflector.lamp, report.plain.lamp, 'the lamp itself is unchanged');

  // Strength scales the reflection; zero removes it.
  const off = await render('strength-0', scene([reflectorNode({ strength: 0 })]));
  assert.ok(patch(off, MIRRORED)[0] < 5, 'strength 0 reflects nothing');
  const half = await render('strength-1', scene([reflectorNode({ strength: 0.5 })]));
  report.half = patch(half, MIRRORED);
  assert.ok(
    report.half[0] > 10 && report.half[0] < report.reflector.mirrored[0],
    'weaker reflection',
  );

  // Damp stone (no standing water) is dimmer than a puddle.
  const damp = await render('damp', scene([reflectorNode({ wetness: 0, ripple: 0 })]));
  report.damp = patch(damp, MIRRORED);
  assert.ok(report.damp[0] < report.reflector.mirrored[0], 'damp areas reflect less than puddles');

  // What lies below the mirror is cut from the mirrored view: neither a
  // double-sided floor model nor a `ground` node under it covers the
  // reflection, and `hides` still takes a model out of it.
  const floor = { id: 'floor', type: 'model', asset: 'floor.glb', position: [0, 0, -2] };
  const under = await render('floor-under', scene([floor, reflectorNode()]));
  report.floorUnder = patch(under, MIRRORED);
  assert.ok(report.floorUnder[0] > 120, 'a floor below the mirror does not block it');
  const hidden = await render('floor-hidden', scene([floor, reflectorNode({ hides: ['floor'] })]));
  report.hidden = patch(hidden, MIRRORED);
  assert.ok(report.hidden[0] > 120, 'a hidden floor lets the reflection through');
  const ground = { id: 'ground', type: 'ground', size: [40, 40], material: 'concrete' };
  const onGround = await render('ground-under', scene([ground, reflectorNode()]));
  report.groundUnder = patch(onGround, MIRRORED);
  assert.ok(report.groundUnder[0] > 120, 'a ground node below the mirror does not block it');

  // 30 mounts with and without the reflector, then the first frame again.
  for (let i = 0; i < 30; i++) await host.mountReport(scene(i % 2 ? [reflectorNode()] : []));
  const again = await render('reflector-after-cycles', scene([reflectorNode()]));
  assert.ok(again.data.equals(wet.data), 'identical frame after 30 mount cycles');
  const plainAgain = await render('plain-after-cycles', scene([]));
  assert.ok(
    plainAgain.data.equals(plain.data),
    'plain frame unchanged after the reflector is gone',
  );

  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
