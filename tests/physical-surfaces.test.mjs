import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSurfaceMaterial,
  disposeSurfaceMaterial,
  physicalSurfaceTextureLimit,
  surfaceMaterialPasses,
  validatePhysicalSurfaceSpec,
  zhudaAnisotropyRadians,
  zhudaSrgbToLinear,
  ZHUDA_PHYSICAL_SHADER,
} from '../packages/core/runtime3d/Surfaces.ts';

const MODES = {
  RENDERMODE_OPAQUE: 0,
  RENDERMODE_CUTOUT: 1,
  RENDERMODE_TRANSPARENT: 2,
  RENDERMODE_ADDTIVE: 3,
  RENDERMODE_CUSTOME: 5,
};
/** A stand-in for LayaAir: a material that records its shader, defines and uniforms. */
function fakeLaya({ gltf = true } = {}) {
  class Material {
    constructor() {
      this.defines = new Set();
      this.values = {};
      this.renderQueue = 2000;
    }
    setShaderName(name) {
      this.shader = name;
    }
    setDefine(define, on) {
      if (on) this.defines.add(define.name);
      else this.defines.delete(define.name);
    }
    setFloat(name, value) {
      this.values[name] = value;
    }
    setVector3(name, v) {
      this.values[name] = [v.x, v.y, v.z];
    }
    setVector4(name, v) {
      this.values[name] = [v.x, v.y, v.z, v.w];
    }
    setTexture(name, texture) {
      this.values[name] = texture;
    }
    set materialRenderMode(mode) {
      this.mode = mode;
      this.renderQueue = { 0: 2000, 1: 2450, 2: 3000, 3: 3000 }[mode] ?? this.renderQueue;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  class PBRStandardMaterial extends Material {}
  class Vector3 {
    constructor(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  class Vector4 {
    constructor(x, y, z, w) {
      Object.assign(this, { x, y, z, w });
    }
  }
  return {
    Material,
    PBRStandardMaterial,
    UnlitMaterial: class extends Material {},
    Vector3,
    Vector4,
    Color: class {},
    PBRRenderMode: { Fade: 2 },
    MaterialRenderMode: MODES,
    RenderState: { CULL_NONE: 0 },
    Shader3D: {
      find: (name) => (gltf && name === 'glTFPBR' ? {} : null),
      getDefineByName: (name) => ({ name }),
    },
  };
}
function withLaya(laya, run) {
  const saved = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    return run();
  } finally {
    globalThis.Laya = saved;
  }
}
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} against ${expected}`);
const tex = (name) => ({ name });
/** Every feature on: any texture slot may then be filled. */
const EVERY_FEATURE = {
  clearCoat: 1,
  anisotropy: 1,
  sheen: { color: [1, 1, 1] },
  iridescence: {},
  transmission: { factor: 1, volume: { thickness: 1 } },
};
/** Each slot with its uniform and define in LayaAir's glTF shader. */
const SLOTS = {
  albedo: ['u_BaseColorTexture', 'BASECOLORMAP'],
  normal: ['u_NormalTexture', 'NORMALMAP'],
  metallicRoughness: ['u_MetallicRoughnessTexture', 'METALLICROUGHNESSMAP'],
  occlusion: ['u_OcclusionTexture', 'OCCLUSIONMAP'],
  emission: ['u_EmissionTexture', 'EMISSIONMAP'],
  clearCoat: ['u_ClearCoatTexture', 'CLEARCOATMAP'],
  clearCoatRoughness: ['u_ClearCoatRoughnessTexture', 'CLEARCOAT_ROUGHNESSMAP'],
  clearCoatNormal: ['u_ClearCoatNormalTexture', 'CLEARCOAT_NORMAL'],
  sheenColor: ['u_SheenColorTexture', 'SHEENCOLORMAP'],
  sheenRoughness: ['u_SheenRoughnessTexture', 'SHEEN_ROUGHNESSMAP'],
  iridescence: ['u_IridescenceTexture', 'IRIDESCENCEMAP'],
  iridescenceThickness: ['u_IridescenceThicknessTexture', 'IRIDESCENCE_THICKNESSMAP'],
  transmission: ['u_TransmissionTexture', 'TRANSMISSIONMAP'],
  thickness: ['u_VolumeThicknessTexture', 'THICKNESSMAP'],
  specular: ['u_SpecularFactorTexture', 'SPECULARFACTORMAP'],
  specularColor: ['u_SpecularColorTexture', 'SPECULARCOLORMAP'],
  anisotropy: ['u_AnisotropyTexture', 'ANISOTROPYMAP'],
};

test('a display colour becomes light as LayaAir Color does it', () => {
  assert.equal(zhudaSrgbToLinear(0), 0);
  close(zhudaSrgbToLinear(0.04), 0.04 / 12.92, 'the straight part');
  close(zhudaSrgbToLinear(0.5), Math.pow(0.555 / 1.055, 2.4), 'the curve');
  assert.equal(zhudaSrgbToLinear(1), 1);
  close(zhudaSrgbToLinear(2), Math.pow(2, 2.4), 'above 1');
});

test('an anisotropy rotation takes any angle and folds it into one turn', () => {
  close(zhudaAnisotropyRadians(0), 0, '0');
  close(zhudaAnisotropyRadians(90), Math.PI / 2, 'a quarter turn, past the 1 radian setter limit');
  close(zhudaAnisotropyRadians(405), Math.PI / 4, 'a full turn and 45');
  close(zhudaAnisotropyRadians(-90), -Math.PI / 2, 'the other way');
  close(Math.abs(zhudaAnisotropyRadians(540)), Math.PI, 'a turn and a half');
  assert.throws(() => zhudaAnisotropyRadians(Number.NaN), /finite number of degrees/);
});

test('a physical spec is checked field by field', () => {
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      color: [0.8, 0.2, 0.1, 1],
      metallic: 0,
      roughness: 0.4,
      emission: [2, 1, 0],
      clearCoat: 1,
      clearCoatRoughness: 0.05,
      clearCoatNormalScale: 0.5,
      anisotropy: 0.6,
      anisotropyRotationDeg: -720,
      normalScale: 2,
      occlusionStrength: 0.5,
      sheen: { color: [1, 1, 1], roughness: 0.3 },
      iridescence: { factor: 1, ior: 1.3, thicknessRange: [0, 2000] },
      ior: 2.42,
      specular: { factor: 0.5, color: [1, 0.9, 0.8] },
      transmission: {
        factor: 1,
        volume: { thickness: 0.2, attenuationColor: [0.2, 0.9, 0.5], attenuationDistance: 1 },
      },
      textures: {
        albedo: tex('a'),
        normal: tex('n'),
        metallicRoughness: tex('mr'),
        clearCoatNormal: tex('cn'),
        sheenColor: tex('sc'),
        thickness: tex('th'),
      },
      blend: 'alpha',
      doubleSided: true,
    }),
    [],
  );
  assert.deepEqual(validatePhysicalSurfaceSpec({ type: 'physical' }), []);
  // Every slot is taken on its own when its feature is on.
  for (const slot of Object.keys(SLOTS))
    assert.deepEqual(
      validatePhysicalSurfaceSpec({
        type: 'physical',
        ...EVERY_FEATURE,
        textures: { [slot]: tex(slot) },
      }),
      [],
      slot,
    );
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      color: [1, 1, 1],
      roughness: 1.5,
      anisotropy: 0.5,
      anisotropyRotationDeg: Infinity,
      emission: [-1, 0, 0],
      normalScale: 11,
      occlusionStrength: 2,
      ior: 0.9,
      sheen: { color: [2, 0, 0], roughness: -1 },
      iridescence: { factor: 2, ior: 4, thicknessRange: [500, 100] },
      specular: { factor: 1.5, color: [0, 0, 2] },
      transmission: {
        factor: 1.2,
        volume: { thickness: -1, attenuationColor: [0, 1, 1], attenuationDistance: 0 },
      },
      blend: 'glow',
    }),
    [
      'color: four numbers 0..1',
      'roughness: use 0..1',
      'anisotropyRotationDeg: a finite number of degrees',
      'emission: three numbers 0..100',
      'normalScale: use 0..10',
      'occlusionStrength: use 0..1',
      'ior: use 1..3',
      'sheen.color: three numbers 0..1',
      'sheen.roughness: use 0..1',
      'iridescence.factor: use 0..1',
      'iridescence.ior: use 1..3',
      'iridescence.thicknessRange: [min, max] nanometres, 0 <= min <= max <= 2000',
      'specular.factor: use 0..1',
      'specular.color: three numbers 0..1',
      'transmission.factor: use 0..1',
      'transmission.volume.thickness: use 0..10000',
      'transmission.volume.attenuationColor: three numbers above 0 and at most 1',
      'transmission.volume.attenuationDistance: above 0, at most 65504',
      'blend: unknown mode',
    ],
  );
  // A feature's textures need the feature; unknown slots and the standard layout are refused.
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      textures: {
        clearCoatNormal: tex('cn'),
        anisotropy: tex('an'),
        sheenColor: tex('sc'),
        iridescenceThickness: tex('it'),
        transmission: tex('t'),
        metallicGloss: tex('mg'),
        bump: tex('b'),
        albedo: 'albedo.png',
        normal: null,
        emission: undefined,
      },
    }),
    [
      'textures.clearCoatNormal: needs clearCoat above 0',
      'textures.anisotropy: needs anisotropy above 0',
      'textures.sheenColor: needs sheen',
      'textures.iridescenceThickness: needs iridescence',
      'textures.transmission: needs transmission',
      'textures.metallicGloss: a physical surface takes metallicRoughness (glTF layout: G roughness, B metallic)',
      'textures.bump: unknown slot (use albedo, normal, metallicRoughness, occlusion, emission, specular, specularColor, clearCoat, clearCoatRoughness, clearCoatNormal, anisotropy, sheenColor, sheenRoughness, iridescence, iridescenceThickness, transmission, thickness)',
      'textures.albedo: a loaded texture, not string',
    ],
  );
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      transmission: { factor: 1 },
      textures: { thickness: tex('th') },
    }),
    ['textures.thickness: needs transmission.volume'],
  );
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      blend: 'additive',
      transmission: { factor: 1 },
    }),
    ['transmission: blend "additive" is refused (what is behind already shows through)'],
  );
});

test('a field that only shapes a feature needs the feature', () => {
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      clearCoatRoughness: 0.2,
      clearCoatNormalScale: 2,
      anisotropyRotationDeg: 45,
    }),
    [
      'clearCoatRoughness: needs clearCoat above 0',
      'clearCoatNormalScale: needs clearCoat above 0',
      'anisotropyRotationDeg: needs anisotropy above 0',
    ],
  );
  // Switched off by a 0 is off.
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      clearCoat: 0,
      clearCoatNormalScale: 2,
      anisotropy: 0,
      anisotropyRotationDeg: 45,
    }),
    [
      'clearCoatNormalScale: needs clearCoat above 0',
      'anisotropyRotationDeg: needs anisotropy above 0',
    ],
  );
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      clearCoat: 0.5,
      clearCoatRoughness: 0.2,
      clearCoatNormalScale: 2,
      anisotropy: 0.5,
      anisotropyRotationDeg: 45,
    }),
    [],
  );
  withLaya(fakeLaya(), () => {
    assert.throws(
      () => createSurfaceMaterial({ type: 'physical', anisotropyRotationDeg: 45 }),
      /^Error: Physical surface: anisotropyRotationDeg: needs anisotropy above 0$/,
    );
    // The standard material too: before, the angle was dropped without a word.
    assert.throws(
      () => createSurfaceMaterial({ type: 'pbr', anisotropyRotationDeg: 45 }),
      /^Error: anisotropyRotationDeg: needs anisotropy above 0$/,
    );
    assert.throws(
      () => createSurfaceMaterial({ type: 'pbr', anisotropy: 0, anisotropyRotationDeg: 45 }),
      /anisotropyRotationDeg: needs anisotropy above 0/,
    );
  });
});

test('a physical surface carries six textures at most, fewer under a lightmap', () => {
  assert.equal(physicalSurfaceTextureLimit(), 6);
  assert.equal(physicalSurfaceTextureLimit({}), 6);
  assert.equal(physicalSurfaceTextureLimit({ lightmap: false }), 6);
  assert.equal(physicalSurfaceTextureLimit({ lightmap: true }), 5);
  assert.equal(physicalSurfaceTextureLimit({ lightmap: 'directional' }), 4);
  const withTextures = (count) => ({
    type: 'physical',
    ...EVERY_FEATURE,
    textures: Object.fromEntries(
      Object.keys(SLOTS)
        .slice(0, count)
        .map((slot) => [slot, tex(slot)]),
    ),
  });
  assert.deepEqual(validatePhysicalSurfaceSpec(withTextures(6)), []);
  assert.deepEqual(validatePhysicalSurfaceSpec(withTextures(7)), [
    "textures: 7 filled, at most 6 (a shader stage holds 16 samplers and the scene's lights, shadows and surroundings take 10; past that the surface is not drawn)",
  ]);
  // All seventeen at once, the spec that used to pass and did not draw.
  assert.match(
    validatePhysicalSurfaceSpec(withTextures(17))[0],
    /^textures: 17 filled, at most 6 /,
  );
  // Empty slots are not counted; the same picture in two slots is counted twice.
  const shared = tex('shared');
  assert.deepEqual(
    validatePhysicalSurfaceSpec({
      ...withTextures(6),
      textures: { ...withTextures(6).textures, sheenColor: null, sheenRoughness: undefined },
    }),
    [],
  );
  assert.match(
    validatePhysicalSurfaceSpec({
      type: 'physical',
      ...EVERY_FEATURE,
      textures: {
        albedo: shared,
        normal: shared,
        metallicRoughness: shared,
        occlusion: shared,
        emission: shared,
        clearCoat: shared,
        clearCoatRoughness: shared,
      },
    })[0],
    /^textures: 7 filled, at most 6 /,
  );
  // On a lightmapped renderer the lightmap's pictures take samplers too.
  assert.deepEqual(validatePhysicalSurfaceSpec(withTextures(5), { lightmap: true }), []);
  assert.deepEqual(validatePhysicalSurfaceSpec(withTextures(6), { lightmap: true }), [
    "textures: 6 filled, at most 5 on a renderer with a lightmap (a shader stage holds 16 samplers and the scene's lights, shadows and surroundings take 11; past that the surface is not drawn)",
  ]);
  assert.deepEqual(validatePhysicalSurfaceSpec(withTextures(4), { lightmap: 'directional' }), []);
  assert.deepEqual(validatePhysicalSurfaceSpec(withTextures(5), { lightmap: 'directional' }), [
    "textures: 5 filled, at most 4 on a renderer with a directional lightmap (a shader stage holds 16 samplers and the scene's lights, shadows and surroundings take 12; past that the surface is not drawn)",
  ]);
  assert.deepEqual(validatePhysicalSurfaceSpec(withTextures(1), { lightmap: 'baked' }), [
    'use.lightmap: true, false or "directional"',
  ]);
  // createSurfaceMaterial refuses it before LayaAir is touched.
  withLaya(undefined, () => {
    assert.throws(
      () => createSurfaceMaterial(withTextures(7)),
      /^Error: Physical surface: textures: 7 filled, at most 6 /,
    );
  });
});

test('a physical surface is the glTF shader with its features switched on', () => {
  const laya = fakeLaya();
  withLaya(laya, () => {
    const plain = createSurfaceMaterial({ type: 'physical' });
    assert.ok(plain instanceof laya.Material);
    assert.equal(plain.shader, ZHUDA_PHYSICAL_SHADER);
    assert.deepEqual([...plain.defines], [], 'nothing extra unless asked');
    assert.deepEqual(plain.values, {
      u_BaseColorFactor: [1, 1, 1, 1],
      u_MetallicFactor: 0,
      u_RoughnessFactor: 0.5,
    });
    assert.equal(plain.mode, MODES.RENDERMODE_OPAQUE);
    assert.equal(plain.depthWrite, true);
    assert.equal(plain.renderQueue, 2000);

    const m = createSurfaceMaterial({
      type: 'physical',
      color: [0.5, 1, 0, 0.25],
      metallic: 0.2,
      roughness: 0.3,
      emission: [0.5, 0.5, 0.5],
      clearCoat: 0.7,
      clearCoatNormalScale: 0.4,
      anisotropy: 0.6,
      anisotropyRotationDeg: 90,
      normalScale: 1.5,
      occlusionStrength: 0.8,
      sheen: { color: [1, 0.5, 0] },
      iridescence: { thicknessRange: [120, 380] },
      ior: 1.33,
      specular: { factor: 0.5, color: [1, 0.5, 1] },
      transmission: {
        factor: 0.9,
        volume: { thickness: 0.25, attenuationColor: [0.5, 1, 1], attenuationDistance: 2 },
      },
    });
    const half = zhudaSrgbToLinear(0.5);
    assert.deepEqual(m.values.u_BaseColorFactor, [half, 1, 0, 0.25], 'display colour, alpha as is');
    assert.equal(m.values.u_MetallicFactor, 0.2);
    assert.equal(m.values.u_RoughnessFactor, 0.3);
    assert.deepEqual(m.values.u_EmissionFactor, [half, half, half]);
    assert.equal(m.values.u_ClearCoatFactor, 0.7);
    assert.equal(m.values.u_ClearCoatRoughness, 0.1);
    assert.equal(m.values.u_ClearCoatNormalScale, 0.4);
    assert.equal(m.values.u_AnisotropyStrength, 0.6);
    close(m.values.u_AnisotropyRotation, Math.PI / 2, 'written as it is, not clamped to 1');
    assert.equal(m.values.u_NormalScale, 1.5);
    assert.equal(m.values.u_OcclusionStrength, 0.8);
    assert.deepEqual(m.values.u_SheenColorFactor, [1, half, 0]);
    assert.equal(m.values.u_SheenRoughness, 0.5);
    assert.equal(m.values.u_IridescenceFactor, 1);
    assert.equal(m.values.u_IridescenceIor, 1.3);
    assert.equal(m.values.u_IridescenceThicknessMinimum, 120);
    assert.equal(m.values.u_IridescenceThicknessMaximum, 380);
    assert.equal(m.values.u_Ior, 1.33);
    assert.equal(m.values.u_SpecularFactor, 0.5);
    assert.deepEqual(m.values.u_SpecularColorFactor, [1, half, 1]);
    assert.equal(m.values.u_TransmissionFactor, 0.9);
    assert.equal(m.values.u_VolumeThicknessFactor, 0.25);
    assert.equal(m.values.u_VolumeAttenuationDistance, 2);
    assert.deepEqual(m.values.u_VolumeAttenuationColor, [half, 1, 1]);
    assert.deepEqual(
      [...m.defines].sort(),
      [
        'ANISOTROPIC',
        'CLEARCOAT',
        'EMISSION',
        'IOR',
        'IRIDESCENCE',
        'SHEEN',
        'THICKNESS',
        'TRANSMISSION',
      ].sort(),
    );
    assert.equal(m.renderQueue, 3000, 'transmission is drawn after the opaque scene');
    assert.equal(m.depthWrite, true);

    // Without a distance nothing is absorbed: the value laya.gltf.js writes.
    const thin = createSurfaceMaterial({
      type: 'physical',
      transmission: { factor: 1, volume: { thickness: 0 } },
    });
    assert.equal(thin.values.u_VolumeAttenuationDistance, 65504);
    assert.deepEqual(thin.values.u_VolumeAttenuationColor, [1, 1, 1]);
  });
});

test('physical textures go to their slots and switch their defines on', () => {
  withLaya(fakeLaya(), () => {
    const names = Object.keys(SLOTS);
    // Six at a time: a surface carries no more.
    for (let first = 0; first < names.length; first += 6) {
      const group = names.slice(first, first + 6);
      const m = createSurfaceMaterial({
        type: 'physical',
        ...EVERY_FEATURE,
        // One of them as a Laya.Texture, whose picture is in `bitmap`.
        textures: Object.fromEntries(
          group.map((slot, i) => [slot, i === 1 ? { bitmap: tex(slot) } : tex(slot)]),
        ),
      });
      for (const slot of names) {
        const [uniform, define] = SLOTS[slot];
        if (group.includes(slot)) {
          assert.equal(m.values[uniform]?.name, slot, uniform);
          assert.ok(m.defines.has(define), define);
        } else {
          assert.equal(m.values[uniform], undefined, `${uniform} left alone`);
          assert.ok(!m.defines.has(define), `${define} left off`);
        }
      }
      if (group.includes('emission')) {
        // An emission texture alone is not multiplied by black.
        assert.deepEqual(m.values.u_EmissionFactor, [1, 1, 1]);
        assert.ok(m.defines.has('EMISSION'));
      }
      // Disposal lets go of every slot before the material is destroyed.
      disposeSurfaceMaterial(m);
      assert.equal(m.destroyed, true);
      for (const [uniform] of Object.values(SLOTS)) assert.equal(m.values[uniform], null, uniform);
    }
  });
});

test('blend modes, cutout, two sides and depth writing of a physical surface', () => {
  withLaya(fakeLaya(), () => {
    const alpha = createSurfaceMaterial({ type: 'physical', blend: 'alpha' });
    assert.equal(alpha.mode, MODES.RENDERMODE_TRANSPARENT);
    assert.equal(alpha.depthWrite, false);
    const cutout = createSurfaceMaterial({ type: 'physical', blend: 'cutout', alphaCutoff: 0.3 });
    assert.equal(cutout.mode, MODES.RENDERMODE_CUTOUT);
    assert.equal(cutout.alphaTestValue, 0.3);
    assert.equal(cutout.depthWrite, true);
    const additive = createSurfaceMaterial({ type: 'physical', blend: 'additive' });
    assert.equal(additive.mode, MODES.RENDERMODE_ADDTIVE);
    const twoSided = createSurfaceMaterial({
      type: 'physical',
      doubleSided: true,
      depthWrite: false,
    });
    assert.equal(twoSided.cull, 0);
    assert.equal(twoSided.depthWrite, false);
    const glassWithHoles = createSurfaceMaterial({
      type: 'physical',
      blend: 'cutout',
      transmission: { factor: 1 },
    });
    assert.equal(glassWithHoles.renderQueue, 3000);
  });
});

test('a texture slot left empty is no texture', () => {
  withLaya(fakeLaya(), () => {
    const m = createSurfaceMaterial({
      type: 'physical',
      textures: { albedo: null, normal: undefined, emission: null },
    });
    assert.deepEqual([...m.defines], []);
    assert.equal(m.values.u_BaseColorTexture, undefined);
    assert.equal(m.values.u_EmissionFactor, undefined, 'no emission without a texture or colour');
    assert.doesNotThrow(() =>
      createSurfaceMaterial({ type: 'pbr', textures: { sheenColor: undefined } }),
    );
  });
});

test('a physical surface without the glTF module is refused with what to load', () => {
  withLaya(fakeLaya({ gltf: false }), () => {
    assert.throws(
      () => createSurfaceMaterial({ type: 'physical' }),
      /glTF shader 'glTFPBR' is not registered.*laya\.gltf\.js.*3d-gltf/,
    );
  });
  withLaya(undefined, () => {
    assert.throws(() => createSurfaceMaterial({ type: 'physical' }), /not registered/);
  });
  // A bad spec is reported before LayaAir is looked at.
  withLaya(undefined, () => {
    assert.throws(
      () => createSurfaceMaterial({ type: 'physical', sheen: { color: [1, 1] } }),
      /^Error: Physical surface: sheen\.color: three numbers 0\.\.1$/,
    );
  });
});

test('physical-only fields are refused on the standard and unlit materials', () => {
  withLaya(fakeLaya(), () => {
    assert.throws(
      () => createSurfaceMaterial({ type: 'pbr', sheen: { color: [1, 1, 1] }, ior: 1.5 }),
      /^Error: sheen, ior: physical surfaces only \(type 'physical'\)$/,
    );
    assert.throws(
      () => createSurfaceMaterial({ type: 'pbr', textures: { metallicRoughness: tex('mr') } }),
      /textures\.metallicRoughness: physical surfaces only/,
    );
    assert.throws(
      () => createSurfaceMaterial({ type: 'unlit', transmission: { factor: 1 } }),
      /transmission: physical surfaces only/,
    );
    assert.throws(
      () => createSurfaceMaterial({ type: 'unlit', anisotropyRotationDeg: 45 }),
      /physically based surfaces/,
    );
    assert.throws(() => createSurfaceMaterial({ type: 'glass' }), /Unknown material type/);
  });
});

test('the standard material turns its highlight by any angle too', () => {
  withLaya(fakeLaya(), () => {
    const m = createSurfaceMaterial({ type: 'pbr', anisotropy: 0.8, anisotropyRotationDeg: 90 });
    assert.equal(m.anisotropyEnable, true);
    assert.equal(m.anisotropy, 0.8);
    close(m.values.u_AnisotropyRotation, Math.PI / 2, 'past the setter limit of 1 radian');
    const still = createSurfaceMaterial({ type: 'pbr', anisotropy: 0.8 });
    assert.equal(still.values.u_AnisotropyRotation, undefined, 'untouched unless asked');
  });
});

test('transmission asks the camera for its opaque picture', () => {
  assert.deepEqual(surfaceMaterialPasses({ type: 'physical', transmission: { factor: 1 } }), {
    opaqueColor: true,
  });
  assert.deepEqual(surfaceMaterialPasses({ type: 'physical', sheen: { color: [1, 1, 1] } }), {});
  assert.deepEqual(surfaceMaterialPasses({ type: 'pbr' }), {});
});
