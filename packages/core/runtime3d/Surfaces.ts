export interface SurfaceMaterialSpec {
  /**
   * `pbr`: LayaAir's standard physically based material. `unlit`: colour and
   * texture only. `physical`: LayaAir's glTF shader (`glTFPBR`), the one a
   * glTF model's materials use, which adds sheen, iridescence, an index of
   * refraction and specular tint, light through the surface (`transmission`,
   * with `volume`), clear-coat maps and a turned highlight. It is registered by
   * LayaAir's glTF module (`laya.gltf.js`, the `gltf` feature, browser SDK
   * profiles `3d-gltf` and `3d-gltf-webgpu`) when `Laya.init` runs; without it
   * a physical surface is refused.
   *
   * Every colour here is a display colour (sRGB, as a colour picker gives it
   * and as LayaAir's `Color` takes it); the shader gets it linear. Alpha and
   * the other numbers are taken as they are.
   */
  type: 'pbr' | 'unlit' | 'physical';
  /** Base colour and alpha, 0..1 each (default white). */
  color?: readonly [number, number, number, number];
  metallic?: number;
  roughness?: number;
  emission?: readonly [number, number, number];
  /**
   * A clear layer over the surface (lacquer, varnish, a wet sheen): how much,
   * 0..1 (default 0, none). Physically based surfaces only (`pbr`, `physical`).
   */
  clearCoat?: number;
  /**
   * Roughness of that layer, 0..1 (default 0.1). On a `physical` surface it
   * needs `clearCoat` above 0.
   */
  clearCoatRoughness?: number;
  /**
   * `physical`: how strongly `textures.clearCoatNormal` bends the layer, 0..10
   * (default 1). Needs `clearCoat` above 0.
   */
  clearCoatNormalScale?: number;
  /**
   * How far the highlight is drawn out, 0..1 (default 0): brushed metal,
   * hair, satin. It becomes a band across the mesh's tangent (its U
   * direction): round a ball turned on a lathe, a ring about its axis.
   */
  anisotropy?: number;
  /**
   * Turns the drawn-out highlight in the surface, degrees, any angle
   * (default 0: along the tangent, 90: along the bitangent). `pbr` and
   * `physical`. Needs `anisotropy` above 0. Written to the shader as it is:
   * LayaAir's own setter keeps the angle between 0 and 1 radian.
   */
  anisotropyRotationDeg?: number;
  /** `physical`: how strongly `textures.normal` bends the surface, 0..10 (default 1). */
  normalScale?: number;
  /** `physical`: how much `textures.occlusion` darkens, 0..1 (default 1). */
  occlusionStrength?: number;
  /**
   * `physical`: cloth and velvet, a soft light that rises where the surface
   * turns away from the eye. `color` 0..1 each; `roughness` 0..1
   * (default 0.5).
   */
  sheen?: { color: readonly [number, number, number]; roughness?: number };
  /**
   * `physical`: a thin film on the surface (soap, oil, a beetle's shell):
   * colours that change with the angle it is seen at. `factor` 0..1 (default
   * 1); `ior` of the film 1..3 (default 1.3); `thicknessRange` in nanometres,
   * 0..2000 (default [100, 400]). Without `textures.iridescenceThickness`
   * the film is `thicknessRange[1]` thick everywhere.
   */
  iridescence?: {
    factor?: number;
    ior?: number;
    thicknessRange?: readonly [number, number];
  };
  /**
   * `physical`: index of refraction of a dielectric, 1..3 (default 1.5: a
   * reflectance of 4 % head on). Water 1.33, glass 1.5, diamond 2.42. It
   * also bends the light through a `transmission` surface with a `volume`.
   */
  ior?: number;
  /**
   * `physical`: the strength (`factor` 0..1, default 1) and tint (`color`
   * 0..1 each, default white) of a dielectric's reflection.
   */
  specular?: { factor?: number; color?: readonly [number, number, number] };
  /**
   * `physical`: light through the surface (glass, water, gems): `factor`
   * 0..1 of what is behind it shows through, tinted by `color`. It reads
   * the camera's picture of the opaque scene: the camera needs that pass
   * (`configureSurfacePasses(camera, [surfaceMaterialPasses(spec)], …)`):
   * without it nothing shows through and the surface is drawn as black
   * glass, with its reflections only. The surface is drawn after the opaque
   * scene (render queue 3000), so other transparent and transmissive
   * surfaces do not show through it. `volume` gives it a thickness, in the
   * mesh's own units (the node's scale applies), that bends what is behind
   * (by `ior`) and absorbs light: after `attenuationDistance` (default:
   * none absorbed) the light left is `attenuationColor` (above 0 and at
   * most 1 each, default white).
   */
  transmission?: {
    factor: number;
    volume?: {
      thickness: number;
      attenuationColor?: readonly [number, number, number];
      attenuationDistance?: number;
    };
  };
  /**
   * Textures. `pbr`: `albedo`, `normal`, `metallicGloss` (R metallic, A
   * smoothness) and `emission`. `physical` reads them the glTF way:
   * `albedo`, `normal` (read as `pbr` reads it), `metallicRoughness`
   * (G roughness, B metallic), `occlusion` (R), `emission`, and for its
   * features: `clearCoat` (R), `clearCoatRoughness` (G), `clearCoatNormal`,
   * `sheenColor` (RGB), `sheenRoughness` (A), `iridescence` (R),
   * `iridescenceThickness` (G, across `thicknessRange`), `transmission`
   * (R), `thickness` (G), `specular` (A), `specularColor` (RGB) and
   * `anisotropy` (RG direction, B strength). A feature's textures need the
   * feature switched on; a slot left `undefined` or `null` is empty. Colour
   * textures are sRGB (`createSurfaceTexture` role `color`), the others
   * linear. A `physical` surface may fill six slots at most
   * (`physicalSurfaceTextureLimit`), and its `normal` texture needs a mesh
   * with tangents.
   */
  textures?: {
    albedo?: any;
    normal?: any;
    metallicGloss?: any;
    emission?: any;
    metallicRoughness?: any;
    occlusion?: any;
    clearCoat?: any;
    clearCoatRoughness?: any;
    clearCoatNormal?: any;
    sheenColor?: any;
    sheenRoughness?: any;
    iridescence?: any;
    iridescenceThickness?: any;
    transmission?: any;
    thickness?: any;
    specular?: any;
    specularColor?: any;
    anisotropy?: any;
  };
  blend?: 'opaque' | 'alpha' | 'additive' | 'cutout';
  alphaCutoff?: number;
  doubleSided?: boolean;
  depthWrite?: boolean;
}

