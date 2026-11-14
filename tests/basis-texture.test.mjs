// KTX 2 / Basis textures (record basis-textures): the header reader, the
// choice of a target, the containers LayaAir reads, and the vendored Basis
// transcoder itself on files made by tests/helpers/ktx2-fixture.mjs. The
// uploads and draws are checked by verify:basis-textures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ZHUDA_BASIS_TARGETS,
  ZHUDA_BASIS_WASM_SHA256,
  ZhudaBasisTranscoder,
  chooseZhudaBasisTarget,
  createZhudaBasisTexture,
  inspectZhudaKtx2,
  isZhudaKtx2,
  zhudaBasisBlockBytes,
  zhudaBasisContainer,
  zhudaBasisSupport,
  zhudaBasisTextureBytes,
} from '../packages/core/runtime3d/BasisTexture.ts';
import { loadBasisFactory, makeUastcKtx2 } from './helpers/ktx2-fixture.mjs';

const vendor = path.resolve(import.meta.dirname, '../vendor/basis');
const { factory, wasm } = await loadBasisFactory(vendor);
const transcoder = await ZhudaBasisTranscoder.create({ factory, wasm });

const MODIFIERS = [
  [2, 8],
  [5, 17],
  [9, 29],
  [13, 42],
  [18, 60],
  [24, 80],
  [33, 106],
  [47, 183],
];
const clamp = (value) => Math.max(0, Math.min(255, value));
/** The sixteen colours of one ETC1 block (also the colour part of an ETC2 block made from ETC1). */
function decodeEtc1(block) {
  const differential = (block[3] & 2) !== 0,
    flip = (block[3] & 1) !== 0;
  const bases = [[], []];
  for (let c = 0; c < 3; c++)
    if (differential) {
      const first = block[c] >> 3;
      let delta = block[c] & 7;
      if (delta > 3) delta -= 8;
      const second = first + delta;
      bases[0].push((first << 3) | (first >> 2));
      bases[1].push((second << 3) | (second >> 2));
    } else {
      bases[0].push((block[c] >> 4) * 17);
      bases[1].push((block[c] & 15) * 17);
    }
  const tables = [block[3] >> 5, (block[3] >> 2) & 7];
  const msb = (block[4] << 8) | block[5],
    lsb = (block[6] << 8) | block[7];
  const out = [];
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const i = x * 4 + y;
      const index = (((msb >> i) & 1) << 1) | ((lsb >> i) & 1);
      const half = flip ? (y < 2 ? 0 : 1) : x < 2 ? 0 : 1;
      const [small, large] = MODIFIERS[tables[half]];
      const modifier = [small, large, -small, -large][index];
      out.push(bases[half].map((value) => clamp(value + modifier)));
    }
  return out;
}
/** The sixteen colours of one BC1 block. */
function decodeBc1(block) {
  const color = (value) => [
    Math.round((((value >> 11) & 31) * 255) / 31),
    Math.round((((value >> 5) & 63) * 255) / 63),
    Math.round(((value & 31) * 255) / 31),
  ];
  const a = block[0] | (block[1] << 8),
    b = block[2] | (block[3] << 8);
  const c0 = color(a),
    c1 = color(b);
  const mix = (p, q, wp, wq, div) =>
    p.map((value, i) => Math.round((value * wp + q[i] * wq) / div));
  const palette =
    a > b
      ? [c0, c1, mix(c0, c1, 2, 1, 3), mix(c0, c1, 1, 2, 3)]
      : [c0, c1, mix(c0, c1, 1, 1, 2), [0, 0, 0]];
  const out = [];
  for (let i = 0; i < 16; i++) out.push(palette[(block[4 + (i >> 2)] >> ((i & 3) * 2)) & 3]);
  return out;
}
/** The worst difference of any channel between decoded blocks and the pixels they stand for. */
function worstBlockError(level, decode, blockBytes, colorOffset, reference) {
  const bw = Math.ceil(level.width / 4);
  let worst = 0;
  for (let b = 0; b * blockBytes < level.data.length; b++) {
    const colors = decode(level.data.subarray(b * blockBytes + colorOffset, (b + 1) * blockBytes));
    const bx = b % bw,
      by = Math.floor(b / bw);
    for (let y = 0; y < 4 && by * 4 + y < level.height; y++)
      for (let x = 0; x < 4 && bx * 4 + x < level.width; x++) {
        const at = ((by * 4 + y) * level.width + bx * 4 + x) * 4;
        for (let c = 0; c < 3; c++)
          worst = Math.max(worst, Math.abs(colors[y * 4 + x][c] - reference[at + c]));
      }
  }
  return worst;
}

