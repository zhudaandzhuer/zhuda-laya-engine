// Generated glTF fixtures for the rest of the intake work
// (tests/gltf-instancing.test.mjs and scripts/verify-gltf-instancing.mjs):
// a mesh drawn many times by EXT_mesh_gpu_instancing, and a plate whose
// occlusion and emissive textures are laid out on TEXCOORD_1.
import { writeGlb } from '../../packages/compiler/model-lod.mjs';
import { pack } from './gltf-intake.mjs';

/** A box with a normal and a texture coordinate a corner of each face. */
export function crate(size = 0.4) {
  const h = size / 2;
  const faces = [
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
    ],
    [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ],
    [
      [0, -1, 0],
      [0, 0, -1],
      [1, 0, 0],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [-1, 0, 0],
      [0, 1, 0],
    ],
  ];
  const positions = [],
    normals = [],
    uvs = [],
    indices = [];
  faces.forEach(([n, a, b], f) => {
    for (const [s, t] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      positions.push(...n.map((v, k) => (v + a[k] * s + b[k] * t) * h));
      normals.push(...n);
      uvs.push((s + 1) / 2, (t + 1) / 2);
    }
    // Counter-clockwise seen from outside: a x b points along n.
    indices.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
  });
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

const quaternion = (axis, degrees) => {
  const half = (degrees * Math.PI) / 360,
    s = Math.sin(half),
    length = Math.hypot(...axis);
  return [(axis[0] / length) * s, (axis[1] / length) * s, (axis[2] / length) * s, Math.cos(half)];
};
const round6 = (value) => Math.round(value * 1e6) / 1e6;

/** Where the crates of the yard stand: the node they hang from, and each copy under it. */
export const YARD = (() => {
  const copies = [];
  for (let i = 0; i < 12; i++) {
    const column = i % 4,
      row = Math.floor(i / 4);
    copies.push({
      translation: [column * 0.9 - 1.35, 0.2 + (i % 3) * 0.15, row * 0.9 - 0.9],
      // Most turn about the upright; every fourth leans.
      rotation: quaternion(i % 4 === 3 ? [1, 0, 0.4] : [0, 1, 0], i * 20).map(round6),
      scale: [0.7 + (i % 5) * 0.15, 0.6 + (i % 3) * 0.3, 0.8 + (i % 2) * 0.4],
    });
  }
  return {
    root: { translation: [0.3, 0, -0.2] },
    node: { translation: [1, 0, 0.5], rotation: quaternion([0, 1, 0], 30).map(round6) },
    marker: { translation: [-2.6, 0.2, 1.4] },
    copies,
  };
})();

/**
 * A yard: a root, under it a node whose crate is drawn twelve times
 * (EXT_mesh_gpu_instancing) and a marker crate drawn once.
 * `rotation: 'short'` stores the turns as normalized shorts. `mirror` gives
 * that copy a scale that turns it inside out. `mismatch` gives the scale
 * one value too few.
 */
