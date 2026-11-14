import {
  externalZhudaGltfBuffers,
  quantizedZhudaGltfAccessors,
  readZhudaGltfCameras,
  readZhudaGltfLights,
  resolveZhudaGltfTextureSource,
  type ZhudaImageDecodeSupport,
} from './GltfIntake.ts';
/** Import diagnostics describe the shipped importer, not complete glTF conformance. */
export interface ModelDiagnostic {
  code:
    | 'INVALID_DOCUMENT'
    | 'INVALID_EXTENSION_DECLARATION'
    | 'UNDECLARED_EXTENSION'
    | 'UNSUPPORTED_REQUIRED_EXTENSION'
    | 'UNSUPPORTED_OPTIONAL_EXTENSION'
    | 'REQUIRED_RENDER_INPUT'
    | 'INVALID_MORPH_WEIGHTS'
    /** Meshopt data: only a registered decoder (ZhudaMeshoptModelDecoder) reads it. */
    | 'DECODER_REQUIRED'
    /** Integer vertex attributes the engine turns into floats before LayaAir parses them. */
    | 'DEQUANTIZED_ATTRIBUTES'
    /** Integer vertex attributes in a buffer outside the file: there are no bytes to turn into floats. */
    | 'EMBEDDED_BUFFER_REQUIRED'
    /** This device cannot decode a texture's WebP/AVIF image: its fallback loads, or nothing. */
    | 'IMAGE_DECODE_UNAVAILABLE'
    /** The device's decoder gave the probe no answer in time: as unavailable for this load; the next asks again. */
    | 'IMAGE_DECODE_UNANSWERED'
    /** A WebP/AVIF image without a fallback, inspected without a device answer. */
    | 'IMAGE_DECODE_UNCHECKED'
    /** Set by ZhudaModelLibrary after loading: a texture's picture did not load or decode; its slots are empty. */
    | 'IMAGE_DECODE_FAILED'
    /** A punctual light LayaAir can only approximate (falloff, spot cone). */
    | 'LIGHT_APPROXIMATED'
    | 'INVALID_LIGHT'
    | 'INVALID_CAMERA';
  severity: 'error' | 'warning';
  path: string;
  extension?: string;
  message: string;
  hint: string;
}
export interface GltfExtensionCapability {
  name: string;
  /** `native`: LayaAir's importer; `engine`: this engine before or around it. */
  implementation: 'native' | 'engine';
  requiredRenderInputs: readonly 'opaqueColor'[];
  /** An implemented parser is not a visual conformance certificate. */
  visualConformance: 'not-certified';
}
export interface GltfAssetCapability {
  name: string;
  kind: 'container' | 'delivery' | 'geometry-compression' | 'image-compression';
  status: 'supported' | 'adapter-required' | 'unsupported';
  message: string;
  hint: string;
}
/** Machine-readable import/delivery boundary for agents and model tooling. */
export const gltfAssetCapabilities: readonly GltfAssetCapability[] = Object.freeze([
  Object.freeze({
    name: 'glTF 2.0 JSON',
    kind: 'container' as const,
    status: 'supported' as const,
    message: 'glTF 2.0 JSON can be inspected and loaded when its resources are self-contained.',
    hint: 'Prefer a single GLB for consumer delivery.',
  }),
  Object.freeze({
    name: 'GLB 2.0',
    kind: 'container' as const,
    status: 'supported' as const,
    message: 'GLB 2.0 with an embedded JSON and binary payload is supported.',
    hint: 'Pass the complete GLB through AssetProvider.',
  }),
  Object.freeze({
    name: 'embedded buffers/images',
    kind: 'delivery' as const,
    status: 'supported' as const,
    message: 'Embedded data is deterministic and provider-verifiable.',
    hint: 'Record the logical asset SHA.',
  }),
  Object.freeze({
    name: 'external buffers/images',
    kind: 'delivery' as const,
    status: 'unsupported' as const,
    message: 'The provider model loader does not fetch undeclared relative resource URLs.',
    hint: 'Package buffers and images into a GLB or explicit provider assets.',
  }),
  Object.freeze({
    name: 'KHR_draco_mesh_compression',
    kind: 'geometry-compression' as const,
    status: 'unsupported' as const,
    message: 'No pinned Draco decoder is shipped in this release.',
    hint: 'Export an uncompressed GLB or add a separately verified decoder adapter.',
  }),
  Object.freeze({
    name: 'EXT_meshopt_compression',
    kind: 'geometry-compression' as const,
    status: 'adapter-required' as const,
    message:
      'Embedded glTF/GLB can be decoded by the optional pinned Meshopt adapter before native parsing.',
    hint: 'Register ZhudaMeshoptModelDecoder with ZhudaModelDecoderRegistry and pass decoders plus provider to ZhudaModelLibrary; verify the model on target devices.',
  }),
  Object.freeze({
    name: 'KHR_meshopt_compression',
    kind: 'geometry-compression' as const,
    status: 'adapter-required' as const,
    message:
      'The ratified Meshopt name, with its COLOR filter, is decoded by the same optional adapter before native parsing.',
    hint: 'Register ZhudaMeshoptModelDecoder with ZhudaModelDecoderRegistry and pass decoders plus provider to ZhudaModelLibrary; verify the model on target devices.',
  }),
  Object.freeze({
    name: 'KHR_mesh_quantization',
    kind: 'geometry-compression' as const,
    status: 'supported' as const,
    message:
      'Integer vertex attributes are turned into floats before native parsing; node transforms are kept.',
    hint: 'Download size stays small; GPU vertex memory is that of an unquantized export.',
  }),
  Object.freeze({
    name: 'EXT_texture_webp',
    kind: 'image-compression' as const,
    status: 'supported' as const,
    message: 'A texture loads its WebP image when the device decodes it, else its fallback source.',
    hint: 'ModelLibrary asks the device first; keep a PNG/JPEG fallback for hosts without WebP.',
  }),
  Object.freeze({
    name: 'EXT_texture_avif',
    kind: 'image-compression' as const,
    status: 'supported' as const,
    message:
      'A texture loads its AVIF image when the device decodes it (preferred over WebP), else its fallback.',
    hint: 'AVIF decoding varies by device: keep a PNG/JPEG or WebP fallback (optional extension).',
  }),
  Object.freeze({
    name: 'KHR_texture_basisu',
    kind: 'image-compression' as const,
    status: 'unsupported' as const,
    message: 'No pinned KTX2/Basis decoder and device upload contract is shipped in this release.',
    hint: 'Use ordinary embedded images until the format gate passes on target devices.',
  }),
]);
const extensionNames = [
  'KHR_materials_anisotropy',
  'KHR_materials_clearcoat',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_iridescence',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_volume',
  'KHR_texture_transform',
  'KHR_mesh_quantization',
  'EXT_texture_webp',
  'EXT_texture_avif',
  'KHR_lights_punctual',
] as const;
const engineExtensions: readonly string[] = [
  'KHR_mesh_quantization',
  'EXT_texture_webp',
  'EXT_texture_avif',
  'KHR_lights_punctual',
];
// Read by a registered decoder before the native parser, never by the parser.
const decoderExtensions: readonly string[] = ['EXT_meshopt_compression', 'KHR_meshopt_compression'];
export const gltfExtensionCapabilities: readonly GltfExtensionCapability[] = Object.freeze(
  extensionNames.map((name) =>
    Object.freeze({
      name,
      implementation: engineExtensions.includes(name) ? ('engine' as const) : ('native' as const),
      requiredRenderInputs: Object.freeze(
        name === 'KHR_materials_transmission' ? ['opaqueColor' as const] : [],
      ),
      visualConformance: 'not-certified' as const,
    }),
  ),
);
/** Options for a compatibility inspection. */
export interface GltfInspectOptions {
  /** This device's WebP/AVIF decoding (`probeZhudaImageDecode`). Without it no device answer is assumed. */
  imageDecode?: ZhudaImageDecodeSupport;
}
export interface ModelSourceInventory {
  /** Source complexity only; this does not predict native/GPU upload time. */
  summary: {
    nodes: number;
    meshes: number;
    primitives: number;
    vertices: number;
    indices: number;
    triangles: number;
    materials: number;
    textures: number;
    images: number;
    animations: number;
  };
  nodes: readonly {
    index: number;
    name: string;
    mesh: number | null;
    skin: number | null;
    children: readonly number[];
    morphWeights: readonly number[];
    /** glTF camera index, or null. */
    camera: number | null;
    /** `KHR_lights_punctual` light index, or null. */
    light: number | null;
  }[];
  meshes: readonly {
    index: number;
    name: string;
    primitives: readonly {
      mode: number;
      vertices: number;
      indices: number;
      triangles: number | null;
      material: number | null;
      morphTargets: number;
      attributes: readonly string[];
    }[];
  }[];
  materials: readonly {
    index: number;
    name: string;
    alphaMode: string;
    doubleSided: boolean;
    baseColor: readonly number[];
    metallic: number;
    roughness: number;
    extensions: readonly string[];
    textures: readonly {
      slot: string;
      texture: number;
      texCoord: number;
      colorSpace: 'srgb' | 'linear';
    }[];
  }[];
  textures: readonly {
    index: number;
    /** The core `source` image (the fallback when an extension image is offered). */
    image: number | null;
    sampler: number | null;
    /** `EXT_texture_webp` / `EXT_texture_avif` images, or null. */
    webp: number | null;
    avif: number | null;
  }[];
  images: readonly {
    index: number;
    name: string;
    delivery: 'embedded' | 'external';
    mimeType: string | null;
  }[];
  animations: readonly {
    index: number;
    name: string;
    channels: readonly {
      node: number | null;
      path: string;
      interpolation: string;
    }[];
  }[];
}
export interface ModelCompatibilityReport {
  schemaVersion: 1;
  status: 'supported' | 'conditional' | 'degraded' | 'unsupported';
  /** Known importer gates only. Does not replace Khronos Validator or pixel acceptance. */
  validationScope: 'importer-capabilities';
  extensions: readonly { name: string; required: boolean; implemented: boolean }[];
  requiredRenderInputs: readonly 'opaqueColor'[];
  diagnostics: readonly ModelDiagnostic[];
  inventory: ModelSourceInventory;
}
type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as RecordValue) : {};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const records = (v: unknown): RecordValue[] => list(v).map(record);
const numeric = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const indexOf = (v: unknown): number | null =>
  Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null;
