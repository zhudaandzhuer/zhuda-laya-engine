#!/usr/bin/env node
// Real Web Audio check of spatial samples (`playSample({ spatial })`,
// `setListener`, `setVoicePosition`) through the browser SDK, rendered by
// Chrome's OfflineAudioContext:
// - a source on the right is louder on the right, on the left louder on the
//   left, ahead even, with HRTF and with equal power;
// - turning the listener moves the source to the other ear, at once and
//   half way through a render;
// - distance falls as the distance model says; a cone turns a source down;
// - where a host has no PannerNode, the gain fallback places the voice as an
//   equal-power PannerNode would;
// - one context per adapter; a plain sample is not placed.
// Desktop Chrome rendering only: not speakers, headphones, phones or
// mini-game hosts, and not a listening test of how HRTF sounds.
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
  process.env.SPATIAL_AUDIO_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-spatial-audio'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
await buildBrowserSdk({ engineRoot, outDir: web, profiles: ['2d'] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/spatial-audio.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'audio.html'),
  '<!doctype html><meta charset="utf-8"><body><script src="zhuda-2d.js"></script><script src="page.js"></script></body>',
);
const server = http.createServer((request, response) => {
  const file = path.join(web, path.basename(new URL(request.url, 'http://x').pathname));
  if (!fs.existsSync(file)) return response.writeHead(404).end();
  response.writeHead(200, {
    'Content-Type': file.endsWith('.html') ? 'text/html' : 'text/javascript',
  });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

let report;
const browser = await chromeFixture();
try {
  report = { browser: await browser.evaluate('navigator.userAgent') };
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/audio.html`,
  });
  await browser.waitFor(
    'window.__SPATIAL__ && (window.__SPATIAL__.ready || window.__SPATIAL__.error)',
  );
  Object.assign(report, await browser.evaluate('window.__SPATIAL__'), {
    consoleErrors: browser.errors,
  });
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');
const s = report.spatial;
for (const model of ['HRTF', 'equalpower']) {
  const m = s[model];
  for (const result of Object.values(m)) {
    assert.equal(result.contexts, 1, `${model}: one AudioContext per adapter`);
    assert.equal(result.spatialBackend, 'panner');
    assert.equal(result.spatialVoices, 1);
    assert.ok(result.whole.left + result.whole.right > 0.01, `${model}: something is heard`);
  }
  // Balance is (R - L) / (R + L): +1 all right, -1 all left.
  const wide = model === 'HRTF' ? 0.3 : 0.95;
  assert.ok(m.right.whole.balance > wide, `${model}: right is right (${m.right.whole.balance})`);
  assert.ok(m.left.whole.balance < -wide, `${model}: left is left (${m.left.whole.balance})`);
  assert.ok(
    Math.abs(m.ahead.whole.balance) < 0.05,
    `${model}: ahead is even (${m.ahead.whole.balance})`,
  );
  assert.ok(Math.abs(m.turnedAhead.whole.balance) < 0.05, `${model}: turned, +X is ahead`);
  assert.ok(m.turnedLeft.whole.balance < -wide * 0.9, `${model}: turned, -Z is on the left`);
  assert.ok(m.moved.first.balance > 0.2 && m.moved.second.balance < -0.2, `${model}: moved across`);
  assert.ok(
    m.turning.first.balance > 0.2 && m.turning.second.balance < -0.2,
    `${model}: the listener turned round`,
  );
}
const d = s.distance;
const ratio = d.four.whole.left / d.one.whole.left;
assert.ok(Math.abs(ratio - 0.25) < 0.01, `inverse distance: a quarter at four times (${ratio})`);
const linear = d.linearHalf.whole.left / d.one.whole.left;
assert.ok(Math.abs(linear - 0.5) < 0.01, `linear distance: half way to silence (${linear})`);
const cone = d.coneAway.whole.left / d.one.whole.left;
assert.ok(Math.abs(cone - 0.2) < 0.01, `a source facing away is down to its outer gain (${cone})`);
for (const { position, panner, fallback } of s.fallback) {
  assert.equal(fallback.spatialBackend, 'gain');
  for (const side of ['left', 'right']) {
    const a = panner.whole[side],
      b = fallback.whole[side];
    assert.ok(
      Math.abs(a - b) <= 0.02 * Math.max(a, b) + 1e-4,
      `fallback at ${position} ${side}: ${b} against the panner's ${a}`,
    );
  }
}
assert.ok(
  s.fallbackMoved.first.balance > 0.2 && s.fallbackMoved.second.balance < -0.2,
  'the fallback moves too',
);
assert.equal(s.plain.spatialVoices, 0);
assert.ok(Math.abs(s.plain.whole.balance) < 0.01, 'a plain sample is not placed');
console.log(
  'PASS spatial audio: ' +
    JSON.stringify({
      HRTF: Object.fromEntries(Object.entries(s.HRTF).map(([k, v]) => [k, v.whole.balance])),
      equalpower: Object.fromEntries(
        Object.entries(s.equalpower).map(([k, v]) => [k, v.whole.balance]),
      ),
      inverseRatio: +ratio.toFixed(4),
      linear: +linear.toFixed(4),
      cone: +cone.toFixed(4),
      evidence: path.join(out, 'evidence/report.json'),
    }),
);
