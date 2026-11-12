#!/usr/bin/env node
// Real WebGL check of the two live-look APIs through the browser SDK:
// - a lit material's vertex hook moves the surface and its shadow (the
//   ShadowCaster pass runs the hook too);
// - `ZhudaFilmStage.setLook` changes continuous values in place (same HDR
//   chain and sky material), rebuilds on structural changes, comes back to
//   the original frame, keeps resources bounded over 30 rebuilds and refuses
//   a panorama or an invalid look without changing the stage.
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
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
  process.env.LIVE_LOOK_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-live-look'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// LIVE_LOOK_RENDERER=webgpu runs the same checks on the WebGPU build.
const gpuBuild = process.env.LIVE_LOOK_RENDERER === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/live-look.ts')],
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
    'window.__LIVE__ && (window.__LIVE__.ready || window.__LIVE__.error)',
    120000,
  );
  report = { gpu, ...(await browser.evaluate('window.__LIVE__')), consoleErrors: browser.errors };
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');

// Vertex hook: the plate and its shadow both move along +X when the hook shifts it.
const { shift0, shift3 } = report.vertex;
for (const [name, v] of Object.entries({ shift0, shift3 })) {
  assert.ok(v.plate.n > 200, `${name}: plate visible`);
  assert.ok(v.shadow.n > 200, `${name}: shadow visible`);
}
const plateMove = shift3.plate.x - shift0.plate.x,
  shadowMove = shift3.shadow.x - shift0.shadow.x;
assert.ok(plateMove > 40, `plate moved right (${plateMove}px)`);
assert.ok(
  shadowMove > 40,
  `shadow moved right with it (${shadowMove}px): ShadowCaster runs the hook`,
);
assert.ok(Math.abs(shadowMove - plateMove) < plateMove * 0.6, 'plate and shadow move together');

// setLook.
const l = report.look;
// Weather in place, quality levels and a lamp, on one stage with a pond.
const w = report.weather;
assert.equal(w.overcastMode, 'updated', 'grade and fog strengths are set in place');
assert.ok(w.overcastSameChain, 'overcast keeps the HDR chain');
assert.ok(w.overcastDiff > 3, `overcast changes the frame (${w.overcastDiff})`);
assert.equal(w.clearMode, 'updated');
assert.ok(w.clearDiff < 1, `clearing up is the first frame again (${w.clearDiff})`);
assert.equal(w.q0Mode, 'rebuilt');
assert.equal(w.q0Quality, 0);
assert.ok(w.q0HasChain, 'with water, quality 0 keeps a bare HDR chain');
assert.deepEqual(w.q0Grade, [0, 0], 'no bloom or ambient occlusion at quality 0');
assert.equal(w.q0LightFog, false);
assert.ok(w.q0Diff > 0.5, `quality 0 changes the frame (${w.q0Diff})`);
assert.equal(w.q0Again, 'unchanged');
assert.equal(w.q1Look, w.q1Expected, 'a new look at level 1 is that look at level 1');
assert.ok(w.q3Diff < 1.5, `quality 3 is the first frame again (${w.q3Diff})`);
assert.ok(w.cyclesDiff < 1.5, `after 10 quality cycles still the first frame (${w.cyclesDiff})`);
assert.deepEqual(w.resourcesAfter, w.resourcesBefore, 'quality cycles leave resources unchanged');
assert.ok(
  w.resourcesBefore.resources - w.resourcesAtStart <= 1,
  `visiting the lower levels once keeps at most one pooled render target (${w.resourcesAtStart} -> ${w.resourcesBefore.resources})`,
);
assert.ok(w.lampOffDiff > 0.3 && w.lampOffDarker, `the lamp goes out (${w.lampOffDiff})`);
assert.ok(w.lampOnDiff < 0.5, `the lamp comes back as it was (${w.lampOnDiff})`);
assert.ok(w.lampStrongDiff > 1, `a stronger, bluer lamp changes the frame (${w.lampStrongDiff})`);
assert.match(w.missing, /no light missing/);
assert.match(w.negative, /intensity/);

// A two-sided lit material draws both squares; a one-sided one draws one.
const sides = report.sides;
assert.ok(sides.oneSided > 500, `a one-sided square is visible (${sides.oneSided} px)`);
assert.ok(
  sides.twoSided > sides.oneSided * 1.7,
  `doubleSided shows both squares (${sides.twoSided} px against ${sides.oneSided})`,
);
assert.equal(l.duskMode, 'updated');
assert.ok(l.duskSamePipeline, 'dusk keeps the HDR chain');
assert.ok(l.duskSameSky, 'dusk keeps the sky material');
assert.ok(l.dusk < l.base - 5, `dusk is darker (${l.base} -> ${l.dusk})`);
assert.ok(l.duskDiff > 5, 'dusk changes the frame');
assert.equal(l.plainMode, 'rebuilt');
assert.ok(l.plainNewPipeline, 'a rebuild replaces the HDR chain');
assert.ok(l.plainDiff > 2, 'light fog off changes the frame');
assert.equal(l.backMode, 'rebuilt');
assert.ok(l.backHasPipeline, 'light fog back on builds a new chain');
assert.ok(l.backDiff < 1.5, `back to the first frame (mean difference ${l.backDiff})`);
assert.ok(l.cyclesDiff < 1.5, `after 30 rebuilds still the first frame (${l.cyclesDiff})`);
assert.deepEqual(l.resourcesAfter, l.resourcesBefore, '30 rebuilds leave resources unchanged');
assert.match(l.panoramaRefusal, /cannot change the panorama/);
assert.notEqual(l.invalidRefusal, 'accepted');
assert.equal(l.lookAfterRefusals, 45, 'refused looks leave the look');
assert.ok(l.refusalDiff < 0.5, 'refused looks leave the frame');
assert.ok(l.inPlaceAmbientMs < 1, `recolouring the sky light is cheap (${l.inPlaceAmbientMs} ms)`);
assert.equal(l.tintedMode, 'updated');
assert.ok(l.tintedDiff > 2, `a new sky light colour changes the frame (${l.tintedDiff})`);
assert.ok(
  l.tintedVsFresh < 1.5,
  `recoloured in place draws like a fresh mount (${l.tintedVsFresh})`,
);
assert.ok(l.ambientResourcesStable, 'recolouring the sky light allocates nothing');
assert.ok(l.inPlaceMs < 4, `in-place setLook is cheap (${l.inPlaceMs} ms)`);
console.log(
  `PASS live look on ${report.gpu}: plate ${plateMove}px / shadow ${shadowMove}px; ` +
    `dusk ${l.base}->${l.dusk} in place (${l.inPlaceMs} ms, with ambient ${l.inPlaceAmbientMs} ms); rebuild back ${l.backDiff}; ` +
    `evidence ${out}/evidence`,
);
