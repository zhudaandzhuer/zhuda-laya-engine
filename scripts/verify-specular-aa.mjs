#!/usr/bin/env node
// Real-GPU check of specular anti-aliasing (installLaya342SpecularAA,
// ZHUDA_SPECULAR_AA) through the browser SDK:
// - it is on by default, for the PBR, glTF and ZhudaLitSurface shaders;
// - a ball with a dense normal map seen from a few metres, under a camera
//   moved by less than a pixel from frame to frame, flickers less, pops less
//   and sparkles less with it on, and gives off as much light;
// - a smooth ball, and the bumps seen close up, look as they did;
// - an alpha-tested surface compiles (a discard comes before the derivatives);
// - a scene can turn it off and on.
// Flicker is measured with a sun under which nothing clips, in linear light;
// the same with a game's sun, where sparkles clip to white, is recorded.
// Pictures for a person to look at are written beside the report.
// Desktop GPU evidence only (WebGL, or WebGPU with SPECULAR_AA_RENDERER);
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
  process.env.SPECULAR_AA_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-specular-aa'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// SPECULAR_AA_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.SPECULAR_AA_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/specular-aa.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'live.html'),
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:480px;height:320px}</style>' +
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
    height: 320,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  // Many shader variants are compiled on the way (WebGPU's are slow): wait longer
  // than the fixture's default of fifteen seconds.
  const deadline = Date.now() + 240000;
  while (
    !(await browser.evaluate(
      '!!(window.__SPECULAR_AA__ && (window.__SPECULAR_AA__.ready || window.__SPECULAR_AA__.error))',
      { timeoutMs: 120000 },
    ))
  ) {
    if (Date.now() > deadline) throw Error('the fixture did not finish');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__SPECULAR_AA__')),
    consoleErrors: browser.errors,
    consoleMessages: browser.consoleMessages,
    glErrors: browser.glErrors,
  };
} finally {
  await browser.close();
  server.close();
}
const pictures = report.pictures || {};
delete report.pictures;
report.pictureFiles = {};
for (const [name, url] of Object.entries(pictures)) {
  const file = path.join(out, 'evidence', `specular-aa-${report.renderer}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(String(url).split(',')[1], 'base64'));
  report.pictureFiles[name] = file;
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
// The backend asked for drew, on a real adapter: a WebGL draw would be a false WebGPU pass.
assert.equal(report.backend.selected, gpuBuild ? 'webgpu' : 'webgl', 'the backend drew');
assert.equal(report.backend.status, 'ready');
if (gpuBuild) assert.equal(report.backend.adapter?.isFallbackAdapter, false, 'a hardware adapter');
const drewWith = gpuBuild
  ? `WebGPU ${report.backend.adapter.vendor} ${report.backend.adapter.architecture} (ready)`
  : report.gpu;
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');
assert.deepEqual(report.rendererErrors, [], 'renderer errors');
assert.deepEqual(report.glErrors, [], 'WebGL errors');
assert.deepEqual(
  report.consoleMessages.filter((m) => /specular|shader|compile|error/i.test(m)),
  [],
  'no shader or patch warning',
);
assert.equal(report.status.patched, true, 'PBRFrag.glsl is patched');
assert.equal(report.status.defaultOn, true, `on by default (${report.status.reason})`);
assert.equal(report.status.reason, undefined);
// Laya's PBR and glTF shaders at boot, the fixture's lit material later.
assert.ok(
  report.statusEnd.normalMapPasses >= 3,
  `the PBR, glTF and lit forward passes read the map's filtering (${report.statusEnd.normalMapPasses})`,
);
assert.equal(report.newSceneHasDefine, true, 'a new scene has the define');
const r = report.result;
for (const shader of ['pbr', 'gltf', 'lit'])
  for (const finish of ['metal', 'painted'])
    for (const filter of ['mipmapped', 'unfiltered']) {
      const key = `${shader}-${finish}-${filter}`;
      const { off, on, changed } = r[key];
      assert.equal(off.applied, false, `${key}: off is off`);
      assert.equal(on.applied, true, `${key}: on is on`);
      assert.ok(changed > 0.3, `${key}: the patch changes the picture (${changed})`);
      assert.equal(off.clipped + on.clipped, 0, `${key}: measured without clipping`);
      // The asked-for measure, in light rather than in shown values: the mean
      // change from one jittered frame to the next.
      assert.ok(
        on.flicker < off.flicker * (filter === 'mipmapped' ? 0.8 : 0.97),
        `${key}: less flicker under sub-pixel jitter (${off.flicker} -> ${on.flicker})`,
      );
      // Pixels that jump by more than 48 of 255, and near-white sparkles.
      assert.ok(on.pops <= off.pops * 0.25, `${key}: fewer pops (${off.pops} -> ${on.pops})`);
      assert.ok(
        on.sparkles <= off.sparkles * 0.1,
        `${key}: fewer sparkles (${off.sparkles} -> ${on.sparkles})`,
      );
      // Spreading the highlight moves light about; it does not make or lose it.
      assert.ok(
        Math.abs(on.mean - off.mean) <= off.mean * 0.05,
        `${key}: as much light (${off.mean} -> ${on.mean})`,
      );
    }
for (const finish of ['metal', 'painted']) {
  const s = r[`smooth-${finish}`];
  assert.ok(
    s.diff < 0.5 && s.game.diff < 0.5,
    `the smooth ${finish} ball looks the same (mean change ${s.diff}, game light ${s.game.diff})`,
  );
  assert.ok(
    Math.abs(s.game.on.peak - s.game.off.peak) <= 3 &&
      Math.abs(s.game.on.size - s.game.off.size) <= s.game.off.size * 0.1,
    `its highlight is as bright and as large (${JSON.stringify(s.game)})`,
  );
  const c = r[`close-${finish}`];
  assert.ok(
    c.diff < 4 && c.changedPixels < c.measured * 0.15,
    `close up, the ${finish} bumps keep their highlights (${JSON.stringify(c)})`,
  );
}
assert.ok(r.cutout.mean > 5, `an alpha-tested ball is drawn (${r.cutout.mean})`);
assert.deepEqual(r.toggle, { off: false, offHasDefine: false, on: true, onHasDefine: true });
assert.match(r.invalid, /Scene3D/, 'something that is not a scene is refused');
console.log(
  `PASS specular anti-aliasing on ${report.renderer} (${drewWith}): ` + JSON.stringify(r),
);