export function instancedYard({ rotation = 'float', mirror = null, mismatch = false } = {}) {
  const mesh = crate();
  const copies = YARD.copies.map((copy, i) =>
    i === mirror ? { ...copy, scale: [-copy.scale[0], copy.scale[1], copy.scale[2]] } : copy,
  );
  const translations = new Float32Array(copies.flatMap((copy) => copy.translation));
  const turns = copies.flatMap((copy) => copy.rotation);
  const rotations =
    rotation === 'short'
      ? new Int16Array(turns.map((value) => Math.round(value * 32767)))
      : new Float32Array(turns);
  const scales = new Float32Array(
    copies.slice(0, mismatch ? copies.length - 1 : copies.length).flatMap((copy) => copy.scale),
  );
  const { views, bin } = pack([
    { data: mesh.positions, target: 34962 },
    { data: mesh.normals, target: 34962 },
    { data: mesh.uvs, target: 34962 },
    { data: mesh.indices, target: 34963 },
    { data: translations },
    { data: rotations },
    { data: scales },
  ]);
  const document = {
    asset: { version: '2.0', generator: 'zhuda-laya-engine fixtures' },
    extensionsUsed: ['EXT_mesh_gpu_instancing'],
    extensionsRequired: ['EXT_mesh_gpu_instancing'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Yard', translation: YARD.root.translation, children: [1, 2] },
      {
        name: 'Crates',
        mesh: 0,
        translation: YARD.node.translation,
        rotation: YARD.node.rotation,
        extensions: {
          EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 4, ROTATION: 5, SCALE: 6 } },
        },
      },
      { name: 'Marker', mesh: 1, translation: YARD.marker.translation },
    ],
    meshes: [
      {
        name: 'Crate',
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 },
        ],
      },
      {
        name: 'MarkerCrate',
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 1 },
        ],
      },
    ],
    materials: [
      {
        name: 'Orange',
        pbrMetallicRoughness: {
          baseColorFactor: [0.9, 0.4, 0.08, 1],
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
      {
        name: 'Blue',
        pbrMetallicRoughness: {
          baseColorFactor: [0.1, 0.35, 0.9, 1],
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 24,
        type: 'VEC3',
        min: [-0.2, -0.2, -0.2],
        max: [0.2, 0.2, 0.2],
      },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 24, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
      { bufferView: 4, componentType: 5126, count: copies.length, type: 'VEC3' },
      rotation === 'short'
        ? {
            bufferView: 5,
            componentType: 5122,
            normalized: true,
            count: copies.length,
            type: 'VEC4',
          }
        : { bufferView: 5, componentType: 5126, count: copies.length, type: 'VEC4' },
      {
        bufferView: 6,
        componentType: 5126,
        count: mismatch ? copies.length - 1 : copies.length,
        type: 'VEC3',
      },
    ],
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  };
  return writeGlb(document, bin);
}

/**
 * A sheet two metres square in the ground plane with two sets of texture
 * coordinates: the first runs along x, the second along z. Its occlusion and
 * emissive textures name set `texCoord`. With 0 their halves divide the
 * sheet along x; with 1, along z.
 */
export function twoSetPlate({ occlusionPng, emissivePng, texCoord }) {
  const positions = new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]),
    normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    // The first set: u along +x. The second: u along +z.
    first = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    second = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
    indices = new Uint16Array([0, 2, 1, 0, 3, 2]);
  const { views, bin } = pack([
    { data: positions, target: 34962 },
    { data: normals, target: 34962 },
    { data: first, target: 34962 },
    { data: second, target: 34962 },
    { data: indices, target: 34963 },
    { data: new Uint8Array(occlusionPng) },
    { data: new Uint8Array(emissivePng) },
  ]);
  const reference = (index) => (texCoord ? { index, texCoord } : { index });
  return writeGlb(
    {
      asset: { version: '2.0', generator: 'zhuda-laya-engine fixtures' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: 'Plate', mesh: 0 }],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, TEXCOORD_1: 3 },
              indices: 4,
              material: 0,
            },
          ],
        },
      ],
      materials: [
        {
          name: 'Baked',
          pbrMetallicRoughness: {
            baseColorFactor: [1, 1, 1, 1],
            metallicFactor: 0,
            roughnessFactor: 1,
          },
          occlusionTexture: reference(0),
          emissiveTexture: reference(1),
          emissiveFactor: [1, 1, 1],
        },
      ],
      textures: [{ source: 0 }, { source: 1 }],
      images: [
        { bufferView: 5, mimeType: 'image/png' },
        { bufferView: 6, mimeType: 'image/png' },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 4,
          type: 'VEC3',
          min: [-1, 0, -1],
          max: [1, 0, 1],
        },
        { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
        { bufferView: 3, componentType: 5126, count: 4, type: 'VEC2' },
        { bufferView: 4, componentType: 5123, count: 6, type: 'SCALAR' },
      ],
      bufferViews: views,
      buffers: [{ byteLength: bin.length }],
    },
    bin,
  );
}