test('the vendored transcoder is the one the engine names', () => {
  const hash = crypto.createHash('sha256').update(wasm).digest('hex');
  assert.equal(hash, ZHUDA_BASIS_WASM_SHA256);
  const readme = fs.readFileSync(path.join(vendor, 'README.md'), 'utf8');
  assert.ok(readme.includes(hash), 'the provenance file gives the same hash');
  const script = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(vendor, 'basis_transcoder.js')))
    .digest('hex');
  assert.ok(readme.includes(script), 'and the hash of the script');
  assert.ok(fs.existsSync(path.join(vendor, 'LICENSE.txt')));
});

test('a KTX 2 header is read without a transcoder, and what is wrong is said', () => {
  const plain = makeUastcKtx2({ width: 64, height: 32 });
  assert.equal(isZhudaKtx2(plain.file), true);
  assert.deepEqual(inspectZhudaKtx2(plain.file), {
    info: {
      width: 64,
      height: 32,
      levels: 7,
      faces: 1,
      layers: 0,
      depth: 0,
      basis: 'uastc',
      alpha: false,
      srgb: true,
      supercompression: 'none',
      vkFormat: 0,
    },
    problems: [],
  });
  const other = inspectZhudaKtx2(
    makeUastcKtx2({ alpha: true, srgb: false, mips: false, zstd: true }).file,
  ).info;
  assert.deepEqual(
    [other.alpha, other.srgb, other.levels, other.supercompression],
    [true, false, 1, 'zstd'],
  );

  assert.equal(isZhudaKtx2(new Uint8Array([1, 2, 3])), false);
  assert.deepEqual(inspectZhudaKtx2(new Uint8Array(200)).problems, [
    'not a KTX 2 file (wrong first twelve bytes)',
  ]);
  assert.deepEqual(inspectZhudaKtx2('ktx2').problems, ['KTX 2 data must be a Uint8Array']);
  assert.deepEqual(inspectZhudaKtx2(plain.file.subarray(0, 40)).problems, [
    'the KTX 2 header is cut short',
  ]);
  // Cut in the middle of its data: a level lies outside what is left.
  assert.match(
    inspectZhudaKtx2(plain.file.subarray(0, plain.file.length - 40)).problems.join(),
    /level 0 lies outside the file/,
  );
  const edit = (change) => {
    const copy = plain.file.slice();
    change(new DataView(copy.buffer));
    return inspectZhudaKtx2(copy);
  };
  assert.match(edit((v) => v.setUint32(20, 0, true)).problems[0], /size 0 by 32 is outside/);
  assert.match(edit((v) => v.setUint32(20, 70000, true)).problems[0], /size 70000 by 32/);
  assert.match(edit((v) => v.setUint32(36, 2, true)).problems.join(), /2 faces/);
  assert.match(edit((v) => v.setUint32(52, 0, true)).problems.join(), /data format descriptor/);
  // Another colour model: a KTX 2 file, but not one this module transcodes.
  const foreign = edit((v) => v.setUint8(v.getUint32(48, true) + 12, 1));
  assert.equal(foreign.info.basis, null);
});

