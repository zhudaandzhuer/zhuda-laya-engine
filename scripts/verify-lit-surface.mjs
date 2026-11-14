#!/usr/bin/env node
// Real-GPU check of what a lit surface's hook writes beyond its colour,
// through the browser SDK: a plate cut in strips by `alpha`, with its shadow
// and its depth cut the same way; a plate cut by chance (`alphaHash`), how
// much of it is kept, how dark its shadow is and that the pattern stays on
// it; a normal tilted by the hook on a mesh with tangents and on one without.
// Desktop GPU evidence only (WebGL, or WebGPU with LIT_SURFACE_RENDERER).
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
  process.env.LIT_SURFACE_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-lit-surface'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// LIT_SURFACE_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.LIT_SURFACE_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
// The post-process module is in the glTF profiles: the depth views of the fixture use it.
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 320,
  H = 240;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/lit-surface.ts')],
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
  for (let i = 0; i < 2400; i++) {
    if (await browser.evaluate('window.__LIT__ && (window.__LIT__.ready || window.__LIT__.error)'))
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Named by the backend the page ran on.
  const gpu = await browser.evaluate(gpuLabelExpression(gpuBuild));
  report = {
    gpu,
    ...(await browser.evaluate('window.__LIT__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__LIT__.pictures()').catch(() => [])) ?? []) {
    const url = await browser.evaluate(`window.__LIT__.picture('${name}')`).catch(() => null);
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
if (process.env.LIT_SURFACE_EXPLORE) {
  console.log(JSON.stringify(report, null, 1));
  process.exit(0);
}
assert.equal(report.error, undefined, report.error);
assert.equal(report.ready, true, 'the fixture finished');
assert.deepEqual(report.errors, [], 'no page errors');
assert.deepEqual(report.consoleErrors, [], 'no console errors');
assert.deepEqual(report.gpuWarnings, [], 'no shader or GPU warnings');
assert.deepEqual(report.rendererErrors, [], 'no renderer errors');
assert.equal(report.renderer, gpuBuild ? 'webgpu' : 'webgl');
const { strips, chance, tilted } = report;
const red = (c) => c[0] - c[1] > 100;
const grey = (c) => Math.abs(c[0] - c[1]) < 6 && Math.abs(c[1] - c[2]) < 6;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const near = (value, want, tolerance, what) =>
  assert.ok(Math.abs(value - want) <= tolerance, `${what}: ${value} (want ${want} ± ${tolerance})`);

// 1. Cut in strips by the hook's alpha. The plate is red where it is kept
// and the floor shows where it is not; the floor under a strip is in shadow
// and the floor under a gap is as light as the floor beside the plate.
assert.ok(red(strips.cut.kept), `a strip is drawn (${strips.cut.kept})`);
assert.ok(grey(strips.cut.hole), `the floor shows through a gap (${strips.cut.hole})`);
near(lum(strips.cut.hole), lum(strips.cut.aside), 4, 'the floor through the gap is lit');
assert.ok(
  lum(strips.cut.underKept) < lum(strips.cut.aside) * 0.5,
  `a strip casts its shadow (${strips.cut.underKept})`,
);
near(lum(strips.cut.underHole), lum(strips.cut.aside), 4, 'a gap casts none');
// The same plate drawn whole, for what it would be if the shadow pass did not ask the hook.
assert.ok(red(strips.whole.hole), 'whole: the middle is plate');
assert.ok(lum(strips.whole.underHole) < lum(strips.whole.aside) * 0.5, 'whole: and it casts');
// The depth the camera keeps (a view of it, 20 metres to white): the plate
// at a strip, the floor behind at a gap.
const shade = (metres) => (metres / 20) * 255;
near(strips.depth.cut.kept[0], shade(strips.eyeDepth.kept), 3, 'depth at a strip');
near(strips.depth.cut.hole[0], shade(strips.eyeDepth.behindHole), 3, 'depth at a gap');
near(strips.depth.whole.hole[0], shade(strips.eyeDepth.hole), 3, 'depth of the whole plate');
// The depth kept with the normals, in blue: a gap is the floor there too.
near(strips.normals.cut.kept[2], strips.normals.whole.kept[2], 1, 'depth-normal at a strip');
assert.ok(
  strips.normals.cut.hole[2] - strips.normals.whole.hole[2] > 20,
  `the depth-normal pass is cut too (${strips.normals.cut.hole} against ${strips.normals.whole.hole})`,
);

// 2. Cut by chance. About as much is kept as the alpha says, the shadow is
// as dark as that share, a frame drawn again is the same frame, and the
// pattern goes with the plate when the plate moves.
assert.equal(chance.shares[0], 0);
assert.equal(chance.shares[1], 1);
const alphas = Object.keys(chance.shares)
  .map(Number)
  .sort((a, b) => a - b);
let worstShare = 0,
  worstShadow = 0;
alphas.forEach((alpha, i) => {
  const share = chance.shares[alpha],
    dark = (chance.shadow[0] - chance.shadow[alpha]) / (chance.shadow[0] - chance.shadow[1]);
  near(share, alpha, 0.06, `kept at alpha ${alpha}`);
  near(dark, alpha, 0.07, `shadow at alpha ${alpha}`);
  worstShare = Math.max(worstShare, Math.abs(share - alpha));
  worstShadow = Math.max(worstShadow, Math.abs(dark - alpha));
  if (i) assert.ok(share >= chance.shares[alphas[i - 1]], 'more alpha keeps more');
});
assert.equal(chance.changedWhenStill, 0, 'the same frame again is the same picture');
assert.ok(
  chance.moved.sameWithThePlate > 0.97,
  `the pattern moves with the plate (${chance.moved.sameWithThePlate})`,
);
assert.ok(
  chance.moved.sameOnTheScreen < 0.75,
  `and does not stay on the screen (${chance.moved.sameOnTheScreen})`,
);

// 3. A normal tilted by the hook. The frame is LayaAir's: x along the
// texture's u (+x on this sheet), y along its v (+z), z out of the surface.
// The light a matt surface takes goes with the cosine to the sun.
const tilts = { alongU: [0.6, 0], againstU: [-0.6, 0], alongV: [0, 0.6], againstV: [0, -0.6] };
const worstTilt = { tangents: 0, bare: 0 };
for (const mesh of ['tangents', 'bare']) {
  near(
    tilted.light.flat[mesh],
    tilted.light.untouched[mesh],
    0.002,
    `${mesh}: (0, 0, 1) is no tilt`,
  );
  for (const [name, [x, y]] of Object.entries(tilts)) {
    const length = Math.hypot(x, y, 1);
    const cosine = (x * tilted.toSun[0] + tilted.toSun[1] + y * tilted.toSun[2]) / length;
    const want = cosine / tilted.toSun[1],
      got = tilted.light[name][mesh] / tilted.light.flat[mesh];
    near(got, want, 0.03, `${mesh}, ${name}`);
    worstTilt[mesh] = Math.max(worstTilt[mesh], Math.abs(got - want));
  }
}
for (const name of Object.keys(tilted.light))
  near(
    tilted.light[name].bare,
    tilted.light[name].tangents,
    0.002,
    `${name}: without tangents as with`,
  );
// The normal the camera keeps beside its colours.
for (const mesh of ['tangents', 'bare']) {
  assert.ok(
    Math.abs(tilted.normals.alongU[mesh][0] - tilted.normals.flat[mesh][0]) > 15,
    `${mesh}: a tilt along u is in the depth-normal picture`,
  );
  assert.ok(
    Math.abs(tilted.normals.alongV[mesh][1] - tilted.normals.flat[mesh][1]) > 15,
    `${mesh}: and one along v`,
  );
}
for (const name of Object.keys(tilted.normals))
  for (let k = 0; k < 3; k++)
    near(tilted.normals[name].bare[k], tilted.normals[name].tangents[k], 2, `${name} normal ${k}`);

// 4. The surface the documentation shows (noise from the common library
// eats a plate away, its edge glows, its normal is roughened): it compiles
// in all three passes, and its shadow goes as it goes.
const { dissolve } = report;
assert.deepEqual([dissolve[0].kept, dissolve[0].glowing], [1, 0], 'nothing gone: the whole plate');
assert.deepEqual([dissolve[1].kept, dissolve[1].glowing], [0, 0], 'all gone: no plate');
const half = dissolve[0.5];
assert.ok(half.kept > 0.1 && half.kept < 0.7, `half gone: some of it is left (${half.kept})`);
assert.ok(half.glowing > 0.02, `and its edge glows (${half.glowing})`);
near(dissolve[1].floor, chance.shadow[0], 0.005, 'all gone: the floor is lit');
near(dissolve[0].floor, chance.shadow[1], 0.005, 'nothing gone: the floor is in shadow');
const dark = (dissolve[1].floor - half.floor) / (dissolve[1].floor - dissolve[0].floor);
near(dark, half.kept + half.glowing, 0.08, 'half gone: the shadow is as much as is left');

assert.deepEqual(
  report.left,
  { strips: 0, chance: 0, tilted: 0, dissolve: 0 },
  'nothing left behind',
);
console.log(
  `PASS lit surface on ${report.renderer} (${report.gpu}): a gap shows the floor and casts no shadow; ` +
    `cut by chance within ${worstShare.toFixed(3)} of its alpha (shadow ${worstShadow.toFixed(3)}), ` +
    `the pattern ${chance.moved.sameWithThePlate} with the plate; a tilted normal within ` +
    `${worstTilt.tangents.toFixed(3)} of the cosine with tangents, ${worstTilt.bare.toFixed(3)} without; ` +
    `a dissolving plate ${half.kept} kept and ${half.glowing} glowing, its shadow ${dark.toFixed(3)}; ` +
    `evidence in ${path.join(out, 'evidence')}`,
);
