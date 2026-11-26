// What a character's file says about how it will move, before anyone watches it.
//
// The measures are the ones taken on a commercial game's character showcase (route
// `smooth-character-motion`): how dense the keys are, whether hair, cloth and tails move inside
// the clips or wait for a solver, how a loop closes, how long it is, whether the rig carries
// twist and corrective bones, how many joints hold a vertex. The route `high-quality-character`
// turns them into a bar; this file reads a `.glb` and says where it stands against it.
//
//   node games/tools/characters/motion-audit.mjs model.glb [--json]
//        [--secondary <regex>] [--twist <regex>] [--corrective <regex>] [--loops <regex>]
//        [--humanoid yes|no|auto] [--idle-seconds 8] [--secondary-at-run-time]
//
//   import { auditCharacter, describeAudit } from './motion-audit.mjs';
//   const audit = auditCharacter(bytes, { secondary: /hair|skirt/i });
//   audit.bar -> [{ id, level: 'must' | 'should', ok: true | false | null, value, need, note }]
//
// It reads names and numbers only: nothing is drawn, and a file that passes can still look wrong.
// Bones are sorted by NAME (see GROUPS): a rig with other names needs the patterns given. A name is
// read in a plain form first (`leftEar`, `Bone_Hair_01`, `ear.L` become `left ear`, `bone hair 01`,
// `ear l`), so that `ear` is found in those and not in `forearm`.
const TYPES = { 5120: [Int8Array, 1, 127], 5121: [Uint8Array, 1, 255], 5122: [Int16Array, 2, 32767], 5123: [Uint16Array, 2, 65535], 5125: [Uint32Array, 4, 4294967295], 5126: [Float32Array, 4, 1] };
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** A bone's name as plain words: camel case, underscores, dots and hyphens become spaces, all lower case. */
export const plainName = (name) =>
  String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.\-:]+/g, ' ')
    .toLowerCase()
    .trim();

/**
 * How bones are sorted when no pattern is given, on their plain names. The first that matches
 * wins, in this order: a cloth bone called `skirt f` is cloth, a body bone called `thigh f` is a
 * corrective bone.
 */
export const GROUPS = {
  twist: /twist|\broll\b/,
  secondary: /\b(hair|bangs?|(pony|pig)?tail|strand|skirt|cloth|cape|scarf|ribbon|sleeve|robe|ears?|tassel|fur|feather|wing|chain|cord|piao)\d*\b/,
  corrective: /corrective|helper|\b(fix|adj)\b|\b(f|b|in|out|up|dn)$/,
  finger: /finger|thumb|\b(index|middle|ring|pinky|little)\b/,
  face: /\b(eye|brow|lid|mouth|lip|jaw|tongue|teeth|cheek|nose)/,
};
/** A bone that only marks where a chain ends is not asked to move. */
const ENDS = /\b(tip|end|nub)\b/;

/** The bar of the route `high-quality-character`, with where each number comes from. */
export const CHARACTER_BAR = {
  /** Keys a second under linear interpolation. The reference bakes 30; below about 24 a turn shows its corners. */
  keysPerSecond: 24,
  /** Share of the hair, cloth and tail bones that move inside each clip. The reference: 70 of 70, 32 of 32, 82 of 91. */
  secondaryMoving: 0.8,
  /** A loop's jump from its last key to its first: degrees and metres. The reference closes within 0.25 degrees. */
  seamDegrees: 0.5,
  seamMetres: 0.001,
  /** Seconds of a loop that is watched standing still. The reference: 18.7 and 21.3. Chosen here, not measured. */
  idleSeconds: 8,
  /** Twist bones on a human rig: one in each upper arm and forearm at the least. The reference: 32 twist and corrective bones. */
  twistBones: 4,
  /** Degrees a second a bone may turn between two keys before it is called a pop. Chosen here: the reference's one pop is 1,321. */
  turnRate: 1200,
  /** A bone moves when it turns more than this from its first key, or goes farther than this. */
  movingDegrees: 1,
  movingMetres: 0.002,
};

export function readGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) throw Error('motion-audit: not a .glb (a .gltf with separate files is not read)');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  const at = 20 + jsonLength;
  const bin = at + 8 <= bytes.byteLength ? bytes.subarray(at + 8, at + 8 + view.getUint32(at, true)) : new Uint8Array(0);
  return { json, bin };
}

