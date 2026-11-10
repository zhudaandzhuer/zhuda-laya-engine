#!/usr/bin/env node
// Real WebGL draw of the procedural pipeline through the browser SDK:
// - a starter yard (props merged into one mesh per material) renders cleanly
//   and baked maps upload with mipmaps;
// - a flat normal-mapped panel and real geometry with the same relief shade
//   alike under one light, on both texture axes (normal decode and tangents);
// - without the normal map that panel is flat (the relief comes from the map).
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { PNG } from 'pngjs';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.PROCEDURAL_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-procedural-draw'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
await buildBrowserSdk({ engineRoot, outDir: web, profiles: ['3d'] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/procedural-draw.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'proc.html'),
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:960px;height:600px}</style>' +
    '<div id="view"></div><script src="zhuda-3d.js"></script><script src="page.js"></script>',
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
const base = `http://127.0.0.1:${server.address().port}/proc.html`;
const views = {
  yard: 'yard',
  'relief-u': 'relief-u',
  'relief-v': 'relief-v',
  flat: 'relief-u&nonormal=1',
};
const results = {};
const browser = await chromeFixture();
try {
  results.gpu = await browser.evaluate(
    `(()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c.getExtension('WEBGL_debug_renderer_info');return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)})()`,
  );
  for (const [name, query] of Object.entries(views)) {
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width: 960,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.send('Page.navigate', { url: `${base}?view=${query}` });
    await browser.waitFor(
      'window.__PROC__ && (window.__PROC__.ready || window.__PROC__.error)',
      60000,
    );
    results[name] = await browser.evaluate('window.__PROC__');
    await browser.screenshot(path.join(out, 'evidence', `${name}.png`));
  }
  results.consoleErrors = browser.errors;
} finally {
  await browser.close();
  server.close();
}

const read = (name) => PNG.sync.read(fs.readFileSync(path.join(out, 'evidence', `${name}.png`)));
const lum = (img, x, y) => {
  const o = (y * img.width + x) * 4;
  return 0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2];
};
function panels(img) {
  const y = img.height >> 1,
    runs = [];
  let start = -1;
  for (let x = 0; x < img.width; x++) {
    const on = lum(img, x, y) > 45;
    if (on && start < 0) start = x;
    if ((!on || x === img.width - 1) && start >= 0) {
      if (x - start > 50) runs.push([start, x - 1]);
      start = -1;
    }
  }
  return runs;
}
function profile(img, [x0, x1], axis, bins = 80) {
  const cx = (x0 + x1) >> 1;
  let y0 = 0,
    y1 = img.height - 1;
  while (lum(img, cx, y0) <= 45) y0++;
  while (lum(img, cx, y1) <= 45) y1--;
  const pad = 6,
    values = [];
  for (let b = 0; b < bins; b++) {
    let sum = 0,
      n = 0;
    if (axis === 'u') {
      const x = Math.round(x0 + pad + ((x1 - x0 - 2 * pad) * (b + 0.5)) / bins);
      for (let y = y0 + pad; y <= y1 - pad; y++, n++) sum += lum(img, x, y);
    } else {
      const y = Math.round(y1 - pad - ((y1 - y0 - 2 * pad) * (b + 0.5)) / bins);
      for (let x = x0 + pad; x <= x1 - pad; x++, n++) sum += lum(img, x, y);
    }
    values.push(sum / n);
  }
  return values;
}
const correlation = (a, b) => {
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(a),
    mb = mean(b);
  let n = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < a.length; i++) {
    n += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return n / Math.sqrt(da * db);
};
const spread = (v) => Math.max(...v) - Math.min(...v);
results.shading = {};
for (const [name, axis] of [
  ['relief-u', 'u'],
  ['relief-v', 'v'],
  ['flat', 'u'],
]) {
  const img = read(name),
    found = panels(img);
  assert.equal(found.length, 2, `${name}: expected the normal-mapped panel and the geometry panel`);
  const mapped = profile(img, found[0], axis),
    geometry = profile(img, found[1], axis);
  results.shading[name] = {
    correlation: +correlation(mapped, geometry).toFixed(3),
    normalMappedSpread: +spread(mapped).toFixed(1),
    geometrySpread: +spread(geometry).toFixed(1),
  };
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(results, null, 2) + '\n');

for (const name of Object.keys(views)) {
  assert.equal(results[name].ready, true, `${name}: ${results[name].error}`);
  assert.deepEqual(results[name].errors, [], `${name} page errors`);
}
assert.deepEqual(results.consoleErrors, [], 'console errors');
assert.equal(results.yard.placed, 7);
assert.equal(results.yard.batches.length, 4, 'one batch per material');
assert.ok(results.yard.mipmap?.mipmap && results.yard.mipmap.mipmapCount > 1, 'mipmapped upload');
for (const name of ['relief-u', 'relief-v'])
  assert.ok(results.shading[name].correlation > 0.9, `${name}: normal map shades like geometry`);
assert.ok(results.shading.flat.normalMappedSpread < 10, 'without its normal map the panel is flat');
console.log(
  `PASS procedural draw on ${results.gpu}: U ${results.shading['relief-u'].correlation}, ` +
    `V ${results.shading['relief-v'].correlation}; evidence ${out}/evidence`,
);
