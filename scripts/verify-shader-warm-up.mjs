#!/usr/bin/env node
// Real-GPU check of the shader warm-up (`ZhudaShaderVariantRecorder`,
// `zhudaWarmUpShaders`), through the browser SDK. One scene with a look is
// mounted in three fresh browsers:
// - record: every variant compiled while the scene is drawn at each level of
//   its look is listed; the list is valid, sorted and without repeats;
// - cold: a game's own mount. The first frame and each change of level
//   compile shaders, and how many and how long is measured;
// - warm: the list is compiled behind a loading screen first, a few
//   milliseconds a frame while frames go on being drawn. Then the first
//   frame and every change of level compile nothing.
// What a warm-up cannot use (another backend's list, something that is not a
// list, a shader that is not registered, a cancelled signal) is refused or
// reported without failing.
// Desktop GPU evidence only (WebGL, or WebGPU with WARM_UP_RENDERER); the
// times are desktop times and depend on the browser's and the system's own
// shader caches, so they are reported, not asserted beyond their direction.
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
  process.env.WARM_UP_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-shader-warm-up'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// WARM_UP_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.WARM_UP_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/shader-warm-up.ts')],
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

/** One mount in a browser of its own, so that no run inherits another's compiled programs. */
async function run(mode, list) {
  const browser = await chromeFixture();
  try {
    const gpu = await browser.evaluate(
      `(()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c.getExtension('WEBGL_debug_renderer_info');return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)})()`,
    );
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width: W,
      height: H,
      deviceScaleFactor: 1,
      mobile: false,
    });
    if (list)
      await browser.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `window.__WARM_LIST__ = ${JSON.stringify(list)};`,
      });
    await browser.send('Page.navigate', {
      url: `http://127.0.0.1:${server.address().port}/live.html?mode=${mode}`,
    });
    for (let i = 0; i < 1200; i++) {
      if (
        await browser.evaluate(
          'window.__WARM__ && (window.__WARM__.ready || window.__WARM__.error)',
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return {
      gpu,
      ...(await browser.evaluate('window.__WARM__')),
      consoleErrors: browser.errors,
      // WebGPU reports pipeline and validation errors as console warnings.
      gpuWarnings: browser.consoleMessages.filter((m) =>
        /unCaptured|INVALID|GL_|WebGPU|Warm up failed/i.test(m),
      ),
    };
  } finally {
    await browser.close();
  }
}

let report;
try {
  const record = await run('record');
  const cold = await run('cold');
  const warm = record.list ? await run('warm', record.list) : null;
  report = { record, cold, warm };
} finally {
  server.close();
}
// Pictures are written beside the report and left out of it.
for (const [name, page] of Object.entries(report))
  for (const key of ['picture', 'pictureLow'])
    if (page?.[key]) {
      fs.writeFileSync(
        path.join(out, 'evidence', `${name}-${key === 'picture' ? 'level-3' : 'level-0'}.png`),
        Buffer.from(page[key].split(',')[1], 'base64'),
      );
      delete page[key];
    }
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');
if (report.record.list)
  fs.writeFileSync(
    path.join(out, 'evidence/variants.json'),
    JSON.stringify(report.record.list, null, 1) + '\n',
  );

const { record, cold, warm } = report;
for (const [name, page] of Object.entries({ record, cold, warm })) {
  assert.ok(page, `${name} ran`);
  assert.equal(page.ready, true, `${name}: ${page.error}`);
  assert.deepEqual(page.errors, [], `${name}: page errors`);
  assert.deepEqual(page.consoleErrors, [], `${name}: console errors`);
  assert.deepEqual(page.gpuWarnings, [], `${name}: GPU errors and warnings`);
  assert.deepEqual(page.rendererErrors, [], `${name}: renderer errors`);
  // Drawn by the backend asked for; on WebGPU by a real adapter, not a fallback.
  assert.equal(page.backend.selected, gpuBuild ? 'webgpu' : 'webgl');
  assert.equal(page.backend.shader, gpuBuild ? 'webgpu' : 'webgl');
  if (gpuBuild)
    assert.ok(
      page.backend.adapter && !page.backend.adapter.isFallbackAdapter,
      `a WebGPU adapter (${JSON.stringify(page.backend.adapter)})`,
    );
}

// Record: the list holds what was compiled after the recorder was made.
const list = record.list;
assert.deepEqual(record.listProblems, [], 'the recorded list is valid');
assert.equal(list.backend, gpuBuild ? 'webgpu' : 'webgl');
assert.equal(list.variants.length, record.recorded, 'no repeats in what LayaAir listed');
assert.ok(list.variants.length >= 12, `a real list (${list.variants.length} variants)`);
assert.equal(
  list.variants.length,
  record.total - record.atBoot,
  'one entry for each shader compiled after boot',
);
assert.equal(record.sortedAgain, true, 'the same variants in another order give the same list');
assert.match(record.second, /one recorder at a time/);
assert.deepEqual(record.afterStop, { debugMode: false, ownCollection: true });

// Cold: this scene does compile at its first frame and when its look changes level.
assert.equal(cold.beforeDraw, cold.atBoot, 'making the scene and its look compiles nothing');
assert.ok(cold.first.compiled >= 8, `the first frame compiles (${cold.first.compiled})`);
assert.equal(cold.steadyCompiled, 0, 'steady frames compile nothing');
const coldSwitches = cold.levels.reduce((n, level) => n + level.compiled, 0);
assert.ok(coldSwitches >= 2, `changes of level compile (${coldSwitches})`);
assert.equal(
  cold.total - cold.atBoot,
  list.variants.length,
  'the cold run compiles the variants the record run listed',
);

// Warm: the list is compiled behind the loading screen, and then nothing is.
const w = warm.warmUp;
assert.equal(w.refused, undefined, w.refused);
assert.equal(w.total, list.variants.length);
assert.deepEqual(w.missing, [], 'every shader of the list is registered once the scene is made');
assert.deepEqual(w.failed, []);
assert.equal(w.compiled + w.cached, w.total);
assert.equal(w.compiled, cold.total - cold.atBoot, 'the warm-up compiles what the cold run did');
assert.ok(w.slices >= 2, `spread over frames (${w.slices} slices)`);
assert.ok(
  w.framesMeanwhile >= w.slices - 1,
  `frames went on while it compiled (${w.framesMeanwhile} frames, ${w.slices} slices)`,
);
assert.equal(warm.first.compiled, 0, 'the first frame compiles nothing after the warm-up');
assert.equal(warm.steadyCompiled, 0);
for (const level of warm.levels)
  assert.equal(level.compiled, 0, `level ${level.level} compiles nothing after the warm-up`);
assert.equal(warm.total - warm.atBoot, w.compiled, 'nothing was compiled outside the warm-up');
assert.equal(warm.duringWarmUp, w.compiled);
// The warmed-up scene is the same picture as the cold one, at both ends of the look.
const gridDiff = (a, b) => {
  let worst = 0,
    sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > worst) worst = d;
  }
  return { mean: +(sum / a.length).toFixed(3), worst: +worst.toFixed(1) };
};
report.pictureDiff = {
  level3: gridDiff(cold.grid, warm.grid),
  level0: gridDiff(cold.gridLow, warm.gridLow),
};
for (const [name, diff] of Object.entries(report.pictureDiff))
  assert.ok(
    diff.mean < 0.5 && diff.worst < 4,
    `${name}: the warmed-up picture is the cold one (mean ${diff.mean}, worst cell ${diff.worst} of 255)`,
  );
