// An HDR panorama as a scene's light (record hdr-environment): the panorama
// to cube conversion, the studio room, half floats and the prefilter that
// joins them. The upload and the draws are checked by verify:hdr-environment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prefilterZhudaHdrEnvironment,
  zhudaEquirectDirection,
  zhudaEquirectToCube,
  zhudaBlurredPanorama,
  zhudaEquirectUv,
  zhudaShrinkPanorama,
  zhudaStudioEnvironment,
} from '../packages/core/runtime3d/HdrEnvironment.ts';
import { zhudaEnvironmentFormats } from '../packages/core/runtime3d/Filmic.ts';
import {
  zhudaFloatToHalf,
  zhudaToHalfFloats,
  zhudaToRgbd,
} from '../packages/core/runtime3d/HalfFloat.ts';
import { zhudaCubeDirection } from '../packages/core/runtime3d/EnvironmentProbe.ts';

const near = (actual, expected, tolerance, message) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} against ${expected} (within ${tolerance})`,
  );
/** A panorama made from a function of the direction. */
function panorama(width, height, radiance) {
  const rgb = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      rgb.set(
        radiance(zhudaEquirectDirection((x + 0.5) / width, (y + 0.5) / height)),
        (y * width + x) * 3,
      );
  return { width, height, rgb };
}
/** The direction of the brightest texel of a cube picture, and its value. */
function brightest(cube) {
  let best = -1,
    at = [0, 0, 0];
  const { size, data } = cube;
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const value = data[(face * size * size + j * size + i) * 4];
        if (value > best) {
          best = value;
          const d = zhudaCubeDirection(
            face,
            (2 * (i + 0.5)) / size - 1,
            (2 * (j + 0.5)) / size - 1,
          );
          const length = Math.hypot(...d);
          at = d.map((c) => c / length);
        }
      }
  return { value: best, direction: at };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => v.map((c) => c / Math.hypot(...v));
/** A lamp of a few degrees toward `toward`, on a dim ground. */
const spot = (toward) => (d) => {
  const value = dot(d, toward) > Math.cos((6 * Math.PI) / 180) ? 50 : 0.1;
  return [value, value, value];
};

test('a direction and its place in a panorama', () => {
  // The middle of the picture is toward -Z; +X a quarter to its right; up is the top row.
  for (const [direction, u, v] of [
    [[0, 0, -1], 0.5, 0.5],
    [[1, 0, 0], 0.75, 0.5],
    [[-1, 0, 0], 0.25, 0.5],
    [[0, 1, 0], null, 0],
    [[0, -1, 0], null, 1],
  ]) {
    const [au, av] = zhudaEquirectUv(...direction);
    if (u !== null) near(au, u, 1e-9, `u of ${direction}`);
    near(av, v, 1e-9, `v of ${direction}`);
  }
  // Straight behind lies on the seam, at either edge.
  const seam = zhudaEquirectUv(0, 0, 1)[0];
  assert.ok(seam < 1e-9 || seam > 1 - 1e-9);
  // Any length of the direction; and back again.
  assert.deepEqual(zhudaEquirectUv(0, 0, -7), zhudaEquirectUv(0, 0, -1));
  for (const d of [
    [0.3, 0.5, -0.8],
    [-0.6, -0.2, 0.7],
    [0.9, 0.1, 0.4],
  ].map(unit)) {
    const back = zhudaEquirectDirection(...zhudaEquirectUv(...d));
    d.forEach((c, i) => near(back[i], c, 1e-9, 'a direction comes back'));
  }
});

test('a panorama becomes a cube picture of the same surroundings', () => {
  // One colour everywhere stays that colour.
  const flat = zhudaEquirectToCube(
    panorama(64, 32, () => [0.25, 0.5, 1]),
    { size: 16 },
  );
  assert.equal(flat.size, 16);
  assert.equal(flat.data.length, 16 * 16 * 24);
  for (let i = 0; i < flat.data.length; i += 4) {
    near(flat.data[i], 0.25, 1e-5, 'red');
    near(flat.data[i + 1], 0.5, 1e-5, 'green');
    near(flat.data[i + 2], 1, 1e-5, 'blue');
    assert.equal(flat.data[i + 3], 1);
  }
  // A lamp is found where it stands, on every face and across edges.
  for (const toward of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [1, 1, -1],
    [-0.2, 0.6, 0.8],
  ].map(unit)) {
    const cube = zhudaEquirectToCube(panorama(512, 256, spot(toward)), { size: 64 });
    const found = brightest(cube);
    assert.ok(found.value > 25, `the lamp toward ${toward} is in the cube (${found.value})`);
    assert.ok(
      dot(found.direction, toward) > Math.cos((7 * Math.PI) / 180),
      `and stands toward ${toward}, not ${found.direction}`,
    );
  }
  // Turned a quarter to the right: what was ahead (-Z) is now to the right (+X).
  const ahead = panorama(512, 256, spot([0, 0, -1]));
  const turned = brightest(zhudaEquirectToCube(ahead, { size: 64, rotationDeg: 90 }));
  assert.ok(
    dot(turned.direction, [1, 0, 0]) > Math.cos((7 * Math.PI) / 180),
    `${turned.direction}`,
  );
  const back = brightest(zhudaEquirectToCube(ahead, { size: 64, rotationDeg: -450 }));
  assert.ok(
    dot(back.direction, [-1, 0, 0]) > Math.cos((7 * Math.PI) / 180),
    'and any number of turns',
  );
  // Exposure scales; the largest value kept is kept.
  near(
    brightest(zhudaEquirectToCube(ahead, { size: 64, exposure: 0.5 })).value,
    25,
    0.5,
    'exposure',
  );
  near(brightest(zhudaEquirectToCube(ahead, { size: 64, maxRadiance: 4 })).value, 4, 1e-6, 'limit');
  near(
    brightest(zhudaEquirectToCube(ahead, { size: 64, maxRadiance: 4, exposure: 2 })).value,
    8,
    1e-6,
    'the limit is on the photograph, the exposure on the result',
  );
});

test('the light of a panorama is the light of its cube', () => {
  // A sky that is bright above, a ground that is dark, and a warm side.
  const sky = panorama(256, 128, (d) => [
    0.2 + Math.max(0, d[1]) * 2 + Math.max(0, d[0]),
    0.2 + Math.max(0, d[1]) * 2,
    0.3 + Math.max(0, d[1]) * 3,
  ]);
  // Mean over the sphere: rows of a panorama weigh by the sine of their height.
  const mean = [0, 0, 0];
  let weight = 0;
  for (let y = 0; y < sky.height; y++) {
    const w = Math.sin(((y + 0.5) / sky.height) * Math.PI);
    for (let x = 0; x < sky.width; x++, weight += w)
      for (let c = 0; c < 3; c++) mean[c] += sky.rgb[(y * sky.width + x) * 3 + c] * w;
  }
  const cube = zhudaEquirectToCube(sky, { size: 32 });
  // Texels of a cube weigh by their solid angle.
  const cubeMean = [0, 0, 0];
  let cubeWeight = 0;
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 32; i++) {
        const s = (2 * (i + 0.5)) / 32 - 1,
          t = (2 * (j + 0.5)) / 32 - 1;
        const w = 1 / (1 + s * s + t * t) ** 1.5;
        cubeWeight += w;
        for (let c = 0; c < 3; c++)
          cubeMean[c] += cube.data[(face * 1024 + j * 32 + i) * 4 + c] * w;
      }
  for (let c = 0; c < 3; c++)
    near(
      cubeMean[c] / cubeWeight,
      mean[c] / weight,
      (mean[c] / weight) * 0.01,
      `mean of channel ${c}`,
    );
});

test('a panorama that is not one is refused', () => {
  const good = panorama(32, 16, () => [1, 1, 1]);
  assert.throws(
    () => zhudaEquirectToCube({ width: 32, height: 16, rgb: new Float32Array(10) }),
    /Invalid panorama/,
  );
  assert.throws(() => zhudaEquirectToCube(null), /Invalid panorama/);
  for (const size of [8, 48, 2048, 31.5])
    assert.throws(() => zhudaEquirectToCube(good, { size }), /power of two between 16 and 1024/);
  assert.throws(() => zhudaEquirectToCube(good, { exposure: -1 }), /exposure/);
  assert.throws(() => zhudaEquirectToCube(good, { maxRadiance: 0 }), /maxRadiance/);
  assert.throws(() => zhudaEquirectToCube(good, { rotationDeg: NaN }), /rotationDeg/);
});

test('the studio room is lit from above and the same every time', () => {
  const room = zhudaStudioEnvironment();
  assert.equal(room.size, 64);
  assert.deepEqual(zhudaStudioEnvironment().data, room.data, 'the same room each time');
  assert.ok(room.data.every((value) => Number.isFinite(value) && value >= 0));
  // The large lamp is overhead; the floor is the darkest wall.
  assert.ok(brightest(room).direction[1] > 0.7, 'brightest above');
  const meanOf = (face) => {
    let sum = 0;
    for (let i = 0; i < 64 * 64; i++) sum += room.data[(face * 64 * 64 + i) * 4];
    return sum / (64 * 64);
  };
  const faces = [0, 1, 2, 3, 4, 5].map(meanOf);
  assert.equal(
    faces.indexOf(Math.max(...faces)),
    2,
    `the ceiling is the brightest face (${faces})`,
  );
  assert.equal(faces.indexOf(Math.min(...faces)), 3, 'the floor the darkest');
  // Lamps scale with intensity; without them the walls are left.
  const dark = zhudaStudioEnvironment({ intensity: 0 }),
    bright = zhudaStudioEnvironment({ intensity: 2 });
  assert.ok(brightest(dark).value < 0.5, 'walls alone are dim');
  near(brightest(bright).value, brightest(room).value * 2, 0.01, 'twice the lamps');
  assert.equal(zhudaStudioEnvironment({ size: 16 }).data.length, 16 * 16 * 24);
  assert.throws(() => zhudaStudioEnvironment({ size: 20 }), /power of two/);
  assert.throws(() => zhudaStudioEnvironment({ intensity: 17 }), /intensity/);
  assert.throws(() => zhudaStudioEnvironment({ walls: [1, 2, 0] }), /walls/);
});

test('floats become half floats to the nearest', () => {
  const decode = (h) => {
    const exponent = (h >> 10) & 31,
      mantissa = h & 1023;
    if (exponent === 0) return mantissa * 2 ** -24;
    return (1 + mantissa / 1024) * 2 ** (exponent - 15);
  };
  for (const [value, bits] of [
    [0, 0],
    [1, 0x3c00],
    [2, 0x4000],
    [0.5, 0x3800],
    [65504, 0x7bff],
    [1e9, 0x7bff],
    [-3, 0],
    [NaN, 0],
  ])
    assert.equal(zhudaFloatToHalf(value), bits, `${value}`);
  // Across the range a scene's light takes: within half a step of the format.
  for (let value = 1e-6; value < 60000; value *= 1.37) {
    const back = decode(zhudaFloatToHalf(value));
    const step = value < 2 ** -14 ? 2 ** -24 : 2 ** (Math.floor(Math.log2(value)) - 10);
    assert.ok(Math.abs(back - value) <= step / 2 + 1e-12, `${value} comes back as ${back}`);
  }
  // A mantissa that rounds up to the next power of two.
  near(decode(zhudaFloatToHalf(1.99999)), 2, 1e-9, 'rounds up into the next exponent');
  assert.deepEqual([...zhudaToHalfFloats(new Float32Array([0, 1, 2]))], [0, 0x3c00, 0x4000]);
});

test('light as 8 bits with a divisor comes back near what it was', () => {
  const colours = [
    [0, 0, 0],
    [0.2, 0.5, 1],
    [1, 1, 1],
    [3, 1.5, 0.25],
    [40, 20, 10],
    [250, 100, 1],
    [1000, 10, 10],
  ];
  const encoded = zhudaToRgbd(new Float32Array(colours.flatMap((c) => [...c, 1])));
  colours.forEach((colour, index) => {
    const [r, g, b, a] = encoded.subarray(index * 4, index * 4 + 4);
    const peak = Math.max(...colour);
    // At most 1: the colour as it is, alpha full.
    if (peak <= 1) assert.equal(a, 255);
    // As LayaAir's shader reads it back: rgb / a.
    const back = [r, g, b].map((value) => value / 255 / (a / 255));
    colour.forEach((value, c) => {
      const kept = Math.min(value, 255);
      // A step of the divisor at that brightness, and a step of the 8 bits.
      const tolerance = Math.max(
        1 / 255,
        kept * (peak > 1 ? 0.5 / Math.max(1, 255 / Math.min(peak, 255)) + 0.01 : 0.01),
      );
      near(back[c], kept, tolerance + (value > 255 ? 255 : 0), `${colour} channel ${c}`);
    });
  });
  assert.equal(encoded.length, colours.length * 4);
});

test('the formats a device filters, best first', () => {
  const RenderCapable = {
    TextureFormat_R32G32B32A32: 1,
    Texture_FloatLinearFiltering: 2,
    TextureFormat_R16G16B16A16: 3,
    Texture_HalfFloatLinearFiltering: 4,
  };
  const runtime = (have) => ({
    RenderCapable,
    LayaGL: { renderEngine: { getCapable: (id) => have.includes(id) } },
  });
  assert.deepEqual(zhudaEnvironmentFormats(runtime([1, 2, 3, 4])), ['float', 'half', 'rgbd']);
  // Float textures that cannot be filtered do not count (a phone without OES_texture_float_linear).
  assert.deepEqual(zhudaEnvironmentFormats(runtime([1, 3, 4])), ['half', 'rgbd']);
  assert.deepEqual(zhudaEnvironmentFormats(runtime([3])), ['rgbd']);
  assert.deepEqual(zhudaEnvironmentFormats({}), ['rgbd']);
});

test('a wide panorama is made smaller by whole steps; a soft sky is a blurred level', () => {
  const wide = panorama(64, 32, (d) => [1 + d[0], 1 + d[1], 1 + d[2]]);
  assert.equal(zhudaShrinkPanorama(wide, 64), wide, 'small enough: itself');
  const small = zhudaShrinkPanorama(wide, 20);
  assert.deepEqual([small.width, small.height], [16, 8]);
  // Each pixel is the mean of its square.
  let sum = 0;
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) sum += wide.rgb[(dy * 64 + dx) * 3];
  near(small.rgb[0], sum / 16, 1e-6, 'the first pixel');
  // A soft sky from the prefiltered levels: the lamp is still where it stands, and wider.
  const lamp = panorama(256, 128, spot(unit([1, 0.4, -0.3])));
  const filtered = prefilterZhudaHdrEnvironment({ panorama: lamp }, { size: 32, samples: 64 });
  const peak = (picture) => {
    let best = -1,
      at = [0, 0, 0];
    for (let y = 0; y < picture.height; y++)
      for (let x = 0; x < picture.width; x++)
        if (picture.rgb[(y * picture.width + x) * 3] > best) {
          best = picture.rgb[(y * picture.width + x) * 3];
          at = zhudaEquirectDirection((x + 0.5) / picture.width, (y + 0.5) / picture.height);
        }
    return { value: best, direction: at };
  };
  const sharp = peak(zhudaBlurredPanorama(filtered, 0, 128)),
    soft = peak(zhudaBlurredPanorama(filtered, 3, 128));
  for (const found of [sharp, soft])
    assert.ok(
      dot(found.direction, unit([1, 0.4, -0.3])) > Math.cos((12 * Math.PI) / 180),
      `the lamp stays where it is (${found.direction})`,
    );
  assert.ok(
    soft.value < sharp.value * 0.5,
    `and is spread out (${soft.value} against ${sharp.value})`,
  );
});

test('a panorama or a cube picture is prefiltered for LayaAir', () => {
  const sky = panorama(128, 64, (d) => [1 + d[1], 1 + d[1], 1 + d[1]]);
  const { spec, pixels } = prefilterZhudaHdrEnvironment(
    { panorama: sky },
    { size: 16, samples: 16 },
  );
  assert.equal(spec.size, 16);
  assert.equal(spec.levels.length, 5);
  assert.equal(spec.ambientSH.length, 27);
  assert.equal(
    pixels.length,
    spec.levels.reduce((sum, level) => sum + level.elements, 0),
  );
  assert.ok(pixels.every((value) => Number.isFinite(value) && value >= 0));
  // A room made here goes the same way.
  const room = prefilterZhudaHdrEnvironment(
    { cube: zhudaStudioEnvironment({ size: 16 }) },
    { size: 16, samples: 16 },
  );
  assert.equal(room.spec.size, 16);
  assert.throws(() => prefilterZhudaHdrEnvironment({}), /either a panorama or a cube/);
  assert.throws(
    () => prefilterZhudaHdrEnvironment({ panorama: sky, cube: zhudaStudioEnvironment() }),
    /either a panorama or a cube/,
  );
});
