// games/tools/characters/motion-audit.mjs: what a character's .glb says about how it will move,
// measured as the reference of the route `smooth-character-motion` was measured, and the bar of
// the route `high-quality-character`. The files are made here, small, so that each measure is
// known; the last test reads the repository's own characters, whose numbers the route quotes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CHARACTER_BAR,
  GROUPS,
  auditCharacter,
  describeAudit,
  plainName,
} from '../games/tools/characters/motion-audit.mjs';

const about = (axis, degrees) => {
  const half = (degrees * Math.PI) / 360;
  return [
    axis[0] * Math.sin(half),
    axis[1] * Math.sin(half),
    axis[2] * Math.sin(half),
    Math.cos(half),
  ];
};
const swing =
  (degrees, period, phase = 0) =>
  (t) =>
    about([1, 0, 0], degrees * Math.sin((2 * Math.PI * t) / period + phase));

/**
 * A skinned triangle on a chain of joints with clips. `joints`: names, each a child of the one
 * before unless `parent` says otherwise. A clip: { name, seconds, rate, close (default true: the
 * last key is the first again), mode, turns: { joint: (t) => quaternion } }.
 */
function makeGlb({ joints, clips = [], weights = [[1, 0, 0, 0]], quantize = false }) {
  const chunks = [];
  let length = 0;
  const bufferViews = [],
    accessors = [];
  const push = (array, type, extra = {}) => {
    const pad = (4 - (length % 4)) % 4;
    if (pad) chunks.push(new Uint8Array(pad));
    length += pad;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length });
    chunks.push(bytes);
    length += bytes.length;
    const width = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const componentType = {
      Float32Array: 5126,
      Uint16Array: 5123,
      Uint8Array: 5121,
      Int16Array: 5122,
    }[array.constructor.name];
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType,
      count: array.length / width,
      type,
      ...extra,
    });
    return accessors.length - 1;
  };
  const nodes = joints.map((j) => ({ name: typeof j === 'string' ? j : j.name, children: [] }));
  joints.forEach((j, i) => {
    const parent = typeof j === 'string' ? i - 1 : (j.parent ?? i - 1);
    if (parent >= 0) nodes[parent].children.push(i);
  });
  const attributes = {
    POSITION: push(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 'VEC3', {
      min: [0, 0, 0],
      max: [1, 1, 0],
    }),
    JOINTS_0: push(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'VEC4'),
  };
  weights.forEach((set, k) => {
    attributes[`WEIGHTS_${k}`] = push(new Float32Array([...set, ...set, ...set]), 'VEC4');
    if (k) attributes[`JOINTS_${k}`] = attributes.JOINTS_0;
  });
  const indices = push(new Uint16Array([0, 1, 2]), 'SCALAR');
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const inverseBindMatrices = push(new Float32Array(joints.flatMap(() => identity)), 'MAT4');
  const animations = clips.map((clip) => {
    const rate = clip.rate ?? 30;
    const keys = Math.round(clip.seconds * rate) + (clip.close === false ? 0 : 1);
    const times = Array.from({ length: keys }, (_, k) => k / rate);
    const input = push(new Float32Array(times), 'SCALAR', { min: [0], max: [times[keys - 1]] });
    const samplers = [],
      channels = [];
    for (const [joint, turn] of Object.entries(clip.turns)) {
      const node = nodes.findIndex((n) => n.name === joint);
      const values = times.flatMap((t) => {
        const q = turn(t);
        return clip.mode === 'CUBICSPLINE' ? [0, 0, 0, 0, ...q, 0, 0, 0, 0] : q;
      });
      const output = quantize
        ? push(new Int16Array(values.map((v) => Math.round(v * 32767))), 'VEC4', {
            normalized: true,
          })
        : push(new Float32Array(values), 'VEC4');
      samplers.push({ input, output, interpolation: clip.mode ?? 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node, path: 'rotation' } });
    }
    return { name: clip.name, samplers, channels };
  });
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, joints.length] }],
    nodes: [...nodes, { name: 'body', mesh: 0, skin: 0 }],
    meshes: [{ primitives: [{ attributes, indices }] }],
    skins: [{ joints: joints.map((_, i) => i), inverseBindMatrices }],
    animations,
    bufferViews,
    accessors,
    buffers: [{ byteLength: length }],
  };
  if (!animations.length) delete json.animations;
  let text = JSON.stringify(json);
  text += ' '.repeat((4 - (text.length % 4)) % 4);
  const body = new Uint8Array(length + ((4 - (length % 4)) % 4));
  let at = 0;
  for (const c of chunks) {
    body.set(c, at);
    at += c.length;
  }
  const out = new Uint8Array(12 + 8 + text.length + 8 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, text.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(new TextEncoder().encode(text), 20);
  view.setUint32(20 + text.length, body.length, true);
  view.setUint32(24 + text.length, 0x004e4942, true);
  out.set(body, 28 + text.length);
  return out;
}

