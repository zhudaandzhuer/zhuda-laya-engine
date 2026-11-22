// VRM 1.0: the reader on a generated avatar and on deliberate failures (each
// with its JSON path), VRM 0.x refused by name, and the specification's
// arithmetic: expression overrides, gaze angles and range maps, a joint's
// settings on the spring solver, node constraints, MToon as a toon
// material. Plain arithmetic, no browser; the draw is verify:vrm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZhudaTestVrm } from './fixtures/vrm-avatar.mjs';
import {
  readZhudaVrm,
  zhudaVrmExpressionWeights,
  zhudaVrmYawPitch,
  zhudaVrmRangeMap,
  zhudaVrmEyeAngles,
  zhudaVrmLookWeights,
  zhudaVrmYawPitchTurn,
  zhudaVrmSpringSetting,
  zhudaVrmConstraintRotation,
  zhudaVrmToonPlan,
  zhudaQuatSlerp,
  zhudaLinearToSrgb,
  ZHUDA_VRM_HUMAN_BONES,
  ZHUDA_VRM_REQUIRED_BONES,
} from '../packages/core/runtime3d/VrmDocument.ts';
import {
  inspectGltfAsset,
  gltfExtensionCapabilities,
} from '../packages/core/runtime3d/ModelCompatibility.ts';
import { validateZhudaToonSpec } from '../packages/core/shaders/ToonMaterial.ts';
import { ZhudaSpringBoneSolver } from '../packages/core/simulation/index.ts';
import { zhudaQuatRotate } from '../packages/core/runtime3d/Ik.ts';
import { zhudaSrgbToLinear } from '../packages/core/runtime3d/Surfaces.ts';

const near = (a, b, e = 1e-9, what = '') =>
  assert.ok(Math.abs(a - b) <= e, `${what} ${a} is not within ${e} of ${b}`);
const nearAll = (a, b, e = 1e-9, what = '') =>
  a.forEach((v, i) => near(v, b[i], e, `${what}[${i}]`));
const read = (mutate) => readZhudaVrm(buildZhudaTestVrm(mutate).document);
const axisAngle = (axis, deg) => {
  const h = (deg * Math.PI) / 360;
  return [axis[0] * Math.sin(h), axis[1] * Math.sin(h), axis[2] * Math.sin(h), Math.cos(h)];
};
const angleOf = (q) => (2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180) / Math.PI;

