// Dither where a picture is written in eight bits: the shader text that is
// added, the arithmetic of its noise, and where a scene is told to dither.
// Pure checks; the draw is verify:dither.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZHUDA_DITHER_DEFINE,
  ZHUDA_DITHER_LINEAR_DEFINE,
  installLaya342Dither,
  setZhudaDither,
  zhudaDitherMode,
  zhudaDitherNoise,
  zhudaDitherStatus,
  zhudaPatchDitherInclude,
  zhudaPatchDitherPass,
} from '../packages/core/runtime3d/Dither.ts';
import { resolveZhudaFilmLook, validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';

/** The text LayaAir 3.4.2 registers for an include, read from a vendored library. */
function vendoredInclude(name, library) {
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, '../vendor/laya-3.4.2/libs', library),
    'utf8',
  );
  const start = source.indexOf(`addInclude("${name}",`);
  assert.ok(start > 0, `${name} is registered by ${library}`);
  const at = start + `addInclude("${name}",`.length;
  const quote = source[at];
  let end = at + 1;
  while (source[end] !== quote) end += source[end] === '\\' ? 2 : 1;
  return Function(`return ${source.slice(at, end + 1)}`)();
}

test('the vendored include still holds the line the noise is put before', () => {
  const text = vendoredInclude('OutputTransform.glsl', 'laya.core.js');
  const made = zhudaPatchDitherInclude(text);
  assert.equal(made.reason, undefined);
  // The functions are there for a scene that asks, before the function that may be followed by them.
  assert.ok(
    made.text.indexOf('float zhudaDitherNoise(vec2 p)') <
      made.text.indexOf('vec4 outputTransform(in vec4 color){'),
  );
  assert.ok(made.text.includes('#if defined(ZHUDA_DITHER)||defined(ZHUDA_DITHER_LINEAR)\n'));
  // Vertex programs read this include too, and have no pixel: nothing added names one.
  const added = made.text.slice(
    made.text.indexOf('#if defined(ZHUDA_DITHER)'),
    made.text.indexOf('vec4 outputTransform(in vec4 color){'),
  );
  assert.ok(!added.includes('gl_FragCoord'));
  // Taken out again, the include is LayaAir's.
  assert.equal(made.text.replace(added, ''), text);
  assert.match(zhudaPatchDitherInclude('vec4 other(){}').reason, /OutputTransform\.glsl/);
});

test('a fragment program is given the noise after each place it turns its colour for the screen', () => {
  const one = zhudaPatchDitherPass(
    'void main(){gl_FragColor=vec4(1.0);gl_FragColor=outputTransform(gl_FragColor);}',
  );
  assert.equal(one.calls, 1);
  // For the screen: as the screen shows it. Into eight bits on the way: as light.
  assert.ok(
    one.text.includes(
      'gl_FragColor=outputTransform(gl_FragColor);\n#ifdef ZHUDA_DITHER\n#ifdef GAMMACORRECT\ngl_FragColor.rgb=zhudaDither(gl_FragColor.rgb,gl_FragCoord.xy);\n#endif\n#endif\n#ifdef ZHUDA_DITHER_LINEAR\n#ifndef GAMMACORRECT\ngl_FragColor.rgb=zhudaDitherLinear(gl_FragColor.rgb,gl_FragCoord.xy);\n#endif\n#endif\n}',
    ),
  );
  // However it is spelt, and each time.
  const two = zhudaPatchDitherPass(
    'void main(){\n#ifdef A\ngl_FragColor = outputTransform(vec4(color,center.a));\n#endif\ngl_FragColor=outputTransform(center);}',
  );
  assert.equal(two.calls, 2);
  // A program that does not is left as it was.
  const none = 'void main(){gl_FragColor=vec4(0.0);}';
  assert.deepEqual(zhudaPatchDitherPass(none), { text: none, calls: 0 });
  // A function that only hands a colour on is not a place a picture is written.
  assert.equal(zhudaPatchDitherPass('vec4 f(vec4 c){return outputTransform(c);}').calls, 0);
});

test('the noise is between -1 and 1 of a step, most of it near none, and even on average', () => {
  let sum = 0,
    near = 0,
    least = Infinity,
    most = -Infinity;
  const count = 256 * 256;
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const n = zhudaDitherNoise(x + 0.5, y + 0.5);
      sum += n;
      if (Math.abs(n) < 0.5) near++;
      least = Math.min(least, n);
      most = Math.max(most, n);
    }
  assert.ok(least > -1 && most < 1, `${least}..${most}`);
  assert.ok(Math.abs(sum / count) < 0.01, `mean ${sum / count}`);
  // Two even numbers added: three quarters of them within half a step of none.
  assert.ok(Math.abs(near / count - 0.75) < 0.01, `within half a step: ${near / count}`);
  // The same pixel, the same noise.
  assert.equal(zhudaDitherNoise(12.5, 40.5), zhudaDitherNoise(12.5, 40.5));
  assert.notEqual(zhudaDitherNoise(12.5, 40.5), zhudaDitherNoise(13.5, 40.5));
});