const HUMAN = [
  'root',
  'hips',
  'spine',
  'head',
  { name: 'upperArmL', parent: 2 },
  'upperArmTwistL',
  'forearmL',
  'forearmTwistL',
  { name: 'upperArmR', parent: 2 },
  'upperArmTwistR',
  'forearmR',
  'forearmTwistR',
  { name: 'thighL', parent: 1 },
  'shinL',
  { name: 'Bone_Hair_01', parent: 3 },
  'Bone_Hair_02',
  'Bone_Hair_end',
  { name: 'skirtF', parent: 1 },
];
const verdict = (audit, id) => audit.bar.find((v) => v.id === id);

test('bones are sorted by what their names say, read as plain words', () => {
  assert.equal(plainName('Bip001_L_Knee_F'), 'bip001 l knee f');
  assert.equal(plainName('leftEar'), 'left ear');
  const group = (name) =>
    Object.keys(GROUPS).find((g) => GROUPS[g].test(plainName(name))) ?? 'body';
  const sorted = {
    'Bip001 L Forearm': 'body', // "ear" inside "forearm" is not an ear
    Bip001LUpArmTwist1: 'twist',
    Bone_HandTwist_L: 'twist',
    Bip001_L_Knee_F: 'corrective',
    Bip001_Shoulder_R_B: 'corrective',
    robeF: 'secondary', // a cloth bone's front is cloth, not a corrective bone
    Bone_Skirt032_B: 'secondary',
    leftEar: 'secondary',
    'ear.L': 'secondary',
    'tail.tip': 'secondary',
    Bone_Piao182_L: 'secondary',
    ponytail3: 'secondary',
    Bip001LFinger21: 'finger',
    'thumb.01.L': 'finger',
    Facial_Mouth_a_01_M: 'face',
    eyeL: 'face',
    hips: 'body',
    spear: 'body',
  };
  for (const [name, expected] of Object.entries(sorted)) assert.equal(group(name), expected, name);
});

test('a character made as the reference is made passes, and the audit says what it measured', () => {
  const audit = auditCharacter(
    makeGlb({
      joints: HUMAN,
      clips: [
        {
          name: 'Idle_Loop',
          seconds: 12,
          turns: {
            spine: swing(3, 6),
            head: swing(5, 4),
            upperArmL: swing(8, 12),
            upperArmTwistL: swing(4, 12),
            Bone_Hair_01: swing(12, 3, 0.5),
            Bone_Hair_02: swing(18, 3, 1),
            skirtF: swing(6, 4),
          },
        },
        {
          name: 'Wave',
          seconds: 2,
          turns: {
            upperArmR: swing(60, 2),
            forearmR: swing(40, 1),
            Bone_Hair_01: swing(5, 1),
            Bone_Hair_02: swing(9, 1),
            skirtF: swing(3, 2),
          },
        },
      ],
    }),
  );
  assert.equal(audit.rig.joints, 18);
  assert.equal(audit.rig.humanoid, true);
  assert.deepEqual(audit.rig.twist, [
    'upperArmTwistL',
    'forearmTwistL',
    'upperArmTwistR',
    'forearmTwistR',
  ]);
  // The bone that only ends the hair chain is not asked to move.
  assert.equal(audit.rig.groups.secondary, 3);
  assert.deepEqual(audit.mesh, {
    vertices: 3,
    triangles: 1,
    morphTargets: 0,
    mostJointsOnAVertex: 1,
    shareOnThreeOrMore: 0,
  });
  const [idle, wave] = audit.clips;
  assert.deepEqual(
    [idle.name, idle.seconds, idle.keysPerSecond, idle.loop, idle.jointsKeyed],
    ['Idle_Loop', 12, 30, true, 7],
  );
  assert.deepEqual(idle.moving, { body: 3, twist: 1, secondary: 3 });
  assert.ok(idle.seam.degrees < 1e-3 && !idle.seam.open.length);
  assert.equal(wave.loop, false);
  assert.ok(audit.passes);
  for (const id of [
    'dense-keys',
    'secondary-in-clips',
    'loop-seam',
    'idle-length',
    'no-pops',
    'twist-bones',
  ])
    assert.equal(verdict(audit, id).ok, true, id);
  assert.equal(verdict(audit, 'secondary-in-clips').value, 1);
  assert.match(describeAudit(audit, 'made-here'), /made-here: 18 joints .*human rig/);
  assert.match(describeAudit(audit), /passes every must; this says nothing of how it looks/);
});

