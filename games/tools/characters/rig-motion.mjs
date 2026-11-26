// Clips for a skeleton whose joints are not turned in the bind pose (rig-glb.mjs): poses as one
// quaternion a joint, sampled on whole frames, with what a watched character needs worked into
// the keys themselves: hair, cloth and cords swung on springs, loops that close, and a check of
// what a cross-fade does. The Node form of what blender/raise-rig.py does in Blender.
//
//   const world = worldPose(joints, locals)                   where every joint is, and how turned
//   swingChains(joints, frames, chains, { fps, loop })        writes the chains' turns into frames
//   const animations = toAnimations(clips, fps)               for writeRiggedGlb
//   const jump = fadeStep(joints, from, to, { fps, seconds }) the largest step across a cross-fade
//
//   const { upper, lower } = reach(root, mid, end, target)  a leg or an arm that reaches a place
//   const twist = twistAbout(turn, axis)                      the part of a turn that is about an axis
//
// A pose (`locals`) is an array with a quaternion [x, y, z, w] for each joint, or undefined for a
// joint that is not turned. It may carry `shift`: { joint index: [x, y, z] }, metres a joint is
// moved from its bind place, in its parent's axes (hips that sink and sway). A clip's `frames` are
// poses, one a frame; a loop's last frame is its first again.

export const IDENTITY = [0, 0, 0, 1];
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
export const qnorm = (q) => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
/** A turn of `radians` about an axis (need not be of length 1). */
export const qaxis = (axis, radians) => {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1, s = Math.sin(radians / 2) / l;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(radians / 2)];
};
/** Turns about x, then y, then z (degrees), as one quaternion: the last named is applied last. */
export const qeuler = (x = 0, y = 0, z = 0) => {
  const r = Math.PI / 180;
  return qmul(qaxis([0, 0, 1], z * r), qmul(qaxis([0, 1, 0], y * r), qaxis([1, 0, 0], x * r)));
};
export const qrot = (q, v) => {
  const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
};
/** The shortest turn that takes direction `a` to direction `b`. */
export const qbetween = (a, b) => {
  const la = Math.hypot(...a) || 1, lb = Math.hypot(...b) || 1;
  const u = a.map((v) => v / la), v = b.map((x) => x / lb), d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  if (d < -0.999999) {
    // Opposite: any axis across `a`.
    const side = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return qaxis([u[1] * side[2] - u[2] * side[1], u[2] * side[0] - u[0] * side[2], u[0] * side[1] - u[1] * side[0]], Math.PI);
  }
  return qnorm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0], 1 + d]);
};
/** Between two turns, the short way: what a cross-fade of two clips does to a joint. */
export const qnlerp = (a, b, t) => {
  const s = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  return qnorm([a[0] + (b[0] * s - a[0]) * t, a[1] + (b[1] * s - a[1]) * t, a[2] + (b[2] * s - a[2]) * t, a[3] + (b[3] * s - a[3]) * t]);
};
/** Degrees between two turns. */
export const qangle = (a, b) => (2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180) / Math.PI;

/** The part of a turn that is about `axis` (of length 1): turn = swing * twist, the swing about an axis across it. */
export const twistAbout = (q, axis) => {
  const d = q[0] * axis[0] + q[1] * axis[1] + q[2] * axis[2], l = Math.hypot(d, q[3]);
  return l < 1e-9 ? IDENTITY : [(axis[0] * d) / l, (axis[1] * d) / l, (axis[2] * d) / l, q[3] / l];
};
/** A share of a turn: 0 none of it, 1 all of it, about the same axis. */
export const qpow = (q, share) => {
  const s = q[3] < 0 ? -1 : 1, l = Math.hypot(q[0], q[1], q[2]);
  if (l < 1e-9) return IDENTITY;
  return qaxis([q[0] * s, q[1] * s, q[2] * s], 2 * Math.atan2(l, q[3] * s) * share);
};

/**
 * A limb of two bones that reaches a place. `root`, `mid`, `end` are the limb's joints in the
 * bind pose (hip, knee, ankle), `target` where the end is to be, seen from where the root now is:
 * target minus the root's place now, in the axes the limb's parent now has (for a parent that is
 * not turned: the world's). Returns the turns of the upper and the lower bone, each in its
 * parent's axes: the lower bends in the plane the limb has in the bind pose (a limb that is
 * straight there bends towards `pole`), and the whole is then turned the short way so that the
 * end lies towards the target. A target farther than the limb is long is reached for, not reached.
 */
