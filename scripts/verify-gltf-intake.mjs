#!/usr/bin/env node
// Real-GPU check of the glTF intake through the browser SDK, each form drawn
// beside a plain reference of the same content:
// - a torus quantized (KHR_mesh_quantization) and Meshopt-compressed under the
//   ratified name with the OCTAHEDRAL and COLOR filters, and the same
//   quantized data uncompressed, against the float file;
// - a picture as lossless WebP (alone, and with a different PNG fallback) and
//   as AVIF, against the PNG one; a texture that offers AVIF, WebP and a PNG,
//   each a different picture, on this device and through libraries told the
//   device decodes less; the device asked while the main thread is busy;
// - pictures shared between material slots: the textures LayaAir's own parse
//   keeps against the engine's; a picture that does not decode;
// - a room with KHR_lights_punctual lights and a camera on named nodes, against
//   the plain room lit by hand from the documented mapping; an orthographic
//   camera, by where the picture lands in the frame;
// - a compressed file refused, with its report code, by a library without the
//   decoder; thirty load/unload cycles of four models at once;
// - LayaAir's own embedded-picture path against the engine's, timed, with the
//   JavaScript heap each keeps.
// Pictures for a person to look at are written beside the report.
// Desktop GPU evidence only (WebGL, or WebGPU with INTAKE_RENDERER=webgpu);
// not mobile, not other browsers' decoders.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import sharp from 'sharp';
import { PNG } from 'pngjs';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import {
  quantizedTorus,
  picturePlane,
  testPicture,
  litRoom,
  bigPicturePlane,
  orthoPlane,
  sharedPictures,
  ROOM,
  ORTHO,
} from '../tests/fixtures/gltf-intake.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.INTAKE_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-gltf-intake'),
);
const web = path.join(out, 'web'),
  evidence = path.join(out, 'evidence');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(evidence, { recursive: true });
// INTAKE_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.INTAKE_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
fs.mkdirSync(path.join(web, 'assets'), { recursive: true });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/gltf-intake.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(web, 'live.html'),
  '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:800px;height:600px}</style>' +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);

// The files, made here.
const raw = (picture) => ({
  raw: { width: picture.width, height: picture.height, channels: 4 },
});
const picture = testPicture(256),
  inverted = testPicture(256, { invert: true }),
  turned = testPicture(256, { turn: true }),
  large = testPicture(1024),
  largeInverted = testPicture(1024, { invert: true });
const png = await sharp(picture.pixels, raw(picture)).png().toBuffer();
const invertedPng = await sharp(inverted.pixels, raw(inverted)).png().toBuffer();
const turnedPng = await sharp(turned.pixels, raw(turned)).png().toBuffer();
const largePng = await sharp(large.pixels, raw(large)).png().toBuffer();
const largeInvertedPng = await sharp(largeInverted.pixels, raw(largeInverted)).png().toBuffer();
const webp = await sharp(picture.pixels, raw(picture)).webp({ lossless: true }).toBuffer();
const invertedWebp = await sharp(inverted.pixels, raw(inverted))
  .webp({ lossless: true })
  .toBuffer();
// A PNG whose header is whole and whose picture data is not: no decoder takes it.
const brokenPng = Buffer.concat([png.subarray(0, 40), Buffer.alloc(png.length - 40, 0x5a)]);
const avif = await sharp(picture.pixels, raw(picture))
  .avif({ lossless: true, chromaSubsampling: '4:4:4' })
  .toBuffer();
const ring = await quantizedTorus(png);
// A large picture of soft gradients and fine grain, for timing the embedded-picture path.
const bigSize = 2048,
  big = Buffer.alloc(bigSize * bigSize * 3);
for (let y = 0, s = 7; y < bigSize; y++)
  for (let x = 0; x < bigSize; x++) {
    s = (s * 1103515245 + 12345) >>> 0;
    const grain = (s >>> 24) % 24;
    big.set(
      [
        ((x * 255) / bigSize + grain) & 255,
        ((y * 255) / bigSize + grain) & 255,
        (128 + grain * 3) & 255,
      ],
      (y * bigSize + x) * 3,
    );
  }
