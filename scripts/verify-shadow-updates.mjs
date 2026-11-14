#!/usr/bin/env node
// Real-GPU check of how often a game's look draws its sun shadows
// (`look.shadows.update`, `ZhudaShadowUpdates`), through the browser SDK:
// - drawn every third frame, a moving post's shadow is right on the frames
//   that draw it and stays where it was drawn on the two between, and those
//   frames are drawn (the post moves on in them);
// - a tile under the post's shadow whose material is first drawn on a frame
//   that keeps the maps is lit and shadowed as when drawn every frame;
// - on request only, the shadow waits for `redrawShadows()`, and a sun that
//   moves draws it again by itself;
// - back to every frame is LayaAir's own path and picture;
// - with a pond whose mirror the game draws from its tick (`?water`), the
//   shadows on land stay on every frame whatever `mirrorShadows` is: left
//   out, the mirror reads the kept maps and nothing more is drawn; true, it
//   draws its own and the main view draws again every frame; false, it draws
//   none. A probe captured meanwhile takes the maps and the view draws them
//   again;
// - stills of a film stage (`?film`) are the same under every
//   `shadows.update`.
// It also loads the page once with LayaAir's own `shadowMapFrequency` and
// nothing of the engine's, and records what goes wrong there.
// Pictures for a person to look at are written beside the report.
// Desktop GPU evidence only (WebGL, or WebGPU with SHADOW_UPDATES_RENDERER);
// the frame times it reports are desktop times, not phone evidence.
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
  process.env.SHADOW_UPDATES_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-shadow-updates'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// SHADOW_UPDATES_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild =
  (process.env.SHADOW_UPDATES_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/shadow-updates.ts')],
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
  // The WebGPU bundle fetches its shader compilers from folders beside it.
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

const png = (file, url) =>
  fs.writeFileSync(path.join(out, 'evidence', file), Buffer.from(url.split(',')[1], 'base64'));
/** One page load: the report of `window.__SHADOWS__`, and the strips asked for. */
async function load(query, strips) {
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
      url: `http://127.0.0.1:${server.address().port}/live.html${query}`,
    });
    for (let i = 0; i < 1200; i++) {
      if (
        await browser.evaluate(
          'window.__SHADOWS__ && (window.__SHADOWS__.ready || window.__SHADOWS__.error)',
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const report = {
      gpu,
      ...(await browser.evaluate('window.__SHADOWS__')),
      consoleErrors: browser.errors,
      // WebGPU reports pipeline and validation errors as console warnings.
      gpuWarnings: browser.consoleMessages.filter((m) => /unCaptured|INVALID|GL_|WebGPU/i.test(m)),
    };
    if (report.ready)
      for (const [file, [names, crop]] of Object.entries(strips)) {
        png(
          file,
          await browser.evaluate(
            `window.__SHADOWS__.strip(${JSON.stringify(names)}, ${JSON.stringify(crop)})`,
          ),
        );
        (report.pictures ??= []).push(file);
      }
    return report;
  } finally {
    await browser.close();
  }
}
// The post and the floor tile under its shadow.
const TILE = [100, 20, 260, 180];
const WHOLE = [0, 0, W, H];
const nine = (label) => Array.from({ length: 9 }, (_, k) => `${label}-${k}`);
let report, native, water, film;
try {
  native = await load('?native', {
    'native-interval.png': [nine('native').slice(0, 6)],
    'native-tile.png': [['native-tile-0', 'native-tile-4'], TILE],
  });
  report = await load('', {
    'every.png': [nine('every').slice(0, 6)],
    'interval.png': [nine('interval').slice(0, 6)],
    'tile.png': [['tile-0', 'tile-2', 'tile-4', 'tile-every'], TILE],
    'manual.png': [['manual-0', 'manual-4', 'manual-8', 'manual-asked', 'manual-sun']],
  });
  // Every frame, the frame that draws the maps, one that keeps them, on request.
  const pond = (name) => [
    [
      `water-${name}-every-1`,
      `water-${name}-interval-0`,
      `water-${name}-interval-1`,
      `water-${name}-manual-8`,
    ],
    WHOLE,
  ];
  water = await load('?water', {
    'water-default.png': pond('default'),
    'water-own.png': pond('own'),
    'water-main.png': pond('main'),
    'water-probe.png': [['water-probe-every', 'water-probe-0', 'water-probe-1'], WHOLE],
  });
  film = await load('?film', {
    'film-stills.png': [
      ['film-every-a', 'film-manual-a', 'film-interval-a', 'film-every-d', 'film-manual-d'],
      WHOLE,
    ],
  });
} finally {
  server.close();
}
report.nativeLaya = native;
report.water = water;
report.film = film;
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

for (const [name, page] of Object.entries({ main: report, water, film })) {
  assert.equal(page.ready, true, `${name}: ${page.error}`);
  assert.deepEqual(page.errors, [], `${name}: page errors`);
  assert.deepEqual(page.consoleErrors, [], `${name}: console errors`);
  assert.deepEqual(page.gpuWarnings, [], `${name}: GPU errors and warnings`);
  assert.deepEqual(page.rendererErrors, [], `${name}: renderer errors`);
  // Drawn by the backend asked for; on WebGPU by a real adapter, not a fallback.
  assert.equal(page.backend.selected, gpuBuild ? 'webgpu' : 'webgl');
  if (gpuBuild)
    assert.ok(
      page.backend.adapter && !page.backend.adapter.isFallbackAdapter,
      `${name}: a WebGPU adapter (${JSON.stringify(page.backend.adapter)})`,
    );
}
const r = report.r;
const reference = r.every;
// Every third frame.
assert.equal(r.intervalMode, 'rebuilt', 'from every frame to an interval the look is rebuilt');
assert.deepEqual(
  r.intervalStats,
  { frames: 9, drawn: 3, taken: 0 },
  'three of nine frames draw the maps',
);
for (const row of r.interval) {
  const drawn = row.k % 3 === 0;
  assert.equal(row.drawnAt, row.k - (row.k % 3));
  if (drawn)
    assert.ok(
      row.likeNow > 0.95,
      `frame ${row.k} draws the maps: its shadow is the post's now (${row.likeNow})`,
    );
  else {
    assert.ok(
      row.likeDrawn > 0.95,
      `frame ${row.k} keeps the maps: the shadow stays where frame ${row.drawnAt} drew it (${row.likeDrawn})`,
    );
    assert.ok(row.likeNow < 0.7, `and it is not where the post is now (${row.likeNow})`);
  }
  assert.ok(
    row.shadow.n > reference[row.k].shadow.n * 0.5,
    `frame ${row.k}: the receivers keep a shadow (${row.shadow.n} pixels against ${reference[row.k].shadow.n})`,
  );
  if (row.k > 0)
    assert.ok(
      row.post.x > r.interval[row.k - 1].post.x + 5,
      `frame ${row.k} is drawn: the post has moved on (${r.interval[row.k - 1].post.x} -> ${row.post.x})`,
    );
}
// A material first drawn on a frame that keeps the maps.
assert.equal(
  r.tileFirst.drawn,
  r.beforeTile.drawn,
  'the tile is first drawn on a frame that keeps the maps',
);
assert.ok(
  r.tileReference.shadowed > 300 && r.tileReference.lit > 0.5,
  `drawn every frame, the post's shadow lies across the tile (${JSON.stringify(r.tileReference)})`,
);
for (const [i, tile] of r.tile.entries()) {
  assert.ok(
    tile.like > 0.95,
    `tile frame ${i}: its shadow is the one drawn every frame (${tile.like}, ${tile.shadowed} against ${r.tileReference.shadowed} pixels)`,
  );
  assert.ok(
    Math.abs(tile.lit - r.tileReference.lit) < 0.02,
    `tile frame ${i}: the rest of it is sunlit (${tile.lit} against ${r.tileReference.lit})`,
  );
}
// On request.
assert.equal(r.manualMode, 'updated', 'from an interval to on request in place');
for (const row of r.manual) {
  assert.ok(
    row.likeDrawn > 0.95,
    `manual frame ${row.k}: the shadow stays where it was drawn (${row.likeDrawn})`,
  );
  if (row.k >= 3) assert.ok(row.likeNow < 0.2, `while the post has gone on (${row.likeNow})`);
}
assert.ok(
  r.manualAsked > 0.95,
  `asked, the shadow is the post's where it stands (${r.manualAsked})`,
);
assert.equal(r.sunMode, 'updated');
assert.ok(
  r.sunMoved.likeBefore < 0.5,
  `a sun that moves draws the maps again by itself (${r.sunMoved.likeBefore} like before)`,
);
// Back to every frame.
assert.equal(r.everyMode, 'rebuilt');
assert.equal(r.ruleGone, true);
assert.equal(r.frequencyBack, 1);
assert.ok(r.backLike > 0.95, `every frame again: the shadow is the reference (${r.backLike})`);
assert.match(r.invalid, /shadows\.interval: use a whole number of frames 2\.\.30/);
assert.deepEqual(
  r.afterDispose,
  { accessor: false, frequency: 1 },
  'disposal gives LayaAir its own frame test back',
);

// A pond: another camera drawing the scene from the game's tick.
const ponds = water.r.water;
const near = (a, b, share) => Math.abs(a - b) <= Math.max(a, b) * share;
/** The shadows on land are there, on a frame that keeps the maps as on one that draws them. */
const landHolds = (label, rows, everyFrame) => {
  for (const row of rows) {
    assert.ok(
      row.shadow > row.everyFrame * 0.9,
      `${label} frame ${row.k}: the land keeps its shadows (${row.shadow} pixels, ${row.everyFrame} drawn every frame)`,
    );
    if (everyFrame)
      assert.ok(
        row.likeNow > 0.95,
        `${label} frame ${row.k}: they are the shadows of this frame (${row.likeNow})`,
      );
    else
      assert.ok(
        row.likeDrawn > 0.95,
        `${label} frame ${row.k}: they are the shadows of the frame that drew them (${row.likeDrawn})`,
      );
  }
};
// Left out: the mirror reads the kept maps. Nothing more is drawn, nothing is taken.
assert.deepEqual(ponds.default.intervalStats, { frames: 9, drawn: 3, taken: 0 });
assert.deepEqual(
  ponds.default.interval.map((row) => row.drew),
  [true, false, false, true, false, false, true, false, false],
);
landHolds('pond, interval', ponds.default.interval, false);
assert.deepEqual(ponds.default.manualStats, { frames: 9, drawn: 0, taken: 0 });
landHolds('pond, on request', ponds.default.manual, false);
// Its picture shows the bar's shadow on the wall, from the main view's maps
// (the first frame still shows the mirror drawn before the rule).
const borrowed = [...ponds.default.interval.slice(1), ...ponds.default.manual];
for (const row of borrowed)
  assert.ok(
    row.mirrorShadow > ponds.default.everyFrame.mirrorShadow + 300 &&
      near(row.mirrorShadow, borrowed[0].mirrorShadow, 0.05),
    `the mirror shows the main view's shadow on the wall, steadily (${row.mirrorShadow} dark pixels, ${ponds.default.everyFrame.mirrorShadow} without)`,
  );
// True: the mirror draws its own maps and the main view draws again on every frame.
assert.deepEqual(ponds.own.intervalStats, { frames: 9, drawn: 9, taken: 8 });
landHolds('pond with its own shadows, interval', ponds.own.interval, true);
assert.deepEqual(ponds.own.manualStats, { frames: 9, drawn: 9, taken: 9 });
landHolds('pond with its own shadows, on request', ponds.own.manual, true);
// False: the mirror draws no maps and the rule keeps its frames.
assert.deepEqual(ponds.main.intervalStats, { frames: 9, drawn: 3, taken: 0 });
landHolds('pond without shadows, interval', ponds.main.interval, false);
assert.deepEqual(ponds.main.manualStats, { frames: 9, drawn: 0, taken: 0 });
landHolds('pond without shadows, on request', ponds.main.manual, false);
// A probe captured while the maps are kept: the view draws them again, once or
// more (on WebGPU frames are drawn between the capture's six views).
const probe = ponds.default.probe;
assert.ok(probe.stats.taken >= 1, `the capture took the maps (${JSON.stringify(probe.stats)})`);
for (const [i, row] of probe.frames.entries())
  assert.ok(
    row.like > 0.95 && row.shadow > probe.everyFrame * 0.9,
    `frame ${i} after the capture: the land has its shadows (${row.like}, ${row.shadow} of ${probe.everyFrame} pixels)`,
  );

// Stills of a film: drawn for every still whatever the rule says.
const stills = film.r.film;
for (const update of ['manual', 'interval'])
  for (const [label, still] of Object.entries(stills[update])) {
    assert.ok(
      still.likeEvery < 0.5,
      `film still ${label} with ${update}: the still drawn every frame (${still.likeEvery})`,
    );
    assert.ok(
      still.shadow.n > 500 && Math.abs(still.shadow.x - stills.every[label].shadow.x) < 2,
      `and its shadow is under the plate (${JSON.stringify(still.shadow)})`,
    );
  }
assert.ok(
  Math.abs(stills.manual.a.shadow.x - stills.manual.b.shadow.x) > 100,
  'the plate, and its shadow, moved between the stills',
);

// LayaAir's own skipping, without the engine: what the repair is for.
const n = native.r;
assert.ok(native.ready, native.error);
const lost = n.interval.filter(
  (row, i) => i > 0 && (row.error || row.post.x === n.interval[i - 1].post.x),
).length;
// The tile is not there, or wholly in shadow, or the frame threw.
const darkTile = n.tile.filter(
  (v) => typeof v !== 'object' || v.pixels < r.tileReference.pixels * 0.5 || v.lit < 0.5,
).length;
const nativeSummary = {
  lostFrames: lost,
  tileFramesWrong: darkTile,
  gpuWarnings: native.gpuWarnings.length,
  pageErrors: native.errors.length + native.consoleErrors.length,
};
assert.ok(
  lost + darkTile > 0,
  `LayaAir's own shadowMapFrequency still breaks here, so the repair is still needed (${JSON.stringify(nativeSummary)})`,
);
console.log(
  `PASS shadow updates on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu}): ` +
    JSON.stringify({
      interval: r.interval.map((row) => [row.k, row.likeNow, row.likeDrawn]),
      tile: r.tile.map((tile) => tile.like),
      pond: Object.fromEntries(
        ['default', 'own', 'main'].map((name) => [
          name,
          {
            interval: ponds[name].intervalStats,
            manual: ponds[name].manualStats,
            mirrorShadow: [
              ponds[name].everyFrame.mirrorShadow,
              ponds[name].interval[4].mirrorShadow,
            ],
          },
        ]),
      ),
      probe: probe.stats,
      desktopMs: r.desktopMs,
      desktopHeavyMs: r.desktopHeavyMs,
      nativeLaya: nativeSummary,
    }) +
    `\nPictures: ${path.join(out, 'evidence')}`,
);