test('the target follows the device and the texture', () => {
  const all = { astc: true, etc2: true, s3tc: true, s3tcSrgb: true },
    none = { astc: false, etc2: false, s3tc: false, s3tcSrgb: false };
  const texture = (over = {}) => ({
    basis: 'uastc',
    alpha: false,
    srgb: true,
    width: 64,
    height: 64,
    ...over,
  });
  assert.equal(chooseZhudaBasisTarget(all, texture()), 'astc-4x4');
  assert.equal(chooseZhudaBasisTarget({ ...all, astc: false }, texture()), 'etc2-rgb');
  assert.equal(
    chooseZhudaBasisTarget({ ...all, astc: false }, texture({ alpha: true })),
    'etc2-rgba',
  );
  assert.equal(chooseZhudaBasisTarget({ ...none, s3tc: true, s3tcSrgb: true }, texture()), 'bc1');
  assert.equal(
    chooseZhudaBasisTarget({ ...none, s3tc: true, s3tcSrgb: true }, texture({ alpha: true })),
    'bc3',
  );
  // S3TC without its sRGB variant cannot hold a colour map; a linear map it can.
  assert.equal(chooseZhudaBasisTarget({ ...none, s3tc: true }, texture()), 'rgba8');
  assert.equal(chooseZhudaBasisTarget({ ...none, s3tc: true }, texture({ srgb: false })), 'bc1');
  assert.equal(chooseZhudaBasisTarget(none, texture()), 'rgba8');
  // ETC1S is never brought to ASTC.
  assert.equal(chooseZhudaBasisTarget(all, texture({ basis: 'etc1s' })), 'etc2-rgb');
  assert.equal(
    chooseZhudaBasisTarget({ ...all, etc2: false }, texture({ basis: 'etc1s', alpha: true })),
    'bc3',
  );
  assert.equal(
    chooseZhudaBasisTarget({ ...none, astc: true }, texture({ basis: 'etc1s' })),
    'rgba8',
  );
  // A size that is not a multiple of four has no block format.
  assert.equal(chooseZhudaBasisTarget(all, texture({ width: 62 })), 'rgba8');
  assert.equal(chooseZhudaBasisTarget(all, texture({ height: 30 })), 'rgba8');

  assert.deepEqual(ZHUDA_BASIS_TARGETS.map(zhudaBasisBlockBytes), [16, 16, 8, 16, 8, 0]);
  // 2048 by 2048 with twelve levels: a third more than level 0.
  assert.equal(zhudaBasisTextureBytes('rgba8', 2048, 2048, 1), 16777216);
  assert.equal(zhudaBasisTextureBytes('rgba8', 2048, 2048, 12), 22369620);
  assert.equal(zhudaBasisTextureBytes('astc-4x4', 2048, 2048, 12), 5592432);
  assert.equal(zhudaBasisTextureBytes('etc2-rgb', 2048, 2048, 12), 2796216);
  assert.equal(zhudaBasisTextureBytes('bc1', 8, 8, 4), 32 + 8 + 8 + 8);

  // What LayaAir reports is what is used.
  const RenderCapable = {
    COMPRESS_TEXTURE_ASTC: 17,
    COMPRESS_TEXTURE_ETC: 16,
    COMPRESS_TEXTURE_S3TC: 12,
    COMPRESS_TEXTURE_S3TC_SRGB: 13,
  };
  const runtime = (have) => ({
    RenderCapable,
    LayaGL: { renderEngine: { getCapable: (id) => have.includes(id) } },
  });
  assert.deepEqual(zhudaBasisSupport(runtime([17, 12])), {
    astc: true,
    etc2: false,
    s3tc: true,
    s3tcSrgb: false,
  });
  assert.deepEqual(zhudaBasisSupport({}), none);
});