test('keys joined by straight lines must be dense; a cubic spline carries its own curve', () => {
  const clip = (rate, mode) => ({
    name: 'Idle',
    seconds: 4,
    rate,
    mode,
    turns: { spine: swing(10, 4) },
  });
  const sparse = auditCharacter(makeGlb({ joints: ['root', 'spine'], clips: [clip(10)] }));
  assert.equal(sparse.clips[0].keysPerSecond, 10);
  assert.equal(verdict(sparse, 'dense-keys').ok, false);
  assert.match(verdict(sparse, 'dense-keys').note, /Idle 10/);
  assert.equal(sparse.passes, false);
  const dense = auditCharacter(
    makeGlb({ joints: ['root', 'spine'], clips: [clip(CHARACTER_BAR.keysPerSecond)] }),
  );
  assert.equal(verdict(dense, 'dense-keys').ok, true);
  const spline = auditCharacter(
    makeGlb({ joints: ['root', 'spine'], clips: [clip(2, 'CUBICSPLINE')] }),
  );
  assert.equal(spline.clips[0].keysPerSecond, null);
  assert.equal(verdict(spline, 'dense-keys').ok, null);
  // A bone that does not turn may keep two keys: it is not what the density is asked of.
  const still = auditCharacter(
    makeGlb({
      joints: ['root', 'spine', 'head'],
      clips: [
        { name: 'Idle', seconds: 4, turns: { spine: swing(10, 4) } },
        { name: 'Pose', seconds: 4, rate: 0.25, turns: { head: () => [0, 0, 0, 1] } },
      ],
    }),
  );
  assert.deepEqual(
    still.clips.map((c) => c.keysPerSecond),
    [30, null],
  );
  assert.equal(verdict(still, 'dense-keys').ok, true);
});

test('hair and cloth must move inside the clips, unless they are left to a solver on purpose', () => {
  const glb = makeGlb({
    joints: HUMAN,
    clips: [
      { name: 'Idle', seconds: 8, turns: { spine: swing(3, 8), Bone_Hair_01: swing(10, 4) } },
      { name: 'Greet', seconds: 2, turns: { upperArmR: swing(50, 2) } },
    ],
  });
  const audit = auditCharacter(glb);
  const v = verdict(audit, 'secondary-in-clips');
  assert.deepEqual([v.ok, v.value, v.level], [false, 0, 'must']);
  assert.match(v.note, /least in Greet/);
  assert.equal(audit.passes, false);
  const left = auditCharacter(glb, { secondaryAtRunTime: true });
  assert.equal(verdict(left, 'secondary-in-clips').ok, null);
  assert.match(verdict(left, 'secondary-in-clips').note, /3 bones/);
  assert.equal(left.passes, true);
  // A rig with nothing to lag behind it is told so, and is not failed for it.
  const bare = auditCharacter(
    makeGlb({
      joints: ['root', 'hips', 'spine'],
      clips: [{ name: 'Idle', seconds: 8, turns: { spine: swing(3, 8) } }],
    }),
  );
  assert.deepEqual(
    [verdict(bare, 'secondary-in-clips').ok, verdict(bare, 'secondary-in-clips').level],
    [null, 'should'],
  );
  // Bones named otherwise are found by the caller's pattern, on the name as written.
  const named = auditCharacter(
    makeGlb({
      joints: ['root', 'Kami_A', 'Kami_B'],
      clips: [{ name: 'Idle', seconds: 8, turns: { Kami_A: swing(9, 4), Kami_B: swing(9, 4) } }],
    }),
    { secondary: /^Kami_/ },
  );
  assert.equal(named.rig.groups.secondary, 2);
  assert.equal(verdict(named, 'secondary-in-clips').ok, true);
});

