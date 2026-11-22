#!/usr/bin/env node
// Real draw of a VRM 1.0 avatar through the browser SDK: the avatar made by
// tests/fixtures/vrm-avatar.mjs (no third-party model) loaded through
// ZhudaModelLibrary and given to ZhudaVrm (tests/fixtures/vrm.ts). Checks
// what each part of VRM does to the picture and to the nodes: MToon drawn
// as toon (a shade colour on the side away from the sun, an outline), the
// expressions (lids close, the mouth opens, overrides, a binary one, a
// colour and a texture offset), the gaze (by angles and by a point), the
// three node constraints, the spring bones (they swing behind a moving
// head, stay out of its collider, settle, and replay to the bit), thirty
// made and let go.
//
// VRM_RENDERER=webgl (default) or webgpu, VRM_OUT (evidence folder).
// Desktop evidence only; not a phone, not a third-party model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { gpuLabelExpression } from './lib/gpu-label.mjs';
import { buildZhudaTestVrm } from '../tests/fixtures/vrm-avatar.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const renderer = process.env.VRM_RENDERER || 'webgl';
if (!['webgl', 'webgpu'].includes(renderer)) throw Error('VRM_RENDERER is webgl or webgpu');
const profile = renderer === 'webgpu' ? '3d-gltf-webgpu' : '3d-gltf';
const out = path.resolve(process.env.VRM_OUT || path.join(os.tmpdir(), 'zhuda-vrm'));
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/vrm.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(path.join(web, 'avatar.vrm'), buildZhudaTestVrm().glb);
fs.writeFileSync(
  path.join(web, 'index.html'),
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:480px;height:360px}</style>' +
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
      : file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.wasm')
          ? 'application/wasm'
          : 'application/octet-stream',
  });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const report = { renderer, failures: [] };