test('the transcoder brings a file to every target, level by level', () => {
  const opaque = makeUastcKtx2({ width: 64, height: 64 });
  // Uncompressed: the very pixels.
  const rgba = transcoder.transcode(opaque.file, 'rgba8');
  assert.deepEqual(
    [rgba.width, rgba.height, rgba.alpha, rgba.srgb, rgba.levels.length],
    [64, 64, false, true, 1],
  );
  assert.deepEqual(rgba.levels[0].data, opaque.levels[0].pixels);
  for (const target of ['astc-4x4', 'etc2-rgba', 'etc2-rgb', 'bc3', 'bc1']) {
    const out = transcoder.transcode(opaque.file, target);
    assert.equal(out.levels.length, 7, `${target}: all seven levels`);
    out.levels.forEach((level, index) => {
      const w = Math.max(1, 64 >> index);
      assert.deepEqual([level.width, level.height], [w, w]);
      assert.equal(
        level.data.length,
        Math.ceil(w / 4) ** 2 * zhudaBasisBlockBytes(target),
        `${target} level ${index}: whole blocks`,
      );
    });
    assert.equal(
      out.levels.reduce((sum, level) => sum + level.data.length, 0),
      zhudaBasisTextureBytes(target, 64, 64, 7),
    );
  }
  // ETC2 from the hints of the fixture's blocks, and BC1: the colours come back, every level.
  const etc = transcoder.transcode(opaque.file, 'etc2-rgb'),
    etcAlpha = transcoder.transcode(opaque.file, 'etc2-rgba'),
    bc1 = transcoder.transcode(opaque.file, 'bc1'),
    bc3 = transcoder.transcode(opaque.file, 'bc3');
  for (let level = 0; level < 7; level++) {
    const reference = opaque.levels[level].pixels;
    const errors = {
      etc: worstBlockError(etc.levels[level], decodeEtc1, 8, 0, reference),
      // An ETC2 RGBA block: eight bytes of alpha, then the colour block.
      etcAlpha: worstBlockError(etcAlpha.levels[level], decodeEtc1, 16, 8, reference),
      bc1: worstBlockError(bc1.levels[level], decodeBc1, 8, 0, reference),
      // A BC3 block: eight bytes of alpha, then a BC1 colour block.
      bc3: worstBlockError(bc3.levels[level], decodeBc1, 16, 8, reference),
    };
    for (const [name, error] of Object.entries(errors))
      assert.ok(error <= 8, `${name} level ${level}: within 8 of 255 (${error})`);
  }
  assert.equal(transcoder.transcode(opaque.file, 'bc1', { maxLevels: 3 }).levels.length, 3);

  // Alpha, linear colours, Zstandard and a size that is not a multiple of four.
  const alpha = makeUastcKtx2({ alpha: true, srgb: false, zstd: true });
  const alphaOut = transcoder.transcode(alpha.file, 'rgba8');
  assert.deepEqual([alphaOut.alpha, alphaOut.srgb], [true, false]);
  assert.deepEqual(alphaOut.levels[0].data, alpha.levels[0].pixels);
  assert.ok(
    alpha.levels[0].pixels.some((value, index) => index % 4 === 3 && value < 255),
    'the fixture does fade out',
  );
  const odd = makeUastcKtx2({ width: 30, height: 18, mips: false });
  assert.deepEqual(transcoder.transcode(odd.file, 'rgba8').levels[0].data, odd.levels[0].pixels);
});

test('what the transcoder cannot read is refused with the reason', async () => {
  const good = makeUastcKtx2({ mips: false });
  assert.throws(
    () => transcoder.transcode(new Uint8Array(100), 'rgba8'),
    /Invalid KTX 2 texture: not a KTX 2 file/,
  );
  assert.throws(() => transcoder.transcode(good.file, 'bc7'), /unknown target bc7/);
  const foreign = good.file.slice();
  new DataView(foreign.buffer).setUint8(new DataView(foreign.buffer).getUint32(48, true) + 12, 1);
  assert.throws(() => transcoder.transcode(foreign, 'rgba8'), /without a Basis payload/);
  const cube = good.file.slice();
  new DataView(cube.buffer).setUint32(36, 6, true);
  assert.throws(() => transcoder.transcode(cube, 'rgba8'), /cube, array and volume/);

  // Start-up: the bytes are checked before anything runs.
  let started = 0;
  const counting = (module) => (started++, factory(module));
  const tampered = wasm.slice();
  tampered[tampered.length - 1] ^= 1;
  await assert.rejects(
    ZhudaBasisTranscoder.create({ factory: counting, wasm: tampered }),
    /not the expected one \(SHA-256 [0-9a-f]{64}\)/,
  );
  assert.equal(started, 0, 'a transcoder with another hash is never started');
  await assert.rejects(ZhudaBasisTranscoder.create({ wasm }), /give the transcoder module factory/);
  await assert.rejects(
    ZhudaBasisTranscoder.create({ factory, wasm: new Uint8Array(0) }),
    /give the bytes/,
  );
  await assert.rejects(
    ZhudaBasisTranscoder.create({ factory: async () => ({}), wasm }),
    /did not give a Basis transcoder/,
  );
  // Its own hash, upper case, and no check at all for a transcoder the game built itself.
  const own = await ZhudaBasisTranscoder.create({
    factory,
    wasm,
    sha256: ZHUDA_BASIS_WASM_SHA256.toUpperCase(),
  });
  own.dispose();
  assert.throws(() => own.transcode(good.file, 'rgba8'), /disposed/);
  (await ZhudaBasisTranscoder.create({ factory, wasm: wasm.buffer, sha256: false })).dispose();

  // Cancelled, and a start-up that never ends.
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(ZhudaBasisTranscoder.create({ factory, wasm, signal: cancelled.signal }), {
    name: 'AbortError',
  });
  await assert.rejects(
    ZhudaBasisTranscoder.create({ factory: () => new Promise(() => {}), wasm, timeoutMs: 30 }),
    { name: 'TimeoutError' },
  );
});

