#!/usr/bin/env node
// End-to-end check of the agent film loop over the real MCP stdio server:
// create → preview → apply (with preview) → review grid → still twice
// (identical bytes) → MP4, plus refusals that must leave state unchanged.
// Real desktop WebGL through headless Chrome; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { spawn, execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.FILM_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-scene'),
);
fs.rmSync(out, { recursive: true, force: true });
const films = path.join(out, 'films'),
  evidence = path.join(out, 'evidence');
fs.mkdirSync(films, { recursive: true });
fs.mkdirSync(evidence, { recursive: true });

const server = spawn(
  process.execPath,
  [path.join(engineRoot, 'packages/mcp-server/index.mjs'), '--film-output', films],
  { stdio: ['pipe', 'pipe', 'inherit'] },
);
const waiting = new Map();
let serial = 0;
readline.createInterface({ input: server.stdout }).on('line', (line) => {
  const message = JSON.parse(line);
  waiting.get(message.id)?.(message);
  waiting.delete(message.id);
});
const rpc = (method, params) =>
  new Promise((resolve, reject) => {
    const id = ++serial,
      timer = setTimeout(() => reject(Error('MCP timeout ' + method)), 600000);
    waiting.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
const log = [];
async function call(name, args) {
  const reply = await rpc('tools/call', { name, arguments: args });
  log.push({ name, error: reply.error?.message ?? null });
  if (reply.error) return { error: reply.error.message };
  const content = reply.result.content;
  const images = content
    .filter((b) => b.type === 'image')
    .map((b) => Buffer.from(b.data, 'base64'));
  const json = JSON.parse(content.find((b) => b.type === 'text').text);
  return { json, images };
}
const png = (bytes) => PNG.sync.read(bytes);
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function difference(a, b) {
  const x = png(a),
    y = png(b);
  assert.equal(x.width, y.width);
  let changed = 0;
  for (let i = 0; i < x.data.length; i += 4)
    if (Math.max(...[0, 1, 2].map((k) => Math.abs(x.data[i + k] - y.data[i + k]))) > 8) changed++;
  return changed / (x.width * x.height);
}
function distinctColours(bytes) {
  const image = png(bytes),
    seen = new Set();
  for (let i = 0; i < image.data.length; i += 16)
    seen.add((image.data[i] << 16) | (image.data[i + 1] << 8) | image.data[i + 2]);
  return seen.size;
}

const scene = {
  schemaVersion: 1,
  id: 'container-yard',
  camera: { eye: [11, 5.5, 14], target: [0, 1.4, 0], focalLengthMm: 35, fStop: 4 },
  look: { sun: { azimuthDeg: -50, elevationDeg: 35, intensity: 1.3 } },
  materials: { 'red-paint': { recipe: 'painted-steel', tint: [0.75, 0.25, 0.2, 1] } },
  nodes: [
    { id: 'ground', type: 'ground', size: [80, 80], material: 'asphalt' },
    { id: 'c1', type: 'prop', prop: 'container20', position: [0, 0, 0], seed: 1 },
    { id: 'c2', type: 'prop', prop: 'container20', position: [0, 2.6, 0], seed: 2 },
    { id: 'p1', type: 'prop', prop: 'pallet', position: [5, 0, 1.5], yawDeg: 30 },
  ],
};

const report = { steps: {} };
try {
  const init = await rpc('initialize', {});
  assert.equal(
    init.result.serverInfo.version,
    JSON.parse(fs.readFileSync(path.join(engineRoot, 'package.json'))).version,
  );

  const created = await call('film_scene_create', { scene });
  assert.equal(created.json.revision, 0);
  const id = created.json.sessionId;
  report.steps.create = created.json;

  const first = await call('film_scene_preview', { sessionId: id, expectedRevision: 0 });
  assert.equal(first.images.length, 1);
  assert.equal(png(first.images[0]).width, 640);
  assert.ok(distinctColours(first.images[0]) > 200, 'preview has real content');
  fs.writeFileSync(path.join(evidence, 'preview-r0.png'), first.images[0]);
  report.steps.preview = first.json;

  // Refusals keep the scene and revision.
  const stale = await call('film_scene_apply', {
    sessionId: id,
    expectedRevision: 5,
    patch: { remove: ['p1'] },
  });
  assert.match(stale.error, /Stale revision/);
  const unknown = await call('film_scene_apply', {
    sessionId: id,
    expectedRevision: 0,
    patch: { upsert: [{ id: 'x', type: 'prop', prop: 'rocket', position: [0, 0, 0] }] },
  });
  assert.match(unknown.error, /unknown prop rocket/);
  const code = await call('film_scene_apply', {
    sessionId: id,
    expectedRevision: 0,
    patch: {
      upsert: [
        {
          id: 'x',
          type: 'box',
          size: [1, 1, 1],
          position: [0, 0, 0],
          material: 'asphalt',
          script: 'alert(1)',
        },
      ],
    },
  });
  assert.match(code.error, /unknown field/);
  assert.equal((await call('film_scene_get', { sessionId: id })).json.revision, 0);

  const applied = await call('film_scene_apply', {
    sessionId: id,
    expectedRevision: 0,
    preview: true,
    patch: {
      upsert: [
        {
          id: 'c3',
          type: 'prop',
          prop: 'container20',
          position: [0, 0, 3.2],
          yawDeg: 180,
          seed: 3,
          params: { paint: 'red-paint' },
        },
        { id: 'b1', type: 'prop', prop: 'jersey-barrier', position: [3, 0, 8] },
      ],
      look: { sun: { elevationDeg: 18 } },
    },
  });
  assert.equal(applied.json.revision, 1);
  assert.equal(applied.images.length, 1);
  fs.writeFileSync(path.join(evidence, 'preview-r1.png'), applied.images[0]);
  report.steps.applyChangedPixels = difference(first.images[0], applied.images[0]);
  assert.ok(report.steps.applyChangedPixels > 0.02, 'the new revision changes the image');

  const review = await call('film_scene_review', {
    sessionId: id,
    expectedRevision: 1,
    width: 320,
    height: 240,
    shots: [
      { label: 'Wide', camera: { eye: [14, 7, 18], target: [0, 1.4, 1.5] } },
      { label: 'Side', camera: { eye: [16, 2, 1.5], target: [0, 1.3, 1.5] } },
      { label: 'Low', camera: { eye: [4, 0.6, 9], target: [0, 2, 1.5], focalLengthMm: 24 } },
      { label: 'Top', camera: { eye: [0.01, 30, 1.5], target: [0, 0, 1.5] } },
    ],
  });
  const grid = png(review.images[0]);
  assert.equal(grid.width, 644);
  assert.equal(grid.height, 484);
  assert.equal(review.json.cells.length, 4);
  fs.writeFileSync(path.join(evidence, 'review.png'), review.images[0]);
  report.steps.review = review.json;

  const still = (name) =>
    call('film_render_job', {
      sessionId: id,
      expectedRevision: 1,
      kind: 'still',
      name,
      width: 1280,
      height: 720,
      samples: 16,
    });
  const a = await still('yard-a'),
    b = await still('yard-b');
  assert.equal(a.json.sha256, b.json.sha256, 'identical still jobs give identical bytes');
  assert.equal(a.json.sha256, sha(fs.readFileSync(path.join(films, 'yard-a.png'))));
  fs.copyFileSync(path.join(films, 'yard-a.png'), path.join(evidence, 'still.png'));
  report.steps.still = a.json;

  const overwrite = await still('yard-a');
  assert.match(overwrite.error, /exists/);
  const escape = await call('film_render_job', { sessionId: id, kind: 'still', name: '../escape' });
  assert.match(escape.error, /name must use/);

  const fps = 12,
    video = await call('film_render_job', {
      sessionId: id,
      expectedRevision: 1,
      kind: 'video',
      name: 'yard-dolly',
      fps,
      width: 640,
      height: 360,
      samples: 2,
      cameraPath: [
        { time: 0, camera: { eye: [14, 6, 16], target: [0, 1.4, 1.5] } },
        { time: 2, camera: { eye: [8, 2.2, 10], target: [0, 1.8, 1.5], focalLengthMm: 50 } },
      ],
    });
  assert.ok(!video.error, video.error);
  assert.equal(video.json.frames, 2 * fps);
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-count_frames',
        '-show_streams',
        '-of',
        'json',
        path.join(films, 'yard-dolly.mp4'),
      ],
      {
        encoding: 'utf8',
      },
    ),
  ).streams[0];
  assert.equal(Number(probe.nb_read_frames), 2 * fps);
  assert.equal(probe.width, 640);
  report.steps.video = {
    ...video.json,
    probedFrames: Number(probe.nb_read_frames),
    codec: probe.codec_name,
  };
  fs.copyFileSync(path.join(films, 'yard-dolly.mp4'), path.join(evidence, 'dolly.mp4'));

  assert.equal((await call('film_scene_close', { sessionId: id })).json.closed, true);
  report.protocol = log;
  report.passed = true;
} finally {
  server.stdin.end();
  await new Promise((resolve) => server.once('exit', resolve));
  fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(
  `PASS film scene loop: ${log.length} MCP calls, apply changed ${(report.steps.applyChangedPixels * 100).toFixed(1)}% of pixels, ` +
    `still ${report.steps.still.sha256.slice(0, 12)} (twice identical), MP4 ${report.steps.video.probedFrames} frames; evidence ${evidence}`,
);
