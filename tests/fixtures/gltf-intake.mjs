// Generated glTF fixtures for the intake work (tests/gltf-intake.test.mjs and
// scripts/verify-gltf-intake.mjs). Every file is made here, in code: a plain
// float reference and the same content in the form under test.
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import { writeGlb } from '../../packages/compiler/model-lod.mjs';

/** Packs typed arrays one after another (4-byte aligned) as bufferViews of buffer 0. */
export function pack(parts) {
  const views = [],
    chunks = [];
  let offset = 0;
  for (const part of parts) {
    const bytes = Buffer.from(part.data.buffer, part.data.byteOffset, part.data.byteLength);
    const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length };
    if (part.byteStride) view.byteStride = part.byteStride;
    if (part.target) view.target = part.target;
    views.push(view);
    chunks.push(bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4));
    offset += bytes.length + ((4 - (bytes.length % 4)) % 4);
  }
  return { views, bin: Buffer.concat(chunks) };
}

/** A torus with normals, texture coordinates and 8-bit vertex colours. */
export function torus({ R = 0.62, r = 0.27, segments = 64, sides = 32 } = {}) {
  const positions = [],
    normals = [],
    uvs = [],
    colors = [],
    indices = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments,
      theta = u * Math.PI * 2;
    for (let j = 0; j <= sides; j++) {
      const v = j / sides,
        phi = v * Math.PI * 2;
      const cx = Math.cos(theta),
        sx = Math.sin(theta),
        cp = Math.cos(phi),
        sp = Math.sin(phi);
      positions.push((R + r * cp) * cx, r * sp, (R + r * cp) * sx);
      normals.push(cp * cx, sp, cp * sx);
      uvs.push(u, v);
      // Hue round the ring, on 8-bit steps so an 8-bit encoding can hold it.
      for (const shift of [0, 2.094, 4.189])
        colors.push(Math.round((0.55 + 0.45 * Math.cos(theta + shift)) * 255) / 255);
      colors.push(1);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * row + j,
        b = (i + 1) * row + j;
      indices.push(a, a + 1, b + 1, a, b + 1, b);
    }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices),
  };
}

const minMax = (data, n) => {
  const min = Array(n).fill(Infinity),
    max = Array(n).fill(-Infinity);
  for (let i = 0; i < data.length; i++) {
    min[i % n] = Math.min(min[i % n], data[i]);
    max[i % n] = Math.max(max[i % n], data[i]);
  }
  return { min, max };
};

function texturedMaterial() {
  return {
    name: 'Ring',
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
      metallicFactor: 0,
      roughnessFactor: 0.45,
    },
  };
}

/**
 * The torus as plain floats, and the same torus quantized (KHR_mesh_quantization:
 * 16-bit positions undone by the node's scale and offset, 8-bit normals, 16-bit
 * normalized texture coordinates) and Meshopt-compressed under the ratified
 * name (KHR_meshopt_compression, with the OCTAHEDRAL and COLOR filters).
 */