/** An accessor as rows of numbers; normalized integers become the fractions they stand for. */
export function rows({ json, bin }, index) {
  const a = json.accessors[index];
  if (a.sparse) throw Error(`motion-audit: accessor ${index} is sparse, which is not read`);
  const view = json.bufferViews[a.bufferView];
  if ((view.buffer ?? 0) !== 0) throw Error('motion-audit: only the file\'s own binary chunk is read');
  const [, size, most] = TYPES[a.componentType];
  const width = WIDTH[a.type];
  const stride = view.byteStride || size * width;
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const data = new DataView(bin.buffer, bin.byteOffset + start);
  const read = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
  const out = new Array(a.count);
  for (let i = 0; i < a.count; i++) {
    const row = new Array(width);
    for (let c = 0; c < width; c++) {
      const v = data[read](i * stride + c * size, true);
      row[c] = a.normalized ? Math.max(v / most, -1) : v;
    }
    out[i] = row;
  }
  return out;
}

const unit = (q) => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
/** The angle between two rotations, in degrees (the shorter way round). */
const angle = (a, b) => (2 * Math.acos(Math.min(1, Math.abs(dot(a, b)))) * 180) / Math.PI;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const median = (list) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : 0);
const round = (v, digits = 3) => +v.toFixed(digits);

/**
 * Reads a character's `.glb` and measures its rig and every clip.
 * Options: `secondary`, `twist`, `corrective`, `finger`, `face` (patterns on bone names), `loops`
 * (a pattern on clip names; default: idle, loop, walk, run, cycle), `humanoid` (true, false or
 * 'auto': a rig with forearm and thigh or shin bones by name), `secondaryAtRunTime` (hair and cloth are
 * left to a solver on purpose: the clips are not asked to move them), `bar` (numbers to replace CHARACTER_BAR's).
 */
