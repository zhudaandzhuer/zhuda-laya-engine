#!/usr/bin/env node
// Real-GPU check of KTX 2 / Basis textures (`BasisTexture.ts`), through the
// browser SDK and the vendored Basis transcoder:
// - files of UASTC blocks made here (tests/helpers/ktx2-fixture.mjs) are
//   transcoded to every block format this graphics card samples (ASTC,
//   ETC2, S3TC) and to plain RGBA, uploaded through LayaAir's own KTX 1 and
//   DDS parsers, and drawn: each is the picture of the same pixels uploaded
//   uncompressed, with and without alpha;
// - the file's own mip levels are the ones sampled: a file whose levels are
//   each one colour shows the colour of level 2 when drawn at four texels to
//   a pixel, where mip levels made by the graphics card do not;
// - a Zstandard file, and a size that is not a multiple of four (which has
//   no block format and is uploaded as RGBA);
// - a 1024 by 1024 map against the same picture as a PNG: time to a texture
//   and bytes on the graphics card;
// - what cannot be read is refused with the reason.
// Desktop GPU evidence only (WebGL, or WebGPU with BASIS_RENDERER). The
// fixtures are flat blocks: they check the path, not an encoder's quality,
// and their file sizes say nothing about real textures.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import { PNG } from 'pngjs';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { LEVEL_MARKS, makeUastcKtx2 } from '../tests/helpers/ktx2-fixture.mjs';
import { picturePlane } from '../tests/fixtures/gltf-intake.mjs';
import {
  chooseZhudaBasisTarget,
  zhudaBasisTextureBytes,
} from '../packages/core/runtime3d/BasisTexture.ts';

const engineRoot = path.resolve(import.meta.dirname, '..');
const out = path.resolve(
  process.env.BASIS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-basis-textures'),
);
const web = path.join(out, 'web');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'evidence'), { recursive: true });
// BASIS_RENDERER=webgpu (or ZHUDA_FILM_RENDERER=webgpu) runs the same checks on the WebGPU build.
const gpuBuild = (process.env.BASIS_RENDERER || process.env.ZHUDA_FILM_RENDERER) === 'webgpu';
const profile = gpuBuild ? '3d-gltf-webgpu' : '3d-gltf';
const W = 480,
  H = 300;