test('the generated avatar is read whole: meta, bones, expressions, gaze, springs, MToon, constraints', () => {
  const { document, index } = buildZhudaTestVrm();
  const { vrm, issues } = readZhudaVrm(document);
  assert.deepEqual(issues, []);
  assert.ok(vrm && Object.isFrozen(vrm) && Object.isFrozen(vrm.meta.authors));
  assert.equal(vrm.specVersion, '1.0');
  assert.deepEqual(
    { ...vrm.meta },
    {
      name: 'Zhuda test avatar',
      version: '1',
      authors: ['zhuda-laya-engine tests'],
      copyrightInformation: null,
      contactInformation: null,
      references: [],
      thirdPartyLicenses: null,
      thumbnailImage: null,
      licenseUrl: 'https://vrm.dev/licenses/1.0/',
      avatarPermission: 'everyone',
      // The specification's defaults where the file is silent.
      allowExcessivelyViolentUsage: false,
      allowExcessivelySexualUsage: false,
      commercialUsage: 'corporation',
      allowPoliticalOrReligiousUsage: false,
      allowAntisocialOrHateUsage: false,
      creditNotation: 'unnecessary',
      allowRedistribution: true,
      modification: 'allowModificationRedistribution',
      otherLicenseUrl: null,
    },
  );
  assert.equal(Object.keys(vrm.humanBones).length, 19);
  for (const bone of ZHUDA_VRM_REQUIRED_BONES) assert.equal(vrm.humanBones[bone], index.get(bone));
  assert.equal(ZHUDA_VRM_HUMAN_BONES.length, 55);
  assert.deepEqual(
    vrm.expressions.map((e) => [
      e.name,
      e.preset,
      e.morphs.length,
      e.colors.length,
      e.textures.length,
      e.isBinary,
    ]),
    [
      ['blink', 'blink', 1, 0, 0, false],
      ['aa', 'aa', 1, 0, 0, false],
      ['happy', 'happy', 1, 1, 0, false],
      ['angry', 'angry', 0, 1, 0, false],
      ['surprised', 'surprised', 0, 0, 1, false],
      ['wink', 'custom', 1, 0, 0, true],
    ],
  );
  const happy = vrm.expressions.find((e) => e.name === 'happy');
  assert.equal(happy.overrideBlink, 'block');
  assert.equal(happy.overrideMouth, 'none');
  assert.deepEqual(happy.colors[0], { material: 0, type: 'color', target: [1, 0.45, 0.45, 1] });
  assert.deepEqual(vrm.lookAt.offsetFromHeadBone, [0, 0.06, 0.09]);
  assert.deepEqual(vrm.lookAt.horizontalOuter, { inputMaxValue: 90, outputScale: 12 });
  assert.deepEqual(vrm.firstPerson, [
    {
      node: index.get('head') === undefined ? -1 : vrm.firstPerson[0].node,
      type: 'thirdPersonOnly',
    },
  ]);
  const spring = vrm.springBone.springs[0];
  assert.equal(spring.name, 'Tail');
  assert.deepEqual(
    spring.joints.map((j) => j.node),
    ['hair1', 'hair2', 'hair3', 'hair4'].map((n) => index.get(n)),
  );
  assert.deepEqual(
    { ...spring.joints[1] },
    {
      node: index.get('hair2'),
      hitRadius: 0.02,
      stiffness: 0.8,
      gravityPower: 0.05,
      gravityDir: [0, -1, 0],
      dragForce: 0.4,
    },
  );
  assert.deepEqual(spring.colliderGroups, [0]);
  assert.equal(spring.center, null);
  assert.deepEqual(vrm.springBone.colliders[0], {
    node: index.get('head'),
    shape: { type: 'sphere', offset: [0, 0.03, 0], radius: 0.09 },
  });
  assert.deepEqual(
    vrm.mtoon.map((m) => [m.material, m.name]),
    [
      [0, 'Skin'],
      [1, 'Hair'],
    ],
  );
  const skin = vrm.mtoon[0];
  assert.equal(skin.shadingToonyFactor, 0.95);
  assert.equal(skin.outlineWidthMode, 'worldCoordinates');
  // Defaults of MToon where the file is silent.
  assert.equal(skin.rimLightingMixFactor, 1);
  assert.deepEqual(skin.matcapFactor, [1, 1, 1]);
  assert.equal(skin.alphaMode, 'OPAQUE');
  assert.deepEqual(vrm.mtoon[1].shadeMultiplyTexture, { index: 0, texCoord: 0 });
  assert.deepEqual(
    vrm.constraints.map((c) => [c.node, c.type, c.source, c.weight]),
    [
      [index.get('badge'), 'rotation', index.get('head'), 1],
      [index.get('leftTwist'), 'roll', index.get('leftHand'), 0.5],
      [index.get('pointer'), 'aim', index.get('leftHand'), 1],
    ],
  );
});

test('a file that is not VRM 1.0 is refused by name, or is simply not a VRM', () => {
  const zero = read((d) => {
    d.extensions = { VRM: { exporterVersion: 'UniVRM-0.99' } };
  });
  assert.equal(zero.vrm, null);
  assert.equal(zero.issues[0].code, 'VRM0_UNSUPPORTED');
  assert.equal(zero.issues[0].path, '$.extensions.VRM');
  assert.match(zero.issues[0].message, /VRM 0\.x.*convert/);
  assert.deepEqual(readZhudaVrm({ asset: { version: '2.0' } }), { vrm: null, issues: [] });
  const version = read((d) => (d.extensions.VRMC_vrm.specVersion = '0.0'));
  assert.equal(version.vrm, null);
  assert.deepEqual(
    [version.issues[0].code, version.issues[0].path],
    ['VRM_SPEC_VERSION', '$.extensions.VRMC_vrm.specVersion'],
  );
  const beta = read((d) => (d.extensions.VRMC_vrm.specVersion = '1.0-beta'));
  assert.ok(beta.vrm);
  assert.equal(beta.issues[0].severity, 'warning');
});