export function auditCharacter(bytes, options = {}) {
  const glb = readGlb(bytes);
  const { json } = glb;
  const bar = { ...CHARACTER_BAR, ...options.bar };
  const patterns = { ...GROUPS, ...Object.fromEntries(Object.keys(GROUPS).filter((k) => options[k]).map((k) => [k, options[k]])) };
  const loops = options.loops ?? /idle|loop|walk|run|cycle|stand/i;
  const nodes = json.nodes ?? [];
  const joints = [...new Set((json.skins ?? []).flatMap((s) => s.joints))];
  const jointSet = new Set(joints);
  const parent = new Map();
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const name = (i) => nodes[i]?.name ?? `node ${i}`;
  // A pattern of the caller's is tried on the name as written and on its plain form.
  const groupOf = (i) => Object.keys(patterns).find((g) => patterns[g].test(plainName(name(i))) || (options[g] && patterns[g].test(name(i)))) ?? 'body';
  const groups = Object.fromEntries(joints.map((i) => [i, groupOf(i)]));
  const isEnd = (i) => ENDS.test(plainName(name(i)));
  const count = (g) => joints.filter((i) => groups[i] === g && !(g === 'secondary' && isEnd(i))).length;
  const roots = new Set(joints.filter((i) => !jointSet.has(parent.get(i))));
  const names = joints.map((i) => plainName(name(i))).join('\n');
  const humanoid = options.humanoid === true || options.humanoid === false ? options.humanoid : /\bfore ?(arm)?\b|lower ?arm|elbow/.test(names) && /thigh|up ?leg|upper ?leg|shin|calf/.test(names);

  // --- the mesh: how much of it there is, and how many joints hold a vertex -----------------------
  let vertices = 0,
    triangles = 0,
    morphTargets = 0,
    weighted = 0,
    mostJoints = 0,
    threeOrMore = 0;
  for (const mesh of json.meshes ?? [])
    for (const p of mesh.primitives ?? []) {
      const n = json.accessors[p.attributes.POSITION].count;
      vertices += n;
      triangles += p.indices !== undefined ? Math.floor(json.accessors[p.indices].count / 3) : Math.floor(n / 3);
      morphTargets = Math.max(morphTargets, (p.targets ?? []).length);
      const sets = Object.keys(p.attributes).filter((k) => k.startsWith('WEIGHTS_'));
      if (!sets.length) continue;
      const weights = sets.map((k) => rows(glb, p.attributes[k]));
      for (let v = 0; v < n; v++) {
        let held = 0;
        for (const set of weights) for (const w of set[v]) if (w > 0.001) held++;
        weighted++;
        mostJoints = Math.max(mostJoints, held);
        if (held >= 3) threeOrMore++;
      }
    }

  // --- the clips -------------------------------------------------------------------------------
  const clips = (json.animations ?? []).map((animation, index) => {
    const times = new Map();
    const timesOf = (accessor) => times.get(accessor) ?? times.set(accessor, rows(glb, accessor).map((r) => r[0])).get(accessor);
    const perJoint = new Map();
    const rates = [],
      interpolation = {};
    let seconds = 0,
      flips = 0;
    for (const channel of animation.channels) {
      const node = channel.target.node,
        path = channel.target.path;
      if (node === undefined || path === 'weights') continue;
      const sampler = animation.samplers[channel.sampler];
      const mode = sampler.interpolation ?? 'LINEAR';
      const t = timesOf(sampler.input);
      let values = rows(glb, sampler.output);
      // A cubic spline keeps an in-tangent, the value and an out-tangent for every key.
      if (mode === 'CUBICSPLINE') values = values.filter((_, k) => k % 3 === 1);
      interpolation[mode] = (interpolation[mode] ?? 0) + 1;
      const span = t[t.length - 1] - t[0];
      seconds = Math.max(seconds, t[t.length - 1]);
      const joint = perJoint.get(node) ?? perJoint.set(node, { range: 0, travel: 0, scaled: false, seamDegrees: 0, seamMetres: 0, edgeDegrees: 0, edgeMetres: 0, turnRate: 0 }).get(node);
      const last = values.length - 1;
      if (path === 'rotation') {
        const q = values.map(unit);
        for (let k = 1; k < q.length; k++) {
          if (dot(q[k - 1], q[k]) < 0) flips++;
          joint.range = Math.max(joint.range, angle(q[0], q[k]));
          if (t[k] > t[k - 1]) joint.turnRate = Math.max(joint.turnRate, angle(q[k - 1], q[k]) / (t[k] - t[k - 1]));
        }
        joint.seamDegrees = angle(q[0], q[last]);
        // What the clip does on either side of the seam: its first step and its last. The smaller
        // of the two is the measure: a bone that jumps on its very last key has a large last step,
        // and that is the jump itself, not an ordinary step.
        if (last > 0) joint.edgeDegrees = Math.min(angle(q[0], q[1]), angle(q[last - 1], q[last]));
        // How dense the keys are is asked of the turns that turn: a still bone may keep two keys.
        if (t.length > 1 && span > 0) rates.push({ rate: (t.length - 1) / span, mode, turns: joint.range > bar.movingDegrees });
      } else if (path === 'translation') {
        for (let k = 1; k < values.length; k++) joint.travel = Math.max(joint.travel, distance(values[0], values[k]));
        joint.seamMetres = distance(values[0], values[last]);
        if (last > 0) joint.edgeMetres = Math.min(distance(values[0], values[1]), distance(values[last - 1], values[last]));
      } else if (path === 'scale') joint.scaled ||= values.some((v) => distance(v, values[0]) > 0.01);
    }
    const moves = (j) => j && (j.range > bar.movingDegrees || j.travel > bar.movingMetres || j.scaled);
    const moving = {};
    for (const i of joints) if (moves(perJoint.get(i)) && !(groups[i] === 'secondary' && isEnd(i))) moving[groups[i]] = (moving[groups[i]] ?? 0) + 1;
    // The seam: turns of every joint, and places of every joint but a root (a walk may travel). A
    // clip that leaves its closing key out jumps by one ordinary step, which is no jump: each joint
    // is allowed one and a half of the smaller of its first and last steps.
    const seam = { degrees: 0, bone: null, metres: 0, open: [] };
    const fastest = { rate: 0, bone: null };
    for (const i of joints) {
      const j = perJoint.get(i);
      if (!j) continue;
      if (j.turnRate > fastest.rate) Object.assign(fastest, { rate: j.turnRate, bone: name(i) });
      if (j.seamDegrees > seam.degrees) Object.assign(seam, { degrees: j.seamDegrees, bone: name(i) });
      if (!roots.has(i) && j.seamMetres > seam.metres) seam.metres = j.seamMetres;
      if (j.seamDegrees > Math.max(bar.seamDegrees, j.edgeDegrees * 1.5) || (!roots.has(i) && j.seamMetres > Math.max(bar.seamMetres, j.edgeMetres * 1.5))) seam.open.push(name(i));
    }
    // Keys held or joined by straight lines must be dense; a cubic spline carries its own curve.
    const turning = rates.filter((r) => r.turns && r.mode !== 'CUBICSPLINE').map((r) => r.rate);
    const splines = rates.some((r) => r.turns && r.mode === 'CUBICSPLINE');
    return {
      name: animation.name ?? `clip ${index}`,
      seconds: round(seconds),
      loop: loops.test(animation.name ?? ''),
      /** The median over the turns that turn and are not splines; null when there is none. */
      keysPerSecond: turning.length ? round(median(turning), 1) : null,
      splines,
      interpolation,
      jointsKeyed: joints.filter((i) => perJoint.has(i)).length,
      moving,
      seam: { degrees: round(seam.degrees), bone: seam.bone, metres: round(seam.metres, 4), open: seam.open },
      fastestTurn: { degreesASecond: Math.round(fastest.rate), bone: fastest.bone },
      flips,
    };
  });

  const rig = {
    joints: joints.length,
    humanoid,
    groups: Object.fromEntries(['body', ...Object.keys(patterns)].map((g) => [g, count(g)])),
    twist: joints.filter((i) => groups[i] === 'twist').map(name),
    corrective: joints.filter((i) => groups[i] === 'corrective').map(name),
    secondary: joints.filter((i) => groups[i] === 'secondary').map(name),
  };
  const mesh = { vertices, triangles, morphTargets, mostJointsOnAVertex: mostJoints, shareOnThreeOrMore: weighted ? round(threeOrMore / weighted) : 0 };

  // --- the bar ---------------------------------------------------------------------------------
  const verdicts = [];
  const add = (id, level, ok, value, need, note) => verdicts.push({ id, level, ok, value, need, ...(note ? { note } : {}) });
  if (!clips.length) add('clips', 'must', false, 0, 'at least one clip', 'a character with no clip only stands');
  else {
    const measured = clips.filter((c) => c.keysPerSecond !== null);
    const sparse = measured.filter((c) => c.keysPerSecond < bar.keysPerSecond);
    add('dense-keys', 'must', measured.length ? !sparse.length : null, measured.length ? Math.min(...measured.map((c) => c.keysPerSecond)) : 0, `${bar.keysPerSecond} keys a second or more on the bones that turn, in every clip (a cubic spline is exempt)`, sparse.length ? `sparse: ${sparse.map((c) => `${c.name} ${c.keysPerSecond}`).join(', ')}` : measured.length ? undefined : 'no bone turns under straight lines or steps');
    const secondary = rig.groups.secondary;
    if (options.secondaryAtRunTime) add('secondary-in-clips', 'must', null, 0, 'hair, cloth and tail bones that move in the clips', `left to a solver at run time on purpose (${secondary} bones): this file cannot show how they move`);
    else if (!secondary) add('secondary-in-clips', 'should', null, 0, `hair, cloth or tail bones that move in the clips`, 'the rig has none by name: nothing can lag, overlap or follow through unless a solver adds it at run time');
    else {
      const worst = clips.map((c) => ({ name: c.name, share: (c.moving.secondary ?? 0) / secondary })).sort((a, b) => a.share - b.share)[0];
      add('secondary-in-clips', 'must', worst.share >= bar.secondaryMoving, round(worst.share, 2), `${bar.secondaryMoving} of the ${secondary} hair, cloth and tail bones moving in every clip`, `least in ${worst.name}`);
    }
    const looping = clips.filter((c) => c.loop);
    if (!looping.length) add('loop-seam', 'must', null, 0, 'a loop that closes', 'no clip is a loop by name (see --loops)');
    else {
      const open = looping.filter((c) => c.seam.open.length);
      const worst = [...looping].sort((a, b) => b.seam.degrees - a.seam.degrees)[0];
      add('loop-seam', 'must', !open.length, worst.seam.degrees, `every bone of every loop closes within ${bar.seamDegrees} degrees and ${bar.seamMetres * 1000} mm, or within one and a half of the smaller of its own first and last steps`, `${worst.name}: ${worst.seam.degrees} degrees on ${worst.seam.bone}${open.length ? `; open: ${open.map((c) => `${c.name} (${c.seam.open.length} bones: ${c.seam.open.slice(0, 3).join(', ')}${c.seam.open.length > 3 ? '...' : ''})`).join(', ')}` : ''}`);
      const idles = looping.filter((c) => /idle|stand|loop/i.test(c.name) && !/walk|run/i.test(c.name));
      if (idles.length) {
        const shortest = [...idles].sort((a, b) => a.seconds - b.seconds)[0];
        add('idle-length', 'should', shortest.seconds >= bar.idleSeconds, shortest.seconds, `${bar.idleSeconds} seconds or more for a loop watched standing still`, `shortest: ${shortest.name}`);
      }
    }
  }
  if (clips.length) {
    const pop = [...clips].sort((a, b) => b.fastestTurn.degreesASecond - a.fastestTurn.degreesASecond)[0];
    add('no-pops', 'should', pop.fastestTurn.degreesASecond <= bar.turnRate, pop.fastestTurn.degreesASecond, `no bone turning faster than ${bar.turnRate} degrees a second between two keys`, `${pop.name}: ${pop.fastestTurn.bone}; look at it: a strike may be that fast, a ribbon is not`);
  }
  if (humanoid) add('twist-bones', 'should', rig.twist.length >= bar.twistBones, rig.twist.length, `${bar.twistBones} or more twist bones (each upper arm and forearm at the least)`, rig.corrective.length ? `${rig.corrective.length} corrective bones besides` : 'no corrective bones by name either');
  add('joints-on-a-vertex', 'must', weighted ? mostJoints <= 4 : null, mostJoints, 'no vertex held by more than four joints (the engine skins with four)', weighted ? undefined : 'no skinned mesh');

  return { rig, mesh, clips, bar: verdicts, passes: verdicts.every((v) => v.level !== 'must' || v.ok !== false) };
}

