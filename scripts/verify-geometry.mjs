#!/usr/bin/env node
// Real-GPU check of the new geometry through the browser SDK: a wall piece
// with two windows and a rounded bevel (`createZhudaExtrudeMesh` with holes
// and bevel), a torus, a tube along a closed Catmull-Rom curve, a washer and
// a flat ring, lit by one sun with physically based materials:
// - each shape is drawn where its triangle BVH (`ZhudaTriangleBvh` through
//   `ZhudaSceneQueries`) says it is, pixel for pixel away from edges, from
//   three views;
// - the windows, the torus's hole and the washer's hole show what is behind;
// - the bevel is shaded apart from the flat face; the torus is shaded round;
// - a LayaAir mesh read back picks the same triangles as its source data.
// Pictures for a person to look at are written beside the report.
// Desktop GPU evidence only (WebGL, or WebGPU with GEOMETRY_RENDERER);
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
const out = path.resolve(
  process.env.GEOMETRY_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-geometry'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// GEOMETRY_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.GEOMETRY_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-webgpu' : '3d';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/geometry-shapes.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'shapes.html'),
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
    url: `http://127.0.0.1:${server.address().port}/shapes.html`,
  });
  await browser.waitFor(
    'window.__GEOMETRY__ && (window.__GEOMETRY__.ready || window.__GEOMETRY__.error)',
  );
  report = {
    gpu,
    ...(await browser.evaluate('window.__GEOMETRY__')),
    consoleErrors: browser.errors,
  };
  if (report.ready)
    for (const name of ['front', 'panel', 'above']) {
      await browser.evaluate(`window.__GEOMETRY__.show('${name}')`);
      await browser.screenshot(path.join(out, 'evidence', `geometry-${name}.png`));
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
assert.equal(report.backend.selected, gpuBuild ? 'webgpu' : 'webgl', 'the backend asked for');
assert.equal(report.backend.status, 'ready');
const g = report.geometry;
for (const [view, result] of Object.entries(g.views)) {
  assert.ok(result.counted > 20000, `${view}: enough pixels away from edges (${result.counted})`);
  for (const [name, t] of Object.entries(result.shapes)) {
    if (name === 'grey' || t.picked < 40) continue;
    assert.ok(
      t.foundShare > 0.97,
      `${view}: where the BVH finds the ${name}, it is drawn (${t.foundShare})`,
    );
    assert.ok(
      t.rightShare > 0.97,
      `${view}: where the ${name} is drawn, the BVH finds it (${t.rightShare})`,
    );
  }
}
const seen = (name) => Object.values(g.views).some((v) => v.shapes[name].picked >= 200);
for (const name of ['panel', 'torus', 'tube', 'washer', 'ring'])
  assert.ok(seen(name), `the ${name} is in view`);
const h = g.holes;
const owner = {
  squareWindow: 'panel',
  roundWindow: 'panel',
  torusHole: 'torus',
  washerHole: 'washer',
  ringHole: 'ring',
};
for (const [hole, shape] of Object.entries(owner)) {
  assert.equal(
    h[hole].colour,
    'grey',
    `${hole}: what is behind shows through (${JSON.stringify(h[hole])})`,
  );
  assert.notEqual(h[hole].pick, shape, `${hole}: and the BVH goes through it too`);
}
assert.equal(h.panelSolid.colour, 'panel', 'the wall between the windows is drawn');
assert.equal(h.torusTube.colour, 'torus', 'the tube of the torus is drawn');
assert.equal(h.washerTop.colour, 'washer', 'the top of the washer is drawn');
assert.equal(h.ringBand.colour, 'ring', 'the band of the flat ring is drawn');
const b = g.views.panel.bevel;
assert.ok(
  b.bevelPixels > 200 && b.flatPixels > 2000,
  `bevel and face in view (${JSON.stringify(b)})`,
);
assert.ok(
  Math.abs(b.flat - b.rounded) > 8,
  `the bevel is shaded apart from the face (${JSON.stringify(b)})`,
);
assert.ok(
  g.torusShading.p95 - g.torusShading.p5 > 40,
  `the torus is shaded round (${JSON.stringify(g.torusShading)})`,
);
assert.ok(!g.layaReadBack.error, `LayaAir read-back: ${g.layaReadBack.error}`);
assert.ok(
  g.layaReadBack.hits > 200 && g.layaReadBack.same === g.layaReadBack.hits,
  `read back picks the same (${JSON.stringify(g.layaReadBack)})`,
);
console.log(
  `PASS geometry on ${report.renderer} (${report.backend.nativeEngine}, ${report.gpu}): ` +
    JSON.stringify({
      views: Object.fromEntries(
        Object.entries(g.views).map(([v, r]) => [
          v,
          Object.fromEntries(
            Object.entries(r.shapes)
              .filter(([, t]) => t.picked)
              .map(([n, t]) => [n, [t.foundShare, t.rightShare]]),
          ),
        ]),
      ),
      bevel: b,
      torus: g.torusShading,
      read: g.layaReadBack,
      evidence: path.join(out, 'evidence'),
    }),
);
