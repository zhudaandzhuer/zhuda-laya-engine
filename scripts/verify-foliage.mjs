#!/usr/bin/env node
// Real-GPU check of foliage wind and kept coverage (packages/core/runtime3d/Foliage.ts)
// through the browser SDK (tests/fixtures/foliage.ts): cut-out leaf cards of
// LayaAir's glTF shader on a floor in the sun.
// - A card marked for wind moves between two times, and its shadow on the
//   floor moves with it; the unmarked card beside it does not move.
// - Far away, a card that keeps its coverage stays fuller than the same card
//   without it, and closer to the share of the picture that is leaf.
// Desktop GPU evidence only (WebGL, or WebGPU with FOLIAGE_RENDERER=webgpu).
//   node scripts/verify-foliage.mjs [outDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { PNG } from 'pngjs';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'zhuda-foliage'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
const gpuBuild = (process.env.FOLIAGE_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/foliage.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'foliage.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:640px;height:400px}</style>` +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);

// A leaf picture: small narrow leaves scattered on nothing, about a third leaf
// (as a scanned leaf picture: thin leaflets with more nothing between them).
const TW = 256,
  TH = 512;
const picture = new PNG({ width: TW, height: TH });
let seed = 7;
const next = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const leaves = Array.from({ length: 700 }, () => [
  next() * TW,
  next() * TH,
  1.6 + next() * 1.6,
  6 + next() * 5,
  next() * Math.PI,
]);
let leaf = 0;
for (let y = 0; y < TH; y++)
  for (let x = 0; x < TW; x++) {
    const i = (y * TW + x) * 4;
    const inside = leaves.some(([cx, cy, a, b, t]) => {
      const dx = x - cx,
        dy = y - cy;
      const u = dx * Math.cos(t) + dy * Math.sin(t),
        v = -dx * Math.sin(t) + dy * Math.cos(t);
      return (u * u) / (a * a) + (v * v) / (b * b) < 1;
    });
    picture.data.set([40, 140, 30, inside ? 255 : 0], i);
    leaf += inside ? 1 : 0;
  }
const leafShare = leaf / (TW * TH);
const png = PNG.sync.write(picture);

/** A glTF card 3 m wide and 7 m tall standing on its base, cut out of the picture. */
function cardGlb() {
  const positions = new Float32Array([-1.5, 0, 0, 1.5, 0, 0, 1.5, 7, 0, -1.5, 7, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const parts = [positions, normals, uvs, indices].map((a) => Buffer.from(a.buffer));
  const pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
  const views = [];
  let offset = 0;
  const chunks = [];
  for (const [i, b] of [...parts, png].entries()) {
    const body = pad(b);
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: b.length,
      ...(i < 3 ? { target: 34962 } : i === 3 ? { target: 34963 } : {}),
    });
    chunks.push(body);
    offset += body.length;
  }
  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'card' }],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: 'VEC3',
        min: [-1.5, 0, 0],
        max: [1.5, 7, 0],
      },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
    images: [{ bufferView: 4, mimeType: 'image/png' }],
    samplers: [{ magFilter: 9729, minFilter: 9987 }],
    textures: [{ source: 0, sampler: 0 }],
    materials: [
      {
        name: 'leaves',
        doubleSided: true,
        alphaMode: 'MASK',
        alphaCutoff: 0.5,
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(data.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, data]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, text), chunk(0x004e4942, bin)]);
}
for (const name of ['wind-card', 'still-card', 'keep-card', 'thin-card'])
  fs.writeFileSync(path.join(web, name + '.glb'), cardGlb());

