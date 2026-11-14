#!/usr/bin/env node
// Real-GPU check of specular anti-aliasing (installLaya342SpecularAA,
// ZHUDA_SPECULAR_AA) through the browser SDK, against the truth: the same
// ball drawn with 256 samples to a pixel and no patch (tests/fixtures/specular-aa.ts).
// Every number is the sun's light alone (no ambient), under a camera moved by
// less than a pixel from frame to frame, in linear light under a sun that
// clips nothing and in shown values under a sun as a game sets it.
// - it is on by default, for the PBR, glTF and ZhudaLitSurface shaders;
// - a dense, mipmapped normal map (four and eight texels to a pixel): less
//   change from frame to frame, far fewer pops, no clipped sparkles; the mean
//   light and the light of a block of pixels nearer the truth for metal;
// - a normal map without mipmaps, a map seen close up, a map at no strength
//   and a map on a mesh without tangents: left as they were;
// - one texel to a pixel: left alone away from the rim; two texels to a
//   pixel, where the map's part fades in: recorded, and kept under the
//   truth's own change;
// - smooth balls, polished to dull, large and small: the highlight nearer the
//   truth than without the patch, no brighter rim;
// - an alpha-tested surface compiles; a scene can turn it off and on.
// What it costs and where it is further from the truth is asserted as a
// bound, so that it cannot grow unseen: see the record.
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
  // The truth is some twenty thousand frames, and many shader variants are
  // compiled on the way (WebGPU's are slow): wait far longer than the
  // fixture's default of fifteen seconds.
  const deadline = Date.now() + 480000;
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
assert.equal(report.status.patched, true, 'PBRFrag.glsl and PBRLighting.glsl are patched');
assert.equal(
  report.status.defaultOn,
  false,
  'off until a scene asks (the fixture asks for each case)',
);
assert.equal(report.status.reason, undefined);
assert.equal(report.status.watchesNormalMaps, true, 'materials are told of maps without mipmaps');
// Laya's PBR and glTF shaders at boot, the fixture's lit material later; none left out.
assert.ok(
  report.statusEnd.normalMapPasses >= 3,
  `the PBR, glTF and lit forward passes read the map's filtering (${report.statusEnd.normalMapPasses})`,
);
assert.deepEqual(report.statusEnd.normalMapSkipped, [], 'no forward pass was left out');
assert.equal(report.newSceneHasDefine, false, 'a new scene is left alone until it asks');
for (const name of ['pbr', 'gltf', 'lit']) {
  assert.equal(
    report.nomipmapDefine[`${name}-metal-unfiltered`],
    true,
    `${name}: a material knows its normal map has no mipmaps`,
  );
  assert.equal(report.nomipmapDefine[`${name}-metal-mipmapped`], false, `${name}: and that it has`);
}

const r = report.result;
const ratio = (a, b) => +(a / b).toFixed(3);
const summary = [];

// ---- A dense, mipmapped normal map -----------------------------------------
// Inside 0.85 of the disc; the rim and the whole ball are in the report.
const DENSE = [
  // density, shaders, [finish, linear flicker, shown flicker, pops] at most this share of unpatched
  ['4tx', ['pbr', 'gltf', 'lit'], { metal: [0.35, 0.9, 0.2], painted: [0.75, 0.95, 0.7] }],
  ['8tx', ['pbr'], { metal: [0.25, 0.8, 0.1], painted: [0.65, 0.9, 0.3] }],
];
for (const [density, shaders, finishes] of DENSE)
  for (const shader of shaders)
    for (const [finish, [light, shown, pops]] of Object.entries(finishes)) {
      const key = `${density}-${shader}-${finish}-mipmapped`;
      const { off, on, changed } = r.dense[key];
      assert.equal(off.applied, false, `${key}: off is off`);
      assert.equal(on.applied, true, `${key}: on is on`);
      assert.ok(changed > 0.3, `${key}: the patch changes the picture (${changed})`);
      assert.equal(off.ball.clipped + on.ball.clipped, 0, `${key}: light measured unclipped`);
      // In light: the mean change from one jittered frame to the next.
      assert.ok(
        on.inner.flicker <= off.inner.flicker * light,
        `${key}: less flicker in light (${off.inner.flicker} -> ${on.inner.flicker})`,
      );
      assert.ok(
        on.inner.sparkles <= off.inner.sparkles * 0.1 && on.inner.pops <= off.inner.pops * 0.25,
        `${key}: sparkles and pops gone (${off.inner.sparkles}, ${off.inner.pops} -> ${on.inner.sparkles}, ${on.inner.pops})`,
      );
      // As a player sees it: shown values, under a sun that clips.
      assert.ok(
        on.inner.game.shownFlicker <= off.inner.game.shownFlicker * shown,
        `${key}: less change as shown under the game's sun (${off.inner.game.shownFlicker} -> ${on.inner.game.shownFlicker})`,
      );
      assert.ok(
        on.inner.game.pops <= off.inner.game.pops * pops,
        `${key}: fewer pops under the game's sun (${off.inner.game.pops} -> ${on.inner.game.pops})`,
      );
      assert.ok(
        on.inner.game.clipped <= 1,
        `${key}: no clipped sparkles (${on.inner.game.clipped})`,
      );
      if (shader === 'pbr')
        summary.push(
          `${key}: light ${off.inner.flicker}->${on.inner.flicker}, shown ${off.inner.game.shownFlicker}->${on.inner.game.shownFlicker}, pops ${off.inner.game.pops}->${on.inner.game.pops}`,
        );
    }

