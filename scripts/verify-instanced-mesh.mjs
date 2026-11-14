#!/usr/bin/env node
// Real-GPU check of copies drawn in groups (`ZhudaInstancedMesh`), through
// the browser SDK.
// - Five thousand copies in groups give the picture the same copies give as
//   nodes, bit for bit on WebGL, in a handful of draws, and none when the
//   eye looks away; they cast shadows, and without `castShadow` they do not.
// - Under a holder that is moved, turned and scaled the copies stand where
//   nodes under it stand.
// - A tint for each copy colours it, on a material of the lit template; any
//   other material refuses tints.
// - A model prefab of two meshes mounted `instanced` gives the picture of
//   the same prefab as nodes; with levels, a group at a time.
// - A character baked for a crowd shows, at a whole frame, the picture
//   LayaAir's own skinning gives at that time, on twelve bones and on thirty;
//   five hundred copies are a handful of draws and cast shadows.
// - Nine nodes of one mesh and one material each cast a shadow (LayaAir's
//   WebGPU batches cast none: the engine keeps shadow casters out of them).
// Desktop GPU evidence only (WebGL, or WebGPU with INSTANCED_RENDERER).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { skinnedCharacterGlb, skinnedLimbGlb } from '../tests/helpers/toon-fixture.mjs';
import { lightPropGlb, staticPropGlb } from '../tests/helpers/prop-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.INSTANCED_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-instanced-mesh'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// INSTANCED_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.INSTANCED_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/instanced-mesh.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
const fixtures = path.join(web, 'fixtures');
fs.mkdirSync(fixtures);
fs.writeFileSync(path.join(fixtures, 'limb.glb'), skinnedLimbGlb());
fs.writeFileSync(path.join(fixtures, 'prop.glb'), staticPropGlb());
fs.writeFileSync(path.join(fixtures, 'prop-light.glb'), lightPropGlb());
// A character on twelve bones, and one on thirty: more than LayaAir keeps in one piece of a mesh.
fs.writeFileSync(path.join(fixtures, 'character.glb'), skinnedCharacterGlb(12));
fs.writeFileSync(path.join(fixtures, 'character30.glb'), skinnedCharacterGlb(30));
fs.writeFileSync(
  path.join(web, 'live.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:${W}px;height:${H}px}</style>` +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);
// For a phone, by hand: five thousand props timed as nodes and in groups.
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
        'window.__INSTANCED__ && (window.__INSTANCED__.ready || window.__INSTANCED__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__INSTANCED__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__INSTANCED__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__INSTANCED__.picture('${name}')`).catch(() => null);
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
          'window.__INSTANCED__ && (window.__INSTANCED__.ready || window.__INSTANCED__.error)',
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const timed = await browser.evaluate('window.__INSTANCED__');
    report.timing = timed.timing ?? null;
    report.timingError = timed.error ?? null;
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');
if (process.env.INSTANCED_EXPLORE) {
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
const same = (difference, what) =>
  gpuBuild
    ? assert.ok(
        difference.mean <= 0.05 && difference.worst <= 3,
        `${what}: ${JSON.stringify(difference)}`,
      )
    : assert.deepEqual(difference, { mean: 0, worst: 0 }, `${what}: bit for bit on WebGL`);

// Five thousand copies in groups: the picture of the same copies as nodes.
const { props } = report;
assert.deepEqual(props.stats, { copies: 5000, groups: 24, drawsPerPass: 24 });
same(props.against, 'groups against nodes');
assert.ok(props.drawn.mean > 20, 'the copies are in the picture');
// LayaAir counts a draw of the scene's pass twice; the floor is one more.
assert.ok(
  props.groupsDraws.scene <= 2 * props.stats.groups + 2 &&
    props.groupsDraws.shadow <= props.stats.groups,
  `a draw a group a pass: ${JSON.stringify(props.groupsDraws)}`,
);
assert.deepEqual(
  props.awayDraws,
  { scene: 0, shadow: 0 },
  'nothing is drawn when the eye looks away',
);
assert.ok(props.noCast.mean > 1, 'the copies cast shadows');
assert.equal(props.noCastDraws.shadow, 0, 'and do not when told not to');
assert.deepEqual(props.afterDispose, { mean: 0, worst: 0 }, 'disposed, the scene is as it was');
// On WebGPU the engine keeps shadow casters out of LayaAir's batches: a node is then a draw.
if (gpuBuild) assert.ok(props.nodesDraws.shadow >= 5000, 'nodes that cast are drawn one by one');
same(report.holder.against, 'under a holder that is moved, turned and scaled');

// A colour for each copy.
const near = (got, want, tolerance, what) =>
  assert.ok(
    got.every((v, i) => Math.abs(v - (Array.isArray(want) ? want[i] : want)) <= tolerance),
    `${what}: ${got} against ${want}`,
  );
report.tints.got.forEach((got, i) => near(got, report.tints.want[i], 2, `tint ${i}`));
near(report.tints.plain, report.tints.plainWant, 2, 'without tints the material is as it was');
assert.match(report.refused.tintsOnStock, /tints need materials from ZhudaLitSurfaceMaterial/);
assert.match(report.refused.tintCount, /four numbers a copy/);
assert.match(report.refused.noCopies, /at least one copy/);
assert.match(report.refused.mirrored, /mirrored/);
assert.match(report.refused.mesh, /live LayaAir mesh/);

// A model prefab of two meshes, instanced.
const { model } = report;
same(model.against, 'a model prefab instanced against the same prefab as nodes');
assert.ok(model.groupsDraws.scene < 200, `a draw a group a mesh: ${model.groupsDraws.scene}`);
assert.deepEqual(model.levels.nodes, { levels: [186, 348], culled: 66, switched: 414 });
const groups = model.levels.groups;
assert.equal(groups.levels[0] + groups.levels[1] + groups.culled, 24, 'every group has a level');
assert.ok(
  groups.levels[0] > 0 && groups.levels[1] > 0 && groups.culled > 0,
  'near, far and out of reach',
);
assert.ok(model.levels.changed.mean > 5, 'the levels change the picture');
assert.ok(
  model.levels.against.mean < 6,
  `chosen a group at a time it is near the picture chosen a copy at a time: ${model.levels.against.mean}`,
);
assert.match(model.skinned, /plain meshes \(no bones, no morph targets\)/);

// Nodes of one mesh and one material each cast a shadow, on WebGPU too.
const { identical } = report;
assert.equal(identical.shadows.length, 9);
for (const shade of identical.shadows)
  assert.ok(
    shade < identical.lit[0] * 0.5,
    `in a ball's shadow: ${shade} against ${identical.lit[0]}`,
  );
// A crowd of one animated character.
const { crowd } = report;
for (const [asset, baked] of Object.entries(crowd.against)) {
  // A copy at a whole frame is the picture LayaAir's own skinning gives at that time.
  for (const [pose, difference] of Object.entries(baked.poses))
    same(difference, `${asset} ${pose}`);
  assert.ok(baked.moved.mean > 0.3, `${asset}: the poses differ from one another`);
  assert.equal(baked.layout.clips.length, 2);
  assert.equal(baked.layout.clips[0].frames, 31, 'a second at 30 frames, and its end');
}
assert.equal(
  crowd.against['character.glb'].layout.frameTexels,
  48,
  'twelve bones, four texels each',
);
assert.equal(crowd.against['character30.glb'].layout.frameTexels, 120, 'thirty bones');
const five = crowd.five;
assert.deepEqual(five.stats, { copies: 500, groups: 16, drawsPerPass: 16 });
assert.ok(five.drawn.mean > 10, 'the crowd is in the picture');
assert.ok(five.draws.scene <= 2 * 16 + 2 && five.draws.shadow <= 16, JSON.stringify(five.draws));
assert.equal(five.again, 0, 'the same time again changes no copy');
assert.ok(five.later > 250 && five.later <= 500, `a frame later most copies change: ${five.later}`);
assert.deepEqual(five.back, { mean: 0, worst: 0 }, 'the same time is the same picture');
assert.equal(five.oneChanged, 1, 'a copy given another clip changes alone');
assert.ok(five.noCast.mean > 1, 'the crowd casts shadows');
assert.deepEqual(five.afterDispose, { mean: 0, worst: 0 });
assert.ok(five.updateMs < 1, `telling 500 copies the time: ${five.updateMs} ms`);
assert.match(crowd.refused.noSkin, /no skinned mesh/);
assert.match(crowd.refused.clip, /no clip Jump; it has: Bend, Sway/);
assert.match(crowd.refused.copyClip, /no clip Jump; baked: Bend, Sway/);
assert.match(crowd.refused.none, /1\.\.100000 copies/);
assert.match(crowd.refused.disposed, /live baked character/);
assert.equal(report.resourcesLeft, 0, `nothing is left behind (${report.left})`);
if (!gpuBuild) assert.ok(report.timing?.cases, `the timing page ran (${report.timingError})`);

console.log(
  `PASS instanced meshes on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu})\n` +
    `  5000 copies in ${props.stats.groups} groups against nodes: mean ${props.against.mean}, worst ${props.against.worst}\n` +
    `  LayaAir's draw counts a frame (scene, shadow): nodes ${props.nodesDraws.scene}, ${props.nodesDraws.shadow}; groups ${props.groupsDraws.scene}, ${props.groupsDraws.shadow}; looking away ${props.awayDraws.scene}\n` +
    `  model prefab of 600: mean ${model.against.mean}; draws nodes ${model.nodesDraws.scene}, ${model.nodesDraws.shadow}; groups ${model.groupsDraws.scene}, ${model.groupsDraws.shadow}; levels by group ${JSON.stringify(groups.levels)} and ${groups.culled} not drawn\n` +
    `  crowd of 500 in ${five.stats.groups} groups: draws ${five.draws.scene}, ${five.draws.shadow}; a baked copy against LayaAir's skinning ${JSON.stringify(crowd.against['character30.glb'].poses['Bend 0.5'])}; ${five.later} copies change a frame, ${five.updateMs} ms to tell them\n` +
    `  tints ${report.tints.got.map((t) => t.join(' ')).join(' | ')}; identical nodes' shadows ${identical.shadows[0]} against ${identical.lit[0]}\n` +
    (report.timing
      ? `  frame at ${report.timing.picture.join('x')}: ${Object.entries(report.timing.cases)
          .map(([name, value]) => `${name} ${value}`)
          .join(', ')}\n`
      : '') +
    `Pictures: ${path.join(out, 'evidence')}`,
);