/** LayaAir's glTF shader, registered by `laya.gltf.js` at `Laya.init`. */
export const ZHUDA_PHYSICAL_SHADER = 'glTFPBR';

/** Fields only a `physical` surface takes. */
const PHYSICAL_FIELDS = [
  'sheen',
  'iridescence',
  'ior',
  'specular',
  'transmission',
  'clearCoatNormalScale',
  'normalScale',
  'occlusionStrength',
] as const;

/**
 * Texture slots of a physical surface: the shader's uniform, its define, and
 * the feature that must be on for it (none: always usable).
 */
const PHYSICAL_TEXTURES: Record<string, { uniform: string; define: string; needs?: string }> = {
  albedo: { uniform: 'u_BaseColorTexture', define: 'BASECOLORMAP' },
  normal: { uniform: 'u_NormalTexture', define: 'NORMALMAP' },
  metallicRoughness: { uniform: 'u_MetallicRoughnessTexture', define: 'METALLICROUGHNESSMAP' },
  occlusion: { uniform: 'u_OcclusionTexture', define: 'OCCLUSIONMAP' },
  emission: { uniform: 'u_EmissionTexture', define: 'EMISSIONMAP' },
  specular: { uniform: 'u_SpecularFactorTexture', define: 'SPECULARFACTORMAP' },
  specularColor: { uniform: 'u_SpecularColorTexture', define: 'SPECULARCOLORMAP' },
  clearCoat: { uniform: 'u_ClearCoatTexture', define: 'CLEARCOATMAP', needs: 'clearCoat' },
  clearCoatRoughness: {
    uniform: 'u_ClearCoatRoughnessTexture',
    define: 'CLEARCOAT_ROUGHNESSMAP',
    needs: 'clearCoat',
  },
  clearCoatNormal: {
    uniform: 'u_ClearCoatNormalTexture',
    define: 'CLEARCOAT_NORMAL',
    needs: 'clearCoat',
  },
  anisotropy: { uniform: 'u_AnisotropyTexture', define: 'ANISOTROPYMAP', needs: 'anisotropy' },
  sheenColor: { uniform: 'u_SheenColorTexture', define: 'SHEENCOLORMAP', needs: 'sheen' },
  sheenRoughness: {
    uniform: 'u_SheenRoughnessTexture',
    define: 'SHEEN_ROUGHNESSMAP',
    needs: 'sheen',
  },
  iridescence: {
    uniform: 'u_IridescenceTexture',
    define: 'IRIDESCENCEMAP',
    needs: 'iridescence',
  },
  iridescenceThickness: {
    uniform: 'u_IridescenceThicknessTexture',
    define: 'IRIDESCENCE_THICKNESSMAP',
    needs: 'iridescence',
  },
  transmission: {
    uniform: 'u_TransmissionTexture',
    define: 'TRANSMISSIONMAP',
    needs: 'transmission',
  },
  thickness: {
    uniform: 'u_VolumeThicknessTexture',
    define: 'THICKNESSMAP',
    needs: 'transmission.volume',
  },
};

/**
 * Samplers one shader stage may hold: WebGPU's `maxSamplersPerShaderStage`
 * (LayaAir asks for no more) and WebGL's `MAX_TEXTURE_IMAGE_UNITS` on the
 * desktop GPU measured.
 */
const SAMPLERS_PER_STAGE = 16;
/**
 * Samplers of a lit scene that a physical surface's pipeline holds beside its
 * own textures, counted on WebGPU where LayaAir binds all of them whether the
 * scene uses them or not: the sun's and the spot lights' shadow maps, the
 * point-shadow picture, the two light lists, the camera's depth, depth-normal
 * and opaque pictures, the environment, and the shader's reflectance lookup.
 * WebGL binds only the ones in use: seven of these, eight with transmission.
 */
const SCENE_SAMPLERS = 10;

/** Where a physical surface is drawn, as far as it changes how many textures it may carry. */
export interface PhysicalSurfaceUse {
  /**
   * The renderer carries a baked lightmap (`true`: one sampler more), with a
   * direction picture (`'directional'`: two more). Default none.
   */
  lightmap?: boolean | 'directional';
}

/**
 * How many texture slots a `physical` surface may fill and still be drawn:
 * 6, or 5 on a lightmapped renderer, 4 with a directional lightmap.
 *
 * A shader stage holds 16 samplers and every filled slot takes one, the
 * same picture in two slots twice. A lit scene takes 10 of them on WebGPU
 * (shadow maps, the point-shadow picture, light lists, the camera's
 * pictures, the environment); WebGL binds only what the scene uses, so the
 * WebGPU count is the limit for both. Past it the surface is not drawn at
 * all: WebGPU refuses its pipeline and WebGL its shader, and LayaAir only
 * logs it. Counted with every light and shadow the engine has. Not counted:
 * the animation texture of LayaAir's simple skinned mesh, one sampler more.
 */
export function physicalSurfaceTextureLimit(use: PhysicalSurfaceUse = {}): number {
  const lightmap = use.lightmap === 'directional' ? 2 : use.lightmap ? 1 : 0;
  return SAMPLERS_PER_STAGE - SCENE_SAMPLERS - lightmap;
}

const finiteIn = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const colourIn = (v: unknown, n: number, min: number, max: number) =>
  Array.isArray(v) && v.length === n && v.every((c) => finiteIn(c, min, max));