test('deliberate failures: each problem has its code, its path and what was done', () => {
  const missing = read((d) => delete d.extensions.VRMC_vrm.humanoid.humanBones.leftFoot);
  assert.equal(missing.vrm, null);
  assert.deepEqual(
    missing.issues.map((i) => [i.code, i.severity, i.path]),
    [['VRM_MISSING_BONE', 'error', '$.extensions.VRMC_vrm.humanoid.humanBones.leftFoot']],
  );
  const twice = read(
    (d) =>
      (d.extensions.VRMC_vrm.humanoid.humanBones.neck.node =
        d.extensions.VRMC_vrm.humanoid.humanBones.head.node),
  );
  assert.equal(twice.vrm, null);
  assert.ok(
    twice.issues.some(
      (i) => i.code === 'VRM_BONE' && i.severity === 'error' && /already/.test(i.message),
    ),
  );
  const outOfRange = read((d) => (d.extensions.VRMC_vrm.humanoid.humanBones.hips.node = 999));
  assert.equal(outOfRange.vrm, null);
  assert.ok(
    outOfRange.issues.some((i) => i.path === '$.extensions.VRMC_vrm.humanoid.humanBones.hips.node'),
  );
  const meta = read((d) => {
    delete d.extensions.VRMC_vrm.meta.licenseUrl;
    delete d.extensions.VRMC_vrm.meta.avatarPermission;
  });
  assert.equal(meta.vrm, null);
  assert.deepEqual(
    meta.issues.map((i) => i.path),
    ['$.extensions.VRMC_vrm.meta.licenseUrl'],
  );
  const defaults = read((d) => delete d.extensions.VRMC_vrm.meta.avatarPermission);
  assert.equal(defaults.vrm.meta.avatarPermission, 'onlyAuthor');
  // Warnings: the part is left out, the rest is read.
  const bind = read(
    (d) => (d.extensions.VRMC_vrm.expressions.preset.blink.morphTargetBinds[0].index = 7),
  );
  assert.ok(bind.vrm);
  assert.deepEqual(
    bind.issues.map((i) => [i.code, i.path]),
    [
      [
        'VRM_EXPRESSION',
        '$.extensions.VRMC_vrm.expressions.preset.blink.morphTargetBinds[0].index',
      ],
    ],
  );
  assert.equal(bind.vrm.expressions.find((e) => e.name === 'blink').morphs.length, 0);
  const custom = read(
    (d) => (d.extensions.VRMC_vrm.expressions.custom.happy = { morphTargetBinds: [] }),
  );
  assert.ok(custom.issues.some((i) => i.path === '$.extensions.VRMC_vrm.expressions.custom.happy'));
  const unknown = read((d) => (d.extensions.VRMC_vrm.expressions.preset.grin = {}));
  assert.ok(unknown.issues.some((i) => i.path === '$.extensions.VRMC_vrm.expressions.preset.grin'));
  const oneJoint = read((d) => (d.extensions.VRMC_springBone.springs[0].joints.length = 1));
  assert.equal(oneJoint.vrm.springBone.springs.length, 0);
  assert.deepEqual(
    oneJoint.issues.map((i) => i.path),
    ['$.extensions.VRMC_springBone.springs[0].joints'],
  );
  const badDrag = read((d) => (d.extensions.VRMC_springBone.springs[0].joints[0].dragForce = 3));
  assert.equal(badDrag.vrm.springBone.springs[0].joints[0].dragForce, 0.5);
  assert.equal(
    badDrag.issues[0].path,
    '$.extensions.VRMC_springBone.springs[0].joints[0].dragForce',
  );
  const noShape = read((d) => (d.extensions.VRMC_springBone.colliders[0].shape = {}));
  assert.equal(noShape.vrm.springBone.colliders.length, 0);
  assert.ok(
    noShape.issues.some((i) => i.path === '$.extensions.VRMC_springBone.colliders[0].shape'),
  );
  assert.ok(
    noShape.issues.some(
      (i) => i.path === '$.extensions.VRMC_springBone.colliderGroups[0].colliders[0]',
    ),
  );
  // A loop of constraints: both are left out.
  const loop = read((d) => {
    const badge = d.nodes.findIndex((n) => n.name === 'badge'),
      head = d.nodes.findIndex((n) => n.name === 'head');
    d.nodes[head].extensions = {
      VRMC_node_constraint: { specVersion: '1.0', constraint: { rotation: { source: badge } } },
    };
  });
  assert.deepEqual(
    loop.vrm.constraints.map((c) => c.type),
    ['roll', 'aim'],
  );
  assert.equal(loop.issues.filter((i) => /loop/.test(i.message)).length, 2);
  const two = read((d) => {
    const badge = d.nodes.find((n) => n.name === 'badge');
    badge.extensions.VRMC_node_constraint.constraint.aim = { source: 0, aimAxis: 'PositiveX' };
  });
  assert.ok(two.issues.some((i) => /exactly one/.test(i.message)));
  const eyes = read((d) => delete d.extensions.VRMC_vrm.humanoid.humanBones.leftEye);
  assert.ok(eyes.issues.some((i) => i.code === 'VRM_LOOK_AT'));
});

