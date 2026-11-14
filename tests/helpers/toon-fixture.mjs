// A skinned limb for the stylized-shading draw check: a capsule 2 m tall and
// 0.6 m thick standing on the origin, with smooth normals (an outline hull
// needs them), two joints and one clip, "Bend": over one second the upper
// joint (at y = 1) turns 90 degrees about +Z, so the upper half swings from
// straight up to pointing at -X.
export const LIMB = { radius: 0.3, height: 2, around: 24, capRings: 6, bodyRings: 12 };

export function skinnedLimbGlb() {
  return limb(2, false);
}

/**
 * The same capsule on a chain of `joints` bones (2..32), with two clips of
 * one second: "Bend" (every joint but the first turns about +Z, a quarter
 * turn in all) and "Sway" (the same joints turn about +X one way, back
 * through straight, and the other way). For crowds: more bones than a mesh
 * piece holds when `joints` is above 24.
 */
export function skinnedCharacterGlb(joints = 12) {
  if (!Number.isInteger(joints) || joints < 2 || joints > 32) throw Error('joints: 2..32');
  return limb(joints, true);
}

function limb(count, sway) {
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
  const body = Math.max(bodyRings, count * 2);
  for (let i = 1; i < body; i++)
    rings.push({ y: radius + ((height - 2 * radius) * i) / body, r: radius, ny: 0 });
  for (let i = 0; i <= capRings; i++) {
    const angle = (Math.PI / 2) * (i / capRings);
    rings.push({
      y: height - radius + Math.sin(angle) * radius,
      r: Math.cos(angle) * radius,
      ny: Math.sin(angle),
    });
  }
  // The joints stand evenly up the limb; a ring is shared by the two nearest across 0.4 m.
  const span = height / count;
  for (const ring of rings)
    for (let j = 0; j <= around; j++) {
      const turn = (j / around) * Math.PI * 2;
      const flat = Math.sqrt(Math.max(0, 1 - ring.ny * ring.ny));
      positions.push(Math.cos(turn) * ring.r, ring.y, Math.sin(turn) * ring.r);
      normals.push(Math.cos(turn) * flat, ring.ny, Math.sin(turn) * flat);
      // The joint below this height, and how far the ring has gone over to the next.
      let lower = Math.min(count - 2, Math.max(0, Math.floor((ring.y + 0.2) / span) - 1));
      let upper = Math.min(1, Math.max(0, (ring.y - ((lower + 1) * span - 0.2)) / 0.4));
      if (upper >= 1 && lower < count - 2) {
        lower++;
        upper = Math.min(1, Math.max(0, (ring.y - ((lower + 1) * span - 0.2)) / 0.4));
      }
      joints.push(lower, lower + 1, 0, 0);
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
  const vertices = positions.length / 3;
  const inverseBind = [];
  for (let k = 0; k < count; k++)
    inverseBind.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, k ? -k * span : 0, 0, 1);
  const quarter = Math.PI / 2 / (count - 1);
  const about = (axis, angle) => {
    const q = [0, 0, 0, Math.cos(angle / 2)];
    q[axis] = Math.sin(angle / 2);
    return q;
  };
  const parts = [
    new Float32Array(positions),
    new Float32Array(normals),
    new Uint8Array(joints),
    new Float32Array(weights),
    new Uint16Array(indices),
    new Float32Array(inverseBind),
    new Float32Array([0, 1]),
    new Float32Array([0, 0, 0, 1, ...about(2, quarter)]),
    ...(sway
      ? [
          new Float32Array([0, 0.5, 1]),
          new Float32Array([...about(0, quarter), 0, 0, 0, 1, ...about(0, -quarter)]),
        ]
      : []),
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
  // Node 0 is the mesh; nodes 1.. are the joints, each the child of the one below.
  const names =
    count === 2 ? ['lower', 'upper'] : Array.from({ length: count }, (_, k) => 'joint' + k);
  const chain = names.map((name, k) => ({
    name,
    ...(k > 0 ? { translation: [0, span, 0] } : {}),
    ...(k < count - 1 ? { children: [k + 2] } : {}),
  }));
  const turning = Array.from({ length: count - 1 }, (_, k) => k + 2);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ name: 'limb', mesh: 0, skin: 0 }, ...chain],
    skins: [{ joints: names.map((_, k) => k + 1), inverseBindMatrices: 5, skeleton: 1 }],
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
        channels: turning.map((node) => ({ sampler: 0, target: { node, path: 'rotation' } })),
      },
      ...(sway
        ? [
            {
              name: 'Sway',
              samplers: [{ input: 8, output: 9, interpolation: 'LINEAR' }],
              channels: turning.map((node) => ({ sampler: 0, target: { node, path: 'rotation' } })),
            },
          ]
        : []),
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews: views,
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertices,
        type: 'VEC3',
        min: [-radius, 0, -radius],
        max: [radius, height, radius],
      },
      { bufferView: 1, componentType: 5126, count: vertices, type: 'VEC3' },
      { bufferView: 2, componentType: 5121, count: vertices, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: vertices, type: 'VEC4' },
      { bufferView: 4, componentType: 5123, count: indices.length, type: 'SCALAR' },
      { bufferView: 5, componentType: 5126, count, type: 'MAT4' },
      { bufferView: 6, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 7, componentType: 5126, count: 2, type: 'VEC4' },
      ...(sway
        ? [
            { bufferView: 8, componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [1] },
            { bufferView: 9, componentType: 5126, count: 3, type: 'VEC4' },
          ]
        : []),
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