/**
 * Problems with a `physical` surface spec, one line each; an empty list
 * means `createSurfaceMaterial` takes it. Pure: it does not need LayaAir.
 * It counts the filled texture slots against `physicalSurfaceTextureLimit`;
 * `createSurfaceMaterial` checks without `use`, so a surface for a
 * lightmapped renderer is checked here with `use` first.
 */
export function validatePhysicalSurfaceSpec(
  s: SurfaceMaterialSpec,
  use: PhysicalSurfaceUse = {},
): string[] {
  const e: string[] = [];
  const check = (ok: boolean, message: string) => {
    if (!ok) e.push(message);
  };
  if (s.color !== undefined) check(colourIn(s.color, 4, 0, 1), 'color: four numbers 0..1');
  for (const key of ['metallic', 'roughness', 'clearCoat', 'clearCoatRoughness'] as const)
    if (s[key] !== undefined) check(finiteIn(s[key], 0, 1), `${key}: use 0..1`);
  if (s.anisotropy !== undefined) check(finiteIn(s.anisotropy, 0, 1), 'anisotropy: use 0..1');
  if (s.alphaCutoff !== undefined) check(finiteIn(s.alphaCutoff, 0, 1), 'alphaCutoff: use 0..1');
  if (s.anisotropyRotationDeg !== undefined)
    check(
      typeof s.anisotropyRotationDeg === 'number' && Number.isFinite(s.anisotropyRotationDeg),
      'anisotropyRotationDeg: a finite number of degrees',
    );
  if (s.emission !== undefined)
    check(colourIn(s.emission, 3, 0, 100), 'emission: three numbers 0..100');
  for (const key of ['normalScale', 'clearCoatNormalScale'] as const)
    if (s[key] !== undefined) check(finiteIn(s[key], 0, 10), `${key}: use 0..10`);
  if (s.occlusionStrength !== undefined)
    check(finiteIn(s.occlusionStrength, 0, 1), 'occlusionStrength: use 0..1');
  if (s.ior !== undefined) check(finiteIn(s.ior, 1, 3), 'ior: use 1..3');
  if (s.sheen !== undefined) {
    check(colourIn(s.sheen?.color, 3, 0, 1), 'sheen.color: three numbers 0..1');
    if (s.sheen?.roughness !== undefined)
      check(finiteIn(s.sheen.roughness, 0, 1), 'sheen.roughness: use 0..1');
  }
  if (s.iridescence !== undefined) {
    const i = s.iridescence ?? {};
    if (i.factor !== undefined) check(finiteIn(i.factor, 0, 1), 'iridescence.factor: use 0..1');
    if (i.ior !== undefined) check(finiteIn(i.ior, 1, 3), 'iridescence.ior: use 1..3');
    if (i.thicknessRange !== undefined)
      check(
        colourIn(i.thicknessRange, 2, 0, 2000) && i.thicknessRange[0] <= i.thicknessRange[1],
        'iridescence.thicknessRange: [min, max] nanometres, 0 <= min <= max <= 2000',
      );
  }
  if (s.specular !== undefined) {
    if (s.specular?.factor !== undefined)
      check(finiteIn(s.specular.factor, 0, 1), 'specular.factor: use 0..1');
    if (s.specular?.color !== undefined)
      check(colourIn(s.specular.color, 3, 0, 1), 'specular.color: three numbers 0..1');
  }
  if (s.transmission !== undefined) {
    const t = s.transmission;
    check(finiteIn(t?.factor, 0, 1), 'transmission.factor: use 0..1');
    check(
      s.blend !== 'additive',
      'transmission: blend "additive" is refused (what is behind already shows through)',
    );
    if (t?.volume !== undefined) {
      const v = t.volume;
      check(finiteIn(v?.thickness, 0, 10000), 'transmission.volume.thickness: use 0..10000');
      if (v?.attenuationColor !== undefined)
        check(
          colourIn(v.attenuationColor, 3, 0, 1) && v.attenuationColor.every((c) => c > 0),
          'transmission.volume.attenuationColor: three numbers above 0 and at most 1',
        );
      if (v?.attenuationDistance !== undefined)
        check(
          finiteIn(v.attenuationDistance, 1e-6, 65504),
          'transmission.volume.attenuationDistance: above 0, at most 65504',
        );
    }
  }
  const on: Record<string, boolean> = {
    clearCoat: (s.clearCoat ?? 0) > 0,
    anisotropy: (s.anisotropy ?? 0) > 0,
    sheen: s.sheen !== undefined,
    iridescence: s.iridescence !== undefined,
    transmission: s.transmission !== undefined,
    'transmission.volume': s.transmission?.volume !== undefined,
  };
  // A field that only shapes a feature does nothing without it, as a texture does.
  for (const [key, needs] of [
    ['clearCoatRoughness', 'clearCoat'],
    ['clearCoatNormalScale', 'clearCoat'],
    ['anisotropyRotationDeg', 'anisotropy'],
  ] as const)
    if (s[key] !== undefined) check(on[needs], `${key}: needs ${needs} above 0`);
  let filled = 0;
  for (const [key, value] of Object.entries(s.textures ?? {})) {
    if (value == null) continue;
    const slot = PHYSICAL_TEXTURES[key];
    if (slot) filled++;
    if (!slot)
      e.push(
        key === 'metallicGloss'
          ? 'textures.metallicGloss: a physical surface takes metallicRoughness (glTF layout: G roughness, B metallic)'
          : `textures.${key}: unknown slot (use ${Object.keys(PHYSICAL_TEXTURES).join(', ')})`,
      );
    else if (typeof value !== 'object')
      e.push(`textures.${key}: a loaded texture, not ${typeof value}`);
    else if (slot.needs && !on[slot.needs])
      e.push(
        `textures.${key}: needs ${slot.needs}${slot.needs === 'clearCoat' || slot.needs === 'anisotropy' ? ' above 0' : ''}`,
      );
  }
  if (![undefined, false, true, 'directional'].includes(use?.lightmap))
    e.push('use.lightmap: true, false or "directional"');
  const limit = physicalSurfaceTextureLimit(use ?? {});
  if (filled > limit) {
    const lightmap = SAMPLERS_PER_STAGE - SCENE_SAMPLERS - limit;
    e.push(
      `textures: ${filled} filled, at most ${limit}` +
        (lightmap ? ` on a renderer with a ${lightmap === 2 ? 'directional ' : ''}lightmap` : '') +
        ` (a shader stage holds ${SAMPLERS_PER_STAGE} samplers and the scene's lights, shadows` +
        ` and surroundings take ${SCENE_SAMPLERS + lightmap}; past that the surface is not drawn)`,
    );
  }
  if (s.blend !== undefined)
    check(['opaque', 'alpha', 'additive', 'cutout'].includes(s.blend), 'blend: unknown mode');
  return e;
}

