#!/usr/bin/env node
// Real-GPU check of a field of grass (`ZhudaGrassField`) through the browser SDK:
// - blades cover bare earth near the eye and, thinned and widened, far from it,
//   and stop where the field ends;
// - nothing grows where the game says so;
// - the wind moves the blades, the same time draws the same picture;
// - a shadow lies on the grass;
// - walking makes patches a few a frame and drops them behind;
// - disposing gives everything back.
// Pictures for a person to look at are written beside the report.
// Desktop GPU evidence only (WebGL, or WebGPU with GRASS_RENDERER);
// not mobile, frame times or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.env.GRASS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-grass'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// GRASS_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.GRASS_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/grass-field.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'live.html'),
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:960px;height:540px}</style>' +
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
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 960,
    height: 540,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  await browser.waitFor(
    'window.__GRASS__ && (window.__GRASS__.ready || window.__GRASS__.error)',
    180000,
  );
  report = { gpu, ...(await browser.evaluate('window.__GRASS__')), consoleErrors: browser.errors };
  if (report.ready) {
    report.pictures = {};
    for (const [name, call] of [
      ['walk', `'walk'`],
      ['far', `'far'`],
      ['low', `'low'`],
      ['down', `'down'`],
      ['road', `'road'`],
      ['walk-gust', `'walk', 1.6`],
    ]) {
      report.pictures[name] = await browser.evaluate(`window.__GRASS__.show(${call})`);
      await browser.screenshot(path.join(out, 'evidence', `grass-${name}.png`));
    }
    report.rendererErrorsAfter = await browser.evaluate(
      'JSON.stringify(window.__GRASS__.rendererErrors)',
    );
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');
assert.deepEqual(report.rendererErrors, [], 'renderer errors');
const g = report.grass;
assert.ok(g.bare < 0.01, `bare earth is not green (${g.bare})`);
assert.ok(g.near > 0.8, `near the eye the grass covers the earth (${g.near})`);
assert.ok(g.sameTime < 0.05, `the same time draws the same picture (${g.sameTime})`);
assert.ok(g.wind > 1, `the wind moves the blades (${g.wind})`);
assert.ok(g.noWind < 0.05, `no wind, no movement (${g.noWind})`);
// The shadow is a small part of this frame.
assert.ok(g.shadowedGrass > 0.004, `the box's shadow lies on the grass (${g.shadowedGrass})`);
assert.ok(g.farCover > 0.8, `thinned far blades still cover the earth (${g.farCover})`);
assert.ok(g.beyond < 0.05, `past the end there is none (${g.beyond})`);
assert.ok(g.road < 0.08, `nothing grows on the road (${g.road})`);
assert.ok(g.besideRoad > 0.8, `and grass stands beside it (${g.besideRoad})`);
// Far blades are thinned in the mesh too: a patch 40 m off holds an eighth of its blades.
assert.ok(
  g.stats.blades < g.stats.patches * 36 * 400 * 0.3,
  `far patches hold few blades (${JSON.stringify(g.stats)})`,
);
assert.equal(g.stats.pending, 0);
const w = g.walk;
assert.ok(w.mostPending <= 12, `walking never falls far behind (${w.mostPending} patches waiting)`);
assert.ok(
  w.mostPatches <= w.start.patches * 1.4,
  `patches behind are dropped (${w.mostPatches} against ${w.start.patches})`,
);
assert.ok(w.mostMissing < 0.05, `on the way few blades are missing (${w.mostMissing})`);
assert.ok(
  Math.abs(w.end.blades - w.fresh.blades) <= w.fresh.blades * 0.12,
  `arrived, about what a field made there has (${w.end.blades} against ${w.fresh.blades})`,
);
assert.match(g.invalid, /grass\.density/, 'a density out of range is refused');
assert.match(g.afterUse, /Disposed grass/);
assert.ok(g.afterDispose < 0.01, `disposed, the earth is bare again (${g.afterDispose})`);
assert.ok(
  g.resourcesAfter === g.resourcesBefore,
  `nothing is left behind (${g.resourcesBefore} -> ${g.resourcesAfter})`,
);
console.log(
  `PASS grass on ${report.renderer} (${report.gpu}): ` +
    JSON.stringify({ grass: g, pictures: report.pictures }),
);