test("the compatibility report takes the VRM 1.0 extensions as the engine's, and VRM 0.x as not implemented", () => {
  for (const name of [
    'VRMC_vrm',
    'VRMC_springBone',
    'VRMC_materials_mtoon',
    'VRMC_node_constraint',
  ])
    assert.equal(
      gltfExtensionCapabilities.find((c) => c.name === name)?.implementation,
      'engine',
      name,
    );
  const bytes = (glb) => glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
  assert.equal(inspectGltfAsset(bytes(buildZhudaTestVrm().glb)).status, 'supported');
  const zero = inspectGltfAsset(
    bytes(
      buildZhudaTestVrm((d) => {
        d.extensionsUsed = [...d.extensionsUsed.filter((n) => n !== 'VRMC_vrm'), 'VRM'];
        d.extensions.VRM = {};
        delete d.extensions.VRMC_vrm;
      }).glb,
    ),
  );
  assert.equal(zero.status, 'degraded');
  assert.ok(
    zero.diagnostics.some(
      (d) => d.code === 'UNSUPPORTED_OPTIONAL_EXTENSION' && d.extension === 'VRM',
    ),
  );
});

test('expression weights follow the specification: clamp, isBinary, block, blend, own kind not counted', () => {
  const e = (name, extra = {}) => ({
    name,
    preset: ['blink', 'aa', 'happy', 'angry', 'lookLeft'].includes(name) ? name : 'custom',
    morphs: [],
    colors: [],
    textures: [],
    isBinary: false,
    overrideBlink: 'none',
    overrideLookAt: 'none',
    overrideMouth: 'none',
    ...extra,
  });
  const all = [
    e('blink'),
    e('aa'),
    e('lookLeft'),
    e('happy', { overrideBlink: 'blend', overrideMouth: 'block' }),
    e('angry', { overrideBlink: 'blend' }),
  ];
  // happy 0.3 blends blink down by 0.3 and blocks the mouth outright.
  let w = zhudaVrmExpressionWeights(all, { blink: 1, aa: 1, happy: 0.3 });
  near(w.get('blink'), 0.7);
  assert.equal(w.get('aa'), 0);
  // Two blends add up and stop at nothing left.
  w = zhudaVrmExpressionWeights(all, { blink: 1, happy: 0.6, angry: 0.7 });
  assert.equal(w.get('blink'), 0);
  // Weights are clamped to 0..1; a missing one is 0.
  w = zhudaVrmExpressionWeights(all, { blink: 4, lookLeft: -2 });
  assert.equal(w.get('blink'), 1);
  assert.equal(w.get('lookLeft'), 0);
  assert.equal(w.get('aa'), 0);
  // A binary overrider acts on its output: at 0.5 it is 0 and overrides nothing.
  const binary = [e('blink'), e('happy', { isBinary: true, overrideBlink: 'block' })];
  assert.equal(zhudaVrmExpressionWeights(binary, { blink: 1, happy: 0.5 }).get('blink'), 1);
  assert.equal(zhudaVrmExpressionWeights(binary, { blink: 1, happy: 0.51 }).get('blink'), 0);
  assert.equal(zhudaVrmExpressionWeights(binary, { happy: 0.51 }).get('happy'), 1);
  // A binary expression that is lowered at all shows nothing.
  const lowered = [e('blink', { isBinary: true }), e('happy', { overrideBlink: 'blend' })];
  assert.equal(zhudaVrmExpressionWeights(lowered, { blink: 1, happy: 0.1 }).get('blink'), 0);
  // Blink's own override of blinking is not counted.
  const own = [e('blink', { overrideBlink: 'block' })];
  assert.equal(zhudaVrmExpressionWeights(own, new Map([['blink', 0.8]])).get('blink'), 0.8);
});