/**
 * The camera passes a surface needs, for `configureSurfacePasses`: a
 * `physical` surface with `transmission` reads the camera's picture of the
 * opaque scene (`opaqueColor`).
 */
export function surfaceMaterialPasses(s: SurfaceMaterialSpec): SurfacePassRequirements {
  return s.type === 'physical' && s.transmission !== undefined ? { opaqueColor: true } : {};
}

/** Materials `createSurfaceMaterial` made with the glTF shader: their texture slots to detach. */
const physicalMaterials = new WeakSet<object>();

function createPhysicalSurfaceMaterial(l: any, s: SurfaceMaterialSpec) {
  const problems = validatePhysicalSurfaceSpec(s);
  if (problems.length) throw Error('Physical surface: ' + problems.join('; '));
  if (!l?.Shader3D?.find?.(ZHUDA_PHYSICAL_SHADER))
    throw Error(
      `Physical surface: LayaAir's glTF shader '${ZHUDA_PHYSICAL_SHADER}' is not registered. ` +
        "Load LayaAir's glTF module (laya.gltf.js: the 'gltf' feature, browser SDK profile " +
        "3d-gltf or 3d-gltf-webgpu) before Laya.init, or use type 'pbr'.",
    );
  const m = new l.Material();
  // As laya.gltf.js createDefaultMaterial does; this also applies the shader's defaults.
  m.setShaderName(ZHUDA_PHYSICAL_SHADER);
  physicalMaterials.add(m);
  const define = (name: string) => m.setDefine(l.Shader3D.getDefineByName(name), true);
  // The glTF shader takes its colours linear, as glTF stores them.
  const colour3 = (name: string, v: readonly number[]) =>
    m.setVector3(
      name,
      new l.Vector3(zhudaSrgbToLinear(v[0]), zhudaSrgbToLinear(v[1]), zhudaSrgbToLinear(v[2])),
    );
  const [red, green, blue, alpha] = s.color ?? [1, 1, 1, 1];
  m.setVector4(
    'u_BaseColorFactor',
    new l.Vector4(zhudaSrgbToLinear(red), zhudaSrgbToLinear(green), zhudaSrgbToLinear(blue), alpha),
  );
  m.setFloat('u_MetallicFactor', s.metallic ?? 0);
  m.setFloat('u_RoughnessFactor', s.roughness ?? 0.5);
  const textures = s.textures ?? {};
  if (s.emission || textures.emission != null) {
    define('EMISSION');
    colour3('u_EmissionFactor', s.emission ?? [1, 1, 1]);
  }
  if (s.normalScale !== undefined) m.setFloat('u_NormalScale', s.normalScale);
  if (s.occlusionStrength !== undefined) m.setFloat('u_OcclusionStrength', s.occlusionStrength);
  if (s.ior !== undefined) {
    define('IOR');
    m.setFloat('u_Ior', s.ior);
  }
  if (s.specular) {
    m.setFloat('u_SpecularFactor', s.specular.factor ?? 1);
    colour3('u_SpecularColorFactor', s.specular.color ?? [1, 1, 1]);
  }
  if ((s.clearCoat ?? 0) > 0) {
    define('CLEARCOAT');
    m.setFloat('u_ClearCoatFactor', s.clearCoat);
    m.setFloat('u_ClearCoatRoughness', s.clearCoatRoughness ?? 0.1);
    if (s.clearCoatNormalScale !== undefined)
      m.setFloat('u_ClearCoatNormalScale', s.clearCoatNormalScale);
  }
  if ((s.anisotropy ?? 0) > 0) {
    define('ANISOTROPIC');
    m.setFloat('u_AnisotropyStrength', s.anisotropy);
    m.setFloat('u_AnisotropyRotation', zhudaAnisotropyRadians(s.anisotropyRotationDeg ?? 0));
  }
  if (s.sheen) {
    define('SHEEN');
    colour3('u_SheenColorFactor', s.sheen.color);
    m.setFloat('u_SheenRoughness', s.sheen.roughness ?? 0.5);
  }
  if (s.iridescence) {
    const [thinnest, thickest] = s.iridescence.thicknessRange ?? [100, 400];
    define('IRIDESCENCE');
    m.setFloat('u_IridescenceFactor', s.iridescence.factor ?? 1);
    m.setFloat('u_IridescenceIor', s.iridescence.ior ?? 1.3);
    m.setFloat('u_IridescenceThicknessMinimum', thinnest);
    m.setFloat('u_IridescenceThicknessMaximum', thickest);
  }
  if (s.transmission) {
    define('TRANSMISSION');
    m.setFloat('u_TransmissionFactor', s.transmission.factor);
    const volume = s.transmission.volume;
    if (volume) {
      define('THICKNESS');
      m.setFloat('u_VolumeThicknessFactor', volume.thickness);
      // 65504 is what laya.gltf.js writes for "no absorption" (the largest half float).
      m.setFloat('u_VolumeAttenuationDistance', volume.attenuationDistance ?? 65504);
      colour3('u_VolumeAttenuationColor', volume.attenuationColor ?? [1, 1, 1]);
    }
  }
  for (const [key, value] of Object.entries(textures)) {
    if (value == null) continue;
    const slot = PHYSICAL_TEXTURES[key];
    m.setTexture(slot.uniform, value.bitmap || value);
    define(slot.define);
  }
  const blend = s.blend || 'opaque',
    modes = l.MaterialRenderMode;
  m.materialRenderMode =
    blend === 'alpha'
      ? modes.RENDERMODE_TRANSPARENT
      : blend === 'cutout'
        ? modes.RENDERMODE_CUTOUT
        : blend === 'additive'
          ? modes.RENDERMODE_ADDTIVE
          : modes.RENDERMODE_OPAQUE;
  if (blend === 'cutout') m.alphaTestValue = s.alphaCutoff ?? 0.5;
  // As laya.gltf.js does for KHR_materials_transmission: drawn after the
  // opaque scene, so the camera's picture of it is there to be read.
  if (s.transmission) m.renderQueue = Math.max(m.renderQueue ?? 0, 3000);
  if (s.doubleSided) m.cull = l.RenderState.CULL_NONE;
  m.depthWrite = s.depthWrite ?? (blend === 'opaque' || blend === 'cutout');
  return m;
}

