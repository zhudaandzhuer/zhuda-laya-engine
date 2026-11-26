// 九野印契 player avatars (../avatars/*.mjs): the young 契師 the player walks the hub as. Built
// as the heroes are (hero-kit.mjs, ../../hd/textured.mjs), with one difference the game needs:
// the model has three materials on separate primitives over one skeleton and skin,
//   <id>-body    skin, face, eyes, and every part whose colour stays fixed (trims, sash, pouch,
//                seal, trousers, boots);
//   <id>-hair    the hair;
//   <id>-outfit  the main garment;
// so the game can recolour hair and outfit by the material's base colour (it multiplies, and
// cannot brighten). A shape says which it belongs to with `material: 'hair' | 'outfit'` (no tag:
// body). Hair and outfit are baked without hue: light neutral grey, their strands and folds in
// luminance only, so that any colour multiplied onto them keeps the shading. All three share one
// set of textures (one atlas), so the three primitives cost three draws and no extra texture.
//
// This file holds what the two avatars share: the definition wrapper (materials, the neutral bake),
// an open relaxed hand (the heroes' hands are fists round a weapon), trims laid on a surface (a
// cross collar, a sash wound round the waist), and the motion: arms that hang and swing, feet kept
// on the ground, a walk and a run in place.
import { createZhudaSdfField } from 'zhuda-laya-engine';
import { bare } from './kit.mjs';
import { C, E, Q, TAU, add, clamp, cross, dot, fbm3, heroDef, mul, noise3, norm, pitch, poser, smooth, sub, yaw } from './hero-kit.mjs';

export const MATERIALS = ['body', 'hair', 'outfit'];
const NEUTRAL = ['hair', 'outfit'];
/** Display (sRGB) grey limits of the neutral bake: 0.95 is 242 (the asset spec's non-metal top is 243), linear 0.89. */
const TOP = 0.95,
  FLOOR = 0.3;

// ------------------------------------------------------------------ the neutral bake
/** The flow of hair from a crown point over the surface: down and back (as hero-kit's). */
function hairFlow(p, n, crown) {
  const d = norm(sub(p, crown));
  const f = norm(add(d, [0, -0.6, -0.2]));
  return norm(sub(f, mul(n, dot(f, n))));
}
/** Strands, 0..1: streaks along the hair's flow, fine and coarse. */
export function strands(p, n, crown) {
  const flow = hairFlow(p, n, crown ?? [0, 10, 0]);
  const across = norm(cross(n, flow));
  const a = dot(p, across),
    f = dot(p, flow);
  return 0.55 * noise3(a * 420, f * 9, 0.5, 11) + 0.45 * noise3(a * 150, f * 3.5, 1.5, 12);
}
/** Folds of cloth that hang (the same field as hero-kit's cloth detail height), about 0..1. */
export const folds = (p) => fbm3(p[0] * 22, p[1] * 5, p[2] * 22, 3, 3);

/**
 * A grey (display 0..1) for a neutral part: `mid` with its pattern in luminance only. Hair: the
 * strands; garment: the folds (darker in the hollows of a fold), a faint weave, patches.
 */
export function neutralGrey(kind, p, n, shape, { mid = 0.8 } = {}) {
  if (kind === 'hair') return mid + 0.5 * (strands(p, n, shape.crown) - 0.5) - 0.04 * smooth(0.45, 0.8, fbm3(p[0] * 30, p[1] * 12, p[2] * 30, 5, 2));
  const f = folds(p) - 0.5;
  const weave = Math.sin((p[0] + p[2]) * 1100) * Math.sin(p[1] * 1100);
  const patch = fbm3(p[0] * 9 + 2, p[1] * 9, p[2] * 9, 41, 3) - 0.5;
  return mid + 0.5 * f + 0.012 * weave + 0.03 * patch;
}

/**
 * Roughness that varies inside a neutral part (the asset spec asks for spread within every
 * material): hair a little glossier along some strands; cloth smoother where worn (the crests of
 * folds, broad patches) and rougher in its hollows.
 */