test("gaze: yaw and pitch in the gaze space, range maps, each eye's inner and outer range, the four expressions", () => {
  // +X is the model's left: a point ahead and to the left is a positive yaw; below is a positive pitch.
  const left = zhudaVrmYawPitch([1, 0, 1]);
  near(left.yaw, 45, 1e-12);
  near(left.pitch, 0, 1e-12);
  const down = zhudaVrmYawPitch([0, -1, 1]);
  near(down.pitch, 45, 1e-12);
  near(zhudaVrmYawPitch([0, 0, -1]).yaw, 180, 1e-12);
  const map = { inputMaxValue: 90, outputScale: 10 };
  near(zhudaVrmRangeMap(map, 45), 5);
  near(zhudaVrmRangeMap(map, -45), 5);
  near(zhudaVrmRangeMap(map, 135), 10);
  // A range of 0: nothing at 0, all of it otherwise.
  assert.equal(zhudaVrmRangeMap({ inputMaxValue: 0, outputScale: 7 }, 0), 0);
  near(zhudaVrmRangeMap({ inputMaxValue: 0, outputScale: 7 }, 0.5), 7);
  const look = {
    type: 'bone',
    offsetFromHeadBone: [0, 0.06, 0],
    horizontalInner: { inputMaxValue: 90, outputScale: 10 },
    horizontalOuter: { inputMaxValue: 90, outputScale: 20 },
    verticalDown: { inputMaxValue: 45, outputScale: 9 },
    verticalUp: { inputMaxValue: 90, outputScale: 6 },
  };
  // Looking left: the left eye moves outward, the right eye inward.
  const a = zhudaVrmEyeAngles(look, 45, 0);
  near(a.left.yaw, 10);
  near(a.right.yaw, 5);
  const b = zhudaVrmEyeAngles(look, -45, -45);
  near(b.left.yaw, -5);
  near(b.right.yaw, -10);
  near(b.left.pitch, -3);
  near(zhudaVrmEyeAngles(look, 0, 30).left.pitch, 6);
  assert.deepEqual(
    zhudaVrmLookWeights(
      {
        ...look,
        horizontalOuter: { inputMaxValue: 90, outputScale: 1 },
        verticalUp: { inputMaxValue: 90, outputScale: 1 },
      },
      -45,
      -90,
    ),
    {
      lookLeft: 0,
      lookRight: 0.5,
      lookDown: 0,
      lookUp: 1,
    },
  );
  // The turn: yaw about +Y takes +Z toward +X; pitch about +X takes +Y toward +Z (the eye looks down).
  nearAll(zhudaQuatRotate(zhudaVrmYawPitchTurn(90, 0), [0, 0, 1]), [1, 0, 0], 1e-12);
  nearAll(zhudaQuatRotate(zhudaVrmYawPitchTurn(0, 90), [0, 0, 1]), [0, -1, 0], 1e-12);
});

