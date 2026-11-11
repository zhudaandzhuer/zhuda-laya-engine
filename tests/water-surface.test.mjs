import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateZhudaWaterSurface,
  zhudaWaterAbsorption,
} from '../packages/core/shaders/WaterSurface.ts';
import {
  installLaya342Translucency,
  ZHUDA_TRANSLUCENT_DEFINE,
} from '../packages/core/runtime3d/Laya342Adapters.ts';

test('water options are validated with the name of what is wrong', () => {
  assert.deepEqual(validateZhudaWaterSurface({ position: [0, 0, 0], size: [10, 20] }), []);
  assert.deepEqual(
    validateZhudaWaterSurface({
      position: [0, 0.2, 0],
      size: [100, 60],
      flow: [0.8, -0.2],
      color: [0.03, 0.3, 0.26],
      clarity: 1.2,
      waveMeters: 0.8,
      waves: 0.4,
      refraction: 0.5,
      reflection: 0.8,
      glow: 0.6,
      foamDepth: 0.1,
      resolution: 2048,
      layer: 28,
      sun: { toward: [0, 1, 0], color: [3, 2.8, 2.4] },
    }),
    [],
  );
  const issues = validateZhudaWaterSurface({
    position: [0, 0],
    size: [0, 10],
    flow: [30, 0],
    color: [2, 0, 0],
    clarity: 0,
    waveMeters: 100,
    waves: 2,
    refraction: -1,
    reflection: 9,
    glow: 5,
    foamDepth: 3,
    resolution: 300,
    layer: 31,
    sun: { toward: [0, 2, 0], color: [1, 1, 1] },
  });
  for (const key of [
    'position',
    'size',
    'flow',
    'color',
    'clarity',
    'waveMeters',
    'waves',
    'refraction',
    'reflection',
    'glow',
    'foamDepth',
    'resolution',
    'layer',
    'sun',
  ])
    assert.ok(
      issues.some((issue) => issue.startsWith(key + ':')),
      key + ': ' + issues.join(' | '),
    );
});

test('the bed fades with depth by the clarity of the water', () => {
  assert.equal(zhudaWaterAbsorption(0, 1.5), 1);
  assert.equal(zhudaWaterAbsorption(-1, 1.5), 1);
  assert.ok(Math.abs(zhudaWaterAbsorption(1.5, 1.5) - 1 / Math.E) < 1e-12);
  assert.ok(zhudaWaterAbsorption(3, 1.5) < zhudaWaterAbsorption(1, 1.5));
  assert.ok(zhudaWaterAbsorption(1, 4) > zhudaWaterAbsorption(1, 1));
});

test('leaf translucency is added to the PBR lighting include only, once', () => {
  const added = [];
  const native = {
    Shader3D: {
      addInclude(name, text) {
        added.push([name, text]);
      },
    },
  };
  assert.equal(installLaya342Translucency(native), true);
  assert.equal(installLaya342Translucency(native), true);
  const upstream =
    'vec3 PBRLighting(const in Surface surface,const in PixelInfo pixel,const in Light light){float NoL=1.0;vec3 shading=vec3(1.0);return shading*light.color*NoL;}';
  native.Shader3D.addInclude('PBRLighting.glsl', upstream);
  native.Shader3D.addInclude('Lighting.glsl', 'return shading*light.color*NoL;}');
  native.Shader3D.addInclude('PBRLighting.glsl', 'changed upstream');
  assert.equal(added.length, 3, 'wrapped once');
  const patched = added[0][1];
  assert.ok(patched.includes(`#ifdef ${ZHUDA_TRANSLUCENT_DEFINE}`));
  assert.ok(patched.includes('dot(pixel.normalWS,normalize(light.dir))'), 'light from behind');
  assert.ok(patched.endsWith('return zhudaLit;}'));
  // Without the define the code is the upstream expression.
  assert.ok(patched.includes('vec3 zhudaLit=shading*light.color*NoL;'));
  assert.equal(added[1][1], 'return shading*light.color*NoL;}', 'other includes untouched');
  assert.equal(added[2][1], 'changed upstream', 'an unknown upstream version is left alone');
  assert.equal(installLaya342Translucency({}), false);
});
