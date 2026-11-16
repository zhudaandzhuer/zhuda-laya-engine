#!/usr/bin/env node
// What ripples cost the water on the GPU (tests/fixtures/water-ripples-cost.ts):
// a 1280×720 view filled with water, drawn frame after frame through the
// browser SDK with the graphics card waited for before and after, with no
// bodies in the water, one still body and four moving ones. Seven interleaved
// rounds of 120 frames each, the median of each case. Desktop evidence only,
// not phone evidence. WATER_RIPPLES_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu)
// measures the WebGPU build.
//   node scripts/measure-water-ripples.mjs [outDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'zhuda-water-ripples-cost'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const gpuBuild =
  (process.env.WATER_RIPPLES_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/water-ripples-cost.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'cost.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:1280px;height:720px}</style>` +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);
const server = http.createServer((request, response) => {
  const file = path.resolve(
    web,
    '.' + decodeURIComponent(new URL(request.url, 'http://x').pathname),
  );
  if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return response.writeHead(404).end();
  response.writeHead(200, {
    'Content-Type': file.endsWith('.html')
      ? 'text/html'
      : file.endsWith('.wasm')
        ? 'application/wasm'
        : 'text/javascript',
  });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const CASES = {
  none: [],
  oneStill: [{ x: 0, z: 0, radius: 0.4, strength: 1 }],
  fourMoving: [
    { x: -3, z: -2, radius: 0.5, strength: 1.5, velocity: [0, -1.5] },
    { x: 3, z: -1, radius: 0.4, strength: 1, velocity: [1, 0] },
    { x: 0, z: -6, radius: 1.2, strength: 2, velocity: [-2, -1] },
    { x: 2, z: 2, radius: 0.4, strength: 1, velocity: [0.3, 1.2] },
  ],
};
const ROUNDS = 7;
const browser = await chromeFixture();
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/cost.html`,
  });
  for (let i = 0; i < 600; i++) {
    const done = await browser
      .evaluate('window.__RIPPLES__?.ready === true || window.__RIPPLES__?.errors.length > 0')
      .catch(() => false);
    if (done) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const page = JSON.parse(
    await browser.evaluate(
      'JSON.stringify({ready: window.__RIPPLES__.ready, errors: window.__RIPPLES__.errors, backend: window.__RIPPLES__.backend})',
    ),
  );
  assert.equal(page.ready, true, page.errors.join('\n'));
  const times = Object.fromEntries(Object.keys(CASES).map((name) => [name, []]));
  for (let round = 0; round < ROUNDS + 1; round++)
    for (const [name, sources] of Object.entries(CASES)) {
      const ms = await browser.evaluate(`window.__RIPPLES__.cost(${JSON.stringify(sources)})`, {
        timeoutMs: 120000,
      });
      // The first round compiles and warms up.
      if (round > 0) times[name].push(ms);
    }
  await browser.screenshot(path.join(out, 'four-moving.png'));
  const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const msPerFrame = Object.fromEntries(
    Object.entries(times).map(([name, list]) => [name, +median(list).toFixed(3)]),
  );
  const report = {
    backend: page.backend,
    view: '1280x720, DPR 1, water over the whole view',
    rounds: ROUNDS,
    framesPerRound: 120,
    msPerFrame,
    extraMs: {
      oneStill: +(msPerFrame.oneStill - msPerFrame.none).toFixed(3),
      fourMoving: +(msPerFrame.fourMoving - msPerFrame.none).toFixed(3),
    },
    all: Object.fromEntries(
      Object.entries(times).map(([name, list]) => [name, list.map((v) => +v.toFixed(3))]),
    ),
    errors: JSON.parse(await browser.evaluate('JSON.stringify(window.__RIPPLES__.errors)')),
  };
  assert.deepEqual(report.errors, [], 'no page errors');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, ...report }, null, 2));
} finally {
  await browser.close();
  server.close();
}