export async function quantizedTorus(png) {
  await MeshoptEncoder.ready;
  const t = torus(),
    count = t.positions.length / 3;
  const scene = { scene: 0, scenes: [{ nodes: [0] }] };
  const image = { bufferView: 0, mimeType: 'image/png' };
  const common = {
    asset: { version: '2.0', generator: 'zhuda gltf-intake fixture' },
    ...scene,
    materials: [texturedMaterial()],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    images: [image],
  };
  // The plain reference.
  const plain = pack([
    { data: png },
    { data: t.positions, target: 34962 },
    { data: t.normals, target: 34962 },
    { data: t.uvs, target: 34962 },
    { data: t.colors, target: 34962 },
    { data: t.indices, target: 34963 },
  ]);
  const reference = {
    ...common,
    nodes: [
      { name: 'Model', children: [1], rotation: [0.5, 0, 0, 0.8660254] },
      { name: 'Ring', mesh: 0 },
    ],
    meshes: [
      {
        name: 'Ring',
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, COLOR_0: 3 },
            indices: 4,
            material: 0,
          },
        ],
      },
    ],
    accessors: [
      { bufferView: 1, componentType: 5126, count, type: 'VEC3', ...minMax(t.positions, 3) },
      { bufferView: 2, componentType: 5126, count, type: 'VEC3' },
      { bufferView: 3, componentType: 5126, count, type: 'VEC2' },
      { bufferView: 4, componentType: 5126, count, type: 'VEC4' },
      { bufferView: 5, componentType: 5123, count: t.indices.length, type: 'SCALAR' },
    ],
    bufferViews: plain.views,
    buffers: [{ byteLength: plain.bin.length }],
  };

  // Quantized: positions as unsigned 16-bit steps of one uniform scale.
  const { min, max } = minMax(t.positions, 3);
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
    step = extent / 65535;
  const qPositions = new Uint16Array(count * 4);
  for (let i = 0; i < count; i++)
    for (let k = 0; k < 3; k++)
      qPositions[i * 4 + k] = Math.round((t.positions[i * 3 + k] - min[k]) / step);
  const normals4 = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) normals4.set(t.normals.subarray(i * 3, i * 3 + 3), i * 4);
  const qNormals = MeshoptEncoder.encodeFilterOct(normals4, count, 4, 8);
  const qUvs = new Uint16Array(count * 2);
  for (let i = 0; i < t.uvs.length; i++) qUvs[i] = Math.round(t.uvs[i] * 65535);
  const qColors = MeshoptEncoder.encodeFilterColor(t.colors, count, 4, 8);
  const streams = [
    { data: new Uint8Array(qPositions.buffer), stride: 8, mode: 'ATTRIBUTES' },
    { data: qNormals, stride: 4, mode: 'ATTRIBUTES', filter: 'OCTAHEDRAL' },
    { data: new Uint8Array(qUvs.buffer), stride: 4, mode: 'ATTRIBUTES' },
    { data: qColors, stride: 4, mode: 'ATTRIBUTES', filter: 'COLOR' },
  ];
  const compressed = [];
  let fallbackLength = 0;
  for (const s of streams) {
    const bytes = MeshoptEncoder.encodeGltfBuffer(s.data, count, s.stride, s.mode);
    compressed.push({ bytes, ...s });
  }
  const indexBytes = MeshoptEncoder.encodeGltfBuffer(
    new Uint8Array(t.indices.buffer),
    t.indices.length,
    2,
    'TRIANGLES',
  );
  compressed.push({ bytes: indexBytes, stride: 2, mode: 'TRIANGLES', count: t.indices.length });
  // Buffer 0 (the GLB chunk): the picture, then the compressed streams.
  const chunks = [Buffer.from(png), Buffer.alloc((4 - (png.length % 4)) % 4)];
  let offset = png.length + ((4 - (png.length % 4)) % 4);
  const views = [{ buffer: 0, byteOffset: 0, byteLength: png.length }];
  for (const c of compressed) {
    const elements = c.count ?? count,
      length = elements * c.stride;
    views.push({
      buffer: 1,
      byteOffset: fallbackLength,
      byteLength: length,
      ...(c.mode === 'ATTRIBUTES' ? { byteStride: c.stride, target: 34962 } : { target: 34963 }),
      extensions: {
        KHR_meshopt_compression: {
          buffer: 0,
          byteOffset: offset,
          byteLength: c.bytes.length,
          byteStride: c.stride,
          count: elements,
          mode: c.mode,
          ...(c.filter ? { filter: c.filter } : {}),
        },
      },
    });
    fallbackLength += Math.ceil(length / 4) * 4;
    chunks.push(Buffer.from(c.bytes), Buffer.alloc((4 - (c.bytes.length % 4)) % 4));
    offset += c.bytes.length + ((4 - (c.bytes.length % 4)) % 4);
  }
  const bin = Buffer.concat(chunks);
  const quantized = {
    ...common,
    extensionsUsed: ['KHR_mesh_quantization', 'KHR_meshopt_compression'],
    extensionsRequired: ['KHR_mesh_quantization', 'KHR_meshopt_compression'],
    nodes: [
      { name: 'Model', children: [1], rotation: [0.5, 0, 0, 0.8660254] },
      // KHR_mesh_quantization: the node undoes the position quantization.
      { name: 'Ring', mesh: 0, translation: min, scale: [step, step, step] },
    ],
    meshes: reference.meshes,
    accessors: [
      { bufferView: 1, componentType: 5123, count, type: 'VEC3', min: [0, 0, 0], max: [0, 0, 0] },
      { bufferView: 2, componentType: 5120, normalized: true, count, type: 'VEC3' },
      { bufferView: 3, componentType: 5123, normalized: true, count, type: 'VEC2' },
      { bufferView: 4, componentType: 5121, normalized: true, count, type: 'VEC4' },
      { bufferView: 5, componentType: 5123, count: t.indices.length, type: 'SCALAR' },
    ],
    bufferViews: views,
    buffers: [
      { byteLength: bin.length },
      { byteLength: fallbackLength, extensions: { KHR_meshopt_compression: { fallback: true } } },
    ],
  };
  // POSITION's bounds in quantized units, as the extension asks.
  const qMin = [65535, 65535, 65535],
    qMax = [0, 0, 0];
  for (let i = 0; i < count; i++)
    for (let k = 0; k < 3; k++) {
      qMin[k] = Math.min(qMin[k], qPositions[i * 4 + k]);
      qMax[k] = Math.max(qMax[k], qPositions[i * 4 + k]);
    }
  quantized.accessors[0].min = qMin;
  quantized.accessors[0].max = qMax;
  return {
    reference: writeGlb(reference, plain.bin),
    quantized: writeGlb(quantized, bin),
    // The same quantized data stored raw (no Meshopt): for the dequantize pass alone.
    // Filters are Meshopt's: here normals are plain signed bytes, colours plain bytes.
    quantizedRaw: quantizedWithoutMeshopt(quantized, png, {
      positions: qPositions,
      normals: Int8Array.from(normals4, (c) => Math.round(c * 127)),
      uvs: qUvs,
      colors: Uint8Array.from(t.colors, (c) => Math.round(c * 255)),
      indices: t.indices,
    }),
  };
}