/** Enough of LayaAir to register includes and passes through, and a scene with cameras. */
function runtime() {
  const includes = new Map(),
    passes = [];
  class SubShader {
    addShaderPass(vertex, fragment) {
      passes.push(fragment);
    }
  }
  return {
    includes,
    passes,
    SubShader,
    Shader3D: {
      addInclude: (name, text) => includes.set(name, text),
      getDefineByName: (name) => name,
    },
  };
}
const scene = (...hdr) => {
  const defines = new Set();
  return {
    defines,
    _cameraPool: hdr.map((enableHDR) => ({ enableHDR })),
    _shaderValues: {
      addDefine: (define) => defines.add(define),
      removeDefine: (define) => defines.delete(define),
      hasDefine: (define) => defines.has(define),
    },
  };
};

test('programs are changed only once the include is, and a scene is told where its picture is rounded', () => {
  const saved = globalThis.Laya;
  const laya = (globalThis.Laya = runtime());
  try {
    assert.deepEqual(zhudaDitherStatus(), {
      ready: false,
      reason: 'installLaya342Dither was not called',
      passes: 0,
    });
    assert.equal(installLaya342Dither(), true);
    assert.equal(installLaya342Dither(), true, 'once');
    const call = 'void main(){gl_FragColor=outputTransform(gl_FragColor);}';
    // Before the include is registered a call to the noise would be a call to nothing.
    new laya.SubShader().addShaderPass('', call);
    assert.equal(laya.passes[0], call);
    assert.equal(zhudaDitherStatus().ready, false);
    assert.throws(() => setZhudaDither(scene(false), true), /Dither is unavailable/);
    // Off is always allowed.
    assert.equal(setZhudaDither(scene(false), false), 'off');
    laya.Shader3D.addInclude(
      'OutputTransform.glsl',
      vendoredInclude('OutputTransform.glsl', 'laya.core.js'),
    );
    laya.Shader3D.addInclude('Other.glsl', 'float f(){return 1.0;}');
    assert.equal(laya.includes.get('Other.glsl'), 'float f(){return 1.0;}');
    assert.ok(laya.includes.get('OutputTransform.glsl').includes('zhudaDitherLinear'));
    new laya.SubShader().addShaderPass('', call);
    new laya.SubShader().addShaderPass('', 'void main(){}');
    assert.ok(laya.passes[1].includes('zhudaDither(gl_FragColor.rgb,gl_FragCoord.xy)'));
    assert.equal(laya.passes[2], 'void main(){}');
    assert.deepEqual(zhudaDitherStatus(), { ready: true, reason: null, passes: 1 });

    // A plain camera writes each material into eight bits; an HDR one rounds once, at the end.
    const plain = scene(false);
    assert.equal(setZhudaDither(plain, true), 'materials');
    assert.deepEqual([...plain.defines], [ZHUDA_DITHER_LINEAR_DEFINE]);
    assert.equal(zhudaDitherMode(plain), 'materials');
    const hdr = scene(true, true);
    assert.equal(setZhudaDither(hdr, true), 'screen');
    assert.deepEqual([...hdr.defines], [ZHUDA_DITHER_DEFINE]);
    assert.equal(setZhudaDither(scene(true, false), true), 'both');
    assert.equal(setZhudaDither(scene(), true), 'materials', 'no camera yet: as a plain one');
    // Named, it is as named; a camera that was destroyed is not counted.
    assert.equal(setZhudaDither(plain, 'screen'), 'screen');
    assert.deepEqual([...plain.defines], [ZHUDA_DITHER_DEFINE]);
    assert.equal(setZhudaDither(plain, 'both'), 'both');
    assert.equal(zhudaDitherMode(plain), 'both');
    assert.equal(setZhudaDither(plain, false), 'off');
    assert.equal(plain.defines.size, 0);
    assert.equal(zhudaDitherMode(plain), 'off');
    const gone = scene(true);
    gone._cameraPool.push({ enableHDR: false, destroyed: true });
    assert.equal(setZhudaDither(gone, true), 'screen');
    assert.throws(() => setZhudaDither(plain, 'always'), /Invalid dither/);
    assert.throws(() => setZhudaDither({}, true), /Scene3D/);

    // Text that has changed: nothing is touched and a scene that asks is told why.
    const changed = (globalThis.Laya = runtime());
    installLaya342Dither();
    changed.Shader3D.addInclude('OutputTransform.glsl', 'vec4 other(){}');
    assert.equal(changed.includes.get('OutputTransform.glsl'), 'vec4 other(){}');
    new changed.SubShader().addShaderPass('', call);
    assert.equal(changed.passes[0], call);
    assert.match(zhudaDitherStatus().reason, /no longer holds/);
    assert.throws(() => setZhudaDither(scene(false), true), /no longer holds/);
    assert.equal(installLaya342Dither({}), false);
  } finally {
    globalThis.Laya = saved;
  }
});

test('a look takes dither with its grade', () => {
  const film = (grade) => ({
    schemaVersion: 1,
    name: 'night',
    look: { preset: 'night', grade },
    camera: { position: [0, 1, 5], target: [0, 1, 0] },
    nodes: [],
  });
  assert.deepEqual(
    validateZhudaFilmScene(film({ dither: 'yes' }), { materials: [] }).filter((issue) =>
      issue.includes('dither'),
    ),
    ['scene.look.grade.dither: use true or false'],
  );
  assert.deepEqual(
    validateZhudaFilmScene(film({ dither: true }), { materials: [] }).filter((issue) =>
      issue.includes('dither'),
    ),
    [],
  );
  assert.equal(resolveZhudaFilmLook({ preset: 'night', grade: {} }).grade.dither, false);
  assert.equal(
    resolveZhudaFilmLook({ preset: 'night', grade: { dither: true } }).grade.dither,
    true,
  );
});
