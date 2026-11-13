#!/usr/bin/env node
// Real-GPU check of the three camera effects of a game's look
// (`ZhudaSceneLook`), through the browser SDK:
// - depth of field blurs what is off the focus distance and pulls focus in place;
// - motion blur smears the frame in which the camera turns and no other;
// - automatic exposure lifts a dim scene, dims a bright one, and takes time.
// Desktop GPU evidence only (WebGL, or WebGPU with CAMERA_EFFECTS_RENDERER);
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
  process.env.CAMERA_EFFECTS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-camera-effects'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// CAMERA_EFFECTS_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild =
  (process.env.CAMERA_EFFECTS_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/camera-effects.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'live.html'),
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:480px;height:300px}</style>' +
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
    width: 480,
    height: 300,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  await browser.waitFor(
    'window.__CAMERA__ && (window.__CAMERA__.ready || window.__CAMERA__.error)',
    120000,
  );
  report = { gpu, ...(await browser.evaluate('window.__CAMERA__')), consoleErrors: browser.errors };
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');
assert.deepEqual(report.rendererErrors, [], 'renderer errors');
const c = report.camera;
assert.ok(
  c.sharp.near > 8 && c.sharp.far > 8,
  `the stripes are drawn sharp (${JSON.stringify(c.sharp)})`,
);

assert.equal(c.dofMode, 'rebuilt');
assert.ok(
  c.focusNear.near > c.sharp.near * 0.8,
  `focused near, the near stripes stay sharp (${c.focusNear.near} of ${c.sharp.near})`,
);
assert.ok(
  c.focusNear.far < c.sharp.far * 0.5,
  `focused near, the far stripes blur (${c.focusNear.far} of ${c.sharp.far})`,
);
assert.equal(c.pullMode, 'updated', 'focus is pulled in place');
assert.ok(
  c.focusFar.far > c.sharp.far * 0.8,
  `focused far, the far stripes are sharp (${c.focusFar.far} of ${c.sharp.far})`,
);
assert.ok(
  c.focusFar.near < c.sharp.near * 0.5,
  `focused far, the near stripes blur (${c.focusFar.near} of ${c.sharp.near})`,
);
assert.ok(c.dofOffDiff < 1, `without depth of field the first frame again (${c.dofOffDiff})`);

assert.equal(c.motionMode, 'rebuilt');
assert.ok(c.stillDiff < 1, `a camera that stands still is not blurred (${c.stillDiff})`);
assert.ok(
  c.turning.near < c.settled.near * 0.6 && c.turning.far < c.settled.far * 0.6,
  `the frame in which the camera turns is smeared (${JSON.stringify(c.turning)} against ${JSON.stringify(c.settled)})`,
);
assert.ok(c.backDiff < 1, `turned back and standing, the first frame again (${c.backDiff})`);

assert.ok(c.dim < c.sharp.mean * 0.5, `the dim scene is dim (${c.dim} against ${c.sharp.mean})`);
assert.ok(c.bright > c.sharp.mean, `the bright scene is brighter (${c.bright})`);
assert.equal(c.exposureMode, 'rebuilt');
assert.ok(
  c.dimLifted > c.dim * 1.8,
  `automatic exposure lifts the dim scene (${c.dim} -> ${c.dimLifted})`,
);
assert.ok(
  c.brightDimmed < c.bright * 0.8,
  `and with a lower key dims the bright one (${c.bright} -> ${c.brightDimmed})`,
);
const [first, , , last] = c.adapting;
assert.ok(
  c.adapting.every((v, i) => i === 0 || v >= c.adapting[i - 1] - 0.5),
  `coming into the dark the picture brightens steadily (${c.adapting})`,
);
assert.ok(last > first * 1.5, `and takes time over it (${c.adapting})`);
assert.ok(
  Math.abs(last - c.dimLifted) < c.dimLifted * 0.15,
  `ending where the immediate exposure stands (${last} against ${c.dimLifted})`,
);
assert.ok(
  c.resourcesAfter - c.resourcesBefore <= 0,
  `ten times on and off leave no resource behind (${c.resourcesBefore} -> ${c.resourcesAfter})`,
);
assert.match(c.invalid, /focusDistanceM/, 'a lens without a focus distance is refused');
console.log(`PASS camera effects on ${report.renderer} (${report.gpu}): ` + JSON.stringify(c));
