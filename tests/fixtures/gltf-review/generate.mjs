import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
/** Authored neutral geometry, not seller artwork. */
export function morphFixture(interpolation = 'CUBICSPLINE', skinned = false) {
  const chunks = [],
    views = [],
    accessors = [];
  let size = 0;
  const add = (values, type, componentType = 5126, min, max, target) => {
    const array = componentType === 5123 ? new Uint16Array(values) : new Float32Array(values),
      bytes = Buffer.from(array.buffer);
    const bufferView = views.length;
    views.push({
      buffer: 0,
      byteOffset: size,
      byteLength: bytes.length,
      ...(target ? { target } : {}),
    });
    chunks.push(bytes);
    size += bytes.length;
    const pad = (4 - (size % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      size += pad;
    }
    const index = accessors.length;
    accessors.push({
      bufferView,
      componentType,
      type,
      count: values.length / { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[type],
      ...(min ? { min, max } : {}),
    });
    return index;
  };
  const POSITION = add(
      [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0],
      'VEC3',
      5126,
      [-0.5, -0.5, 0],
      [0.5, 0.5, 0],
      34962,
    ),
    NORMAL = add([0, 0, 1, 0, 0, 1, 0, 0, 1], 'VEC3', 5126, undefined, undefined, 34962),
    indices = add([0, 1, 2], 'SCALAR', 5123, undefined, undefined, 34963);
  const bend = add([0, 0, 0, 0, 0, 0, 0.8, 0, 0], 'VEC3', 5126, [0, 0, 0], [0.8, 0, 0], 34962),
    lift = add([0, 0.2, 0, 0, 0, 0, 0, 0.4, 0], 'VEC3', 5126, [0, 0, 0], [0, 0.4, 0], 34962);
  const attributes = { POSITION, NORMAL };
  const d = {
    asset: { version: '2.0', generator: 'Zhuda authored multi-morph fixture' },
    scene: 0,
    scenes: [{ nodes: skinned ? [0, 1] : [0] }],
    nodes: [{ name: 'Probe', mesh: 0, weights: [0.2, 0.4] }],
    meshes: [
      {
        weights: [0, 0],
        extras: { targetNames: ['bend', 'lift'] },
        primitives: [
          { attributes, indices, material: 0, targets: [{ POSITION: bend }, { POSITION: lift }] },
        ],
      },
    ],
    materials: [
      {
        name: 'NeutralMagenta',
        pbrMetallicRoughness: {
          baseColorFactor: [0.7, 0.2, 0.8, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        doubleSided: true,
        extensions: { KHR_materials_unlit: {} },
      },
    ],
    extensionsUsed: ['KHR_materials_unlit'],
    accessors,
    bufferViews: views,
  };
  if (skinned) {
    attributes.JOINTS_0 = add(
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      'VEC4',
      5123,
      undefined,
      undefined,
      34962,
    );
    attributes.WEIGHTS_0 = add(
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      'VEC4',
      5126,
      undefined,
      undefined,
      34962,
    );
    const inverseBindMatrices = add([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 'MAT4');
    d.skins = [{ joints: [1], skeleton: 1, inverseBindMatrices }];
    d.nodes[0].skin = 0;
    d.nodes.push({ name: 'Joint' });
  }
  const input = add([0, 2], 'SCALAR', 5126, [0], [2]);
  const values =
    interpolation === 'CUBICSPLINE'
      ? [0, 0, 0, 0.2, 0.4, -0.2, -0.2, 0.6, 1, 0.8, 0, 0]
      : [0, 0.2, 1, 0.8];
  const output = add(values, 'SCALAR'),
    translation = add([0, 0, 0, 0.1, 0, 0], 'VEC3');
  d.animations = [
    {
      name: 'Morph',
      samplers: [
        { input, output, interpolation },
        { input, output: translation, interpolation: 'LINEAR' },
      ],
      channels: [
        { sampler: 0, target: { node: 0, path: 'weights' } },
        { sampler: 1, target: { node: skinned ? 1 : 0, path: 'translation' } },
      ],
    },
  ];
  d.buffers = [
    {
      byteLength: size,
      uri: 'data:application/octet-stream;base64,' + Buffer.concat(chunks).toString('base64'),
    },
  ];
  return d;
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  for (const kind of ['LINEAR', 'STEP', 'CUBICSPLINE'])
    for (const skin of [false, true])
      fs.writeFileSync(
        new URL(`multi-${kind.toLowerCase()}${skin ? '-skin' : ''}.gltf`, import.meta.url),
        JSON.stringify(morphFixture(kind, skin), null, 2) + '\n',
      );
