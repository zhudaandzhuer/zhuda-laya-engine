// A human body as soft parts, for the giants and the 1.8 m figure they are drawn beside: a
// skeleton (root on the ground, hips, spine, chest, neck, head, collarbones, arms, legs) in an
// A pose with the arms well clear of the body, the muscles a heroic figure shows, and the turns a
// walk or a swing is made of. Everything scales with H, the height to the top of the head.
//
// The bind pose's frame is every joint's own frame (kit.mjs): a turn about x pitches (a hanging
// limb: positive swings it backward; the spine: positive bows it forward), about y heads, about
// z rolls (the left arm, on +x: positive raises it; the right arm: negative).
import { C, E, Q, add, both, bothJoints, cross, frame, lerp3, mul, norm, sub } from './kit.mjs';

const deg = Math.PI / 180;

/**
 * The skeleton and body. `H`: height to the top of the head (a headless body is shorter);
 * `bulk`: 1 a heroic figure, more for a giant's mass; `arm`: how far below level the upper arm
 * slants in the bind pose (degrees); `head`: false leaves a stump; `col`: the skin's colour;
 * `fist`: the hands closed (to hold a weapon) or open.
 */
export function humanoid({ H, bulk = 1, arm = 45, head = true, col, fist = true, stance = 1, neck = true }) {
  const h = (v) => v * H;
  const b = (v) => v * H * bulk;
  const P = {};
  P.root = [0, 0, 0];
  P.hips = [0, h(0.53), h(-0.005)];
  P.spine = [0, h(0.63), h(-0.01)];
  P.chest = [0, h(0.73), h(-0.012)];
  P.neck = [0, h(0.84), h(-0.008)];
  P.head = [0, h(0.89), 0];
  P.clav = [h(0.035), h(0.825), h(0.004)];
  P.shoulder = [b(0.17) + h(0.015), h(0.81), h(-0.008)];
  const a = arm * deg;
  P.armDir = norm([Math.cos(a), -Math.sin(a), 0.06]);
  P.elbow = add(P.shoulder, mul(P.armDir, h(0.185)));
  P.foreDir = norm([Math.cos(a + 8 * deg), -Math.sin(a + 8 * deg), 0.42]);
  P.wrist = add(P.elbow, mul(P.foreDir, h(0.155)));
  P.hand = add(P.wrist, mul(P.foreDir, h(0.048)));
  P.hip = [h(0.085) + b(0.004), h(0.512), h(0.002)];
  P.knee = [h(0.095 + 0.012 * stance), h(0.285), h(0.014)];
  P.ankle = [h(0.104 + 0.02 * stance), h(0.048), h(-0.012)];
  P.toe = [h(0.108 + 0.022 * stance), h(0.014), h(0.085)];

  const joints = [
    { name: 'root', at: P.root },
    { name: 'hips', parent: 'root', at: P.hips },
    { name: 'spine', parent: 'hips', at: P.spine },
    { name: 'chest', parent: 'spine', at: P.chest },
    { name: 'neck', parent: 'chest', at: P.neck },
    ...(head ? [{ name: 'head', parent: 'neck', at: P.head }] : []),
    ...bothJoints([
      { name: 'clavL', parent: 'chest', at: P.clav },
      { name: 'armL', parent: 'clavL', at: P.shoulder },
      { name: 'foreL', parent: 'armL', at: P.elbow },
      { name: 'handL', parent: 'foreL', at: P.wrist },
      { name: 'thighL', parent: 'hips', at: P.hip },
      { name: 'shinL', parent: 'thighL', at: P.knee },
      { name: 'footL', parent: 'shinL', at: P.ankle },
    ]),
  ];

  const K = { col, tag: 'skin' };
  const along = (p, q, t) => lerp3(p, q, t);
  const shapes = [
    // Pelvis, belly, ribcage, the broad top of the chest.
    E('hips', [0, h(0.535), h(-0.012)], [b(0.118), h(0.078), b(0.08)], { blend: 0, ...K }),
    E('spine', [0, h(0.625), h(0.004)], [b(0.104), h(0.085), b(0.076)], { blend: h(0.03), ...K }),
    E('chest', [0, h(0.718), h(-0.01)], [b(0.138), h(0.1), b(0.086)], { blend: h(0.03), ...K }),
    E('chest', [0, h(0.785), h(-0.014)], [b(0.152), h(0.055), b(0.078)], { blend: h(0.025), ...K }),
    // The back: two long columns either side of the spine.
    ...both([E('chest', [b(0.045), h(0.7), h(-0.072)], [b(0.04), h(0.11), b(0.03)], { blend: h(0.015), ...K, tag: 'back' })]),
    // Pectorals, slanting up and out to the shoulder.
    ...both([E('chest', [b(0.064), h(0.758), h(0.05)], [b(0.074), h(0.046), b(0.026)], { axes: frame([0.3, -0.12, 1], [0.3, 1, 0]), blend: h(0.022), ...K, tag: 'pec' })]),
    // Abdominals: three pairs, and the obliques.
    ...both(
      [0.668, 0.628, 0.588].map((y, i) => E('spine', [b(0.03), h(y), h(0.066 - i * 0.002)], [b(0.026), h(0.018), b(0.013)], { blend: h(0.008), ...K, tag: 'abs' })),
    ),
    ...both([E('spine', [b(0.088), h(0.598), h(0.016)], [b(0.038), h(0.065), b(0.05)], { blend: h(0.02), ...K })]),
    // Latissimus under the arms, trapezius from the neck to the shoulder.
    ...both([E('chest', [b(0.108), h(0.7), h(-0.03)], [b(0.048), h(0.09), b(0.05)], { blend: h(0.02), ...K })]),
    ...both([E('chest', [b(0.07), h(0.822), h(-0.024)], [b(0.07), h(0.03), b(0.045)], { axes: frame([0, 0, 1], [-0.45, 1, 0]), blend: h(0.02), ...K, tag: 'trap' })]),
    // Glutes.
    ...both([E('hips', [b(0.055), h(0.515), h(-0.062)], [b(0.064), h(0.07), b(0.054)], { blend: h(0.02), ...K })]),
  ];
  if (neck) shapes.push(C('neck', [0, h(0.815), h(-0.01)], [0, h(head ? 0.885 : 0.86), 0], b(0.044), b(head ? 0.04 : 0.042), { blend: h(0.02), ...K, tag: 'neck' }));
  if (head) {
    shapes.push(
      E('head', [0, h(0.94), h(0.008)], [h(0.056), h(0.066), h(0.064)], { blend: h(0.01), ...K, tag: 'head' }),
      E('head', [0, h(0.906), h(0.014)], [h(0.042), h(0.034), h(0.042)], { blend: h(0.014), ...K, tag: 'jaw' }),
      E('head', [0, h(0.927), h(0.064)], [h(0.009), h(0.016), h(0.012)], { axes: frame([0, -0.3, 1]), blend: h(0.006), ...K, tag: 'nose' }),
      ...both([E('head', [h(0.058), h(0.93), h(0.002)], [h(0.008), h(0.018), h(0.012)], { blend: h(0.004), ...K, tag: 'ear' })]),
      ...both([E('head', [h(0.022), h(0.945), h(0.066)], [h(0.014), h(0.008), h(0.01)], { subtract: true, blend: h(0.006), ...K, tag: 'eye' })]),
    );
  }
  // Arms (left; mirrored): deltoid, biceps and triceps, the forearm's swell, the hand.
  const { shapes: armSide, armAxes, foreAxes } = armShapes({ names: ['armL', 'foreL', 'handL'], shoulder: P.shoulder, elbow: P.elbow, wrist: P.wrist, hand: P.hand, armDir: P.armDir, foreDir: P.foreDir, h, b, K, fist });
  // Legs: thigh with the quadriceps' sweep, the hamstrings and the inner thigh; knee; calf; foot.
  const thighDir = norm(sub(P.knee, P.hip));
  const shinDir = norm(sub(P.ankle, P.knee));
  const legSide = [
    C('thighL', P.hip, P.knee, b(0.074), b(0.048), { blend: h(0.02), ...K }),
    E('thighL', add(along(P.hip, P.knee, 0.42), [b(0.012), 0, b(0.026)]), [b(0.058), h(0.11), b(0.05)], { axes: frame([0, 0, 1], mul(thighDir, -1)), blend: h(0.015), ...K, tag: 'quad' }),
    E('thighL', add(along(P.hip, P.knee, 0.45), [b(-0.018), 0, b(-0.02)]), [b(0.05), h(0.1), b(0.05)], { axes: frame([0, 0, 1], mul(thighDir, -1)), blend: h(0.015), ...K }),
    E('shinL', add(P.knee, [0, h(0.004), b(0.032)]), [b(0.03), b(0.03), b(0.022)], { blend: h(0.01), ...K, tag: 'knee' }),
    C('shinL', P.knee, P.ankle, b(0.046), b(0.027), { blend: h(0.012), ...K }),
    E('shinL', add(along(P.knee, P.ankle, 0.27), [0, 0, b(-0.025)]), [b(0.042), h(0.075), b(0.04)], { axes: frame([0, 0, 1], mul(shinDir, -1)), blend: h(0.012), ...K, tag: 'calf' }),
    C('footL', P.ankle, add(P.ankle, [0, h(-0.024), h(-0.022)]), b(0.03), b(0.026), { blend: h(0.01), ...K, tag: 'foot' }),
    E('footL', [P.ankle[0], h(0.024), h(0.03)], [b(0.04), h(0.024), h(0.07)], { blend: h(0.012), ...K, tag: 'foot' }),
  ];
  shapes.push(...both([...armSide, ...legSide]));
  return { joints, shapes, P, H, h, b, armAxes, foreAxes };
}

