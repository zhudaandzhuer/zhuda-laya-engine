// 九野印契 heroes (契師): what the five share. Built as the textured beasts and bosses are
// (../../hd/textured.mjs): soft parts as signed distances, a low mesh with its maps baked from them,
// one material, skinned and given clips. This file holds
//   - the skeleton: 20 joints of a person at human proportions (not the giants' heroic build of
//     ../../humanoid.mjs), plus up to 4 of each hero's own (cloth panels, a ponytail, a scarf);
//   - body parts every hero has: a head with a face, closed hands round a grip, a neck;
//   - the face painted into the colour map (eyes, brows, lips);
//   - materials by zone (cloth, leather, lacquer, steel, bronze, wood, hair, skin…): detail height
//     for the normal map, colour variation, roughness that varies inside each zone (worn edges
//     smoother, hollows rougher, a low-frequency patchiness), metalness 0 or 1 only;
//   - pose tools: two-bone reach for arms and legs, hands set by their frame, weapons held by a
//     point and a direction, cloth panels that follow the thighs.
// The model faces +Z, up is +Y, its left is +X, metres; the origin between the feet.
import { C, E, Q, add, both, bothJoints, cross, dot, fbm3, frame, hex, len, lerp3, mix, mul, noise3, norm, smooth, sub } from './kit.mjs';
import { arc, blend, compose, keyed, rig, walk } from './humanoid.mjs';
import { casting, scratches } from './detail.mjs';

