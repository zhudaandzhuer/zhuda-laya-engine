import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zhudaFogOpticalDepth,
  zhudaFogAirlight,
  validateZhudaLightFog,
  resolveZhudaLightFog,
} from '../packages/core/runtime3d/LightFog.ts';

test('fog optical depth matches a numeric integral of the height density', () => {
  const fog = { density: 0.03, falloffMeters: 6, baseY: 1 };
  for (const [eyeY, directionY, distance] of [
    [1.6, 0, 40],
    [1.6, 0.3, 25],
    [12, -0.5, 18],
    [0.5, 0.00001, 100],
  ]) {
    let sum = 0;
    const steps = 20000;
    for (let i = 0; i < steps; i++) {
      const s = ((i + 0.5) / steps) * distance;
      sum += fog.density * Math.exp(-(eyeY + directionY * s - fog.baseY) / fog.falloffMeters);
    }
    sum *= distance / steps;
    const got = zhudaFogOpticalDepth(fog, eyeY, directionY, distance);
    assert.ok(Math.abs(got - sum) < 1e-4 * Math.max(1, sum), `${got} vs ${sum}`);
  }
  // Higher up there is less fog; a longer ray passes through more.
  assert.ok(zhudaFogOpticalDepth(fog, 20, 0, 10) < zhudaFogOpticalDepth(fog, 1, 0, 10));
  assert.ok(zhudaFogOpticalDepth(fog, 1, 0, 20) > zhudaFogOpticalDepth(fog, 1, 0, 10));
});

test('airlight matches a numeric integral of 1/r² along the ray', () => {
  for (const [along, offset, distance] of [
    [14, 0.5, 600],
    [5, 2, 8],
    [-3, 1, 20],
    [30, 4, 10],
  ]) {
    let sum = 0;
    const steps = 200000;
    for (let i = 0; i < steps; i++) {
      const s = ((i + 0.5) / steps) * distance;
      sum += 1 / (offset * offset + (s - along) * (s - along));
    }
    sum *= distance / steps;
    const got = zhudaFogAirlight(along, offset, distance);
    assert.ok(Math.abs(got - sum) < 2e-3 * sum, `${got} vs ${sum}`);
  }
  // Closer to the ray is brighter; a ray that stops before the light gets less.
  assert.ok(zhudaFogAirlight(10, 0.5, 100) > zhudaFogAirlight(10, 2, 100));
  assert.ok(zhudaFogAirlight(10, 1, 6) < 0.5 * zhudaFogAirlight(10, 1, 100));
  assert.ok(Number.isFinite(zhudaFogAirlight(10, 0, 100)), 'a light on the ray stays finite');
});

test('light fog options are validated and defaulted', () => {
  assert.deepEqual(validateZhudaLightFog({}), []);
  const issues = validateZhudaLightFog({
    density: 2,
    falloffMeters: 0,
    scatter: 99,
    maxDistance: 0,
    color: [1, 2],
  });
  for (const key of ['density', 'falloffMeters', 'scatter', 'maxDistance', 'color'])
    assert.ok(
      issues.some((issue) => issue.startsWith(key + ':')),
      key,
    );
  assert.deepEqual(resolveZhudaLightFog({ density: 0.05 }), {
    density: 0.05,
    falloffMeters: 8,
    baseY: 0,
    color: [0.02, 0.03, 0.05],
    scatter: 1,
    maxDistance: 600,
  });
});
