#!/usr/bin/env node
// Real-GPU check of the quality governor's ladder with detail rungs, its GPU
// band, and the quality memory with its load sentinel, through the browser
// SDK (tests/fixtures/quality-governor.ts):
// - frames forced slow (the CPU held to 40 ms against a 16.7 ms budget) walk
//   the ladder down one rung a window in its order: pixels to the middle size,
//   then the scene's distances (`detail`), then the rest of the pixels, then
//   the look levels; each rung reaches the look (its level, its scale) and
//   the scene's own far row; fast frames walk it back to the authored look;
// - where the browser gives GPU times (WebGPU timestamps, WebGL's disjoint
//   timer query), a governor fed them decides on them: a budget half the top
//   rung's GPU time steps it down, and frames held slow by the CPU do not
//   move one whose GPU time is inside its band; without GPU times the report
//   says so and the CPU rule decides;
// - the load sentinel is set while the scene is built and cleared by the
//   first frame; the kept level follows the governor and starts the next visit.
// Desktop GPU evidence only (WebGL, or WebGPU with GOVERNOR_RENDERER=webgpu);
// no phone.
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
  process.env.GOVERNOR_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-quality-governor'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// GOVERNOR_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.GOVERNOR_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 270;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/quality-governor.ts')],
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

const png = (file, url) =>
  fs.writeFileSync(path.join(out, 'evidence', file), Buffer.from(url.split(',')[1], 'base64'));
let report;
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
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  for (let i = 0; i < 1800; i++) {
    if (await browser.evaluate('window.__GOV__ && (window.__GOV__.ready || window.__GOV__.error)'))
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__GOV__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) => /unCaptured|INVALID|GL_|WebGPU/i.test(m)),
  };
  if (report.ready) {
    report.pictures = [];
    const names = ['top', 'back', ...report.r.down.rungs.map((rung) => `level-${rung.level}`)];
    for (const name of names) {
      png(`${name}.png`, await browser.evaluate(`window.__GOV__.picture('${name}')`));
      report.pictures.push(`${name}.png`);
    }
  }
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
const ladder = r.ladder;
const top = ladder.length - 1;

// The load sentinel: set during the build, cleared by the first frame.
assert.deepEqual(
  [r.memory.start, r.memory.sentinelDuringLoad, r.memory.sentinelAfterFirstFrame],
  [top, true, false],
  'the first visit starts at the top; the sentinel is set while loading and cleared by the first frame',
);

// 1. Frames forced slow walk the ladder down one rung at a time, in its order:
// pixels to 0.85, then the distances to 0.7 and 0.4, then the rest of the
// pixels, then the look levels, then 0.5.
assert.equal(r.down.reached, true, 'forced slow frames reach the lowest rung');
assert.deepEqual(r.down.bases, ['cpu'], 'without GPU times the CPU rule decides');
assert.deepEqual(
  r.down.rungs.map((rung) => rung.step),
  ladder.slice(0, top).reverse(),
  'one rung a window, in the order of the ladder',
);
for (const rung of r.down.rungs) {
  const [look, rest] = rung.step.split('@');
  const [scale] = rest.split('/');
  assert.equal(rung.lookQuality, Number(look), `${rung.step}: the look is at its level`);
  assert.equal(rung.pixelRatio, Number(scale), `${rung.step}: the picture is drawn at its scale`);
}
// The scene's far row goes with detail: 30 pillars at the top, fewer at 0.7 and 0.4.
const shown = Object.fromEntries(r.down.rungs.map((rung) => [rung.step, rung]));
assert.equal(r.top.pillarsShown, 30);
assert.ok(
  shown['3@0.85/0.7'].pillarsShown < 30 &&
    shown['3@0.85/0.4'].pillarsShown < shown['3@0.85/0.7'].pillarsShown,
  'detail cuts the far row',
);
assert.ok(
  shown['3@0.85/0.4'].farRedPixels < shown['3@0.85/1'].farRedPixels * 0.5,
  `the far pillars are not drawn at detail 0.4 (${shown['3@0.85/0.4'].farRedPixels} red pixels in the middle columns against ${shown['3@0.85/1'].farRedPixels})`,
);
// Fast frames walk it back up, rung by rung, to the authored look and every pillar.
assert.equal(r.up.reached, true, 'fast frames climb back to the top');
assert.deepEqual(
  r.up.rungs.map((rung) => rung.step),
  ladder.slice(1),
  'back up one rung at a time',
);
assert.equal(r.up.rungs.at(-1).pillarsShown, 30);
assert.ok(
  Math.abs(r.backRed - r.top.redPixels) <= r.top.redPixels * 0.01 &&
    Math.abs(r.backFarRed - r.top.farRedPixels) <= Math.max(3, r.top.farRedPixels * 0.05),
  `back at the top the far row is drawn as before (${r.backRed}, far ${r.backFarRed} against ${r.top.redPixels}, far ${r.top.farRedPixels})`,
);
// Memory: the kept level followed the governor.
assert.equal(r.memory.keptAtBottom.level, 0);
assert.equal(r.memory.reopened, r.memory.keptAtEnd.level, 'a new visit starts where this one was');

// 2. GPU times, where this browser gives them.
if (r.gpuTiming) {
  assert.ok(r.gpu.timed >= 20, `GPU times arrive (${r.gpu.timed} of 40 frames)`);
  assert.ok(r.gpu.topMs > 0, 'a GPU time, not zero');
  assert.deepEqual(r.gpu.down.bases, ['gpu'], 'with GPU times the band decides');
  assert.ok(r.gpu.down.rungs.length >= 1, 'a budget half the top rung steps down');
  r.gpu.down.rungs.forEach((rung, i) =>
    assert.equal(rung.level, top - 1 - i, 'one rung at a time'),
  );
  assert.deepEqual(r.gpu.cpuHeld.bases, ['gpu']);
  assert.deepEqual(
    r.gpu.cpuHeld.changes,
    [],
    'frames held slow by the CPU do not move a governor whose GPU time is inside its band',
  );
  assert.deepEqual(
    r.gpu.cpuHeld.cpuRuleChanges,
    [top - 1, top - 2, top - 3, top - 4],
    'the same frames step the CPU rule down a rung a window',
  );
} else assert.match(r.gpuSource, /timer|timestamp/, 'GPU time is labelled unavailable, never 0');

console.log(
  `PASS quality governor on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu}): ` +
    JSON.stringify({
      down: r.down.rungs.map(
        (rung) => `${rung.step} pillars ${rung.pillarsShown} far red ${rung.farRedPixels}`,
      ),
      gpuTiming: r.gpuTiming,
      gpu: r.gpu && {
        timed: r.gpu.timed,
        topMs: r.gpu.topMs,
        tightBudgetMs: r.gpu.tightBudgetMs,
        down: r.gpu.down?.rungs.map((rung) => rung.step),
        cpuHeld: r.gpu.cpuHeld,
      },
      memory: r.memory,
    }) +
    `\nPictures: ${path.join(out, 'evidence')}`,
);