test('a transcoded texture is wrapped as the file LayaAir reads', () => {
  const source = makeUastcKtx2({ width: 16, height: 8, alpha: true });
  // KTX 1: the fields LayaAir's createKTX1Info reads, where it reads them.
  for (const [target, linear, srgb, base] of [
    ['astc-4x4', 37808, 37840, 0x1908],
    ['etc2-rgba', 37496, 37497, 0x1908],
    ['etc2-rgb', 37492, 37493, 0x1907],
  ])
    for (const colours of [true, false]) {
      const texture = { ...transcoder.transcode(source.file, target), srgb: colours };
      const { kind, bytes } = zhudaBasisContainer(texture);
      assert.equal(kind, 'ktx');
      const view = new DataView(bytes);
      assert.deepEqual(
        [...new Uint8Array(bytes, 0, 12)],
        [0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a],
      );
      const field = (index) => view.getUint32(12 + index * 4, true);
      assert.equal(field(0), 0x04030201, 'little endian');
      assert.deepEqual(
        [field(1), field(3), field(4), field(5)],
        [0, 0, colours ? srgb : linear, base],
        `${target}: a compressed format, the internal format LayaAir maps`,
      );
      assert.deepEqual([field(6), field(7), field(10), field(11), field(12)], [16, 8, 1, 5, 0]);
      let at = 64;
      for (const level of texture.levels) {
        assert.equal(view.getUint32(at, true), level.data.length);
        assert.deepEqual(new Uint8Array(bytes, at + 4, level.data.length), level.data);
        at += 4 + Math.ceil(level.data.length / 4) * 4;
      }
      assert.equal(at, bytes.byteLength, 'nothing after the last level');
    }
  // DDS: the fields LayaAir's getDDSTextureInfo reads.
  for (const [target, fourCC, blockBytes] of [
    ['bc3', 'DXT5', 16],
    ['bc1', 'DXT1', 8],
  ]) {
    const texture = transcoder.transcode(source.file, target);
    const { kind, bytes } = zhudaBasisContainer(texture);
    assert.equal(kind, 'dds');
    const header = new Int32Array(bytes, 0, 31);
    assert.equal(header[0], 542327876, 'the magic number');
    assert.equal(header[1] + 4, 128, 'where the data starts');
    assert.ok(header[2] & 131072, 'the mip count counts');
    assert.deepEqual([header[4], header[3], header[7]], [16, 8, 5]);
    assert.ok(header[20] & 4, 'a FourCC format');
    assert.equal(
      String.fromCharCode(
        header[21] & 255,
        (header[21] >> 8) & 255,
        (header[21] >> 16) & 255,
        header[21] >>> 24,
      ),
      fourCC,
    );
    assert.equal(bytes.byteLength, 128 + zhudaBasisTextureBytes(target, 16, 8, 5));
    assert.equal(texture.levels[0].data.length, 4 * 2 * blockBytes);
    // One level: no mip count flag.
    const single = zhudaBasisContainer({ ...texture, levels: texture.levels.slice(0, 1) });
    assert.equal(new Int32Array(single.bytes, 0, 31)[2] & 131072, 0);
  }
  assert.throws(
    () => zhudaBasisContainer(transcoder.transcode(source.file, 'rgba8')),
    /rgba8 has no container/,
  );
  assert.throws(() => zhudaBasisContainer({ target: 'bc1', levels: [] }), /without levels/);
});

