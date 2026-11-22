// A VRM 1.0 avatar made by a program, for tests/vrm.test.mjs and
// scripts/verify-vrm.mjs: no third-party model. A humanoid of smooth
// ellipsoids skinned to its bones (facing +Z, as VRM 1.0 does), eyes on eye
// bones, a face mesh whose lids close (`blink`) and mouth opens (`aa`) by
// morph targets, a tail of hair on a spring with a collider on the head,
// MToon materials (one with a picture whose shade is a tint of it), a plain
// glTF material an expression turns red, and three node constraints.
// Metres; the model stands on y = 0.
import { PNG } from 'pngjs';
import { writeZhudaGlb } from '../../packages/core/runtime3d/GltfIntake.ts';

/** Bones: name, parent, position in the parent (no rest rotations). */
const BONES = [
  ['hips', null, [0, 0.9, 0]],
  ['spine', 'hips', [0, 0.1, 0]],
  ['chest', 'spine', [0, 0.15, 0]],
  ['neck', 'chest', [0, 0.2, 0]],
  ['head', 'neck', [0, 0.1, 0]],
  ['leftEye', 'head', [0.035, 0.06, 0.085]],
  ['rightEye', 'head', [-0.035, 0.06, 0.085]],
  ['leftUpperArm', 'chest', [0.18, 0.15, 0]],
  ['leftLowerArm', 'leftUpperArm', [0.25, 0, 0]],
  ['leftHand', 'leftLowerArm', [0.25, 0, 0]],
  ['rightUpperArm', 'chest', [-0.18, 0.15, 0]],
  ['rightLowerArm', 'rightUpperArm', [-0.25, 0, 0]],
  ['rightHand', 'rightLowerArm', [-0.25, 0, 0]],
  ['leftUpperLeg', 'hips', [0.1, -0.05, 0]],
  ['leftLowerLeg', 'leftUpperLeg', [0, -0.4, 0]],
  ['leftFoot', 'leftLowerLeg', [0, -0.4, 0]],
  ['rightUpperLeg', 'hips', [-0.1, -0.05, 0]],
  ['rightLowerLeg', 'rightUpperLeg', [0, -0.4, 0]],
  ['rightFoot', 'rightLowerLeg', [0, -0.4, 0]],
  ['hair1', 'head', [0, 0.06, -0.125]],
  ['hair2', 'hair1', [0, -0.1, 0]],
  ['hair3', 'hair2', [0, -0.1, 0]],
  ['hair4', 'hair3', [0, -0.1, 0]],
  // Constrained: turned with the head; a twist taking half the hand's roll; one aimed at the left hand.
  ['badge', 'chest', [0.08, 0.12, 0.12]],
  ['leftTwist', 'leftLowerArm', [0.12, 0, 0]],
  ['pointer', 'chest', [0, 0.05, 0.16]],
];
export const VRM_TEST_BONES = BONES.map((b) => b[0]);

class Bin {
  chunks = [];
  length = 0;
  views = [];
  accessors = [];
  add(typed, target) {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const padded = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4);
    padded.set(bytes);
    this.views.push({
      buffer: 0,
      byteOffset: this.length,
      byteLength: bytes.byteLength,
      ...(target ? { target } : {}),
    });
    this.chunks.push(padded);
    this.length += padded.byteLength;
    return this.views.length - 1;
  }
  accessor(typed, type, componentType, target, extra = {}) {
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const view = this.add(typed, target);
    this.accessors.push({
      bufferView: view,
      componentType,
      count: typed.length / size,
      type,
      ...extra,
    });
    return this.accessors.length - 1;
  }
  positions(values) {
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < values.length; i++) {
      min[i % 3] = Math.min(min[i % 3], values[i]);
      max[i % 3] = Math.max(max[i % 3], values[i]);
    }
    return this.accessor(new Float32Array(values), 'VEC3', 5126, 34962, { min, max });
  }
  bytes() {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const c of this.chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    return out;
  }
}

