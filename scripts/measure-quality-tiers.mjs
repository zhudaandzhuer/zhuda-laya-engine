#!/usr/bin/env node
// What frame rate each look level gives on a device (tests/fixtures/quality-tiers.ts):
// a small town on grass under a game's look, from two views, at look levels
// 3 to 0, on the device's own screen. A measurement, not a check: it exits 0
// whatever the numbers are, and non-zero only when the page failed.
//
//   node scripts/measure-quality-tiers.mjs [outDir]                       this machine, headless Chrome, 1920x1080
//   ZHUDA_PHONE_CHROME=http://127.0.0.1:9333 node scripts/measure-quality-tiers.mjs [outDir]
//                                                                         an Android phone's Chrome (docs/agent-development.md)
//   TIERS_LAN=<this machine's address> node scripts/measure-quality-tiers.mjs [outDir]
//                                                                         serves on the network and waits for a browser
//                                                                         opened by hand (an iPhone's Safari) to send its report
//
// TIERS_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) measures the WebGPU
// build. TIERS_ROUNDS=3 measures each step that many times and reports the
// medians. TIERS_TOWN=instanced draws the houses as instanced copies instead of a
// node each. TIERS_PROFILE=1@0.7 measures one step from the street with parts of
// the look and the scene taken away one at a time, twice each. TIERS_STEPS=3@1,1@0.7 lists look levels at render scales (default the
// four levels at full size). TIERS_DPR caps the device pixel ratio (default 2). TIERS_VIEW=WxH
// sets the headless view. The owner's bands (2026-11-20), by frames a second
// as the browser paces them: 60 and over, 45 to 60, 10 to 45, under 10.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'zhuda-quality-tiers'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const gpuBuild = (process.env.TIERS_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const lan = process.env.TIERS_LAN;
const phone = Boolean(process.env.ZHUDA_PHONE_CHROME);
const dpr = Number(process.env.TIERS_DPR) || 2;
const steps = process.env.TIERS_PROFILE
  ? `&profile=${process.env.TIERS_PROFILE}`
  : process.env.TIERS_STEPS
    ? `&steps=${process.env.TIERS_STEPS}`
    : '';
const town =
  (process.env.TIERS_TOWN ? `&town=${process.env.TIERS_TOWN}` : '') +
  (process.env.TIERS_ROUNDS ? `&rounds=${process.env.TIERS_ROUNDS}` : '') +
  (process.env.TIERS_EXTRA ? `&${process.env.TIERS_EXTRA}` : '');
const [viewW, viewH] = (process.env.TIERS_VIEW || '1920x1080').split('x').map(Number);

await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/quality-tiers.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'tiers.html'),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">` +
    `<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#view{width:100vw;height:100vh}</style>` +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);

let posted;
const gotPost = new Promise((resolve) => (posted = resolve));
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  if (request.method === 'POST' && url.pathname === '/report') {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      response.writeHead(204).end();
      posted(JSON.parse(body));
    });
    return;
  }
  const file = path.resolve(web, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return response.writeHead(404).end();
  response.writeHead(200, {
    'Content-Type': file.endsWith('.html')
      ? 'text/html'
      : file.endsWith('.wasm')
        ? 'application/wasm'
        : 'text/javascript',
    'Cache-Control': 'no-store',
  });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) =>
  server.listen(Number(process.env.TIERS_PORT) || 0, lan ? '0.0.0.0' : '127.0.0.1', resolve),
);
const port = server.address().port;

/** The owner's tiers (ZHUDA_FRAME_TIERS), as the bands of frames a second they are. */
const BANDS = { low: '60+ (low)', high: '45-60 (high)', extreme: '10-45 (extreme)' };

let report;
let browser;
try {
  if (lan) {
    const url = `http://${lan}:${port}/tiers.html?run=1&dpr=${dpr}${steps}${town}&post=/report`;
    console.error(`open on the device: ${url}`);
    fs.writeFileSync(path.join(out, 'url.txt'), url + '\n');
    report = await gotPost;
  } else {
    browser = await chromeFixture();
    if (!phone)
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width: viewW,
        height: viewH,
        deviceScaleFactor: 1,
        mobile: false,
      });
    await browser.send('Page.navigate', {
      url: `http://127.0.0.1:${port}/tiers.html?run=1&dpr=${dpr}${steps}${town}`,
    });
    for (let i = 0; i < 3000; i++) {
      const done = await browser.evaluate('window.__TIERS__?.done === true').catch(() => false);
      if (done) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const page = JSON.parse(
      await browser.evaluate(
        'JSON.stringify({report: window.__TIERS__.report, errors: window.__TIERS__.errors, progress: window.__TIERS__.progress})',
      ),
    );
    assert.ok(page.report, `the page did not finish (${page.progress}): ${page.errors.join('\n')}`);
    report = page.report;
    await browser.screenshot(path.join(out, 'last-frame.png')).catch(() => {});
  }
  assert.ok(report.rows, `the page failed: ${(report.errors || []).join('\n')}`);
  for (const row of report.rows) row.band = BANDS[row.tier] ?? 'under 10';
  report.where = lan
    ? 'opened by hand over the network'
    : phone
      ? 'phone Chrome'
      : 'headless Chrome';
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    `${report.renderer}  ${report.backing.join('x')} backing (css ${report.cssSize.join('x')}, dpr ${report.devicePixelRatio}, cap ${report.dprCap})  ${report.where}  town: ${report.town}`,
  );
  for (const row of report.rows)
    console.log(
      `${(row.variant ? `${row.variant} #${row.round}` : row.view).padEnd(row.variant ? 64 : 7)} level ${row.level} at ${String(row.scale).padEnd(4)}  ${String(row.fps).padStart(6)} fps  p95 gap ${String(row.p95GapMs).padStart(6)} ms  back to back ${String(row.msBackToBack).padStart(7)} ms (issued in ${String(row.msIssued).padStart(6)})  ${row.draws == null ? '' : `${String(row.draws).padStart(5)} draws ${String(row.targets).padStart(3)} targets  `}${row.band}`,
    );
  assert.deepEqual(report.errors, [], 'no page errors');
} finally {
  await browser?.close();
  server.close();
}
