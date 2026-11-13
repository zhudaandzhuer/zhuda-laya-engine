// Shadows from a point light: the shader patch, the options and the film
// schema. Pure checks; the draw is verify:film-point-shadow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_POINT_SHADOW_DEFINE,
  ZhudaPointShadow,
  installLaya342PointShadows,
  validateZhudaPointShadow,
} from '../packages/core/runtime3d/PointShadow.ts';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';

const UPSTREAM =
  'vec3 before(){return vec3(0.0);}Light getLight(in PointLight pointLight,in vec3 normalWS,in vec3 positionWS){Light light;light.attenuation=pointLight.attenuation;return light;}Light getLight(in SpotLight spotLight,in vec3 normalWS,in vec3 positionWS){Light light;return light;}';

test('the patch asks the point-light function for a shadow and is inert without its define', () => {
  const added = {};
  const runtime = {
    Shader3D: {
      addInclude(name, text) {
        added[name] = text;
      },
    },
  };
  assert.equal(installLaya342PointShadows({}), false, 'nothing to patch');
  assert.equal(installLaya342PointShadows(runtime), true);
  const wrapped = runtime.Shader3D.addInclude;
  assert.equal(installLaya342PointShadows(runtime), true);
  assert.equal(runtime.Shader3D.addInclude, wrapped, 'installed once');
  runtime.Shader3D.addInclude('Lighting.glsl', UPSTREAM);
  runtime.Shader3D.addInclude('Other.glsl', UPSTREAM);
  runtime.Shader3D.addInclude('Lighting.glsl.unknown', 'void f(){}');
  assert.equal(added['Other.glsl'], UPSTREAM, 'other includes are untouched');
  const text = added['Lighting.glsl'];
  assert.ok(
    text.includes(
      'light.attenuation=pointLight.attenuation*zhudaPointShadow(pointLight.position,normalWS,positionWS);',
    ),
  );
  // Directives start a line, and everything new sits behind the define.
  for (const line of text.split('\n'))
    assert.ok(!/.#(ifdef|else|endif)/.test(line), `directive inside a line: ${line.slice(0, 60)}`);
  assert.ok(text.includes(`\n#ifdef ${ZHUDA_POINT_SHADOW_DEFINE}\nuniform sampler2D`));
  // Without the define the function is `float shade=1.0; return shade;`: the
  // upstream result. No \`#else\`: LayaAir's preprocessor drops that branch.
  const body = text.slice(
    text.indexOf('float zhudaPointShadow'),
    text.indexOf('Light getLight(in PointLight'),
  );
  assert.match(body, /\{\nfloat shade=1\.0;\n#ifdef ZHUDA_POINT_SHADOW\n/);
  assert.match(body, /\n#endif\nreturn shade;\n}\n$/);
  assert.ok(!body.includes('#else'));
  // A text without the expected function is passed on as it is.
  const other = { Shader3D: { addInclude: (name, value) => (added.raw = value) } };
  installLaya342PointShadows(other);
  other.Shader3D.addInclude('Lighting.glsl', 'void changedUpstream(){}');
  assert.equal(added.raw, 'void changedUpstream(){}');
});

test('options are checked, and the class says what it needs', () => {
  assert.deepEqual(
    validateZhudaPointShadow({
      resolution: 1024,
      near: 0.3,
      strength: 0.8,
      lights: 2,
      softness: 3,
    }),
    [],
  );
  assert.deepEqual(validateZhudaPointShadow({ lights: 5, softness: 5 }), [
    'softness: use 0..4',
    'lights: use a whole number 1..4',
  ]);
  assert.deepEqual(validateZhudaPointShadow({ resolution: 1024, lights: 3 }), [
    'resolution: 1024 holds at most two lights (the pictures are 4096 tall at most)',
  ]);
  assert.deepEqual(validateZhudaPointShadow({ resolution: 300, near: 0, strength: 2, bias: -1 }), [
    'resolution: use 256, 512 or 1024',
    'near: use 0.01..10',
    'strength: use 0..1',
    'bias: use 0..1',
  ]);
  const saved = globalThis.Laya;
  globalThis.Laya = { MaterialPostProcessEffect: class {}, Shader3D: { addInclude() {} } };
  try {
    assert.throws(
      () => new ZhudaPointShadow({}),
      /installLaya342PointShadows\(\) before Laya\.init/,
    );
    assert.throws(() => new ZhudaPointShadow({}, { resolution: 100 }), /resolution/);
  } finally {
    globalThis.Laya = saved;
  }
});

test('up to four point lights and one spot light of a film scene may cast shadows', () => {
  const scene = (lights) => ({
    schemaVersion: 1,
    id: 'lamps',
    camera: { eye: [0, 2, 8], target: [0, 1, 0] },
    nodes: [{ id: 'ground', type: 'ground', size: [20, 20], material: 'asphalt' }, ...lights],
  });
  const context = { props: [], recipes: ['asphalt'] };
  const point = (id, more = {}) => ({
    id,
    type: 'light',
    kind: 'point',
    position: [0, 3, 0],
    ...more,
  });
  const spot = { id: 's', type: 'light', kind: 'spot', position: [4, 5, 0], target: [4, 0, 0] };
  assert.deepEqual(
    validateZhudaFilmScene(
      scene([point('a', { castsShadow: true }), point('b'), { ...spot, castsShadow: true }]),
      context,
    ),
    [],
  );
  const casting = (count) =>
    Array.from({ length: count }, (_, i) =>
      point('p' + i, { position: [i * 4, 3, 0], castsShadow: true }),
    );
  assert.deepEqual(validateZhudaFilmScene(scene(casting(4)), context), []);
  assert.deepEqual(validateZhudaFilmScene(scene(casting(5)), context), [
    'scene.nodes: at most 4 point lights may cast shadows',
  ]);
  assert.match(
    validateZhudaFilmScene(scene([point('a', { castsShadow: true, fogOnly: true })]), context)[0],
    /castsShadow: not on a point light that is fogOnly or follows a model/,
  );
});
