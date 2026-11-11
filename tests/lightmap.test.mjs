import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeRadianceHdr,
  encodeZhudaLightmapRgbm,
  decodeZhudaLightmapTexel,
  ZHUDA_LIGHTMAP_MAX_LINEAR,
} from '../packages/core/runtime3d/Lightmap.ts';

const header = (w, h) => Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`);
const rgbe = (r, g, b) => {
  const max = Math.max(r, g, b);
  if (max < 1e-32) return [0, 0, 0, 0];
  const e = Math.ceil(Math.log2(max) + 1e-9),
    scale = 256 / 2 ** e;
  return [r, g, b].map((v) => Math.min(255, Math.floor(v * scale))).concat(e + 128);
};

test('Radiance HDR decodes flat and run-length encoded rows identically', () => {
  const width = 16,
    height = 2;
  const pixels = Array.from({ length: width * height }, (_, i) =>
    rgbe(i < 8 ? 3.5 : 0.25, 0.5, i % 2 ? 0 : 12),
  );
  const flat = Buffer.concat([header(width, height), Buffer.from(pixels.flat())]);
  // New-style RLE: each row is 2,2,width, then four channel planes of literal runs.
  const rows = [];
  for (let y = 0; y < height; y++) {
    rows.push(Buffer.from([2, 2, width >> 8, width & 255]));
    for (let c = 0; c < 4; c++) {
      const plane = pixels.slice(y * width, (y + 1) * width).map((p) => p[c]);
      // First half as a literal run, second half as literals too, except constant runs.
      const first = plane.slice(0, 8),
        second = plane.slice(8);
      const run = (values) =>
        values.every((v) => v === values[0])
          ? [128 + values.length, values[0]]
          : [values.length, ...values];
      rows.push(Buffer.from([...run(first), ...run(second)]));
    }
  }
  const rle = Buffer.concat([header(width, height), ...rows]);
  const a = decodeRadianceHdr(flat),
    b = decodeRadianceHdr(new Uint8Array(rle));
  assert.equal(a.width, width);
  assert.equal(a.height, height);
  assert.deepEqual([...a.rgb], [...b.rgb]);
  assert.ok(Math.abs(a.rgb[0] - 3.5) < 0.02, 'first texel red');
  assert.ok(Math.abs(a.rgb[1] - 0.5) < 0.02 && Math.abs(a.rgb[2] - 12) < 0.07);
  assert.equal(a.rgb[5], 0, 'second texel blue is zero');
});

test('bad HDR input is refused with a reason', () => {
  assert.throws(() => decodeRadianceHdr(Buffer.from('PNG\n')), /truncated header|bad signature/);
  assert.throws(
    () => decodeRadianceHdr(Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_xyze\n\n-Y 1 +X 1\n')),
    /only 32-bit_rle_rgbe/,
  );
  assert.throws(
    () => decodeRadianceHdr(Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n+Y 1 +X 1\n')),
    /orientation/,
  );
  assert.throws(
    () => decodeRadianceHdr(Buffer.concat([header(4, 4), Buffer.alloc(8)])),
    /truncated pixels/,
  );
  assert.throws(() => decodeRadianceHdr(header(5000, 1)), /size must be/);
  // A run that would write past the row.
  assert.throws(
    () => decodeRadianceHdr(Buffer.concat([header(8, 1), Buffer.from([2, 2, 0, 8, 128 + 9, 1])])),
    /run overflows/,
  );
});

test('RGBM lightmap encoding round-trips, scales and clamps', () => {
  const values = [0, 0.001, 0.02, 0.18, 0.5, 1, 2.5, 8, 30];
  const rgb = new Float32Array(values.flatMap((v) => [v, v / 2, v / 10]));
  const image = { width: values.length, height: 1, rgb };
  const encoded = encodeZhudaLightmapRgbm(image);
  values.forEach((value, i) => {
    const got = decodeZhudaLightmapTexel(...encoded.subarray(i * 4, i * 4 + 4));
    [value, value / 2, value / 10].forEach((want, c) => {
      // 8-bit colour under an 8-bit multiplier: 3 % or one dark step.
      assert.ok(
        Math.abs(got[c] - want) <= Math.max(0.03 * want, 0.002),
        `value ${want}: decoded ${got[c]}`,
      );
    });
  });
  const half = encodeZhudaLightmapRgbm(image, 0.5);
  const texel = decodeZhudaLightmapTexel(...half.subarray(5 * 4, 5 * 4 + 4));
  assert.ok(Math.abs(texel[0] - 0.5) < 0.02, 'intensity scales the light');
  const bright = encodeZhudaLightmapRgbm({
    width: 1,
    height: 1,
    rgb: new Float32Array([1e6, 0, -1]),
  });
  const clamped = decodeZhudaLightmapTexel(...bright);
  assert.ok(Math.abs(clamped[0] - ZHUDA_LIGHTMAP_MAX_LINEAR) < 0.5, 'clamped to the format range');
  assert.equal(clamped[2], 0, 'negative light is black');
  assert.throws(
    () => encodeZhudaLightmapRgbm({ width: 2, height: 2, rgb: new Float32Array(3) }),
    /Invalid lightmap pixels/,
  );
  assert.throws(() => encodeZhudaLightmapRgbm(image, -1), /Invalid lightmap intensity/);
});
