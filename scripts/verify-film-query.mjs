#!/usr/bin/env node
// Check of the film host's scene query (`film_scene_query`, `stage.raycast`):
// the height it gives on open ground, on a box, on a dome and on a prop, a
// level ray onto a wall and one into the sky, and that a point it reports on
// the red box is drawn red in the preview. Desktop GPU evidence only (WebGL,
// or WebGPU through verify:film-webgpu); the query itself draws nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import {
  configureFilmTools,
  executeFilmTool,
  closeFilmTools,
} from '../packages/mcp-server/film-tools.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_QUERY_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-query'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
if (process.env.ZHUDA_FILM_RENDERER)
  configureFilmTools({ renderer: process.env.ZHUDA_FILM_RENDERER });

const W = 640,
  H = 360,
  LENS = 28;
const CAMERA = { eye: [0, 9, 16], target: [0, 1, 0] };
const scene = {
  schemaVersion: 1,
  id: 'query',
  camera: { ...CAMERA, focalLengthMm: LENS },
  look: { preset: 'day', fog: false, grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' } },
  materials: {
    earth: { color: [0.36, 0.3, 0.22], roughness: 1 },
    red: { color: [0.9, 0.05, 0.05], roughness: 1 },
    stone: { color: [0.6, 0.6, 0.6], roughness: 1 },
  },
  nodes: [
    { id: 'ground', type: 'ground', size: [200, 200], material: 'earth' },
    { id: 'block', type: 'box', size: [2, 3, 2], position: [4, 0, 0], material: 'red' },
    {
      id: 'dome',
      type: 'lathe',
      profile: [
        [2, 0],
        [1.732, 1],
        [1, 1.732],
        [0, 2],
      ],
      segments: 48,
      position: [-4, 0, 3],
      material: 'stone',
    },
    { id: 'crate', type: 'prop', prop: 'container20', position: [0, 0, -6] },
  ],
};
const data = (reply) => JSON.parse(reply.find((part) => part.type === 'text').text);
const report = {};
try {
  const created = data(await executeFilmTool('film_scene_create', { scene }));
  const id = created.sessionId;
  const answer = data(
    await executeFilmTool('film_scene_query', {
      sessionId: id,
      heights: [
        [10, 10],
        [4, 0],
        [-4, 3],
        [-3, 3],
        [0, -6],
        [500, 0],
      ],
      rays: [
        { origin: [0, 1.5, 0], direction: [1, 0, 0] },
        { origin: [0, 1.5, 0], direction: [0, 1, 0] },
        { origin: [0, 1.5, 0], direction: [5, 0, 0], maxMeters: 2 },
        { origin: [4, 1, 0], direction: [0, 0, 2] },
      ],
    }),
  );
  report.heights = answer.heights;
  report.rays = answer.rays;
  const [open, block, top, side, crate, off] = answer.heights;
  assert.deepEqual([open.y, open.node], [0, 'ground'], 'open ground is at 0');
  assert.deepEqual([block.y, block.node], [3, 'block'], 'the box top is at 3 m');
  assert.deepEqual(block.normal, [0, 1, 0], 'and faces up');
  assert.ok(top.node === 'dome' && Math.abs(top.y - 2) < 0.01, `the dome's crown (${top.y})`);
  assert.ok(
    side.node === 'dome' && Math.abs(side.y - 1.732) < 0.05 && side.normal[0] > 0.3,
    `a metre off the crown the dome is lower and leans outward (${JSON.stringify(side)})`,
  );
  assert.ok(crate.node === 'crate' && crate.y > 2 && crate.y < 3.2, `the prop's roof (${crate.y})`);
  assert.equal(off.y, null, 'beyond the ground there is nothing');
  const [wall, sky, short, inside] = answer.rays;
  assert.deepEqual(
    [wall.node, wall.distance, wall.position, wall.normal],
    ['block', 3, [3, 1.5, 0], [-1, 0, 0]],
    'a level ray meets the wall facing it',
  );
  assert.equal(sky, null, 'a ray upward meets nothing');
  assert.equal(short, null, 'a ray cut at 2 m does not reach a wall 3 m off');
  assert.deepEqual(
    [inside.node, inside.distance, inside.normal],
    ['block', 1, [0, 0, -1]],
    'from inside a box its far wall is met, the normal toward the ray',
  );
  // The picture agrees: the point reported on the box's top is drawn red, a point beside it is not.
  const png = (
    await executeFilmTool('film_scene_preview', { sessionId: id, width: W, height: H })
  ).find((part) => part.type === 'image');
  fs.writeFileSync(path.join(out, 'scene.png'), Buffer.from(png.data, 'base64'));
  const img = PNG.sync.read(Buffer.from(png.data, 'base64'));
  const red = (point) => {
    const [x, y] = projectPixel(point, CAMERA.eye, CAMERA.target, W, H, LENS);
    const i = (y * W + x) * 4;
    return img.data[i] > 120 && img.data[i + 1] < 60;
  };
  report.drawn = { onBox: red([4, block.y, 0]), beside: red([6.5, open.y, 0]) };
  assert.ok(report.drawn.onBox, 'the reported box top is red in the picture');
  assert.ok(!report.drawn.beside, 'the ground beside it is not');
  // Refusals name the argument.
  for (const [args, pattern] of [
    [{}, /heights or rays/],
    [{ heights: [[1]] }, /heights\[0\]/],
    [{ rays: [{ origin: [0, 0, 0], direction: [0, 0, 0] }] }, /rays\[0\]\.direction/],
  ])
    await assert.rejects(executeFilmTool('film_scene_query', { sessionId: id, ...args }), pattern);
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.error = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  await closeFilmTools();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
