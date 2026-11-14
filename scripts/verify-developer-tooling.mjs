#!/usr/bin/env node
// Real-GPU check of the developer tooling, through the browser SDK: helper
// lines where the arithmetic says they are, LayaAir's statistics panel, a
// shader that does not compile with the lines it points at, the profiler's
// draws, triangles and GPU time, and the transform gizmo dragged along its
// handles.
// Desktop GPU evidence only (WebGL, or WebGPU with TOOLING_RENDERER).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { skinnedCharacterGlb } from '../tests/helpers/toon-fixture.mjs';
import { createModelEditorServer } from '../packages/compiler/model-editor.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.TOOLING_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-developer-tooling'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// TOOLING_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.TOOLING_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/developer-tooling.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
// A character on twelve bones, for the skeleton helper.
fs.mkdirSync(path.join(web, 'fixtures'));
fs.writeFileSync(path.join(web, 'fixtures/character.glb'), skinnedCharacterGlb(12));
fs.writeFileSync(
  path.join(web, 'live.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:${W}px;height:${H}px}</style>` +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);
async function modelEditor() {
  const project = path.join(out, 'project');
  fs.mkdirSync(path.join(project, 'assets/models'), { recursive: true });
  fs.writeFileSync(path.join(project, 'assets/models/character.glb'), skinnedCharacterGlb(12));
  const editor = await createModelEditorServer({
    projectRoot: project,
    asset: 'assets/models/character.glb',
    host: '127.0.0.1',
    port: 0,
    engineRoot,
  });
  const page = await chromeFixture();
  try {
    const { port } = await editor.listening;
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.send('Page.navigate', {
      url: `http://127.0.0.1:${port}/?asset=assets/models/character.glb`,
    });
    await page.waitFor(
      'window.__ZHUDA_MODEL_EDITOR__?.ready && window.__ZHUDA_MODEL_EDITOR__.report().ready',
    );
    const state = () => page.evaluate('window.__ZHUDA_MODEL_EDITOR__.report()');
    const settle = () =>
      page.evaluate('(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);})()');
    const box = await page.evaluate(
      '(()=>{const r=document.querySelector("#stage canvas").getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};})()',
    );
    const mouse = (type, x, y, extra = {}) =>
      page.send('Input.dispatchMouseEvent', {
        type,
        x: box.x + x,
        y: box.y + y,
        button: type === 'mouseMoved' && !extra.buttons ? 'none' : 'left',
        clickCount: type === 'mouseMoved' ? 0 : 1,
        ...extra,
      });
    const dragOn = async (from, to) => {
      await mouse('mouseMoved', from[0], from[1]);
      await mouse('mousePressed', from[0], from[1], { buttons: 1 });
      for (let i = 1; i <= 8; i++)
        await mouse(
          'mouseMoved',
          from[0] + ((to[0] - from[0]) * i) / 8,
          from[1] + ((to[1] - from[1]) * i) / 8,
          { buttons: 1 },
        );
      await mouse('mouseReleased', to[0], to[1]);
      await settle();
    };
    const result = { canvas: [box.width, box.height] };
    const first = await state();
    result.framed = first.view;
    await page.screenshot(path.join(out, 'evidence', 'editor-framed.png'));
    // A drag on the empty part of the view turns it; the wheel moves it away.
    await dragOn([40, 60], [140, 100]);
    result.turned = (await state()).view;
    await mouse('mouseWheel', 40, 60, { deltaX: 0, deltaY: 120 });
    await settle();
    result.zoomed = (await state()).view;
    await page.screenshot(path.join(out, 'evidence', 'editor-turned.png'));
    // Handles on the selected node (the model's root), and a drag along its x arrow.
    await page.evaluate('document.querySelector("#gizmo-translate").click()');
    await settle();
    // Where the x handle is on the screen, from the camera's own numbers.
    const handle = await page.evaluate(`(() => {
      const find = (n) => { if (n instanceof Laya.Camera) return n; for (let i = 0; i < n.numChildren; i++) { const r = find(n.getChildAt(i)); if (r) return r; } };
      const camera = find(Laya.stage), m = camera.transform.worldMatrix.elements;
      const at = window.__ZHUDA_MODEL_EDITOR__.report().selectedTransform.position;
      const h = Math.tan(camera.fieldOfView / 2 * Math.PI / 180), aspect = camera.aspectRatio;
      const eye = [m[12], m[13], m[14]], right = [m[0], m[1], m[2]], up = [m[4], m[5], m[6]], forward = [-m[8], -m[9], -m[10]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const pixel = (p) => { const d = p.map((v, i) => v - eye[i]), depth = dot(d, forward);
        return [(dot(d, right) / (depth * h * aspect) + 1) / 2 * ${box.width}, (1 - dot(d, up) / (depth * h)) / 2 * ${box.height}]; };
      const length = 2 * h * dot(at.map((v, i) => v - eye[i]), forward) * 0.15;
      return { length, from: pixel([at[0] + length * 0.5, at[1], at[2]]), to: pixel([at[0] + length * 1.5, at[1], at[2]]), at };
    })()`);
    await mouse('mouseMoved', handle.from[0], handle.from[1]);
    await settle();
    result.hovered = (await state()).gizmo;
    await page.screenshot(path.join(out, 'evidence', 'editor-gizmo.png'));
    const viewBefore = (await state()).view;
    await dragOn(handle.from, handle.to);
    const moved = await state();
    result.moved = {
      handle: handle.length,
      from: handle.at,
      to: moved.selectedTransform.position,
      // The pointer was the handle's: the view did not turn.
      viewKept: JSON.stringify(moved.view) === JSON.stringify(viewBefore),
      readout: await page.evaluate('document.querySelector("#transform-readout").textContent'),
    };
    await page.evaluate('document.querySelector("#gizmo-reset").click()');
    await settle();
    result.reset = (await state()).selectedTransform.position;
    await page.evaluate('document.querySelector("#gizmo-off").click()');
    await settle();
    result.off = (await state()).gizmo;
    result.errors = page.errors;
    return result;
  } finally {
    await page.close();
    await editor.close();
  }
}

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
  let panel = false;
  for (let i = 0; i < 1200; i++) {
    if (
      await browser.evaluate(
        'window.__TOOLING__ && (window.__TOOLING__.ready || window.__TOOLING__.error)',
      )
    )
      break;
    // The statistics panel is a canvas of its own over the page: only a
    // picture of the page shows it.
    if (!panel && (await browser.evaluate('window.__TOOLING__?.statsShown === true'))) {
      panel = true;
      await browser.screenshot(path.join(out, 'evidence', 'stats-panel.png'));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__TOOLING__')),
    consoleErrors: browser.errors,
    gpuWarnings: browser.consoleMessages.filter((m) =>
      /unCaptured|INVALID|GL_|WebGPU|ERROR|undeclared|compile|failed/i.test(m),
    ),
  };
  report.pictures = [];
  for (const name of (await browser.evaluate('window.__TOOLING__.pictures()').catch(() => [])) ??
    []) {
    const url = await browser.evaluate(`window.__TOOLING__.picture('${name}')`).catch(() => null);
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
// The model editor (WebGL): its view turned and zoomed with the pointer, and a
// node moved by a handle and put back.
if (!gpuBuild) report.editor = await modelEditor();
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');
if (process.env.TOOLING_EXPLORE) {
  console.log(JSON.stringify(report, null, 1));
  process.exit(0);
}

assert.equal(report.error, undefined, report.error);
assert.equal(report.ready, true, 'the fixture finished');
assert.deepEqual(report.errors, [], 'no page errors');
assert.deepEqual(report.consoleErrors, [], 'no console errors');
assert.equal(report.renderer, gpuBuild ? 'webgpu' : 'webgl');
// The one shader that is meant not to compile is all LayaAir warns about.
assert.ok(
  report.gpuWarnings.length > 0 &&
    report.gpuWarnings.every((text) => /ZhudaToolingBroken|notDeclared/.test(text)),
  JSON.stringify(report.gpuWarnings),
);
assert.deepEqual(report.rendererErrors, [], 'no renderer errors but the expected one');
const close = (value, want, tolerance, what) =>
  assert.ok(Math.abs(value - want) <= tolerance, `${what}: ${value} (want ${want} ± ${tolerance})`);
// How far a pixel may be from a helper's colour and still be that helper (of 255).
const SEEN = 12;

// 1. Every helper is where the arithmetic says, in its colour.
const sheet = report.sheet;
assert.equal(sheet.lines, sheet.expected, 'axes, grid, bounds, three lights and a camera');
assert.equal(sheet.boneLines, sheet.boneLinesExpected, 'a line for every bone but the root');
assert.equal(sheet.bones, 12);
assert.equal(sheet.dropped, 0);
for (const [name, off] of Object.entries(sheet.off))
  assert.ok(off <= SEEN, `${name} is drawn where it should be (off by ${off})`);
assert.ok(report.follows.oldPlace > 60, 'the bounds left where the crate was');
assert.ok(report.follows.newPlace <= SEEN, 'and are where it is now');
assert.equal(report.removed.lines, sheet.expected - 18, 'the grid alone is gone');
assert.ok(report.removed.grid > 30 && report.removed.axisX <= SEEN);
assert.equal(report.sheetGone, 0, 'disposed, the picture is the first one');

// 2. Lines are hidden by what is in front of them unless asked otherwise.
assert.ok(report.onTop.hiddenInside > 60, 'inside the crate the line is hidden');
assert.ok(report.onTop.hiddenOutside <= SEEN && report.onTop.shownInside <= SEEN);

// 3. The sun's cascades.
assert.equal(report.cascades.linesWithoutShadows, 0, 'nothing while there are no shadows');
assert.equal(report.cascades.spheres.length, 2);
assert.equal(report.cascades.lines, 2 * 3 * 48);
assert.ok(report.cascades.crateInside < 1, 'the crate is inside the far cascade');
assert.ok(report.cascades.nearestFirst[0] < report.cascades.nearestFirst[1]);

// 4. The statistics panel, in the game's own picture.
assert.ok(report.stats.shown > 20000, `the panel is drawn (${report.stats.shown} pixels)`);
assert.equal(report.stats.afterHide, 0, 'hidden, the picture is as before');
assert.ok(report.stats.shownAgain > 20000, 'shown again after it was hidden');
assert.equal(report.stats.afterSecondHide, 0);
assert.ok(report.stats.fps > 0);

// 5. A shader that does not compile: its log and the lines round the one it names.
assert.equal(report.shader.errors.length, 1);
const failed = report.shader.errors[0];
const named =
  /^Shader compile failed \(fragment\): ERROR: \d*:(\d+): 'notDeclared' : undeclared identifier/.exec(
    failed,
  );
assert.ok(named, failed);
const line = Number(named[1]);
assert.match(
  failed,
  new RegExp(
    `\\n${line - 1}: float ok ?= ?1\\.0;\\n${line}: return vec4\\(notDeclared, ?ok\\);\\n${line + 1}: \\}$`,
  ),
);

// 6. The profiler: ten more boxes are ten more draws and 120 more triangles.
const profiler = report.profiler;
assert.equal(
  profiler.source,
  gpuBuild ? 'intercepted WebGPU render pass draws' : 'intercepted WebGL calls',
);
assert.equal(profiler.addedDraws, 10);
assert.equal(profiler.addedTriangles, 120);
assert.equal(profiler.restored, true, "the browser's own methods are back");
if (gpuBuild) assert.equal(profiler.gpuTiming, true, 'the device has timestamp queries');
if (profiler.gpuTiming) {
  assert.ok(profiler.gpu.light.timed >= 30 && profiler.gpu.heavy.timed >= 30, 'frames were timed');
  assert.ok(profiler.gpu.light.ms > 0 && profiler.gpu.light.ms < 20, `${profiler.gpu.light.ms} ms`);
  assert.ok(
    profiler.gpu.heavy.ms > profiler.gpu.light.ms + 0.5,
    `500 sheets of glass cost more (${profiler.gpu.light.ms} -> ${profiler.gpu.heavy.ms} ms)`,
  );
} else assert.match(profiler.gpuReason, /unavailable/);

// 7. The gizmo: a drag of one handle's length along a handle moves the crate that far.
const gizmo = report.gizmo;
const START = [0, 0.5, 0];
for (const [index, name] of ['x', 'y', 'z'].entries()) {
  const moved = gizmo.moved[name];
  assert.ok(moved.hit && moved.dragging, `${name}: the handle was taken`);
  moved.to.forEach((value, i) =>
    close(value, START[i] + (i === index ? gizmo.reach : 0), 0.02, `moved along ${name}`),
  );
  assert.ok(gizmo.drawn[name] <= SEEN, `the ${name} handle is drawn in its colour`);
}
assert.equal(gizmo.missed, false, "away from the handles the pointer is not the gizmo's");
assert.equal(gizmo.hovered.axis, 'x');
assert.ok(gizmo.hovered.colour <= SEEN, 'the handle under the pointer lights up');
assert.ok(gizmo.turned.hit && gizmo.turned.axis === 'y');
[0, Math.SQRT1_2, 0, Math.SQRT1_2].forEach((want, i) =>
  close(gizmo.turned.rotation[i], want, 0.01, 'a quarter turn about Y'),
);
assert.ok(gizmo.scaled.hit);
[1, 1.5, 1].forEach((want, i) => close(gizmo.scaled.scale[i], want, 0.01, 'half as tall again'));
assert.deepEqual(gizmo.cancelled, [1, 1, 1], 'let go of: as it was');
assert.equal(report.gizmoGone, 0, 'disposed, the picture is the first one');

// Nothing left behind by the tools. LayaAir keeps the text atlas its panel
// made, and on WebGPU the target of the frame the broken shader threw in.
const left = report.left;
assert.deepEqual([left.sheet, left.onTop, left.cascades], [0, 0, 0], JSON.stringify(left));
assert.ok(left.stats <= 1, JSON.stringify(left));
assert.ok(left.shader - left.stats <= (gpuBuild ? 1 : 0), JSON.stringify(left));
assert.equal(left.profiler, left.shader);
assert.equal(left.gizmo, left.profiler);

console.log(
  `PASS developer tooling on ${report.renderer} (${report.gpu}): ${sheet.lines + sheet.boneLines} helper lines where they should be; ` +
    `ten boxes are ${profiler.addedDraws} draws and ${profiler.addedTriangles} triangles; ` +
    (profiler.gpuTiming
      ? `GPU ${profiler.gpu.light.ms.toFixed(2)} -> ${profiler.gpu.heavy.ms.toFixed(2)} ms under glass; `
      : `GPU time unavailable (${profiler.gpuReason}); `) +
    `the gizmo moved, turned and scaled; evidence in ${path.join(out, 'evidence')}`,
);

// 8. The model editor: its pointer turns and zooms the view, and a handle moves a node.
if (!gpuBuild) {
  const editor = report.editor;
  assert.deepEqual(editor.errors, [], 'no page errors in the editor');
  assert.deepEqual([editor.framed.orbitX, editor.framed.orbitY], [0, 0]);
  close(editor.turned.orbitX, 35, 0.5, 'a drag of 100 pixels turns the view 35°');
  close(editor.turned.orbitY, 14, 0.5, 'and 40 pixels tilts it 14°');
  close(editor.zoomed.distance, editor.turned.distance * 1.08, 1e-6, 'the wheel moves it away');
  assert.equal(editor.hovered.mode, 'translate');
  assert.equal(editor.hovered.axis, 'x', 'the x handle is under the pointer');
  close(
    editor.moved.to[0] - editor.moved.from[0],
    editor.moved.handle,
    editor.moved.handle * 0.05,
    'dragged one handle along x',
  );
  close(editor.moved.to[1], editor.moved.from[1], 1e-6, 'and not along y');
  close(editor.moved.to[2], editor.moved.from[2], 1e-6, 'or z');
  assert.equal(editor.moved.viewKept, true, 'the view did not turn while a handle was dragged');
  assert.ok(editor.moved.readout.includes(editor.moved.to[0].toFixed(3)), editor.moved.readout);
  editor.reset.forEach((value, i) => close(value, editor.moved.from[i], 1e-6, 'reset'));
  assert.equal(editor.off.mode, 'off');
  console.log(
    `PASS model editor: the view turned ${editor.turned.orbitX}° and zoomed; a node moved ${editor.moved.handle.toFixed(3)} along its x handle and was put back`,
  );
}
