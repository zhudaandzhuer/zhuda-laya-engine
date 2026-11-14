#!/usr/bin/env node
// Real-GPU check of animation control, through the browser SDK.
// - `ZhudaAnimationBlend`: all of one clip is that clip as LayaAir poses
//   it; a mix of two is, bone by bone, the two poses mixed by the weights;
//   a clip laid over another from a joint up leaves the joints below alone.
// - `ZhudaModelInspector.crossFade` in seconds ends in the other clip.
// - `ZhudaTwoBoneIK` puts five hanging legs' feet on sloping ground with
//   the bones' lengths kept, and says which could not reach; `ZhudaChainIK`
//   and `ZhudaAimIK` reach and face a point.
// Most is read from the bones; the pictures are kept for looking at.
// Desktop GPU evidence only (WebGL, or WebGPU with ANIMATION_RENDERER).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { skinnedCharacterGlb } from '../tests/helpers/toon-fixture.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.ANIMATION_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-animation-control'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// ANIMATION_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.ANIMATION_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/animation-control.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
const fixtures = path.join(web, 'fixtures');
fs.mkdirSync(fixtures);
// A character on twelve bones with two clips, and a leg on three.
fs.writeFileSync(path.join(fixtures, 'character.glb'), skinnedCharacterGlb(12));
fs.writeFileSync(path.join(fixtures, 'leg.glb'), skinnedCharacterGlb(3));
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
        'window.__ANIMATION__ && (window.__ANIMATION__.ready || window.__ANIMATION__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__ANIMATION__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__ANIMATION__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__ANIMATION__.picture('${name}')`).catch(() => null);
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
if (process.env.ANIMATION_EXPLORE) {
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

// Clips mixed by weight.
const { blend } = report;
assert.deepEqual(blend.clips, [
  { name: 'Bend', seconds: 1 },
  { name: 'Sway', seconds: 1 },
]);
for (const [name, all] of [
  ['Bend', blend.allBend],
  ['Sway', blend.allSway],
]) {
  assert.ok(all.turns <= 1e-6, `all of ${name} is ${name}, bone by bone: ${all.turns}`);
  same(all.picture, `all of ${name} against LayaAir's own pose`);
}
for (const name of ['half', 'quarter', 'most']) {
  const mixed = blend[name];
  assert.ok(mixed.turns <= 1e-5, `${name}: each bone is the two poses mixed (${mixed.turns})`);
  assert.ok(mixed.fromBend > 0.05 && mixed.fromSway > 0.05, `${name}: neither clip's own picture`);
}
// More of a clip is nearer that clip's picture.
assert.ok(
  blend.quarter.fromBend < blend.half.fromBend && blend.half.fromBend < blend.most.fromBend,
);
assert.ok(blend.again <= 1e-9, 'the same weights and phase: the same pose');
assert.ok(blend.nextRound <= 1e-6, 'a round later: the same pose');
assert.ok(blend.overlay.below <= 1e-6, 'below the joint the pose is left alone');
assert.ok(blend.overlay.above <= 1e-6, 'from the joint up it is the clip laid over');
assert.ok(blend.overlay.picture > 0.05, 'and the picture changed');
assert.ok(blend.overlayHalf <= 1e-4, `half an overlay is half way: ${blend.overlayHalf}`);
assert.match(blend.refused.owned, /owned/);
assert.match(blend.refused.weights, /a weight for each clip/);
assert.match(blend.refused.zero, /every weight is 0/);
assert.match(blend.refused.clip, /Jump is not one of its clips/);
assert.match(blend.refused.under, /name the nodes/);
assert.match(blend.refused.unknown, /no clip Jump/);
assert.match(blend.refused.disposed, /Disposed/);

// LayaAir's cross-fade in seconds.
assert.deepEqual(
  [report.crossFade.before, report.crossFade.after],
  ['Bend', 'Sway'],
  'the fade ends in the other clip',
);
assert.match(report.crossFade.refused.state, /Unknown animation state/);
assert.match(report.crossFade.refused.seconds, /Invalid animation cross-fade/);

// Feet on sloping ground.
assert.equal(report.feet.length, 5);
for (const foot of report.feet) {
  for (const stretch of foot.stretch)
    assert.ok(Math.abs(stretch) < 1e-5, 'the bones keep their lengths');
  assert.equal(foot.drawn, true, `the leg at ${foot.x} is drawn along its shin`);
  if (foot.x === -2) {
    // The ground is further than this leg is long.
    assert.equal(foot.reached, false);
    assert.ok(foot.miss > 0.05);
  } else {
    assert.equal(foot.reached, true, `the leg at ${foot.x} reaches the ground`);
    assert.ok(foot.miss < 1e-4, `its foot is on the ground: ${foot.miss}`);
    assert.ok(foot.knee[0] > foot.foot[0] + 0.2, 'its knee bends toward the pole');
  }
}
const close = (got, want, tolerance, what) =>
  assert.ok(
    got.every((v, i) => Math.abs(v - want[i]) <= tolerance),
    `${what}: ${got} against ${want}`,
  );
close(report.halfWeight.foot, report.halfWeight.want, 1e-3, 'half the weight is half the way');
assert.ok(report.afterClip.moved > 0.5 && report.afterClip.reached && report.afterClip.miss < 1e-4);
// While LayaAir plays a clip: solved after its animation the foot stays on its target and is drawn there.
const playing = report.whilePlaying;
assert.ok(playing.solves >= 12 && playing.miss < 1e-4 && playing.drawn, JSON.stringify(playing));
assert.ok(playing.undone > 0.5, 'a solve in a late update is undone by the animation');
assert.ok(
  playing.preRender.miss < 1e-3 && !playing.preRender.drawn,
  'a solve before the draw moves the bones and not the mesh',
);
assert.equal(playing.stopped, true);

// A chain and an aim.
const { chain, aim } = report;
assert.ok(chain.reached && chain.miss < 1e-3 && chain.drawn, JSON.stringify(chain));
assert.ok(chain.rootMoved < 1e-6 && chain.stretch < 1e-5, 'root fixed, lengths kept');
assert.equal(chain.beyond.reached, false);
assert.ok(Math.abs(chain.beyond.endX - 0.333) < 0.002, 'out of reach: stretched toward it');
assert.ok(aim.whole > 0.99999, `the box faces the point: ${aim.whole}`);
assert.ok(Math.abs(aim.limitedDeg - 20) < 0.01, `turned by the most allowed: ${aim.limitedDeg}`);
assert.match(report.ikRefused.nodes, /live nodes/);
assert.match(report.ikRefused.chain, /2\.\.64 nodes/);
assert.match(report.ikRefused.weight, /weight 0\.\.1/);
assert.match(report.ikRefused.angle, /maxDeg/);
assert.equal(report.resourcesLeft, 0, 'nothing is left behind');

console.log(
  `PASS animation control on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu})\n` +
    `  a pose from two clips on twelve bones: ${blend.applyMs} ms\n` +
    `  blend: bones off the mixed poses by ${blend.half.turns.toExponential(1)} (half), ${blend.quarter.turns.toExponential(1)} (quarter); overlay ${blend.overlay.below} below, ${blend.overlay.above} above the joint\n` +
    `  feet on the slope: ${report.feet.map((foot) => (foot.reached ? foot.miss : 'out of reach')).join(', ')}; knees ${report.feet.map((foot) => foot.knee[0]).join(', ')}\n` +
    `  while a clip plays: after the animation ${playing.miss} from the target; in a late update ${playing.undone}; before the draw the mesh stays behind\n` +
    `  chain ${chain.miss} from its target; aim ${aim.whole}, limited to ${aim.limitedDeg} degrees\n` +
    `Pictures: ${path.join(out, 'evidence')}`,
);