/** The audit as lines a person reads. */
export function describeAudit(audit, label = '') {
  const lines = [];
  const { rig, mesh, clips } = audit;
  lines.push(`${label ? label + ': ' : ''}${rig.joints} joints (${Object.entries(rig.groups).filter(([, n]) => n).map(([g, n]) => `${g} ${n}`).join(', ')})${rig.humanoid ? ', human rig' : ''}; ${mesh.vertices} vertices, ${mesh.triangles} triangles, ${mesh.morphTargets} morph targets, at most ${mesh.mostJointsOnAVertex} joints on a vertex (${Math.round(mesh.shareOnThreeOrMore * 100)}% on three or more)`);
  for (const c of clips) lines.push(`  ${c.name.padEnd(28)} ${String(c.seconds).padStart(6)} s  ${String(c.keysPerSecond ?? (c.splines ? 'spline' : '-')).padStart(6)} keys/s  ${Object.entries(c.interpolation).map(([k, n]) => `${k} ${n}`).join(' ')}  moving: ${Object.entries(c.moving).map(([g, n]) => `${g} ${n}/${rig.groups[g]}`).join(', ') || 'nothing'}${c.loop ? `  seam ${c.seam.degrees} deg, ${(c.seam.metres * 1000).toFixed(1)} mm${c.seam.open.length ? ` (${c.seam.open.length} bones open)` : ''}` : ''}  fastest ${c.fastestTurn.degreesASecond} deg/s${c.flips ? `  ${c.flips} sign flips` : ''}`);
  for (const v of audit.bar) lines.push(`  ${v.ok === null ? 'n/a ' : v.ok ? 'ok  ' : v.level === 'must' ? 'FAIL' : 'weak'} ${v.id}: ${v.value} (need: ${v.need})${v.note ? ` [${v.note}]` : ''}`);
  lines.push(`  ${audit.passes ? 'passes every must' : 'does not pass'}; this says nothing of how it looks`);
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const fs = await import('node:fs');
  const args = process.argv.slice(2);
  const flag = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
  const files = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
  if (!files.length) {
    console.error('usage: node games/tools/characters/motion-audit.mjs <model.glb>... [--json] [--secondary <regex>] [--twist <regex>] [--corrective <regex>] [--loops <regex>] [--humanoid yes|no|auto] [--idle-seconds <n>] [--secondary-at-run-time]');
    process.exit(2);
  }
  const pattern = (name) => (flag(name) ? new RegExp(flag(name), 'i') : undefined);
  const options = { secondary: pattern('secondary'), twist: pattern('twist'), corrective: pattern('corrective'), loops: pattern('loops'), humanoid: { yes: true, no: false }[flag('humanoid')] ?? 'auto', secondaryAtRunTime: args.includes('--secondary-at-run-time'), bar: flag('idle-seconds') ? { idleSeconds: Number(flag('idle-seconds')) } : {} };
  let failed = false;
  const all = {};
  for (const file of files) {
    const audit = auditCharacter(new Uint8Array(fs.readFileSync(file)), options);
    failed ||= !audit.passes;
    all[file] = audit;
    if (!args.includes('--json')) console.log(describeAudit(audit, file));
  }
  if (args.includes('--json')) console.log(JSON.stringify(all, null, 1));
  process.exit(failed ? 1 : 0);
}
