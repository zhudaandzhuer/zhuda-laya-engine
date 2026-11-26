// A glTF 2.0 binary (.glb) writer for skinned, animated models: one skinned mesh (several
// primitives, each with its own material), a skeleton of joints, and animation clips.
//
//   writeRiggedGlb({ name, joints, primitives, materials, animations, partNames? })
//
// joints: [{ name, parent (index or -1), position: [x, y, z] }]   bind pose, world positions.
//   Joints are not turned in the bind pose, so a joint's local frame is the world's: a clip
//   turns a joint about the world's axes at its position (x across the body, y up, z forward).
//   The parent of a joint comes before it.
// primitives: [{ positions, normals, colors?, joints (Uint8Array, 4 a vertex), weights
//   (Float32Array, 4 a vertex, summing to 1), indices (Uint32Array, counter-clockwise from
//   outside), material }]
// materials: [{ name, color (linear RGBA), metallic, roughness, emissive (linear, may pass 1),
//   doubleSided?, alphaMode? ('MASK' | 'BLEND'), alphaCutoff? }]
// animations: [{ name, times: Float32Array, channels: [{ joint, path: 'rotation' | 'translation',
//   values: Float32Array }] }]   rotation values are quaternions (x, y, z, w).
// For textured models (tools/beasts/hd): a primitive may carry `uvs` (TEXCOORD_0, 2 a vertex)
// and `tangents` (TANGENT, 4 a vertex, w the handedness); `images` are [{ mime, bytes }] stored
// in the binary chunk; a material's `textures` names images by index: { baseColor, normal,
// occlusion, metallicRoughness, emissive } (occlusion and metallicRoughness may be one image:
// R occlusion, G roughness, B metalness, as glTF reads them).
//
// Every primitive is a mesh of its own, on a node of its own, all sharing the one skin. (In one
// skinned mesh of several primitives, a primitive whose vertex attributes differ from the first
// one's is not drawn by this engine: the glowing parts have no COLOR_0 and the body has. Report
// SCN-15; review-evidence/own/repro/SCN-15-primitives-with-different-attributes.mjs.) The scene
// holds those nodes and the root joint side by side, as the engine's own skinned fixture does
// (scripts/lib/film-fixtures.mjs); a joint's node carries its translation from its parent, and
// the inverse bind matrices undo the joints' world positions.