function roughness(kind, p, n, shape) {
  if (kind === 'hair') return 0.3 * (smooth(0.4, 0.6, strands(p, n, shape.crown)) - 0.5) + 0.1 * (noise3(p[0] * 60, p[1] * 60, p[2] * 60, 51) - 0.5);
  const wear = smooth(0.38, 0.62, fbm3(p[0] * 6 + 1, p[1] * 6, p[2] * 6, 53, 3));
  return -0.05 - 0.14 * (wear - 0.5) - 0.3 * (folds(p) - 0.5) + 0.06 * (noise3(p[0] * 120, p[1] * 120, p[2] * 120, 55) - 0.5);
}

/**
 * An avatar's textured definition: heroDef's, with `materials` (the three primitives) and the
 * neutral bake for hair and outfit: their grey from the definition's paint (luminance only) and a
 * little patchiness, not darkened in the hollows (the occlusion map does that when drawn; in the
 * colour too it would follow the occlusion map: asset spec D3), exactly grey (r = g = b) and held
 * between FLOOR and TOP; their roughness varied.
 * The textured build is asked to keep that grey to the edges of the charts (`neutralMaterials`:
 * the gutters round them are made grey too) and to store the base colour without halving its
 * colour resolution (JPEG 4:4:4), so that no colour of the skin or trims bleeds into them.
 * `tints`: [{ label, hair, outfit }] linear colours for the tinted previews (what the game does:
 * multiply the material's base colour).
 */
export function avatarDef({ tints = [], quickTint, hairTriangles = 1600, ...opts }) {
  // The heroes' budgets for the face and hands, and one for the hair (its outline is what is seen
  // of the head from behind and above).
  const regions = [
    { name: 'head', shape: (sh) => sh.bone === 'head' && ['skin', 'eye', 'lips'].includes(sh.zone), triangles: 3400 },
    { name: 'hands', shape: (sh) => /^hand/.test(sh.bone) && /^(hand|glove)/.test(sh.tag) && !sh.rigid, triangles: 1800 },
    { name: 'hair', shape: (sh) => sh.material === 'hair', triangles: hairTriangles },
  ];
  const def = heroDef({ regions, ...opts });
  for (const s of def.shapes) if (s.material && !MATERIALS.includes(s.material)) throw Error(`${def.id}: unknown material ${s.material}`);
  const surface = def.surface;
  return {
    ...def,
    materials: MATERIALS,
    neutralMaterials: NEUTRAL,
    baseColorSubsampling: 0,
    tints,
    quickTint,
    surface: (p, n, shape, info) => {
      const s = surface(p, n, shape, info);
      if (!NEUTRAL.includes(shape.material)) return s;
      const g = opts.paint(p, n, shape, shape.col, info);
      const big = fbm3(p[0] * 7 + 3.1, p[1] * 7, p[2] * 7, 17, 3);
      const L = clamp(((g[0] + g[1] + g[2]) / 3) * (1 + (big - 0.5) * 0.1), FLOOR, TOP);
      return { ...s, color: [L, L, L], roughness: clamp(s.roughness + roughness(shape.material, p, n, shape), 0.08, 1) };
    },
  };
}

// ------------------------------------------------------------------ hands
/**
 * An open, relaxed hand (on the left; `s` 'R' mirrors it) on the hand's frame from heroRig: the
 * heel and palm, four fingers a little curled toward the palm (the little finger shortest), the
 * thumb along the side. `curl` 1: as a hand hangs; more closes it.
 */