/** A smooth ellipsoid: positions, normals and texture coordinates, and its triangles. */
function ellipsoid(center, radii, rings = 12, segments = 16) {
  const p = [],
    n = [],
    uv = [],
    index = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings,
      phi = v * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const u = s / segments,
        theta = u * Math.PI * 2;
      const x = Math.sin(phi) * Math.sin(theta),
        y = Math.cos(phi),
        z = Math.sin(phi) * Math.cos(theta);
      p.push(center[0] + x * radii[0], center[1] + y * radii[1], center[2] + z * radii[2]);
      const nx = x / radii[0],
        ny = y / radii[1],
        nz = z / radii[2],
        l = Math.hypot(nx, ny, nz);
      n.push(nx / l, ny / l, nz / l);
      uv.push(u, v);
    }
  }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s,
        b = a + segments + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  return { p, n, uv, index };
}

/** Parts joined into one primitive's arrays, each vertex weighted to one joint. */
function joined(parts) {
  const out = { p: [], n: [], uv: [], index: [], joints: [], weights: [] };
  for (const { shape, joint } of parts) {
    const base = out.p.length / 3;
    out.p.push(...shape.p);
    out.n.push(...shape.n);
    out.uv.push(...shape.uv);
    out.index.push(...shape.index.map((i) => i + base));
    for (let i = 0; i < shape.p.length / 3; i++) {
      out.joints.push(joint, 0, 0, 0);
      out.weights.push(1, 0, 0, 0);
    }
  }
  return out;
}

/** A 4 by 4 picture: light and dark stripes, so a tint of it shows. */
function stripes() {
  const png = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < 16; i++) {
    const light = i % 4 < 2;
    png.data.set(light ? [255, 255, 255, 255] : [150, 170, 255, 255], i * 4);
  }
  return new Uint8Array(PNG.sync.write(png));
}

/**
 * The avatar as a glTF document and its GLB. `mutate(document)` may change
 * the JSON before it is written (the tests' deliberate failures).
 */
