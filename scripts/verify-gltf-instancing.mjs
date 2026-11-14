#!/usr/bin/env node
// Real-GPU check of the rest of the glTF intake, through the browser SDK: a
// model whose file draws one mesh twelve times (EXT_mesh_gpu_instancing),
// mounted once, moved, as clones and as instanced copies, against the same
// crates put there one node at a time; a plate whose occlusion and emissive
// textures are laid out on the second set of texture coordinates; and
// Meshopt decoded in workers to the same bytes.
// Desktop GPU evidence only (WebGL, or WebGPU with GLTF_INSTANCING_RENDERER).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { gpuLabelExpression } from './lib/gpu-label.mjs';
import sharp from 'sharp';
import { instancedYard, twoSetPlate, YARD } from '../tests/fixtures/gltf-instancing.mjs';
import { quantizedTorus, testPicture } from '../tests/fixtures/gltf-intake.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.GLTF_INSTANCING_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-gltf-instancing'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// GLTF_INSTANCING_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild =
  (process.env.GLTF_INSTANCING_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 320;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/gltf-instancing.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
// The files, made here.
const halves = (left, right) => {
  const size = 64,
    pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      pixels.set([...(x < size / 2 ? left : right), 255], (y * size + x) * 4);
  return sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
};
// Occlusion: the left half of the picture takes all the room's light away.
// Emission: the left half glows red, the right half green.
const occlusionPng = await halves([0, 0, 0], [255, 255, 255]),
  emissivePng = await halves([255, 0, 0], [0, 255, 0]);
const picture = testPicture(64);
const ring = await quantizedTorus(
  await sharp(picture.pixels, {
    raw: { width: picture.width, height: picture.height, channels: 4 },
  })
    .png()
    .toBuffer(),
);
const files = {
  'yard.glb': instancedYard(),
  'yard-short.glb': instancedYard({ rotation: 'short' }),
  'yard-mirror.glb': instancedYard({ mirror: 3 }),
  'yard.json': Buffer.from(JSON.stringify(YARD)),
  'plate-first.glb': twoSetPlate({ occlusionPng, emissivePng, texCoord: 0 }),
  'plate-second.glb': twoSetPlate({ occlusionPng, emissivePng, texCoord: 1 }),
  'ring-meshopt.glb': ring.quantized,
};
fs.mkdirSync(path.join(web, 'assets'), { recursive: true });
for (const [name, bytes] of Object.entries(files))
  fs.writeFileSync(path.join(web, 'assets', name), bytes);
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
        'window.__COPIES__ && (window.__COPIES__.ready || window.__COPIES__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Named by the backend the page ran on.
  const gpu = await browser.evaluate(gpuLabelExpression(gpuBuild));
  report = {
    gpu,
    ...(await browser.evaluate('window.__COPIES__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
    // LayaAir's loader warns of a texture that asks for another set of texture coordinates.
    uvWarnings: browser.consoleMessages.filter((m) => /uv channel/i.test(m)),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__COPIES__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__COPIES__.picture('${name}')`).catch(() => null);
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
if (process.env.GLTF_INSTANCING_EXPLORE) {
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
const { copies, secondSet, workers } = report;
const same = (difference, what) =>
  assert.ok(
    difference.mean < 0.05 && difference.over < 0.0005,
    `${what}: ${JSON.stringify(difference)}`,
  );

// 1. A mesh the file draws twelve times. The pictures to match are the same
// crates put there one node at a time, with their shadows.
assert.ok(
  copies.byHand.orange > 0.02,
  `twelve crates are in the picture (${copies.byHand.orange})`,
);
// LayaAir alone draws the mesh once, where the node is.
assert.ok(
  copies.layaAlone.orange < copies.byHand.orange / 8,
  `LayaAir alone draws one crate (${copies.layaAlone.orange})`,
);
assert.equal(copies.report.status, 'supported');
assert.deepEqual(copies.report.codes, []);
assert.deepEqual(copies.report.extensions, [
  { name: 'EXT_mesh_gpu_instancing', required: true, implemented: true },
]);
assert.deepEqual(copies.report.nodes, [['Crates', 12, 12]]);
same(copies.once.againstByHand, 'mounted once');
assert.ok(
  copies.once.groups.length >= 1 && copies.once.groups.length <= 4,
  'a draw a group, not a copy',
);
// The holder moved: the copies went with it.
same(copies.moved.againstByHand, 'moved with its holder');
assert.ok(copies.moved.againstBefore.over > 0.02, 'and are not where they were');
// Unmounted, the model is as LayaAir made it.
assert.equal(copies.unmounted.children, 0);
near(copies.unmounted.orange, copies.layaAlone.orange, 0.0005, 'unmounted');
// With a cull distance the node's own draw stays off while shown, and the copies go when it goes.
same(copies.cull.shown, 'shown within its distance');
assert.equal(copies.cull.culledOrange, 0, 'beyond its distance nothing of it is drawn');
// Two copies of the model: as clones, and drawn instanced.
same(copies.placed.againstByHand, 'two clones');
same(copies.instanced.againstByHand, 'two copies drawn instanced');
assert.deepEqual(copies.instanced.stats, { copies: 2, groups: 2, drawsPerPass: 4 });
assert.match(copies.instanced.levels, /levels and a cull distance are not offered/);
// Turns stored as normalized shorts are the same turns.
same(copies.shorts.againstByHand, 'turns as shorts');
// A copy turned inside out is left out and said.
assert.equal(copies.mirror.status, 'degraded');
assert.deepEqual(copies.mirror.codes, ['INSTANCES_MIRRORED']);
assert.equal(copies.mirror.copies, 11);
assert.ok(
  copies.mirror.orange < copies.byHand.orange && copies.mirror.againstByHand.over > 0.001,
  'one crate fewer',
);
// An instanced mesh by itself stays where it was drawn first unless asked to follow.
assert.deepEqual(copies.follow.notAsked, { mean: 0, over: 0 });
assert.ok(copies.follow.asked.over > 0.02, 'asked, it goes with its parent');

// 2. The second set of texture coordinates. The first set runs along x and
// the second along z: by the first the left half is the half without the
// room's light (red, its own glow), by the second the far half is.
assert.deepEqual(secondSet.status, { ready: true, reason: null });
assert.deepEqual(report.uvWarnings, [], "LayaAir's warning is not raised for a set that is read");
const red = (c) => c[0] > 240 && c[1] < 20 && c[2] < 20,
  lit = (c) => c[1] > 240 && c[0] > 150 && c[2] > 150;
for (const [name, dark] of [
  ['plate-first', ['leftFar', 'leftNear']],
  ['plate-second', ['leftFar', 'rightFar']],
]) {
  const plate = secondSet[name];
  assert.equal(plate.status, 'supported', name);
  assert.deepEqual(plate.codes, [], name);
  for (const [quarter, colour] of Object.entries(plate.quarters))
    assert.ok(dark.includes(quarter) ? red(colour) : lit(colour), `${name}, ${quarter}: ${colour}`);
}
// A model mounted as clones and let go of in one go leaves nothing.
assert.ok(secondSet.clones.loaded > 0);
assert.equal(secondSet.clones.left, 0, 'clones are destroyed at once');

// 3. Meshopt in workers: two were made, the file decodes to the same bytes,
// the model draws, and they are stopped with the decoder.
assert.deepEqual(workers.asked, { workers: 2, unavailable: null });
assert.equal(workers.made, 2);
assert.equal(workers.bytes.different, 0, 'the same bytes either way');
assert.ok(workers.bytes.decoded > workers.bytes.compressed);
assert.ok(workers.drawn.over > 0.05, 'the decoded ring is drawn');
assert.deepEqual(workers.afterDispose, { workers: 0, stopped: 2 });

assert.deepEqual(report.left, { copies: 0, secondSet: 0, workers: 0 }, 'nothing left behind');
console.log(
  `PASS glTF instancing on ${report.renderer} (${report.gpu}): twelve copies as by hand ` +
    `(${copies.once.groups.length} draws a pass), moved, as clones and instanced; a mirrored copy left out and said; ` +
    `occlusion and emission by the second set; Meshopt in 2 workers to the same ${workers.bytes.decoded} bytes ` +
    `(${workers.ms.callingThread} ms here, ${workers.ms.workers} ms there); evidence in ${path.join(out, 'evidence')}`,
);
