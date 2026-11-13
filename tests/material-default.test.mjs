// Zhuda3D.createMaterial is physically based by default. Code written for the
// Blinn-Phong default of earlier versions gives a shininess: that alone keeps
// it Blinn-Phong.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Zhuda3D } from '../packages/core/DeclarativeSDK.ts';

test('no type is physically based; a shininess without a type is Blinn-Phong', () => {
  class Material {}
  class PBRStandardMaterial extends Material {}
  class UnlitMaterial extends Material {}
  class BlinnPhongMaterial extends Material {}
  class Color {
    constructor(...rgba) {
      this.rgba = rgba;
    }
  }
  const saved = globalThis.Laya;
  globalThis.Laya = {
    PBRStandardMaterial,
    UnlitMaterial,
    BlinnPhongMaterial,
    Color,
    RenderState: {},
  };
  try {
    const plain = Zhuda3D.createMaterial({ albedoColor: [0.8, 0.2, 0.2, 1], smoothness: 0.7 });
    assert.ok(plain instanceof PBRStandardMaterial);
    assert.deepEqual(plain.albedoColor.rgba, [0.8, 0.2, 0.2, 1]);
    assert.ok(Math.abs(plain.smoothness - 0.7) < 1e-9);
    const old = Zhuda3D.createMaterial({ albedoColor: [0.2, 0.3, 0.5, 1], shininess: 36 });
    assert.ok(old instanceof BlinnPhongMaterial);
    assert.equal(old.shininess, 36);
    assert.ok(
      Zhuda3D.createMaterial({ type: 'blinn-phong', albedoColor: [1, 1, 1, 1] }) instanceof
        BlinnPhongMaterial,
    );
    assert.ok(
      Zhuda3D.createMaterial({ type: 'unlit', albedoColor: [1, 1, 1, 1] }) instanceof UnlitMaterial,
    );
    // An explicit type wins over a shininess.
    assert.ok(
      Zhuda3D.createMaterial({ type: 'pbr', albedoColor: [1, 1, 1, 1], shininess: 8 }) instanceof
        PBRStandardMaterial,
    );
  } finally {
    globalThis.Laya = saved;
  }
});