await buildBrowserSdk({ engineRoot, outDir: web, profiles: [profile] });
await esbuild.build({
  entryPoints: [path.join(engineRoot, 'tests/fixtures/basis-textures.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(web, 'page.js'),
  logLevel: 'warning',
});
// The transcoder, where a consumer build puts it.
fs.mkdirSync(path.join(web, 'libs/basis'), { recursive: true });
for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm'])
  fs.copyFileSync(path.join(engineRoot, 'vendor/basis', file), path.join(web, 'libs/basis', file));
// The fixtures and the pixels they stand for.
const fixtures = path.join(web, 'fixtures');
fs.mkdirSync(fixtures);
const made = {
  opaque: makeUastcKtx2({ width: 64, height: 64 }),
  alpha: makeUastcKtx2({ width: 64, height: 64, alpha: true }),
  marked: makeUastcKtx2({ width: 64, height: 64, markLevels: true }),
  zstd: makeUastcKtx2({ width: 64, height: 64, zstd: true }),
  odd: makeUastcKtx2({ width: 30, height: 18, mips: false }),
};
const manifest = { textures: [], refusals: {} };
for (const [name, fixture] of Object.entries(made)) {
  fs.writeFileSync(path.join(fixtures, `${name}.ktx2`), fixture.file);
  fs.writeFileSync(path.join(fixtures, `${name}.rgba`), fixture.levels[0].pixels);
  manifest.textures.push({
    name,
    file: `${name}.ktx2`,
    pixels: `${name}.rgba`,
    width: fixture.width,
    height: fixture.height,
    alpha: fixture.alpha,
  });
}
const large = makeUastcKtx2({ width: 1024, height: 1024 });
fs.writeFileSync(path.join(fixtures, 'large.ktx2'), large.file);
const png = new PNG({ width: 1024, height: 1024 });
png.data = Buffer.from(large.levels[0].pixels);
const pngBytes = PNG.sync.write(png);
fs.writeFileSync(path.join(fixtures, 'large.png'), pngBytes);
fs.writeFileSync(path.join(fixtures, 'large.rgba'), large.levels[0].pixels);
manifest.large = {
  file: 'large.ktx2',
  png: 'large.png',
  pixels: 'large.rgba',
  pngBytes: pngBytes.length,
  width: 1024,
  height: 1024,
};
// Models: the opaque picture as a KTX 2 image in a GLB (required), as a PNG, and as
// a KTX 2 image with a fallback PNG of another picture (the same one with its colours inverted).
const pngOf = (pixels, width, height) => {
  const image = new PNG({ width, height });
  image.data = Buffer.from(pixels);
  return PNG.sync.write(image);
};
const opaquePixels = made.opaque.levels[0].pixels;
const invertedPixels = opaquePixels.map((value, index) => (index % 4 === 3 ? value : 255 - value));
fs.writeFileSync(
  path.join(fixtures, 'model-ktx2.glb'),
  picturePlane({
    images: [['image/ktx2', made.opaque.file]],
    texture: { extensions: { KHR_texture_basisu: { source: 0 } } },
    extension: 'KHR_texture_basisu',
    required: true,
  }),
);
fs.writeFileSync(
  path.join(fixtures, 'model-png.glb'),
  picturePlane({ images: [['image/png', pngOf(opaquePixels, 64, 64)]], texture: { source: 0 } }),
);
fs.writeFileSync(
  path.join(fixtures, 'model-fallback.glb'),
  picturePlane({
    images: [
      ['image/ktx2', made.opaque.file],
      ['image/png', pngOf(invertedPixels, 64, 64)],
    ],
    texture: { source: 1, extensions: { KHR_texture_basisu: { source: 0 } } },
    extension: 'KHR_texture_basisu',
  }),
);
manifest.refusals.cut = [...made.opaque.file.subarray(0, 300)];
const foreign = made.odd.file.slice();
new DataView(foreign.buffer).setUint8(new DataView(foreign.buffer).getUint32(48, true) + 12, 1);
manifest.refusals.foreign = [...foreign];
fs.writeFileSync(path.join(fixtures, 'manifest.json'), JSON.stringify(manifest));

fs.writeFileSync(
  path.join(web, 'live.html'),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}#view{width:${W}px;height:${H}px}</style>` +
    `<div id="view"></div><script src="zhuda-${profile}.js"></script><script src="page.js"></script>`,
);
const types = {
  '.html': 'text/html',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.js': 'text/javascript',
};
const server = http.createServer((request, response) => {
  const file = path.resolve(
    web,
    '.' + decodeURIComponent(new URL(request.url, 'http://x').pathname),
  );
  if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return response.writeHead(404).end();
  response.writeHead(200, {
    'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
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
        'window.__BASIS__ && (window.__BASIS__.ready || window.__BASIS__.error)',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report = {
    gpu,
    ...(await browser.evaluate('window.__BASIS__')),
    consoleErrors: browser.errors,
    // WebGPU reports pipeline and validation errors as console warnings.
    gpuWarnings: browser.consoleMessages.filter((m) => /unCaptured|INVALID|GL_|WebGPU/i.test(m)),
  };
  if (report.ready) {
    const save = async (name) =>
      fs.writeFileSync(
        path.join(out, 'evidence', `${name}.png`),
        Buffer.from(
          (await browser.evaluate(`window.__BASIS__.picture('${name}')`)).split(',')[1],
          'base64',
        ),
      );
    report.pictures = [];
    for (const [name, texture] of Object.entries(report.textures))
      for (const target of ['reference', ...Object.keys(texture.targets)]) {
        if (!['opaque', 'alpha', 'marked'].includes(name)) continue;
        await save(`${name}-${target}`);
        report.pictures.push(`${name}-${target}.png`);
        if (name === 'marked' && target !== 'reference') {
          await save(`${name}-${target}-tiny`);
          report.pictures.push(`${name}-${target}-tiny.png`);
        }
      }
    if (report.model)
      for (const name of ['model-png', 'model-ktx2', 'model-fallback', 'model-fallback-bare'])
        await save(name);
    if (report.large)
      for (const name of ['large-ktx2', 'large-png', 'large-reference']) await save(name);
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'evidence/report.json'), JSON.stringify(report, null, 2) + '\n');

assert.equal(report.ready, true, report.error);
assert.deepEqual(report.errors, [], 'page errors');
assert.deepEqual(report.consoleErrors, [], 'console errors');
assert.deepEqual(report.gpuWarnings, [], 'GPU errors and warnings');
assert.deepEqual(report.rendererErrors, [], 'renderer errors');
assert.equal(report.backend.selected, gpuBuild ? 'webgpu' : 'webgl');
if (gpuBuild)
  assert.ok(
    report.backend.adapter && !report.backend.adapter.isFallbackAdapter,
    `a WebGPU adapter (${JSON.stringify(report.backend.adapter)})`,
  );
assert.equal(report.sameTranscoder, true, 'one transcoder for the page');
const support = report.support;
assert.ok(
  support.astc || support.etc2 || support.s3tc,
  `this graphics card samples a block format (${JSON.stringify(support)})`,
);

const summary = {};
for (const [name, texture] of Object.entries(report.textures)) {
  const info = texture.info;
  const expected = chooseZhudaBasisTarget(support, info);
  assert.ok(
    texture.coveredPixels > 30000 && texture.coveredPixels < 60000,
    `${name}: the plane is drawn, and told from the background (${texture.coveredPixels} pixels)`,
  );
  summary[name] = {};
  for (const [target, result] of Object.entries(texture.targets)) {
    const chosen = target === 'auto' ? expected : target;
    assert.equal(result.chosen, chosen, `${name}: ${target} is ${chosen}`);
    const levels = chosen === 'rgba8' ? 1 : info.levels;
    assert.equal(result.levels, levels, `${name} ${target}: levels`);
    assert.equal(
      result.bytes,
      zhudaBasisTextureBytes(
        chosen,
        info.width,
        info.height,
        chosen === 'rgba8' ? Math.floor(Math.log2(Math.max(info.width, info.height))) + 1 : levels,
      ),
    );
    summary[name][target] = `${chosen} mean ${result.full.mean} worst ${result.full.worst}`;
    if (name === 'marked') continue;
    // Full size: level 0, the picture of the same pixels.
    const exact = chosen === 'rgba8' || chosen === 'astc-4x4';
    assert.ok(
      result.full.mean <= (exact ? 0.6 : 2.5),
      `${name} ${target}: the picture of its pixels (mean ${result.full.mean} of 255)`,
    );
    assert.ok(
      result.full.over12 <= (exact ? 0.002 : 0.02),
      `${name} ${target}: few values further than 12 off (${result.full.over12})`,
    );
    // Drawn small: a lower level, made here by averaging blocks and there by the graphics card.
    assert.ok(
      result.small.mean <= 6,
      `${name} ${target}: drawn small it is still that picture (mean ${result.small.mean})`,
    );
  }
}
// A size that is not a multiple of four is uploaded as RGBA; so is anything where no block format fits.
assert.equal(report.textures.odd.targets.auto.chosen, 'rgba8');
assert.match(report.textures.odd.forcedBlockFormat, /multiples of four \(30 by 18\)/);
// The file's own levels: level 2 is green in the marked file.
const green = LEVEL_MARKS[1];
for (const [target, result] of Object.entries(report.textures.marked.targets)) {
  const [r, g, b] = result.tinyMean;
  const own = g > r + 60 && g > b + 60;
  if (result.chosen === 'rgba8')
    assert.equal(
      own,
      false,
      `marked ${target}: levels made by the graphics card are not green (${result.tinyMean})`,
    );
  else
    assert.equal(
      own,
      true,
      `marked ${target}: level 2 of the file is sampled (${result.tinyMean}, level 2 is ${green})`,
    );
  assert.ok(result.tinyPixels > 100, 'the small plane is drawn');
}
// The large map.
const largeReport = report.large;
assert.equal(
  largeReport.ktx2.target,
  chooseZhudaBasisTarget(support, {
    basis: 'uastc',
    alpha: false,
    srgb: true,
    width: 1024,
    height: 1024,
  }),
);
if (largeReport.ktx2.target !== 'rgba8')
  assert.ok(
    largeReport.ktx2.gpuBytes * 3.9 < largeReport.referenceGpuBytes,
    `a quarter of the uncompressed bytes on the graphics card or less (${largeReport.ktx2.gpuBytes} against ${largeReport.referenceGpuBytes})`,
  );
assert.ok(
  largeReport.difference.mean <= 2.5,
  `the large map is the picture of its pixels (${largeReport.difference.mean})`,
);
// The PNG comes in through LayaAir's loader with the loader's own settings (no mip levels, its
// own reading of the colours): it is there for its time and its size, not as a picture to match.
// In a model.
const model = report.model;
const expectedModelTarget = chooseZhudaBasisTarget(support, report.textures.opaque.info);
assert.ok(model.coveredPixels > 30000, `the model's plane is drawn (${model.coveredPixels})`);
assert.equal(
  model.ktx2.basis?.target,
  expectedModelTarget,
  'the material holds the transcoded texture',
);
assert.deepEqual(model.ktx2.report, [], 'nothing to report about its image');
assert.ok(
  model.ktx2.difference.mean <= 2.5,
  `a model's KTX 2 texture is the picture of the same model with a PNG (mean ${model.ktx2.difference.mean})`,
);
assert.ok(
  model.fallbackWithTranscoder.difference.mean <= 2.5,
  `with a transcoder the KTX 2 image is used, not the fallback (mean ${model.fallbackWithTranscoder.difference.mean})`,
);
assert.equal(model.fallbackWithTranscoder.basis?.target, expectedModelTarget);
assert.ok(
  model.fallbackWithout.difference.mean > 40,
  `without one the fallback picture is shown (mean ${model.fallbackWithout.difference.mean} from the other picture)`,
);
assert.equal(model.fallbackWithout.basis, null);
assert.deepEqual(model.fallbackWithout.report, ['warning:BASIS_TRANSCODER_MISSING']);
assert.deepEqual(model.refused, {
  name: 'ZhudaModelCompatibilityError',
  codes: ['error:BASIS_TRANSCODER_MISSING'],
});
assert.match(report.refused.notKtx2, /Invalid KTX 2 texture: not a KTX 2 file/);
assert.match(report.refused.cut, /Invalid KTX 2 texture: .*level 0 lies outside the file/);
assert.match(report.refused.foreign, /without a Basis payload/);

console.log(
  `PASS Basis textures on ${report.renderer} (${report.backend.adapter ? JSON.stringify(report.backend.adapter) : report.gpu}): ` +
    `support ${JSON.stringify(support)}, transcoder ready in ${report.transcoderLoadMs} ms\n` +
    Object.entries(summary)
      .map(
        ([name, targets]) =>
          `  ${name}: ${Object.entries(targets)
            .map(([t, line]) => `${t} -> ${line}`)
            .join('; ')}`,
      )
      .join('\n') +
    `\n  marked, four texels to a pixel: ${Object.entries(report.textures.marked.targets)
      .map(([t, r]) => `${t} ${JSON.stringify(r.tinyMean)}`)
      .join('; ')}` +
    `\n  in a model: ${model.ktx2.basis?.target}, mean ${model.ktx2.difference.mean} from the PNG model; fallback without a transcoder ${JSON.stringify(model.fallbackWithout.report)}` +
    `\n  1024 by 1024: KTX 2 ${largeReport.ktx2.target} ${largeReport.ktx2.createMs} ms to a texture, ${largeReport.ktx2.gpuBytes} bytes on the card; the same picture as a PNG through LayaAir's loader ${largeReport.png.loadMs} ms, ${largeReport.png.gpuBytes} bytes (mip levels: ${largeReport.png.mipmap}); uncompressed with mip levels ${largeReport.referenceGpuBytes} bytes` +
    `\nPictures: ${path.join(out, 'evidence')}`,
);