export function reach(root, mid, end, target, { pole = [0, 0, 1] } = {}) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
  const up = sub(mid, root), low = sub(end, mid), l1 = len(up), l2 = len(low);
  const d = Math.max(Math.abs(l1 - l2) + 1e-6, Math.min(len(target), l1 + l2 - 1e-6));
  // The angle at the middle joint between the two bones: now, and as the distance asks.
  const now = Math.acos(Math.max(-1, Math.min(1, dot(up, low) / (l1 * l2))));
  const wanted = Math.PI - Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
  // Turning the lower bone about (upper x lower) opens the angle between them. A straight limb
  // has no such axis: its end is turned away from the pole, so that the middle goes towards it.
  let axis = cross(up, low);
  if (len(axis) < 1e-6 * l1 * l2) axis = cross(pole, low);
  if (len(axis) < 1e-9) axis = [1, 0, 0];
  const lower = qaxis(axis, wanted - now), bent = [up[0] + qrot(lower, low)[0], up[1] + qrot(lower, low)[1], up[2] + qrot(lower, low)[2]];
  return { upper: qbetween(bent, target), lower };
}

/**
 * Where every joint is and how it is turned, for a pose. joints: [{ parent, position }] as
 * rig-glb.mjs takes them (a parent before its children).
 */
export function worldPose(joints, locals, into) {
  const rotations = into?.rotations ?? new Array(joints.length), positions = into?.positions ?? new Array(joints.length);
  const shift = locals.shift;
  for (let j = 0; j < joints.length; j++) {
    const joint = joints[j], local = locals[j] ?? IDENTITY, by = shift?.[j];
    if (joint.parent < 0) {
      rotations[j] = local;
      positions[j] = by ? [joint.position[0] + by[0], joint.position[1] + by[1], joint.position[2] + by[2]] : joint.position;
      continue;
    }
    const parent = joints[joint.parent], offset = [joint.position[0] - parent.position[0] + (by?.[0] ?? 0), joint.position[1] - parent.position[1] + (by?.[1] ?? 0), joint.position[2] - parent.position[2] + (by?.[2] ?? 0)];
    const moved = qrot(rotations[joint.parent], offset), base = positions[joint.parent];
    rotations[j] = qmul(rotations[joint.parent], local);
    positions[j] = [base[0] + moved[0], base[1] + moved[1], base[2] + moved[2]];
  }
  return { rotations, positions };
}

/** Points skinned to a pose as the engine skins them: four joints a point, blended linearly. */
export function skinPoints(points, skin, joints, world) {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length / 3; i++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const w = skin.weights[i * 4 + k];
      if (w <= 0) continue;
      const j = skin.joints[i * 4 + k], bind = joints[j].position;
      const p = qrot(world.rotations[j], [points[i * 3] - bind[0], points[i * 3 + 1] - bind[1], points[i * 3 + 2] - bind[2]]);
      ((x += w * (p[0] + world.positions[j][0])), (y += w * (p[1] + world.positions[j][1])), (z += w * (p[2] + world.positions[j][2])));
    }
    ((out[i * 3] = x), (out[i * 3 + 1] = y), (out[i * 3 + 2] = z));
  }
  return out;
}

/**
 * Swings chains of joints on springs and writes their turns into the frames.
 *
 * chains: [{ joints: [index, ...] from the root of the chain outwards, each the child of the one
 *            before; end: [x, y, z] where the last joint's bone ends in the bind pose;
 *            stiffness (0 to 1: how hard a bone is pulled back to where its parent would hold it,
 *            a frame), drag (0 to 1: how much of its speed it loses a frame),
 *            gravity?: metres a second squared downwards (default 0: the bind pose already hangs),
 *            push?: (seconds, link) => [x, y, z] metres a second squared: wind, a draught,
 *            lies?: { on: joint index, share: [0 to 1 for each link] }: hair that lies on the
 *            back, a strand on a collar. A link's end is wanted partly where its parent would
 *            hold it and, by its share, where the joint it lies on would: the head turns, and the
 *            hair on the back stays on the back }]
 * options: { fps, loop: true runs the frames round `passes` times (default 4) and keeps the last
 *            round, so that the loop's first frame follows from its last; the last frame is then
 *            made the first again.
 *            state: where a clip before this one left the chains (what this returns), so that a
 *            Start begins as its idle stood. }
 * A chain's joints must not have been turned by the frames: this owns them. Returns the state.
 */