// And it is a picture: lit things over a ground, not one flat colour.
const spread = Math.max(...cold.grid) - Math.min(...cold.grid);
assert.ok(spread > 60, `the scene is drawn (cells range over ${spread} of 255)`);
assert.deepEqual(
  { compiled: warm.again.compiled, cached: warm.again.cached },
  { compiled: 0, cached: w.total },
  'asked again, everything is there already',
);
assert.match(warm.otherBackend.refused, /recorded on/);
assert.equal(warm.otherBackend.compiled, 0);
assert.match(warm.notAList.refused, /not a variant list/);
assert.equal(warm.unknownShader.missing.length, 1, 'a shader that is not registered is reported');
assert.equal(warm.unknownShader.compiled, 0);
assert.equal(warm.aborted, 'AbortError', 'a cancelled signal rejects');

const line = (page) =>
  `first frame ${page.first.ms} ms (${page.first.compiled} compiled), steady ${page.steadyMs} ms, levels ` +
  page.levels.map((l) => `${l.level}: ${l.ms} ms (${l.compiled})`).join(', ');
console.log(
  `PASS shader warm-up on ${cold.renderer} (${cold.backend.adapter ? JSON.stringify(cold.backend.adapter) : cold.gpu}): ` +
    `${list.variants.length} variants listed\n` +
    `  cold: ${line(cold)}\n` +
    `  warm: ${line(warm)}\n` +
    `  picture, warm against cold: ${JSON.stringify(report.pictureDiff)}\n` +
    `  warm-up: ${w.compiled} compiled in ${w.ms} ms over ${w.slices} slices (${w.wallMs} ms of wall time, ${w.framesMeanwhile} frames meanwhile), longest single compile ${w.longestMs} ms\n` +
    `Report: ${path.join(out, 'evidence/report.json')}`,
);
