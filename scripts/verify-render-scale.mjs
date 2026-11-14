#!/usr/bin/env node
// Real-GPU check of the render scale of a game's look (`ZhudaSceneLook`
// with `ZhudaRenderScale`), through the browser SDK:
// - at every scale from 0.5 to 1 and every upscale the 3D picture covers the
//   whole canvas, edge to edge, and the 2D interface over it stays as sharp
//   as at full size. What an uncovered pixel reads like is measured first,
//   from a view over a quarter of the canvas (the stage's colour on WebGL,
//   black on WebGPU), and each upscale fills that view and nothing more;
// - at 0.67, FSR 1 (EASU then RCAS) and the filtered upscale with RCAS are
//   sharper than LayaAir's plain stretch; the sharpening is what makes them
//   sharper. In the page's own look (multisampled, no bloom) FSR is also
//   nearer the full-size picture; in three other looks it is sharper and
//   about as near, a little to either side, which is reported;
// - a quality ladder (`zhudaQualitySteps`) walks look levels and scales in
//   place; one render scale for the stage; full size gives LayaAir's own
//   picture back; disposal leaves nothing behind, and a scene destroyed
//   with its look left undisposed gives the stage's scale back.
// Pictures for a person to look at are written beside the report.
// Desktop GPU evidence only (WebGL, or WebGPU with RENDER_SCALE_RENDERER);
// the frame times it reports are desktop times, not phone evidence.
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
  process.env.RENDER_SCALE_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-render-scale'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// RENDER_SCALE_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild =
  (process.env.RENDER_SCALE_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 600,
  H = 360;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/render-scale.ts')],
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
    if (
      await browser.evaluate(
        'window.__SCALE__ && (window.__SCALE__.ready || window.__SCALE__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__SCALE__')),
    consoleErrors: browser.errors,
    // WebGPU reports pipeline and validation errors as console warnings.
    gpuWarnings: browser.consoleMessages.filter((m) => /unCaptured|INVALID|GL_|WebGPU/i.test(m)),
  };
  if (report.ready) {
    report.pictures = [];
    for (const name of ['reference', 'plain', 'bilinear', 'easu', 'fsr', 'half', 'rich']) {
      png(`scale-${name}.png`, await browser.evaluate(`window.__SCALE__.picture('${name}')`));
      report.pictures.push(`scale-${name}.png`);
    }
    // A view over a quarter of the canvas, at full size and at 0.67 with FSR: bare canvas around it.
    for (const name of ['split', 'split-fsr']) {
      png(`${name}.png`, await browser.evaluate(`window.__SCALE__.picture('${name}')`));
      report.pictures.push(`${name}.png`);
    }
    // The finest stripes and the slanted bars, three times enlarged without smoothing.
    for (const name of ['reference', 'plain', 'fsr', 'bilinear']) {
      png(
        `detail-${name}.png`,
        await browser.evaluate(`window.__SCALE__.picture('${name}', [200, 60, 200, 140], 3)`),
      );
      report.pictures.push(`detail-${name}.png`);
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
// Drawn by the backend asked for; on WebGPU by a real adapter, not a fallback.
assert.equal(report.backend.selected, gpuBuild ? 'webgpu' : 'webgl');
if (gpuBuild)
  assert.ok(
    report.backend.adapter && !report.backend.adapter.isFallbackAdapter,
    `a WebGPU adapter (${JSON.stringify(report.backend.adapter)})`,
  );
const r = report.r;
assert.equal(r.ratioAtFull, 1);
// The test for uncovered canvas can fail here: around a view over a quarter
// of the canvas it counts the rest (less the interface strip).
assert.ok(
  r.split.full > W * H * 0.5,
  `bare canvas is told from the picture on this backend (${r.split.full} pixels of ${r.bare} around a quarter view)`,
);
assert.equal(r.reference.uncovered, 0, 'and nothing in the full-size picture reads like it');
for (const upscale of ['plain', 'bilinear', 'fsr']) {
  assert.ok(
    Math.abs(r.split[upscale].uncovered - r.split.full) <= r.split.full * 0.005,
    `${upscale}: a quarter view at 0.67 fills its quarter and no more (${r.split[upscale].uncovered} bare pixels against ${r.split.full})`,
  );
  assert.ok(
    r.split[upscale].meanDiff < 6,
    `${upscale}: with the same picture in it (${r.split[upscale].meanDiff})`,
  );
}
const { plain, bilinear, fsr, easu } = r.at067;
for (const [name, m] of Object.entries({ plain, bilinear, fsr }))
  assert.deepEqual(
    m.viewport,
    [402, 241],
    `${name}: the 3D picture is drawn at 0.67 (${m.viewport})`,
  );
// Covered edge to edge at every scale and upscale; the picture is the scene, not flipped.
for (const c of r.cover) {
  assert.equal(c.uncovered, 0, `${c.scale} ${c.upscale}: no canvas left uncovered`);
  assert.ok(
    c.meanDiff < (c.scale === 1 ? 0.5 : 12),
    `${c.scale} ${c.upscale}: the same picture as at full size (${c.meanDiff})`,
  );
  assert.ok(
    c.border.every((v, i) => Math.abs(v - r.cover[0].border[i]) < 12),
    `${c.scale} ${c.upscale}: the outermost pixels are the scene's (${c.border} against ${r.cover[0].border})`,
  );
}
// The interface is drawn at the canvas's size whatever the 3D scale.
for (const [name, m] of Object.entries({ plain, bilinear, fsr }))
  assert.ok(m.uiDiff < 0.5, `${name}: the interface is as at full size (${m.uiDiff})`);
// Sharper than the plain stretch, and no further from the full-size picture.
assert.ok(
  fsr.sharpness > plain.sharpness * 1.1,
  `FSR is sharper than the plain stretch (${fsr.sharpness} against ${plain.sharpness}, full size ${r.reference.sharpness})`,
);
assert.ok(
  bilinear.sharpness > plain.sharpness * 1.1,
  `RCAS on a filtered upscale is sharper than the plain stretch (${bilinear.sharpness} against ${plain.sharpness})`,
);
assert.ok(
  fsr.sharpness < r.reference.sharpness * 1.05,
  `and not sharper than full size (${fsr.sharpness} against ${r.reference.sharpness})`,
);
assert.ok(
  fsr.meanDiff < plain.meanDiff,
  `in this look (multisampled, no bloom) FSR is nearer the full-size picture than the plain stretch (${fsr.meanDiff} against ${plain.meanDiff})`,
);
// Other looks: sharper there too, and about as near, to either side.
for (const [name, look] of Object.entries(r.looks)) {
  assert.ok(
    look.fsr.sharpness > look.plain.sharpness * 1.1 &&
      look.fsr.sharpness < look.full.sharpness * 1.05,
    `look ${name}: FSR is sharper than the plain stretch and not sharper than full size (${look.fsr.sharpness}, ${look.plain.sharpness}, ${look.full.sharpness})`,
  );
  assert.ok(
    Math.abs(look.fsr.meanDiff - look.plain.meanDiff) < 0.5,
    `look ${name}: and about as near the full-size picture (${look.fsr.meanDiff} against ${look.plain.meanDiff})`,
  );
  assert.equal(look.fsr.uncovered + look.plain.uncovered, 0, `look ${name}: the canvas is covered`);
}
assert.ok(
  bilinear.meanDiff < plain.meanDiff * 1.1,
  `RCAS on a filtered upscale is about as near as the plain stretch (${bilinear.meanDiff} against ${plain.meanDiff})`,
);
assert.ok(
  fsr.sharpness > easu.sharpness * 1.03,
  `the sharpening adds to EASU alone (${fsr.sharpness} against ${easu.sharpness})`,
);
// The ladder walks down in place and comes back to full size.
const steps = r.steps;
assert.deepEqual(
  steps.map((s) => [s.look, s.scale]),
  [
    [3, 1],
    [3, 0.85],
    [3, 0.7],
    [2, 0.7],
    [1, 0.7],
    [0, 0.7],
    [0, 0.5],
  ],
);
for (const s of steps) {
  assert.equal(s.ratio, s.scale, `rung ${s.level}: the stage draws at its scale`);
  assert.equal(s.uncovered, 0, `rung ${s.level}: the canvas is covered`);
}
assert.equal(r.richMode, 'rebuilt');
assert.equal(r.rich.uncovered, 0, 'the whole chain at 0.67 covers the canvas');
assert.ok(r.rich.sharpness > 5, `and draws a picture (${JSON.stringify(r.rich)})`);
assert.equal(r.backAtFull.ratio, 1);
assert.ok(
  r.backAtFull.meanDiff < 0.5,
  `back at full size, the first picture (${r.backAtFull.meanDiff})`,
);
assert.match(r.second, /stage has one already/, 'one render scale for the stage');
// A scene destroyed with its look left undisposed.
assert.equal(r.stray.held, 0.8);
assert.equal(r.stray.afterDestroy, 1, 'its destruction gives the stage its full size back');
assert.equal(r.stray.next, 'accepted', 'and the scale to the next look that asks');
assert.equal(r.stray.uncovered, 0);
assert.ok(r.stray.meanDiff < 12, `which draws the scene (${r.stray.meanDiff})`);
assert.equal(r.stray.lateDispose, 'disposed');
assert.equal(
  r.stray.afterLateDispose,
  0.75,
  'a late dispose of the forgotten look changes nothing',
);
assert.match(r.invalid[0], /use 0\.5\.\.1/);
assert.match(r.invalid[1], /fsr, bilinear or plain/);
assert.match(r.invalid[2], /sharpness 0\.\.1/);
assert.ok(
  r.resourcesAfter - r.resourcesBefore <= 0,
  `ten scale changes leave no resource behind (${r.resourcesBefore} -> ${r.resourcesAfter})`,
);
assert.deepEqual(
  r.afterDispose,
  { ratio: 1, ownBlit: false },
  'disposal gives LayaAir its own stretch back',
);
console.log(
  `PASS render scale on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu}): ` +
    JSON.stringify({
      at067: r.at067,
      reference: r.reference,
      looks: r.looks,
      bare: r.bare,
      split: r.split,
      desktopMs: r.desktopMs,
    }) +
    `\nPictures: ${path.join(out, 'evidence')}`,
);