export function swingChains(joints, frames, chains, options) {
  const { fps, loop = false, passes = 4 } = options;
  const dt = 1 / fps, count = loop ? frames.length - 1 : frames.length;
  if (loop && frames.length < 2) throw Error('A loop needs two frames or more');
  const owned = new Set(chains.flatMap((c) => c.joints));
  const links = chains.map((chain) =>
    chain.joints.map((j, k) => {
      const next = k + 1 < chain.joints.length ? joints[chain.joints[k + 1]].position : chain.end, at = joints[j].position;
      if (k && joints[j].parent !== chain.joints[k - 1]) throw Error(`Chain joint ${j} is not the child of the one before it`);
      return { joint: j, tailBind: next, rest: [next[0] - at[0], next[1] - at[1], next[2] - at[2]], length: Math.hypot(next[0] - at[0], next[1] - at[1], next[2] - at[2]) };
    }),
  );
  // Each link's tail: where it is, and where it was a frame ago.
  let state = options.state ? options.state.map((c) => c.map((l) => ({ tail: [...l.tail], before: [...l.before] }))) : null;
  const world = { rotations: new Array(joints.length), positions: new Array(joints.length) };
  const step = (frame, seconds, write) => {
    const locals = frame.slice();
    locals.shift = frame.shift;
    for (const j of owned) locals[j] = undefined;
    worldPose(joints, locals, world);
    if (!state) state = links.map((chain) => chain.map((link) => ({ tail: null, before: null })));
    chains.forEach((chain, c) => {
      links[c].forEach((link, k) => {
        const j = link.joint, parent = joints[j].parent, parentRot = parent < 0 ? IDENTITY : world.rotations[parent];
        // The joint's place follows from its parent, which this loop has already turned.
        const offset = parent < 0 ? [0, 0, 0] : qrot(parentRot, [joints[j].position[0] - joints[parent].position[0], joints[j].position[1] - joints[parent].position[1], joints[j].position[2] - joints[parent].position[2]]);
        const base = parent < 0 ? joints[j].position : [world.positions[parent][0] + offset[0], world.positions[parent][1] + offset[1], world.positions[parent][2] + offset[2]];
        const held = qrot(parentRot, link.rest), want = [base[0] + held[0], base[1] + held[1], base[2] + held[2]];
        const lie = chain.lies?.share[k] ?? 0;
        if (lie > 0) {
          const on = chain.lies.on, bed = qrot(world.rotations[on], [link.tailBind[0] - joints[on].position[0], link.tailBind[1] - joints[on].position[1], link.tailBind[2] - joints[on].position[2]]);
          for (let a = 0; a < 3; a++) want[a] += (world.positions[on][a] + bed[a] - want[a]) * lie;
        }
        const s = state[c][k];
        if (!s.tail) ((s.tail = want.slice()), (s.before = want.slice()));
        const push = chain.push ? chain.push(seconds, k) : [0, 0, 0], keep = 1 - (chain.drag ?? 0.2), pull = chain.stiffness ?? 0.2;
        const next = [0, 1, 2].map((a) => s.tail[a] + (s.tail[a] - s.before[a]) * keep + (want[a] - s.tail[a]) * pull + (push[a] - (a === 1 ? (chain.gravity ?? 0) : 0)) * dt * dt);
        // The bone keeps its length.
        const reach = [next[0] - base[0], next[1] - base[1], next[2] - base[2]], l = Math.hypot(...reach) || 1;
        const tail = [base[0] + (reach[0] / l) * link.length, base[1] + (reach[1] / l) * link.length, base[2] + (reach[2] / l) * link.length];
        ((s.before = s.tail), (s.tail = tail));
        const local = qbetween(link.rest, qrot(qconj(parentRot), [tail[0] - base[0], tail[1] - base[1], tail[2] - base[2]]));
        world.rotations[j] = qmul(parentRot, local);
        world.positions[j] = base;
        if (write) frame[j] = local;
      });
    });
  };
  for (let pass = 0; pass < (loop ? passes : 1); pass++) for (let f = 0; f < count; f++) step(frames[f], f * dt, !loop || pass === passes - 1);
  if (loop) for (const j of owned) frames[frames.length - 1][j] = frames[0][j];
  return state;
}