/**
 * An arm's muscles and hand (on the left; mirror with both()): `names` the upper arm's, the
 * forearm's and the hand's joints. `h` and `b` scale lengths and girths (see humanoid()).
 */
export function armShapes({ names: [ua, fa, ha], shoulder, elbow, wrist, hand, armDir, foreDir, h, b, K, fist = true, delt = 1 }) {
  const along = (p, q, t) => lerp3(p, q, t);
  const armAxes = frame(armDir, [0, 0, 1]);
  const foreAxes = frame(foreDir, [0, 0.4, 1]);
  const out = [];
  if (delt) out.push(E(ua, add(shoulder, mul(armDir, h(0.02))), [b(0.06) * delt, b(0.058) * delt, h(0.072) * delt], { axes: armAxes, blend: h(0.03), ...K, tag: 'delt' }));
  out.push(C(ua, shoulder, elbow, b(0.048), b(0.036), { blend: h(0.012), ...K }));
  out.push(E(ua, add(along(shoulder, elbow, 0.5), mul(armAxes[1], b(0.022))), [b(0.04), b(0.04), h(0.072)], { axes: armAxes, blend: h(0.012), ...K, tag: 'bicep' }));
  out.push(E(ua, add(along(shoulder, elbow, 0.45), mul(armAxes[1], b(-0.022))), [b(0.038), b(0.04), h(0.075)], { axes: armAxes, blend: h(0.012), ...K }));
  out.push(C(fa, elbow, wrist, b(0.036), b(0.025), { blend: h(0.012), ...K }));
  out.push(E(fa, along(elbow, wrist, 0.28), [b(0.04), b(0.035), h(0.065)], { axes: foreAxes, blend: h(0.012), ...K }));
  if (fist) {
    out.push(E(ha, hand, [b(0.032), b(0.034), h(0.042)], { axes: foreAxes, blend: h(0.012), ...K, tag: 'hand' }));
    // Knuckles across the front of the fist; the thumb over them.
    const [fx, fy, fz] = foreAxes;
    for (let k = 0; k < 4; k++) {
      const c = add(add(hand, mul(fz, h(0.03))), add(mul(fy, b(0.012 - k * 0.012)), mul(fx, b(0.02))));
      out.push(E(ha, c, [b(0.014), b(0.011), b(0.014)], { axes: foreAxes, blend: h(0.006), ...K, tag: 'knuckle' }));
    }
    out.push(C(ha, add(hand, add(mul(fx, b(-0.02)), mul(fy, b(0.02)))), add(hand, add(mul(fz, h(0.028)), add(mul(fx, b(-0.012)), mul(fy, b(0.024))))), b(0.012), b(0.01), { blend: h(0.006), ...K, tag: 'thumb' }));
  } else {
    out.push(E(ha, hand, [b(0.012), b(0.034), h(0.045)], { axes: foreAxes, blend: h(0.012), ...K, tag: 'hand' }));
  }
  return { shapes: out, armAxes, foreAxes };
}