test("a VRM joint on the engine's solver: rates a second that hang a bone where VRM hangs it", () => {
  const joint = {
    node: 0,
    hitRadius: 0.02,
    stiffness: 1,
    gravityPower: 0.05,
    gravityDir: [0, -1, 0],
    dragForce: 0.4,
  };
  const s = zhudaVrmSpringSetting(joint, 0.1);
  near(s.stiffness, 10);
  near(s.drag, -60 * Math.log(0.6));
  nearAll(s.gravity, [0, -6, 0], 1e-12);
  assert.equal(s.radius, 0.02);
  assert.equal(zhudaVrmSpringSetting({ ...joint, dragForce: 1 }, 0.1).drag, 100);
  assert.equal(zhudaVrmSpringSetting({ ...joint, stiffness: 400 }, 0.1).stiffness, 1000);
  assert.throws(() => zhudaVrmSpringSetting(joint, 0), /bone length/);
  // Where a bone rests: VRM's stiffness push s and gravity push g give tan θ = g / s
  // for a bone held level; the solver at these rates hangs it at the same angle.
  const solver = new ZhudaSpringBoneSolver();
  const level = { ...joint, stiffness: 1, gravityPower: 0.25 };
  const setting = zhudaVrmSpringSetting(level, 0.1);
  const id = solver.addChain(
    { rotations: [[0, 0, 0, 1]], axes: [[1, 0, 0]], lengths: [0.1] },
    { bones: [setting] },
  );
  solver.setAnchor(id, [0, 0, 0], [0, 0, 0, 1]);
  for (let i = 0; i < 2000; i++) solver.advance(1 / 60);
  const tail = solver.tails(id);
  const hang = (Math.atan2(-tail[1], tail[0]) * 180) / Math.PI;
  // Small-angle VRM: θ ≈ g / s = 0.25 rad = 14.3°; at rest the solver is within a degree of it.
  near(hang, (0.25 * 180) / Math.PI, 1, 'hang angle');
  solver.dispose();
});

test("per-bone settings on the solver: checked, and the same as the chain's when they say the same", () => {
  const rest = {
    rotations: [
      [0, 0, 0, 1],
      [0, 0, 0, 1],
    ],
    axes: [
      [0, -1, 0],
      [0, -1, 0],
    ],
    lengths: [0.1, 0.1],
  };
  const run = (options) => {
    const solver = new ZhudaSpringBoneSolver();
    const id = solver.addChain(rest, options);
    for (let i = 0; i < 90; i++) {
      solver.setAnchor(id, [Math.sin(i / 9) * 0.2, 0, 0], [0, 0, 0, 1]);
      solver.advance(1 / 60);
    }
    const out = Float64Array.from(solver.tails(id));
    solver.dispose();
    return out;
  };
  const plain = run({ stiffness: 5, drag: 3 });
  const same = run({ stiffness: 5, drag: 3, bones: [{ stiffness: 5 }, { drag: 3 }] });
  assert.deepEqual([...same], [...plain], 'bit for bit');
  const own = run({ stiffness: 5, drag: 3, bones: [{}, { stiffness: 50, gravity: [0, 0, 0] }] });
  assert.notDeepEqual([...own], [...plain]);
  const solver = new ZhudaSpringBoneSolver();
  assert.throws(() => solver.addChain(rest, { bones: [{}, {}, {}] }), /at most one setting a bone/);
  assert.throws(
    () => solver.addChain(rest, { bones: [{ springiness: 1 }] }),
    /Unknown bone setting: bones\[0\]\.springiness/,
  );
  assert.throws(() => solver.addChain(rest, { bones: [{ drag: 500 }] }), /Invalid drag/);
  assert.throws(() => solver.addChain(rest, { bones: [{ gravity: [0, 1] }] }), /bones\[0\]/);
  solver.dispose();
});

