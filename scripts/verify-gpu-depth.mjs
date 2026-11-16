#!/usr/bin/env node
// Real-GPU check of the GPU depth work, through the browser SDK: a compute
// step for many particles against the same step in JavaScript, drawn without
// a read back (and the JavaScript step where there is no compute); a
// shader's integer, matrix, array and cube-map uniforms and the common
// functions; screen reflections that read each surface's normal and
// roughness; a moving thing under temporal anti-aliasing with and without
// its velocity.
// Desktop GPU evidence only (WebGL, or WebGPU with GPU_DEPTH_RENDERER).
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
  process.env.GPU_DEPTH_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-gpu-depth'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// GPU_DEPTH_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.GPU_DEPTH_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 320,
  H = 200;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/gpu-depth.ts')],
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
    if (await browser.evaluate('window.__GPU__ && (window.__GPU__.ready || window.__GPU__.error)'))
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Named by the backend the page ran on.
  const gpu = await browser.evaluate(gpuLabelExpression(gpuBuild));
  report = {
    gpu,
    ...(await browser.evaluate('window.__GPU__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__GPU__.pictures()').catch(() => [])) ?? []) {
    const url = await browser.evaluate(`window.__GPU__.picture('${name}')`).catch(() => null);
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
if (process.env.GPU_DEPTH_EXPLORE) {
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
const near = (value, want, tolerance, what) =>
  assert.ok(Math.abs(value - want) <= tolerance, `${what}: ${value} (want ${want} ± ${tolerance})`);

// 1. A compute step: on the GPU where there is compute, the JavaScript step where there is not.
const compute = report.compute;
assert.equal(compute.supported, gpuBuild);
assert.equal(compute.backend, gpuBuild ? 'webgpu' : 'cpu');
assert.equal(
  compute.withoutStep,
  gpuBuild ? 'made' : 'COMPUTE_UNAVAILABLE',
  'a pass without a JavaScript step is refused where there is no compute',
);
assert.ok(
  compute.worst < 1e-3,
  `sixty steps of ${compute.particles} particles agree with JavaScript (${compute.worst})`,
);
assert.equal(compute.wrongPlaces, 0, 'the places a draw reads are where the particles are');
assert.equal(compute.litBefore, 0);
assert.ok(compute.lit > 5000, `the particles are drawn (${compute.lit} pixels)`);
assert.ok(compute.changedAfterMoreSteps > 2000, 'more steps move what is drawn');
assert.equal(compute.litAfterDispose, 0, 'disposed, nothing is drawn');
assert.equal(compute.counts.kind, 'Uint32Array');
assert.equal(compute.counts.wrong, 0, 'whole numbers, from a buffer that is only read');
assert.deepEqual(compute.counts.partly, [9 * 7 + 5, 10 * 7 + 1000], 'ten indices, the rest left');
if (gpuBuild) {
  const million = compute.timing.at(-1);
  // The step leaves the CPU at once, and the GPU does a million faster than JavaScript does.
  assert.ok(million.callMs < 1, `a dispatch returns at once (${million.callMs} ms)`);
  assert.ok(
    million.doneMs < million.javascriptMs / 2,
    `a million particles: ${million.doneMs} ms on the GPU, ${million.javascriptMs} ms in JavaScript`,
  );
}

// 2. Uniform types and the common functions, against the arithmetic.
const uniforms = report.uniforms;
for (const [name, want] of Object.entries(uniforms.expected))
  want.forEach((value, i) => near(uniforms.read[name][i], value, 0.02, `${name}[${i}]`));
[0.9, 0.1, 0.4].forEach((value, i) => near(uniforms.changed[i], value, 0.02, 'an array set again'));
near(uniforms.hash.mean, 0.5, 0.08, 'the hash is even');
assert.ok(uniforms.hash.min < 0.05 && uniforms.hash.max > 0.95);
assert.ok(
  uniforms.hash.againstJavaScript < 0.05,
  `sorted, the drawn hash is the JavaScript one (${uniforms.hash.againstJavaScript})`,
);
for (const [name, stats] of Object.entries(uniforms.noise)) {
  assert.ok(stats.min >= 0 && stats.max <= 1 && stats.max - stats.min > 0.2, `${name} varies`);
  assert.ok(stats.step < 0.04, `${name} is smooth from pixel to pixel (${stats.step})`);
}

// 3. Reflections: alike without the surface pictures, each by its own surface with them.
const mirror = report.reflections;
assert.equal(mirror.installed, true, 'the glTF shader writes the surface pictures');
assert.equal(mirror.modelShader, 'glTFPBR');
const shots = mirror.shots;
assert.ok(shots.alike.rough > shots.none.rough + 60, 'the wall is mirrored in the floor');
// No bands across the mirrored wall: rays that started behind the floor (the
// depth read at a corner of four depth pixels, which GPUs resolve differently)
// missed every few rows on Apple and Intel WebGPU (46 before GFX-02, 1 after).
for (const key of ['alike', 'surfaces', 'surfacesWet'])
  assert.ok(shots[key].bands < 12, `${key}: no bands across the reflection (${shots[key].bands})`);

near(shots.alike.rough, shots.alike.smooth, 6, 'without them, rough and smooth reflect alike');
near(shots.alike.model, shots.alike.rough, 6, 'and so does the glTF material');
assert.ok(shots.surfaces.smooth > shots.surfaces.rough + 40, 'with them, smooth reflects more');
assert.ok(shots.surfaces.rough < shots.alike.rough - 20, 'and rough less than before');
near(shots.surfaces.model, shots.surfaces.rough, 6, 'the glTF material is read as the PBR one');
// Water polishes: at full wetness the three reflect alike again, and more.
near(shots.surfacesWet.rough, shots.surfacesWet.smooth, 6, 'wet, rough is as smooth as smooth');
// "More" is measured where it cannot clip (GFX-02 of
// docs/plans/records/windows-acceptance/plan.md): the reflected wall is red
// and green enough that both saturate the 8-bit picture wet or not, so the
// blue channel as light, above what the floor shows with no reflection.
// Water raises the head-on reflection from 0.145 (wetness 0.5) to 0.27; at
// this grazing view the rest of the Fresnel term is shared, which leaves
// wet about 1.14 times the unwet reflection on every GPU measured. The same
// measure on the smooth strip at half wetness (1.02) must not pass for wet.
const added = (shot) => shot.blue.rough - shots.none.blue.rough;
const wetter = added(shots.surfacesWet) / added(shots.alike);
assert.ok(wetter > 1.08, `wet, rough reflects more than unwet (${wetter.toFixed(3)} times)`);
const notWetter = (shots.surfaces.blue.smooth - shots.none.blue.rough) / added(shots.alike);
assert.ok(notWetter < 1.05, `half wet is not taken for wet (${notWetter.toFixed(3)} times)`);
for (const key of ['rough', 'smooth', 'model']) {
  near(shots.liveOn[key], shots.surfaces[key], 2, `switched on while it runs: ${key}`);
  near(shots.liveOffAgain[key], shots.alike[key], 2, `and off again: ${key}`);
}

// 4. A moving thing: smeared as LayaAir writes it, sharp with its own velocity.
const motion = report.motion;
assert.equal(motion.installed, true);
assert.equal(motion.still.body, 0, 'standing still, the stripes are as without smoothing');
assert.ok(motion.untracked.body > 30, `moving, they smear (${motion.untracked.body} of 255)`);
assert.ok(motion.tracked.body < 3, `tracked, they do not (${motion.tracked.body})`);
assert.ok(
  motion.tracked.trail < 3 && motion.untracked.trail < 3,
  'no trail on the wall either way',
);
assert.ok(motion.untrackedAgain.body > 30, 'let go of, as before');

// Nothing left behind but what LayaAir keeps: the camera's group of surface
// pictures (two) from the first frame that asked for them.
assert.deepEqual([report.left.compute, report.left.uniforms], [0, 0], JSON.stringify(report.left));
assert.ok(report.left.reflections <= 2, JSON.stringify(report.left));
assert.equal(report.left.motion, report.left.reflections);

const t = compute.timing.at(-1);
console.log(
  `PASS GPU depth on ${report.renderer} (${report.gpu}): compute on ${compute.backend}, ` +
    `a million particles ${t.doneMs} ms a step (JavaScript ${t.javascriptMs}); ` +
    `reflections rough ${shots.surfaces.rough} / smooth ${shots.surfaces.smooth} (alike ${shots.alike.rough}); ` +
    `a moving thing off by ${motion.untracked.body} untracked, ${motion.tracked.body} tracked; ` +
    `evidence in ${path.join(out, 'evidence')}`,
);