// `sampler` replaces how the textures are sampled (a palette texture wants NEAREST and no mipmaps, so that
// its colours do not bleed into each other); `generator` replaces asset.generator.
export function writeRiggedGlb({ name, joints, primitives, materials, animations = [], images = [], partNames, sampler, generator }) {
  const chunks = [];
  let byteLength = 0;
  const bufferViews = [];
  const accessors = [];
  const view = (array, target) => {
    const padding = (4 - (byteLength % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      byteLength += padding;
    }
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, ...(target ? { target } : {}) });
    chunks.push(bytes);
    byteLength += bytes.length;
    return bufferViews.length - 1;
  };
  const accessor = (array, type, componentType, { target, bounds = false, normalized = false } = {}) => {
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const entry = { bufferView: view(array, target), componentType, count: array.length / n, type };
    if (normalized) entry.normalized = true;
    if (bounds) {
      const min = Array(n).fill(Infinity),
        max = Array(n).fill(-Infinity);
      for (let i = 0; i < array.length; i += n)
        for (let a = 0; a < n; a++) {
          if (array[i + a] < min[a]) min[a] = array[i + a];
          if (array[i + a] > max[a]) max[a] = array[i + a];
        }
      entry.min = min.map((v) => Math.fround(v));
      entry.max = max.map((v) => Math.fround(v));
    }
    accessors.push(entry);
    return accessors.length - 1;
  };

  // Nodes: the joints first (joint j is node j + 1, node 0 the body), then the other parts.
  const P = primitives.length;
  // `partNames`: a name for each primitive's node, for a model whose parts are found by name.
  const partName = (i) => partNames?.[i] ?? (i === 0 ? name : `${name}-${materials[primitives[i].material]?.name?.replace(`${name}-`, '') ?? 'part' + i}`);
  const nodes = [{ name: partName(0), mesh: 0, skin: 0 }];
  for (const [j, joint] of joints.entries()) {
    const parent = joint.parent >= 0 ? joints[joint.parent].position : [0, 0, 0];
    const t = joint.position.map((v, a) => v - parent[a]);
    nodes.push({ name: joint.name, ...(t.some((v) => Math.abs(v) > 1e-9) ? { translation: t } : {}) });
  }
  for (const [j, joint] of joints.entries())
    if (joint.parent >= 0) (nodes[joint.parent + 1].children ??= []).push(j + 1);
  const roots = joints.map((joint, j) => (joint.parent < 0 ? j + 1 : -1)).filter((i) => i >= 0);
  if (roots.length !== 1) throw Error(`${name}: a skeleton needs one root joint, found ${roots.length}`);
  const partNodes = [0];
  for (let i = 1; i < P; i++) {
    nodes.push({ name: partName(i), mesh: i, skin: 0 });
    partNodes.push(nodes.length - 1);
  }

  const inverseBind = new Float32Array(joints.length * 16);
  for (const [j, joint] of joints.entries()) {
    const m = j * 16;
    inverseBind[m] = inverseBind[m + 5] = inverseBind[m + 10] = inverseBind[m + 15] = 1;
    inverseBind[m + 12] = -joint.position[0];
    inverseBind[m + 13] = -joint.position[1];
    inverseBind[m + 14] = -joint.position[2];
  }

  const jsonPrimitives = primitives.map((p) => {
    const attributes = {
      POSITION: accessor(p.positions, 'VEC3', 5126, { target: 34962, bounds: true }),
      NORMAL: accessor(p.normals, 'VEC3', 5126, { target: 34962 }),
      JOINTS_0: accessor(p.joints, 'VEC4', p.joints instanceof Uint16Array ? 5123 : 5121, { target: 34962 }),
      WEIGHTS_0: accessor(p.weights, 'VEC4', 5126, { target: 34962 }),
    };
    if (p.colors) attributes.COLOR_0 = accessor(p.colors, 'VEC4', 5126, { target: 34962 });
    if (p.uvs) attributes.TEXCOORD_0 = accessor(p.uvs, 'VEC2', 5126, { target: 34962 });
    if (p.tangents) attributes.TANGENT = accessor(p.tangents, 'VEC4', 5126, { target: 34962 });
    const indices = accessor(p.indices, 'SCALAR', p.indices instanceof Uint16Array ? 5123 : 5125, { target: 34963 });
    return { attributes, indices, material: p.material, mode: 4 };
  });
  const skin = { name: `${name}-skeleton`, joints: joints.map((_, j) => j + 1), skeleton: roots[0], inverseBindMatrices: accessor(inverseBind, 'MAT4', 5126) };

  const jsonAnimations = animations.map((clip) => {
    const input = accessor(clip.times, 'SCALAR', 5126, { bounds: true });
    const samplers = [],
      channels = [];
    for (const channel of clip.channels) {
      const output = accessor(channel.values, channel.path === 'rotation' ? 'VEC4' : 'VEC3', 5126);
      samplers.push({ input, output, interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: channel.joint + 1, path: channel.path } });
    }
    return { name: clip.name, samplers, channels };
  });

  // Images in the binary chunk, one texture (with one shared sampler) for each.
  const jsonImages = images.map((img, i) => ({ name: img.name ?? `image${i}`, mimeType: img.mime, bufferView: view(new Uint8Array(img.bytes.buffer, img.bytes.byteOffset, img.bytes.byteLength)) }));
  const textureOf = (image) => {
    if (image === undefined || !jsonImages[image]) throw Error(`${name}: a material names a missing image ${image}`);
    return image;
  };
  const jsonMaterials = materials.map((m) => {
    const out = {
      name: m.name,
      pbrMetallicRoughness: {
        baseColorFactor: m.color ?? [1, 1, 1, 1],
        metallicFactor: m.metallic ?? 0,
        roughnessFactor: m.roughness ?? 0.7,
      },
    };
    if (m.emissive) {
      const peak = Math.max(...m.emissive);
      if (peak > 1) {
        out.emissiveFactor = m.emissive.map((v) => v / peak);
        out.extensions = { KHR_materials_emissive_strength: { emissiveStrength: peak } };
      } else out.emissiveFactor = m.emissive;
    }
    if (m.doubleSided) out.doubleSided = true;
    // Cut-out (hair cards, leaves): drawn where the base colour's alpha passes alphaCutoff.
    if (m.alphaMode && m.alphaMode !== 'OPAQUE') {
      out.alphaMode = m.alphaMode;
      if (m.alphaMode === 'MASK') out.alphaCutoff = m.alphaCutoff ?? 0.5;
    }
    const tex = m.textures ?? {};
    const ref = (k) => ({ index: textureOf(tex[k]) });
    if (tex.baseColor !== undefined) out.pbrMetallicRoughness.baseColorTexture = ref('baseColor');
    if (tex.metallicRoughness !== undefined) out.pbrMetallicRoughness.metallicRoughnessTexture = ref('metallicRoughness');
    if (tex.normal !== undefined) out.normalTexture = { ...ref('normal'), ...(m.normalScale !== undefined ? { scale: m.normalScale } : {}) };
    if (tex.occlusion !== undefined) out.occlusionTexture = { ...ref('occlusion'), ...(m.occlusionStrength !== undefined ? { strength: m.occlusionStrength } : {}) };
    if (tex.emissive !== undefined) {
      out.emissiveTexture = ref('emissive');
      out.emissiveFactor ??= [1, 1, 1];
    }
    return out;
  });
  const usesStrength = jsonMaterials.some((m) => m.extensions);

  const json = {
    asset: { version: '2.0', generator: generator ?? 'zhuda-epic-scenes tools/beasts' },
    ...(usesStrength ? { extensionsUsed: ['KHR_materials_emissive_strength'] } : {}),
    scene: 0,
    scenes: [{ name, nodes: [...partNodes, roots[0]] }],
    nodes,
    meshes: jsonPrimitives.map((primitive, i) => ({ name: partName(i), primitives: [primitive] })),
    skins: [skin],
    materials: jsonMaterials,
    ...(jsonImages.length
      ? {
          // Trilinear, repeating: the charts sit inside the image with padding of their own.
          samplers: [sampler ?? { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
          images: jsonImages,
          textures: jsonImages.map((_, i) => ({ sampler: 0, source: i })),
        }
      : {}),
    ...(jsonAnimations.length ? { animations: jsonAnimations } : {}),
    buffers: [{ byteLength }],
    bufferViews,
    accessors,
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  let bin = Buffer.concat(chunks);
  bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(data.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, data]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, text), chunk(0x004e4942, bin)]);
}