const bigPng = await sharp(big, { raw: { width: bigSize, height: bigSize, channels: 3 } })
  .png()
  .toBuffer();
const files = {
  'ring-reference.glb': ring.reference,
  'ring-quantized.glb': ring.quantized,
  'ring-quantized-raw.glb': ring.quantizedRaw,
  'picture-png.glb': picturePlane({ images: [['image/png', png]], texture: { source: 0 } }),
  'picture-webp.glb': picturePlane({
    images: [['image/webp', webp]],
    texture: { extensions: { EXT_texture_webp: { source: 0 } } },
    extension: 'EXT_texture_webp',
    required: true,
  }),
  // The fallback is a different picture: matching the PNG one shows the WebP was used.
  'picture-webp-fallback.glb': picturePlane({
    images: [
      ['image/webp', webp],
      ['image/png', invertedPng],
    ],
    texture: { source: 1, extensions: { EXT_texture_webp: { source: 0 } } },
    extension: 'EXT_texture_webp',
  }),
  'picture-avif.glb': picturePlane({
    images: [['image/avif', avif]],
    texture: { extensions: { EXT_texture_avif: { source: 0 } } },
    extension: 'EXT_texture_avif',
    required: true,
  }),
  'picture-inverted.glb': picturePlane({
    images: [['image/png', invertedPng]],
    texture: { source: 0 },
  }),
  'picture-turned.glb': picturePlane({
    images: [['image/png', turnedPng]],
    texture: { source: 0 },
  }),
  // Three different pictures on one texture: the picture drawn names the image used.
  'picture-avif-webp.glb': picturePlane({
    images: [
      ['image/avif', avif],
      ['image/webp', invertedWebp],
      ['image/png', turnedPng],
    ],
    texture: {
      source: 2,
      extensions: { EXT_texture_avif: { source: 0 }, EXT_texture_webp: { source: 1 } },
    },
    extension: ['EXT_texture_avif', 'EXT_texture_webp'],
  }),
  'picture-broken.glb': picturePlane({
    images: [['image/png', brokenPng]],
    texture: { source: 0 },
  }),
  // Four materials on one picture; one material with colour and a packed
  // metallic-roughness and occlusion picture.
  'shared-picture.glb': sharedPictures({ pngs: [largePng], materials: 4 }),
  'orm-picture.glb': sharedPictures({ pngs: [largePng, largeInvertedPng], orm: true }),
  'ortho-plane.glb': orthoPlane(png),
  'room-plain.glb': litRoom({ lights: false }),
  'room-lights.glb': litRoom({ lights: true }),
  'big-picture.glb': bigPicturePlane(bigPng),
};
for (const [name, bytes] of Object.entries(files))
  fs.writeFileSync(path.join(web, 'assets', name), bytes);
fs.writeFileSync(
  path.join(web, 'assets', 'room.json'),
  JSON.stringify({ room: ROOM, ortho: ORTHO }),
);
const sizes = Object.fromEntries(
  Object.entries(files).map(([name, bytes]) => [name, bytes.length]),
);
sizes['picture.png'] = png.length;
sizes['picture.webp'] = webp.length;
sizes['picture.avif'] = avif.length;
sizes['big-picture.png'] = bigPng.length;
sizes['large-picture.png'] = largePng.length;