/**
 * Clips as rig-glb.mjs writes them. clips: [{ name, frames }]. A joint gets a channel in a clip
 * only if it is turned (or, with `joints` given, moved) somewhere in it, or with `every` whether
 * it is turned or not (a player that fades between two clips then has both for every joint);
 * every channel has a key on every frame.
 */
export function toAnimations(clips, fps, joints, { every = false } = {}) {
  return clips.map(({ name, frames }) => {
    const times = Float32Array.from(frames, (_, f) => f / fps), channels = [];
    const jointCount = joints?.length ?? Math.max(...frames.map((frame) => frame.length));
    for (let j = 0; j < jointCount; j++) {
      if (!every && !frames.some((frame) => frame[j] && qangle(frame[j], IDENTITY) > 1e-4)) continue;
      const values = new Float32Array(frames.length * 4);
      let before = IDENTITY;
      frames.forEach((frame, f) => {
        // Neighbouring keys on the same side of the sphere, so that a reader's interpolation goes the short way.
        let q = qnorm(frame[j] ?? IDENTITY);
        if (q[0] * before[0] + q[1] * before[1] + q[2] * before[2] + q[3] * before[3] < 0) q = q.map((v) => -v);
        values.set(q, f * 4);
        before = q;
      });
      channels.push({ joint: j, path: 'rotation', values });
    }
    const moved = new Set(frames.flatMap((frame) => Object.keys(frame.shift ?? {}).map(Number)));
    for (const j of [...moved].sort((a, b) => a - b)) {
      if (!joints) throw Error('A clip that moves a joint needs the joints, for where it is at rest');
      const at = joints[j].position, parent = joints[j].parent < 0 ? [0, 0, 0] : joints[joints[j].parent].position;
      const values = new Float32Array(frames.length * 3);
      frames.forEach((frame, f) => values.set([0, 1, 2].map((a) => at[a] - parent[a] + (frame.shift?.[j]?.[a] ?? 0)), f * 3));
      channels.push({ joint: j, path: 'translation', values });
    }
    return { name, times, channels };
  });
}

/**
 * What a cross-fade of `seconds` does: clip `from` goes on from frame `at`, clip `to` starts at
 * its first frame, and each joint is turned between the two by a share that goes from 0 to 1.
 * Returns the largest distance any joint moves in one frame during the fade, and the largest it
 * moves in one frame of either clip alone just before and after: a fade that jumps moves a joint
 * much farther in a frame than the clips themselves do.
 */
export function fadeStep(joints, from, to, { fps, seconds, at = 0 }) {
  const steps = Math.max(1, Math.round(seconds * fps));
  const poseAt = (clip, f) => clip.frames[Math.min(clip.frames.length - 1, Math.max(0, f))];
  const places = (locals) => worldPose(joints, locals).positions;
  const farthest = (a, b) => Math.max(...a.map((p, j) => Math.hypot(p[0] - b[j][0], p[1] - b[j][1], p[2] - b[j][2])));
  let before = places(poseAt(from, at)), inFade = 0;
  for (let k = 1; k <= steps; k++) {
    const share = k / steps, a = poseAt(from, at + k), b = poseAt(to, k);
    const mixed = joints.map((_, j) => qnlerp(a[j] ?? IDENTITY, b[j] ?? IDENTITY, share));
    mixed.shift = {};
    for (const j of new Set([...Object.keys(a.shift ?? {}), ...Object.keys(b.shift ?? {})])) mixed.shift[j] = [0, 1, 2].map((k) => (a.shift?.[j]?.[k] ?? 0) * (1 - share) + (b.shift?.[j]?.[k] ?? 0) * share);
    const now = places(mixed);
    inFade = Math.max(inFade, farthest(before, now));
    before = now;
  }
  let alone = 0;
  for (let k = 1; k <= steps; k++) {
    alone = Math.max(alone, farthest(places(poseAt(from, at + k - 1 - steps)), places(poseAt(from, at + k - steps))));
    alone = Math.max(alone, farthest(places(poseAt(to, steps + k - 1)), places(poseAt(to, steps + k))));
  }
  return { inFade, alone, ratio: alone > 1e-9 ? inFade / alone : Infinity };
}