test("node constraints as the specification's examples: rotation, roll, aim, with their weights", () => {
  const rest = [0, 0, 0, 1];
  const turned = axisAngle([0, 1, 0], 30);
  const rotation = { node: 1, type: 'rotation', source: 0, weight: 1 };
  nearAll(
    zhudaVrmConstraintRotation(rotation, { nodeRest: rest, sourceRest: rest, source: turned }),
    turned,
    1e-12,
  );
  near(
    angleOf(
      zhudaVrmConstraintRotation(
        { ...rotation, weight: 0.5 },
        { nodeRest: rest, sourceRest: rest, source: turned },
      ),
    ),
    15,
    1e-9,
  );
  // From the source's own rest: a source that rests turned and is still adds nothing.
  const restTurned = axisAngle([1, 0, 0], 50);
  nearAll(
    zhudaVrmConstraintRotation(rotation, {
      nodeRest: rest,
      sourceRest: restTurned,
      source: restTurned,
    }),
    rest,
    1e-12,
  );
  // Roll about X: a twist is copied, a swing is not.
  const roll = { node: 1, type: 'roll', source: 0, weight: 1, rollAxis: 'X' };
  const twist = axisAngle([1, 0, 0], 40);
  near(
    angleOf(zhudaVrmConstraintRotation(roll, { nodeRest: rest, sourceRest: rest, source: twist })),
    40,
    1e-9,
  );
  near(
    angleOf(
      zhudaVrmConstraintRotation(roll, {
        nodeRest: rest,
        sourceRest: rest,
        source: axisAngle([0, 1, 0], 35),
      }),
    ),
    0,
    1e-6,
  );
  near(
    angleOf(
      zhudaVrmConstraintRotation(
        { ...roll, weight: 0.5 },
        { nodeRest: rest, sourceRest: rest, source: twist },
      ),
    ),
    20,
    1e-9,
  );
  // Aim +Z at a source on +X: the node's +Z turns to +X.
  const aim = { node: 1, type: 'aim', source: 0, weight: 1, aimAxis: 'PositiveZ' };
  const q = zhudaVrmConstraintRotation(aim, {
    nodeRest: rest,
    sourceRest: rest,
    source: rest,
    nodePosition: [0, 0, 0],
    sourcePosition: [2, 0, 0],
  });
  nearAll(zhudaQuatRotate(q, [0, 0, 1]), [1, 0, 0], 1e-12);
  // Under a parent turned 90° about Y, the same aim in the world.
  const parent = axisAngle([0, 1, 0], 90);
  const q2 = zhudaVrmConstraintRotation(aim, {
    nodeRest: rest,
    sourceRest: rest,
    source: rest,
    parentWorld: parent,
    nodePosition: [0, 0, 0],
    sourcePosition: [0, 0, -3],
  });
  nearAll(zhudaQuatRotate(parent, zhudaQuatRotate(q2, [0, 0, 1])), [0, 0, -1], 1e-12);
  assert.throws(
    () => zhudaVrmConstraintRotation(aim, { nodeRest: rest, sourceRest: rest, source: rest }),
    /positions/,
  );
  nearAll(zhudaQuatSlerp(rest, turned, 1), turned, 1e-12);
});

