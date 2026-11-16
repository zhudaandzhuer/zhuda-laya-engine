#!/usr/bin/env node
// Real-GPU check of the density volume for isosurfaces, through the browser
// SDK (tests/fixtures/density-volume.ts): a rock field computed on the GPU
// (ZhudaComputePass on WebGPU) equals the same field in JavaScript point by
// point, and both mesh to one closed piece with the floating stones removed
// (four with them); a load cancelled before and during its read back, timed
// out, and failed (a GLSL density that is another field, a JavaScript
// density that throws); no GPU buffer left after the failures or after 30
// loads and releases. On WebGL there is no compute: the JavaScript density
// fills the grid. Desktop GPU evidence only (WebGL, or WebGPU with
// DENSITY_RENDERER=webgpu); no phone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.DENSITY_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-density-volume'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// DENSITY_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.DENSITY_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 64,
  H = 64;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/density-volume.ts')],
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
  // The WebGPU bundle fetches its shader compilers from folders beside it.
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

let report;
const browser = await chromeFixture();
try {
  const gpu = await browser.evaluate(
    `(()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c.getExtension('WEBGL_debug_renderer_info');return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)})()`,
  );
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  for (let i = 0; i < 3000; i++) {
    if (
      await browser.evaluate(
        'window.__DENSITY__ && (window.__DENSITY__.ready || window.__DENSITY__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__DENSITY__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) => /unCaptured|INVALID|GL_|WebGPU/i.test(m)),
  };
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');
assert.deepEqual(report.gpuWarnings, [], 'GPU errors and warnings');
assert.deepEqual(report.rendererErrors, [], 'renderer errors');
assert.equal(report.backend.selected, gpuBuild ? 'webgpu' : 'webgl');
if (gpuBuild)
  assert.ok(
    report.backend.adapter && !report.backend.adapter.isFallbackAdapter,
    `a WebGPU adapter (${JSON.stringify(report.backend.adapter)})`,
  );
const r = report.r;
// 1. Where there is compute the GPU fills the grid; elsewhere the JavaScript density.
assert.equal(r.computeSupported, gpuBuild);
assert.equal(r.volume.gpuBackend, gpuBuild ? 'webgpu' : 'cpu');
assert.equal(r.volume.cpuBackend, 'cpu');
assert.ok(
  r.volume.largestDifference <= 1e-4,
  `the GPU volume equals the JavaScript volume (largest difference ${r.volume.largestDifference})`,
);
assert.ok(
  r.volume.signFlips <= r.volume.points * 1e-5,
  `inside and outside agree (${r.volume.signFlips} of ${r.volume.points} points differ)`,
);
// Meshed: the floating stones go, one closed piece is left; with them, four.
assert.deepEqual([r.mesh.gpu.count, r.mesh.gpu.closed], [1, true]);
assert.deepEqual([r.mesh.cpu.count, r.mesh.cpu.closed], [1, true]);
assert.deepEqual([r.mesh.withStones.count, r.mesh.withStones.closed], [4, true]);
assert.equal(r.mesh.gpu.vertices, r.mesh.cpu.vertices, 'as many vertices from both volumes');
assert.ok(
  r.mesh.largestMove !== null && r.mesh.largestMove < 1e-3,
  `the vertices of both meshes are in the same places (largest difference ${r.mesh.largestMove} m)`,
);
// 2. Cancelled, timed out, failed.
assert.deepEqual([r.cancelBefore.ok, r.cancelBefore.name], [false, 'AbortError']);
assert.deepEqual([r.cancelDuring.ok, r.cancelDuring.name], [false, 'AbortError']);
assert.deepEqual([r.timeout.ok, r.timeout.name], [false, 'TimeoutError']);
if (gpuBuild)
  assert.match(
    r.wrongGlsl.message ?? '',
    /GPU density differs from the JavaScript density/,
    'a GLSL density that is another field is refused',
  );
else assert.equal(r.wrongGlsl.ok, true, 'without compute the GLSL is not run');
assert.match(r.throwing.message ?? '', /bad rock/);
// 3. Nothing left behind: after the failures and after 30 loads and releases.
assert.equal(r.liveAfterFailures, r.liveAfterFirst, 'failed loads leave no GPU buffer');
assert.ok(
  r.cycles.liveAfter <= r.cycles.liveBefore,
  `30 loads leave no GPU buffer (${r.cycles.liveBefore} -> ${r.cycles.liveAfter}, ${r.cycles.buffersMade} made)`,
);
console.log(
  `PASS density volume on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu}): ` +
    JSON.stringify({
      volume: r.volume,
      gpuMs: r.gpuMs,
      cpuMs: r.cpuMs,
      mesh: r.mesh,
      cancelDuring: r.cancelDuring,
      timeout: r.timeout,
      wrongGlsl: r.wrongGlsl,
      cycles: r.cycles,
    }) +
    `\nReport: ${path.join(out, 'evidence')}`,
);
