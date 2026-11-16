import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateZhudaWaterSurface,
  validateZhudaWaterRipples,
  zhudaWaterAbsorption,
  zhudaWaterRipple,
  ZHUDA_WATER_MAX_RIPPLES,
} from '../packages/core/shaders/WaterSurface.ts';
import { RIPPLE_GLSL } from '../packages/core/shaders/WaterRipples.ts';
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

/** Largest |height| over a second of water time (the waves pass every point). */
const swing = (x, z, sources) => {
  let most = 0;
  for (let t = 0; t < 1; t += 0.02)
    most = Math.max(most, Math.abs(zhudaWaterRipple(x, z, sources, t).height));
  return most;
};

test('a body in still water rings it: waves round it that fade with distance, none under its middle', () => {
  const swimmer = [{ x: 2, z: -3, radius: 0.4, strength: 1 }];
  const near = swing(2.9, -3, swimmer),
    mid = swing(4.5, -3, swimmer);
  assert.ok(near > 0.005, 'rings half a metre out: ' + near);
  assert.ok(mid < near && mid > 0.0005, 'weaker two metres out: ' + mid);
  assert.equal(swing(2, -3, swimmer), 0, 'nothing under the middle of the body');
  assert.equal(swing(12, -3, swimmer), 0, 'nothing 10 m away');
  // The rings are the same all round and they move outward with time.
  assert.ok(Math.abs(swing(2, -2.1, swimmer) - near) < 1e-9);
  assert.notEqual(
    zhudaWaterRipple(2.9, -3, swimmer, 0).height,
    zhudaWaterRipple(2.9, -3, swimmer, 0.25).height,
  );
  // Froth at the waterline, none a metre out.
  assert.ok(zhudaWaterRipple(2.4, -3, swimmer, 0).froth > 0.3);
  assert.ok(zhudaWaterRipple(3.4, -3, swimmer, 0).froth < 0.01);
  // Strength scales it; 0 is flat water.
  const strong = [{ ...swimmer[0], strength: 2 }];
  assert.ok(Math.abs(swing(2.9, -3, strong) - 2 * near) < 1e-9);
  assert.equal(swing(2.9, -3, [{ ...swimmer[0], strength: 0 }]), 0);
});

test('a moving body leaves a V of waves behind it that opens at atan(0.5 / speed), and none ahead', () => {
  for (const speed of [1.25, 3]) {
    const boat = [{ x: 0, z: 0, radius: 0.5, strength: 1, velocity: [0, speed] }];
    // Two metres behind (it moves toward +Z), across the path: the arm is where the wave is biggest.
    const behind = -2;
    let best = 0,
      at = 0;
    for (let x = 0.3; x < 4; x += 0.02) {
      const h = swing(x, behind, boat);
      if (h > best) ((best = h), (at = x));
    }
    const expected = 0.5 * 0.85 + (0.5 * 2) / speed;
    assert.ok(
      Math.abs(at - expected) < 0.2,
      `arm at ${at.toFixed(2)} m, expected ${expected.toFixed(2)} (speed ${speed})`,
    );
    assert.ok(best > 0.008, 'the arm is a real wave: ' + best);
    // Mirror image on the other side, nothing well ahead of the bow but its rings.
    assert.ok(Math.abs(swing(-at, behind, boat) - best) < 1e-9);
    assert.ok(swing(at, 2, boat) < best / 2, 'ahead of it only the rings');
    // Froth close behind it on the arms.
    assert.ok(zhudaWaterRipple(0.5 * 0.85 + 0.5 * (0.3 / speed), -0.3, boat, 0).froth > 0.3);
  }
  // A faster body draws a narrower V.
  const slow = [{ x: 0, z: 0, radius: 0.5, strength: 1, velocity: [0, 1] }];
  const fast = [{ x: 0, z: 0, radius: 0.5, strength: 1, velocity: [0, 4] }];
  assert.ok(swing(0.425 + 1.5, -3, slow) > swing(0.425 + 1.5, -3, fast));
  assert.ok(swing(0.425 + 0.375, -3, fast) > swing(0.425 + 0.375, -3, slow) / 2);
});

test('ripple sources are validated with the name of what is wrong, at most four', () => {
  assert.equal(ZHUDA_WATER_MAX_RIPPLES, 4);
  assert.deepEqual(validateZhudaWaterRipples([]), []);
  assert.deepEqual(
    validateZhudaWaterRipples([{ x: 1, z: 2, radius: 0.4, strength: 1, velocity: [1, 0] }]),
    [],
  );
  const issues = validateZhudaWaterRipples([
    { x: Number.NaN, z: 0, radius: 0, strength: 3, velocity: [40, 0] },
  ]).join(' | ');
  for (const key of [
    'ripples[0].x',
    'ripples[0].radius',
    'ripples[0].strength',
    'ripples[0].velocity',
  ])
    assert.ok(issues.includes(key), key + ': ' + issues);
  const five = Array.from({ length: 5 }, () => ({ x: 0, z: 0, radius: 1, strength: 1 }));
  assert.ok(validateZhudaWaterRipples(five).join().includes('at most 4'));
  assert.ok(validateZhudaWaterRipples('boat').join().includes('a list'));
});

test('the shader reads the same numbers as the TypeScript ripple', () => {
  // The constants of the TypeScript function appear in the GLSL in the same places.
  for (const constant of [
    '19.6*gap-6.2832*t',
    'exp(-gap/1.4)',
    '0.35*exp(-gap*gap/0.006)',
    'a.z*0.85+0.5*tau',
    'exp(-arm*arm/(0.02+0.03*tau))*cos(18.0*arm-5.0*t)',
    'clamp(9.81/(speed*speed),2.0,14.0)',
    'smoothstep(a.z*0.75,a.z,dist)',
  ])
    assert.ok(RIPPLE_GLSL.includes(constant), constant);
  for (let i = 0; i < ZHUDA_WATER_MAX_RIPPLES; i++)
    assert.ok(RIPPLE_GLSL.includes(`u_ZhudaWaterRippleA${i},u_ZhudaWaterRippleB${i}`));
});
