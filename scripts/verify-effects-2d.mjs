#!/usr/bin/env node
// Real draw check of the built-in 2D effect presets (ZHUDA_EFFECT_PRESETS_2D)
// played by ZhudaEffect2D on a Laya 2D stage (tests/fixtures/effects-2d.ts),
// on WebGL through the `2d` browser profile. For every preset: it changes the
// picture; the same time gives the same bytes after another time was drawn
// in between; a loop differs from itself a quarter second on; a burst has
// nothing alive and nothing on screen after its seconds. A trail moved by the
// game's frames draws along its path and the same moves give the same bytes.
// A probe of one soft white particle shows the sprites' alpha reaching the
// screen with both blends (premultiplied: no square halo, no darkening).
// Thirty effects made and released leave no sprite and no resource.
//
// EFFECTS2D_OUT (evidence folder). WebGL only: the `2d-webgpu` profile is not
// drawn here. Desktop evidence only; not a phone, not art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import esbuild from 'esbuild';
import { PNG } from 'pngjs';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { gpuLabelExpression } from './lib/gpu-label.mjs';
import { ZHUDA_EFFECT_PRESETS_2D } from '../packages/core/effects/EffectPresets2D.ts';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.env.EFFECTS2D_OUT || path.join(os.tmpdir(), 'zhuda-effects-2d'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
await buildBrowserSdk({ engineRoot, outDir: web, profiles: ['2d'] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/effects-2d.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
const W = 400,
  H = 300;
fs.writeFileSync(
  path.join(web, 'index.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:${W}px;height:${H}px}</style>` +
    '<div id="view"></div><script src="zhuda-2d.js"></script><script src="page.js"></script>',
);
const server = http.createServer((request, response) => {
  const file = path.resolve(
    web,
    '.' + decodeURIComponent(new URL(request.url, 'http://x').pathname),
  );
  if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return response.writeHead(404).end();
  response.writeHead(200, {
    'Content-Type': file.endsWith('.html') ? 'text/html' : 'text/javascript',
  });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

/** Pixels that differ by more than 6 of 255 in a channel. */
const changed = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      Math.abs(a.data[i] - b.data[i]) > 6 ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > 6 ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > 6
    )
      n++;
  return n;
};
const same = (a, b) => Buffer.compare(a.data, b.data) === 0;
const pixel = (img, x, y) => {
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
};

const report = { gpu: null, presets: {}, trail: null, probe: {}, cycles: null, failures: [] };
const fail = (message) => report.failures.push(message);
const browser = await chromeFixture();
const sheet = new PNG({ width: W * 5, height: H * 4 });
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/index.html`,
  });
  try {
    await browser.waitFor('window.__FX2D__?.ready || window.__FX2D__?.errors.length', 60000);
  } catch (error) {
    const state = await browser.evaluate(
      'JSON.stringify({ page: window.__FX2D__ ?? null, zhuda: typeof Zhuda, laya: typeof Laya })',
    );
    throw Error(`${error.message}; page ${state}; console ${browser.errors.join('; ')}`);
  }
  const errors = await browser.evaluate('__FX2D__.errors');
  if (errors.length) throw Error(`page failed: ${errors.join('; ')}`);
  await browser.waitFor('!document.getElementById("zhudaLogoSplash")', 10000);
  report.gpu = await browser.evaluate(gpuLabelExpression(false));
  let shot = 0;
  const capture = async (name) => {
    const file = path.join(out, 'evidence', `${String(shot++).padStart(3, '0')}-${name}.png`);
    await browser.screenshot(file);
    return { file, img: PNG.sync.read(fs.readFileSync(file)) };
  };
  await browser.evaluate('__FX2D__.close()');
  const empty = (await capture('empty')).img;

  const ids = Object.keys(ZHUDA_EFFECT_PRESETS_2D);
  for (const [index, id] of ids.entries()) {
    const preset = ZHUDA_EFFECT_PRESETS_2D[id];
    const placed = await browser.evaluate(`__FX2D__.open(${JSON.stringify(id)})`);
    // A burst is looked at early, a loop once it has settled.
    const t = preset.kind === 'burst' ? 0.12 : preset.seconds;
    const a = await browser.evaluate(`__FX2D__.show(${t})`);
    const first = await capture(`${id}-a`);
    await browser.evaluate(`__FX2D__.show(${t + 0.25})`);
    const later = await capture(`${id}-b`);
    await browser.evaluate(`__FX2D__.show(${t})`);
    const again = await capture(`${id}-c`);
    const entry = {
      placed,
      at: t,
      alive: a.alive,
      pixels: changed(first.img, empty),
      aQuarterOn: changed(first.img, later.img),
      sameBytes: same(first.img, again.img),
    };
    if (entry.pixels < 20) fail(`${id}: draws ${entry.pixels} pixels at ${t} s`);
    if (!entry.sameBytes) fail(`${id}: ${t} s drawn twice is not the same picture`);
    if (preset.kind === 'loop' && entry.aQuarterOn < 20)
      fail(`${id}: a loop changes ${entry.aQuarterOn} pixels in a quarter second`);
    // The contact sheet shows a burst under way, a loop as it was checked.
    let still = first.img;
    if (preset.kind === 'burst') {
      const mid = Math.round(preset.seconds * 0.3 * 120) / 120;
      const under = await browser.evaluate(`__FX2D__.show(${mid})`);
      still = (await capture(`${id}-mid`)).img;
      entry.mid = { at: mid, alive: under.alive, pixels: changed(still, empty) };
      const end = await browser.evaluate(`__FX2D__.show(${preset.seconds})`);
      const over = await capture(`${id}-end`);
      entry.aliveAtEnd = end.alive;
      entry.leftAtEnd = changed(over.img, empty);
      if (end.alive || entry.leftAtEnd)
        fail(`${id}: ${end.alive} alive and ${entry.leftAtEnd} pixels left at ${preset.seconds} s`);
    }
    report.presets[id] = entry;
    PNG.bitblt(still, sheet, 0, 0, W, H, (index % 5) * W, Math.floor(index / 5) * H);
  }

  // The trail: moved by the game's frames along an arc; the same moves, the same picture.
  await browser.evaluate('__FX2D__.open("sparkle-trail")');
  const resting = await browser.evaluate('__FX2D__.show(1)');
  const still = changed((await capture('trail-still')).img, empty);
  const moved = await browser.evaluate('__FX2D__.trail(40)');
  const one = await capture('trail-moved');
  await browser.evaluate('__FX2D__.trail(40)');
  const two = await capture('trail-moved-again');
  report.trail = {
    stillAlive: resting.alive,
    stillPixels: still,
    movedAlive: moved.alive,
    movedPixels: changed(one.img, empty),
    sameBytes: same(one.img, two.img),
  };
  if (report.trail.movedPixels < still * 3)
    fail(`sparkle-trail: moving draws ${report.trail.movedPixels} pixels, still ${still}`);
  if (!report.trail.sameBytes) fail('sparkle-trail: the same moves are not the same picture');

  // The probe: centre at full white, half way out at the sprite's own alpha, corner clear.
  for (const blend of ['alpha', 'additive']) {
    await browser.evaluate(`__FX2D__.probe(${JSON.stringify(blend)})`);
    const img = (await capture(`probe-${blend}`)).img;
    const cx = W / 2,
      cy = H / 2;
    const values = {
      centre: pixel(img, cx, cy),
      // r = 0.5 of the sprite's radius (100 px): alpha (1 - 0.25)^2.2 = 0.531, 135 of 255.
      half: pixel(img, cx + 50, cy),
      // The quad's corner region, outside the round sprite: nothing.
      corner: pixel(img, cx + 92, cy + 92),
    };
    report.probe[blend] = values;
    if (values.centre.some((v) => v < 245)) fail(`probe ${blend}: centre ${values.centre}`);
    // Shown as data instead of sRGB it read 191 (the light 0.531 encoded for the screen).
    if (values.half.some((v) => Math.abs(v - 135) > 6)) fail(`probe ${blend}: half ${values.half}`);
    if (values.corner.some((v) => v > 3)) fail(`probe ${blend}: corner ${values.corner}`);
  }

  report.cycles = await browser.evaluate('__FX2D__.cycles("explosion", 30)');
  if (report.cycles.children !== 0 || report.cycles.after !== report.cycles.before)
    fail(`30 cycles: ${JSON.stringify(report.cycles)}`);

  const pageErrors = await browser.evaluate('__FX2D__.errors');
  if (pageErrors.length) fail(`page errors ${pageErrors.join('; ')}`);
  report.consoleErrors = browser.errors;
  if (browser.errors.length) fail(`console errors: ${browser.errors.join('; ')}`);
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'sheet.png'), PNG.sync.write(sheet));
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`evidence: ${out}`);
if (report.failures.length) process.exit(1);