export { C, E, Q, add, both, cross, dot, fbm3, frame, hex, len, lerp3, mix, mul, noise3, norm, smooth, sub, blend, compose, keyed, walk };
export const deg = Math.PI / 180;
export const flip = (v) => [-v[0], v[1], v[2]];
export const conj = (q) => [-q[0], -q[1], -q[2], q[3]];
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const TAU = Math.PI * 2;
export const wave = (t, period, phase = 0) => Math.sin(TAU * (t / period + phase));
/** 0 → 1 → 0 over [a, b]. */
export const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)) ** 2);
export const ease = (t, a, b) => {
  const x = clamp((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
export const pitch = (d) => Q.axis([1, 0, 0], d),
  yaw = (d) => Q.axis([0, 1, 0], d),
  roll = (d) => Q.axis([0, 0, 1], d);

// ------------------------------------------------------------------ the skeleton
/**
 * A person `H` metres tall to the top of the head. `shoulder` and `hip`: the shoulder joints' and
 * hip joints' distance from the middle, as a share of H (a broad man 0.112, a slim woman 0.094);
 * `hand`: the hand's size (1 a man's). `extras`: joints of the hero's own, [{ name, parent, at }].
 * The arms hang 50° below level in the bind pose (an A pose, clear of the body).
 */
export function heroRig({ H, shoulder = 0.104, hip = 0.054, hand = 1, extras = [], neck = true }) {
  const h = (v) => v * H;
  const k = H / 1.75;
  const P = {
    root: [0, 0, 0],
    hips: [0, h(0.53), 0],
    spine: [0, h(0.615), -h(0.004)],
    chest: [0, h(0.705), -h(0.008)],
    neck: [0, h(0.83), -h(0.012)],
    head: [0, h(0.872), -h(0.006)],
    clav: [h(0.022), h(0.812), -h(0.004)],
    shoulder: [h(shoulder), h(0.808), -h(0.008)],
    hip: [h(hip), h(0.503), h(0.002)],
    knee: [h(hip + 0.004), h(0.282), h(0.008)],
    ankle: [h(hip + 0.007), h(0.046), -h(0.01)],
  };
  const armDir = norm([Math.cos(50 * deg), -Math.sin(50 * deg), 0.04]);
  const foreDir = norm([Math.cos(55 * deg), -Math.sin(55 * deg), 0.2]);
  P.elbow = add(P.shoulder, mul(armDir, h(0.166)));
  P.wrist = add(P.elbow, mul(foreDir, h(0.142)));
  // The left hand's frame: F along the fingers (as the forearm), W across the palm toward the
  // thumb (a pole held in the fist runs along W), N out of the palm (toward the thigh).
  const F = foreDir;
  const W = norm(sub([0, 0, 1], mul(F, F[2])));
  const N = cross(F, W);
  const hk = k * hand;
  // Where a pole passes through the closed fist.
  P.grip = add(add(P.wrist, mul(F, 0.068 * hk)), mul(N, 0.022 * hk));
  const joints = [
    { name: 'root', at: P.root },
    { name: 'hips', parent: 'root', at: P.hips },
    { name: 'spine', parent: 'hips', at: P.spine },
    { name: 'chest', parent: 'spine', at: P.chest },
    // `neck: false` leaves the neck joint out (the head turns on the chest) to free a joint for a
    // hero's own; the neck's shapes then ride on the chest.
    ...(neck ? [{ name: 'neck', parent: 'chest', at: P.neck }] : []),
    { name: 'head', parent: neck ? 'neck' : 'chest', at: P.head },
    ...bothJoints([
      { name: 'clavL', parent: 'chest', at: P.clav },
      { name: 'armL', parent: 'clavL', at: P.shoulder },
      { name: 'foreL', parent: 'armL', at: P.elbow },
      { name: 'handL', parent: 'foreL', at: P.wrist },
      { name: 'thighL', parent: 'hips', at: P.hip },
      { name: 'shinL', parent: 'thighL', at: P.knee },
      { name: 'footL', parent: 'shinL', at: P.ankle },
    ]),
    ...extras,
  ];
  if (joints.length > 24) throw Error(`${joints.length} joints: at most 24`);
  const R = rig(joints);
  const S = (s) => (s === 'L' ? (v) => v : flip);
  return {
    H,
    k,
    hk,
    h,
    P,
    joints,
    R,
    armDir,
    foreDir,
    F,
    W,
    N,
    S,
    /** A bind-pose point or direction of side s ('L' as given, 'R' mirrored). */
    side: (s, v) => S(s)(v),
    bind: {
      upper: (s) => S(s)(armDir),
      lower: (s) => S(s)(foreDir),
      thigh: (s) => S(s)(norm(sub(P.knee, P.hip))),
      shin: (s) => S(s)(norm(sub(P.ankle, P.knee))),
      F: (s) => S(s)(F),
      W: (s) => S(s)(W),
      N: (s) => S(s)(N),
      grip: (s) => S(s)(P.grip),
      wrist: (s) => S(s)(P.wrist),
    },
    lengths: { upper: h(0.166), lower: h(0.142), thigh: len(sub(P.knee, P.hip)), shin: len(sub(P.ankle, P.knee)) },
  };
}

// ------------------------------------------------------------------ body parts
/** Shape options: tag (what it is, for colour), zone (its material), col (display colour). */
const opt = (tag, zone, col, more = {}) => ({ tag, zone, col, ...more });

/**
 * A closed hand round a grip (on the left; `s` 'R' mirrors it): the palm, the fingers rolled round
 * the grip, knuckles, the thumb over them. `glove`: a colour for gloved hands.
 */
export function fist(r, s, { col, zone = 'skin', tag = 'hand', bone } = {}) {
  const g = (v) => r.side(s, v);
  const F = g(r.F),
    W = g(r.W),
    N = g(r.N);
  const w = g(r.P.wrist);
  const k = r.hk;
  const at = (f, ww, n) => add(add(add(w, mul(F, f * k)), mul(W, ww * k)), mul(N, n * k));
  const b = bone ?? 'hand' + s;
  const o = (more) => opt(tag, zone, col, { soft: 0.012, ...more });
  const axes = [W, N, F];
  return [
    E(b, at(0.01, 0, 0), [0.03 * k, 0.021 * k, 0.026 * k], { axes, blend: 0.014, ...o() }),
    E(b, at(0.044, 0, 0.002), [0.041 * k, 0.016 * k, 0.04 * k], { axes, blend: 0.012, ...o() }),
    // The fingers, rolled round the grip.
    C(b, at(0.072, -0.034, 0.022), at(0.072, 0.028, 0.022), 0.02 * k, 0.021 * k, { blend: 0.008, ...o() }),
    ...[-0.026, -0.009, 0.008, 0.024].map((x) => E(b, at(0.086, x, 0.006), [0.0105 * k, 0.0105 * k, 0.012 * k], { axes, blend: 0.006, ...o({ tag: tag + '-knuckle' }) })),
    // The thumb over the fingers.
    C(b, at(0.03, 0.03, 0.012), at(0.062, 0.036, 0.042), 0.0125 * k, 0.0095 * k, { blend: 0.008, ...o() }),
  ];
}

/**
 * The head: cranium, face, jaw, chin, cheekbones, brow, eye sockets with the eyes in them, nose,
 * lips, ears; and the neck. `O` (returned) is the head's centre at the height of the eyes; the
 * face paint (faceColour) works in the same frame. `sex` 'm' or 'f' sets the jaw, brow and size.
 */
export function head(r, { sex = 'm', skin, lip, jaw = 1, brow = 1, nose = 1, scale = 1, neck = 1, eyeScale = 1 }) {
  const f = sex === 'f';
  const s = (f ? 0.95 : 1) * scale;
  const O = [0, r.H - 0.12 * s, 0.006];
  const at = (x, y, z) => add(O, [x * s, y * s, z * s]);
  const sk = (tag = 'face', more = {}) => opt(tag, 'skin', skin, more);
  const out = [
    E('head', at(0, 0.028, -0.014), [0.074, 0.092, 0.097].map((v) => v * s), { blend: 0, ...sk('scalp') }),
    E('head', at(0, 0.044, 0.042), [0.058 * s, 0.05 * s, 0.046 * s], { blend: 0.03, ...sk() }),
    E('head', at(0, -0.024, 0.017), [0.063 * s, 0.08 * s, 0.074 * s], { blend: 0.02, ...sk() }),
    E('head', at(0, -0.07, 0.024), [(f ? 0.047 : 0.055) * jaw * s, 0.04 * s, 0.06 * s], { blend: 0.026, ...sk() }),
    E('head', at(0, -0.1, 0.063), [(f ? 0.017 : 0.022) * jaw * s, (f ? 0.015 : 0.018) * s, 0.018 * s], { blend: 0.018, ...sk() }),
    ...both([E('head', at(0.043, -0.012, 0.054), [0.022 * s, 0.016 * s, 0.02 * s], { blend: 0.022, ...sk() })]),
    C('head', at(-0.036, 0.021, 0.073), at(0.036, 0.021, 0.073), (f ? 0.0105 : 0.0135) * brow * s, (f ? 0.0105 : 0.0135) * brow * s, { blend: 0.022, ...sk() }),
    // Sockets, then the eyes in them.
    ...both([E('head', at(0.033, 0.001, 0.088), [0.017 * s * eyeScale, 0.0112 * s * eyeScale, 0.014 * s], { subtract: true, blend: 0.011, ...sk() })]),
    ...both([E('head', at(0.033, -0.0005, 0.0712 - 0.0125 * (eyeScale - 1)), [0.0125 * s * eyeScale, 0.0125 * s * eyeScale, 0.0125 * s * eyeScale], { blend: 0.0035, ...opt('eye', 'eye', [0.9, 0.88, 0.85]) })]),
    // Nose: bridge, tip, the wings of the nostrils.
    C('head', at(0, 0.006, 0.087), at(0, -0.029 * nose, 0.104), 0.0062 * s, 0.0092 * s, { blend: 0.012, ...sk() }),
    E('head', at(0, -0.033 * nose, 0.1015), [0.0101 * s, 0.0086 * s, 0.009 * s], { blend: 0.008, ...sk('nose') }),
    ...both([E('head', at(0.0102, -0.0372 * nose, 0.0915), [0.0062 * s, 0.0056 * s, 0.0064 * s], { blend: 0.006, ...sk('nose') })]),
    // Lips: kept close to the face (larger, they stood out like rolls).
    E('head', at(0, -0.0545, 0.0868), [0.0172 * s, 0.0043 * s, 0.0058 * s], { blend: 0.008, ...opt('lips', 'lips', lip) }),
    E('head', at(0, -0.063, 0.0842), [0.0155 * s, 0.005 * s, 0.0062 * s], { blend: 0.008, ...opt('lips', 'lips', lip) }),
    // Ears.
    ...both([
      E('head', at(0.073, -0.006, -0.006), [0.01 * s, 0.026 * s, 0.016 * s], { blend: 0.008, ...sk('ear') }),
      E('head', at(0.077, -0.002, -0.009), [0.006 * s, 0.022 * s, 0.013 * s], { blend: 0.004, ...sk('ear') }),
    ]),
  ];
  const neckBone = r.joints.some((j) => j.name === 'neck') ? 'neck' : 'chest';
  const neckShapes = [C(neckBone, r.P.neck, at(0, -0.06, -0.022), (f ? 0.043 : 0.052) * neck * s, (f ? 0.04 : 0.047) * neck * s, { blend: 0.02, ...sk('neck') })];
  return { shapes: out, neck: neckShapes, O, s, at, eye: (sx) => at(sx * 0.033, -0.0005, 0.0712), eyeR: 0.0125 * s };
}

/**
 * The face painted on the head built by head(): the eyes (sclera, iris, pupil, a light), the lash
 * line, brows, the line between the lips, a little colour on the cheeks; returns the colour at p
 * (display 0..1), `base` elsewhere.
 */
export function faceColour(hd, p, n, shape, base, { iris = hex('#4a3020'), brow = hex('#2e2420'), lash = hex('#2a1e1a'), lip = hex('#a85a50'), blush = 0, browLift = 0, browAngle = 0, eyeScale: k = 1, wrinkles = 0, browThick = 1 } = {}) {
  const { O, s } = hd;
  const x = (p[0] - O[0]) / s,
    y = (p[1] - O[1]) / s,
    z = (p[2] - O[2]) / s;
  if (z < 0.02 || n[2] < 0.05) return base;
  let c = base;
  if (shape.tag === 'lips') {
    // Darker toward the line between them, which turns down a little at the corners.
    const line = -0.0592 - 0.0012 * (x / 0.018) ** 2;
    c = mix(c, mul(lip, 0.78), smooth(0.004, 0.0008, Math.abs(y - line)) * 0.6);
    if (Math.abs(y - line) < 0.0007 && Math.abs(x) < 0.019) c = mix(c, mul(lip, 0.45), 0.85);
    return c;
  }
  for (const sx of [-1, 1]) {
    const u = (sx * x - 0.033) / k; // outward from the eye's centre (in a standard eye's size)
    const t = u / 0.0145;
    const v = (y + 0.0005) / k - 0.0012 * t;
    if (shape.tag === 'eye' && Math.sign(x) === sx) {
      const span = Math.max(0, 1 - t * t);
      const upper = 0.0063 * span ** 0.55,
        lower = -0.0046 * span ** 0.75;
      if (Math.abs(t) < 1 && v < upper && v > lower) {
        const d = Math.hypot(u + 0.0004, v - 0.0003);
        if (d < 0.0056) {
          c = mix(iris, mul(iris, 0.55), smooth(0.003, 0.0056, d));
          c = mix(c, mul(iris, 1.35).map((q) => Math.min(1, q)), 0.3 * noise3(Math.atan2(v, u) * 6, d * 600, sx * 3));
          if (d < 0.0021) c = hex('#221814');
          if (Math.hypot(u - 0.0015, v - 0.002) < 0.0011) c = hex('#e2ddd6');
        } else c = mix(hex('#d6cec4'), hex('#b8a69a'), smooth(upper - 0.003, upper, v) * 0.7 + smooth(lower + 0.002, lower, v) * 0.3);
        // The upper lid's shadow on the eye.
        c = mix(c, mul(c, 0.62), smooth(upper - 0.0018, upper, v));
        if (v > upper - 0.0007) c = mix(c, lash, 0.9);
      } else {
        // The lids round the opening: skin, a little darker and warmer; the lash line along the top.
        c = mix(base, [base[0] * 0.86, base[1] * 0.8, base[2] * 0.8], 0.7);
        if (Math.abs(t) < 1.12 && v >= upper - 0.0003 && v < upper + 0.0011 + 0.0007 * smooth(-0.3, 1, t)) c = mix(c, lash, 0.92);
        if (Math.abs(t) < 0.95 && v <= lower + 0.0002 && v > lower - 0.0005) c = mix(c, lash, 0.45);
      }
      return c;
    }
    // Brows: a band over each eye, thicker toward the nose.
    const bt = (sx * x - 0.031) / 0.024;
    const by = y - (0.0175 + browLift + 0.004 * (1 - bt * bt) - browAngle * bt);
    const thick = (0.0028 + 0.0012 * smooth(0.6, -0.8, bt)) * browThick;
    if (bt > -0.95 && bt < 1.05 && Math.abs(by) < thick) c = mix(c, brow, 0.85 * smooth(1.05, 0.7, bt));
    // Lids: a soft darker line over the eye's socket.
    if (Math.abs(t) < 1.1 && Math.abs(v - 0.0105) < 0.0012) c = mix(c, mul(base, 0.85), 0.5);
  }
  if (blush) for (const sx of [-1, 1]) c = mix(c, hex('#d9877a'), blush * (1 - smooth(0.006, 0.024, Math.hypot(x - sx * 0.042, (y + 0.026) * 1.3))));
  if (wrinkles) {
    // Age: lines across the forehead, crow's feet, the folds from the nose to the mouth.
    const shade = mul(base, 0.8);
    for (const fy of [0.036, 0.046, 0.056]) if (Math.abs(y - fy - 0.004 * Math.cos(x * 40)) < 0.0007 && Math.abs(x) < 0.04) c = mix(c, shade, 0.7 * wrinkles);
    for (const sx of [-1, 1]) {
      const ex = sx * x - 0.052;
      for (const a of [-0.35, 0, 0.35]) if (ex > 0 && ex < 0.012 && Math.abs(y - ex * Math.tan(a)) < 0.0006) c = mix(c, shade, 0.6 * wrinkles);
      const nx = sx * x - 0.02 - (-(y + 0.035)) * 0.45;
      if (y < -0.035 && y > -0.07 && Math.abs(nx) < 0.0009) c = mix(c, shade, 0.7 * wrinkles);
    }
  }
  return c;
}

// ------------------------------------------------------------------ materials
/**
 * The zones: base roughness, its spread inside the zone, metalness (0 or 1), how much worn edges
 * smooth it, how much the hollows roughen it.
 */
export const ZONES = {
  skin: { rough: 0.52, spread: 0.06, metal: 0 },
  lips: { rough: 0.36, spread: 0.04, metal: 0 },
  eye: { rough: 0.12, spread: 0.02, metal: 0 },
  hair: { rough: 0.44, spread: 0.08, metal: 0 },
  cloth: { rough: 0.84, spread: 0.08, metal: 0, cavity: 0.1 },
  silk: { rough: 0.58, spread: 0.08, metal: 0, cavity: 0.1 },
  linen: { rough: 0.9, spread: 0.05, metal: 0, cavity: 0.05 },
  felt: { rough: 0.92, spread: 0.04, metal: 0 },
  leather: { rough: 0.6, spread: 0.08, metal: 0, wear: 0.18, cavity: 0.12 },
  lacquer: { rough: 0.34, spread: 0.07, metal: 0, wear: 0.12, cavity: 0.2 },
  patina: { rough: 0.62, spread: 0.08, metal: 0, cavity: 0.12 },
  cord: { rough: 0.78, spread: 0.06, metal: 0 },
  wood: { rough: 0.62, spread: 0.1, metal: 0, wear: 0.16, cavity: 0.12 },
  paper: { rough: 0.82, spread: 0.06, metal: 0 },
  leaf: { rough: 0.5, spread: 0.08, metal: 0 },
  gourd: { rough: 0.42, spread: 0.08, metal: 0, wear: 0.12 },
  jade: { rough: 0.18, spread: 0.04, metal: 0 },
  tassel: { rough: 0.7, spread: 0.06, metal: 0 },
  steel: { rough: 0.24, spread: 0.06, metal: 1, wear: 0.1, cavity: 0.18 },
  bronze: { rough: 0.32, spread: 0.07, metal: 1, wear: 0.12, cavity: 0.18 },
  gold: { rough: 0.26, spread: 0.05, metal: 1, wear: 0.1, cavity: 0.12 },
  ember: { rough: 0.5, spread: 0.05, metal: 0 },
  straw: { rough: 0.8, spread: 0.08, metal: 0, cavity: 0.1 },
  stone: { rough: 0.78, spread: 0.1, metal: 0, wear: 0.15, cavity: 0.12 },
  oilcloth: { rough: 0.45, spread: 0.1, metal: 0, wear: 0.12, cavity: 0.15 },
  petal: { rough: 0.5, spread: 0.06, metal: 0 },
};

/** The flow of hair over a surface from a crown point: down and back, along the surface. */
function hairFlow(p, n, crown) {
  const d = norm(sub(p, crown));
  const f = norm(add(d, [0, -0.6, -0.2]));
  return norm(sub(f, mul(n, dot(f, n))));
}

/** Detail height (metres) of a zone at a point, for the normal and occlusion maps. */
export function zoneDetail(z, p, n, shape) {
  switch (z) {
    case 'skin':
      return 0.00005 * noise3(p[0] * 700, p[1] * 700, p[2] * 700, 7);
    case 'lips': {
      return 0.00012 * (0.5 + 0.5 * Math.sin(p[0] * 2600 + 2 * noise3(p[0] * 300, p[1] * 300, p[2] * 300, 1)));
    }
    case 'hair': {
      const flow = hairFlow(p, n, shape.crown ?? [0, 10, 0]);
      const across = norm(cross(n, flow));
      return 0.0004 * (0.5 + 0.5 * Math.sin(dot(p, across) * 1700 + 3 * noise3(dot(p, flow) * 30, dot(p, across) * 40, 3, 5))) + 0.00035 * fbm3(dot(p, across) * 120, dot(p, flow) * 10, 0, 9, 2);
    }
    case 'tassel': {
      const axis = shape.kind === 'roundCone' ? norm(sub(shape.b, shape.a)) : [0, 1, 0];
      const across = norm(cross(n, axis));
      return 0.0004 * (0.5 + 0.5 * Math.sin(dot(p, across) * 2300 + 3 * noise3(dot(p, axis) * 50, 0, 0, 4)));
    }
    case 'cloth':
    case 'linen':
    case 'felt': {
      // Folds that hang (long up and down) and a coarse weave.
      const folds = fbm3(p[0] * 22, p[1] * 5, p[2] * 22, 3, 3) - 0.5;
      const weave = Math.sin((p[0] + p[2]) * 1100) * Math.sin(p[1] * 1100) * 0.5 + 0.5;
      return 0.0016 * folds + (z === 'felt' ? 0.00005 : 0.00012) * weave + (z === 'linen' ? 0.0002 * noise3(p[0] * 60, p[1] * 500, p[2] * 60, 9) : 0);
    }
    case 'silk':
      return 0.0011 * (fbm3(p[0] * 16, p[1] * 4, p[2] * 16, 5, 3) - 0.5);
    case 'leather':
      return 0.00022 * casting(p, 420) + 0.0003 * (fbm3(p[0] * 60, p[1] * 60, p[2] * 60, 11, 2) - 0.5);
    case 'lacquer':
      return 0.00008 * casting(p, 300);
    case 'patina':
      return 0.00028 * casting(p, 260) + 0.0002 * fbm3(p[0] * 90, p[1] * 90, p[2] * 90, 13, 2);
    case 'cord': {
      const axis = shape.kind === 'roundCone' ? norm(sub(shape.b, shape.a)) : [0, 1, 0];
      const q = sub(p, shape.kind === 'roundCone' ? shape.a : shape.center);
      const ref = norm(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      const ang = Math.atan2(dot(cross(ref, q), axis), dot(ref, q));
      return 0.0005 * (0.5 + 0.5 * Math.sin(dot(q, axis) * 900 + ang * 3));
    }
    case 'wood': {
      const axis = shape.kind === 'roundCone' ? norm(sub(shape.b, shape.a)) : (shape.grain ?? [0, 1, 0]);
      const across = norm(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      return 0.0005 * fbm3(dot(p, across) * 220, dot(p, axis) * 12, dot(p, cross(axis, across)) * 220, 21, 2);
    }
    case 'paper':
      return 0.00018 * fbm3(p[0] * 160, p[1] * 160, p[2] * 160, 31, 2);
    case 'leaf': {
      const ax = shape.axes;
      if (shape.kind === 'ellipsoid' && ax) {
        const q = sub(p, shape.center);
        const across = Math.abs(dot(q, ax[0])),
          along = dot(q, ax[2]);
        return 0.0003 * Math.max(1 - smooth(0.0006, 0.0014, across), 0.4 * (0.5 + 0.5 * Math.sin((across * 0.8 + along * 0.5) * 2600)));
      }
      return 0;
    }
    case 'gourd':
      return 0.00012 * casting(p, 200);
    case 'straw': {
      // Woven strips running round a cone (round `shape.axisC`), with a fine fibre.
      const q = sub(p, shape.axisC ?? [0, 0, 0]);
      const rr = Math.hypot(q[0], q[2]);
      const a = Math.atan2(q[0], q[2]);
      return 0.0005 * (0.5 + 0.5 * Math.sin(rr * 900)) * (0.6 + 0.4 * Math.sin(a * 90 + rr * 300)) + 0.00015 * noise3(p[0] * 900, p[1] * 900, p[2] * 900, 3);
    }
    case 'stone':
      return 0.0009 * fbm3(p[0] * 60, p[1] * 60, p[2] * 60, 27, 3) + 0.0002 * casting(p, 300);
    case 'oilcloth':
      return 0.0009 * (fbm3(p[0] * 14, p[1] * 6, p[2] * 14, 3, 3) - 0.5) + 0.00008 * casting(p, 300);
    case 'petal': {
      const axis = shape.kind === 'ellipsoid' && shape.axes ? shape.axes[2] : [0, 1, 0];
      return 0.00025 * (0.5 + 0.5 * Math.sin(dot(p, axis) * 0 + dot(p, cross(axis, n)) * 1400));
    }
    case 'steel':
      return 0.00012 * fbm3(p[0] * 70, p[1] * 70, p[2] * 70, 15, 2) + 0.00006 * scratches(p, 40);
    case 'bronze':
    case 'gold':
      return 0.0002 * casting(p, 160);
    default:
      return 0;
  }
}

/**
 * The material of a texel: colour (display 0..1), roughness, metalness 0 or 1, emission.
 * `paint(p, n, shape, rgb, info)` gives the hero's colours (patterns, the face) first.
 */
export function zoneSurface(p, n, shape, info, paint) {
  const z = shape.zoneAt ? shape.zoneAt(p, n) : (shape.zone ?? 'cloth');
  const m = ZONES[z] ?? ZONES.cloth;
  const { curvature, occlusion, h } = info;
  let c = shape.col ?? [0.5, 0.5, 0.5];
  if (paint) c = paint(p, n, shape, c, info);
  const emission = shape.emit ? (typeof shape.emit === 'function' ? shape.emit(p, n) : shape.emit) : undefined;
  // Low-frequency patches (a few centimetres), and a finer grain.
  const big = fbm3(p[0] * 7 + 3.1, p[1] * 7, p[2] * 7, 17, 3);
  const fine = noise3(p[0] * 90, p[1] * 90, p[2] * 90, 23);
  const cavity = smooth(0.97, 0.55, occlusion);
  const edge = smooth(45, 140, curvature);
  let rough = m.rough + (big - 0.5) * m.spread * 2.2 + (fine - 0.5) * m.spread * 0.6 + cavity * (m.cavity ?? 0.06) - edge * (m.wear ?? 0);
  // Colour: a little patchiness; dirt toward the hollows (not on skin, eyes, metal); worn edges
  // of leather, lacquer and wood lighter.
  const tint = 1 + (big - 0.5) * (z === 'skin' ? 0.06 : 0.14);
  c = c.map((v) => v * tint);
  if (!['skin', 'lips', 'eye', 'steel', 'bronze', 'gold', 'jade', 'ember'].includes(z)) c = mix(c, mul(c, 0.72), cavity * 0.35);
  if (['leather', 'lacquer', 'wood', 'gourd'].includes(z)) c = mix(c, c.map((v) => Math.min(1, v * 1.35 + 0.05)), edge * 0.45);
  let metal = m.metal;
  if (metal) {
    // Metal stays bright (it is the reflectance): tarnish in the hollows only darkens it a little;
    // scratches and worn edges brighten it and make it smoother.
    const sc = scratches(p, 18);
    c = c.map((v) => Math.min(1, v * (1 - 0.06 * cavity) * (1 + 0.06 * edge + 0.05 * sc)));
    rough += 0.06 * (big - 0.5) - 0.08 * sc;
  }
  if (z === 'hair') rough -= 0.05 * smooth(0, 0.0005, h);
  return { color: c.map((v) => clamp(v)), roughness: clamp(rough, 0.06, 1), metalness: metal, ...(emission ? { emission } : {}) };
}

// ------------------------------------------------------------------ poses
/** Pose tools on a rig from heroRig. */
export function poser(r) {
  const { R, P, bind, lengths } = r;
  const setWorld = (pose, name, q) => {
    const parent = R.parent.get(name);
    const pw = parent ? R.world(pose, parent) : Q.id;
    pose[name] = Q.mul(conj(pw), q);
  };
  /** The world turn taking (fb, nb) onto (fw, nw): f exactly, n as near as it can. */
  const frameTurn = (fb, nb, fw, nw) => {
    const q1 = arc(fb, fw);
    const axis = norm(fw);
    const flat = (v) => norm(sub(v, mul(axis, dot(v, axis))));
    const a = flat(Q.apply(q1, nb)),
      b = flat(nw);
    const angle = (Math.atan2(dot(cross(a, b), axis), dot(a, b)) * 180) / Math.PI;
    return Q.mul(Q.axis(axis, angle), q1);
  };
  /** Two-bone reach: `upper`/`lower` turned so the end joint lands on `target`, the middle joint toward `pole`. */
  const reach = (pose, upper, lower, end, target, pole, la, lb, bu, bl) => {
    const S0 = R.place(pose, upper);
    const d = sub(target, S0);
    const dist = Math.max(0.02, Math.min(la + lb - 1e-4, len(d)));
    const dir = norm(d);
    const cosA = clamp((la * la + dist * dist - lb * lb) / (2 * la * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const pp = norm(sub(pole, mul(dir, dot(pole, dir))));
    R.aim(pose, upper, bu, norm(add(mul(dir, cosA), mul(pp, sinA))));
    const Ej = R.place(pose, lower);
    R.aim(pose, lower, bl, sub(target, Ej));
    return R.place(pose, end);
  };
  const armTo = (pose, s, wrist, pole) => reach(pose, 'arm' + s, 'fore' + s, 'hand' + s, wrist, pole, lengths.upper, lengths.lower, bind.upper(s), bind.lower(s));
  const legTo = (pose, s, ankle, pole = [s === 'L' ? 0.15 : -0.15, 0, 1]) => reach(pose, 'thigh' + s, 'shin' + s, 'foot' + s, ankle, pole, lengths.thigh, lengths.shin, bind.thigh(s), bind.shin(s));
  /** The foot's world turn: level, turned `yawDeg`, toes down `pitchDeg`. */
  const footFlat = (pose, s, yawDeg = 0, pitchDeg = 0) => setWorld(pose, 'foot' + s, Q.mul(yaw(yawDeg), pitch(pitchDeg)));
  /**
   * The hand of side s holds a pole: the pole through the fist runs along `axis` (the thumb's side
   * toward +axis), the palm faces `palm` as near as it can, the grip point at `at`; the elbow
   * toward `pole`.
   */
  const grip = (pose, s, at, axis, palm, pole) => {
    const q = frameTurn(bind.W(s), bind.N(s), axis, palm);
    const wrist = sub(at, Q.apply(q, sub(bind.grip(s), bind.wrist(s))));
    armTo(pose, s, wrist, pole);
    setWorld(pose, 'hand' + s, q);
    return q;
  };
  /** Sets the hand of side s by its frame: fingers along `f`, palm toward `n`, the wrist at `wrist` (or where the arm leaves it). */
  const handFrame = (pose, s, f, n, wrist, pole) => {
    if (wrist) armTo(pose, s, wrist, pole);
    const q = frameTurn(bind.F(s), bind.N(s), f, n);
    setWorld(pose, 'hand' + s, q);
    return q;
  };
  /** Feet planted at `L` and `R` ([x, z, yawDeg]), the body lowered by `drop`, moved by `shift`, the hips turned. */
  const stand = (pose, { L = [P.ankle[0] + 0.02, 0.02, 8], R: Rf = [-P.ankle[0] - 0.02, -0.02, -8], drop = 0.02, shift = [0, 0, 0], hips = Q.id, kneeOut = 0.2 } = {}) => {
    pose.$root = add([0, -drop, 0], shift);
    pose.hips = pose.hips ? Q.mul(pose.hips, hips) : hips;
    for (const [s, f] of [
      ['L', L],
      ['R', Rf],
    ]) {
      const ankle = [f[0], P.ankle[1] + (f[3] ?? 0), f[1]];
      const sx = s === 'L' ? 1 : -1;
      legTo(pose, s, ankle, [sx * kneeOut, 0, 1]);
      footFlat(pose, s, f[2], f[4] ?? 0);
    }
    return pose;
  };
  /** Where a point carried by a joint (given in the bind pose) is in the world. */
  const place = (pose, joint, point) => R.place(pose, joint, point);
  return { setWorld, frameTurn, reach, armTo, legTo, footFlat, grip, handFrame, stand, place, world: (pose, j) => R.world(pose, j) };
}

/**
 * Cloth panels hung from the waist follow the thighs, so the legs do not pass through them:
 * the front panel swings forward with the leg that is ahead, the back one back with the leg that
 * is behind, the sides out a little. `names`: which panels the hero has.
 */
export function panelsFollow(r, pose, { front = 'skirtF', back = 'skirtB', left = 'skirtL', right = 'skirtR', k = 0.9, has = [], along = 'knee' } = {}) {
  const { R, P } = r;
  // Short panels follow the knee; long ones (to the ankle) the ankle, so a bent knee in a stance
  // does not throw the hem forward.
  const endJoint = along === 'ankle' ? 'foot' : 'shin';
  const endBind = along === 'ankle' ? P.ankle : P.knee;
  const swing = (s) => {
    const hip = R.place(pose, 'thigh' + s),
      end = R.place(pose, endJoint + s);
    const hq = R.world(pose, 'hips');
    const v = Q.apply(conj(hq), sub(end, hip));
    const v0 = sub(endBind, P.hip);
    return { fwd: (Math.atan2(v[2], -v[1]) - Math.atan2(v0[2], -v0[1])) / deg, out: Math.atan2(Math.abs(v[0]) - Math.abs(v0[0]), -v[1]) / deg };
  };
  const L = swing('L'),
    Rr = swing('R');
  if (has.includes(front)) pose[front] = pitch(-Math.max(0, L.fwd, Rr.fwd) * k);
  if (has.includes(back)) pose[back] = pitch(-Math.min(0, L.fwd, Rr.fwd) * k);
  if (has.includes(left)) pose[left] = Q.mul(roll(Math.max(0, L.out) * 0.7 + Math.abs(L.fwd) * 0.12), pitch(-L.fwd * 0.45));
  if (has.includes(right)) pose[right] = Q.mul(roll(-Math.max(0, Rr.out) * 0.7 - Math.abs(Rr.fwd) * 0.12), pitch(-Rr.fwd * 0.45));
  return pose;
}

// ------------------------------------------------------------------ the definition
/**
 * A hero's textured definition for ../../hd/textured.mjs. `paint(p, n, shape, rgb, info)`: the
 * hero's colours on top of each shape's own; `face`: { head, ...faceColour options }.
 */
export function heroDef({ id, title, latin, lore, rig: r, shapes, clips, paint, face, triangles = 24000, fineCell = 0.004, skin = 0.024, regions, emissionStrength, extra = {} }) {
  for (const s of shapes) {
    if (!s.bone) throw Error(`${id}: a shape without a bone (${s.tag})`);
    if (!ZONES[s.zone ?? 'cloth']) throw Error(`${id}: unknown zone ${s.zone}`);
  }
  const hd = face?.head;
  const paintAll = (p, n, shape, rgb, info) => {
    let c = paint ? paint(p, n, shape, rgb, info) : rgb;
    if (hd && shape.bone === 'head' && (shape.zone === 'skin' || shape.zone === 'eye' || shape.zone === 'lips')) c = faceColour(hd, p, n, shape, c, face);
    return c;
  };
  return {
    id,
    title,
    latin,
    lore,
    textured: true,
    fastField: true,
    keepIslands: true,
    joints: r.joints,
    shapes,
    clips,
    cell: fineCell,
    skin,
    fineCell,
    triangles,
    textureSize: 2048,
    ormSize: 2048,
    emissiveSize: 1024,
    padding: 8,
    simplifyError: 0.04,
    bakeAo: { step: 0.011, strength: 0.8 },
    curvatureScale: 0.008,
    searchStep: 0.02,
    searchSteps: 10,
    detailReach: 0.03,
    ...(emissionStrength ? { emissionStrength } : {}),
    regions: regions ?? [
      { name: 'head', shape: (sh) => sh.bone === 'head' && ['skin', 'eye', 'lips'].includes(sh.zone), triangles: 3400 },
      { name: 'hands', shape: (sh) => /^hand/.test(sh.bone) && /^(hand|glove)/.test(sh.tag) && !sh.rigid, triangles: 1800 },
    ],
    ...(hd
      ? {
          // The face is an island of its own with more texels than its size would give it.
          unwrapCentre: hd.O,
          unwrapIsland: (c) => c[2] - hd.O[2] > 0.035 * hd.s && c[1] - hd.O[1] < 0.045 * hd.s && c[1] - hd.O[1] > -0.118 * hd.s && Math.abs(c[0]) < 0.062 * hd.s,
          unwrapIslandScale: 3.0,
        }
      : {}),
    detail: (p, n, shape) => (shape.height ? shape.height(p, n) : 0) + zoneDetail(shape.zoneAt ? shape.zoneAt(p, n) : (shape.zone ?? 'cloth'), p, n, shape),
    surface: (p, n, shape, info) => zoneSurface(p, n, shape, info, paintAll),
    ...extra,
  };
}

// ------------------------------------------------------------------ shared pieces of kit
/** A ring of capsules through `centre` in the plane of `u` and `v` (unit, square), half-widths `ru`, `rv`, tube radius `r`. */
export function ring(bone, centre, u, v, ru, rv, r, n = 24, more = {}) {
  const pt = (a) => add(add(centre, mul(u, ru * Math.cos(a))), mul(v, rv * Math.sin(a)));
  return Array.from({ length: n }, (_, k) => C(bone, pt((k / n) * TAU), pt(((k + 1) / n) * TAU), r, r, { blend: r * 0.6, ...more }));
}
const fract = (x) => x - Math.floor(x);
/**
 * Lamellar armour drawn on a shape: rows of small plates laced together. `uv(p)` gives a point's
 * place on the armour in metres (u across, v up); rows `rowH` high of plates `colW` wide,
 * alternate rows shifted half a plate; each plate thickest at its lower edge (it overlaps the row
 * below), grooves between the plates, cord laced across each row near its top. `rowZone(row)` the
 * zone of a row's plates; `rowColour(row)` their colour; `cord` the lacing's colour.
 * Returns { zoneAt, height, colour } to spread into the shape.
 */
export function lamellar({ uv, rowH = 0.034, colW = 0.026, rowZone = () => 'lacquer', rowColour, cord }) {
  const cell = (p) => {
    const [u, v] = uv(p);
    const row = Math.floor(v / rowH);
    const fv = fract(v / rowH); // 0 at the row's lower edge
    const fu = fract(u / colW + (row & 1) * 0.5);
    const lace = fv > 0.74 && fv < 0.9 && Math.abs(fu - 0.5) < 0.16;
    return { row, fv, fu, lace };
  };
  return {
    zoneAt: (p) => {
      const c = cell(p);
      return c.lace ? 'cord' : rowZone(c.row);
    },
    height: (p) => {
      const c = cell(p);
      const groove = 1 - smooth(0.02, 0.09, c.fu) * smooth(0.98, 0.91, c.fu);
      return 0.0011 * (1 - c.fv) * smooth(0, 0.08, c.fv) - 0.0005 * groove + (c.lace ? 0.0007 : 0);
    },
    colour: (p) => {
      const c = cell(p);
      if (c.lace) return cord;
      let col = rowColour(c.row);
      // The lower edge of each plate a little darker (where it laps), its middle a little lighter.
      col = mix(col, mul(col, 0.78), smooth(0.12, 0.0, c.fv));
      return col;
    },
  };
}
/**
 * A panel of cloth or armour hung from the waist on joint `bone`: its top edge at `top`, leaning
 * out along `out` (`lean`), `across` along its width, cut straight at its hem 2·halfL below the
 * top. `shape`: the panel's own options (tag, zone, col…); `hem`: options of a hem band (or none).
 */
export function hangingPanel(bone, top, out, across, halfW, halfL, thick, { lean = 0.2, shape = {}, hem } = {}) {
  const down = norm(add([0, -1, 0], mul(out, lean)));
  const up = mul(down, -1);
  const axes = [across, up, norm(cross(across, up))];
  const c = add(add(top, mul(down, halfL * 1.25)), mul(out, thick * 0.4));
  const hemAt = add(add(top, mul(down, halfL * 2)), mul(out, thick * 0.4));
  const out_ = [E(bone, c, [halfW, halfL * 1.25, thick], { axes, blend: 0.012, keep: { normal: down, offset: dot(hemAt, down) }, ...shape })];
  if (hem) {
    const y = add(hemAt, mul(down, -thick * 0.5));
    out_.push(C(bone, add(y, mul(across, -halfW * 0.74)), add(y, mul(across, halfW * 0.74)), thick * 0.7, thick * 0.7, { blend: 0.01, ...hem }));
  }
  return out_;
}
/** The ponytail or any hanging lock on two joints keeps hanging when the head turns; `sway` (deg) and `lift` (deg, flung back). */
export function hangFollow(r, pose, first, second, { keep = 0.65, sway = 0, lift = 0, parentOf = 'head', settleTo = 'chest' } = {}) {
  const T = poser(r);
  const a = T.world(pose, parentOf),
    b = T.world(pose, settleTo);
  T.setWorld(pose, first, Q.mul(Q.slerp(a, b, keep), Q.mul(roll(sway), pitch(lift))));
  if (second) pose[second] = Q.mul(roll(sway * 0.7), pitch(lift * 0.5));
  return pose;
}
/**
 * The hair over the cranium of a head from head(), cut straight across the brow at `hairline`
 * (height over the eyes, in the head's units), tilted back by `tilt`; a second mass covers the top
 * of the forehead so the hair comes down to that line. `more`: the shapes' options (tag, zone…).
 */
export function hairCap(hd, { hairline = 0.05, tilt = 0.6, more = {} } = {}) {
  const { at, s } = hd;
  const n = norm([0, -tilt, 1]);
  const keep = { normal: n, offset: dot(at(0, hairline, 0.092), n) };
  return [
    E('head', at(0, 0.036, -0.016), [0.08 * s, 0.094 * s, 0.101 * s], { blend: 0.006, keep, ...more }),
    E('head', at(0, 0.062, 0.042), [0.066 * s, 0.05 * s, 0.052 * s], { blend: 0.01, keep, ...more }),
  ];
}
/** Whether p lies on a ring made by ring() (within its tube and `slack`): for colouring only the band. */
export function onRing(p, centre, u, v, ru, rv, r, slack = 0.0015) {
  const q = sub(p, centre);
  const a = Math.atan2(dot(q, v) / rv, dot(q, u) / ru);
  const c = add(add(centre, mul(u, ru * Math.cos(a))), mul(v, rv * Math.sin(a)));
  return len(sub(p, c)) < r + slack;
}
