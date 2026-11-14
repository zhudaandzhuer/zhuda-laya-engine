#!/usr/bin/env node
// Real-GPU check of the post quality set, through the browser SDK.
// - Tone curves: pictures of known light go through the chain's display
//   part with AgX, the neutral curve and none, and the screen shows what
//   the same arithmetic gives on the CPU; black stays black; the curve is
//   changed while the chain runs, and back to ACES.
// - White balance, lift, gamma and gain do what their description says.
// - A colour table read from a .cube file gives the table's colours.
// - SMAA: a hard-edged half-plane at several angles comes out closer to the
//   true coverage of each pixel than without smoothing and than FXAA, and
//   what is not an edge is left exactly as it was.
// - Ambient occlusion by horizons: the foot of a wall is darkened, open
//   ground, an open wall and the sky are not; LayaAir's own is recorded.
// - The lens flare is where and as bright as asked, and fades behind a wall.
// - Bloom's threshold, knee, shape, spread and lens dirt.
// - A game's look names all of these.
// Desktop GPU evidence only (WebGL, or WebGPU with POST_RENDERER).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { lookCubeText } from '../tests/helpers/cube-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.POST_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-post-quality'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// POST_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.POST_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/post-quality.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
const fixtures = path.join(web, 'fixtures');
fs.mkdirSync(fixtures);
fs.writeFileSync(path.join(fixtures, 'look.cube'), lookCubeText(17));
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
      await browser.evaluate('window.__POST__ && (window.__POST__.ready || window.__POST__.error)')
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__POST__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__POST__.pictures()').catch(() => [])) ?? []) {
    const url = await browser.evaluate(`window.__POST__.picture('${name}')`).catch(() => null);
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
if (process.env.POST_EXPLORE) {
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
assert.equal(report.resourcesLeft, 0, `nothing left behind: ${report.resourcesLeftNamed}`);
const within = (value, low, high, what) =>
  assert.ok(value >= low && value <= high, `${what}: ${value} (want ${low}..${high})`);
const far = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

// The curves: what the screen shows is the curve's arithmetic.
const { tone } = report;
for (const kind of ['agx', 'neutral', 'none']) {
  assert.equal(tone[kind].is, kind);
  within(tone[kind].worst, 0, 1.5, `${kind}: furthest from the arithmetic`);
  within(tone[kind].exposedWorst, 0, 1.5, `${kind} at 2.5 times the exposure`);
}
for (const kind of ['aces', 'agx', 'neutral', 'none'])
  assert.deepEqual(tone[kind].drawn[0], [0, 0, 0], `${kind}: black is black`);
// Twelve greys from black to 32 times white, then colours: a dim red is the thirteenth.
assert.ok(far(tone.aces.drawn[12], tone.agx.drawn[12]) > 20, 'AgX is not ACES');
assert.ok(far(tone.neutral.drawn[12], tone.agx.drawn[12]) > 20, 'nor the neutral curve');
// A red four times white: ACES pulls it toward orange (green well above blue); AgX and the neutral curve keep them level.
const red = (kind) => tone[kind].drawn[13];
assert.ok(red('aces')[1] - red('aces')[2] > 12, `ACES turns a bright red: ${red('aces')}`);
assert.ok(Math.abs(red('agx')[1] - red('agx')[2]) <= 10, `AgX keeps its hue: ${red('agx')}`);
assert.ok(
  Math.abs(red('neutral')[1] - red('neutral')[2]) <= 2,
  `so does neutral: ${red('neutral')}`,
);
for (const [step, off] of Object.entries(tone.inPlace))
  within(off, 0, 1, `the curve changed in place (${step})`);

// White balance turns greys the way it says; lift, gamma and gain are the arithmetic.
const { balance } = report;
for (let i = 0; i < balance.plain.length; i++) {
  const [w, c, m, g] = ['warm', 'cool', 'magenta', 'green'].map((name) => balance[name][i]);
  assert.ok(w[0] > w[1] && w[1] > w[2], `warm: ${w}`);
  assert.ok(c[2] > c[1] && c[1] > c[0], `cool: ${c}`);
  assert.ok(m[1] < m[0] && m[1] < m[2], `magenta: ${m}`);
  assert.ok(g[1] > g[0] && g[1] > g[2], `green: ${g}`);
  within(far(balance.back[i], balance.plain[i]), 0, 1, 'and back');
}
for (const [name, entry] of Object.entries(report.liftGammaGain))
  within(entry.worst, 0, 2, `lift, gamma, gain (${name})`);

// A colour table.
const { lut } = report;
assert.equal(lut.title, 'Warm highlights, cool shadows');
assert.equal(lut.size, 17);
for (const name of ['look', 'half', 'identity2', 'identity33', 'identity65', 'turned'])
  within(lut[name].worst, 0, 2, `colour table (${name})`);
within(lut.narrow.worst, 0, 3, 'a table over part of the range');
within(lut.replaced.worst, 0, 1, 'another table in place');
within(lut.untouchedWorst, 0, 1.5, 'without a table');

// Edge smoothing against the true coverage of each pixel.
const { smoothing } = report;
const angles = ['deg4', 'deg12', 'deg27', 'deg45', 'deg63', 'deg83', 'dim', 'coloured'];
for (const shape of angles) {
  const none = smoothing.errors.none[shape].mean,
    fxaa = smoothing.errors.fxaa[shape].mean,
    smaa = smoothing.errors.smaaHigh[shape].mean;
  assert.ok(smaa < none * 0.5, `${shape}: SMAA ${smaa} against ${none} unsmoothed`);
  assert.ok(smaa < fxaa * 0.65, `${shape}: SMAA ${smaa} against FXAA ${fxaa}`);
}
assert.ok(
  smoothing.errors.smaaLow.deg4.mean > smoothing.errors.smaaHigh.deg4.mean * 1.5,
  'a long, shallow step needs the longer search',
);
within(
  Math.abs(smoothing.inPlace.mean - smoothing.errors.smaaUltra.deg4.mean),
  0,
  0.001,
  'the quality set in place',
);
for (const name of ['smaaLow', 'smaaMedium', 'smaaHigh', 'smaaUltra', 'smaaRounded', 'smaaRound'])
  for (const what of ['flat', 'ramp', 'grain'])
    assert.equal(smoothing.untouched[name][what].changed, 0, `${name} leaves ${what} as it was`);
assert.ok(smoothing.untouched.fxaa.grain.changed > 1000, 'FXAA does not');
// The corners of a box: left alone by default, rounded on request.
within(smoothing.untouched.smaaHigh.box.changed, 0, 16, 'pixels changed round a box');
within(smoothing.untouched.smaaHigh.box.worst, 0, 4, 'and by how much');
assert.ok(smoothing.untouched.smaaRounded.box.changed > 100, 'the reference rounds them');
assert.ok(
  smoothing.untouched.smaaRound.box.worst > smoothing.untouched.smaaRounded.box.worst * 2,
  'more so at full rounding',
);

// Ambient occlusion by horizons.
const { ao } = report;
for (const name of ['floor', 'wall'])
  assert.ok(
    ao.off[name].every((v) => v === 1),
    'without occlusion the scene is white',
  );
for (const name of ['gtao', 'gtaoFine', 'gtaoHalf', 'gtaoFlat']) {
  const m = ao[name];
  for (const line of ['floor', 'wall']) {
    within(m[line][0], 0.6, 0.85, `${name}: the ${line} at the crease`);
    for (let i = 1; i < m[line].length; i++)
      assert.ok(
        m[line][i] >= m[line][i - 1] - 0.012,
        `${name}: ${line} lighter away from it: ${m[line]}`,
      );
    for (const i of [5, 6, 7]) within(m[line][i], 0.985, 1, `${name}: the open ${line}`);
  }
  within(m.open, 0.985, 1, `${name}: open ground`);
  within(m.openWall, 0.985, 1, `${name}: an open wall`);
  within(m.grain, 0, 0.6, `${name}: what is left of the dither`);
}
within(ao.gtao.sky, 0.985, 1, 'the sky is not darkened');
for (let i = 0; i < ao.gtao.floor.length; i++)
  within(Math.abs(ao.gtaoHalf.floor[i] - ao.gtao.floor[i]), 0, 0.06, 'half size against full');
// Strength is a power; a wider radius reaches further.
within(Math.abs(ao.gtaoTwice.floor[0] - ao.gtao.floor[0] ** 2), 0, 0.03, 'strength 2 squares it');
assert.ok(
  ao.gtaoWide.floor[4] < ao.gtao.floor[4] - 0.01,
  'a radius of 1 reaches 0.45 from the wall',
);
assert.ok(ao.gtao.besidePost < 0.98, 'a post darkens the ground at its foot');
// LayaAir's own, for the record: it darkens open ground and the sky.
assert.ok(
  ao.sao.open < ao.gtao.open - 0.08,
  `open ground under LayaAir's occlusion: ${ao.sao.open}`,
);
assert.ok(ao.sao.sky < 0.95, `and the sky: ${ao.sao.sky}`);
assert.ok(ao.sao.grain > ao.gtao.grain + 1, 'and it leaves more of its dither');

// The lens flare.
const { flare } = report;
assert.equal(flare.offWorst, 0, 'no light, no flare');
for (const name of ['disc', 'polygon', 'ghost', 'ring'])
  within(far(flare.open[name].drawn, flare.open[name].expected), 0, 2, `flare ${name}`);
assert.deepEqual(flare.open.discOutside, [0, 0, 0]);
assert.deepEqual(flare.open.ringMiddle, [0, 0, 0], 'a ring is empty in the middle');
assert.ok(flare.open.polygonCorner[1] > 60, 'a hexagon reaches its corners');
assert.deepEqual(flare.open.polygonSide, [0, 0, 0], 'and stops short between them');
within(far(flare.open.streak.middle, flare.open.streak.expected), 0, 2, 'a streak');
within(far(flare.open.streak.up, flare.open.streak.expected), 0, 2, 'long the way it is turned');
assert.deepEqual(flare.open.streak.across, [0, 0, 0], 'and narrow across');
within(far(flare.tinted.drawn, flare.tinted.expected), 0, 2, "the light's colour and the strength");
assert.equal(flare.hidden.worst, 0, 'behind a wall there is no flare');
// Half hidden: between a quarter and three quarters of the light (sixteen points are counted).
const share = (drawn, full) => (drawn[0] / 255) ** 2.2 / (full[0] / 255) ** 2.2;
within(share(flare.half.ghost, flare.half.full), 0.25, 0.75, 'half hidden');
within(far(flare.lampInFront, flare.expectedGhost), 0, 2, 'a lamp in front of the wall');
assert.deepEqual(flare.lampBehind, [0, 0, 0], 'a lamp behind it');
within(flare.edge.fade, 0.49, 0.51, 'half of it a little outside the frame');
within(far(flare.edge.ghost, flare.edge.expected), 0, 2, 'its ghosts fade with it');
assert.equal(flare.behindWorst, 0, 'a light behind the camera');
assert.equal(flare.outWorst, 0, 'the light put out');

// Bloom.
const { bloom } = report;
assert.ok(bloom.light > 5, `the lamp is far brighter than white: ${bloom.light}`);
assert.ok(bloom.below.side > 60 && bloom.below.above > 60, 'a halo above the threshold');
assert.deepEqual(bloom.above, { side: 0, above: 0, far: 0 }, 'none under it');
assert.ok(bloom.knee.side > 30 && bloom.knee.side < bloom.below.side, 'the knee lets some through');
assert.ok(
  bloom.wide.side > bloom.wide.above * 1.4,
  `stretched sideways: ${JSON.stringify(bloom.wide)}`,
);
assert.ok(
  bloom.tall.above > bloom.tall.side * 1.4,
  `stretched upright: ${JSON.stringify(bloom.tall)}`,
);
within(bloom.round.side / bloom.round.above, 0.8, 1.25, 'round otherwise');
assert.equal(bloom.narrow.side, 0, 'less spread does not reach');
assert.ok(bloom.dirt.dirty.side > bloom.dirt.plain.side + 60, 'the dirt lights up in the halo');
assert.equal(bloom.dirt.dirty.above, bloom.dirt.plain.above, 'and nowhere else');
assert.deepEqual(bloom.dirt.cleanAgain, bloom.dirt.plain, 'strength 0');
assert.deepEqual(bloom.dirt.off, bloom.dirt.plain, 'no picture');
// A picture shaped like the frame covers it one to one: the round spot is round.
within(bloom.dirtSpot.wide, 8, 11, 'the spot across');
within(bloom.dirtSpot.high, 8, 11, 'the spot up and down');

// A game's look.
const { look } = report;
assert.ok(far(look.tabled, look.plain) > 5, 'the table changes the picture');
within(far(look.tabled, look.expected), 0, 3, "to the table's colours");
assert.equal(look.curve, 'updated', 'the curve is set in place');
within(far(look.neutral, look.neutralExpected), 0, 3, 'and the table is still on');
assert.equal(look.smoothing, 'rebuilt', 'another way of smoothing builds the chain again');
within(far(look.rebuilt, look.neutralExpected), 0, 3, 'with the table handed over before');
assert.ok(
  look.withOcclusion.crease[1] < look.withoutOcclusion.crease[1] - 5,
  'the foot of the wall is darker with occlusion',
);
within(far(look.withOcclusion.open, look.withoutOcclusion.open), 0, 1, 'open ground is not');
const gains = Object.values(look.flare).map(([without, withFlare]) => withFlare - without);
assert.ok(
  Math.max(...gains) > 1.5,
  `toward the sun the flare adds light: ${JSON.stringify(look.flare)}`,
);
assert.ok(Math.min(...gains) < 0.05, 'away from it none');
assert.equal(look.cycles, 0, 'looks made and let go leave nothing');

console.log(
  JSON.stringify(
    {
      ok: true,
      gpu: report.gpu,
      renderer: report.renderer,
      curves: Object.fromEntries(['agx', 'neutral', 'none'].map((k) => [k, tone[k].worst])),
      colourTable: lut.look.worst,
      edgeError: Object.fromEntries(
        ['none', 'fxaa', 'smaaHigh'].map((k) => [
          k,
          angles.map((a) => smoothing.errors[k][a].mean),
        ]),
      ),
      occlusion: {
        floor: ao.gtao.floor,
        open: ao.gtao.open,
        layaOpen: ao.sao.open,
        layaSky: ao.sao.sky,
      },
      flareHalfHidden: +share(flare.half.ghost, flare.half.full).toFixed(2),
      evidence: path.join(out, 'evidence'),
    },
    null,
    2,
  ),
);
