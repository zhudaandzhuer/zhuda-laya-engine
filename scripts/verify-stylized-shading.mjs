#!/usr/bin/env node
// Real-GPU check of stylized shading, through the browser SDK.
// - `ZhudaToonMaterial`: every sampled pixel of a ball is the band the ramp
//   gives its N·L (hard, soft and five bands), with the highlight and the rim
//   where the same arithmetic puts them; a cast shadow is the darkest band
//   with a hard edge; a point light and a spot light are banded with their
//   own falloff; the outline is a line of its own colour and width, in
//   pixels and in scene units, flat and through a lens; on a skinned limb
//   the bands, the outline and the shadow follow the bones.
// - The matcap recipe shows the picture upright on a ball, also off-centre
//   through a lens; the normal view shows each normal as its colour.
// - `ZhudaSelectionOutline`: a line round the selected prop in one colour
//   where it is seen and another where it is behind a wall, of the width
//   asked for, with a fill, a strength, and nothing changed elsewhere.
// Desktop GPU evidence only (WebGL, or WebGPU with STYLE_RENDERER).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { skinnedLimbGlb } from '../tests/helpers/toon-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.STYLE_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-stylized-shading'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// STYLE_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.STYLE_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/stylized-shading.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
const fixtures = path.join(web, 'fixtures');
fs.mkdirSync(fixtures);
fs.writeFileSync(path.join(fixtures, 'limb.glb'), skinnedLimbGlb());
fs.writeFileSync(
  path.join(web, 'live.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:${W}px;height:${H}px}</style>` +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);
// For a phone, by hand: the same balls timed physically based, banded, outlined and selected.
fs.writeFileSync(
  path.join(web, 'time.html'),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}#view{width:100vw;height:100vh}</style>` +
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
        'window.__STYLE__ && (window.__STYLE__.ready || window.__STYLE__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__STYLE__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__STYLE__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__STYLE__.picture('${name}')`).catch(() => null);
    if (!url) continue;
    fs.writeFileSync(
      path.join(out, 'evidence', `${name}.png`),
      Buffer.from(url.split(',')[1], 'base64'),
    );
    report.pictures.push(`${name}.png`);
  }
  // The cost of each, in a picture of 1280 by 720 (WebGL only: there a frame can be waited for).
  if (!gpuBuild) {
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.send('Page.navigate', {
      url: `http://127.0.0.1:${server.address().port}/time.html?time=1`,
    });
    for (let i = 0; i < 1200; i++) {
      if (
        await browser.evaluate(
          'window.__STYLE__ && (window.__STYLE__.ready || window.__STYLE__.error)',
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const timed = await browser.evaluate('window.__STYLE__');
    report.timing = timed.timing ?? null;
    report.timingError = timed.error ?? null;
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');
if (process.env.STYLE_EXPLORE) {
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
const near = (got, want, tolerance, what) =>
  assert.ok(
    got.every((v, i) => Math.abs(v - (Array.isArray(want) ? want[i] : want)) <= tolerance),
    `${what}: ${got} against ${want}`,
  );

// The bands: every sampled pixel is the band its N·L falls in.
const { bands } = report;
assert.ok(bands.hard.count > 2000 && bands.hard.worst <= 3, `three bands: ${bands.hard.worst}`);
assert.equal(bands.hard.levels, 3, 'three flat levels and nothing between');
assert.ok(bands.five.worst <= 3 && bands.five.levels === 5, 'five bands from zhudaToonRamp');
assert.ok(bands.soft.worst <= 8 && bands.soft.mean <= 2, `a soft edge: ${bands.soft.worst}`);
assert.ok(bands.soft.distinct > 20, 'the soft ramp blends between its bands');
assert.ok(report.highlight.worst <= 3 && report.highlight.levels === 4, 'a hard highlight');
assert.ok(report.rim.worst <= 3, `the rim: ${report.rim.worst}`);
assert.ok(report.plainAgain.worst <= 3 && report.plainAgain.levels === 3, 'both switched off');
// Ambient light, flat by default: one value on every side, and twice it at strength 2.
near(report.ambient.top, report.ambient.bottom, 1, 'flat ambient');
near(report.ambient.middle, 54.2, 2, 'ambient 0.2');
near(report.ambient.doubled, 74.2, 2, 'ambient doubled');

// The outline.
const { outline } = report;
for (const [name, rings] of Object.entries({
  screen: outline.screen,
  world: outline.world,
  lens: outline.lens,
  ...Object.fromEntries(outline.batch.rings.map((r, i) => [`batch ${i}`, r])),
})) {
  assert.ok(
    rings.inside.line <= 12,
    `${name}: the line just outside the ball (${rings.inside.line})`,
  );
  assert.ok(rings.outside.back <= 6, `${name}: nothing past the line (${rings.outside.back})`);
}
assert.ok(outline.screen.body.line > 60, 'the ball itself is not the line');
assert.ok(outline.bodyBands.worst <= 3, 'an outlined ball keeps its bands');
assert.ok(outline.none.back <= 6, 'a width of 0 draws no line');
assert.match(outline.withoutPass, /made without an outline/);

// A cast shadow is the darkest band; its edge is a step, where the physical floor fades.
const { shadow } = report;
near(shadow.shade, shadow.wantShade, 4, 'in the shadow');
near(shadow.lit, shadow.wantLit, 4, 'in the light');
assert.ok(shadow.toonBetween <= 3, `a hard shadow edge (${shadow.toonBetween} pixels between)`);
assert.ok(shadow.pbr.between > shadow.toonBetween, 'the physical floor fades across the edge');

// A lamp and a spot, banded, with their own falloff.
const { lamp, spot, together } = report.lights;
near(lamp.under, [lamp.want, 0, 0], 5, 'under the lamp');
near(lamp.grazing, [lamp.grazeWant, 0, 0], 5, 'where the lamp grazes the floor');
near(lamp.away, 0, 2, "out of the lamp's reach");
near(spot.under, [0, 0, spot.want], 5, 'under the spot');
near(spot.outside, 0, 2, "outside the spot's cone");
assert.ok(together.underLamp[0] > together.underLamp[1] + 30, 'lamp and sun add up');
assert.ok(together.underSpot[2] > together.underSpot[1] + 30, 'spot and sun add up');

// The skinned limb: where it is drawn, its line and that it moved.
const { limb } = report;
const limbColour = limb.straight.upright;
near(limb.bent.lying, limbColour, 12, 'the bent half is where the bone took it');
assert.ok(
  Math.max(...limb.bent.upright.map((v, i) => Math.abs(v - limbColour[i]))) > 30,
  'and no longer where it stood',
);
assert.ok(limb.bent.line.above >= 2 && limb.bent.line.below >= 2, 'the line follows the bones');
assert.deepEqual(limb.lineStraight, { above: 0, below: 0 }, 'no line where the limb is not');

// The selection outline.
const { selection } = report;
assert.equal(report.selectionAfterGrade, true, 'a finishing effect runs after the grade');
assert.deepEqual(selection.empty, { mean: 0, worst: 0 }, 'nothing selected: the picture as it was');
for (const view of [selection, selection.lens]) {
  near(view.left, selection.seenShown, 6, 'the line where the prop is seen');
  near(view.topSeen, selection.seenShown, 6, 'the line above the seen half');
  near(view.topBehind, selection.behindShown, 6, 'the line above the hidden half');
  near(view.right, selection.behindShown, 6, 'the line where the prop is behind the wall');
}
assert.ok(Math.abs(selection.thickness - 3) <= 1, `three pixels wide (${selection.thickness})`);
assert.ok(Math.abs(selection.wide - 5) <= 1, `five pixels wide (${selection.wide})`);
assert.equal(selection.awayChanged, 0, 'nothing changes away from the line');
assert.equal(selection.insideChanged, 0, 'nor inside the prop without a fill');
{
  const linear = (v) => (v / 255) ** 2.2;
  const shown = (v) => 255 * v ** (1 / 2.2);
  const mixed = (a, b) => a.map((v, i) => shown(0.5 * linear(v) + 0.5 * linear(b[i])));
  near(selection.filled, mixed(selection.wall, selection.behindShown), 5, 'a half fill');
  near(selection.half.left, mixed(selection.half.base, selection.seenShown), 5, 'half strength');
}
assert.equal(selection.noHidden, 0, 'no hidden colour: no line there');
near(selection.moved, selection.seenShown, 6, 'the line goes with the prop');
assert.deepEqual(selection.cleared, { mean: 0, worst: 0 }, 'moved back and deselected at once');
assert.deepEqual(selection.pulse, [1, 0.675, 0.35]);
assert.ok(selection.limb.above >= 2, 'the mask is skinned as the limb is');
near(selection.through.right, selection.seenShown, 6, 'without occlusion: one colour');
assert.equal(selection.through.depthMode, 0, 'and no depth texture is asked for');

// The recipes.
const { matcap, normalView } = report;
for (const view of [matcap, matcap.lens])
  for (const corner of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'])
    near(view[corner], matcap.want[corner], 3, `matcap ${corner}`);
for (const [name, { got, want }] of Object.entries(normalView))
  near(got, want, 3, `normal ${name}`);

assert.match(report.invalid.ramp, /ascending/);
assert.match(report.invalid.contract, /different contract/);
assert.match(report.invalid.width, /1\.\.6 pixels/);
assert.match(report.invalid.own, /are taken/);
assert.equal(report.resourcesLeft, 0, `nothing is left behind (${report.left})`);
if (!gpuBuild) assert.ok(report.timing?.cases, `the timing page ran (${report.timingError})`);

console.log(
  `PASS stylized shading on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu})\n` +
    `  bands: ${bands.hard.count} pixels within ${bands.hard.worst.toFixed(1)} of 255 (hard), ${bands.soft.worst.toFixed(1)} (soft), five bands ${bands.five.worst.toFixed(1)}; highlight ${report.highlight.worst.toFixed(1)}, rim ${report.rim.worst.toFixed(1)}\n` +
    `  shadow: shade ${shadow.shade[0]} (want ${shadow.wantShade}), lit ${shadow.lit[0]} (want ${shadow.wantLit}), ${shadow.toonBetween} pixels between against ${shadow.pbr.between} on a physical floor\n` +
    `  lamp ${lamp.under[0]} (want ${lamp.want}), grazing ${lamp.grazing[0]} (want ${lamp.grazeWant}); spot ${spot.under[2]} (want ${spot.want})\n` +
    `  outline: line ${outline.screen.inside.line}, past it ${outline.screen.outside.back}; limb line ${limb.bent.line.above}/${limb.bent.line.below} pixels\n` +
    `  selection: seen ${selection.left}, behind ${selection.right}, ${selection.thickness} and ${selection.wide} pixels wide\n` +
    (report.timing
      ? `  frame at ${report.timing.picture.join('x')}: ${Object.entries(report.timing.cases)
          .map(([name, ms]) => `${name} ${ms} ms`)
          .join(', ')}\n`
      : '') +
    `Pictures: ${path.join(out, 'evidence')}`,
);