// ---- Against the truth ------------------------------------------------------
for (const density of ['4tx', '8tx']) {
  const metal = r.dense[`${density}-pbr-metal-mipmapped`],
    painted = r.dense[`${density}-pbr-painted-mipmapped`];
  const truthMetal = r.truth[`${density}-metal`],
    truthPainted = r.truth[`${density}-painted`];
  assert.equal(truthMetal.clipped + truthPainted.clipped, 0, `${density}: the truth is unclipped`);
  // The sun's light over the whole ball, rim and all, with no other light to hide a change.
  const light = (side, truth) => ratio(side.ball.mean, truth.ball.mean);
  const metalOff = light(metal.off, truthMetal),
    metalOn = light(metal.on, truthMetal);
  assert.ok(
    Math.abs(metalOn - 1) <= 0.12 && Math.abs(metalOn - 1) <= Math.abs(metalOff - 1),
    `${density} metal: as much light as the truth within 12 %, and nearer it than unpatched (x${metalOff} -> x${metalOn})`,
  );
  const paintedOff = light(painted.off, truthPainted),
    paintedOn = light(painted.on, truthPainted);
  assert.ok(
    Math.abs(paintedOn - 1) <= Math.abs(paintedOff - 1) + 0.01,
    `${density} paint: its light no further from the truth (x${paintedOff} -> x${paintedOn})`,
  );
  // What a block of sixteen pixels shows under the game's sun.
  assert.ok(
    metal.on.againstTruth.block <= metal.off.againstTruth.block * 0.75,
    `${density} metal: a block of pixels is nearer the truth (${metal.off.againstTruth.block} -> ${metal.on.againstTruth.block})`,
  );
  // Limits, kept from growing: pixel for pixel the patch is not nearer the
  // truth (the truth glitters), and paint's blocks are a little further.
  assert.ok(
    metal.on.againstTruth.pixel <= metal.off.againstTruth.pixel + 8,
    `${density} metal, pixel for pixel (${metal.off.againstTruth.pixel} -> ${metal.on.againstTruth.pixel})`,
  );
  assert.ok(
    painted.on.againstTruth.block <= painted.off.againstTruth.block + 1.5 &&
      painted.on.againstTruth.pixel <= painted.off.againstTruth.pixel + 1.5,
    `${density} paint against the truth (${JSON.stringify(painted.off.againstTruth)} -> ${JSON.stringify(painted.on.againstTruth)})`,
  );
  // The truth itself changes more from frame to frame than the patched metal does.
  assert.ok(
    metal.on.inner.game.shownFlicker <= truthMetal.inner.game.shownFlicker,
    `${density} metal: under the truth's own change (${truthMetal.inner.game.shownFlicker})`,
  );
  // A limit: the rim of a bumpy metal ball is brighter than the truth's.
  assert.ok(
    metal.on.rim.game.meanShown <= 35,
    `${density} metal: the rim (unpatched ${metal.off.rim.game.meanShown}, truth ${truthMetal.rim.game.meanShown}, patched ${metal.on.rim.game.meanShown})`,
  );
  summary.push(
    `${density} against the truth: metal light x${metalOff}->x${metalOn}, block ${metal.off.againstTruth.block}->${metal.on.againstTruth.block}, pixel ${metal.off.againstTruth.pixel}->${metal.on.againstTruth.pixel}, rim ${metal.off.rim.game.meanShown}->${metal.on.rim.game.meanShown} (truth ${truthMetal.rim.game.meanShown}); paint light x${paintedOff}->x${paintedOn}, block ${painted.off.againstTruth.block}->${painted.on.againstTruth.block}`,
  );
}