test('MToon as a toon material: bands, shade colour, rim, outline, ambient, what is not drawn', () => {
  const { vrm } = read();
  const [skin, hair] = vrm.mtoon.map((m) => zhudaVrmToonPlan(m, { screenHeight: 720 }));
  for (const plan of [skin, hair])
    assert.deepEqual(validateZhudaToonSpec({ name: 'ZhudaVrmTest', ...plan.spec }), []);
  // Two bands on 0.5 + 0.5 N·L, edge at MToon's middle, as soft as the toony factor leaves it.
  assert.deepEqual(skin.spec.ramp.edges, [0.5]);
  assert.deepEqual(skin.spec.ramp.levels, [0, 1]);
  near(skin.spec.ramp.softness, 0.05, 1e-12);
  near(hair.spec.ramp.softness, 0.1, 1e-12);
  // Skin has no shade texture: its shade colour alone. Hair's is its picture: a tint of the base.
  assert.equal(skin.spec.shade.multiply, false);
  nearAll(skin.spec.shade.color.map(zhudaSrgbToLinear), [0.55, 0.22, 0.2], 1e-6);
  assert.equal(hair.spec.shade.multiply, true);
  nearAll(hair.spec.shade.color.map(zhudaSrgbToLinear), [0.06 / 0.25, 0.06 / 0.3, 0.3 / 0.9], 1e-6);
  assert.equal(hair.textures.albedo, 0);
  assert.equal(skin.spec.ambient.flat, 0.9);
  assert.equal(skin.spec.outline.space, 'world');
  assert.equal(skin.spec.outline.width, 0.006);
  // Where MToon's rim reaches half: 1 − 0.5^(1/5).
  near(skin.spec.rim.width, 1 - Math.pow(0.5, 1 / 5), 1e-12);
  assert.equal(hair.spec.rim, undefined);
  assert.equal(hair.spec.outline, undefined);
  assert.deepEqual(skin.issues, []);
  // Display colours are the inverse of LayaAir's conversion.
  for (const v of [0, 0.002, 0.2, 0.5, 1]) near(zhudaSrgbToLinear(zhudaLinearToSrgb(v)), v, 1e-12);
  // Screen outlines are a share of the picture's height; what is not drawn is said.
  const screen = zhudaVrmToonPlan(
    {
      ...vrm.mtoon[0],
      outlineWidthMode: 'screenCoordinates',
      outlineWidthFactor: 0.004,
      matcapTexture: { index: 0, texCoord: 0 },
      uvAnimationScrollXSpeedFactor: 1,
      alphaMode: 'MASK',
      alphaCutoff: 0.3,
      doubleSided: true,
      shadingShiftFactor: -0.2,
    },
    { screenHeight: 720 },
  );
  near(screen.spec.outline.width, 2.88, 1e-12);
  assert.equal(screen.spec.outline.space, 'screen');
  assert.deepEqual(
    screen.issues.map((i) => i.path.split('.').pop()),
    ['matcapTexture', 'uvAnimationScrollXSpeedFactor'],
  );
  assert.equal(screen.spec.material.blend, 'cutout');
  assert.equal(screen.spec.material.alphaCutoff, 0.3);
  assert.equal(screen.spec.material.doubleSided, true);
  near(screen.spec.ramp.edges[0], 0.6, 1e-12);
  const blended = zhudaVrmToonPlan({
    ...vrm.mtoon[0],
    alphaMode: 'BLEND',
    transparentWithZWrite: true,
    renderQueueOffsetNumber: 3,
  });
  assert.equal(blended.spec.material.depthWrite, true);
  assert.equal(blended.renderQueueOffset, 3);
  const other = zhudaVrmToonPlan({
    ...vrm.mtoon[1],
    shadeMultiplyTexture: { index: 5, texCoord: 0 },
  });
  assert.equal(other.spec.shade.multiply, false);
  assert.ok(other.issues.some((i) => /shade texture other than/.test(i.message)));
});

test("the toon material's shade colour is checked like its other colours", () => {
  assert.deepEqual(
    validateZhudaToonSpec({ name: 'ZhudaT', shade: { color: [0.2, 0.1, 0.3] } }),
    [],
  );
  assert.deepEqual(validateZhudaToonSpec({ name: 'ZhudaT', shade: { color: [2, 0, 0] } }), [
    'shade.color: three numbers 0..1',
  ]);
  assert.deepEqual(
    validateZhudaToonSpec({ name: 'ZhudaT', shade: { color: [0, 0, 0], multiply: 'yes' } }),
    ['shade.multiply: true or false'],
  );
});
