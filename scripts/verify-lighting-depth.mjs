#!/usr/bin/env node
// Real-GPU check of lighting depth, through the browser SDK: the falloff of
// a lamp by the square of the distance, a spot's penumbra, the width of the
// sun's soft shadow, cascades blended into one another, contact shadows, and
// point-light shadows drawn on a schedule.
// Desktop GPU evidence only (WebGL, or WebGPU with LIGHTING_RENDERER).
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
  process.env.LIGHTING_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-lighting-depth'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// LIGHTING_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.LIGHTING_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/lighting-depth.ts')],
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
  const gpu = await browser.evaluate(
    `(()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c.getExtension('WEBGL_debug_renderer_info');return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)})()`,
  );
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  for (let i = 0; i < 1200; i++) {
    if (
      await browser.evaluate(
        'window.__LIGHTING__ && (window.__LIGHTING__.ready || window.__LIGHTING__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__LIGHTING__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__LIGHTING__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__LIGHTING__.picture('${name}')`).catch(() => null);
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
if (process.env.LIGHTING_EXPLORE) {
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
assert.equal(report.installed, true, 'the lighting includes were changed at boot');
assert.equal(report.resourcesLeft, 0, 'nothing left behind');
const within = (value, low, high, what) =>
  assert.ok(value >= low && value <= high, `${what}: ${value} (want ${low}..${high})`);
const close = (drawn, expected, what) =>
  drawn.forEach((value, i) =>
    within(
      Math.abs(value - expected[i]),
      0,
      Math.max(0.03, 0.04 * expected[i]),
      `${what} [${i}]: ${value} for ${expected[i]}`,
    ),
  );

// A lamp under which the light is read at 0.5 to 10.5 units, range 10, as shares of the light at one unit.
const { falloff } = report;
close(falloff.laya.drawn, falloff.laya.expected, "LayaAir's falloff");
close(falloff.physical.drawn, falloff.physical.expected, 'by the square of the distance');
within(falloff.physical.drawn[2], 0.23, 0.27, 'a quarter at two units');
within(
  Math.abs(falloff.physical.overlap[0] - falloff.physical.overlap[1]),
  0,
  0.01,
  'two exposures agree',
);
within(falloff.atOne.physical, 0.96, 1.03, 'a lamp of 1 gives a white floor 1 at one unit');
assert.equal(falloff.physical.drawn.at(-1), 0, 'nothing beyond the range');
assert.equal(falloff.laya.drawn.at(-1), 0);
// A scene that asks for nothing draws as LayaAir does, with an owner and after it.
for (const name of ['withOwner', 'back', 'gone'])
  assert.deepEqual(falloff.unchanged[name], falloff.unchanged.bare, `unchanged (${name})`);

// A spot's penumbra, as shares of a hard-rimmed cone at the same place.
const { spot } = report;
for (const penumbra of ['1', '0.5', '0.25'])
  close(spot.shares[penumbra].drawn, spot.shares[penumbra].expected, `penumbra ${penumbra}`);
assert.deepEqual(spot.shares['0.02'].drawn.slice(0, 6), [1, 1, 1, 1, 1, 1]);
for (const outside of Object.values(spot.outside))
  assert.deepEqual(outside, [0, 0], 'dark outside the cone');
assert.deepEqual(spot.unset.owner, spot.unset.bare, "without a penumbra: LayaAir's own");
assert.deepEqual(spot.unset.half, spot.unset.bare, 'which is a half');
assert.deepEqual(spot.cleared, spot.unset.bare, 'and again once it is taken away');
within(spot.two.hard, 0.7, 1, 'the hard spot at 22 degrees');
within(spot.two.soft, 0.2, spot.two.hard * 0.55, 'the soft one beside it keeps its own');

// The sun's shadow.
const { shadows } = report;
within(shadows.spread.one.pixels, 5, 9, "LayaAir's edge in pixels");
within(shadows.spread.two.pixels / shadows.spread.one.pixels, 1.6, 2.6, 'twice as wide');
within(shadows.spread.wide.pixels / shadows.spread.one.pixels, 3, 4.5, 'three and a half times');
assert.deepEqual(shadows.spread.back, shadows.spread.one, 'and back');
{
  const { distances, plain, blended } = shadows.ends;
  const seen = distances.map((d, i) => i).filter((i) => plain[i] !== null);
  // Without the blend the shadow stops: full, then gone within two units.
  const last = Math.max(...seen.filter((i) => plain[i] > 0.95));
  assert.ok(plain[last + 2] < 0.05, `the shadow stops: ${plain.slice(last, last + 3)}`);
  // With it the last units fade: never darker, the same well before the end, in between at the end.
  for (const i of seen) assert.ok(blended[i] <= plain[i] + 0.02, `never darker (${distances[i]})`);
  for (const i of seen.filter((i) => i <= last - 4))
    within(Math.abs(blended[i] - plain[i]), 0, 0.02, `the same at ${distances[i]}`);
  const fading = seen.filter((i) => plain[i] > 0.95 && blended[i] > 0.1 && blended[i] < 0.9);
  assert.ok(fading.length >= 1, `the end fades: ${blended.slice(last - 3, last + 3)}`);
  assert.deepEqual(shadows.ends.back, { mean: 0, worst: 0 }, 'and back');
}
{
  // A kerb 0.12 high beyond the shadow map's distance, the sun 45 degrees up:
  // the ground is in its shade for 0.12 units, read at 0.06, 0.1, 0.16, 0.3 and 0.6.
  const { contact } = shadows;
  const pattern = (reading, what) => {
    within(reading.shade[0], 0, 0.03, `${what}: dark at 0.06`);
    within(reading.shade[1], 0, 0.5 * reading.lit, `${what}: mostly dark at 0.1`);
    for (const i of [2, 3, 4])
      within(
        reading.shade[i],
        reading.lit - 0.02,
        reading.lit + 0.02,
        `${what}: lit at ${contact.points[i]}`,
      );
  };
  for (const value of contact.off.shade)
    within(value, contact.off.lit - 0.01, contact.off.lit + 0.01, 'no contact shadow, no shade');
  pattern(contact.on, 'contact shadows');
  pattern(contact.flat, 'in a flat view');
  pattern(contact.bare, 'without an HDR chain');
  for (const value of contact.bareOff.shade)
    within(value, contact.bareOff.lit - 0.01, contact.bareOff.lit + 0.01, 'and off again');
  // A reach of 0.1 does not get to the kerb's top from 0.1 away.
  within(
    contact.short.shade[1],
    contact.short.lit - 0.02,
    contact.short.lit + 0.02,
    'a short reach',
  );
  assert.ok(contact.short.shade[0] < contact.short.lit * 0.8, 'still shades what is nearer');
  assert.deepEqual(contact.ground, contact.groundOff, 'flat ground does not shade itself');
}
assert.equal(shadows.depthAsked, false, "the camera's depth setting is put back");

// Point-light shadows on a schedule of one lamp a frame.
const { schedule } = report;
assert.deepEqual(schedule.first, [[0], [1], []], 'two lamps, a frame each');
for (const value of schedule.shaded)
  within(value, 0, 0.2, 'each block shades the ground behind it');
assert.deepEqual(schedule.afterTouch, [0], 'the lamp the game named');
within(schedule.moved.newPlace[0], 0, 0.2, "the first lamp's shadow followed its block");
within(schedule.moved.oldPlace[0], 0.8, 1.2, 'and left where it was');
within(schedule.moved.oldPlace[1], 0, 0.2, "the second lamp's is still where it was");
within(schedule.moved.newPlace[1], 0.8, 1.2);
assert.deepEqual(schedule.afterTouchAll, [[0], [1]]);
for (const value of schedule.both) within(value, 0, 0.2, 'both followed');
assert.deepEqual(schedule.afterMove, [1], 'a lamp that moved is drawn again');
assert.deepEqual(schedule.afterRemove, [[], []], 'a lamp taken away is not');
assert.deepEqual(schedule.draws, [0, 1, 0, 0, 1, 1]);

// A game's look.
const { look } = report;
within(
  look.plain.kerb,
  look.plain.open - 0.02,
  look.plain.open + 0.02,
  'no contact shadows unless asked',
);
within(look.plain.twoToOne, 0.59, 0.66, "LayaAir's falloff: 0.625 at two units against one");
assert.equal(look.updated, 'updated', 'the values are set in a running look');
within(look.asked.kerb, 0, 0.03, 'the kerb shades the ground');
within(look.asked.open, look.plain.open - 0.03, look.plain.open + 0.03, 'open ground as before');
within(look.asked.twoToOne, 0.22, 0.28, 'a quarter at two units');
within(
  look.lower.kerb,
  look.lower.open - 0.02,
  look.lower.open + 0.02,
  'one level down: no contact shadows',
);
within(look.lower.twoToOne, 0.22, 0.28, 'the lamps fall off the same');
within(look.again.kerb, 0, 0.03, 'and back up');
assert.equal(look.back, 'updated');
within(look.plainAgain.kerb, look.plainAgain.open - 0.02, look.plainAgain.open + 0.02);
within(look.plainAgain.twoToOne, 0.59, 0.66);

console.log(
  JSON.stringify(
    {
      ok: true,
      gpu: report.gpu,
      renderer: report.renderer,
      falloff: {
        heights: falloff.heights,
        laya: falloff.laya.drawn,
        physical: falloff.physical.drawn,
      },
      penumbra: Object.fromEntries(Object.entries(spot.shares).map(([p, v]) => [p, v.drawn])),
      shadowEdgePixels: Object.fromEntries(
        Object.entries(shadows.spread).map(([k, v]) => [k, v.pixels]),
      ),
      contact: shadows.contact.on,
      evidence: path.join(out, 'evidence'),
    },
    null,
    2,
  ),
);