// ---- A normal map without mipmaps is left as it was -------------------------
const near = (a, b, share, slack) => Math.abs(a - b) <= Math.max(Math.abs(b) * share, slack);
for (const [key, { off, on, changed }] of Object.entries(r.dense)) {
  if (!key.endsWith('-unfiltered')) continue;
  assert.ok(changed < 0.3, `${key}: the picture is as it was (${changed})`);
  assert.ok(
    near(on.inner.game.shownFlicker, off.inner.game.shownFlicker, 0.03, 0.2) &&
      near(on.inner.game.pops, off.inner.game.pops, 0.03, 5) &&
      near(on.ball.mean, off.ball.mean, 0.01, 0.01) &&
      near(on.rim.game.meanShown, off.rim.game.meanShown, 0.05, 0.5),
    `${key}: flicker, pops, light and rim as they were (${JSON.stringify(off.inner.game)} -> ${JSON.stringify(on.inner.game)})`,
  );
}
{
  const { off, on } = r.dense['4tx-pbr-metal-unfiltered'];
  summary.push(
    `4tx-pbr-metal-unfiltered: shown ${off.inner.game.shownFlicker}->${on.inner.game.shownFlicker}, pops ${off.inner.game.pops}->${on.inner.game.pops}`,
  );
}

// ---- Where the bumps can still be seen --------------------------------------
{
  // One texel to a pixel: left alone away from the rim. A limit: toward the
  // rim the map is squeezed, its part fades in, and the rim is brighter.
  for (const finish of ['metal', 'painted']) {
    const { off, on } = r.dense[`1tx-pbr-${finish}-mipmapped`];
    assert.ok(
      near(on.inner.game.shownFlicker, off.inner.game.shownFlicker, 0.03, 0.2) &&
        near(on.inner.game.pops, off.inner.game.pops, 0.03, 5) &&
        near(on.inner.mean, off.inner.mean, 0.01, 0.01),
      `one texel to a pixel, ${finish}: as it was inside the rim (${JSON.stringify(off.inner.game)} -> ${JSON.stringify(on.inner.game)})`,
    );
  }
  const one = r.dense['1tx-pbr-metal-mipmapped'];
  assert.ok(
    one.on.rim.game.meanShown <= 22,
    `one texel to a pixel: the rim (${one.off.rim.game.meanShown} -> ${one.on.rim.game.meanShown})`,
  );
  // Two texels to a pixel, where the map's part fades in. A limit: the metal
  // shows more change from frame to frame than unpatched, which hides its
  // light in clipping. It stays under the truth's own change and pops, and a
  // block of pixels is no further from the truth.
  const two = r.dense['2tx-pbr-metal-mipmapped'],
    truth = r.truth['2tx-metal'];
  assert.ok(
    two.on.inner.game.shownFlicker <= truth.inner.game.shownFlicker &&
      two.on.inner.game.shownFlicker <= two.off.inner.game.shownFlicker * 1.75 &&
      two.on.inner.game.pops <= truth.inner.game.pops,
    `two texels to a pixel, metal: change as shown ${two.off.inner.game.shownFlicker} -> ${two.on.inner.game.shownFlicker} (truth ${truth.inner.game.shownFlicker}), pops ${two.off.inner.game.pops} -> ${two.on.inner.game.pops} (truth ${truth.inner.game.pops})`,
  );
  assert.ok(
    two.on.inner.flicker <= two.off.inner.flicker,
    `two texels to a pixel, metal: no more flicker in light (${two.off.inner.flicker} -> ${two.on.inner.flicker})`,
  );
  assert.ok(
    two.on.againstTruth.block <= two.off.againstTruth.block + 2,
    `two texels to a pixel, metal: a block of pixels no further from the truth (${two.off.againstTruth.block} -> ${two.on.againstTruth.block})`,
  );
  const paint = r.dense['2tx-pbr-painted-mipmapped'];
  assert.ok(
    paint.on.inner.game.shownFlicker <= paint.off.inner.game.shownFlicker * 1.12 &&
      paint.on.againstTruth.block <= paint.off.againstTruth.block + 1.5,
    `two texels to a pixel, paint (${paint.off.inner.game.shownFlicker} -> ${paint.on.inner.game.shownFlicker})`,
  );
  summary.push(
    `2tx metal (the map's part fading in): shown ${two.off.inner.game.shownFlicker}->${two.on.inner.game.shownFlicker} (truth ${truth.inner.game.shownFlicker}), pops ${two.off.inner.game.pops}->${two.on.inner.game.pops} (truth ${truth.inner.game.pops}), block ${two.off.againstTruth.block}->${two.on.againstTruth.block}`,
    `1tx metal: inside the rim shown ${one.off.inner.game.shownFlicker}->${one.on.inner.game.shownFlicker}; rim ${one.off.rim.game.meanShown}->${one.on.rim.game.meanShown}`,
  );
}

