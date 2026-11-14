#!/usr/bin/env node
// Real-GPU check of physical surfaces made in code
// (`createSurfaceMaterial({ type: 'physical' })`, LayaAir's glTF shader),
// through the browser SDK:
// - without its extra features it draws what the standard material draws;
// - sheen brightens cloth where it turns away from the eye;
// - the highlight of a brushed disc turns with anisotropyRotationDeg, past
//   the 1 radian LayaAir's own setter stops at;
// - a glass slab shows the checkerboard under it, tinted by its attenuation
//   colour, and shows black without the camera's opaque pass;
// - a thin film turns the colour of a dark ball with the angle;
// - bad specs are refused, and a build without the glTF module refuses a
//   physical surface with a message that says what to load;
// - made and disposed thirty times, nothing is left behind.
// Pictures for a person to look at are written beside the report.
// Desktop GPU evidence only (WebGL, or WebGPU with PHYSICAL_SURFACES_RENDERER);
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
  process.env.PHYSICAL_SURFACES_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-physical-surfaces'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// PHYSICAL_SURFACES_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild =
  (process.env.PHYSICAL_SURFACES_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
// The same backend without LayaAir's glTF module, for the refusal.
const plainProfile = gpuBuild ? '3d-webgpu' : '3d';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile, plainProfile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/physical-surfaces.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
const shell = (bundle, script) =>
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:960px;height:540px}</style>' +
  `<div id="view"></div><script src="${bundle}"></script>${script}`;
