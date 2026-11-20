#!/usr/bin/env node
// Real draw of a 3D ribbon whose point count changes between drawn frames
// (tests/fixtures/ribbon-growth.ts), on WebGPU and on WebGL. A dynamic
// particle/ribbon mesh once kept drawing the index range of its first draw:
// LayaAir's MeshRenderer sends a submesh's range to the draw call only when
// the mesh is (re)assigned. The check reads the range the render element will
// draw and screenshots each step; the ribbon is a white band on black along
// y = 0, so the lit run of the middle row must match the band's extent.
//
// RIBBON_RENDERERS=webgpu,webgl (default both), RIBBON_OUT (evidence
// folder). Desktop GPU evidence only; not phone or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import esbuild from 'esbuild';
import { PNG } from 'pngjs';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { gpuLabelExpression } from './lib/gpu-label.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const renderers = (process.env.RIBBON_RENDERERS || 'webgpu,webgl').split(',').filter(Boolean);
if (!renderers.length || renderers.some((r) => !['webgpu', 'webgl'].includes(r)))
  throw Error('RIBBON_RENDERERS lists webgpu and/or webgl');
const out = path.resolve(process.env.RIBBON_OUT || path.join(os.tmpdir(), 'zhuda-ribbon-growth'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
const profileOf = (renderer) => (renderer === 'webgpu' ? '3d-webgpu' : '3d');
await buildBrowserSdk({ engineRoot, outDir: web, profiles: renderers.map(profileOf) });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/ribbon-growth.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
for (const renderer of renderers)
  fs.writeFileSync(
    path.join(web, `${renderer}.html`),
    '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:640px;height:360px}</style>' +
      `<div id="view"></div><script src="zhuda-${profileOf(renderer)}.js"></script><script src="page.js"></script>`,
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

// [points, x0, x1]: first draw two quads at the left, then grow, shrink, grow.
// (Two points draw nothing visible: a path's end vertices fade to clear.)
const STEPS = [
  [3, -3, -2.6],
  [54, -3, 3],
  [10, -3, -1],
  [40, -3, 2],
];
/** The lit run of the screenshot's middle row, as fractions of its width. */
function litRun(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const y = img.height >> 1;
  let first = -1,
    last = -1;
  for (let x = 0; x < img.width; x++) {
    const o = (y * img.width + x) * 4;
    if (img.data[o] + img.data[o + 1] + img.data[o + 2] > 300) {
      if (first < 0) first = x;
      last = x;
    }
  }
  return first < 0 ? null : [first / img.width, (last + 1) / img.width];
}

const report = { renderers: {}, failures: [] };
const browser = await chromeFixture();
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 640,
    height: 360,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const renderer of renderers) {
    await browser.send('Page.navigate', {
      url: `http://127.0.0.1:${server.address().port}/${renderer}.html`,
    });
    await browser.waitFor('window.__RIBBON__?.ready || window.__RIBBON__?.errors.length', 60000);
    const errors = await browser.evaluate('__RIBBON__.errors');
    if (errors.length) throw Error(`${renderer} page failed: ${errors.join('; ')}`);
    await browser.waitFor('!document.getElementById("zhudaLogoSplash")', 10000);
    const entry = {
      gpu: await browser.evaluate(gpuLabelExpression(renderer === 'webgpu')),
      steps: [],
    };
    report.renderers[renderer] = entry;
    for (const [index, [points, x0, x1]] of STEPS.entries()) {
      const state = await browser.evaluate(`__RIBBON__.step(${points}, ${x0}, ${x1})`);
      const file = path.join(out, 'evidence', `${renderer}-${index}-${points}.png`);
      await browser.screenshot(file);
      const run = litRun(file);
      const { expected } = state;
      const step = { ...state, lit: run, screenshot: file };
      entry.steps.push(step);
      const where = `${renderer} step ${index} (${points} points)`;
      if (state.drawnIndices !== state.submittedIndices)
        report.failures.push(
          `${where}: the draw uses ${state.drawnIndices} indices, ${state.submittedIndices} were submitted`,
        );
      // The band's ends fade over their end segment: the lit run starts and
      // stops within one segment of the ends, never past them (2 px slack).
      const slack = 2 / 640,
        segment = (expected[1] - expected[0]) / (points - 1);
      const near = (lit, end, inward) =>
        inward > 0
          ? lit >= end - slack && lit <= end + segment
          : lit <= end + slack && lit >= end - segment;
      if (!run || !near(run[0], expected[0], 1) || !near(run[1], expected[1], -1))
        report.failures.push(
          `${where}: lit x ${run ? run.map((v) => v.toFixed(3)).join('..') : 'none'}, expected ${expected.map((v) => v.toFixed(3)).join('..')}`,
        );
    }
    const pageErrors = await browser.evaluate('__RIBBON__.errors');
    if (pageErrors.length)
      report.failures.push(`${renderer}: page errors ${pageErrors.join('; ')}`);
  }
  report.consoleErrors = browser.errors;
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exit(1);