// ------------------------------------------------------------------ poses
/** The axis an elbow (or knee) folds about in the bind pose: across the limb, square to `forward`. */
export const hingeAxis = (limbDir, forward = [0, 0, 1]) => norm(cross(limbDir, forward));

/**
 * Turns that bring the arms of the A pose down to the sides and the elbows a little bent, for
 * idling; `down` degrees down (0: the bind pose).
 */
export function armsRest(down = 30, bend = 12) {
  return {
    armL: Q.of(Q.axis([0, 0, 1], -down)),
    armR: Q.of(Q.axis([0, 0, 1], down)),
    foreL: Q.axis([0, 1, 0], -bend),
    foreR: Q.axis([0, 1, 0], bend),
  };
}

/**
 * A walk in place: `t` seconds into a stride of `period` seconds. Thighs swing `stride`
 * degrees either way, knees fold up to `lift` in the swing, feet stay level on the ground and
 * roll off the toes; the hips bob `bob` metres and roll toward the leg that bears them; the chest
 * turns against the hips. Returns quaternions (and $root).
 */
export function walk(t, period, { stride = 22, lift = 45, bob = 0.05, roll = 4, twist = 8, lean = 4, kneeBase = 6 } = {}) {
  const ph = (2 * Math.PI * t) / period;
  const out = {};
  for (const [side, off] of [['L', 0], ['R', Math.PI]]) {
    const s = Math.sin(ph + off); // + : this leg ahead
    const swing = Math.max(0, Math.cos(ph + off)); // moving forward: off the ground
    const thigh = -stride * s;
    const knee = kneeBase + lift * swing ** 1.5 + 6 * Math.max(0, -s);
    // Keep the sole level in stance; lift the toes as the foot swings through.
    const foot = -(thigh + knee) * (1 - swing) - 8 * swing + 6 * Math.max(0, -s) * (1 - swing);
    out[`thigh${side}`] = Q.axis([1, 0, 0], thigh);
    out[`shin${side}`] = Q.axis([1, 0, 0], knee);
    out[`foot${side}`] = Q.axis([1, 0, 0], foot);
  }
  const s = Math.sin(ph);
  // The hips turn with the leading leg and roll down on the side of the swinging one; the chest
  // turns back against them.
  out.hips = Q.of(Q.axis([0, 1, 0], -twist * 0.5 * s), Q.axis([0, 0, 1], roll * Math.cos(ph)));
  out.spine = Q.of(Q.axis([1, 0, 0], lean), Q.axis([0, 1, 0], twist * 0.5 * s));
  out.chest = Q.axis([0, 1, 0], twist * 0.5 * s);
  out.$root = [0, -bob * Math.sin(ph) ** 2, 0];
  return out;
}

