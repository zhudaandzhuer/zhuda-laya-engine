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