const server = http.createServer((request, response) => {
  const file = path.resolve(
    web,
    '.' + decodeURIComponent(new URL(request.url, 'http://x').pathname),
  );
  if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return response.writeHead(404).end();
  const type = file.endsWith('.html')
    ? 'text/html'
    : file.endsWith('.wasm')
      ? 'application/wasm'
      : file.endsWith('.glb')
        ? 'model/gltf-binary'
        : 'text/javascript';
  response.writeHead(200, { 'Content-Type': type });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromeFixture();
const report = { backend: gpuBuild ? 'webgpu' : 'webgl', leafShare: +leafShare.toFixed(3) };
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 640,
    height: 400,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/foliage.html`,
  });
  for (let i = 0; i < 600; i++) {
    const done = await browser
      .evaluate('window.__FOLIAGE__?.ready === true || window.__FOLIAGE__?.errors.length > 0')
      .catch(() => false);
    if (done) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const page = JSON.parse(
    await browser.evaluate(
      'JSON.stringify({ready: window.__FOLIAGE__.ready, errors: window.__FOLIAGE__.errors, status: window.__FOLIAGE__.status, marks: window.__FOLIAGE__.marks, backend: window.__FOLIAGE__.backend, canvas: window.__FOLIAGE__.canvas})',
    ),
  );
  assert.equal(page.ready, true, page.errors.join('\n'));
  report.status = page.status;
  report.pageBackend = page.backend;
  report.canvas = page.canvas;
  assert.equal(
    page.canvas,
    gpuBuild ? 'webgpu' : 'webgl2',
    'the page draws on the backend asked for',
  );
  report.marks = page.marks;
  assert.ok(
    page.status.wind && page.status.coverage && page.status.passes > 0,
    'the patches are installed: ' + JSON.stringify(page.status),
  );
  const W = 640,
    H = 400;
  const frame = async (seconds) =>
    Uint8Array.from(
      JSON.parse(
        await browser.evaluate(`JSON.stringify(window.__FOLIAGE__.frame(${seconds}))`, {
          timeoutMs: 120000,
        }),
      ),
    );
  const save = (name, pixels) => {
    const image = new PNG({ width: W, height: H });
    image.data.set(pixels);
    fs.writeFileSync(path.join(out, 'evidence', name + '.png'), PNG.sync.write(image));
  };
  const a = await frame(0.4),
    b = await frame(2.1);
  save('wind-0.4s', a);
  save('wind-2.1s', b);
  const green = (p, i) => p[i + 1] > p[i] * 1.4 && p[i + 1] > p[i + 2] * 1.4 && p[i + 1] > 40;
  const grey = (p, i) =>
    Math.abs(p[i] - p[i + 1]) < 24 &&
    Math.abs(p[i + 1] - p[i + 2]) < 24 &&
    !(p[i] > 200 && p[i + 2] > 200 && p[i + 1] < 80);
  /** Pixels that changed in a column range: on the cards, and on the floor (the shadow). */
  const changed = (x0, x1) => {
    let leavesMoved = 0,
      shadowMoved = 0;
    for (let y = 0; y < H; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        const d =
          Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        if (d < 40) continue;
        if (green(a, i) || green(b, i)) leavesMoved++;
        else if (grey(a, i) && grey(b, i)) shadowMoved++;
      }
    return { leavesMoved, shadowMoved };
  };
  report.windy = changed(0, W / 2);
  report.still = changed(W / 2, W);
  assert.ok(
    report.windy.leavesMoved > 400,
    'the marked card moves in the wind: ' + JSON.stringify(report.windy),
  );
  assert.ok(
    report.windy.shadowMoved > 100,
    'its shadow moves with it: ' + JSON.stringify(report.windy),
  );
  assert.ok(
    report.still.leavesMoved < 20,
    'the unmarked card stays still: ' + JSON.stringify(report.still),
  );
  // Far away: the share of each far card's box that is leaf. The far cards
  // stand 70 m behind and 42 m out to each side, clear of the near ones
  // (columns 0..180 and 460..640); each box is found from its green pixels.
  const box = (x0, x1) => {
    let lo = H,
      hi = 0,
      left = W,
      right = 0,
      count = 0;
    for (let y = 0; y < H * 0.62; y++)
      for (let x = x0; x < x1; x++)
        if (green(a, (y * W + x) * 4)) {
          count++;
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
    const area = Math.max(1, (hi - lo + 1) * (right - left + 1));
    return { count, area, share: +(count / area).toFixed(3) };
  };
  report.farKept = box(0, 180);
  report.farThin = box(460, W);
  assert.ok(
    report.farKept.count > 30 && report.farThin.count > 0,
    'both far cards are in view: ' + JSON.stringify([report.farKept, report.farThin]),
  );
  assert.ok(
    report.farKept.share > report.farThin.share * 1.3,
    `the far card that keeps its coverage is fuller: ${report.farKept.share} against ${report.farThin.share}`,
  );
  assert.ok(
    report.farKept.share <= 1 && report.farKept.share > leafShare * 0.8,
    'about as full as the picture is leaf, or fuller: ' + report.farKept.share,
  );
  report.errors = JSON.parse(await browser.evaluate('JSON.stringify(window.__FOLIAGE__.errors)'));
  assert.deepEqual(report.errors, [], 'no page errors');
  fs.writeFileSync(path.join(out, 'evidence', 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, out, ...report }, null, 2));
} catch (error) {
  fs.writeFileSync(
    path.join(out, 'evidence', 'report.json'),
    JSON.stringify({ ...report, error: String(error.stack || error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  server.close();
}