test('a loop closes: a left-out closing key is no jump, a bone that ends elsewhere is named', () => {
  const turns = { spine: swing(10, 4), Bone_Hair_01: swing(15, 2) };
  const closed = auditCharacter(
    makeGlb({ joints: HUMAN, clips: [{ name: 'Walk', seconds: 4, turns }] }),
  );
  assert.ok(closed.clips[0].seam.degrees < 1e-3);
  assert.equal(verdict(closed, 'loop-seam').ok, true);
  // Without its closing key the clip stops one step short of its start: as large as any step of it.
  const short = auditCharacter(
    makeGlb({ joints: HUMAN, clips: [{ name: 'Walk', seconds: 4, close: false, turns }] }),
  );
  assert.ok(short.clips[0].seam.degrees > CHARACTER_BAR.seamDegrees);
  assert.deepEqual(short.clips[0].seam.open, []);
  assert.equal(verdict(short, 'loop-seam').ok, true);
  // One bone that ends 20 degrees from where it began: every other bone closes.
  const drift = (t) => about([1, 0, 0], (20 * t) / 4);
  const open = auditCharacter(
    makeGlb({
      joints: HUMAN,
      clips: [{ name: 'Walk', seconds: 4, turns: { ...turns, skirtF: drift } }],
    }),
  );
  assert.deepEqual(open.clips[0].seam.open, ['skirtF']);
  assert.ok(Math.abs(open.clips[0].seam.degrees - 20) < 0.01);
  assert.equal(verdict(open, 'loop-seam').ok, false);
  assert.match(verdict(open, 'loop-seam').note, /Walk \(1 bones: skirtF\)/);
  assert.equal(open.passes, false);
  // A bone that jumps on its very last key: its last step is the jump, and is not taken for an
  // ordinary step (one loop of the reference does this on a ribbon bone).
  const snap = (t) => about([1, 0, 0], t > 3.98 ? 44 : 0);
  const snapped = auditCharacter(
    makeGlb({
      joints: HUMAN,
      clips: [{ name: 'Walk', seconds: 4, turns: { ...turns, skirtF: snap } }],
    }),
  );
  assert.deepEqual(snapped.clips[0].seam.open, ['skirtF']);
  assert.equal(verdict(snapped, 'loop-seam').ok, false);
  // A clip that is not a loop by its name is not asked to close; the caller may say which are.
  const named = makeGlb({
    joints: HUMAN,
    clips: [{ name: 'Sway', seconds: 4, turns: { skirtF: drift } }],
  });
  assert.equal(verdict(auditCharacter(named), 'loop-seam').ok, null);
  assert.equal(verdict(auditCharacter(named, { loops: /sway/i }), 'loop-seam').ok, false);
});

test('a short idle and a pop are weak points, not failures', () => {
  const pop = (t) => about([1, 0, 0], t > 1 && t < 1.05 ? 60 : 0);
  const audit = auditCharacter(
    makeGlb({
      joints: HUMAN,
      clips: [
        {
          name: 'Idle',
          seconds: 3,
          turns: {
            spine: swing(4, 3),
            Bone_Hair_01: pop,
            Bone_Hair_02: swing(9, 3),
            skirtF: swing(5, 3),
          },
        },
      ],
    }),
  );
  const idle = verdict(audit, 'idle-length');
  assert.deepEqual([idle.ok, idle.value, idle.level], [false, 3, 'should']);
  const pops = verdict(audit, 'no-pops');
  assert.deepEqual([pops.ok, pops.level], [false, 'should']);
  assert.ok(pops.value > CHARACTER_BAR.turnRate, `${pops.value} degrees a second`);
  assert.match(pops.note, /Idle: Bone_Hair_01/);
  assert.equal(audit.passes, true);
  assert.equal(
    verdict(
      auditCharacter(
        makeGlb({
          joints: HUMAN,
          clips: [{ name: 'Idle', seconds: 3, turns: { spine: swing(4, 3) } }],
        }),
        { bar: { idleSeconds: 2 } },
      ),
      'idle-length',
    ).ok,
    true,
  );
});

