#!/usr/bin/env node
// Real-GPU check of zhuda-laya-engine/csg: a wall with a door cut through it
// and a box with a sphere cut from its corner, made on the CPU and drawn with
// ZhudaDynamicMesh through the browser SDK (tests/fixtures/csg.ts): the
// background shows through the door, the wall round it is drawn, the cut box
// is drawn, both are closed, and nothing raises a GPU error. Desktop GPU
// evidence only (WebGL, or WebGPU with CSG_RENDERER=webgpu).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.env.CSG_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-csg'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// CSG_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.CSG_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 270;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/csg.ts')],
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
  for (let i = 0; i < 1200; i++) {
    if (await browser.evaluate('window.__CSG__ && (window.__CSG__.ready || window.__CSG__.error)'))
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__CSG__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) => /unCaptured|INVALID|GL_|WebGPU/i.test(m)),
  };
  if (report.ready)
    for (const name of ['wall', 'box'])
      png(`${name}.png`, await browser.evaluate(`window.__CSG__.picture('${name}')`));
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
const r = report.r;
const magenta = (c) => c[0] > 200 && c[1] < 60 && c[2] > 200;
assert.equal(r.wall.report.openEdges, 0);
assert.ok(magenta(r.wall.door), `through the door the background shows (${r.wall.door})`);
assert.ok(
  !magenta(r.wall.solid) && !magenta(r.wall.above),
  `the wall beside and above the door is drawn (${r.wall.solid}, ${r.wall.above})`,
);
assert.equal(r.box.report.openEdges, 0);
assert.ok(r.box.covered > W * H * 0.1, `the cut box is drawn (${r.box.covered} pixels)`);
console.log(
  `PASS csg on ${report.renderer}: ` +
    JSON.stringify({ wall: r.wall, box: { report: r.box.report, covered: r.box.covered } }) +
    `\nPictures: ${path.join(out, 'evidence')}`,
);
