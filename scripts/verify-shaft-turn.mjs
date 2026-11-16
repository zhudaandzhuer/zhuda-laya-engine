#!/usr/bin/env node
// Real-GPU check of the light shafts of a game's look (ZhudaSceneLook) while
// the sun turns with a game's clock (tests/fixtures/shaft-turn.ts): a long dark
// wall in the low eastern sun shades the fog below a line.
// - The depth picture of the light is drawn again only when the sun has turned
//   more than half a degree: 0.3 degrees on, the picture is kept; a 3 degree
//   climb in 60 frames draws it about 6 times, not 60.
// - A kept picture shows the same beams as a fresh one at the same sun: the
//   difference is no larger than the step noise between two fresh frames, and
//   the shade, the lit fog above it and past its end are where they belong.
// - A large turn (10 degrees) draws a fresh picture: the shade line drops.
// Desktop GPU evidence only (WebGL, or WebGPU with SHAFT_TURN_RENDERER=webgpu);
// frame times on a phone are in docs/plans/records/shaft-sun-turn/.
//   node scripts/verify-shaft-turn.mjs [outDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'zhuda-shaft-turn'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
const gpuBuild = (process.env.SHAFT_TURN_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/shaft-turn.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'shaft-turn.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:480px;height:300px}</style>` +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);

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
      : 'text/javascript';
  response.writeHead(200, { 'Content-Type': type });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromeFixture();
const report = { backend: gpuBuild ? 'webgpu' : 'webgl' };
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 480,
    height: 300,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/shaft-turn.html`,
  });
  for (let i = 0; i < 600; i++) {
    const done = await browser
      .evaluate('window.__SHAFT_TURN__?.ready === true || window.__SHAFT_TURN__?.errors.length > 0')
      .catch(() => false);
    if (done) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const page = JSON.parse(
    await browser.evaluate(
      'JSON.stringify({ready: window.__SHAFT_TURN__.ready, errors: window.__SHAFT_TURN__.errors, canvas: window.__SHAFT_TURN__.canvas})',
    ),
  );
  assert.equal(page.ready, true, page.errors.join('\n'));
  report.canvas = page.canvas;
  assert.equal(
    page.canvas,
    gpuBuild ? 'webgpu' : 'webgl2',
    'the page draws on the backend asked for',
  );
  const r = JSON.parse(
    await browser.evaluate('JSON.stringify(window.__SHAFT_TURN__.check())', { timeoutMs: 120000 }),
  );
  Object.assign(report, r);
  assert.deepEqual(r.setLook, ['updated'], 'the look is changed in place, not rebuilt');
  assert.equal(r.keptDrew, 0, '0.3 degrees on, the picture is kept');
  assert.equal(r.freshDrew, 1, 'a picture asked for is drawn');
  assert.ok(
    r.sweepPictures >= 5 && r.sweepPictures <= 7,
    `a 3 degree climb in 60 frames draws about 6 pictures: ${r.sweepPictures}`,
  );
  assert.equal(r.highDrew, 1, 'a 10 degree turn draws a fresh picture');
  for (const [name, s] of Object.entries({
    kept: r.kept,
    fresh: r.fresh,
    afterSweep: r.afterSweep,
  })) {
    assert.ok(s.under[0] < 12, `${name}: fog in the wall's shadow stays dark: ${s.under}`);
    assert.ok(
      s.mid[0] < s.above[0] * 0.5,
      `${name}: the ray just under the line is shaded: ${s.mid}`,
    );
    assert.ok(s.above[0] > s.under[0] * 3 + 20, `${name}: fog above the shadow is lit: ${s.above}`);
    assert.ok(
      s.beyond[0] > s.under[0] * 3 + 10,
      `${name}: fog past the end of the shadow is lit: ${s.beyond}`,
    );
  }
  assert.ok(
    r.keptAgainstFresh.meanAbsDiff <= r.freshAgainstFresh.meanAbsDiff * 1.5 + 0.3,
    'a kept picture shows the beams of a fresh one: ' +
      JSON.stringify([r.keptAgainstFresh, r.freshAgainstFresh]),
  );
  assert.ok(
    r.high.mid[0] > r.kept.mid[0] * 2 + 10,
    `10 degrees higher, the shade drops below the ray: ${r.high.mid} against ${r.kept.mid}`,
  );
  report.errors = JSON.parse(
    await browser.evaluate('JSON.stringify(window.__SHAFT_TURN__.errors)'),
  );
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
