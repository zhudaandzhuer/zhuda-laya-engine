// A skinned limb for the stylized-shading draw check: a capsule 2 m tall and
// 0.6 m thick standing on the origin, with smooth normals (an outline hull
// needs them), two joints and one clip, "Bend": over one second the upper
// joint (at y = 1) turns 90 degrees about +Z, so the upper half swings from
// straight up to pointing at -X.
export const LIMB = { radius: 0.3, height: 2, around: 24, capRings: 6, bodyRings: 12 };

export function skinnedLimbGlb() {
  const { radius, height, around, capRings, bodyRings } = LIMB;
  const positions = [];
  const normals = [];
  const joints = [];
  const weights = [];
  // Rings from the bottom pole to the top pole: a cap, the straight part, a cap.
  const rings = [];
  for (let i = 0; i <= capRings; i++) {
    const angle = (-Math.PI / 2) * (1 - i / capRings);
    rings.push({
      y: radius + Math.sin(angle) * radius,
      r: Math.cos(angle) * radius,
      ny: Math.sin(angle),
    });
  }
  for (let i = 1; i < bodyRings; i++)
    rings.push({ y: radius + ((height - 2 * radius) * i) / bodyRings, r: radius, ny: 0 });
  for (let i = 0; i <= capRings; i++) {
    const angle = (Math.PI / 2) * (i / capRings);
    rings.push({
      y: height - radius + Math.sin(angle) * radius,
      r: Math.cos(angle) * radius,
      ny: Math.sin(angle),
    });
  }
  for (const ring of rings)
    for (let j = 0; j <= around; j++) {
      const turn = (j / around) * Math.PI * 2;
      const flat = Math.sqrt(Math.max(0, 1 - ring.ny * ring.ny));
      positions.push(Math.cos(turn) * ring.r, ring.y, Math.sin(turn) * ring.r);
      normals.push(Math.cos(turn) * flat, ring.ny, Math.sin(turn) * flat);
      // The lower joint below 0.8 m, the upper above 1.2 m, shared between.
      const upper = Math.min(1, Math.max(0, (ring.y - 0.8) / 0.4));
      joints.push(0, 1, 0, 0);
      weights.push(1 - upper, upper, 0, 0);
    }
  const indices = [];
  const row = around + 1;
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < around; j++) {
      const a = i * row + j,
        b = a + 1,
        c = a + row,
        d = c + 1;
      // Counter-clockwise seen from outside.
      indices.push(a, c, b, b, c, d);
    }
  const count = positions.length / 3;
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const inverseBind = [...identity, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1];
  const half = Math.SQRT1_2;
  const parts = [
    new Float32Array(positions),
    new Float32Array(normals),
    new Uint8Array(joints),
    new Float32Array(weights),
    new Uint16Array(indices),
    new Float32Array(inverseBind),
    new Float32Array([0, 1]),
    new Float32Array([0, 0, 0, 1, 0, 0, half, half]),
  ];
  const views = [];
  const chunks = [];
  let offset = 0;
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
      { name: 'limb', mesh: 0, skin: 0 },
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
        pbrMetallicRoughness: {
          baseColorFactor: [0.9, 0.5, 0.3, 1],
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
        count,
        type: 'VEC3',
        min: [-radius, 0, -radius],
        max: [radius, height, radius],
      },
      { bufferView: 1, componentType: 5126, count, type: 'VEC3' },
      { bufferView: 2, componentType: 5121, count, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count, type: 'VEC4' },
      { bufferView: 4, componentType: 5123, count: indices.length, type: 'SCALAR' },
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
