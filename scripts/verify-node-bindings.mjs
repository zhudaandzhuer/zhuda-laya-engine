#!/usr/bin/env node
// Real-GPU check of issue #8 (docs/plans/records/webgpu-node-bindings), WP23
// (a program that does not compile) and WP22 (a sun beside a brighter rim
// light keeps its shadow; both docs/plans/records/engine-defects),
// through the browser SDK: two glTFPBR spheres with one material; the
// second loses its reflection probe (reflectionMode off, probe taken away),
// so it shares the variant the first compiled with the probe block. Without
// the fix LayaAir's WebGPU pipeline is invalid ("Binding doesn't exist …
// @group(2) @binding(1)") and so is every frame after it. With it: no
// renderer error, the sphere was given the scene's probe, and it looks as it
// did (on WebGL too, where nothing failed but the block was another's).
// Desktop GPU evidence (WebGL, or WebGPU with NODE_BINDINGS_RENDERER); a
// phone's Chrome with ZHUDA_PHONE_CHROME.
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
const out = path.resolve(
  process.env.NODE_BINDINGS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-node-bindings'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// NODE_BINDINGS_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the WebGPU build.
const gpuBuild =
  (process.env.NODE_BINDINGS_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/node-bindings.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'live.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:480px;height:270px}</style>` +
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
    width: 480,
    height: 270,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  for (let i = 0; i < 1200; i++) {
    if (
      await browser.evaluate(
        'window.__NODE_BINDINGS__ && (window.__NODE_BINDINGS__.ready || window.__NODE_BINDINGS__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu: await browser.evaluate(gpuLabelExpression(gpuBuild)),
    ...(await browser.evaluate('window.__NODE_BINDINGS__')),
    consoleErrors: browser.errors,
  };
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.error, undefined, report.error);
assert.equal(report.ready, true, 'the fixture finished');
assert.deepEqual(report.errors, [], 'no page errors');
assert.equal(report.renderer, gpuBuild ? 'webgpu' : 'webgl');
const { probe, broken, shadowLight } = report;
assert.deepEqual(probe.errors, [], 'no renderer error with the probe taken away');
assert.ok(probe.fills >= 1, `the sphere was given the scene's probe (${probe.fills})`);
assert.ok(probe.blocks?.includes('ReflectionProbe'), JSON.stringify(probe.blocks));
assert.ok(probe.withProbe > 10, `the sphere is drawn and lit (${probe.withProbe})`);
assert.ok(
  Math.abs(probe.withoutProbe - probe.withProbe) <= 1,
  `it looks as it did with its probe (${probe.withProbe} -> ${probe.withoutProbe})`,
);
// WP23: a program that does not compile leaves its objects undrawn, nothing else.
assert.ok(broken.ticks > 20, `the engine keeps drawing (${broken.ticks} frames in a second)`);
assert.ok(broken.good > 10, `the other sphere is drawn and lit (${broken.good})`);
assert.ok(
  broken.errors.some((e) => /zhudaNoSuchThing/.test(e)),
  `the compiler's message is kept: ${JSON.stringify(broken.errors)}`,
);
if (gpuBuild)
  assert.ok(
    broken.errors.some((e) => /^ZhudaCheckBrokenHook: a program that did not compile/.test(e)),
    JSON.stringify(broken.errors),
  );
// WP22: the sun keeps its shadow beside a brighter rim light that casts none.
assert.ok(shadowLight.alone.main, 'the sun alone is the main light');
assert.ok(
  shadowLight.alone.shadow > 0.5,
  `the sun's shadow is drawn (${shadowLight.alone.shadow})`,
);
assert.ok(shadowLight.withRim.main, 'beside a brighter rim light the sun is still the main light');
assert.ok(
  shadowLight.withRim.shadow > shadowLight.alone.shadow * 0.5,
  `and its shadow is drawn (${shadowLight.alone.shadow} -> ${shadowLight.withRim.shadow})`,
);
assert.deepEqual(shadowLight.errors, [], 'no renderer error in the shadow case');
console.log(
  `PASS node bindings on ${report.renderer} (${report.gpu}): a sphere without its probe ` +
    `${probe.withProbe} -> ${probe.withoutProbe}, given the scene's ${probe.fills} time(s), 0 errors; ` +
    `a program that does not compile: ${broken.ticks} frames a second go on, the other sphere ${broken.good}; ` +
    `the sun's shadow alone ${shadowLight.alone.shadow}, beside a brighter rim ${shadowLight.withRim.shadow}`,
);