/**
 * A display (sRGB) colour channel as light, the way LayaAir's `Color` does it
 * (`gammaToLinearSpace`, values above 1 raised to 2.4).
 */
export function zhudaSrgbToLinear(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : value < 1
      ? Math.pow((value + 0.055) / 1.055, 2.4)
      : Math.pow(value, 2.4);
}

/** Degrees to the radians LayaAir's anisotropy rotation takes, folded into -180..180 degrees. */
export function zhudaAnisotropyRadians(degrees: number): number {
  if (!Number.isFinite(degrees)) throw Error('anisotropyRotationDeg: a finite number of degrees');
  const folded = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return (folded * Math.PI) / 180;
}
/** glTF/Three.js G=roughness,B=metallic -> Laya R=metallic,A=smoothness. Data stays linear. */
export function packMetallicRoughness(rgba: Uint8Array) {
  if (rgba.length % 4) throw Error('RGBA data required');
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = rgba[i + 2];
    out[i + 3] = 255 - rgba[i + 1];
  }
  return out;
}
/** Anisotropic filtering mipmapped surface textures get unless told otherwise. */
export const ZHUDA_DEFAULT_ANISO = 8;

export function createSurfaceTexture(
  width: number,
  height: number,
  pixels: Uint8Array,
  role: 'color' | 'emission' | 'normal' | 'data',
  options: {
    mipmap?: boolean;
    /**
     * Anisotropic filtering, 1..16 (1 is off). Default: `ZHUDA_DEFAULT_ANISO`
     * with mipmaps, 1 without. A floor, a road or a wall seen along its length
     * loses its detail a few metres away without it.
     */
    anisoLevel?: number;
  } = {},
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    pixels.length !== width * height * 4
  )
    throw Error('Invalid texture payload');
  const anisoLevel = options.anisoLevel ?? (options.mipmap === true ? ZHUDA_DEFAULT_ANISO : 1);
  if (!Number.isInteger(anisoLevel) || anisoLevel < 1 || anisoLevel > 16)
    throw Error('anisoLevel: use a whole number 1..16');
  const l = (globalThis as any).Laya,
    t = new l.Texture2D(
      width,
      height,
      l.TextureFormat.R8G8B8A8,
      options.mipmap === true,
      true,
      role === 'color' || role === 'emission',
    );
  t.setPixelsData(pixels, false, false);
  if (anisoLevel > 1) t.anisoLevel = anisoLevel;
  return t;
}

/**
 * Gives the mipmapped textures of every material below `root` anisotropic
 * filtering (see `createSurfaceTexture`). Textures that already ask for as
 * much or more, and render targets, are left alone. Returns how many textures
 * changed. The model library applies it to each model once, when it is loaded.
 */