const label = (v: unknown): string => (typeof v === 'string' ? v : '');
const numbers = (v: unknown): number[] => list(v).map((x) => numeric(x));
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function inventory(d: RecordValue): ModelSourceInventory {
  const meshes = records(d.meshes),
    accessors = records(d.accessors);
  const nodes = records(d.nodes).map((n, index) => ({
      index,
      name: label(n.name),
      mesh: indexOf(n.mesh),
      skin: indexOf(n.skin),
      children: numbers(n.children),
      morphWeights: numbers(n.weights ?? meshes[indexOf(n.mesh) ?? -1]?.weights),
      camera: indexOf(n.camera),
      light: indexOf(record(record(n.extensions).KHR_lights_punctual).light),
    })),
    meshInventory = meshes.map((m, index) => ({
      index,
      name: label(m.name),
      primitives: records(m.primitives).map((p) => {
        const attributes = record(p.attributes),
          vertices = numeric(accessors[indexOf(attributes.POSITION) ?? -1]?.count);
        const indices =
          p.indices === undefined ? vertices : numeric(accessors[indexOf(p.indices) ?? -1]?.count);
        const mode = numeric(p.mode, 4);
        return {
          mode,
          vertices,
          indices,
          triangles:
            mode === 4 ? indices / 3 : mode === 5 || mode === 6 ? Math.max(0, indices - 2) : null,
          material: indexOf(p.material),
          morphTargets: list(p.targets).length,
          attributes: Object.keys(attributes),
        };
      }),
    })),
    materials = records(d.materials).map((m, index) => {
      const pbr = record(m.pbrMetallicRoughness),
        textures: {
          slot: string;
          texture: number;
          texCoord: number;
          colorSpace: 'srgb' | 'linear';
        }[] = [];
      const add = (slot: string, v: unknown, colorSpace: 'srgb' | 'linear') => {
        const info = record(v),
          texture = indexOf(info.index);
        if (texture !== null)
          textures.push({
            slot,
            texture,
            texCoord: numeric(
              record(record(info.extensions).KHR_texture_transform).texCoord,
              numeric(info.texCoord),
            ),
            colorSpace,
          });
      };
      add('baseColor', pbr.baseColorTexture, 'srgb');
      add('metallicRoughness', pbr.metallicRoughnessTexture, 'linear');
      add('normal', m.normalTexture, 'linear');
      add('occlusion', m.occlusionTexture, 'linear');
      add('emissive', m.emissiveTexture, 'srgb');
      for (const [extension, value] of Object.entries(record(m.extensions)))
        for (const [name, texture] of Object.entries(record(value)))
          if (name.endsWith('Texture'))
            add(
              `${extension}.${name}`,
              texture,
              name === 'sheenColorTexture' || name === 'specularColorTexture' ? 'srgb' : 'linear',
            );
      return {
        index,
        name: label(m.name),
        alphaMode: label(m.alphaMode) || 'OPAQUE',
        doubleSided: m.doubleSided === true,
        baseColor: pbr.baseColorFactor === undefined ? [1, 1, 1, 1] : numbers(pbr.baseColorFactor),
        metallic: numeric(pbr.metallicFactor, 1),
        roughness: numeric(pbr.roughnessFactor, 1),
        extensions: Object.keys(record(m.extensions)),
        textures,
      };
    }),
    textures = records(d.textures).map((t, index) => ({
      index,
      image: indexOf(t.source),
      sampler: indexOf(t.sampler),
      webp: indexOf(record(record(t.extensions).EXT_texture_webp).source),
      avif: indexOf(record(record(t.extensions).EXT_texture_avif).source),
    })),
    images: {
      index: number;
      name: string;
      delivery: 'embedded' | 'external';
      mimeType: string | null;
    }[] = records(d.images).map((i, index) => ({
      index,
      name: label(i.name),
      delivery: (typeof i.uri === 'string' && !i.uri.startsWith('data:')
        ? 'external'
        : 'embedded') as 'embedded' | 'external',
      mimeType: typeof i.mimeType === 'string' ? i.mimeType : null,
    })),
    animations = records(d.animations).map((a, index) => ({
      index,
      name: label(a.name),
      channels: records(a.channels).map((c) => {
        const target = record(c.target),
          sampler = records(a.samplers)[indexOf(c.sampler) ?? -1];
        return {
          node: indexOf(target.node),
          path: label(target.path),
          interpolation: label(sampler?.interpolation) || 'LINEAR',
        };
      }),
    }));
  const primitives = meshInventory.flatMap((mesh) => mesh.primitives);
  return {
    summary: {
      nodes: nodes.length,
      meshes: meshInventory.length,
      primitives: primitives.length,
      vertices: primitives.reduce((sum, primitive) => sum + primitive.vertices, 0),
      indices: primitives.reduce((sum, primitive) => sum + primitive.indices, 0),
      triangles: primitives.reduce((sum, primitive) => sum + (primitive.triangles ?? 0), 0),
      materials: materials.length,
      textures: textures.length,
      images: images.length,
      animations: animations.length,
    },
    nodes,
    meshes: meshInventory,
    materials,
    textures,
    images,
    animations,
  };
}
export function inspectGltfDocument(
  document: unknown,
  options: GltfInspectOptions = {},
): ModelCompatibilityReport {
  const d = record(document),
    diagnostics: ModelDiagnostic[] = [];
  const add = (issue: ModelDiagnostic) => diagnostics.push(issue);
  if (record(d.asset).version !== '2.0')
    add({
      code: 'INVALID_DOCUMENT',
      severity: 'error',
      path: '$.asset.version',
      message: 'Expected a glTF 2.0 document.',
      hint: 'Export glTF 2.0 / GLB and run Khronos Validator.',
    });
  if (record(d.asset).minVersion !== undefined && record(d.asset).minVersion !== '2.0')
    add({
      code: 'INVALID_DOCUMENT',
      severity: 'error',
      path: '$.asset.minVersion',
      message: 'The minimum glTF version is not supported.',
      hint: 'Export for the shipped glTF 2.0 importer.',
    });
  const extensionList = (key: string): string[] => {
    const value = d[key];
    if (value === undefined) return [];
    if (
      !Array.isArray(value) ||
      value.some((x) => typeof x !== 'string' || !x) ||
      new Set(value).size !== value.length
    ) {
      add({
        code: 'INVALID_EXTENSION_DECLARATION',
        severity: 'error',
        path: `$.${key}`,
        message: 'Extensions must be a unique array of nonempty names.',
        hint: 'Repair the exported extension declaration.',
      });
      return [];
    }
    return value as string[];
  };
  const used = extensionList('extensionsUsed'),
    required = extensionList('extensionsRequired');
  for (const [i, name] of required.entries())
    if (!used.includes(name))
      add({
        code: 'INVALID_EXTENSION_DECLARATION',
        severity: 'error',
        extension: name,
        path: `$.extensionsRequired[${i}]`,
        message: 'Required extension is missing from extensionsUsed.',
        hint: 'Declare every required extension in both arrays.',
      });
  const seen = new WeakSet<object>();
  const collect = (v: unknown, path: string) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    for (const [key, child] of Object.entries(v)) {
      if (key === 'extras') continue;
      if (key === 'extensions')
        for (const name of Object.keys(record(child)))
          if (!used.includes(name))
            add({
              code: 'UNDECLARED_EXTENSION',
              severity: 'error',
              extension: name,
              path: `${path}.extensions.${name}`,
              message: 'Extension payload is not declared in extensionsUsed.',
              hint: 'Repair the export; missing declarations can silently omit a material feature.',
            });
      collect(child, `${path}.${key}`);
    }
  };
  collect(d, '$');
  const extensions = [...new Set([...used, ...required])].map((name) => ({
    name,
    required: required.includes(name),
    implemented: extensionNames.includes(name as (typeof extensionNames)[number]),
  }));
  for (const e of extensions)
    if (decoderExtensions.includes(e.name))
      add({
        code: 'DECODER_REQUIRED',
        severity: e.required ? 'error' : 'warning',
        extension: e.name,
        path: `$.${e.required ? 'extensionsRequired' : 'extensionsUsed'}[${(e.required ? required : used).indexOf(e.name)}]`,
        message: `${e.name} data is read only by a registered Meshopt decoder, before native parsing.`,
        hint: 'Register ZhudaMeshoptModelDecoder with a ZhudaModelDecoderRegistry and pass it with a provider to ZhudaModelLibrary.',
      });
    else if (!e.implemented)
      add({
        code: e.required ? 'UNSUPPORTED_REQUIRED_EXTENSION' : 'UNSUPPORTED_OPTIONAL_EXTENSION',
        severity: e.required ? 'error' : 'warning',
        extension: e.name,
        path: `$.${e.required ? 'extensionsRequired' : 'extensionsUsed'}[${(e.required ? required : used).indexOf(e.name)}]`,
        message: `The shipped importer does not implement ${e.name}.`,
        hint: e.required
          ? 'Export a supported representation. Do not remove required declarations to force acceptance.'
          : 'The fallback may omit this feature; inspect the result and record the accepted downgrade.',
      });
  const needsOpaque = used.includes('KHR_materials_transmission');
  if (needsOpaque)
    add({
      code: 'REQUIRED_RENDER_INPUT',
      severity: 'warning',
      extension: 'KHR_materials_transmission',
      path: '$.extensionsUsed',
      message: 'Transmission requires the camera opaque-color pass.',
      hint: 'Use configureSurfacePasses or a showcase mode with opaqueColor enabled, then verify transparent materials.',
    });
  // Integer vertex attributes: LayaAir copies them into floats unscaled.
  try {
    const quantized = quantizedZhudaGltfAccessors(d),
      external = quantized.length ? externalZhudaGltfBuffers(d) : [];
    if (external.length)
      add({
        code: 'EMBEDDED_BUFFER_REQUIRED',
        severity: 'error',
        ...(used.includes('KHR_mesh_quantization') ? { extension: 'KHR_mesh_quantization' } : {}),
        path: `$.buffers[${external[0]}].uri`,
        message: `${quantized.length} integer vertex attribute accessor(s) must become floats before native parsing, and buffers[${external.join(', ')}] ${external.length > 1 ? 'are' : 'is'} outside the file: there are no bytes to convert.`,
        hint: 'Pack the model as a self-contained GLB (or embed its buffers), or export float vertex attributes.',
      });
    else if (quantized.length) {
      const accessors = records(d.accessors);
      const floats = quantized.reduce(
        (sum, i) =>
          sum +
          numeric(accessors[i].count) *
            ({ VEC2: 2, VEC3: 3, VEC4: 4 }[label(accessors[i].type)] ?? 0) *
            4,
        0,
      );
      add({
        code: 'DEQUANTIZED_ATTRIBUTES',
        severity: 'warning',
        ...(used.includes('KHR_mesh_quantization') ? { extension: 'KHR_mesh_quantization' } : {}),
        path: `$.accessors[${quantized[0]}]`,
        message: `${quantized.length} integer vertex attribute accessor(s) become ${floats} bytes of 32-bit floats before native parsing.`,
        hint: 'Download size stays small; GPU vertex memory is that of an unquantized export.',
      });
    }
  } catch (error) {
    add({
      code: 'INVALID_DOCUMENT',
      severity: 'error',
      path: '$.meshes',
      message: error instanceof Error ? error.message : 'Invalid vertex attribute.',
      hint: 'Repair the export; run Khronos Validator.',
    });
  }
  // WebP and AVIF texture sources, against this device when it was asked.
  records(d.textures).forEach((texture, i) => {
    const source = resolveZhudaGltfTextureSource(texture, options.imageDecode);
    const offered = ['EXT_texture_avif', 'EXT_texture_webp'].filter(
      (name) => indexOf(record(record(record(texture).extensions)[name]).source) !== null,
    );
    if (!offered.length) return;
    if (options.imageDecode && source.extension === null) {
      // No answer from a decoder is not a no: say which it was.
      const silent = source.unavailable.filter((name) =>
        options.imageDecode!.unanswered?.includes(name === 'EXT_texture_avif' ? 'avif' : 'webp'),
      );
      const outcome =
        source.image === null
          ? 'the texture has no fallback source'
          : `the fallback image ${source.image} loads`;
      add(
        silent.length
          ? {
              code: 'IMAGE_DECODE_UNANSWERED',
              severity: source.image === null ? 'error' : 'warning',
              extension: silent[0],
              path: `$.textures[${i}]`,
              message: `This device's decoder gave no answer for ${silent.join(' or ')} in time; ${outcome}.`,
              hint: 'Load the model again: probeZhudaImageDecode asks an unanswered decoder again on its next call.',
            }
          : {
              code: 'IMAGE_DECODE_UNAVAILABLE',
              severity: source.image === null ? 'error' : 'warning',
              extension: source.unavailable[0],
              path: `$.textures[${i}]`,
              message:
                source.image === null
                  ? `This device cannot decode ${source.unavailable.join(' or ')} and ${outcome}.`
                  : `This device cannot decode ${source.unavailable.join(' or ')}; ${outcome}.`,
              hint: 'Keep a PNG/JPEG fallback source and leave the extension optional for devices without the format.',
            },
      );
    } else if (!options.imageDecode && indexOf(record(texture).source) === null)
      add({
        code: 'IMAGE_DECODE_UNCHECKED',
        severity: 'warning',
        extension: offered[0],
        path: `$.textures[${i}]`,
        message: `The texture has only a ${offered.join('/')} image; whether a device decodes it was not checked.`,
        hint: 'ZhudaModelLibrary asks the device before parsing; pass imageDecode from probeZhudaImageDecode to check here.',
      });
  });
  const lightProblems = readZhudaGltfLights(d);
  for (const problem of lightProblems.problems)
    add({
      code: 'INVALID_LIGHT',
      severity: 'warning',
      extension: 'KHR_lights_punctual',
      path: `$.extensions.KHR_lights_punctual.lights[${problem.index}]`,
      message: `Light ${problem.index}: ${problem.message}; it is not created.`,
      hint: 'Repair the export; the other lights still load.',
    });
  lightProblems.lights.forEach((light, i) => {
    if (!light || light.type === 'directional') return;
    add({
      code: 'LIGHT_APPROXIMATED',
      severity: 'warning',
      extension: 'KHR_lights_punctual',
      path: `$.extensions.KHR_lights_punctual.lights[${i}]`,
      message:
        `A ${light.type} light falls off along LayaAir's range curve, not the inverse square` +
        (light.range === null ? '; its range is derived from its intensity' : '') +
        (light.type === 'spot' ? "; the cone's inner edge is fixed at half its outer angle" : '') +
        '.',
      hint: 'See zhudaGltfLightToLaya for the mapping; lights are created only when instantiate asks for them.',
    });
  });
  const cameraProblems = readZhudaGltfCameras(d);
  for (const problem of cameraProblems.problems)
    add({
      code: 'INVALID_CAMERA',
      severity: 'warning',
      path: `$.cameras[${problem.index}]`,
      message: `Camera ${problem.index}: ${problem.message}; it is not attached.`,
      hint: 'Repair the export; nodes and other cameras still load.',
    });
  // A node that names a light or camera the file does not have. (One that names
  // an invalid light or camera is covered by that entry's own diagnostic.)
  records(d.nodes).forEach((node, i) => {
    const punctual = record(node.extensions).KHR_lights_punctual;
    if (
      punctual !== undefined &&
      lightProblems.lights[indexOf(record(punctual).light) ?? -1] === undefined
    )
      add({
        code: 'INVALID_LIGHT',
        severity: 'warning',
        extension: 'KHR_lights_punctual',
        path: `$.nodes[${i}].extensions.KHR_lights_punctual.light`,
        message: `Node ${i} names light ${JSON.stringify(record(punctual).light) ?? 'none'}, which the file does not have; no light is created on it.`,
        hint: 'Repair the export; the other lights still load.',
      });
    if (
      node.camera !== undefined &&
      cameraProblems.cameras[indexOf(node.camera) ?? -1] === undefined
    )
      add({
        code: 'INVALID_CAMERA',
        severity: 'warning',
        path: `$.nodes[${i}].camera`,
        message: `Node ${i} names camera ${JSON.stringify(node.camera)}, which the file does not have; none is attached.`,
        hint: 'Repair the export; nodes and other cameras still load.',
      });
  });
  const meshes = records(d.meshes);
  const checkWeights = (v: unknown, count: number, path: string) => {
    if (
      v !== undefined &&
      (!Array.isArray(v) ||
        v.length !== count ||
        v.some((x) => typeof x !== 'number' || !Number.isFinite(x)))
    )
      add({
        code: 'INVALID_MORPH_WEIGHTS',
        severity: 'error',
        path,
        message: 'Morph weights must be finite and match the mesh target count.',
        hint: 'Fix the exporter; node weights override mesh weights and are not clamped.',
      });
  };
  meshes.forEach((m, i) =>
    checkWeights(
      m.weights,
      list(records(m.primitives)[0]?.targets).length,
      `$.meshes[${i}].weights`,
    ),
  );
  records(d.nodes).forEach((n, i) =>
    checkWeights(
      n.weights,
      list(records(meshes[indexOf(n.mesh) ?? -1]?.primitives)[0]?.targets).length,
      `$.nodes[${i}].weights`,
    ),
  );
  return freeze({
    schemaVersion: 1,
    status: statusOf(diagnostics, needsOpaque),
    validationScope: 'importer-capabilities',
    extensions,
    requiredRenderInputs: needsOpaque ? ['opaqueColor'] : [],
    diagnostics,
    inventory: inventory(d),
  });
}
// A feature the file offers that will not reach the screen.
const lost: readonly ModelDiagnostic['code'][] = [
  'UNSUPPORTED_OPTIONAL_EXTENSION',
  'DECODER_REQUIRED',
  'IMAGE_DECODE_UNAVAILABLE',
  'IMAGE_DECODE_UNANSWERED',
  'IMAGE_DECODE_FAILED',
  'INVALID_LIGHT',
  'INVALID_CAMERA',
];
function statusOf(
  diagnostics: readonly ModelDiagnostic[],
  needsOpaque: boolean,
): ModelCompatibilityReport['status'] {
  return diagnostics.some((x) => x.severity === 'error')
    ? 'unsupported'
    : diagnostics.some((x) => lost.includes(x.code))
      ? 'degraded'
      : needsOpaque
        ? 'conditional'
        : 'supported';
}
/** Internal: a report with what loading the file found added to it. */
export function addModelDiagnostics(
  report: ModelCompatibilityReport,
  found: readonly ModelDiagnostic[],
): ModelCompatibilityReport {
  if (!found.length) return report;
  const diagnostics = [...report.diagnostics, ...found];
  return freeze({
    ...report,
    status: statusOf(diagnostics, report.requiredRenderInputs.includes('opaqueColor')),
    diagnostics,
  });
}
export class ZhudaModelCompatibilityError extends Error {
  readonly report: ModelCompatibilityReport;
  readonly assetId?: string;
  constructor(report: ModelCompatibilityReport, assetId?: string) {
    super(
      report.diagnostics
        .filter((x) => x.severity === 'error')
        .map((x) => `${x.code} ${x.path}: ${x.message}`)
        .join('; '),
    );
    this.name = 'ZhudaModelCompatibilityError';
    this.report = report;
    this.assetId = assetId;
  }
}
/** Internal shared decode seam. No fetching or native resource allocation. */
export function readGltfAssetDocument(input: ArrayBuffer | Uint8Array): {
  binary: boolean;
  document: RecordValue;
} {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const binary = bytes.byteLength >= 12 && view.getUint32(0, true) === 0x46546c67;
  let json = bytes;
  if (binary) {
    if (
      bytes.byteLength < 20 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== bytes.byteLength ||
      view.getUint32(16, true) !== 0x4e4f534a ||
      view.getUint32(12, true) > bytes.byteLength - 20
    )
      throw Error('Invalid GLB header or JSON chunk');
    json = bytes.subarray(20, 20 + view.getUint32(12, true));
  }
  return { binary, document: record(JSON.parse(new TextDecoder().decode(json))) };
}
export function inspectGltfAsset(
  bytes: ArrayBuffer | Uint8Array,
  options: GltfInspectOptions = {},
): ModelCompatibilityReport {
  try {
    return inspectGltfDocument(readGltfAssetDocument(bytes).document, options);
  } catch (error) {
    const base = inspectGltfDocument({});
    return freeze({
      ...base,
      diagnostics: [
        {
          code: 'INVALID_DOCUMENT',
          severity: 'error',
          path: '$',
          message: error instanceof Error ? error.message : 'Invalid model bytes.',
          hint: 'Verify the glTF JSON / GLB container and run Khronos Validator.',
        },
      ],
    });
  }
}
