#!/usr/bin/env node
// Real-GPU draw of a hand made from numbers (createZhudaHandMesh) with the
// lit surface's skin, through the browser SDK: from the back, the palm, the
// side and against the light, relaxed and flat. The pictures are the
// evidence; the check asserts the draw ran clean and the hand fills the view.
// Desktop GPU evidence only (WebGPU by default, WebGL with HAND_RENDERER=webgl).
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
const out = path.resolve(process.env.HAND_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-hand'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// Realism is drawn on WebGPU first; HAND_RENDERER=webgl runs the same draw on the WebGL build.
const gpuBuild =
  (process.env.HAND_RENDERER || process.env.ZHUDA_FILM_RENDERER || 'webgpu') === 'webgpu';
// The post-process module is in the glTF profiles: the depth views of the fixture use it.
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 640,
  H = 800;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/hand.ts')],
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
  for (let i = 0; i < 3000; i++) {
    if (
      await browser.evaluate('window.__HAND__ && (window.__HAND__.ready || window.__HAND__.error)')
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Named by the backend the page ran on.
  const gpu = await browser.evaluate(gpuLabelExpression(gpuBuild));
  report = {
    gpu,
    ...(await browser.evaluate('window.__HAND__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__HAND__.pictures()').catch(() => [])) ?? []) {
    const url = await browser.evaluate(`window.__HAND__.picture('${name}')`).catch(() => null);
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
if (process.env.HAND_EXPLORE) {
  console.log(JSON.stringify({ ...report, pictures: report.pictures }, null, 1));
  process.exit(0);
}
assert.equal(report.error, undefined, report.error);
assert.equal(report.ready, true, 'the fixture finished');
assert.deepEqual(report.errors, [], 'no page errors');
assert.deepEqual(report.consoleErrors, [], 'no console errors');
assert.deepEqual(report.gpuWarnings, [], 'no shader or GPU warnings');
assert.deepEqual(report.rendererErrors, [], 'no renderer errors');
assert.equal(report.renderer, gpuBuild ? 'webgpu' : 'webgl');
for (const [name, view] of Object.entries(report.views)) {
  // The hand fills a good part of the picture and is not the whole of it.
  const share = view.covered / (W * H);
  // A close view of the nails is mostly hand; the rest show it whole against the ground.
  const most = name.endsWith('close') ? 0.95 : 0.6;
  assert.ok(
    share > 0.08 && share < most,
    `${name}: the hand covers ${share.toFixed(3)} of the picture`,
  );
}
console.log(
  JSON.stringify(
    {
      gpu: report.gpu,
      renderer: report.renderer,
      views: report.views,
      pictures: report.pictures,
      evidence: path.join(out, 'evidence'),
    },
    null,
    1,
  ),
);
