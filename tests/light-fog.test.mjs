import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zhudaFogOpticalDepth,
  zhudaFogAirlight,
  validateZhudaLightFog,
  resolveZhudaLightFog,
  ZhudaLightFog,
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
  // A range fades the glow to nothing at that distance from the light.
  assert.equal(zhudaFogAirlight(10, 6, 100, 6), 0);
  assert.equal(zhudaFogAirlight(10, 9, 100, 6), 0);
  const full = zhudaFogAirlight(10, 3, 100),
    ranged = zhudaFogAirlight(10, 3, 100, 6);
  assert.ok(Math.abs(ranged - full * 0.25) < 1e-12, 'half the range away keeps a quarter');
  assert.ok(zhudaFogAirlight(10, 0.5, 100, 6) > 0.8 * zhudaFogAirlight(10, 0.5, 100));
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
    shafts: undefined,
  });
});

test('light shaft options are validated and resolved', () => {
  assert.deepEqual(validateZhudaLightFog({ shafts: {} }), []);
  assert.equal(resolveZhudaLightFog({}).shafts, undefined);
  assert.deepEqual(resolveZhudaLightFog({ shafts: { distance: 120 } }).shafts, {
    strength: 1,
    anisotropy: 0.6,
    distance: 120,
    resolution: 2048,
    steps: 40,
    scale: 0.5,
  });
  assert.equal(resolveZhudaLightFog({ shafts: { scale: 1 } }).shafts.scale, 1);
  assert.deepEqual(validateZhudaLightFog({ shafts: { scale: 0.25 } }), []);
  const issues = validateZhudaLightFog({
    shafts: {
      strength: -1,
      anisotropy: 0.99,
      distance: 4,
      resolution: 1000.5,
      steps: 200,
      scale: 0.2,
      x: 1,
    },
  });
  for (const key of ['strength', 'anisotropy', 'distance', 'resolution', 'steps', 'scale', 'x'])
    assert.ok(
      issues.some((issue) => issue.startsWith(`shafts.${key}`)),
      key + ': ' + issues.join(' | '),
    );
  assert.deepEqual(validateZhudaLightFog({ shafts: 3 }), ['shafts: object required']);
});

// A Laya just big enough for a light fog with shafts: it counts the depth
// pictures drawn and keeps the last value of every uniform.
function fakeShaftLaya() {
  class Vector {
    constructor(...values) {
      this.values = values;
    }
  }
  const uniforms = {};
  const drawn = [];
  class Camera {
    constructor() {
      this.transform = {
        position: null,
        lookAt: (target) => (this.looksAt = target.values),
      };
    }
    destroy() {}
    static drawRenderTextureByScene(camera) {
      drawn.push(camera.transform.position.values);
    }
  }
  const laya = {
    uniforms,
    drawn,
    Texture2D: class {
      setPixelsData() {}
      destroy() {}
    },
    Material: class {
      setShaderName() {}
      setTexture() {}
      addDefine() {}
      setVector4(name, value) {
        uniforms[name] = value.values;
      }
      setVector3(name, value) {
        uniforms[name] = value.values;
      }
      destroy() {}
    },
    MaterialPostProcessEffect: class {},
    Vector3: Vector,
    Vector4: Vector,
    Color: Vector,
    Camera,
    CameraClearFlags: { SolidColor: 0 },
    RenderTexture: class {
      constructor() {
        this.depthStencilTexture = {};
      }
      destroy() {}
    },
    RenderTargetFormat: { R8G8B8A8: 0, DEPTH_32: 1 },
    Stat: { enableShadow: true },
    Shader3D: {
      add: () => ({ addSubShader() {} }),
      getDefineByName: (name) => name,
    },
    SubShader: class {
      addShaderPass() {
        return { renderState: {} };
      }
    },
    VertexMesh: { MESH_POSITION0: 0 },
    ShaderDataType: { Vector4: 1, Vector3: 2, Texture2D: 3 },
    ShaderFeatureType: { PostProcess: 1 },
    RenderState: { CULL_NONE: 0 },
    TextureFormat: { R32G32B32A32: 1 },
    FilterMode: { Point: 0 },
    WrapMode: { Clamp: 0 },
    RenderCapable: { TextureFormat_R32G32B32A32: 1 },
    LayaGL: { renderEngine: { getCapable: () => true } },
  };
  return laya;
}

test('a sun that moves with the clock keeps the depth picture until it has turned half a degree', () => {
  const saved = globalThis.Laya;
  const l = (globalThis.Laya = fakeShaftLaya());
  try {
    // The sun climbing by 0.05 degrees a frame, at about 40 degrees up.
    const sunAt = (degrees) => {
      const a = (degrees * Math.PI) / 180;
      return {
        toward: [0.3 * Math.cos(a), Math.sin(a), -Math.sqrt(1 - 0.09) * Math.cos(a)],
        color: [1, 1, 1],
      };
    };
    const normal = (sun) => {
      const n = Math.hypot(...sun.toward);
      return { ...sun, toward: sun.toward.map((v) => v / n) };
    };
    const scene = { addChild() {} };
    const frames = (fog, count, eye = [0, 1.7, 0]) => {
      const picks = [];
      for (let i = 0; i < count; i++) {
        fog.attachSun(scene, normal(sunAt(40 + i * 0.05)));
        fog.update(eye, [eye[0], eye[1], eye[2] - 10], 60, 0.5);
        picks.push({ c3: l.uniforms.u_ZhudaShaftC3, sun: l.uniforms.u_ZhudaShaftSun });
        fog.renderShafts();
      }
      return picks;
    };

    const always = new ZhudaLightFog({ shafts: {} });
    frames(always, 40);
    assert.equal(l.drawn.length, 40, 'always: a picture every frame');
    always.dispose();

    l.drawn.length = 0;
    const moved = new ZhudaLightFog({ shafts: {} });
    moved.setShaftRefresh('moved');
    // 40 frames turn the sun by 1.95 degrees: drawn at 0, 0.55, 1.1 and 1.65.
    const picks = frames(moved, 40);
    assert.equal(l.drawn.length, 4, 'drawn again each time the sun has turned past half a degree');
    // While a picture is kept, the march reads it with the projection it was
    // drawn with; the brightness toward the sun follows the sun every frame.
    assert.deepEqual(picks[1].c3, picks[0].c3);
    assert.deepEqual(picks[10].c3, picks[0].c3);
    assert.notDeepEqual(picks[11].c3, picks[0].c3);
    assert.notDeepEqual(picks[1].sun, picks[0].sun);
    const live = normal(sunAt(40 + 39 * 0.05)).toward;
    picks[39].sun.forEach((v, i) => assert.ok(Math.abs(v - live[i]) < 1e-12));

    // Walking on to another cell of the box draws again, from the sun as it is then.
    l.drawn.length = 0;
    moved.attachSun(scene, normal(sunAt(41.96)));
    moved.update([0, 1.7, -40], [0, 1.7, -50], 60, 0.5);
    moved.renderShafts();
    assert.equal(l.drawn.length, 1);
    assert.deepEqual(l.uniforms.u_ZhudaShaftSun, normal(sunAt(41.96)).toward);
    moved.dispose();
  } finally {
    globalThis.Laya = saved;
  }
});