export function applyZhudaAnisotropy(root: any, level = ZHUDA_DEFAULT_ANISO): number {
  if (!Number.isInteger(level) || level < 1 || level > 16)
    throw Error('anisoLevel: use a whole number 1..16');
  const l = (globalThis as any).Laya;
  if (!l?.BaseTexture || level === 1) return 0;
  const seen = new Set<any>();
  let changed = 0;
  const visit = (node: any) => {
    const renderer =
      node.meshRenderer ??
      node.skinnedMeshRenderer ??
      (l.MeshRenderer ? node.getComponent?.(l.MeshRenderer) : undefined);
    for (const material of renderer?.sharedMaterials ?? []) {
      const values = material?.shaderData?.getData?.();
      if (!values || seen.has(material)) continue;
      seen.add(material);
      for (const value of Object.values(values) as any[]) {
        if (
          !(value instanceof l.BaseTexture) ||
          (l.RenderTexture && value instanceof l.RenderTexture) ||
          seen.has(value)
        )
          continue;
        seen.add(value);
        if (value.mipmapCount > 1 && !(value.anisoLevel >= level)) {
          value.anisoLevel = level;
          changed++;
        }
      }
    }
    for (let i = 0; i < (node.numChildren || 0); i++) visit(node.getChildAt(i));
  };
  visit(root);
  return changed;
}
export function createSurfaceMaterial(s: SurfaceMaterialSpec) {
  const l = (globalThis as any).Laya;
  if (s.type === 'physical') return createPhysicalSurfaceMaterial(l, s);
  if (!['pbr', 'unlit'].includes(s.type)) throw Error('Unknown material type');
  const physicalOnly = [
    ...PHYSICAL_FIELDS.filter((key) => s[key] !== undefined),
    ...Object.entries(s.textures ?? {})
      .filter(
        ([key, value]) =>
          value != null && !['albedo', 'normal', 'metallicGloss', 'emission'].includes(key),
      )
      .map(([key]) => `textures.${key}`),
  ];
  if (physicalOnly.length)
    throw Error(`${physicalOnly.join(', ')}: physical surfaces only (type 'physical')`);
  if (
    [s.metallic ?? 0, s.roughness ?? 0.5, s.alphaCutoff ?? 0.5].some(
      (v) => !Number.isFinite(v) || v < 0 || v > 1,
    )
  )
    throw Error('Invalid material factors');
  if (
    [s.clearCoat ?? 0, s.clearCoatRoughness ?? 0.1].some(
      (v) => !Number.isFinite(v) || v < 0 || v > 1,
    ) ||
    !Number.isFinite(s.anisotropy ?? 0) ||
    (s.anisotropy ?? 0) < 0 ||
    (s.anisotropy ?? 0) > 1
  )
    throw Error('Invalid material factors: clearCoat 0..1, anisotropy 0..1');
  if (
    s.type !== 'pbr' &&
    ((s.clearCoat ?? 0) > 0 || (s.anisotropy ?? 0) !== 0 || s.anisotropyRotationDeg !== undefined)
  )
    throw Error('clearCoat and anisotropy belong to physically based surfaces');
  if (s.anisotropyRotationDeg !== undefined && !((s.anisotropy ?? 0) > 0))
    throw Error('anisotropyRotationDeg: needs anisotropy above 0');
  const m = s.type === 'pbr' ? new l.PBRStandardMaterial() : new l.UnlitMaterial();
  m.albedoColor = new l.Color(...(s.color || [1, 1, 1, 1]));
  if (s.type === 'pbr') {
    m.metallic = s.metallic ?? 0;
    m.smoothness = 1 - (s.roughness ?? 0.5);
    if (s.emission) {
      m.enableEmission = true;
      m.emissionColor = new l.Color(...s.emission, 1);
    }
    if ((s.clearCoat ?? 0) > 0) {
      m.clearCoatEnable = true;
      m.clearCoat = s.clearCoat;
      m.clearCoatRoughness = s.clearCoatRoughness ?? 0.1;
    }
    if ((s.anisotropy ?? 0) !== 0) {
      m.anisotropyEnable = true;
      m.anisotropy = s.anisotropy;
      // LayaAir's `anisotropyRotation` setter keeps the angle in 0..1 radian;
      // the shader turns by any angle (cos, sin), so the uniform is written.
      if (s.anisotropyRotationDeg !== undefined)
        m.setFloat('u_AnisotropyRotation', zhudaAnisotropyRadians(s.anisotropyRotationDeg));
    }
  }
  for (const [key, value] of Object.entries(s.textures || {}))
    m[
      (
        {
          albedo: 'albedoTexture',
          normal: 'normalTexture',
          metallicGloss: 'metallicGlossTexture',
          emission: 'emissionTexture',
        } as any
      )[key]
    ] = value?.bitmap || value;
  const blend = s.blend || 'opaque',
    Class = s.type === 'pbr' ? l.PBRStandardMaterial : l.UnlitMaterial;
  // LayaAir 3.4.2 names the modes of its PBR material in an enum of their own
  // (`PBRRenderMode`); the unlit material keeps them on its class. `Fade` is
  // the plain alpha blend: the whole surface, highlights included, fades.
  if (blend === 'alpha')
    m.renderMode = s.type === 'pbr' ? l.PBRRenderMode.Fade : Class.RENDERMODE_TRANSPARENT;
  else if (blend === 'cutout') {
    m.alphaTest = true;
    m.alphaTestValue = s.alphaCutoff ?? 0.5;
  } else if (blend === 'additive') {
    m.renderQueue = 3000;
    m.blend = l.RenderState.BLEND_ENABLE_ALL;
    m.blendSrc = l.RenderState.BLENDPARAM_SRC_ALPHA;
    m.blendDst = l.RenderState.BLENDPARAM_ONE;
  }
  if (s.doubleSided) m.cull = l.RenderState.CULL_NONE;
  m.depthWrite = s.depthWrite ?? (blend === 'opaque' || blend === 'cutout');
  return m;
}
/** Detach borrowed texture slots before destroying an owned material. */
export function disposeSurfaceMaterial(m: any) {
  if (physicalMaterials.has(m)) {
    physicalMaterials.delete(m);
    for (const slot of Object.values(PHYSICAL_TEXTURES)) m.setTexture(slot.uniform, null);
  } else
    for (const k of ['albedoTexture', 'normalTexture', 'metallicGlossTexture', 'emissionTexture'])
      if (k in m) m[k] = null;
  m.destroy();
}
export interface CustomSurfaceShader {
  dimension?: 2 | 3;
  name: string;
  vertex: string;
  fragment: string;
  attributes?: Record<string, [number, any]>;
  uniforms: Record<string, any>;
  instancing?: boolean;
}
const registeredShaders = new WeakMap<object, Map<string, string>>();
export function createCustomSurfaceMaterial(s: CustomSurfaceShader) {
  const l = (globalThis as any).Laya;
  if (!s.name || !s.vertex || !s.fragment) throw Error('Incomplete custom shader');
  let registry = registeredShaders.get(l.Shader3D);
  if (!registry) registeredShaders.set(l.Shader3D, (registry = new Map()));
  const signature = JSON.stringify(s);
  if (l.Shader3D.find(s.name)) {
    if (registry.get(s.name) !== signature) throw Error('Shader name has a different contract');
  } else {
    const shader = l.Shader3D.add(s.name, !!s.instancing, false);
    shader.shaderType =
      s.dimension === 2 ? l.ShaderFeatureType.D2_TextureSV : l.ShaderFeatureType.D3;
    const sub = new l.SubShader(
      s.attributes ||
        (s.dimension === 2 ? l.Shader2D.graphicsAttribute : l.SubShader.DefaultAttributeMap),
      s.uniforms,
    );
    shader.addSubShader(sub);
    // Laya injects uniforms declared by the map. Its scanner misses comma-separated
    // GLSL declarations, so remove only the explicit, mapped scalar/vector names.
    // Built-in camera/light declarations and unmapped declarations remain intact.
    const source = (code: string) =>
      code.replace(
        /\buniform\s+((?:(?:lowp|mediump|highp)\s+)?\w+)\s+([^;]+);/g,
        (original, type, names) => {
          const retained = names
            .split(',')
            .map((n: string) => n.trim())
            .filter((n: string) => !Object.prototype.hasOwnProperty.call(s.uniforms, n));
          return retained.length ? `uniform ${type} ${retained.join(',')};` : '';
        },
      );
    sub.addShaderPass(source(s.vertex), source(s.fragment));
    registry.set(s.name, signature);
  }
  const material = new l.Material();
  material.setShaderName(s.name);
  return material;
}
export interface MeshData {
  positions: Float32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  tangents?: Float32Array;
  indices: Uint16Array | Uint32Array;
}
/** UV-derived tangent frames for normal-mapped procedural geometry. Degenerate UVs use a stable orthogonal frame. */
export function computeMeshTangents(data: MeshData): Float32Array {
  const n = data.positions.length / 3;
  if (
    !data.normals ||
    !data.uvs ||
    !Number.isInteger(n) ||
    data.normals.length !== n * 3 ||
    data.uvs.length !== n * 2 ||
    data.indices.length % 3 ||
    [...data.indices].some((i) => i >= n) ||
    ![...data.positions, ...data.normals, ...data.uvs].every(Number.isFinite)
  )
    throw Error('Tangents require finite position/normal/UV triangles');
  const a = new Float64Array(n * 3),
    b = new Float64Array(n * 3);
  for (let i = 0; i < data.indices.length; i += 3) {
    const [i0, i1, i2] = [data.indices[i], data.indices[i + 1], data.indices[i + 2]];
    const du1 = data.uvs[i1 * 2] - data.uvs[i0 * 2],
      dv1 = data.uvs[i1 * 2 + 1] - data.uvs[i0 * 2 + 1],
      du2 = data.uvs[i2 * 2] - data.uvs[i0 * 2],
      dv2 = data.uvs[i2 * 2 + 1] - data.uvs[i0 * 2 + 1];
    const determinant = du1 * dv2 - du2 * dv1;
    if (Math.abs(determinant) < 1e-12) continue;
    for (let k = 0; k < 3; k++) {
      const e1 = data.positions[i1 * 3 + k] - data.positions[i0 * 3 + k],
        e2 = data.positions[i2 * 3 + k] - data.positions[i0 * 3 + k];
      for (const index of [i0, i1, i2]) {
        a[index * 3 + k] += (e1 * dv2 - e2 * dv1) / determinant;
        b[index * 3 + k] += (e2 * du1 - e1 * du2) / determinant;
      }
    }
  }
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    let nx = data.normals[i * 3],
      ny = data.normals[i * 3 + 1],
      nz = data.normals[i * 3 + 2],
      length = Math.hypot(nx, ny, nz);
    if (length < 1e-9) throw Error('Zero mesh normal');
    nx /= length;
    ny /= length;
    nz /= length;
    const dot = nx * a[i * 3] + ny * a[i * 3 + 1] + nz * a[i * 3 + 2];
    let x = a[i * 3] - nx * dot,
      y = a[i * 3 + 1] - ny * dot,
      z = a[i * 3 + 2] - nz * dot;
    length = Math.hypot(x, y, z);
    if (length < 1e-9) {
      if (Math.abs(ny) < 0.99) {
        x = -nz;
        y = 0;
        z = nx;
      } else {
        x = 0;
        y = nz;
        z = -ny;
      }
      length = Math.hypot(x, y, z);
    }
    x /= length;
    y /= length;
    z /= length;
    const sign =
      (ny * z - nz * y) * b[i * 3] +
        (nz * x - nx * z) * b[i * 3 + 1] +
        (nx * y - ny * x) * b[i * 3 + 2] <
      0
        ? -1
        : 1;
    out.set([x, y, z, sign], i * 4);
  }
  return out;
}
/** Laya 3.4.2 buffer adapter; POSITION/NORMAL/UV, local range uploads and refreshed bounds. */
export class ZhudaDynamicMesh {
  readonly data: MeshData;
  readonly mesh: any;
  readonly vertices: Float32Array;
  readonly stride: number;
  readonly node: any;
  private disposed = false;
  constructor(data: MeshData, parent?: any) {
    this.data = data;
    const l = (globalThis as any).Laya,
      n = data.positions.length / 3;
    if (!Number.isInteger(n) || n < 3 || n > 65535)
      throw Error('Mesh requires 3..65535 vertices per chunk');
    if (
      (data.normals && data.normals.length !== n * 3) ||
      (data.uvs && data.uvs.length !== n * 2) ||
      (data.tangents && data.tangents.length !== n * 4) ||
      !data.indices.length ||
      data.indices.length % 3 ||
      [...data.indices].some((i) => i >= n)
    )
      throw Error('Invalid mesh attributes or indices');
    this.stride = data.tangents ? 12 : 8;
    this.vertices = new Float32Array(n * this.stride);
    for (let i = 0; i < n; i++) {
      this.vertices.set(data.positions.subarray(i * 3, i * 3 + 3), i * this.stride);
      this.vertices.set(data.normals?.subarray(i * 3, i * 3 + 3) || [0, 1, 0], i * this.stride + 3);
      this.vertices.set(data.uvs?.subarray(i * 2, i * 2 + 2) || [0, 0], i * this.stride + 6);
      if (data.tangents)
        this.vertices.set(data.tangents.subarray(i * 4, i * 4 + 4), i * this.stride + 8);
    }
    if (!this.vertices.every(Number.isFinite)) throw Error('Non-finite mesh data');
    this.mesh = l.PrimitiveMesh._createMesh(
      l.VertexMesh.getVertexDeclaration(
        data.tangents ? 'POSITION,NORMAL,UV,TANGENT' : 'POSITION,NORMAL,UV',
      ),
      this.vertices,
      new Uint16Array(data.indices),
    );
    this.node = new l.MeshSprite3D(this.mesh);
    parent?.addChild(this.node);
    this.refreshBounds();
  }
  updateRange(first: number, count: number) {
    if (this.disposed) throw Error('Disposed mesh');
    if (
      !Number.isInteger(first) ||
      !Number.isInteger(count) ||
      first < 0 ||
      count < 1 ||
      (first + count) * this.stride > this.vertices.length
    )
      throw Error('Invalid vertex range');
    if (
      !this.vertices
        .subarray(first * this.stride, (first + count) * this.stride)
        .every(Number.isFinite)
    )
      throw Error('Non-finite mesh update');
    const bytes = first * this.stride * 4,
      length = count * this.stride * 4;
    this.mesh._vertexBuffer.setData(this.vertices.buffer, bytes, bytes, length);
    this.refreshBounds();
  }
  setPosition(i: number, x: number, y: number, z: number) {
    if (
      !Number.isInteger(i) ||
      i < 0 ||
      i * this.stride >= this.vertices.length ||
      ![x, y, z].every(Number.isFinite)
    )
      throw Error('Invalid vertex');
    this.vertices.set([x, y, z], i * this.stride);
  }
  private padding = 0;
  /**
   * Grows the bounds by this many metres on every side, and keeps them grown
   * when vertices change. For a material whose vertex hook moves the surface
   * (wind, swell): without it the mesh is culled as if it had not moved.
   */
  padBounds(meters: number) {
    if (this.disposed) throw Error('Disposed mesh');
    if (!Number.isFinite(meters) || meters < 0 || meters > 10000)
      throw Error('padBounds: use 0..10000 metres');
    this.padding = meters;
    this.refreshBounds();
  }
  refreshBounds() {
    const l = (globalThis as any).Laya,
      min = new l.Vector3(Infinity, Infinity, Infinity),
      max = new l.Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < this.vertices.length; i += this.stride) {
      min.x = Math.min(min.x, this.vertices[i]);
      min.y = Math.min(min.y, this.vertices[i + 1]);
      min.z = Math.min(min.z, this.vertices[i + 2]);
      max.x = Math.max(max.x, this.vertices[i]);
      max.y = Math.max(max.y, this.vertices[i + 1]);
      max.z = Math.max(max.z, this.vertices[i + 2]);
    }
    for (const axis of ['x', 'y', 'z'] as const) {
      min[axis] -= this.padding;
      max[axis] += this.padding;
    }
    this.mesh.bounds = new l.Bounds(min, max);
    this.node.meshRenderer.boundsChange = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.node.destroy(true);
    this.mesh.destroy();
  }
}
/** Stable application IDs survive batch reorder. Laya batches shared mesh/material via GPU instancing. */
export class ZhudaInstanceGroup {
  readonly parent: any;
  readonly mesh: any;
  readonly material: any;
  private nodes = new Map<string, { node: any; matrix: any }>();
  private disposed = false;
  constructor(parent: any, mesh: any, material: any) {
    this.parent = parent;
    this.mesh = mesh;
    this.material = material;
    material.enableInstancing = true;
  }
  set(id: string, matrix: ArrayLike<number>) {
    if (this.disposed) throw Error('Disposed instance group');
    if (!id || matrix.length !== 16) throw Error('Invalid instance');
    // Validate before touching retained storage: failed updates are atomic.
    for (let i = 0; i < 16; i++) if (!Number.isFinite(matrix[i])) throw Error('Invalid instance');
    let entry = this.nodes.get(id);
    if (!entry) {
      const l = (globalThis as any).Laya;
      const node = new l.MeshSprite3D(this.mesh, id);
      node.meshRenderer.sharedMaterial = this.material;
      this.parent.addChild(node);
      entry = { node, matrix: new l.Matrix4x4() };
      this.nodes.set(id, entry);
    }
    for (let i = 0; i < 16; i++) entry.matrix.elements[i] = matrix[i];
    entry.node.transform.worldMatrix = entry.matrix;
    return entry.node;
  }
  remove(id: string) {
    const entry = this.nodes.get(id);
    if (!entry) return false;
    entry.node.destroy(true);
    this.nodes.delete(id);
    return true;
  }
  get(id: string) {
    return this.nodes.get(id)?.node;
  }
  get size() {
    return this.nodes.size;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { node } of this.nodes.values()) node.destroy(true);
    this.nodes.clear();
  }
}