test('a texture is made in the format the device samples', () => {
  const calls = [];
  const fakeRuntime = (have) => {
    class Texture2D {
      constructor(...args) {
        calls.push(['new', ...args]);
        this.anisoLevel = 1;
      }
      setPixelsData(data, premultiply, invert) {
        calls.push(['pixels', data.length, premultiply, invert]);
      }
      static _parseKTX(bytes, properties, construct) {
        calls.push(['ktx', bytes.byteLength, properties, construct]);
        return new Texture2D('from ktx');
      }
      static _parseDDS(bytes, properties, construct) {
        calls.push(['dds', bytes.byteLength, properties, construct]);
        return new Texture2D('from dds');
      }
    }
    return {
      Texture2D,
      TextureFormat: { R8G8B8A8: 1 },
      RenderCapable: {
        COMPRESS_TEXTURE_ASTC: 17,
        COMPRESS_TEXTURE_ETC: 16,
        COMPRESS_TEXTURE_S3TC: 12,
        COMPRESS_TEXTURE_S3TC_SRGB: 13,
      },
      LayaGL: { renderEngine: { getCapable: (id) => have.includes(id) } },
    };
  };
  const colour = makeUastcKtx2({ width: 32, height: 32 });
  // ASTC where there is ASTC: LayaAir's KTX parser, with mip levels, sRGB.
  let texture = createZhudaBasisTexture(transcoder, colour.file, {}, fakeRuntime([17, 16]));
  assert.deepEqual(calls.shift(), [
    'ktx',
    64 + 6 * 4 + zhudaBasisTextureBytes('astc-4x4', 32, 32, 6),
    null,
    [0, 0, 0, true, false, true],
  ]);
  calls.length = 0;
  assert.deepEqual(texture.zhudaBasis, {
    target: 'astc-4x4',
    levels: 6,
    bytes: zhudaBasisTextureBytes('astc-4x4', 32, 32, 6),
  });
  assert.equal(texture.anisoLevel, 8, 'filtered along its length, as other surface textures');
  // S3TC only: LayaAir's DDS parser.
  texture = createZhudaBasisTexture(transcoder, colour.file, {}, fakeRuntime([12, 13]));
  assert.equal(calls.shift()[0], 'dds');
  assert.equal(texture.zhudaBasis.target, 'bc1');
  calls.length = 0;
  // No block format: pixels, and the graphics card makes the mip levels.
  texture = createZhudaBasisTexture(transcoder, colour.file, { anisoLevel: 2 }, fakeRuntime([]));
  assert.deepEqual(calls, [
    ['new', 32, 32, 1, true, false, true],
    ['pixels', 32 * 32 * 4, false, false],
  ]);
  assert.deepEqual(
    [texture.zhudaBasis.target, texture.zhudaBasis.bytes, texture.anisoLevel],
    ['rgba8', zhudaBasisTextureBytes('rgba8', 32, 32, 6), 2],
  );
  calls.length = 0;
  // The role decides how the colours are read, whatever the file says; a forced target is used.
  createZhudaBasisTexture(
    transcoder,
    colour.file,
    { role: 'normal', target: 'etc2-rgb' },
    fakeRuntime([]),
  );
  const forced = calls.shift();
  assert.equal(forced[0], 'ktx');
  assert.equal(forced[3][5], false, 'a normal map is not sRGB');
  // A single level is not filtered across levels it does not have.
  calls.length = 0;
  const single = createZhudaBasisTexture(
    transcoder,
    makeUastcKtx2({ mips: false }).file,
    {},
    fakeRuntime([17]),
  );
  assert.equal(calls.shift()[3][3], false);
  assert.equal(single.anisoLevel, 1);
  assert.throws(
    () => createZhudaBasisTexture(transcoder, colour.file, { anisoLevel: 0 }, fakeRuntime([])),
    /anisoLevel/,
  );
  assert.throws(
    () => createZhudaBasisTexture(transcoder, new Uint8Array(64), {}, fakeRuntime([])),
    /Invalid KTX 2 texture/,
  );
  // A block format forced on a size that is not a multiple of four is refused; left alone it is RGBA.
  const odd = makeUastcKtx2({ width: 30, height: 18, mips: false }).file;
  assert.throws(
    () => createZhudaBasisTexture(transcoder, odd, { target: 'bc1' }, fakeRuntime([12, 13])),
    /bc1 needs a width and height that are multiples of four \(30 by 18\)/,
  );
  assert.equal(
    createZhudaBasisTexture(transcoder, odd, {}, fakeRuntime([17, 16, 12, 13])).zhudaBasis.target,
    'rgba8',
  );
});
