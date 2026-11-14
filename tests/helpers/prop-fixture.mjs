// A prop for the instanced-mesh draw check: a model of two plain meshes,
// each a node with a place of its own inside the model (a brown trunk and a
// green crown), and a lighter version of it for distance (one olive box).
// Nothing is skinned and nothing moves.

function box(size, colour) {
  const [w, h, d] = size.map((v) => v / 2);
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
    indices = [];
  for (const [n, u, v] of faces) {
    const start = positions.length / 3;
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const p = [0, 1, 2].map((k) => n[k] + u[k] * a + v[k] * b);
      positions.push(p[0] * w, p[1] * h, p[2] * d);
      normals.push(...n);
    }
    // Counter-clockwise seen from outside: u x v points along n.
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  return { positions, normals, indices, colour };
}

function ball(radius, around, rings, colour) {
  const positions = [],
    normals = [],
    indices = [];
  for (let i = 0; i <= rings; i++) {
    const tilt = (i / rings - 0.5) * Math.PI;
    for (let j = 0; j <= around; j++) {
      const turn = (j / around) * Math.PI * 2;
      const n = [Math.cos(tilt) * Math.cos(turn), Math.sin(tilt), Math.cos(tilt) * Math.sin(turn)];
      normals.push(...n);
      positions.push(n[0] * radius, n[1] * radius, n[2] * radius);
    }
  }
  const row = around + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < around; j++) {
      const a = i * row + j,
        b = a + 1,
        c = a + row,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  return { positions, normals, indices, colour };
}

function glb(nodes) {
  const parts = [];
  const accessors = [];
  const add = (array, type, componentType, extra = {}) => {
    parts.push(array);
    accessors.push({
      bufferView: parts.length - 1,
      componentType,
      count: array.length / { VEC3: 3, SCALAR: 1 }[type],
      type,
      ...extra,
    });
    return accessors.length - 1;
  };
  const meshes = [],
    materials = [];
  const sceneNodes = nodes.map((node, i) => {
    const { positions, normals, indices, colour } = node.shape;
    const lows = [0, 1, 2].map((k) => Math.min(...positions.filter((_, n) => n % 3 === k)));
    const highs = [0, 1, 2].map((k) => Math.max(...positions.filter((_, n) => n % 3 === k)));
    const position = add(new Float32Array(positions), 'VEC3', 5126, { min: lows, max: highs });
    const normal = add(new Float32Array(normals), 'VEC3', 5126);
    const index = add(new Uint16Array(indices), 'SCALAR', 5123);
    materials.push({
      pbrMetallicRoughness: {
        baseColorFactor: [...colour, 1],
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    });
    meshes.push({
      primitives: [
        { attributes: { POSITION: position, NORMAL: normal }, indices: index, material: i },
      ],
    });
    return {
      name: node.name,
      mesh: i,
      translation: node.translation,
      ...(node.scale ? { scale: node.scale } : {}),
    };
  });
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
    scenes: [{ nodes: sceneNodes.map((_, i) => i) }],
    nodes: sceneNodes,
    meshes,
    materials,
    buffers: [{ byteLength: bin.length }],
    bufferViews: views,
    accessors,
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

/** The colours the two meshes are given, as glTF holds them (linear). */
export const PROP = { trunk: [0.35, 0.2, 0.1], crown: [0.1, 0.5, 0.15], light: [0.3, 0.4, 0.1] };

/** A trunk and a crown: two meshes, two materials, each node placed inside the model. */
export function staticPropGlb() {
  return glb([
    { name: 'trunk', shape: box([0.2, 0.8, 0.2], PROP.trunk), translation: [0, 0.4, 0] },
    {
      name: 'crown',
      shape: ball(0.4, 12, 8, PROP.crown),
      translation: [0, 1.1, 0],
      scale: [1.2, 1, 1.2],
    },
  ]);
}

/** The same prop as one box, for distance. */
export function lightPropGlb() {
  return glb([{ name: 'far', shape: box([0.7, 1.4, 0.7], PROP.light), translation: [0, 0.7, 0] }]);
}