/** Combines poses: quaternion turns of the same joint compose (the later after the earlier); $root adds. */
export function compose(...poses) {
  const out = {};
  for (const pose of poses)
    for (const [k, v] of Object.entries(pose ?? {})) {
      if (k === '$root') out.$root = out.$root ? add(out.$root, v) : [...v];
      else {
        const q = v.length === 4 ? v : eulerQ(v);
        out[k] = out[k] ? Q.mul(q, out[k]) : q;
      }
    }
  return out;
}
/** An [x, y, z] degrees turn (the kit's order) as a quaternion. */
export function eulerQ([x, y, z]) {
  return Q.of(Q.axis([0, 1, 0], y), Q.axis([1, 0, 0], x), Q.axis([0, 0, 1], z));
}
/** Blends two poses (quaternions) by t. */
export function blend(a, b, t) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === '$root') out.$root = lerp3(a.$root ?? [0, 0, 0], b.$root ?? [0, 0, 0], t);
    else out[k] = Q.slerp(a[k] ?? Q.id, b[k] ?? Q.id, t);
  }
  return out;
}
/** Scales every turn of a pose by s (0 = the bind pose). */
export function scalePose(p, s) {
  return blend({}, p, s);
}

// ------------------------------------------------------------------ aiming and key poses
const conj = (q) => [-q[0], -q[1], -q[2], q[3]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The shortest turn from direction a to direction b. */
export function arc(a, b) {
  a = norm(a);
  b = norm(b);
  const d = dot3(a, b);
  if (d < -0.9999) {
    const perp = Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]);
    return Q.axis(perp, 180);
  }
  const c = cross(a, b);
  const q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}
