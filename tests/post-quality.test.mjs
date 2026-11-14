import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZHUDA_COLOR_LUT_MAX_SIZE,
  parseZhudaCubeLut,
  validateZhudaCubeLut,
  zhudaCubeLutAtlas,
  zhudaIdentityCubeLut,
  zhudaSampleCubeLut,
} from '../packages/core/runtime3d/ColorLut.ts';
import {
  ZHUDA_TONE_MAPPINGS,
  applyZhudaToneCurve,
  releaseZhudaToneCurve,
  zhudaAgxToneMap,
  zhudaNeutralToneMap,
  zhudaToneMap,
} from '../packages/core/runtime3d/ToneCurves.ts';
import {
  ZhudaFilmicPipeline,
  validateZhudaFilmicGrade,
} from '../packages/core/runtime3d/Filmic.ts';
import { ZHUDA_SMAA_QUALITIES, validateZhudaSmaa } from '../packages/core/runtime3d/Smaa.ts';
import {
  ZHUDA_SMAA_AREA_SHA256,
  ZHUDA_SMAA_AREA_SIZE,
  ZHUDA_SMAA_SEARCH_SHA256,
  ZHUDA_SMAA_SEARCH_SIZE,
  zhudaSmaaAreaTable,
  zhudaSmaaSearchTable,
} from '../packages/core/runtime3d/SmaaTables.ts';
import {
  validateZhudaGroundTruthAO,
  zhudaHorizonVisibility,
} from '../packages/core/runtime3d/GroundTruthAO.ts';
import {
  ZHUDA_LENS_FLARE_SUN,
  validateZhudaLensFlare,
  zhudaLensFlareEdgeFade,
  zhudaLensFlarePlace,
} from '../packages/core/runtime3d/LensFlare.ts';
import {
  resolveZhudaFilmLook,
  validateZhudaFilmScene,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';
import { lookCubeText, lookColour } from './helpers/cube-fixture.mjs';

const close = (a, b, by, what) =>
  assert.ok(
    a.every((v, i) => Math.abs(v - b[i]) <= by),
    `${what ?? ''}: ${a} for ${b}`,
  );

test('a .cube file is read: title, size, domain, comments, either line ending', () => {
  const lut = parseZhudaCubeLut(lookCubeText(5));
  assert.equal(lut.title, 'Warm highlights, cool shadows');
  assert.equal(lut.size, 5);
  assert.deepEqual(lut.domainMin, [0, 0, 0]);
  assert.deepEqual(lut.domainMax, [1, 1, 1]);
  assert.equal(lut.data.length, 5 * 5 * 5 * 3);
  // Red changes fastest: the second entry is one step of red.
  close([...lut.data.subarray(3, 6)], lookColour([0.25, 0, 0]), 1e-6);
  close([...lut.data.subarray(5 * 3, 5 * 3 + 3)], lookColour([0, 0.25, 0]), 1e-6);
  close([...lut.data.subarray(25 * 3, 25 * 3 + 3)], lookColour([0, 0, 0.25]), 1e-6);
  const plain = parseZhudaCubeLut(
    '\uFEFF# a tool wrote this\nLUT_3D_SIZE 2\nLUT_3D_INPUT_RANGE 0.0 2.0\n' +
      '0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n',
  );
  assert.equal(plain.title, undefined);
  assert.deepEqual(plain.domainMax, [2, 2, 2]);
  assert.equal(
    parseZhudaCubeLut('TITLE no quotes\nLUT_3D_SIZE 2\n' + '0 0 0\n'.repeat(8)).title,
    'no quotes',
  );
});

test('a .cube file that is not a colour cube is refused with its line', () => {
  const eight = '0 0 0\n'.repeat(8);
  const refused = (text, pattern) => assert.throws(() => parseZhudaCubeLut(text), pattern);
  refused(eight, /line 1: the table begins before LUT_3D_SIZE/);
  refused('', /no LUT_3D_SIZE/);
  refused('LUT_3D_SIZE 2\nLUT_3D_SIZE 2\n' + eight, /line 2: the size is given twice/);
  refused('LUT_3D_SIZE 1\n', /LUT_3D_SIZE 2\.\.256/);
  refused('LUT_3D_SIZE 2.5\n', /LUT_3D_SIZE 2\.\.256/);
  refused('LUT_1D_SIZE 16\n', /line 1: a one-dimensional table/);
  refused('LUT_3D_SIZE 2\n' + '0 0 0\n'.repeat(7), /7 entries, 8 expected/);
  refused('LUT_3D_SIZE 2\n' + '0 0 0\n'.repeat(9), /line 10: more entries than 2³/);
  refused('LUT_3D_SIZE 2\n0 0\n', /line 2: 3 numbers expected/);
  refused('LUT_3D_SIZE 2\n0 0 x\n', /line 2: not a number/);
  refused('LUT_3D_SIZE 2\nGAMMA 2.2\n' + eight, /line 2: unknown keyword GAMMA/);
  refused('LUT_3D_SIZE 2\n0 0 0\nDOMAIN_MIN 0 0 0\n', /line 3: a keyword after the table began/);
  refused('LUT_3D_SIZE 2\nDOMAIN_MAX 1 0 1\n' + eight, /DOMAIN_MAX must be above DOMAIN_MIN/);
  refused(42, /is text/);
});

test('a table is sampled between its entries, and laid out in rows of slices', () => {
  const same = zhudaIdentityCubeLut(9);
  for (const colour of [
    [0, 0, 0],
    [1, 1, 1],
    [0.33, 0.07, 0.91],
  ])
    close(zhudaSampleCubeLut(same, colour), colour, 1e-6, 'a table that changes nothing');
  const look = parseZhudaCubeLut(lookCubeText(17));
  // On an entry the table's own value; between entries close to the arithmetic it was made from.
  close(zhudaSampleCubeLut(look, [0.5, 0.25, 0.75]), lookColour([0.5, 0.25, 0.75]), 1e-6);
  close(zhudaSampleCubeLut(look, [0.4, 0.3, 0.6]), lookColour([0.4, 0.3, 0.6]), 0.004);
  // Outside the domain the nearest edge.
  const narrow = zhudaIdentityCubeLut(3);
  narrow.domainMin = [0.25, 0.25, 0.25];
  narrow.domainMax = [0.75, 0.75, 0.75];
  close(zhudaSampleCubeLut(narrow, [0, 0.5, 1]), [0, 0.5, 1], 1e-6);
  close(zhudaSampleCubeLut(narrow, [0.375, 0.5, 0.625]), [0.25, 0.5, 0.75], 1e-6);
  assert.deepEqual(zhudaCubeLutAtlas(2), { columns: 2, rows: 1, width: 4, height: 2 });
  assert.deepEqual(zhudaCubeLutAtlas(33), { columns: 6, rows: 6, width: 198, height: 198 });
  const largest = zhudaCubeLutAtlas(ZHUDA_COLOR_LUT_MAX_SIZE);
  assert.deepEqual(largest, { columns: 9, rows: 8, width: 585, height: 520 });
  assert.ok(largest.columns * largest.rows >= ZHUDA_COLOR_LUT_MAX_SIZE);
  assert.deepEqual(validateZhudaCubeLut(same), []);
  assert.deepEqual(validateZhudaCubeLut(null), ['lut: object required']);
  assert.ok(validateZhudaCubeLut({ ...same, size: 8 }).some((issue) => /data/.test(issue)));
  assert.ok(
    validateZhudaCubeLut({ ...same, domainMax: [1, 0, 1] }).some((issue) => /above/.test(issue)),
  );
  assert.throws(() => zhudaIdentityCubeLut(1), /Invalid cube size/);
});

test('AgX fades bright colours to white and keeps black black', () => {
  assert.deepEqual(zhudaAgxToneMap([0, 0, 0]), [0, 0, 0]);
  const grey = zhudaAgxToneMap([0.18, 0.18, 0.18]);
  assert.ok(grey[0] > 0.17 && grey[0] < 0.23, `middle grey stays in the middle: ${grey}`);
  let last = -1;
  for (const v of [0.001, 0.01, 0.05, 0.18, 0.5, 1, 2, 4, 8, 16]) {
    const [out] = zhudaAgxToneMap([v, v, v]);
    assert.ok(out > last && out <= 1, `brighter in is brighter out: ${v} -> ${out}`);
    last = out;
  }
  assert.ok(zhudaAgxToneMap([64, 64, 64])[0] > 0.99, 'far above white is white');
  // A red sixteen times white: all three channels come up toward white, red still leading.
  const red = zhudaAgxToneMap([16, 1.6, 1.6]);
  assert.ok(red[0] > 0.98 && red[1] > 0.7 && red[1] < red[0], `${red}`);
  for (const colour of [
    [3, 0.1, 0.1],
    [0.1, 0.1, 5],
    [0.2, 9, 0.3],
  ])
    for (const v of zhudaAgxToneMap(colour)) assert.ok(v >= 0 && v <= 1, `${colour}: ${v}`);
});

test('the neutral curve leaves colours below 0.76 as they are', () => {
  // The darkest channel loses a small lift, 0.04 at most; the others follow.
  close(zhudaNeutralToneMap([0.5, 0.3, 0.2]), [0.46, 0.26, 0.16], 1e-12);
  close(zhudaNeutralToneMap([0.02, 0.02, 0.02]), [0.0025, 0.0025, 0.0025], 1e-12);
  assert.deepEqual(zhudaNeutralToneMap([0, 0, 0]), [0, 0, 0]);
  // No step where the roll-off begins, and never above white.
  const below = zhudaNeutralToneMap([0.7999, 0.7999, 0.7999])[0],
    above = zhudaNeutralToneMap([0.8001, 0.8001, 0.8001])[0];
  assert.ok(Math.abs(above - below) < 3e-4, `${below} ${above}`);
  let last = 0;
  for (const v of [1, 2, 4, 8, 64, 4096]) {
    const [out] = zhudaNeutralToneMap([v, v, v]);
    assert.ok(out > last && out < 1, `${v} -> ${out}`);
    last = out;
  }
  // A bright colour keeps its hue's order and loses saturation.
  const orange = zhudaNeutralToneMap([8, 4, 1]);
  assert.ok(orange[0] > orange[1] && orange[1] > orange[2] && orange[2] > 0.3, `${orange}`);
  assert.deepEqual(zhudaToneMap('none', [2, 0.5, 0]), [2, 0.5, 0]);
  assert.deepEqual(zhudaToneMap('agx', [1, 1, 1]), zhudaAgxToneMap([1, 1, 1]));
  assert.throws(() => zhudaToneMap('filmic', [1, 1, 1]), /Unknown tone mapping/);
  assert.deepEqual([...ZHUDA_TONE_MAPPINGS], ['aces', 'agx', 'neutral', 'none']);
});

/** A LayaAir colour grade as far as the curve touches it. */
function fakeGrade() {
  const defines = new Map();
  const define = (name) => defines.get(name) ?? defines.set(name, { name }).get(name);
  const shaders = new Map(
    ['LUTBuilder', 'blitLUTShader'].map((name) => [name, { name, passes: [] }]),
  );
  const destroyed = [];
  class Data {
    defines = new Set();
    addDefine(d) {
      this.defines.add(d.name);
    }
    removeDefine(d) {
      this.defines.delete(d.name);
    }
    destroy() {
      destroyed.push(this);
    }
  }
  class Material extends Data {
    lock = false;
    setShaderName(name) {
      if (!shaders.has(name)) throw Error('unknown shader ' + name);
      this.shader = name;
    }
  }
  const l = {
    ToneMappingType: { None: 0, ACES: 1 },
    ShaderFeatureType: { PostProcess: 1 },
    ShaderDataType: { Vector4: 1, Texture2D: 2 },
    VertexMesh: { MESH_POSITION0: 0 },
    RenderState: { DEPTHTEST_ALWAYS: 1, CULL_NONE: 0, BLEND_DISABLE: 0 },
    Material,
    LayaGL: { renderDeviceFactory: { createShaderData: () => new Data() } },
    SubShader: class {
      addShaderPass(vertex, fragment) {
        const pass = { vertex, fragment, renderState: {} };
        this.pass = pass;
        return pass;
      }
    },
    Shader3D: {
      add(name) {
        const shader = { name, addSubShader: (sub) => (shader.sub = sub) };
        shaders.set(name, shader);
        return shader;
      },
      find: (name) => shaders.get(name),
      getDefineByName: define,
    },
  };
  const builder = new Material();
  builder.setShaderName('LUTBuilder');
  const grade = {
    toneMapping: 1,
    _needBuildLUT: false,
    _lutBuilderMat: builder,
    _lutShaderData: new Data(),
    _LUTShader: shaders.get('blitLUTShader'),
  };
  return { l, grade, shaders, destroyed };
}

test('a curve of this engine draws with its own objects and gives LayaAir its own back', () => {
  const { l, grade, shaders, destroyed } = fakeGrade();
  const laya = { builder: grade._lutBuilderMat, lookup: grade._lutShaderData };
  applyZhudaToneCurve(l, grade, 'agx');
  assert.equal(grade.toneMapping, 0, 'LayaAir draws its table without a curve');
  assert.notEqual(grade._lutBuilderMat, laya.builder, 'another material builds the table');
  assert.notEqual(grade._lutShaderData, laya.lookup, 'other values look it up');
  assert.equal(grade._lutBuilderMat.shader, 'ZhudaLutBuilder');
  assert.equal(grade._LUTShader.name, 'ZhudaGradeLookup');
  assert.deepEqual([...grade._lutShaderData.defines], ['ZHUDA_TONE_AGX']);
  assert.equal(grade._needBuildLUT, true);
  assert.equal(
    laya.builder.shader,
    'LUTBuilder',
    "LayaAir's material is never given another shader",
  );
  const own = { builder: grade._lutBuilderMat, lookup: grade._lutShaderData };
  // The table holds the grade from black on, and the curve follows the lookup.
  const lookup = shaders.get('ZhudaGradeLookup').sub.pass.fragment;
  assert.match(lookup, /#ifdef ZHUDA_TONE_AGX\ncolor=zhudaAgx\(color\);/);
  assert.match(lookup, /#ifdef ZHUDA_TONE_NEUTRAL\ncolor=zhudaNeutral\(color\);/);
  assert.match(lookup, /zhudaTableLight\(applyLut\(zhudaTablePlace\(color\)/);
  assert.match(
    shaders.get('ZhudaLutBuilder').sub.pass.fragment,
    /zhudaTablePlace\(max\(colorGrade/,
  );
  grade._needBuildLUT = false;
  applyZhudaToneCurve(l, grade, 'neutral');
  assert.equal(grade._lutShaderData, own.lookup, 'the same values, another variant');
  assert.deepEqual([...grade._lutShaderData.defines], ['ZHUDA_TONE_NEUTRAL']);
  assert.equal(grade._needBuildLUT, true);
  applyZhudaToneCurve(l, grade, 'none');
  assert.deepEqual([...grade._lutShaderData.defines], []);
  assert.equal(grade._lutBuilderMat, own.builder);
  applyZhudaToneCurve(l, grade, 'aces');
  assert.equal(grade._lutBuilderMat, laya.builder);
  assert.equal(grade._lutShaderData, laya.lookup);
  assert.equal(grade._LUTShader.name, 'blitLUTShader');
  assert.equal(grade.toneMapping, 1);
  applyZhudaToneCurve(l, grade, 'agx');
  assert.equal(grade._lutBuilderMat, own.builder, 'made once for a grade');
  releaseZhudaToneCurve(l, grade);
  assert.equal(grade._lutBuilderMat, laya.builder);
  assert.equal(grade._lutShaderData, laya.lookup);
  assert.deepEqual(destroyed, [own.builder, own.lookup]);
  assert.equal(own.builder.lock, false);
  releaseZhudaToneCurve(l, grade);
  assert.equal(destroyed.length, 2, 'released once');
  assert.throws(() => applyZhudaToneCurve(l, grade, 'filmic'), /Unknown tone mapping/);
  assert.throws(() => applyZhudaToneCurve(l, {}, 'agx'), /no table to draw/);
});

test('the values of a grade are checked', () => {
  assert.deepEqual(validateZhudaFilmicGrade({}), []);
  assert.deepEqual(
    validateZhudaFilmicGrade({
      exposure: 1.2,
      toneMapping: 'agx',
      temperature: -40,
      tint: 15,
      lift: [0, 0.01, 0.02],
      gamma: [1, 1, 1.1],
      gain: [1.2, 1, 0.9],
      bloomThreshold: 1.5,
      bloomSoftKnee: 0.3,
      bloomAnamorphic: -0.5,
      bloomDiffusion: 6,
      bloomDirt: 2,
    }),
    [],
  );
  const refused = (values, pattern) => {
    const issues = validateZhudaFilmicGrade(values);
    assert.ok(
      issues.length === 1 && pattern.test(issues[0]),
      `${JSON.stringify(values)}: ${issues}`,
    );
  };
  refused({ exposure: -1 }, /^exposure: use 0\.\.1048576$/);
  refused({ temperature: 101 }, /^temperature: use -100\.\.100$/);
  refused({ tint: NaN }, /^tint/);
  refused({ lift: [0, 0] }, /^lift: three numbers -1\.\.1$/);
  refused({ gamma: [1, 1, 0] }, /^gamma: three numbers 0\.1\.\.10$/);
  refused({ gain: [1, 1, 17] }, /^gain: three numbers 0\.\.16$/);
  refused({ bloomSoftKnee: 1.5 }, /^bloomSoftKnee: use 0\.\.1$/);
  refused({ bloomAnamorphic: 2 }, /^bloomAnamorphic: use -1\.\.1$/);
  refused({ bloomDiffusion: 0 }, /^bloomDiffusion: use 1\.\.10$/);
  refused({ toneMapping: 'filmic' }, /^toneMapping: use aces, agx, neutral, none$/);
  // A chain refuses what it cannot draw before it makes anything (no runtime is needed to be told).
  assert.throws(
    () => new ZhudaFilmicPipeline({}, { aoMethod: 'gtao', aoIntensity: 5 }),
    /Invalid filmic option aoIntensity: use 0\.\.4/,
  );
  assert.throws(
    () => new ZhudaFilmicPipeline({}, { aoMethod: 'hbao' }),
    /Invalid filmic option aoMethod: use sao or gtao/,
  );
  assert.throws(
    () => new ZhudaFilmicPipeline({}, { bloomAnamorphic: 3, lift: [0, 0] }),
    /bloomAnamorphic: use -1\.\.1; lift: three numbers -1\.\.1|lift: three numbers -1\.\.1; bloomAnamorphic/,
  );
});

test('the edge tables are the ones recorded, and the options are checked', () => {
  const area = zhudaSmaaAreaTable(),
    search = zhudaSmaaSearchTable();
  assert.equal(area.length, ZHUDA_SMAA_AREA_SIZE * ZHUDA_SMAA_AREA_SIZE * 2);
  assert.equal(search.length, ZHUDA_SMAA_SEARCH_SIZE[0] * ZHUDA_SMAA_SEARCH_SIZE[1]);
  const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha(area), ZHUDA_SMAA_AREA_SHA256);
  assert.equal(sha(search), ZHUDA_SMAA_SEARCH_SHA256);
  // What the search table holds: how far into a read an edge went, 0, 1 or 2 pixels.
  assert.deepEqual([...new Set(search)].sort(), [0, 1, 2]);
  // The provenance record names the same bytes.
  const record = fs.readFileSync(
    path.resolve(import.meta.dirname, '../vendor/threejs-post/README.md'),
    'utf8',
  );
  assert.ok(record.includes(ZHUDA_SMAA_AREA_SHA256), 'the area table is in the record');
  assert.ok(record.includes(ZHUDA_SMAA_SEARCH_SHA256), 'the search table is in the record');
  assert.deepEqual(validateZhudaSmaa({}), []);
  assert.deepEqual(validateZhudaSmaa({ quality: 'ultra', cornerRounding: 0.25 }), []);
  assert.deepEqual(validateZhudaSmaa({ quality: 'best' }), [
    'quality: use low, medium, high or ultra',
  ]);
  assert.deepEqual(validateZhudaSmaa({ quality: 'toString' }), [
    'quality: use low, medium, high or ultra',
  ]);
  assert.deepEqual(validateZhudaSmaa({ cornerRounding: 1.5 }), ['cornerRounding: use 0..1']);
  // A search reads two pixels a step: the shader follows an edge 32 steps at most.
  for (const { steps, threshold } of Object.values(ZHUDA_SMAA_QUALITIES))
    assert.ok(steps <= 32 && threshold > 0 && threshold < 1);
});

test('the light through a slice: an open plane, a wall, and all slices of a slanted plane', () => {
  const half = Math.PI / 2;
  assert.ok(Math.abs(zhudaHorizonVisibility(-half, half, 0) - 1) < 1e-12, 'open, seen head on');
  assert.ok(Math.abs(zhudaHorizonVisibility(-half, 0, 0) - 0.5) < 1e-12, 'a wall to one side');
  assert.ok(Math.abs(zhudaHorizonVisibility(0, 0, 0)) < 1e-12, 'closed in');
  // Horizons beyond the surface's own plane are cut off at it.
  assert.equal(
    zhudaHorizonVisibility(-3, 3, 0.4),
    zhudaHorizonVisibility(0.4 - half, 0.4 + half, 0.4),
  );
  // A plane seen at a slant: one slice lets in more than the whole sky's light,
  // another less; over all slices it is 1. The picture of the occlusion must
  // hold more than 1 (it holds 255/160), or the average comes out dark.
  for (const tiltDeg of [20, 45, 60, 80]) {
    const tilt = (tiltDeg * Math.PI) / 180;
    let sum = 0,
      most = 0;
    const slices = 16;
    for (let s = 0; s < slices; s++) {
      const phi = ((s + 0.5) / slices) * Math.PI;
      // The normal's part in the slice, and its angle from the direction to the eye.
      const along = Math.sin(tilt) * Math.cos(phi),
        toEye = Math.cos(tilt);
      const length = Math.hypot(along, toEye),
        normal = Math.atan2(along, toEye);
      const seen = length * zhudaHorizonVisibility(normal - half, normal + half, normal);
      sum += seen;
      most = Math.max(most, seen);
    }
    assert.ok(Math.abs(sum / slices - 1) < 0.002, `tilt ${tiltDeg}: ${sum / slices}`);
    assert.ok(most <= 255 / 160, `tilt ${tiltDeg}: a slice gives ${most}`);
    if (tiltDeg >= 45) assert.ok(most > 1.05, `tilt ${tiltDeg}: a slice above 1 (${most})`);
  }
  assert.deepEqual(validateZhudaGroundTruthAO({}), []);
  assert.deepEqual(
    validateZhudaGroundTruthAO({ intensity: 2, radius: 1, slices: 4, steps: 8, halfSize: true }),
    [],
  );
  assert.deepEqual(validateZhudaGroundTruthAO({ intensity: 5 }), ['intensity: use 0..4']);
  assert.deepEqual(validateZhudaGroundTruthAO({ radius: 0 }), ['radius: use 0.05..10']);
  assert.deepEqual(validateZhudaGroundTruthAO({ slices: 2.5 }), [
    'slices: use a whole number 1..4',
  ]);
  assert.deepEqual(validateZhudaGroundTruthAO({ steps: 9 }), ['steps: use a whole number 2..8']);
  assert.deepEqual(validateZhudaGroundTruthAO({ halfSize: 1 }), ['halfSize: use true or false']);
});

test('a lens flare is placed along the line through the middle and fades off the frame', () => {
  const element = (extra) => ({ shape: 'disc', at: 0, size: 0.1, color: [1, 1, 1], ...extra });
  const light = [0.2, 0.7];
  assert.deepEqual(zhudaLensFlarePlace(element({ at: 0 }), light, 1.6).middle, [0.2, 0.7]);
  close(zhudaLensFlarePlace(element({ at: 1 }), light, 1.6).middle, [0.5, 0.5], 1e-12);
  close(zhudaLensFlarePlace(element({ at: 2 }), light, 1.6).middle, [0.8, 0.3], 1e-12);
  assert.equal(zhudaLensFlarePlace(element({ rotationDeg: 90 }), light, 1.6).angle, Math.PI / 2);
  // Following the line: on a frame 1.6 wide, 0.3 across and 0.2 down.
  const follow = zhudaLensFlarePlace(element({ follow: true }), light, 1.6).angle;
  assert.ok(Math.abs(follow - Math.atan2(-0.2, 0.48)) < 1e-12);
  assert.equal(zhudaLensFlareEdgeFade(0.3, -0.9), 1);
  assert.equal(zhudaLensFlareEdgeFade(1, 1), 1);
  assert.ok(Math.abs(zhudaLensFlareEdgeFade(1.15, 0) - 0.5) < 1e-9);
  assert.equal(zhudaLensFlareEdgeFade(0, -1.3), 0);
  assert.equal(zhudaLensFlareEdgeFade(4, 0), 0);
  assert.deepEqual(validateZhudaLensFlare({}), []);
  assert.deepEqual(validateZhudaLensFlare({ elements: ZHUDA_LENS_FLARE_SUN, strength: 2 }), []);
  const refused = (options, pattern) =>
    assert.ok(
      validateZhudaLensFlare(options).some((issue) => pattern.test(issue)),
      `${JSON.stringify(options)}: ${validateZhudaLensFlare(options)}`,
    );
  refused({ strength: 17 }, /^strength: use 0\.\.16$/);
  refused({ occlusionRadius: 0.5 }, /^occlusionRadius/);
  refused({ elements: [] }, /^elements: one to 12$/);
  refused({ elements: Array(13).fill(element()) }, /^elements: one to 12$/);
  refused({ elements: [element({ shape: 'star' })] }, /elements\[0\]\.shape: use glow, disc/);
  refused({ elements: [element({ at: 4 })] }, /elements\[0\]\.at: use -1\.\.3/);
  refused({ elements: [element({ color: [1, 2, 0] })] }, /elements\[0\]\.color/);
  refused({ elements: [element({ sides: 2 })] }, /elements\[0\]\.sides/);
  refused(
    { elements: [element(), element({ texture: 'x.png' })] },
    /elements\[1\]\.texture: not a field/,
  );
  refused({ elements: [null] }, /elements\[0\]: object expected/);
});

const scene = (look) => ({
  schemaVersion: 1,
  id: 'post',
  camera: { eye: [0, 1, 4], target: [0, 1, 0] },
  look,
  nodes: [],
});
const context = { materials: [] };

test('a look names its curve, balance, bloom shape, occlusion, table and flare', () => {
  assert.deepEqual(
    validateZhudaFilmScene(
      scene({
        grade: {
          toneMapping: 'neutral',
          temperature: 20,
          tint: -5,
          lift: [0, 0, 0.02],
          gamma: [1, 1, 1],
          gain: [1.1, 1, 0.95],
          bloomThreshold: 1,
          bloomSoftKnee: 0.7,
          bloomAnamorphic: 0.6,
          bloomDiffusion: 6,
          antialias: 'smaa',
          aoMethod: 'gtao',
          lut: { asset: 'looks/dusk.cube', intensity: 0.8 },
        },
        lensFlare: { strength: 0.7 },
      }),
      context,
    ),
    [],
  );
  const issues = validateZhudaFilmScene(
    scene({
      grade: {
        toneMapping: 'filmic',
        temperature: 200,
        lift: [0, 0],
        bloomDiffusion: 11,
        aoMethod: 'hbao',
        lut: { asset: '../outside.cube', intensity: 2, file: 'x' },
      },
      lensFlare: { strength: 99 },
    }),
    context,
  );
  for (const fragment of [
    'grade.toneMapping: use aces, agx, neutral, none',
    'grade.temperature: use -100..100',
    'grade.lift: three numbers -1..1',
    'grade.bloomDiffusion: use 1..10',
    'grade.aoMethod: use sao or gtao',
    'grade.lut.asset: an asset id required',
    'grade.lut.intensity: use 0..1',
    'grade.lut.file: unknown field',
    'lensFlare.strength: use 0..16',
  ])
    assert.ok(
      issues.some((issue) => issue.includes(fragment)),
      `${fragment}: ${issues}`,
    );
  assert.ok(
    validateZhudaFilmScene(scene({ lensFlare: true }), context).some((issue) =>
      issue.includes('lensFlare: needs grade'),
    ),
  );
  // By horizons the strength is a power, and 1 unless given.
  assert.equal(resolveZhudaFilmLook({ grade: {} }).grade.ao, 0.5);
  assert.equal(resolveZhudaFilmLook({ grade: { aoMethod: 'gtao' } }).grade.ao, 1);
  assert.equal(resolveZhudaFilmLook({ grade: { aoMethod: 'gtao', ao: 2 } }).grade.ao, 2);
  assert.deepEqual(resolveZhudaFilmLook({ grade: { lut: { asset: 'a.cube' } } }).grade.lut, {
    asset: 'a.cube',
    intensity: 1,
  });
  assert.equal(resolveZhudaFilmLook({ grade: {} }).lensFlare, false);
  const flare = resolveZhudaFilmLook({ grade: {}, lensFlare: true }).lensFlare;
  assert.equal(flare.strength, 1);
  assert.equal(flare.elements, ZHUDA_LENS_FLARE_SUN);
  assert.equal(
    resolveZhudaFilmLook({ grade: {}, lensFlare: { strength: 0.4 } }).lensFlare.strength,
    0.4,
  );
});

test('a running look takes new values in place and is built again for new parts', () => {
  const base = { grade: { lut: { asset: 'a.cube' } }, lensFlare: true };
  const reason = (from, to) =>
    zhudaFilmLookRebuildReason(resolveZhudaFilmLook(from), resolveZhudaFilmLook(to));
  const grade = (extra) => ({ ...base, grade: { ...base.grade, ...extra } });
  for (const values of [
    { toneMapping: 'agx' },
    { temperature: 30, tint: -10 },
    { lift: [0.01, 0, 0], gamma: [1.1, 1, 1], gain: [1, 1, 1.2] },
    { bloomThreshold: 2, bloomSoftKnee: 0.1, bloomAnamorphic: 1, bloomDiffusion: 7 },
    { lut: { asset: 'a.cube', intensity: 0.3 } },
  ])
    assert.equal(reason(base, grade(values)), null, JSON.stringify(values));
  assert.equal(reason(base, { ...base, lensFlare: { strength: 0.5 } }), null);
  assert.equal(reason(base, grade({ antialias: 'smaa' })), 'grade');
  assert.equal(reason(grade({ antialias: 'smaa' }), grade({ antialias: 'fxaa' })), 'grade');
  assert.equal(reason(grade({ antialias: 'msaa' }), grade({ antialias: 'none' })), null);
  assert.equal(reason(base, grade({ aoMethod: 'gtao' })), 'grade');
  // A table is loaded with the scene: a running look cannot take another.
  assert.equal(reason(base, grade({ lut: { asset: 'b.cube' } })), 'colorTable');
  assert.equal(reason(base, grade({ lut: false })), 'colorTable');
  assert.equal(reason(base, { ...base, lensFlare: false }), 'lensFlare');
  // Quality levels: the flare goes with the HDR chain; the table stays while there is a grade.
  const look = resolveZhudaFilmLook(grade({ antialias: 'smaa', aoMethod: 'gtao' }));
  assert.equal(zhudaLookForQuality(look, 2).lensFlare.strength, 1);
  assert.equal(zhudaLookForQuality(look, 2).grade.ao, 0);
  assert.equal(zhudaLookForQuality(look, 1).grade.antialias, 'fxaa');
  assert.deepEqual(zhudaLookForQuality(look, 1).grade.lut, { asset: 'a.cube', intensity: 1 });
  assert.equal(zhudaLookForQuality(look, 0).lensFlare, false);
  assert.equal(zhudaLookForQuality(look, 0, { keepGrade: true }).lensFlare, false);
  assert.deepEqual(zhudaLookForQuality(look, 0, { keepGrade: true }).grade.lut, {
    asset: 'a.cube',
    intensity: 1,
  });
});
