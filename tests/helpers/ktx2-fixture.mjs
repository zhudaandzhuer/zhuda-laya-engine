// KTX 2 files with a UASTC payload, made here so that no binary fixture is
// checked in and no encoder is needed: every 4 by 4 block is one colour
// (UASTC mode 8). Enough to check a transcoder and an upload block by block;
// it says nothing about how good an encoder's blocks are.
//
// UASTC LDR 4x4, solid colour block (bits from the least significant bit of
// byte 0): mode code 0x17 in 5 bits, R, G, B, A in 8 bits each, then the
// hints a transcoder uses for ETC1 and ETC2: differential bit, intensity
// table (3 bits), selector (2 bits), base colour R, G, B in 5 bits each.
// Checked against the Basis transcoder in tests/basis-texture.test.mjs.
import zlib from 'node:zlib';

const ETC1_MODIFIERS = [
  [-8, -2, 2, 8],
  [-17, -5, 5, 17],
  [-29, -9, 9, 29],
  [-42, -13, 13, 42],
  [-60, -18, 18, 60],
  [-80, -24, 24, 80],
  [-106, -33, 33, 106],
  [-183, -47, 47, 183],
];
const clamp = (value) => Math.max(0, Math.min(255, value));
const expand5 = (c) => (c << 3) | (c >> 2);

/** The ETC1 block of one colour nearest to a colour: table, selector and 5-bit base. */
export function etc1SolidHint([r, g, b]) {
  let best = null;
  for (let table = 0; table < 8; table++)
    for (let selector = 0; selector < 4; selector++) {
      const modifier = ETC1_MODIFIERS[table][selector];
      const base = [r, g, b].map((target) => {
        let pick = 0,
          least = Infinity;
        for (let c = 0; c < 32; c++) {
          const error = Math.abs(clamp(expand5(c) + modifier) - target);
          if (error < least) {
            least = error;
            pick = c;
          }
        }
        return pick;
      });
      const error = [r, g, b].reduce(
        (sum, target, i) => sum + (clamp(expand5(base[i]) + modifier) - target) ** 2,
        0,
      );
      if (!best || error < best.error) best = { table, selector, base, error };
    }
  return best;
}

/** One UASTC block of a single colour. */
export function uastcSolidBlock([r, g, b, a]) {
  const out = new Uint8Array(16);
  let at = 0;
  const put = (value, bits) => {
    for (let i = 0; i < bits; i++, at++) if ((value >> i) & 1) out[at >> 3] |= 1 << (at & 7);
  };
  const hint = etc1SolidHint([r, g, b]);
  put(0x17, 5);
  for (const channel of [r, g, b, a]) put(channel, 8);
  put(1, 1);
  put(hint.table, 3);
  put(hint.selector, 2);
  for (const channel of hint.base) put(channel, 5);
  return out;
}

/**
 * The picture the fixtures hold, as a colour for each 4 by 4 block: bands of
 * hue across, light to dark downwards, and (with alpha) a quarter that fades
 * out. `blocksWide` by `blocksHigh` colours, row by row.
 */
export function fixtureBlocks(blocksWide, blocksHigh, alpha) {
  const colors = [];
  for (let y = 0; y < blocksHigh; y++)
    for (let x = 0; x < blocksWide; x++) {
      const hue = (x / blocksWide) * 6,
        light = 1 - (y / blocksHigh) * 0.75;
      const channel = (shift) => {
        const k = (hue + shift) % 6;
        return Math.round(255 * light * Math.max(0, Math.min(1, Math.min(k, 4 - k))));
      };
      // A checker of two blocks, so that neighbours differ and a shifted upload shows.
      const dim = ((x >> 1) + (y >> 1)) & 1 ? 0.6 : 1;
      const a =
        alpha && x >= blocksWide / 2 && y >= blocksHigh / 2
          ? Math.round(255 * (1 - (x - blocksWide / 2) / (blocksWide / 2)))
          : 255;
      colors.push([
        Math.round(channel(2) * dim),
        Math.round(channel(0) * dim),
        Math.round(channel(4) * dim),
        a,
      ]);
    }
  return colors;
}

/** Block colours of the next mip level: the mean of each two by two blocks. */
function halve(colors, blocksWide, blocksHigh) {
  const w = Math.max(1, blocksWide >> 1),
    h = Math.max(1, blocksHigh >> 1);
  const out = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sum = [0, 0, 0, 0];
      let n = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(blocksWide - 1, x * 2 + dx),
            sy = Math.min(blocksHigh - 1, y * 2 + dy);
          colors[sy * blocksWide + sx].forEach((value, i) => (sum[i] += value));
          n++;
        }
      out.push(sum.map((value) => Math.round(value / n)));
    }
  return { colors: out, blocksWide: w, blocksHigh: h };
}

/** The colours of marked levels 1, 2, 3 and so on. */
export const LEVEL_MARKS = [
  [220, 30, 30],
  [30, 200, 30],
  [30, 30, 220],
  [220, 200, 30],
  [200, 30, 200],
  [30, 200, 200],
];

