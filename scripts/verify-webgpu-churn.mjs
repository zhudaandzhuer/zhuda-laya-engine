#!/usr/bin/env node
// MEM-01 of docs/plans/records/windows-acceptance/plan.md: does content that
// is made, drawn and destroyed over and over leave renderer objects alive?
// One page per kind (2D: sprites with graphics and text; 3D: a scene with a
// camera, a light and two meshes with their own materials; batch: in one
// scene that stays, three boxes with a mesh and a material of their own
// each cycle, which WebGPU draws as one batch). After a warm-up
// block and after each following block of cycles the page is collected
// (HeapProfiler.collectGarbage) and live instances of the renderer's
// classes are counted (Runtime.queryObjects), with the JS heap in use.
// A count that keeps rising by the same amount every block is kept by
// something after its content was destroyed.
//
// CHURN_RENDERER=webgpu|webgl (default webgpu), CHURN_KINDS=2d,3d,batch,
// CHURN_CYCLES (per block, default 300), CHURN_BLOCKS (default 6),
// CHURN_WARMUP (default 300: shorter, the heap still settling reads as a
// leak, 1.6 KiB a cycle on 3D after 100), CHURN_OUT (evidence folder),
// CHURN_MAX_PER_CYCLE (default 0.02: the most a counted class may grow per
// cycle), CHURN_MAX_HEAP_KIB (default 1.5 KiB a cycle; 4.8 to 5.3 before the
// MEM-01 fixes on macOS). ZHUDA_PHONE_CHROME runs it on a phone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { gpuLabelExpression } from './lib/gpu-label.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const renderer = process.env.CHURN_RENDERER || 'webgpu';
if (!['webgpu', 'webgl'].includes(renderer)) throw Error('CHURN_RENDERER is webgpu or webgl');
const kinds = (process.env.CHURN_KINDS || '2d,3d,batch').split(',').filter(Boolean);
if (!kinds.length || kinds.some((k) => !['2d', '3d', 'batch'].includes(k)))
  throw Error('CHURN_KINDS lists 2d, 3d and/or batch');
const int = (name, fallback, max) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw Error(`${name} is a whole number 1..${max}`);
  return value;
};
const cycles = int('CHURN_CYCLES', 300, 100000),
  blocks = int('CHURN_BLOCKS', 6, 100),
  warmup = int('CHURN_WARMUP', 300, 100000);
const maxPerCycle = Number(process.env.CHURN_MAX_PER_CYCLE ?? 0.02),
  maxHeapKiB = Number(process.env.CHURN_MAX_HEAP_KIB ?? 1.5);
const out = path.resolve(
  process.env.CHURN_OUT || path.join(os.tmpdir(), 'zhuda-webgpu-churn-' + renderer),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const profile = renderer === 'webgpu' ? '3d-webgpu' : '3d';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/webgpu-churn.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'churn.html'),
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:640px;height:360px}</style>' +
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
        : 'text/javascript',
  });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

// Renderer classes LayaAir puts on its namespace; what a backend lacks is left out.
const CLASSES = [
  'WebGPUShaderData',
  'WebGPUSubUniformBuffer',
  'WebGPUBindGroup',
  'OneBatchMark',
  'ShaderData',
  'Sprite',
  'Sprite3D',
  'Material',
  'Mesh',
];

/** Live instances of each class and the heap in use, after two collections. */
async function census(browser) {
  await browser.send('HeapProfiler.collectGarbage');
  await browser.send('HeapProfiler.collectGarbage');
  const counts = {};
  for (const name of CLASSES) {
    const proto = await browser.send('Runtime.evaluate', {
      expression: `Laya.${name} && Laya.${name}.prototype`,
      objectGroup: 'churn',
    });
    if (!proto.result.objectId) continue;
    const found = await browser.send('Runtime.queryObjects', {
      prototypeObjectId: proto.result.objectId,
      objectGroup: 'churn',
    });
    const length = await browser.send('Runtime.callFunctionOn', {
      objectId: found.objects.objectId,
      functionDeclaration: 'function () { return this.length; }',
      returnByValue: true,
    });
    counts[name] = length.result.value;
  }
  await browser.send('Runtime.releaseObjectGroup', { objectGroup: 'churn' });
  const heap = await browser.send('Runtime.getHeapUsage');
  return { counts, heapMiB: +(heap.usedSize / 1048576).toFixed(3) };
}

const report = {
  renderer,
  kinds: {},
  cycles,
  blocks,
  warmup,
  maxPerCycle,
  maxHeapKiB,
  failures: [],
};
const browser = await chromeFixture();
try {
  await browser.send('HeapProfiler.enable');
  for (const kind of kinds) {
    await browser.send('Page.navigate', {
      url: `http://127.0.0.1:${server.address().port}/churn.html?kind=${kind}`,
    });
    await browser.waitFor('window.__CHURN__?.ready || window.__CHURN__?.errors.length', 60000);
    const errors = await browser.evaluate('__CHURN__.errors');
    if (errors.length) throw Error('Churn page failed: ' + errors.join('; '));
    if (!report.gpu) report.gpu = await browser.evaluate(gpuLabelExpression(renderer === 'webgpu'));
    const samples = [];
    const run = async (n) =>
      browser.evaluate(`__CHURN__.run(${JSON.stringify(kind)}, ${n})`, { timeoutMs: 1800000 });
    await run(warmup);
    samples.push({ cycles: warmup, ...(await census(browser)) });
    for (let b = 0; b < blocks; b++) {
      const started = Date.now();
      const done = await run(cycles);
      samples.push({ cycles: done, ms: Date.now() - started, ...(await census(browser)) });
      console.log(`${kind} ${done} cycles: ${JSON.stringify(samples.at(-1))}`);
    }
    // Caches LayaAir sweeps from time to time rise and fall; something kept
    // for good only rises. So the lowest count of the later half of the
    // samples is compared with the lowest of the earlier half.
    const half = Math.floor(samples.length / 2);
    const early = samples.slice(0, half + 1),
      late = samples.slice(half);
    const span =
      late.reduce((a, s) => a + s.cycles, 0) / late.length -
      early.reduce((a, s) => a + s.cycles, 0) / early.length;
    const low = (list, value) => Math.min(...list.map(value));
    const perCycle = Object.fromEntries(
      Object.keys(samples.at(-1).counts).map((name) => [
        name,
        +((low(late, (s) => s.counts[name]) - low(early, (s) => s.counts[name])) / span).toFixed(4),
      ]),
    );
    perCycle.heapKiB = +(
      ((low(late, (s) => s.heapMiB) - low(early, (s) => s.heapMiB)) * 1024) /
      span
    ).toFixed(3);
    report.kinds[kind] = { samples, perCycle };
    for (const [name, rate] of Object.entries(perCycle))
      if (name === 'heapKiB' ? rate > maxHeapKiB : rate > maxPerCycle)
        report.failures.push(`${kind}: ${name} +${rate} a cycle`);
    const pageErrors = await browser.evaluate('__CHURN__.errors');
    if (pageErrors.length) report.failures.push(`${kind}: page errors ${pageErrors.join('; ')}`);
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      gpu: report.gpu,
      perCycle: Object.fromEntries(Object.entries(report.kinds).map(([k, v]) => [k, v.perCycle])),
      failures: report.failures,
    },
    null,
    2,
  ),
);
console.log(
  (report.failures.length ? 'FAIL' : 'PASS') +
    ' churn ' +
    renderer +
    ': ' +
    path.join(out, 'report.json'),
);
if (report.failures.length) process.exitCode = 1;