test('a human rig is asked for twist bones; other rigs are not', () => {
  const clip = { name: 'Idle', seconds: 8, turns: { spine: swing(3, 8) } };
  const none = auditCharacter(
    makeGlb({
      joints: ['root', 'hips', 'spine', 'armL', 'foreL', 'thighL', 'shinL'],
      clips: [clip],
    }),
  );
  assert.equal(none.rig.humanoid, true);
  assert.deepEqual(
    [verdict(none, 'twist-bones').ok, verdict(none, 'twist-bones').value],
    [false, 0],
  );
  assert.equal(none.passes, true, 'twist bones are a should');
  const pig = auditCharacter(
    makeGlb({ joints: ['root', 'hips', 'spine', 'leg.L', 'ear.L'], clips: [clip] }),
  );
  assert.equal(pig.rig.humanoid, false);
  assert.equal(verdict(pig, 'twist-bones'), undefined);
  assert.equal(
    verdict(
      auditCharacter(makeGlb({ joints: ['root', 'spine'], clips: [clip] }), { humanoid: true }),
      'twist-bones',
    ).ok,
    false,
  );
});

test('what the file is: quantized turns, a vertex on five joints, no clip, not a .glb', () => {
  const quantized = auditCharacter(
    makeGlb({
      joints: ['root', 'spine'],
      quantize: true,
      clips: [{ name: 'Idle', seconds: 8, turns: { spine: swing(10, 8) } }],
    }),
  );
  assert.equal(quantized.clips[0].keysPerSecond, 30);
  assert.deepEqual(quantized.clips[0].moving, { body: 1 });
  assert.ok(quantized.clips[0].seam.degrees < 0.01);
  const five = auditCharacter(
    makeGlb({
      joints: ['root', 'spine'],
      weights: [
        [0.3, 0.3, 0.2, 0.1],
        [0.1, 0, 0, 0],
      ],
      clips: [{ name: 'Idle', seconds: 8, turns: { spine: swing(10, 8) } }],
    }),
  );
  assert.equal(five.mesh.mostJointsOnAVertex, 5);
  assert.equal(verdict(five, 'joints-on-a-vertex').ok, false);
  assert.equal(five.passes, false);
  const still = auditCharacter(makeGlb({ joints: ['root', 'spine'] }));
  assert.deepEqual([verdict(still, 'clips').ok, still.passes], [false, false]);
  assert.throws(() => auditCharacter(new Uint8Array(40)), /not a \.glb/);
});

test("the repository's own characters stand where the route says they stand", () => {
  const read = (file) =>
    auditCharacter(new Uint8Array(fs.readFileSync(new URL(`../${file}`, import.meta.url))));
  const stickman = read('prefabs/3d/stickman/assets/stickman.glb');
  assert.equal(stickman.passes, true);
  assert.deepEqual(
    [stickman.rig.joints, stickman.rig.groups.secondary, stickman.rig.twist.length],
    [20, 0, 0],
  );
  assert.deepEqual(
    stickman.clips.map((c) => [c.name, c.seconds, c.keysPerSecond]),
    [
      ['Idle_HandsOnHips', 4, 30],
      ['Idle_ArmsCrossed', 3.2, 30],
    ],
  );
  const body = read('games/zhuda-wardrobe/assets/parts/body.glb');
  assert.equal(body.rig.humanoid, true);
  assert.equal(body.rig.twist.length, 0);
  assert.deepEqual(body.rig.secondary, ['robeF', 'robeB', 'hair1', 'hair2']);
  assert.equal(verdict(body, 'dense-keys').ok, true);
  assert.equal(verdict(body, 'secondary-in-clips').ok, false);
  assert.equal(body.clips.find((c) => c.name === 'Idle').seconds, 3.2);
  const pig = read('prefabs/3d/zhuda-characters/assets/zhuda.glb');
  assert.equal(pig.rig.humanoid, false);
  assert.deepEqual(pig.rig.secondary, [
    'ear.L',
    'ear.L.tip',
    'ear.R',
    'ear.R.tip',
    'tail',
    'tail.tip',
  ]);
  assert.equal(pig.rig.groups.secondary, 3);
  assert.ok(pig.clips.every((c) => c.keysPerSecond === 21 && !c.moving.secondary));
  assert.equal(pig.passes, false);
  // Its ears and tail are a solver's at run time (prefabs/3d/island-pig): said so, the clips are not failed for them.
  assert.equal(
    verdict(
      auditCharacter(
        new Uint8Array(
          fs.readFileSync(
            new URL('../prefabs/3d/zhuda-characters/assets/zhuda.glb', import.meta.url),
          ),
        ),
        { secondaryAtRunTime: true },
      ),
      'secondary-in-clips',
    ).ok,
    null,
  );
});