export function relaxedHand(r, s, { col, zone = 'skin', tag = 'hand', curl = 1 } = {}) {
  const g = (v) => r.side(s, v);
  const F = g(r.F),
    W = g(r.W),
    N = g(r.N);
  const w = g(r.P.wrist);
  const k = r.hk;
  const at = (f, ww, n) => add(add(add(w, mul(F, f * k)), mul(W, ww * k)), mul(N, n * k));
  const b = 'hand' + s;
  const o = (more = {}) => ({ tag, zone, col, soft: 0.012, ...more });
  const axes = [W, N, F];
  const out = [
    E(b, at(0.012, 0, 0.0), [0.029 * k, 0.019 * k, 0.026 * k], { axes, blend: 0.012, ...o() }),
    E(b, at(0.046, -0.002, 0.001), [0.04 * k, 0.0145 * k, 0.04 * k], { axes, blend: 0.012, ...o() }),
  ];
  // Fingers: from the knuckles, two pieces each, bending toward the palm (+N).
  [
    [-0.026, 0.8],
    [-0.009, 0.94],
    [0.008, 1.0],
    [0.025, 0.93],
  ].forEach(([x, l]) => {
    const k0 = at(0.083, x, 0.0);
    const k1 = at(0.083 + 0.03 * l, x * 0.98, 0.006 + 0.004 * curl);
    const k2 = at(0.083 + 0.052 * l - 0.004 * curl, x * 0.95, 0.017 + 0.012 * curl);
    out.push(C(b, k0, k1, 0.0098 * k, 0.0088 * k, { blend: 0.004, ...o({ tag: tag + '-finger' }) }));
    out.push(C(b, k1, k2, 0.0088 * k, 0.0072 * k, { blend: 0.003, ...o({ tag: tag + '-finger' }) }));
  });
  // The thumb: from the heel along the side, its tip toward the fingers.
  out.push(C(b, at(0.022, 0.03, 0.008), at(0.055, 0.044, 0.02), 0.013 * k, 0.0105 * k, { blend: 0.008, ...o() }));
  out.push(C(b, at(0.055, 0.044, 0.02), at(0.08, 0.046, 0.03 + 0.004 * curl), 0.0105 * k, 0.0085 * k, { blend: 0.004, ...o() }));
  return out;
}

// ------------------------------------------------------------------ trims on a surface
/** The surface of some shapes, for laying trims on it: a ray's first hit and the normal there. */
export function surfaceOf(shapes) {
  const field = createZhudaSdfField(shapes.filter((s) => !s.subtract).map(bare));
  const d = (p) => field.distance(p[0], p[1], p[2]);
  const normal = (p, e = 0.002) => norm([d(add(p, [e, 0, 0])) - d(sub(p, [e, 0, 0])), d(add(p, [0, e, 0])) - d(sub(p, [0, e, 0])), d(add(p, [0, 0, e])) - d(sub(p, [0, 0, e]))]);
  /** From `from` along `dir` to the surface (marching by the distance). */
  const hit = (from, dir) => {
    dir = norm(dir);
    let t = 0;
    for (let i = 0; i < 400; i++) {
      const p = add(from, mul(dir, t));
      const v = d(p);
      if (v < 2e-4) return p;
      t += Math.max(v * 0.9, 3e-4);
      if (t > 2) break;
    }
    throw Error(`surfaceOf: no surface from ${from.map((v) => v.toFixed(3))} along ${dir.map((v) => v.toFixed(2))}`);
  };
  return { distance: d, normal, hit };
}
/**
 * A flat band through points on a surface (`pts`: [{ p, n }], p on the surface, n its normal):
 * capsules `width` wide and `thick` thick lying on it, lifted so they stand `rise` proud. `side`
 * gives each piece the direction across the band toward its inner edge (for painting).
 * The fillet is kept tiny: the engine's `flatten` multiplies a shape's distance by its factor, so
 * a flattened band with a fillet of k blends (and counts as nearest, which decides the material)
 * as far as k / factor from it; with a fillet the edge of a trim came out ragged.
 */
export function band(bone, pts, { width, thick, rise = thick * 0.7, blend = 0.0008, more = {}, side } = {}) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i],
      b = pts[i + 1];
    const n = norm(add(a.n, b.n));
    const lift = (q) => add(q.p, mul(q.n, rise - thick * 0.5));
    const pa = lift(a),
      pb = lift(b);
    const across = norm(cross(n, sub(pb, pa)));
    out.push(C(bone, pa, pb, width * 0.5, width * 0.5, { flatten: { axis: n, factor: thick / width }, blend, ...more, bandA: pa, bandAcross: side ? side(across, i) : across, bandHalf: width * 0.5 }));
  }
  return out;
}
/** Where a point is across a band piece made by band(): -1 at its outer edge, 1 at its inner. */
export const acrossBand = (p, shape) => dot(sub(p, shape.bandA), shape.bandAcross) / shape.bandHalf;
/**
 * A loop round the body at height `y` (a sash wound round the waist): points on `surf` met by rays
 * from outside toward the axis through [0, y, zc]; `tilt` raises the front and lowers the back.
 * `from` and `to` (degrees, 0 in front, 90 at the left) make an arc of it instead (a hem).
 */
