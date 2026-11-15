#!/usr/bin/env node
// Real-GPU check of cloth, through the browser SDK: a sheet dropped over a
// ball, a rod and a body given as a table of radii, onto a floor; a sheet
// hung by two corners in front of a body, taken by a hand, pulled within
// reach, pressed against the body, carried round it and let go, with the
// clock's layer paused and a five-second delta on the way; a skirt pinned to
// a body that sways; cloths made and destroyed thirty times. Counted from
// the solver: no particle inside a body in any frame. From the pictures: no
// body seen through the cloth, and a second run is the same picture.
// Desktop GPU evidence only (WebGL, or WebGPU with CLOTH_RENDERER).
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
const out = path.resolve(process.env.CLOTH_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-cloth'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// CLOTH_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.CLOTH_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 360;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/cloth.ts')],
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
    if (
      await browser.evaluate(
        'window.__CLOTH__ && (window.__CLOTH__.ready || window.__CLOTH__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Named by the backend the page ran on.
  const gpu = await browser.evaluate(gpuLabelExpression(gpuBuild));
  report = {
    gpu,
    ...(await browser.evaluate('window.__CLOTH__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__CLOTH__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__CLOTH__.picture('${name}')`).catch(() => null);
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
if (process.env.CLOTH_EXPLORE) {
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
const { drape, hang, skirt, cycles } = report;
const under = (value, limit, what) =>
  assert.ok(value < limit, `${what}: ${value} (under ${limit})`);

// 1. A sheet of 41 by 41 dropped over a ball, a rod and a table of radii,
// onto a floor. Counted from the solver after every frame: no particle
// inside a body grown by the cloth's thickness, and none inside a body
// itself. From the picture, straight above: the bodies are there before the
// cloth (red), and not one of their pixels is seen once it lies on them.
assert.equal(drape.steps, 480 * 4, 'four steps a frame of a sixtieth');
assert.equal(drape.inside, 0, 'no particle inside a body in any frame');
assert.equal(drape.insideBare, 0);
assert.ok(drape.bodyPixelsBare > 5000, `the bodies are drawn (${drape.bodyPixelsBare})`);
assert.equal(drape.bodyPixelsFromAbove, 0, 'no body is seen through the cloth');
assert.ok(drape.clothPixelsFromAbove > 15000, `the cloth is (${drape.clothPixelsFromAbove})`);
assert.ok(drape.lowest >= 0.0099, `it lies on the floor, a thickness above it (${drape.lowest})`);
under(drape.energy, 1e-3, 'it has come to rest');
under(drape.mostStretch, 0.2, 'stretched while it falls');
under(drape.endStretch, 0.15, 'stretched as it lies');
// The same again is the same cloth and the same picture.
assert.equal(drape.again.samePositions, true, `${drape.again.positions} and ${drape.positions}`);
assert.equal(drape.again.pixelsThatDiffer, 0);

// 2. A sheet of 25 by 25 hung by its two top corners in front of a body. A
// hand takes the middle of its hem.
assert.equal(hang.inside, 0, 'no particle inside a body in any frame');
under(hang.rest.energy, 1e-3, 'it hangs still first');
under(hang.rest.stretch, 0.1, 'stretched as it hangs');
under(hang.rest.mostStretch, 0.3, 'stretched while it falls into place');
// Within reach: the hand is where it was asked to be, the particle within the hand's slack of it.
under(hang.front.handFromTarget, 1e-3, 'the hand is where it was asked to be');
assert.ok(
  hang.front.particleFromHand <= hang.front.slack + 1e-5,
  `the particle is at the hand (${hang.front.particleFromHand}, slack ${hang.front.slack})`,
);
// Asked for the middle of the body: the particle is stopped at the body's
// skin, a thickness clear of it and no farther.
assert.ok(
  hang.pressed.depthInBody <= -(hang.pressed.thickness - 1e-4),
  `a thickness clear of the body (${hang.pressed.depthInBody})`,
);
assert.ok(
  hang.pressed.fromAxis - hang.pressed.skin < hang.pressed.thickness + 0.003,
  `and pressed against it (${hang.pressed.fromAxis} from the axis, skin ${hang.pressed.skin})`,
);
// The clock's layer paused for 45 frames: no step, the same bytes, the same picture.
assert.deepEqual(hang.paused, { steps: 0, samePositions: true, pixelsThatDiffer: 0 });
// Five seconds in one delta: the cap of eight steps, the other 1192 dropped, and no harm.
assert.deepEqual([hang.gap.steps, hang.gap.dropped, hang.gap.inside], [8, 1192, 0]);
under(hang.gap.stretch, 0.15, 'stretched after the gap');
assert.deepEqual([hang.steps, hang.dropped], [1614 * 4 + 8, 1192]);
under(hang.mostStretchInHand, 0.15, 'stretched in the hand');
// Let go: it moves, then comes to rest near where it hung.
assert.ok(hang.released.energy > 0.1, `it swings when it is let go (${hang.released.energy})`);
under(hang.settled.energy, 1e-4, 'and comes to rest');
under(hang.settled.stretch, 0.1, 'stretched at the end');
under(hang.settled.farthestFromRest, 0.15, 'metres from where it hung');
assert.equal(hang.again.samePositions, true, `${hang.again.positions} and ${hang.positions}`);
assert.equal(hang.again.pixelsThatDiffer, 0);

// 3. A skirt pinned by its waist to a body that sways 35 cm each way: the
// body's table and legs and the waist's pins are moved every frame.
assert.equal(skirt.inside, 0, 'no particle inside the moving body in any frame');
assert.equal(skirt.pinned, 36);
under(skirt.rest.stretch, 0.08, 'stretched as it hangs');
under(skirt.mostStretch, 0.12, 'stretched as it sways');
for (const [way, behind] of Object.entries(skirt.sway))
  assert.ok(behind > 0.05 && behind < 0.3, `${way}: the hem trails the waist (${behind})`);
under(Math.abs(skirt.stopped.hem), 0.01, 'the hem under the waist again');
under(skirt.stopped.energy, 1e-4, 'at rest again');

// 4. Thirty cloths made, drawn and destroyed, each with its material.
assert.equal(cycles.leftAfterEach.length, 30);
assert.equal(cycles.most, 0, `nothing left after any of them (${cycles.leftAfterEach})`);
assert.deepEqual(report.left, { drape: 0, hang: 0, skirt: 0, cycles: 0 }, 'nothing left behind');

console.log(
  `PASS cloth on ${report.renderer} (${report.gpu}): dropped over a ball, a rod and a table, ` +
    `${drape.particles} particles, no particle inside a body in ${drape.steps} steps and no body pixel ` +
    `seen from above (${drape.bodyPixelsBare} before), stretched ${drape.mostStretch} at most and ` +
    `${drape.endStretch} at rest, the same bytes and picture twice (${drape.positions}), ` +
    `${drape.msPerFrame} ms a frame; hung by two corners, stretched ${hang.rest.stretch} as it hangs ` +
    `(${hang.rest.mostStretch} while it falls), the hand at its target and the particle ` +
    `${hang.front.particleFromHand} m from it, stopped ${-hang.pressed.depthInBody} m clear of the body, ` +
    `nothing moved while paused, a five-second delta ${hang.gap.steps} steps and ${hang.gap.dropped} dropped, ` +
    `${hang.mostStretchInHand} stretched in the hand, at rest ${hang.settled.farthestFromRest} m from where ` +
    `it hung, twice the same (${hang.positions}); a skirt on a swaying body, the hem ` +
    `${skirt.sway.hemBehindGoingRight} m behind, stretched ${skirt.mostStretch}, ${skirt.msPerFrame} ms a frame; ` +
    `thirty made and destroyed, nothing left; evidence in ${path.join(out, 'evidence')}`,
);