fs.writeFileSync(
  path.join(web, 'live.html'),
  shell(`zhuda-${profile}.js`, '<script src="page.js"></script>'),
);
fs.writeFileSync(
  path.join(web, 'plain.html'),
  shell(
    `zhuda-${plainProfile}.js`,
    `<script>
window.__PLAIN__ = {};
(async () => {
  const B = window.ZhudaBundle;
  await Zhuda.ZhudaEngine.boot({ renderer: B.renderer === 'webgpu' ? 'webgpu' : 'webgl',
    container: document.querySelector('#view'), width: 320, height: 180, dprCap: 1,
    features: [...B.features] });
  window.__PLAIN__.features = [...B.features];
  try { Zhuda.createSurfaceMaterial({ type: 'physical' }); window.__PLAIN__.result = 'accepted'; }
  catch (error) { window.__PLAIN__.result = String(error.message); }
})().catch((error) => { window.__PLAIN__.result = 'boot failed: ' + error; });
</script>`,
  ),
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
const base = `http://127.0.0.1:${server.address().port}`;

/** chromeFixture's waitFor gives up after 15 s; building six scenes takes longer on a busy machine. */
const waitLong = async (browser, expression, ms) => {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (await browser.evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error('Browser condition timeout: ' + expression);
};

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
  await browser.send('Page.navigate', { url: `${base}/plain.html` });
  await waitLong(browser, 'window.__PLAIN__ && window.__PLAIN__.result', 120000);
  const withoutGltf = await browser.evaluate('window.__PLAIN__');
  const plainErrors = browser.errors.splice(0);
  await browser.send('Page.navigate', { url: `${base}/live.html` });
  await waitLong(
    browser,
    'window.__PHYSICAL__ && (window.__PHYSICAL__.ready || window.__PHYSICAL__.error)',
    180000,
  );
  report = {
    gpu,
    withoutGltf: { ...withoutGltf, consoleErrors: plainErrors },
    ...(await browser.evaluate('window.__PHYSICAL__')),
    consoleErrors: browser.errors,
  };
  delete report.show;
  if (report.ready) {
    report.pictures = [];
    for (const view of report.views) {
      await browser.evaluate(`window.__PHYSICAL__.show(${JSON.stringify(view)})`);
      const file = path.join(out, 'evidence', `physical-${view}.png`);
      await browser.screenshot(file);
      report.pictures.push(path.basename(file));
    }
    report.rendererErrorsAfter = await browser.evaluate('window.__PHYSICAL__.rendererErrors');
  }
  report.consoleMessages = browser.consoleMessages.slice(0, 20);
  report.glErrors = browser.glErrors.slice(0, 20);
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');
assert.deepEqual(report.rendererErrors, [], 'renderer errors');
assert.deepEqual(report.rendererErrorsAfter, [], 'renderer errors while taking pictures');
assert.deepEqual(report.glErrors, [], 'WebGL errors');
assert.deepEqual(
  report.consoleMessages.filter((m) => /shader|glTFPBR|compile/i.test(m)),
  [],
  'no shader warning or error',
);
assert.equal(report.backend.selected, report.renderer, 'the backend asked for is the one drawing');
const p = report.physical;

// Without the glTF module a physical surface is refused, and the message says what to load.
assert.ok(!report.withoutGltf.features.includes('gltf'), 'the plain build has no glTF module');
assert.match(report.withoutGltf.result, /glTF shader 'glTFPBR' is not registered/);
assert.match(report.withoutGltf.result, /3d-gltf/);

// The glTF shader with nothing extra draws what LayaAir's standard material draws.
for (const [name, pair] of Object.entries(p.base))
  assert.ok(
    pair.meanAbsLumDiff < 6,
    `${name}: physical and standard agree (${pair.meanAbsLumDiff} of 255 apart)`,
  );

// A normal texture: it changes the light, leaning one way brightens the disc under a
// light from above and the other way darkens it, and a physical surface reads it
// as the standard material does.
const n = p.normal;
assert.ok(n.againstFlat > 15, `the normal texture changes the light (${n.againstFlat})`);
assert.ok(
  (n.oneLum - n.flatLum) * (n.otherLum - n.flatLum) < 0,
  `leaning the other way turns the change round (${n.otherLum} / ${n.flatLum} / ${n.oneLum})`,
);
assert.ok(
  n.againstStandard < 1,
  `read as the standard material reads it (${n.againstStandard} apart)`,
);

// Sheen: the rim of the cloth ball brightens, its centre much less.
const c = p.cloth;
const rimGain = c.sheen.rim.lum - c.plain.rim.lum,
  centreGain = c.sheen.centre.lum - c.plain.centre.lum;
assert.ok(
  c.sheen.rim.lum > c.plain.rim.lum * 1.4 && rimGain > 12,
  `with sheen the rim is brighter (${c.plain.rim.lum} -> ${c.sheen.rim.lum})`,
);
assert.ok(
  rimGain > centreGain * 2,
  `and it rises where the ball turns away: rim +${rimGain.toFixed(1)}, centre +${centreGain.toFixed(1)}`,
);

// A brushed disc: round without anisotropy, a streak that turns with the rotation.
const b = p.brushed;
assert.ok(b.round.elongation < 1.3, `no anisotropy, a round highlight (${b.round.elongation})`);
for (const name of ['rot-0', 'rot-45', 'rot-90', 'rot-405', 'standard-90'])
  assert.ok(b[name].elongation > 2, `${name}: a streak (${b[name].elongation} long to wide)`);
const gap = (x, y) => {
  const d = Math.abs(x - y) % 180;
  return Math.min(d, 180 - d);
};
const turned45 = gap(b['rot-45'].angleDeg, b['rot-0'].angleDeg),
  turned90 = gap(b['rot-90'].angleDeg, b['rot-0'].angleDeg);
assert.ok(Math.abs(turned45 - 45) < 10, `45 degrees turns the streak by ${turned45}`);
assert.ok(Math.abs(turned90 - 90) < 10, `90 degrees turns the streak by ${turned90}`);
assert.ok(
  gap(b['rot-405'].angleDeg, b['rot-45'].angleDeg) < 5,
  `405 degrees is 45 and a full turn (${b['rot-405'].angleDeg} against ${b['rot-45'].angleDeg})`,
);
assert.ok(
  gap(b['standard-90'].angleDeg, b['rot-90'].angleDeg) < 10,
  `the standard material turns as far (${b['standard-90'].angleDeg} against ${b['rot-90'].angleDeg})`,
);

// Glass over a checkerboard.
const g = p.glass;
assert.ok(g.pixels > 20000, `the slab covers part of the frame (${g.pixels} pixels)`);
assert.equal(p.glassRenderQueue, 3000, 'a transmissive surface is drawn after the opaque scene');
assert.deepEqual(p.glassPasses, { opaqueColor: true });
assert.equal(p.glassPassReport.ready, true);
assert.ok(
  g.clear.spread > g.bare.spread * 0.5,
  `through clear glass the checker shows (spread ${g.clear.spread} against ${g.bare.spread} bare)`,
);
assert.ok(
  g.tinted.spread > g.bare.spread * 0.25,
  `through tinted glass it shows too (spread ${g.tinted.spread})`,
);
assert.ok(
  g.opaque.spread < g.bare.spread * 0.2,
  `the same surface without transmission hides it (spread ${g.opaque.spread})`,
);
assert.ok(
  g.tinted.green > g.clear.green * 1.25 && g.tinted.green > 1.2,
  `the attenuation colour tints it green (${g.clear.green} -> ${g.tinted.green})`,
);
assert.ok(
  g.noPass.mean < g.tinted.mean * 0.5,
  `without the opaque pass nothing shows through (${g.tinted.mean} -> ${g.noPass.mean})`,
);

// Iridescence: the hue of a dark ball changes from its centre to its edge.
const f = p.film;
assert.ok(
  f.iridescent.centre.saturation > 0.2 && f.iridescent.edge.saturation > 0.2,
  `a thin film colours the ball (${JSON.stringify(f.iridescent)})`,
);
assert.ok(
  f.iridescent.centreToEdgeHue > 60,
  `and the colour turns from the centre, seen head on, to the edge (${f.iridescent.centreToEdgeHue} degrees of hue)`,
);
assert.ok(f.plain.mostSaturation < 0.05, `without it the ball is grey (${f.plain.mostSaturation})`);

// Refusals in the page.
assert.match(p.refused.sheenOnStandard, /sheen: physical surfaces only/);
assert.match(p.refused.sheenColour, /sheen\.color: three numbers 0\.\.1/);
assert.match(
  p.refused.volumeWithoutTransmission,
  /textures\.thickness: needs transmission\.volume/,
);
assert.match(p.refused.attenuationBlack, /attenuationColor: three numbers above 0/);
assert.match(p.refused.additiveGlass, /additive/);

// Lifecycle.
assert.equal(p.resources.after, p.resources.before, 'thirty made and disposed: nothing left');
assert.equal(p.checkerAlive, true, 'borrowed textures survive disposal');
console.log(
  `PASS physical surfaces on ${report.renderer} (${report.backend.nativeEngine}, ${report.gpu}): ` +
    JSON.stringify({ physical: p, withoutGltf: report.withoutGltf.result }),
);