/** RGBA pixels of a level made of block colours. */
export function blockPixels(colors, blocksWide, width, height) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      pixels.set(colors[(y >> 2) * blocksWide + (x >> 2)], (y * width + x) * 4);
  return pixels;
}

/**
 * A KTX 2 file of UASTC solid-colour blocks and the pixels it stands for.
 * `width` and `height` are multiples of four unless `odd` is set, which
 * gives a size that is not (the last blocks are cut).
 */
export function makeUastcKtx2({
  width = 64,
  height = 64,
  alpha = false,
  srgb = true,
  mips = true,
  zstd = false,
  // Each level below the first in one flat colour of its own: a draw that
  // samples level 2 shows green only if the file's own levels were uploaded.
  markLevels = false,
} = {}) {
  let blocksWide = Math.ceil(width / 4),
    blocksHigh = Math.ceil(height / 4);
  let colors = fixtureBlocks(blocksWide, blocksHigh, alpha);
  const levels = [];
  const count = mips ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1;
  for (let level = 0; level < count; level++) {
    const w = Math.max(1, width >> level),
      h = Math.max(1, height >> level);
    const bw = Math.ceil(w / 4),
      bh = Math.ceil(h / 4);
    if (level > 0) {
      // Below one block a level is the mean of the level above.
      const next = halve(colors, blocksWide, blocksHigh);
      colors = next.colors;
      blocksWide = next.blocksWide;
      blocksHigh = next.blocksHigh;
    }
    if (markLevels && level > 0)
      colors = colors.map(() => [...LEVEL_MARKS[(level - 1) % LEVEL_MARKS.length], 255]);
    const data = new Uint8Array(bw * bh * 16);
    for (let i = 0; i < bw * bh; i++) data.set(uastcSolidBlock(colors[i]), i * 16);
    levels.push({ width: w, height: h, data, pixels: blockPixels(colors, bw, w, h) });
  }
  const stored = levels.map((level) =>
    zstd ? new Uint8Array(zlib.zstdCompressSync(level.data)) : level.data,
  );
  const dfd = new DataView(new ArrayBuffer(44));
  dfd.setUint32(0, 44, true);
  dfd.setUint16(8, 2, true);
  dfd.setUint16(10, 40, true);
  dfd.setUint8(12, 166); // KHR_DF_MODEL_UASTC
  dfd.setUint8(13, 1); // BT.709 primaries
  dfd.setUint8(14, srgb ? 2 : 1);
  dfd.setUint8(16, 3);
  dfd.setUint8(17, 3);
  dfd.setUint8(20, 16);
  dfd.setUint8(30, 127);
  dfd.setUint8(31, alpha ? 3 : 0);
  dfd.setUint32(40, 0xffffffff, true);
  const headerBytes = 12 + 9 * 4 + 4 * 4 + 2 * 8 + count * 24;
  const align = (value, to) => Math.ceil(value / to) * to;
  let at = align(headerBytes + 44, zstd ? 1 : 16);
  // The smallest level first in the file, as the format asks.
  const offsets = new Array(count);
  for (let level = count - 1; level >= 0; level--) {
    at = align(at, zstd ? 1 : 16);
    offsets[level] = at;
    at += stored[level].length;
  }
  const file = new Uint8Array(at),
    view = new DataView(file.buffer);
  file.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  let o = 12;
  for (const value of [0, 1, width, height, 0, 0, 1, count, zstd ? 2 : 0]) {
    view.setUint32(o, value, true);
    o += 4;
  }
  for (const value of [headerBytes, 44, 0, 0]) {
    view.setUint32(o, value, true);
    o += 4;
  }
  o += 16; // no supercompression global data
  for (let level = 0; level < count; level++) {
    view.setBigUint64(o, BigInt(offsets[level]), true);
    view.setBigUint64(o + 8, BigInt(stored[level].length), true);
    view.setBigUint64(o + 16, BigInt(levels[level].data.length), true);
    o += 24;
  }
  file.set(new Uint8Array(dfd.buffer), headerBytes);
  for (let level = 0; level < count; level++) file.set(stored[level], offsets[level]);
  return { file, width, height, alpha, srgb, levels };
}

/** The Basis transcoder's module factory, from the vendored script, for Node. */
export async function loadBasisFactory(vendorDir) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { createRequire } = await import('node:module');
  const script = path.join(vendorDir, 'basis_transcoder.js');
  // The script is written for a page or CommonJS; here it is given what it asks of Node.
  const factory = new Function(
    'require',
    '__filename',
    '__dirname',
    fs.readFileSync(script, 'utf8') + '; return BASIS;',
  )(createRequire(script), script, vendorDir);
  return {
    factory,
    wasm: new Uint8Array(fs.readFileSync(path.join(vendorDir, 'basis_transcoder.wasm'))),
  };
}
