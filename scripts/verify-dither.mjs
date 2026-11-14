#!/usr/bin/env node
// Real-GPU check of the dither, through the browser SDK: a ramp of ten steps
// of eight bits across the view, drawn straight to the canvas and through an
// HDR chain. Without dither it is ten flat bands; with it every pixel is
// within one step of where it was, the picture is as bright, and a few
// pixels together average to the shade that was meant.
// Desktop GPU evidence only (WebGL, or WebGPU with DITHER_RENDERER).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { gpuLabelExpression } from './lib/gpu-label.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.env.DITHER_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-dither'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// DITHER_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.DITHER_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 512,
  H = 128;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/dither.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'live.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:${W}px;height:${H}px}</style>` +
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
        : file.endsWith('.js')
          ? 'text/javascript'
          : 'application/octet-stream',
  });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

let report;
const browser = await chromeFixture();
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  for (let i = 0; i < 2400; i++) {
    if (
      await browser.evaluate(
        'window.__DITHER__ && (window.__DITHER__.ready || window.__DITHER__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Named by the backend the page ran on.
  const gpu = await browser.evaluate(gpuLabelExpression(gpuBuild));
  report = {
    gpu,
    ...(await browser.evaluate('window.__DITHER__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__DITHER__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__DITHER__.picture('${name}')`).catch(() => null);
    if (!url) continue;
    fs.writeFileSync(
      path.join(out, 'evidence', `${name}.png`),
      Buffer.from(url.split(',')[1], 'base64'),
    );
    report.pictures.push(`${name}.png`);
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');
if (process.env.DITHER_EXPLORE) {
  console.log(JSON.stringify(report, null, 1));
  process.exit(0);
}
assert.equal(report.error, undefined, report.error);
assert.equal(report.ready, true, 'the fixture finished');
assert.deepEqual(report.errors, [], 'no page errors');
assert.deepEqual(report.consoleErrors, [], 'no console errors');
assert.deepEqual(report.gpuWarnings, [], 'no shader or GPU warnings');
assert.deepEqual(report.rendererErrors, [], 'no renderer errors');
assert.equal(report.renderer, gpuBuild ? 'webgpu' : 'webgl');
const { direct, chain, lit, look } = report;
// The shader text was found, and LayaAir's own programs carry the noise.
assert.equal(report.status.ready, true, report.status.reason);
assert.ok(report.status.passes >= 20, `${report.status.passes} programs`);

// A ramp of ten steps of eight bits. Against the ramp as it was meant (the
// dithered picture's columns, smoothed): without dither a block of eight by
// eight pixels is a fifth of a step off on average, which is the bands; with
// it, a twentieth. A pixel is further off than it was: that is the grain.
for (const [name, ramp, mode, other, most] of [
  ['a plain camera', direct, 'materials', 'screen', 2],
  ['an HDR chain', chain, 'screen', 'materials', 1],
]) {
  assert.equal(ramp.mode, mode, `${name}: where its picture is rounded`);
  assert.equal(ramp.said, mode);
  assert.ok(ramp.plain.block > 0.15, `${name}: bands without dither (${ramp.plain.block})`);
  assert.ok(
    ramp.dithered.block < 0.08 && ramp.dithered.block < ramp.plain.block * 0.4,
    `${name}: a few pixels together are the shade that was meant (${ramp.plain.block} -> ${ramp.dithered.block})`,
  );
  assert.ok(ramp.dithered.pixel > ramp.plain.pixel, `${name}: the price is grain`);
  assert.ok(ramp.apart.most <= most, `${name}: a pixel moves ${ramp.apart.most} steps at most`);
  assert.ok(Math.abs(ramp.apart.meanShift) < 0.02, `${name}: as bright (${ramp.apart.meanShift})`);
  assert.deepEqual(ramp.black, { plain: 0, dithered: 0 }, `${name}: black stays black`);
  assert.deepEqual(
    ramp.again,
    { most: 0, changed: 0, meanShift: 0 },
    `${name}: the same frame again`,
  );
  assert.ok(ramp.sameSign > 0.95, `${name}: the grain is the arithmetic's (${ramp.sameSign})`);
  // Dithered at the other place, the bands stay.
  assert.equal(ramp.otherPlace.mode, other);
  assert.ok(
    ramp.otherPlace.block > ramp.dithered.block * 2,
    `${name}: the other place is not where it is rounded (${ramp.otherPlace.block})`,
  );
  assert.deepEqual(ramp.offAgain, { most: 0, changed: 0, meanShift: 0 }, `${name}: off again`);
}
// LayaAir's own lit program, on a plain camera.
assert.ok(lit.apart.changed > 0.05 && lit.apart.most <= 4, JSON.stringify(lit.apart));
assert.ok(
  Math.abs(lit.apart.meanShift) < 0.1,
  `the lit ball is as bright (${lit.apart.meanShift})`,
);
// A game's look: with the look, in place, and gone with it.
assert.equal(look.built, 'screen');
assert.deepEqual(look.switchedOff, ['updated', 'off']);
assert.ok(look.apart.most === 1 && look.apart.changed > 0.1, JSON.stringify(look.apart));
assert.deepEqual(look.switchedOn, ['updated', 'screen']);
assert.deepEqual(look.backAgain, { most: 0, changed: 0, meanShift: 0 });
assert.equal(look.disposed, 'off');

assert.deepEqual(report.left, { direct: 0, chain: 0, lit: 0, look: 0 }, 'nothing left behind');
console.log(
  `PASS dither on ${report.renderer} (${report.gpu}): a block of pixels off the ramp by ` +
    `${direct.plain.block} -> ${direct.dithered.block} of a step on a plain camera, ` +
    `${chain.plain.block} -> ${chain.dithered.block} through an HDR chain; black stays black; ` +
    `${report.status.passes} programs; evidence in ${path.join(out, 'evidence')}`,
);