// ---- The surroundings' light -------------------------------------------------
assert.ok(
  near(r.ambient.on, r.ambient.off, 0.01, 0),
  `a flat ambient light is reflected as it was (${r.ambient.off} -> ${r.ambient.on})`,
);

// ---- Smooth balls -------------------------------------------------------------
for (const [name, s] of Object.entries(r.smooth)) {
  const t = s.truth;
  // Measured unclipped: the peak of the highlight against the truth's.
  assert.ok(
    Math.abs(s.on.peak - t.peak) <= Math.abs(s.off.peak - t.peak) + t.peak * 0.02,
    `smooth ${name}: the peak is nearer the truth's ${t.peak} (${s.off.peak} -> ${s.on.peak})`,
  );
  // As much light as the truth, and the same from frame to frame.
  assert.ok(
    Math.abs(s.on.sum / t.sum - 1) <= 0.15,
    `smooth ${name}: as much light as the truth within 15 % (${t.sum}; ${s.off.sum} -> ${s.on.sum})`,
  );
  assert.ok(
    (s.on.sumHigh - s.on.sumLow) / s.on.sum <= 0.1,
    `smooth ${name}: the highlight does not come and go (${s.on.sumLow}..${s.on.sumHigh}; unpatched ${s.off.sumLow}..${s.off.sumHigh})`,
  );
  // Under the game's sun: the clipped highlight is the size of the truth's.
  assert.ok(
    Math.abs(s.game.on.size - t.gameSize) <= Math.max(4, t.gameSize * 0.15),
    `smooth ${name}: the highlight as large as the truth's ${t.gameSize} pixels (${s.game.off.size} -> ${s.game.on.size})`,
  );
  // No line along the silhouette: the rim is never brighter than unpatched.
  assert.ok(
    s.game.on.rim.max <= s.game.off.rim.max + 2 && s.game.on.rim.over16 <= s.game.off.rim.over16,
    `smooth ${name}: no brighter rim (${JSON.stringify(s.game.off.rim)} -> ${JSON.stringify(s.game.on.rim)}, truth ${t.gameRimMax})`,
  );
  // A highlight several pixels wide looks as it did.
  const wide = s.roughness >= (s.radius > 40 ? 0.2 : 0.4);
  if (wide)
    assert.ok(
      s.game.diff <= 0.5 && s.game.maxDiff <= 16,
      `smooth ${name}: a highlight wider than a pixel looks as it did (mean change ${s.game.diff}, at most ${s.game.maxDiff})`,
    );
  summary.push(
    `smooth ${name}: peak ${s.off.peak}->${s.on.peak} (truth ${t.peak}), size ${s.game.off.size}->${s.game.on.size} (truth ${t.gameSize}), at most ${s.game.maxDiff} levels changed`,
  );
}

// ---- Left alone ----------------------------------------------------------------
for (const finish of ['metal', 'painted']) {
  const c = r[`close-${finish}`];
  assert.ok(
    c.diff < 0.2 && c.changedPixels <= c.measured * 0.001,
    `close up, the ${finish} bumps keep their highlights (${JSON.stringify(c)})`,
  );
}
assert.ok(
  r.noStrength.maxDiff <= 1,
  `a map at no strength widens nothing (${JSON.stringify(r.noStrength)})`,
);
assert.ok(
  r.noTangents.maxDiff <= 1 && r.noTangents.lit > 5,
  `a map on a mesh without tangents widens nothing (${JSON.stringify(r.noTangents)})`,
);
assert.ok(r.cutout.mean > 5, `an alpha-tested ball is drawn (${r.cutout.mean})`);
assert.deepEqual(r.toggle, { off: false, offHasDefine: false, on: true, onHasDefine: true });
assert.match(r.invalid, /Scene3D/, 'something that is not a scene is refused');
console.log(
  `PASS specular anti-aliasing on ${report.renderer} (${drewWith}):\n  ` + summary.join('\n  '),
);