export interface SurfacePassRequirements {
  depth?: boolean;
  opaqueColor?: boolean;
}
/** Owns this camera's depth/color requests. A rejected budget requires a consumer material fallback.
 * Costs count requested prepasses/copies; actual draw calls depend on scene/shadows/postprocessing. */
export function configureSurfacePasses(
  camera: any,
  requirements: readonly SurfacePassRequirements[],
  maxAdditionalPasses: number,
) {
  if (!Number.isInteger(maxAdditionalPasses) || maxAdditionalPasses < 0)
    throw Error('Invalid additional pass budget');
  const l = (globalThis as any).Laya;
  const depth = requirements.some((r) => r.depth),
    opaqueColor = requirements.some((r) => r.opaqueColor);
  const requestedPasses = Number(depth) + Number(opaqueColor);
  const withinBudget = requestedPasses <= maxAdditionalPasses;
  camera.depthTextureMode =
    withinBudget && depth ? l.DepthTextureMode.Depth : l.DepthTextureMode.None;
  camera.opaquePass = withinBudget && opaqueColor;
  const supported = !depth || !!(camera.depthTextureMode & l.DepthTextureMode.Depth);
  if (!supported) {
    camera.depthTextureMode = l.DepthTextureMode.None;
    camera.opaquePass = false;
  }
  return {
    requested: { depth, opaqueColor },
    requestedPasses,
    enabledPasses: withinBudget && supported ? requestedPasses : 0,
    ready: withinBudget && supported,
    reason: !withinBudget ? 'budget' : !supported ? 'depth-unsupported' : null,
  };
}
