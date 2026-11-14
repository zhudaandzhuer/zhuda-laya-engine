#!/usr/bin/env node
// Real-GPU check of an HDR panorama as a scene's light and sky
// (`ZhudaHdrEnvironment`), through the browser SDK. The panorama is made
// here (tests/helpers/hdr-fixture.mjs): a sky, a ground, a sun and a
// coloured patch toward each axis.
// - The sky shows each patch where it stands, in its own colour: the
//   panorama is the right way round and as bright as its numbers say.
// - A mirror ball shows, in its middle, the patch that stands behind the
//   eye: the light and the sky are the same surroundings.
// - Turned a quarter to the right, sky and mirror turn together.
// - A matte ball is lighter above than below.
// - Stored as 32-bit floats, 16-bit floats or 8 bits with a divisor, the
//   picture is the same; a format the device does not filter is refused.
// - Exposure and the ambient intensity scale the light; a soft sky spreads
//   a patch out; the studio room lights without a sky.
// - Disposal gives the scene back what it had.
// Desktop GPU evidence only (WebGL, or WebGPU with HDR_ENV_RENDERER).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import {
  PANORAMA_MARKS,
  encodeRadianceHdr,
  makeMarkedPanorama,
} from '../tests/helpers/hdr-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.HDR_ENV_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-hdr-environment'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// HDR_ENV_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.HDR_ENV_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/hdr-environment.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
const fixtures = path.join(web, 'fixtures');
fs.mkdirSync(fixtures);
fs.writeFileSync(path.join(fixtures, 'marked.hdr'), encodeRadianceHdr(makeMarkedPanorama(1024)));
fs.writeFileSync(
  path.join(fixtures, 'plain.hdr'),
  encodeRadianceHdr(makeMarkedPanorama(256, { marks: false, sun: false })),
);
const directions = Object.fromEntries(
  Object.entries(PANORAMA_MARKS).map(([name, mark]) => [name, mark.toward]),
);
fs.writeFileSync(path.join(fixtures, 'manifest.json'), JSON.stringify({ directions }));
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
    if (await browser.evaluate('window.__HDR__ && (window.__HDR__.ready || window.__HDR__.error)'))
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__HDR__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) => /unCaptured|INVALID|GL_|WebGPU/i.test(m)),
  };
  if (report.ready) {
    report.pictures = [];
    for (const name of [
      'float',
      ...report.formats.filter((f) => f !== 'float'),
      'sky',
      'sky-soft',
      'studio',
    ]) {
      const url = await browser.evaluate(`window.__HDR__.picture('${name}')`).catch(() => null);
      if (!url) continue;
      fs.writeFileSync(
        path.join(out, 'evidence', `${name}.png`),
        Buffer.from(url.split(',')[1], 'base64'),
      );
      report.pictures.push(`${name}.png`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');
if (process.env.HDR_ENV_EXPLORE) {
  console.log(
    JSON.stringify(
      {
        ready: report.ready,
        error: report.error,
        errors: report.errors,
        unturned: report.unturned,
        turned: report.turned,
        format: report.format,
        formats: report.formats,
      },
      null,
      1,
    ),
  );
  process.exit(0);
}

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

// A linear colour as the screen shows it: without a grade the engine's output is a power of 1/2.2.
const shown = (colour) => colour.map((v) => Math.round(255 * v ** (1 / 2.2)));
const close = (actual, expected, tolerance, message) =>
  assert.ok(
    actual.every((value, c) => Math.abs(value - expected[c]) <= tolerance),
    `${message}: ${actual} against ${expected} (within ${tolerance})`,
  );
const marks = Object.fromEntries(
  Object.entries(PANORAMA_MARKS).map(([name, mark]) => [name, shown(mark.colour)]),
);
// Behind the eye when it looks toward a mark.
const opposite = { '-z': '+z', '+z': '-z', '+x': '-x', '-x': '+x', '+y': '-y', '-y': '+y' };
// Turned a quarter to the right: what stood to the left now stands ahead.
const turnedFrom = { '-z': '-x', '+x': '-z', '+z': '+x', '-x': '+z', '+y': '+y', '-y': '-y' };
for (const name of Object.keys(marks)) {
  close(report.unturned.sky[name], marks[name], 10, `the sky toward ${name} is its patch`);
  close(
    report.unturned.mirror[name],
    marks[opposite[name]],
    22,
    `the mirror seen toward ${name} shows the patch behind the eye (${opposite[name]})`,
  );
  close(
    report.turned.sky[name],
    marks[turnedFrom[name]],
    10,
    `turned a quarter, the sky toward ${name} is the patch from ${turnedFrom[name]}`,
  );
  close(
    report.turned.mirror[name],
    marks[turnedFrom[opposite[name]]],
    22,
    `and the mirror turns with it (toward ${name})`,
  );
}
assert.equal(report.rotation, 90);
assert.equal(report.format, report.formats[0], 'the best format this device filters is used');
// The matte ball: lighter and bluer where it faces the sky.
const top = report.balls.matteTop,
  bottom = report.balls.matteBottom;
assert.ok(
  top[2] > bottom[2] + 40,
  `the matte ball is lighter above (${top}) than below (${bottom})`,
);
// Every format the device filters gives the picture of the first.
for (const [format, result] of Object.entries(report.byFormat)) {
  assert.equal(result.used, format);
  assert.ok(
    result.difference.mean <= (format === 'rgbd' ? 1.5 : 0.4),
    `${format}: the same picture (mean ${result.difference.mean}, worst ${result.difference.worst})`,
  );
}
if (report.refusedFormat !== null) assert.match(report.refusedFormat, /is not available here/);
// Twice the exposure is twice the light: compared in light, not in shown values.
const light = (v) => (v / 255) ** 2.2;
const ratio = (a, b) => light(a[1]) / light(b[1]);
const exposure = ratio(report.exposure.one, report.exposure.half);
assert.ok(
  Math.abs(exposure - 2) < 0.1,
  `twice the exposure, twice the light (${exposure.toFixed(2)})`,
);
const ambient = ratio(report.ambient.full, report.ambient.half);
assert.ok(
  ambient > 1.6 && ambient < 2.05,
  `half the ambient intensity: about half the light on a matte ball, whose reflection stays (${ambient.toFixed(2)})`,
);
// A soft sky: the patch ahead is no longer its own colour, and the frame is another picture.
close(report.softSky.sharpCentre, marks['-z'], 10, 'the sharp sky ahead is the patch');
assert.ok(
  report.softSky.sharpSteps > 200 && report.softSky.softSteps < report.softSky.sharpSteps * 0.1,
  `soft, the patch has no hard edge (${report.softSky.softSteps} hard steps against ${report.softSky.sharpSteps})`,
);
assert.ok(report.softSky.difference.mean > 5, 'and the frame is another picture');
// The studio: a lamp overhead in the mirror, the matte ball lit, the background left alone.
assert.equal(report.studio.clearFlag, true, 'a cube picture draws no sky');
close(report.studio.background, [0, 0, 0], 3, "the background is the camera's own");
assert.ok(
  report.studio.mirrorTop[1] > 200,
  `the lamp overhead shows in the mirror (${report.studio.mirrorTop})`,
);
assert.ok(report.studio.matte[1] > 60, `the matte ball is lit (${report.studio.matte})`);
assert.match(report.studioSky, /A sky needs a panorama/);
// Given back.
assert.deepEqual(
  {
    mode: report.after.mode,
    hasIbl: report.after.hasIbl,
    rotate: report.after.rotate,
    clearFlag: report.after.clearFlag,
    hasSky: report.after.hasSky,
  },
  {
    mode: true,
    hasIbl: report.before.hasIbl,
    rotate: report.before.rotate,
    clearFlag: true,
    hasSky: report.before.hasSky,
  },
  'disposal gives the scene back what it had',
);
assert.equal(report.after.resources, 0, `nothing is left behind (${report.after.left})`);
assert.match(report.invalid.both, /either a panorama or a cube/);
assert.match(report.invalid.blur, /skyBlur must be 0\.\.1/);
assert.match(report.invalid.reflection, /reflection must be 0\.\.8/);
assert.match(report.invalid.scene, /pass a Laya Scene3D/);

console.log(
  `PASS HDR environment on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu}): ` +
    `formats ${report.formats.join(', ')}, built in ${report.buildMs} ms\n` +
    `  sky: ${Object.entries(report.unturned.sky)
      .map(([n, c]) => `${n} ${c}`)
      .join('; ')}\n` +
    `  mirror: ${Object.entries(report.unturned.mirror)
      .map(([n, c]) => `${n} ${c}`)
      .join('; ')}\n` +
    `  by format: ${JSON.stringify(report.byFormat)}\n` +
    `  exposure x${exposure.toFixed(2)}, ambient x${ambient.toFixed(2)}; matte top ${top} bottom ${bottom}; studio mirror top ${report.studio.mirrorTop}\n` +
    `Pictures: ${path.join(out, 'evidence')}`,
);