function quantizedWithoutMeshopt(quantized, png, data) {
  const packed = pack([
    { data: png },
    { data: data.positions, byteStride: 8, target: 34962 },
    { data: data.normals, byteStride: 4, target: 34962 },
    { data: data.uvs, byteStride: 4, target: 34962 },
    { data: data.colors, byteStride: 4, target: 34962 },
    { data: data.indices, target: 34963 },
  ]);
  const json = structuredClone(quantized);
  json.extensionsUsed = ['KHR_mesh_quantization'];
  json.extensionsRequired = ['KHR_mesh_quantization'];
  json.bufferViews = packed.views;
  json.buffers = [{ byteLength: packed.bin.length }];
  return writeGlb(json, packed.bin);
}

/** A unit quad facing +Z (two triangles), with texture coordinates. */
export function quad(size = 1) {
  const h = size / 2;
  return {
    positions: new Float32Array([-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    // glTF: (0,0) is the picture's top-left.
    uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
}

/**
 * A picture on an unlit quad. `images` are [mimeType, bytes] pairs; `texture`
 * is the glTF texture object; `extension` is declared used (and required when
 * `required`).
 */
export function picturePlane({ images, texture, extension, required = false }) {
  const q = quad(2);
  const packed = pack([
    ...images.map(([, bytes]) => ({ data: bytes })),
    { data: q.positions, target: 34962 },
    { data: q.normals, target: 34962 },
    { data: q.uvs, target: 34962 },
    { data: q.indices, target: 34963 },
  ]);
  const n = images.length;
  const json = {
    asset: { version: '2.0', generator: 'zhuda gltf-intake fixture' },
    extensionsUsed: ['KHR_materials_unlit', ...(extension ? [extension] : [])],
    ...(required && extension ? { extensionsRequired: [extension] } : {}),
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Picture', mesh: 0 }],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 },
        ],
      },
    ],
    materials: [
      {
        name: 'Picture',
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 },
        extensions: { KHR_materials_unlit: {} },
      },
    ],
    textures: [{ sampler: 0, ...texture }],
    // Nearest filtering: every screen pixel shows one texel, as the picture holds it.
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    images: images.map(([mimeType], i) => ({ bufferView: i, mimeType })),
    accessors: [
      {
        bufferView: n,
        componentType: 5126,
        count: 4,
        type: 'VEC3',
        min: [-1, -1, 0],
        max: [1, 1, 0],
      },
      { bufferView: n + 1, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: n + 2, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: n + 3, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
    bufferViews: packed.views,
    buffers: [{ byteLength: packed.bin.length }],
  };
  return writeGlb(json, packed.bin);
}

/** A test picture: soft gradients, a checker and rings, with edges in every direction. */
export function testPicture(size = 256, { invert = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4,
        u = x / size,
        v = y / size;
      const checker = ((x >> 5) + (y >> 5)) % 2;
      const ring = Math.hypot(u - 0.5, v - 0.5) * 18;
      let rgb = [
        Math.round(255 * u),
        Math.round(255 * (checker ? 0.85 : 0.25)),
        Math.round(255 * (0.5 + 0.5 * Math.sin(ring))),
      ];
      if (y < size / 8) rgb = [230, 40, 30]; // a red band marks the top
      if (invert) rgb = rgb.map((c) => 255 - c);
      pixels.set([...rgb, 255], i);
    }
  return { pixels, width: size, height: size };
}

/** Quaternion [x, y, z, w] turning local -Z toward `forward`. */
export function lookQuaternion(forward, up = [0, 1, 0]) {
  const norm = (a) => {
    const l = Math.hypot(...a);
    return a.map((c) => c / l);
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const z = norm(forward.map((c) => -c));
  if (Math.abs(z[0] * up[0] + z[1] * up[1] + z[2] * up[2]) > 0.999) up = [0, 0, 1];
  const x = norm(cross(up, z)),
    y = cross(z, x);
  // Rotation matrix columns x, y, z to a quaternion.
  const [m00, m10, m20] = x,
    [m01, m11, m21] = y,
    [m02, m12, m22] = z;
  const trace = m00 + m11 + m22;
  let q;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  return q;
}

/** A UV sphere. */
function sphere(radius = 0.5, rings = 24, segments = 48) {
  const positions = [],
    normals = [],
    indices = [];
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI;
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const n = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
      normals.push(...n);
      positions.push(...n.map((c) => c * radius));
    }
  }
  const row = segments + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segments; j++) {
      const a = i * row + j,
        b = a + row;
      // Counter-clockwise seen from outside.
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

/** An axis-aligned box with flat faces. */
function box(sx, sy, sz) {
  const faces = [
    [
      [1, 0, 0],
      [0, 0, -1],
      [0, 1, 0],
    ],
    [
      [-1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, -1],
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
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
    indices = [];
  const half = [sx / 2, sy / 2, sz / 2];
  faces.forEach(([n, u, v], f) => {
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      positions.push(...[0, 1, 2].map((k) => (n[k] + a * u[k] + b * v[k]) * half[k]));
      normals.push(...n);
    }
    indices.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
  });
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

/** Where the lights and the camera of the lit room sit, for the page's own reference. */
export const ROOM = {
  lamp: {
    position: [-1.3, 1.1, 0.9],
    light: { type: 'point', color: [1, 0.55, 0.25], intensity: 9, range: 5, name: 'lamp' },
    extras: { kind: 'lamp', flicker: 0.25, tags: ['warm', 'table'] },
  },
  spot: {
    position: [1.9, 3.2, 1.6],
    target: [1.1, 0, -0.3],
    light: {
      type: 'spot',
      color: [0.35, 0.6, 1],
      intensity: 40,
      name: 'spot',
      spot: { innerConeAngle: 0.18, outerConeAngle: 0.42 },
    },
  },
  sun: {
    forward: [-0.45, -1, -0.35],
    light: { type: 'directional', color: [1, 0.93, 0.82], intensity: 0.9, name: 'sun' },
  },
  camera: {
    position: [0.3, 2.6, 5.4],
    target: [0.1, 0.35, 0],
    perspective: { yfov: 0.68, znear: 0.1, zfar: 60, aspectRatio: 4 / 3 },
    extras: { shot: 'wide', lens: 'normal' },
  },
};

/**
 * A small room: a floor, a ball and a box. `lights` adds KHR_lights_punctual
 * lights on the nodes Lamp, Spot and Sun; the camera node ShotCamera carries a
 * camera and extras either way.
 */
export function litRoom({ lights }) {
  const floor = box(8, 0.1, 8),
    ball = sphere(0.55),
    cube = box(0.8, 0.8, 0.8);
  const meshes = [floor, ball, cube];
  const parts = [];
  for (const m of meshes)
    parts.push(
      { data: m.positions, target: 34962 },
      { data: m.normals, target: 34962 },
      { data: m.indices, target: 34963 },
    );
  const packed = pack(parts);
  const accessors = [];
  meshes.forEach((m, i) => {
    accessors.push(
      {
        bufferView: i * 3,
        componentType: 5126,
        count: m.positions.length / 3,
        type: 'VEC3',
        ...minMax(m.positions, 3),
      },
      { bufferView: i * 3 + 1, componentType: 5126, count: m.normals.length / 3, type: 'VEC3' },
      { bufferView: i * 3 + 2, componentType: 5123, count: m.indices.length, type: 'SCALAR' },
    );
  });
  const forward = (from, to) => to.map((c, i) => c - from[i]);
  const nodes = [
    { name: 'Room', children: [1, 2, 3, 4, 5, 6, 7] },
    { name: 'Floor', mesh: 0, translation: [0, -0.05, 0] },
    { name: 'Ball', mesh: 1, translation: [-0.3, 0.55, 0.2] },
    { name: 'Crate', mesh: 2, translation: [1.2, 0.4, -0.4], extras: { solid: true } },
    {
      name: 'Lamp',
      translation: ROOM.lamp.position,
      extras: ROOM.lamp.extras,
      ...(lights ? { extensions: { KHR_lights_punctual: { light: 0 } } } : {}),
    },
    {
      name: 'Spot',
      translation: ROOM.spot.position,
      rotation: lookQuaternion(forward(ROOM.spot.position, ROOM.spot.target)),
      ...(lights ? { extensions: { KHR_lights_punctual: { light: 1 } } } : {}),
    },
    {
      name: 'Sun',
      translation: [0, 6, 0],
      rotation: lookQuaternion(ROOM.sun.forward),
      ...(lights ? { extensions: { KHR_lights_punctual: { light: 2 } } } : {}),
    },
    {
      name: 'ShotCamera',
      camera: 0,
      translation: ROOM.camera.position,
      rotation: lookQuaternion(forward(ROOM.camera.position, ROOM.camera.target)),
      extras: ROOM.camera.extras,
    },
  ];
  const json = {
    asset: { version: '2.0', generator: 'zhuda gltf-intake fixture' },
    ...(lights
      ? {
          extensionsUsed: ['KHR_lights_punctual'],
          extensions: {
            KHR_lights_punctual: {
              lights: [ROOM.lamp.light, ROOM.spot.light, ROOM.sun.light],
            },
          },
        }
      : {}),
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    cameras: [{ type: 'perspective', name: 'shot', perspective: ROOM.camera.perspective }],
    meshes: [0, 1, 2].map((i) => ({
      primitives: [
        {
          attributes: { POSITION: i * 3, NORMAL: i * 3 + 1 },
          indices: i * 3 + 2,
          material: i === 0 ? 0 : 1,
        },
      ],
    })),
    materials: [
      {
        name: 'Floor',
        pbrMetallicRoughness: {
          baseColorFactor: [0.72, 0.7, 0.66, 1],
          metallicFactor: 0,
          roughnessFactor: 0.92,
        },
      },
      {
        name: 'Clay',
        pbrMetallicRoughness: {
          baseColorFactor: [0.85, 0.85, 0.85, 1],
          metallicFactor: 0,
          roughnessFactor: 0.6,
        },
      },
    ],
    accessors,
    bufferViews: packed.views,
    buffers: [{ byteLength: packed.bin.length }],
  };
  return writeGlb(json, packed.bin);
}

/** A plane with one large embedded PNG, for timing the embedded-image path. */
export function bigPicturePlane(png) {
  return picturePlane({ images: [['image/png', png]], texture: { source: 0 } });
}
