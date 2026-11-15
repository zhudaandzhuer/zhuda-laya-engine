#!/usr/bin/env node
// Real-GPU check of spring bones, through the browser SDK: a head that
// sways with a tail of six bones behind it, lying against a body that goes
// with the head, and a ribbon that points sideways at rest. From the nodes
// themselves: every bone keeps its length, every joint is where the solver
// has it, no joint is inside the body in any frame; the tail trails the head
// and comes back to where it hung; a paused layer, a five-second delta, the
// same run twice, the springs called from LayaAir's frame after its
// animation, thirty made and destroyed.
// Desktop GPU evidence only (WebGL, or WebGPU with SPRING_BONES_RENDERER).
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
  process.env.SPRING_BONES_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-spring-bones'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// SPRING_BONES_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild =
  (process.env.SPRING_BONES_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 360;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/spring-bones.ts')],
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
        'window.__SPRINGS__ && (window.__SPRINGS__.ready || window.__SPRINGS__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Named by the backend the page ran on.
  const gpu = await browser.evaluate(gpuLabelExpression(gpuBuild));
  report = {
    gpu,
    ...(await browser.evaluate('window.__SPRINGS__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__SPRINGS__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__SPRINGS__.picture('${name}')`).catch(() => null);
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
if (process.env.SPRING_BONES_EXPLORE) {
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
const { swing, hooked, cycles } = report;
const under = (value, limit, what) =>
  assert.ok(value < limit, `${what}: ${value} (under ${limit})`);

// 1. A tail of six bones and a ribbon of four on a head that sways.
assert.equal(swing.inside, 0, 'no joint inside the body in any frame');
under(swing.bonesOffTheirLength, 1e-4, 'a bone off its length, metres');
under(swing.jointsOffTheSolver, 1e-4, 'a joint off where the solver has it, metres');
// At rest the tail lies against the body (its joints are kept 3 cm outside it)...
under(swing.rest.energy, 1e-6, 'it hangs still first');
assert.ok(
  swing.rest.nearestToBody > 0.0299 && swing.rest.nearestToBody < 0.04,
  `the tail lies on the body (${swing.rest.nearestToBody} m from its skin)`,
);
// ...and the ribbon, which points sideways at rest, droops and still points outward.
assert.ok(
  swing.rest.ribbonTip[0] > 0.3 && swing.rest.ribbonTip[1] < 1.58,
  `the ribbon droops from where it points (${swing.rest.ribbonTip})`,
);
// The head sways: the tail swings behind it, not carried like a stick.
assert.ok(
  swing.sway.tipOffWhereAStickWouldBe > 0.05 && swing.sway.tipOffWhereAStickWouldBe < 0.7,
  `the tip swings away from where a stick's would be (${swing.sway.tipOffWhereAStickWouldBe})`,
);
// The layer paused: no step, the same joints. Five seconds in one delta: the cap, the rest dropped.
assert.deepEqual(swing.paused, { steps: 0, sameJoints: true });
assert.deepEqual(swing.gap, { steps: 8, dropped: 592 });
assert.deepEqual([swing.steps, swing.dropped], [(300 + 288 + 600) * 2 + 8, 592]);
// The head back where it began: the tail comes back to where it hung.
under(swing.settled.tipFromRest, 0.005, 'the tip from where it hung, metres');
under(swing.settled.energy, 1e-6, 'at rest again');
assert.equal(swing.again.sameJoints, true, 'the same run twice is the same joints');
assert.equal(swing.again.pixelsThatDiffer, 0, 'and the same picture');

// 2. Called from LayaAir's frame, after its animation.
assert.equal(hooked.steps, 60 * 2, 'two steps a frame of a sixtieth');
assert.equal(hooked.afterStop, 0, 'stopped, it is called no more');
assert.ok(hooked.tipMoved > 0.02, `the tail followed the head (${hooked.tipMoved})`);
assert.equal(hooked.inside, 0);

// 3. Thirty made and destroyed.
assert.equal(cycles.leftAfterEach.length, 30);
assert.equal(cycles.most, 0, `nothing left after any of them (${cycles.leftAfterEach})`);
assert.deepEqual(report.left, { swing: 0, hooked: 0, cycles: 0 }, 'nothing left behind');

console.log(
  `PASS spring bones on ${report.renderer} (${report.gpu}): no joint inside the body in ${swing.steps} steps, ` +
    `bones within ${swing.bonesOffTheirLength} m of their length, joints within ${swing.jointsOffTheSolver} m of the solver; ` +
    `the tail lies ${swing.rest.nearestToBody} m from the body's skin, swings ${swing.sway.tipOffWhereAStickWouldBe} m off where a stick would be ` +
    `and comes back within ${swing.settled.tipFromRest} m of where it hung; nothing moved while paused, a five-second delta ` +
    `${swing.gap.steps} steps and ${swing.gap.dropped} dropped; the same joints and picture twice (${swing.joints}); ` +
    `${hooked.steps} steps from LayaAir's frame; thirty made and destroyed, nothing left; evidence in ${path.join(out, 'evidence')}`,
);