/**
 * Poses by where bones point. `rig(joints)` knows the hierarchy; `aim(pose, joint, from, to,
 * twist)` sets the joint's turn so that `from` (a direction in the bind pose: the bone, or a
 * weapon's haft) points along `to` in the world, given what the pose already turns its parents
 * by, then turns `twist` degrees about `to`. `world(pose, joint)` is the joint's whole turn.
 * Poses passed here hold quaternions.
 */
export function rig(joints) {
  const parent = new Map(joints.map((j) => [j.name, j.parent]));
  const at = new Map(joints.map((j) => [j.name, j.at]));
  const world = (pose, name) => {
    const chain = [];
    for (let n = name; n; n = parent.get(n)) chain.unshift(n);
    return chain.reduce((q, n) => Q.mul(q, pose[n] ?? Q.id), Q.id);
  };
  const aim = (pose, name, from, to, twist = 0) => {
    const pw = parent.get(name) ? world(pose, parent.get(name)) : Q.id;
    const local = Q.apply(conj(pw), norm(to));
    pose[name] = Q.mul(Q.axis(local, twist), arc(from, local));
    return pose;
  };
  /**
   * As aim, then turned about `to` so that `faceFrom` (another direction in the bind pose, square
   * to `from`: a shield's face, a blade's edge) points as near `faceTo` as it can.
   */
  const orient = (pose, name, from, to, faceFrom, faceTo) => {
    const pw = parent.get(name) ? world(pose, parent.get(name)) : Q.id;
    const axis = norm(Q.apply(conj(pw), norm(to)));
    const q1 = arc(from, axis);
    const flat = (v) => norm(sub(v, mul(axis, dot3(v, axis))));
    const f = flat(Q.apply(q1, faceFrom));
    const want = flat(Q.apply(conj(pw), faceTo));
    const angle = (Math.atan2(dot3(cross(f, want), axis), dot3(f, want)) * 180) / Math.PI;
    pose[name] = Q.mul(Q.axis(axis, angle), q1);
    return pose;
  };
  /** Where a joint (or a point carried by it, given in the bind pose) is, in the world. */
  const place = (pose, name, point = at.get(name)) => {
    const chain = [];
    for (let n = name; n; n = parent.get(n)) chain.unshift(n);
    // p_world = T_root R_root (... (R_n (point - at_n) + at_n - at_parent) ...)
    let p = point;
    for (let i = chain.length - 1; i >= 0; i--) {
      const n = chain[i];
      p = add(Q.apply(pose[n] ?? Q.id, sub(p, at.get(n))), at.get(n));
    }
    return add(p, pose.$root ?? [0, 0, 0]);
  };
  return { world, aim, orient, place, parent, at };
}
/** Eases 0 → 1. */
export const smoothstep = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
/**
 * A pose between key poses: `keys` is [[time, pose], ...] in order; between two keys the turns
 * slerp with an ease (`ease` per key: 'smooth' default, 'in' to start slow and hit hard, 'out',
 * 'linear').
 */
export function keyed(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i + 1 < keys.length; i++) {
    const [t0, a] = keys[i],
      [t1, b, ease = 'smooth'] = keys[i + 1];
    if (t <= t1) {
      const x = (t - t0) / (t1 - t0);
      const e = ease === 'linear' ? x : ease === 'in' ? x * x * x : ease === 'out' ? 1 - (1 - x) ** 3 : smoothstep(x);
      return blend(a, b, e);
    }
  }
  return keys.at(-1)[1];
}
