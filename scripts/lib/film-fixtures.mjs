// Generated fixtures for the film GPU checks: nothing is read from the repository.

/** A 10 m square floor at y = 0, white and rough; optional second UV set. */
export function floorGlb({ uv1 }) {
  const positions = [-5, 0, -5, -5, 0, 5, 5, 0, 5, 5, 0, -5];
  const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  // glTF UVs: (0,0) is the top-left texel. u follows +X, v follows +Z.
  const uv = [0, 0, 0, 1, 1, 1, 1, 0];
  const parts = [
    new Float32Array(positions),
    new Float32Array(normals),
    new Float32Array(uv),
    ...(uv1 ? [new Float32Array(uv)] : []),
    new Uint16Array([0, 1, 2, 0, 2, 3]),
  ];
  const views = [];
  let offset = 0;
  for (const part of parts) {
    views.push({ buffer: 0, byteOffset: offset, byteLength: part.byteLength });
    offset += part.byteLength;
  }
  const bin = Buffer.concat(parts.map((part) => Buffer.from(part.buffer)));
  const accessor = (bufferView, type, extra = {}) => ({
    bufferView,
    componentType: 5126,
    count: 4,
    type,
    ...extra,
  });
  const attributes = { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 };
  if (uv1) attributes.TEXCOORD_1 = 3;
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'floor' }],
    meshes: [{ primitives: [{ attributes, indices: uv1 ? 4 : 3, material: 0 }] }],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews: views,
    accessors: [
      accessor(0, 'VEC3', { min: [-5, 0, -5], max: [5, 0, 5] }),
      accessor(1, 'VEC3'),
      accessor(2, 'VEC2'),
      ...(uv1 ? [accessor(3, 'VEC2')] : []),
      { bufferView: uv1 ? 4 : 3, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
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

/** Flat (not run-length encoded) Radiance HDR; `pixel(x, y)` returns linear RGB, top row first. */
export function radianceHdr(size, pixel) {
  const body = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgb = pixel(x, y),
        max = Math.max(...rgb),
        o = (y * size + x) * 4;
      if (max < 1e-32) continue;
      const e = Math.ceil(Math.log2(max) + 1e-9),
        scale = 256 / Math.pow(2, e);
      for (let c = 0; c < 3; c++) body[o + c] = Math.min(255, Math.floor(rgb[c] * scale));
      body[o + 3] = e + 128;
    }
  return Buffer.concat([
    Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${size} +X ${size}\n`, 'latin1'),
    body,
  ]);
}

/**
 * A skinned strip standing 2 m tall in the XY plane, with two joints and one
 * clip, "Bend": over one second the upper joint (at y = 1) turns 90 degrees
 * about +Z, so the top of the strip swings from straight up to pointing at -X.
 */
export function skinnedStripGlb() {
  const positions = [-0.3, 0, 0, 0.3, 0, 0, -0.3, 1, 0, 0.3, 1, 0, -0.3, 2, 0, 0.3, 2, 0];
  const normals = Array.from({ length: 6 }, () => [0, 0, 1]).flat();
  const joints = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const weights = [1, 0, 0, 0, 1, 0, 0, 0, 0.5, 0.5, 0, 0, 0.5, 0.5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const inverseBind = [...identity, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1];
  const half = Math.SQRT1_2;
  const parts = [
    new Float32Array(positions),
    new Float32Array(normals),
    new Uint8Array(joints),
    new Float32Array(weights),
    new Uint16Array([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4]),
    new Float32Array(inverseBind),
    new Float32Array([0, 1]),
    new Float32Array([0, 0, 0, 1, 0, 0, half, half]),
  ];
  const views = [];
  let offset = 0;
  const chunks = [];
  for (const part of parts) {
    const bytes = Buffer.from(part.buffer, part.byteOffset, part.byteLength);
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    const padded = Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);
    chunks.push(padded);
    offset += padded.length;
  }
  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { name: 'strip', mesh: 0, skin: 0 },
      { name: 'lower', children: [2] },
      { name: 'upper', translation: [0, 1, 0] },
    ],
    skins: [{ joints: [1, 2], inverseBindMatrices: 5, skeleton: 1 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, JOINTS_0: 2, WEIGHTS_0: 3 },
            indices: 4,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [0.1, 1, 0.1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    animations: [
      {
        name: 'Bend',
        samplers: [{ input: 6, output: 7, interpolation: 'LINEAR' }],
        channels: [{ sampler: 0, target: { node: 2, path: 'rotation' } }],
      },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews: views,
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 6,
        type: 'VEC3',
        min: [-0.3, 0, 0],
        max: [0.3, 2, 0],
      },
      { bufferView: 1, componentType: 5126, count: 6, type: 'VEC3' },
      { bufferView: 2, componentType: 5121, count: 6, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: 6, type: 'VEC4' },
      { bufferView: 4, componentType: 5123, count: 12, type: 'SCALAR' },
      { bufferView: 5, componentType: 5126, count: 2, type: 'MAT4' },
      { bufferView: 6, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 7, componentType: 5126, count: 2, type: 'VEC4' },
    ],
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
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

/** Pinhole projection for a film camera (focal length on a 24 mm tall sensor); returns a pixel. */
export function projectPixel(point, eye, target, width, height, focalLengthMm = 35) {
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (a) => a.map((v) => v / Math.hypot(...a));
  const forward = unit(sub(target, eye)),
    right = unit(cross(forward, [0, 1, 0])),
    up = cross(right, forward);
  const d = sub(point, eye),
    depth = dot(d, forward),
    f = focalLengthMm / 12;
  return [
    Math.round((0.5 + (dot(d, right) / depth) * f * (height / width) * 0.5) * width),
    Math.round((0.5 - (dot(d, up) / depth) * f * 0.5) * height),
  ];
}