export function loopOn(surf, y, { zc = 0, n = 28, tilt = 0, from = 0, to = 360 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    const dir = [Math.sin(a), 0, Math.cos(a)];
    const yy = y + tilt * Math.cos(a);
    const p = surf.hit(add([0, yy, zc], mul(dir, 0.6)), mul(dir, -1));
    pts.push({ p, n: surf.normal(p) });
  }
  return pts;
}

// ------------------------------------------------------------------ motion
/** Motion tools on a rig from heroRig (with poser's). */
export function motion(r) {
  const T = poser(r);
  const { R, P } = r;
  /**
   * An arm that hangs from the shoulder, in the chest's frame: the upper arm `out` degrees from the
   * side and `swing` forward (negative: back), the elbow bent `bend` forward, the hand along the
   * forearm curled `curl` more, its palm toward the thigh.
   */
  const hang = (pose, s, { swing = 0, out = 8, bend = 12, curl = 10, roll = 0 } = {}) => {
    const sx = s === 'L' ? 1 : -1;
    const cq = T.world(pose, 'chest');
    const dir = (fwd, o) => Q.apply(cq, Q.apply(pitch(-fwd), [sx * Math.sin((o * Math.PI) / 180), -Math.cos((o * Math.PI) / 180), 0]));
    R.aim(pose, 'arm' + s, r.bind.upper(s), dir(swing, out));
    R.aim(pose, 'fore' + s, r.bind.lower(s), dir(swing + bend, out * 0.5));
    const f = dir(swing + bend + curl, out * 0.3);
    const palm = Q.apply(cq, Q.apply(pitch(-(swing + bend)), Q.apply(Q.axis([0, -1, 0], sx * roll), [-sx, 0, 0.2])));
    T.handFrame(pose, s, norm(f), norm(palm));
    return pose;
  };
  /**
   * A gait in place whose feet are planted: each foot is on the ground for `duty` of the cycle,
   * moving back at a constant speed from `reach` ahead of its bind place to `back` behind (so the
   * clip matches a ground speed of (reach + back) / (duty·period) and the foot does not slide
   * when the game moves the model at it; people land a foot closer in front than they push off
   * behind), rolling onto it from the heel and off it over the toes; in
   * the air it swings forward `lift` high. The legs are set by two-bone reach (poser), the body
   * lowered where the legs need it, bobbing (`bob`: walk, lowest when both feet are down) or
   * dipping on each footfall and rising in the flight (`dip`, `flight`: run); the hips turn and
   * roll with the legs, the chest turns back, the arms swing against the legs. `period` seconds a
   * stride of both legs; the left foot strikes at 0, the right at half.
   */
  const gait = (t, period, { duty = 0.62, reach = 0.36, back = reach, lift = 0.09, drop = 0.02, bob = 0.012, dip = 0, flight = 0, heel = 14, toe = 28, twist = 7, roll = 3, sway = 0.012, lean = 3, width = -0.008, toeOut = 6, arms }) => {
    const ph = (((t / period) % 1) + 1) % 1;
    const ease = (x) => x * x * (3 - 2 * x);
    const HEEL = 0.062,
      TOE = 0.145; // where the sole rolls, behind and ahead of the ankle
    // The ankle and the foot's pitch (toes down +) for a foot on the ground: pivoting on the heel
    // at first, flat, then on the toes.
    const onGround = (k) => {
      const zf = reach - (reach + back) * k;
      const kh = 0.14,
        kt = 0.62;
      if (k < kh) {
        const a = -heel * (1 - k / kh) ** 2;
        const pivot = [0, 0, zf - HEEL];
        return { a: add(pivot, Q.apply(pitch(a), [0, P.ankle[1], HEEL])), pitch: a };
      }
      if (k > kt) {
        const a = toe * ((k - kt) / (1 - kt)) ** 2;
        const pivot = [0, 0, zf + TOE];
        return { a: add(pivot, Q.apply(pitch(a), [0, P.ankle[1], -TOE])), pitch: a };
      }
      return { a: [0, P.ankle[1], zf], pitch: 0 };
    };
    const off = onGround(1),
      on = onGround(0);
    const feet = {};
    for (const [s, shift] of [
      ['L', 0],
      ['R', 0.5],
    ]) {
      const u = (ph + shift) % 1;
      let f;
      if (u < duty) f = { ...onGround(u / duty), down: true };
      else {
        const k = (u - duty) / (1 - duty);
        const e = ease(k);
        const a = [0, off.a[1] + (on.a[1] - off.a[1]) * e + lift * Math.sin(Math.PI * k) ** 1.2, off.a[2] + (on.a[2] - off.a[2]) * e];
        f = { a, pitch: off.pitch + (on.pitch - off.pitch) * ease(Math.min(1, k * 1.25)), down: false };
      }
      const sx = s === 'L' ? 1 : -1;
      f.a = [sx * (P.ankle[0] + width), f.a[1], f.a[2] + P.ankle[2]];
      f.u = u;
      feet[s] = f;
    }
    // The body: hips turned with the leg ahead, rolled down on the side of the leg in the air.
    const cL = Math.cos(TAU * ph),
      mid = Math.cos(TAU * (ph - duty / 2));
    const pose = {};
    pose.hips = Q.mul(yaw(-twist * cL), Q.axis([0, 0, 1], roll * mid));
    pose.spine = Q.mul(pitch(lean), yaw(twist * 0.6 * cL));
    pose.chest = Q.mul(yaw(twist * 0.5 * cL), Q.axis([0, 0, 1], -roll * 0.6 * mid));
    // Height: the gait's own rise and fall, then no higher than both legs can reach.
    let dy;
    if (flight || dip) {
      // A run: a foot down for 2·duty of each half cycle (dipping), then both up (rising).
      const h = (ph * 2) % 1;
      const stanceShare = Math.max(0.05, Math.min(0.95, duty * 2));
      dy = h < stanceShare ? -drop - dip * Math.sin((Math.PI * h) / stanceShare) : -drop + flight * Math.sin((Math.PI * (h - stanceShare)) / (1 - stanceShare));
    } else dy = -drop - bob * (0.5 + 0.5 * Math.cos(4 * Math.PI * (ph - 0.05)));
    const legMax = 0.985 * (r.lengths.thigh + r.lengths.shin);
    for (const s of ['L', 'R']) {
      const f = feet[s];
      const hip = [s === 'L' ? P.hip[0] : -P.hip[0], P.hip[1], P.hip[2]];
      const dx = f.a[0] - hip[0],
        dz = f.a[2] - hip[2];
      const most = f.a[1] + Math.sqrt(Math.max(0, legMax * legMax - dx * dx - dz * dz)) - hip[1];
      dy = Math.min(dy, most);
    }
    pose.$root = [sway * mid, dy, 0];
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      T.legTo(pose, s, feet[s].a, [sx * 0.12, 0, 1]);
      T.footFlat(pose, s, sx * toeOut, feet[s].pitch);
    }
    // Arms: against the legs, a little after them.
    const a = Math.cos(TAU * (ph - 0.04));
    hang(pose, 'L', { swing: -arms.swing * a + (arms.fwd ?? 0), out: arms.out ?? 8, bend: (arms.bend ?? 12) + (arms.pump ?? 0) * Math.max(0, -a), curl: arms.curl ?? 12 });
    hang(pose, 'R', { swing: arms.swing * a + (arms.fwd ?? 0), out: arms.out ?? 8, bend: (arms.bend ?? 12) + (arms.pump ?? 0) * Math.max(0, a), curl: arms.curl ?? 12 });
    return { pose, s: cL, feet, speed: (reach + back) / (duty * period) };
  };
  return { T, R, P, hang, gait };
}