export function buildZhudaTestVrm(mutate) {
  const bin = new Bin();
  const nodes = [];
  const index = new Map();
  const world = new Map();
  for (const [name, parent, at] of BONES) {
    index.set(name, nodes.length);
    nodes.push({ name, translation: at, children: [] });
    const from = parent ? world.get(parent) : [0, 0, 0];
    world.set(name, [from[0] + at[0], from[1] + at[1], from[2] + at[2]]);
    if (parent) nodes[index.get(parent)].children.push(index.get(name));
  }
  // Skinned in the model's space at rest: a part is placed where it is and weighted to its bone.
  const at = (bone, offset) => {
    const w = world.get(bone);
    return [w[0] + offset[0], w[1] + offset[1], w[2] + offset[2]];
  };
  const bodyJoints = [
    'hips',
    'spine',
    'chest',
    'neck',
    'head',
    'leftUpperArm',
    'leftLowerArm',
    'leftHand',
    'rightUpperArm',
    'rightLowerArm',
    'rightHand',
    'leftUpperLeg',
    'leftLowerLeg',
    'leftFoot',
    'rightUpperLeg',
    'rightLowerLeg',
    'rightFoot',
  ];
  const j = (name) => bodyJoints.indexOf(name);
  const body = joined([
    { shape: ellipsoid(at('hips', [0, 0.02, 0]), [0.15, 0.1, 0.1]), joint: j('hips') },
    { shape: ellipsoid(at('spine', [0, 0.1, 0]), [0.14, 0.14, 0.09]), joint: j('spine') },
    { shape: ellipsoid(at('chest', [0, 0.1, 0]), [0.17, 0.13, 0.1]), joint: j('chest') },
    { shape: ellipsoid(at('neck', [0, 0.05, 0]), [0.045, 0.06, 0.045]), joint: j('neck') },
    { shape: ellipsoid(at('head', [0, 0.05, 0]), [0.1, 0.1, 0.1], 16, 24), joint: j('head') },
    ...['left', 'right'].flatMap((side) => {
      const s = side === 'left' ? 1 : -1;
      return [
        {
          shape: ellipsoid(at(`${side}UpperArm`, [s * 0.125, 0, 0]), [0.13, 0.04, 0.04]),
          joint: j(`${side}UpperArm`),
        },
        {
          shape: ellipsoid(at(`${side}LowerArm`, [s * 0.125, 0, 0]), [0.13, 0.035, 0.035]),
          joint: j(`${side}LowerArm`),
        },
        {
          shape: ellipsoid(at(`${side}Hand`, [s * 0.05, 0, 0]), [0.05, 0.03, 0.02]),
          joint: j(`${side}Hand`),
        },
        {
          shape: ellipsoid(at(`${side}UpperLeg`, [0, -0.2, 0]), [0.06, 0.21, 0.06]),
          joint: j(`${side}UpperLeg`),
        },
        {
          shape: ellipsoid(at(`${side}LowerLeg`, [0, -0.2, 0]), [0.05, 0.21, 0.05]),
          joint: j(`${side}LowerLeg`),
        },
        {
          shape: ellipsoid(at(`${side}Foot`, [0, -0.02, 0.05]), [0.045, 0.03, 0.09]),
          joint: j(`${side}Foot`),
        },
      ];
    }),
  ]);
  const hairJoints = ['hair1', 'hair2', 'hair3'];
  const hair = joined(
    hairJoints.map((name, k) => ({
      shape: ellipsoid(at(name, [0, -0.05, 0]), [0.035 - k * 0.006, 0.06, 0.03]),
      joint: k,
    })),
  );
  // Inverse bind matrices: each joint at rest is only moved (no rotation, no scale).
  const inverse = (names) =>
    new Float32Array(
      names.flatMap((name) => {
        const w = world.get(name);
        return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1];
      }),
    );
  const primitive = (shape, material, skinned) => {
    const attributes = {
      POSITION: bin.positions(shape.p),
      NORMAL: bin.accessor(new Float32Array(shape.n), 'VEC3', 5126, 34962),
      TEXCOORD_0: bin.accessor(new Float32Array(shape.uv), 'VEC2', 5126, 34962),
    };
    if (skinned) {
      attributes.JOINTS_0 = bin.accessor(new Uint8Array(shape.joints), 'VEC4', 5121, 34962);
      attributes.WEIGHTS_0 = bin.accessor(new Float32Array(shape.weights), 'VEC4', 5126, 34962);
    }
    return {
      attributes,
      indices: bin.accessor(new Uint16Array(shape.index), 'SCALAR', 5123, 34963),
      material,
    };
  };
  // Materials: 0 skin and 1 hair are MToon (hair with a picture and a tinted shade), 2 a plain glTF one.
  const materials = [
    {
      name: 'Skin',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 0.72, 0.6, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      extensions: {
        VRMC_materials_mtoon: {
          specVersion: '1.0',
          shadeColorFactor: [0.55, 0.22, 0.2],
          shadingToonyFactor: 0.95,
          shadingShiftFactor: 0,
          giEqualizationFactor: 0.9,
          parametricRimColorFactor: [0.25, 0.25, 0.35],
          parametricRimFresnelPowerFactor: 5,
          outlineWidthMode: 'worldCoordinates',
          outlineWidthFactor: 0.006,
          outlineColorFactor: [0.08, 0.03, 0.03],
        },
      },
    },
    {
      name: 'Hair',
      pbrMetallicRoughness: {
        baseColorFactor: [0.25, 0.3, 0.9, 1],
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      extensions: {
        VRMC_materials_mtoon: {
          specVersion: '1.0',
          shadeColorFactor: [0.06, 0.06, 0.3],
          shadeMultiplyTexture: { index: 0 },
          shadingToonyFactor: 0.9,
          giEqualizationFactor: 0.9,
        },
      },
    },
    {
      name: 'Dark',
      pbrMetallicRoughness: {
        baseColorFactor: [0.02, 0.02, 0.03, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    },
  ];
  const meshes = [];
  meshes.push({ name: 'Body', primitives: [primitive(body, 0, true)] });
  meshes.push({ name: 'Hair', primitives: [primitive(hair, 1, true)] });
  const pupil = ellipsoid([0, 0, 0.012], [0.016, 0.016, 0.004], 8, 12);
  meshes.push({ name: 'Pupil', primitives: [primitive(pupil, 2, false)] });
  // The face, on the head: lids (skin) that close and a mouth (dark) that opens.
  const quad = (x0, x1, y0, y1, z) => ({
    p: [x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z],
    n: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 1, 1, 1, 1, 0, 0, 0],
    index: [0, 1, 2, 0, 2, 3],
  });
  const lids = [quad(0.015, 0.055, 0.075, 0.081, 0.104), quad(-0.055, -0.015, 0.075, 0.081, 0.104)];
  const lidShape = {
    p: [...lids[0].p, ...lids[1].p],
    n: [...lids[0].n, ...lids[1].n],
    uv: [...lids[0].uv, ...lids[1].uv],
    index: [...lids[0].index, ...lids[1].index.map((i) => i + 4)],
  };
  const mouth = quad(-0.025, 0.025, -0.002, 0.002, 0.098);
  // Morph targets: 0 blink (each lid's lower edge comes down to y 0.04), 1 aa (the mouth's lower edge to -0.03).
  const lidBlink = new Float32Array(24),
    lidOpen = new Float32Array(24),
    mouthBlink = new Float32Array(12),
    mouthOpen = new Float32Array(12);
  for (const lid of [0, 4]) for (const v of [0, 1]) lidBlink[(lid + v) * 3 + 1] = 0.04 - 0.075;
  for (const v of [0, 1]) mouthOpen[v * 3 + 1] = -0.03 + 0.002;
  const facePrimitive = (shape, material, targets) => ({
    ...primitive(shape, material, false),
    targets: targets.map((t) => ({
      POSITION: bin.accessor(t, 'VEC3', 5126, 34962, { min: minOf(t), max: maxOf(t) }),
    })),
  });
  meshes.push({
    name: 'Face',
    primitives: [
      facePrimitive(lidShape, 0, [lidBlink, lidOpen]),
      facePrimitive(mouth, 2, [mouthBlink, mouthOpen]),
    ],
    weights: [0, 0],
    extras: { targetNames: ['blink', 'aa'] },
  });
  // Mesh nodes: the body and the hair skinned at the root; pupils on the eyes; the face on the head.
  const meshNode = (name, mesh, extra = {}) => {
    nodes.push({ name, mesh, ...extra });
    return nodes.length - 1;
  };
  const bodyNode = meshNode('BodyMesh', 0, { skin: 0 });
  const hairNode = meshNode('HairMesh', 1, { skin: 1 });
  const leftPupil = meshNode('LeftPupil', 2);
  const rightPupil = meshNode('RightPupil', 2);
  const face = meshNode('FaceMesh', 3, { translation: [0, 0, 0] });
  nodes[index.get('leftEye')].children.push(leftPupil);
  nodes[index.get('rightEye')].children.push(rightPupil);
  nodes[index.get('head')].children.push(face);
  const root = nodes.length;
  nodes.push({ name: 'Root', children: [index.get('hips'), bodyNode, hairNode] });
  for (const n of nodes) if (n.children && !n.children.length) delete n.children;
  const skins = [
    {
      joints: bodyJoints.map((n) => index.get(n)),
      inverseBindMatrices: bin.accessor(inverse(bodyJoints), 'MAT4', 5126),
    },
    {
      joints: hairJoints.map((n) => index.get(n)),
      inverseBindMatrices: bin.accessor(inverse(hairJoints), 'MAT4', 5126),
    },
  ];
  // Node constraints.
  nodes[index.get('badge')].extensions = {
    VRMC_node_constraint: {
      specVersion: '1.0',
      constraint: { rotation: { source: index.get('head'), weight: 1 } },
    },
  };
  nodes[index.get('leftTwist')].extensions = {
    VRMC_node_constraint: {
      specVersion: '1.0',
      constraint: { roll: { source: index.get('leftHand'), rollAxis: 'X', weight: 0.5 } },
    },
  };
  nodes[index.get('pointer')].extensions = {
    VRMC_node_constraint: {
      specVersion: '1.0',
      constraint: { aim: { source: index.get('leftHand'), aimAxis: 'PositiveZ', weight: 1 } },
    },
  };
  const humanBones = Object.fromEntries(
    VRM_TEST_BONES.filter((n) => !/^hair|badge|leftTwist|pointer/.test(n)).map((n) => [
      n,
      { node: index.get(n) },
    ]),
  );
  const faceBind = (target, weight = 1) => ({ node: face, index: target, weight });
  const document = {
    asset: { version: '2.0', generator: 'zhuda-laya-engine tests/fixtures/vrm-avatar.mjs' },
    extensionsUsed: ['VRMC_vrm', 'VRMC_springBone', 'VRMC_materials_mtoon', 'VRMC_node_constraint'],
    scene: 0,
    scenes: [{ nodes: [root] }],
    nodes,
    meshes,
    skins,
    materials,
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 10497, wrapT: 10497 }],
    images: [{ bufferView: bin.add(stripes()), mimeType: 'image/png' }],
    accessors: bin.accessors,
    bufferViews: bin.views,
    extensions: {
      VRMC_vrm: {
        specVersion: '1.0',
        meta: {
          name: 'Zhuda test avatar',
          version: '1',
          authors: ['zhuda-laya-engine tests'],
          licenseUrl: 'https://vrm.dev/licenses/1.0/',
          avatarPermission: 'everyone',
          commercialUsage: 'corporation',
          allowRedistribution: true,
          modification: 'allowModificationRedistribution',
          creditNotation: 'unnecessary',
        },
        humanoid: { humanBones },
        expressions: {
          preset: {
            blink: { morphTargetBinds: [faceBind(0)] },
            aa: { morphTargetBinds: [faceBind(1)] },
            happy: {
              morphTargetBinds: [faceBind(1, 0.4)],
              materialColorBinds: [{ material: 0, type: 'color', targetValue: [1, 0.45, 0.45, 1] }],
              overrideBlink: 'block',
            },
            angry: {
              materialColorBinds: [
                { material: 2, type: 'color', targetValue: [0.9, 0.02, 0.02, 1] },
              ],
              overrideMouth: 'blend',
            },
            surprised: {
              textureTransformBinds: [{ material: 1, scale: [1, 1], offset: [0.25, 0] }],
            },
          },
          custom: {
            wink: { morphTargetBinds: [faceBind(0, 0.8)], isBinary: true },
          },
        },
        lookAt: {
          type: 'bone',
          offsetFromHeadBone: [0, 0.06, 0.09],
          rangeMapHorizontalInner: { inputMaxValue: 90, outputScale: 10 },
          rangeMapHorizontalOuter: { inputMaxValue: 90, outputScale: 12 },
          rangeMapVerticalDown: { inputMaxValue: 90, outputScale: 10 },
          rangeMapVerticalUp: { inputMaxValue: 90, outputScale: 8 },
        },
        firstPerson: { meshAnnotations: [{ node: face, type: 'thirdPersonOnly' }] },
      },
      VRMC_springBone: {
        specVersion: '1.0',
        colliders: [
          { node: index.get('head'), shape: { sphere: { offset: [0, 0.03, 0], radius: 0.09 } } },
        ],
        colliderGroups: [{ name: 'Head', colliders: [0] }],
        springs: [
          {
            name: 'Tail',
            joints: ['hair1', 'hair2', 'hair3', 'hair4'].map((n, k) => ({
              node: index.get(n),
              hitRadius: 0.02,
              stiffness: 1 - k * 0.2,
              gravityPower: 0.05,
              gravityDir: [0, -1, 0],
              dragForce: 0.4,
            })),
            colliderGroups: [0],
          },
        ],
      },
    },
  };
  if (mutate) mutate(document);
  document.buffers = [{ byteLength: bin.length }];
  return { document, glb: writeZhudaGlb(document, bin.bytes()), index };
}
function minOf(t) {
  const m = [Infinity, Infinity, Infinity];
  for (let i = 0; i < t.length; i++) m[i % 3] = Math.min(m[i % 3], t[i]);
  return m;
}
function maxOf(t) {
  const m = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.length; i++) m[i % 3] = Math.max(m[i % 3], t[i]);
  return m;
}