const types = { '.html': 'text/html', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((request, response) => {
  // The WebGPU bundle fetches its shader compilers from folders beside it.
  const file = path.resolve(
    web,
    '.' + decodeURIComponent(new URL(request.url, 'http://x').pathname),
  );
  if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return response.writeHead(404).end();
  const ext = path.extname(file);
  response.writeHead(200, {
    'Content-Type': types[ext] ?? (ext === '.glb' ? 'model/gltf-binary' : 'text/javascript'),
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
    width: 800,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/live.html`,
  });
  // Booting and drawing every view can outlast one waitFor (15 s).
  for (let attempt = 0; ; attempt++)
    try {
      await browser.waitFor(
        'window.__INTAKE__ && (window.__INTAKE__.ready || window.__INTAKE__.error)',
      );
      break;
    } catch (error) {
      if (attempt >= 8) throw error;
    }
  report = {
    gpu,
    sizes,
    ...(await browser.evaluate(
      'JSON.parse(JSON.stringify({renderer:__INTAKE__.renderer,backend:__INTAKE__.backend,ready:__INTAKE__.ready,error:__INTAKE__.error,errors:__INTAKE__.errors,rendererErrors:__INTAKE__.rendererErrors,intake:__INTAKE__.intake}))',
    )),
  };
  if (report.ready) {
    // Embedded pictures: time and the JavaScript heap each path keeps while its model lives.
    const heap = async () => {
      await browser.send('HeapProfiler.collectGarbage');
      return (await browser.send('Runtime.getHeapUsage')).usedSize;
    };
    // The heap is asked for again and again while a load runs. The page answers
    // between its tasks, so a peak inside one synchronous task is not seen.
    const sampledLoad = async (expression) => {
      const base = await heap();
      let peak = base,
        done = false;
      const load = browser.evaluate(expression, { timeoutMs: 120000 }).finally(() => (done = true));
      while (!done) {
        peak = Math.max(peak, (await browser.send('Runtime.getHeapUsage')).usedSize);
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      const { ms } = await load;
      return { ms, peak: peak - base, held: (await heap()) - base };
    };
    const rounds = [];
    for (let i = 0; i < 5; i++) {
      const native = await sampledLoad('__INTAKE__.loadNative()');
      await browser.evaluate('__INTAKE__.dropNative()');
      const engine = await sampledLoad('__INTAKE__.loadEngine()');
      await browser.evaluate('__INTAKE__.dropEngine()');
      rounds.push({
        nativeMs: native.ms,
        engineMs: engine.ms,
        nativePeak: native.peak,
        enginePeak: engine.peak,
        nativeHeld: native.held,
        engineHeld: engine.held,
      });
    }
    const median = (key) => rounds.map((r) => r[key]).sort((a, b) => a - b)[2];
    report.embeddedPicture = {
      file: sizes['big-picture.glb'],
      png: sizes['big-picture.png'],
      rounds,
      median: Object.fromEntries(
        ['nativeMs', 'engineMs', 'nativePeak', 'enginePeak', 'nativeHeld', 'engineHeld'].map(
          (k) => [k, median(k)],
        ),
      ),
      samePicture: await browser.evaluate('__INTAKE__.samePicture()', { timeoutMs: 120000 }),
    };
    report.pictures = [];
    for (const name of [
      'ring-reference',
      'ring-quantized',
      'ring-raw',
      'picture-png',
      'picture-webp',
      'picture-webp-fallback',
      'picture-avif',
      'picture-avif-webp',
      'picture-avif-webp-told-webp-only',
      'picture-avif-webp-told-none',
      'picture-webp-fallback-told-none',
      'picture-broken',
      'shared-picture',
      'orm-picture',
      'ortho-from-file',
      'room-reference',
      'room-lights',
      'room-unlit',
      'room-camera-from-file',
    ]) {
      await browser.evaluate(`__INTAKE__.show(${JSON.stringify(name)})`, { timeoutMs: 60000 });
      await browser.screenshot(path.join(evidence, `${name}.png`));
      report.pictures.push(`${name}.png`);
    }
    report.finish = await browser.evaluate('__INTAKE__.finish()');
    report.consoleErrors = browser.errors;
    // LayaAir warns here when a picture does not load; kept, not judged.
    report.consoleWarnings = [...new Set(browser.consoleMessages.map((m) => m.slice(0, 160)))];
    report.glErrors = browser.glErrors;
    report.rendererErrorsAfter = await browser.evaluate('__INTAKE__.rendererErrors');
  }
} finally {
  await browser.close();
  server.close();
}
// Differences a person can see: each pixel's largest channel difference, times eight.
const diffPicture = (a, b, name) => {
  const pa = PNG.sync.read(fs.readFileSync(path.join(evidence, a))),
    pb = PNG.sync.read(fs.readFileSync(path.join(evidence, b)));
  const diff = new PNG({ width: pa.width, height: pa.height });
  for (let i = 0; i < pa.data.length; i += 4) {
    const d = Math.min(
      255,
      8 *
        Math.max(
          Math.abs(pa.data[i] - pb.data[i]),
          Math.abs(pa.data[i + 1] - pb.data[i + 1]),
          Math.abs(pa.data[i + 2] - pb.data[i + 2]),
        ),
    );
    diff.data.set([d, d, d, 255], i);
  }
  fs.writeFileSync(path.join(evidence, name), PNG.sync.write(diff));
  report.pictures.push(name);
};
if (report.ready) {
  diffPicture('ring-reference.png', 'ring-quantized.png', 'diff-ring-quantized-x8.png');
  diffPicture('picture-png.png', 'picture-avif.png', 'diff-picture-avif-x8.png');
  diffPicture('picture-png.png', 'picture-avif-webp.png', 'diff-picture-avif-webp-x8.png');
  diffPicture('room-reference.png', 'room-lights.png', 'diff-room-lights-x8.png');
}
fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
assert.equal(
  report.backend.selected,
  gpuBuild ? 'webgpu' : 'webgl',
  JSON.stringify(report.backend),
);
assert.equal(report.backend.status, 'ready');
if (gpuBuild) assert.equal(report.backend.fallbackAdapter, false, 'a hardware WebGPU adapter');
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');
assert.deepEqual(report.glErrors, [], 'WebGL errors');
assert.deepEqual(report.rendererErrors, [], 'renderer errors');
const r = report.intake;
// Quantized + Meshopt geometry draws as the float file does.
assert.ok(r.ring.coverage > 0.08, `the ring is in the frame (${r.ring.coverage})`);
assert.deepEqual(r.ring.referenceReport, []);
assert.equal(r.ring.quantizedStatus, 'supported');
assert.ok(
  r.ring.quantizedReport.includes('DEQUANTIZED_ATTRIBUTES:warning:KHR_mesh_quantization'),
  JSON.stringify(r.ring.quantizedReport),
);
for (const [name, d] of [
  ['quantized + Meshopt', r.ring.quantized],
  ['quantized', r.ring.raw],
]) {
  assert.ok(d.mean < 0.5, `${name} ring: mean difference ${d.mean}`);
  assert.ok(d.over < 0.002, `${name} ring: share off by more than 24 is ${d.over}`);
}
// WebP and AVIF.
assert.deepEqual(r.imageDecode, { webp: true, avif: true }, 'this Chrome decodes WebP and AVIF');
assert.ok(r.picture.coverage > 0.3, `the picture fills the frame (${r.picture.coverage})`);
assert.equal(r.picture.webp.max, 0, 'lossless WebP draws the PNG picture exactly');
assert.equal(r.picture['webp-fallback'].max, 0, 'the WebP, not the inverted fallback, is used');
assert.ok(
  r.picture.avif.mean < 1 && r.picture.avif.over < 0.001,
  `AVIF draws the picture (${JSON.stringify(r.picture.avif)})`,
);
for (const name of ['webp', 'webp-fallback', 'avif'])
  assert.equal(r.picture[name].status, 'supported', `${name}: ${r.picture[name].report}`);
// The device was first asked while the main thread was then busy for 3.5 s.
assert.deepEqual(
  r.imageDecodeAfterBusy,
  { webp: true, avif: true },
  'a busy main thread is not read as a device that cannot decode',
);
// AVIF, then WebP, then the fallback, by which of three different pictures is drawn.
const c = r.choice;
assert.ok(
  c.references.webp.mean > 20 && c.references.fallback.mean > 20,
  `the three pictures differ plainly (${JSON.stringify(c.references)})`,
);
assert.ok(
  c.device.avif.mean < 1 && c.device.avif.over < 0.001,
  `this device loads the AVIF (${JSON.stringify(c.device)})`,
);
assert.equal(c.device.status, 'supported', String(c.device.report));
assert.equal(c.toldWebpOnly.webp.max, 0, 'told the device has no AVIF, the WebP is drawn');
assert.equal(c.toldWebpOnly.status, 'supported', String(c.toldWebpOnly.report));
assert.equal(c.toldNone.fallback.max, 0, 'told the device has neither, the fallback is drawn');
assert.equal(c.toldNone.status, 'degraded');
assert.ok(
  c.toldNone.report.includes('IMAGE_DECODE_UNAVAILABLE:warning:EXT_texture_avif'),
  String(c.toldNone.report),
);
assert.equal(c.webpFallbackToldNone.fallback.max, 0, 'the inverted fallback is drawn');
assert.equal(c.webpFallbackToldNone.status, 'degraded');
assert.ok(
  c.webpFallbackToldNone.report.includes('IMAGE_DECODE_UNAVAILABLE:warning:EXT_texture_webp'),
);
assert.equal(c.webpOnlyToldNone.name, 'ZhudaModelCompatibilityError');
assert.ok(c.webpOnlyToldNone.codes.includes('IMAGE_DECODE_UNAVAILABLE:error:EXT_texture_webp'));
// A decoder that gave no answer is named as that.
assert.ok(
  c.webpOnlyToldUnanswered.codes.includes('IMAGE_DECODE_UNANSWERED:error:EXT_texture_webp'),
  JSON.stringify(c.webpOnlyToldUnanswered),
);
assert.equal(c.webpFallbackToldUnanswered.status, 'degraded');
assert.ok(
  c.webpFallbackToldUnanswered.report.includes('IMAGE_DECODE_UNANSWERED:warning:EXT_texture_webp'),
);
// One picture, one texture, however many material slots use it: as LayaAir's own parse.
for (const [name, s, pictures] of [
  ['four materials on one picture', r.sharing.fourMaterials, 1],
  ['colour and a packed picture', r.sharing.packed, 2],
]) {
  const text = `${name}: ${JSON.stringify(s)}`;
  assert.equal(s.native.textures, pictures, text);
  assert.equal(s.engine.textures, s.native.textures, text);
  assert.equal(s.engine.textureBytes, s.native.textureBytes, text);
  assert.equal(s.engine.gpu, s.native.gpu, text);
  assert.equal(s.engine.blobUrls, pictures, text);
  assert.equal(s.engine.onMaterials, s.native.onMaterials, text);
  assert.equal(s.engine.left, 0, text);
  assert.equal(s.native.left, 0, text);
  assert.equal(s.samePicture.max, 0, text);
  assert.ok(s.coverage > 0.1, text);
}
// A picture that does not decode is in the model's report, and leaves nothing cached.
assert.equal(r.broken.status, 'degraded', JSON.stringify(r.broken));
assert.ok(r.broken.report.includes('IMAGE_DECODE_FAILED:warning'), JSON.stringify(r.broken));
assert.equal(r.broken.blobUrls, 1);
assert.equal(r.broken.revoked, 1);
assert.equal(r.broken.cachedUnderBlob, 0);
// An orthographic camera: 4 by 3 units in 800 by 600 pixels is 200 pixels a
// unit; the 2 by 2 picture, seen from 0.25 to its right, whatever the distance.
for (const [edge, pixel] of Object.entries({ left: 150, right: 549, top: 100, bottom: 499 }))
  assert.ok(Math.abs(r.ortho.bounds[edge] - pixel) <= 1, `${edge}: ${JSON.stringify(r.ortho)}`);
assert.equal(r.ortho.orthographic, true);
assert.equal(r.ortho.verticalSize, 2 * ORTHO.orthographic.ymag);
assert.equal(r.ortho.byHand.max, 0, JSON.stringify(r.ortho));
// Lights and the file's camera.
assert.ok(
  r.room.lights.mean < 0.5,
  `file lights equal the hand-made ones (${JSON.stringify(r.room.lights)})`,
);
assert.ok(r.room.lights.over < 0.002, `file lights: ${JSON.stringify(r.room.lights)}`);
assert.ok(
  r.room.camera.mean < 0.5 && r.room.camera.over < 0.002,
  `file camera: ${JSON.stringify(r.room.camera)}`,
);
assert.ok(
  r.room.litVsUnlit.mean > 4,
  `the lights light the room (${JSON.stringify(r.room.litVsUnlit)})`,
);
assert.equal(r.room.noneAsked, 0, 'no light is made unless asked');
assert.equal(
  r.room.unlitVsPlain.max <= 2,
  true,
  `unasked, the room is the plain one (${JSON.stringify(r.room.unlitVsPlain)})`,
);
const lamp = r.room.nodes.find((n) => n.name === 'Lamp');
assert.deepEqual(lamp.extras, ROOM.lamp.extras);
assert.equal(lamp.component.type, 'point');
assert.equal(lamp.component.onNode, true);
assert.equal(r.room.nodes.find((n) => n.name === 'Spot').component.type, 'spot');
assert.equal(r.room.nodes.find((n) => n.name === 'Sun').component.type, 'directional');
const shot = r.room.nodes.find((n) => n.name === 'ShotCamera');
assert.deepEqual(shot.extras, ROOM.camera.extras);
assert.equal(shot.camera.type, 'perspective');
assert.deepEqual(r.room.nodes.find((n) => n.name === 'Crate').extras, { solid: true });
assert.ok(
  r.room.report.filter((c) => c.startsWith('LIGHT_APPROXIMATED')).length === 2,
  JSON.stringify(r.room.report),
);
// A library without the decoder refuses the compressed file by its code.
assert.equal(r.withoutDecoder.name, 'ZhudaModelCompatibilityError');
assert.ok(r.withoutDecoder.codes.includes('DECODER_REQUIRED:error:KHR_meshopt_compression'));
// Thirty cycles of four models leave nothing behind: resources, lights, Blob URLs.
assert.deepEqual(r.cycles.after, r.cycles.before, JSON.stringify(r.cycles));
for (const kind of ['directional', 'point', 'spot'])
  assert.equal(
    r.cycles.mounted.lights[kind],
    r.cycles.before.lights[kind] + 1,
    `the file's ${kind} light is in the scene while mounted (${JSON.stringify(r.cycles)})`,
  );
// One Blob URL a distinct picture: the ring's, the WebP, and the shared one.
assert.equal(r.cycles.blobUrls, 30 * 3, JSON.stringify(r.cycles));
assert.equal(r.cycles.revoked, r.cycles.blobUrls);
assert.equal(r.cycles.library.entries, 0);
assert.equal(r.cycles.library.instances, 0);
for (const told of report.finish.told) assert.deepEqual([told.entries, told.instances], [0, 0]);
assert.equal(report.finish.blobs.revoked, report.finish.blobs.created, 'every Blob URL revoked');
// The embedded picture: the same picture either way, sooner, and without the
// data URL in the JavaScript heap. Wide margins: the measured ones are in the record.
assert.equal(report.embeddedPicture.samePicture.max, 0, JSON.stringify(report.embeddedPicture));
const median = report.embeddedPicture.median;
assert.ok(
  median.engineMs < median.nativeMs,
  `the Blob URL path is no slower (${JSON.stringify(median)})`,
);
assert.ok(
  median.enginePeak < median.nativePeak / 10,
  `the Blob URL path keeps the sampled heap peak under a tenth (${JSON.stringify(median)})`,
);
console.log(
  `PASS glTF intake on ${report.renderer} (${report.gpu}): ` +
    JSON.stringify({ intake: r, embeddedPicture: report.embeddedPicture.median, sizes }),
);