const fail = (message) => report.failures.push(message);
const check = (ok, message) => ok || fail(message);
const browser = await chromeFixture();
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 480,
    height: 360,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/index.html`,
  });
  await browser.waitFor('window.__VRM__?.ready || window.__VRM__?.errors.length', 180000);
  const errors = await browser.evaluate('__VRM__.errors');
  if (errors.length) throw Error(`page failed: ${errors.join('; ')}`);
  report.gpu = await browser.evaluate(gpuLabelExpression(renderer === 'webgpu'));
  const call = (name) => browser.evaluate(`__VRM__.${name}()`, { timeoutMs: 180000 });

  const loaded = await browser.evaluate('__VRM__.loaded');
  report.loaded = loaded;
  check(
    loaded.toonMaterials.join() === '0,1',
    `toon materials for MToon 0 and 1: ${loaded.toonMaterials}`,
  );
  check(loaded.slotsAreToon, 'every slot of an MToon material holds its toon material');
  check(loaded.springSets === 1, `one set of spring bones: ${loaded.springSets}`);
  check(
    loaded.bones.join() === 'hips,head,leftEye,rightHand',
    `humanoid bones by name: ${loaded.bones}`,
  );
  check(
    loaded.expressions.join() === 'blink,aa,happy,angry,surprised,wink',
    `expressions: ${loaded.expressions}`,
  );
  // Only the first-person note: everything else of the file is applied.
  check(
    loaded.issues.length === 1 && /firstPerson/.test(loaded.issues[0]),
    `issues: ${loaded.issues.join(' | ')}`,
  );
  check(loaded.pbrVsToon > 2000, `toon draws other pixels than glTF PBR: ${loaded.pbrVsToon}`);
  // The shade colour (0.55, 0.22, 0.2) is redder against its green than the base (1, 0.72, 0.6).
  const ratio = (c) => c[0] / Math.max(1, c[1]);
  check(
    ratio(loaded.shaded) > ratio(loaded.lit) * 1.15 &&
      ratio(loaded.pbrShaded) < ratio(loaded.pbrLit) * 1.1,
    `the side away from the sun takes the shade colour: lit ${loaded.lit}, shaded ${loaded.shaded}`,
  );
  check(
    loaded.lit[0] > loaded.shaded[0],
    `the lit side is brighter: ${loaded.lit} vs ${loaded.shaded}`,
  );
  check(
    loaded.outlinePixels > 150,
    `the outline draws a line round the model: ${loaded.outlinePixels}`,
  );

  const ex = await call('expressions');
  report.expressions = ex;
  const pupils = (s) => s.pupils[0] + s.pupils[1];
  check(
    ex.blink.morphs.blink === 1 && ex.rest.morphs.blink === 0,
    `blink's morph weight: ${JSON.stringify(ex.blink.morphs)}`,
  );
  check(
    pupils(ex.blink) < pupils(ex.rest) * 0.4,
    `the lids cover the pupils: ${pupils(ex.rest)} to ${pupils(ex.blink)}`,
  );
  check(ex.blinkChanged > 40, `blinking changes the picture: ${ex.blinkChanged}`);
  check(ex.aa.mouth > ex.rest.mouth + 40, `aa opens the mouth: ${ex.rest.mouth} to ${ex.aa.mouth}`);
  // happy blocks blink: the eyes stay open; it opens the mouth a little and reddens the skin.
  check(
    ex.happyBlink.applied.blink === 0 && ex.happyBlink.morphs.blink === 0,
    `happy blocks blink: ${JSON.stringify(ex.happyBlink.applied)}`,
  );
  check(
    Math.abs(ex.happyBlink.morphs.aa - 0.4) < 1e-6,
    `happy's mouth: ${ex.happyBlink.morphs.aa}`,
  );
  check(
    pupils(ex.happyBlink) > pupils(ex.rest) * 0.8,
    `eyes open under happy: ${pupils(ex.happyBlink)}`,
  );
  check(
    ex.happyBlink.skin[1] < ex.rest.skin[1] - 15,
    `happy's colour bind on the MToon skin: ${ex.rest.skin} to ${ex.happyBlink.skin}`,
  );
  // angry turns the pupils (a plain glTF material) red and blends the mouth away.
  check(
    ex.angry.redPupils[0] + ex.angry.redPupils[1] > 20 &&
      ex.rest.redPupils[0] + ex.rest.redPupils[1] === 0,
    `angry's red pupils: ${ex.angry.redPupils}`,
  );
  check(ex.angryAa.applied.aa === 0, `angry blends aa to 0: ${ex.angryAa.applied.aa}`);
  // wink is binary at 0.8 of blink: nothing at 0.4, all of it at 0.6.
  check(
    ex.winkLow.morphs.blink === 0 && Math.abs(ex.winkHigh.morphs.blink - 0.8) < 1e-6,
    `wink: ${ex.winkLow.morphs.blink}, ${ex.winkHigh.morphs.blink}`,
  );
  check(
    ex.hairTiling.join() === '1,1,0.25,0',
    `surprised moves the hair texture's offset: ${ex.hairTiling}`,
  );
  check(ex.backToRest === 0, `all expressions off is the rest picture again: ${ex.backToRest}`);

  const gaze = await call('gaze');
  report.gaze = gaze;
  // 30° to the left: the left eye takes its outer range (12° at 90°), the right its inner (10°).
  check(
    Math.abs(gaze.byAngles.left - 4) < 1e-3 && Math.abs(gaze.byAngles.right - 10 / 3) < 1e-3,
    `eyes by angles: ${gaze.byAngles.left}, ${gaze.byAngles.right}`,
  );
  check(
    Math.abs(gaze.byPoint.gaze.yaw - gaze.expectedYaw) < 0.05 &&
      Math.abs(gaze.byPoint.gaze.pitch) < 0.05,
    `gaze at a point: ${JSON.stringify(gaze.byPoint.gaze)} for ${gaze.expectedYaw}`,
  );
  // The camera looks down −Z: the model's left (+X) is the right of the picture.
  check(
    gaze.pupilX.before.every((x, i) => x !== null && gaze.pupilX.after[i] > x + 0.3),
    `the pupils move to the picture's right: ${JSON.stringify(gaze.pupilX)}`,
  );

  const con = await call('constraints');
  report.constraints = con;
  check(
    Math.abs(con.badgeAngle - 30) < 1e-3,
    `rotation: the badge turns with the head: ${con.badgeAngle}`,
  );
  check(
    Math.abs(con.twistAngle - 20) < 1e-3,
    `roll: the twist takes half the hand's 40°: ${con.twistAngle}`,
  );
  check(con.facing > 0.9999, `aim: the pointer's +Z faces the hand: ${con.facing}`);
  check(con.badgeAtRest < 1e-3, `back at rest with the head: ${con.badgeAtRest}`);

  const springs = await call('springs');
  report.springs = springs;
  check(springs.lag > 0.02, `the hair lags behind the moving head: ${springs.lag} m`);
  check(springs.inside === 0, `no joint inside the head's collider: ${springs.inside}`);
  check(springs.energy < 1e-6, `it settles: kinetic energy ${springs.energy}`);
  check(
    springs.settleDistance < 0.01,
    `it settles where it hung (within 1 cm of the start under gravity): ${springs.settleDistance}`,
  );
  check(springs.swungPixels > 100, `the swing shows in the picture: ${springs.swungPixels}`);
  check(springs.replaySame, 'the same deltas replay the same tail to the last bit');

  const cycles = await call('cycles');
  report.cycles = cycles;
  check(!cycles.errors.length, cycles.errors.join('; '));
  check(
    cycles.report.instances === 1,
    `only the main model is left: ${JSON.stringify(cycles.report)}`,
  );
  check(
    cycles.ownStillToon && cycles.toonBeforeCycles,
    'the main model keeps its toon materials through the cycles',
  );
  const disposed = await call('disposeMain');
  report.disposed = disposed;
  check(
    disposed.restored && disposed.toonDestroyed,
    `dispose puts the model's materials back: ${JSON.stringify(disposed)}`,
  );

  for (const name of await browser.evaluate('__VRM__.pictures()')) {
    const url = await browser.evaluate(`__VRM__.picture(${JSON.stringify(name)})`);
    fs.writeFileSync(
      path.join(out, 'evidence', `${renderer}-${name}.png`),
      Buffer.from(url.split(',')[1], 'base64'),
    );
  }
  const pageErrors = await browser.evaluate('__VRM__.errors');
  if (pageErrors.length) fail(`page errors: ${pageErrors.join('; ')}`);
  report.consoleErrors = browser.errors;
  if (browser.errors.length) fail(`console errors: ${browser.errors.join('; ')}`);
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({ renderer, gpu: report.gpu, failures: report.failures, evidence: out }, null, 2),
);
if (report.failures.length) process.exit(1);
