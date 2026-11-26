// The wardrobe's catalogue: every garment and object as a few numbers (where it starts and ends,
// how thick, what hangs from it), turned into what buildGarment needs. Adding an item is adding a
// line; tools/build-parts.mjs builds it, measures what it covers and refuses it if the body comes
// through it in any pose.
import { E, add, lerp3, mul, norm, sub } from '../../tools/characters/hero-kit.mjs';
import { fastField } from '../../tools/characters/fast-field.mjs';
import { solid as S, volume as V, zone as Z } from '../../tools/characters/garment.mjs';
import { FIGURE, body } from './defs.mjs';

const { P, A, F, at } = FIGURE;
/** Thickness by layer: what is worn over what is further from the skin. */
export const THICK = { shoes: 0.006, bottom: 0.011, suit: 0.011, top: 0.017, full: 0.022, waist: 0.027 };
const GREY = [0.8, 0.8, 0.8], SOLE = [0.24, 0.2, 0.17], LEATHER = [0.42, 0.33, 0.26], STRAW = [0.82, 0.7, 0.42], CANVAS = [0.45, 0.5, 0.36];
const mirrorPoint = (p) => [-p[0], p[1], p[2]];
/** A cut that both sides must satisfy (an arm hole on the left and on the right). */
const onBothSides = (z) => (p) => Math.max(z(p), z(mirrorPoint(p)));
const down = [0, -1, 0];
const thighDir = norm(sub(P.knee, P.hip));

// ---- the body the clothes are cut for: read off the figure itself, never typed in ----
const skinField = fastField(body, { reach: 0.12 });
/** How far the body reaches from its middle line at a height, in a direction (x, z). */
const reach = (y, dx, dz) => {
  let t = 0;
  while (t < 0.3 && skinField.distance(dx * t, y, dz * t) < 0) t += 0.002;
  return t;
};
/**
 * Where cloth that hangs from `top` is at each height down to `hem`, one way: as far out as the
 * body is anywhere above, and stretched straight between the places that hold it out (from the
 * shoulder blades to the seat, not into the small of the back and out again). Heights 1 cm apart.
 */
function drape(hem, top, dx, dz) {
  const heights = [], out = [];
  for (let h = top; h > hem - 0.005; h -= 0.01) heights.push(Math.max(h, hem));
  let most = 0;
  for (const h of heights) {
    const here = reach(h, dx, dz);
    // (Beside the arm pit a ray runs on into the arm: such a reach is not the trunk's.)
    most = Math.max(most, here > 0.24 ? 0 : here);
    out.push(most);
  }
  // Straight between the places that hold it out: nowhere under a line drawn between two of them.
  const taut = out.slice();
  for (let i = 0; i < out.length; i++)
    for (let j = i + 2; j < out.length; j++)
      for (let k = i + 1; k < j; k++) taut[k] = Math.max(taut[k], out[i] + ((out[j] - out[i]) * (k - i)) / (j - i));
  return (y) => taut[Math.max(0, Math.min(taut.length - 1, Math.round((top - y) / 0.01)))];
}
/**
 * The oval that holds the body all round, `more` clear of it: [half width, half depth, middle].
 * (A squared oval, power SQUARE: a trunk is flatter in front and behind than an ellipse.)
 * `far(dx, dz)` says how far the body reaches one way. Fitted to every direction, not to the
 * front, the back and the side alone: a thigh stands further forward than the belly between them.
 */
const SQUARE = 2.8;
function oval(far, more) {
  const points = [];
  for (let k = 0; k <= 12; k++) {
    const dx = Math.sin((k * Math.PI) / 12), dz = Math.cos((k * Math.PI) / 12), d = far(dx, dz) + more;
    points.push([dx * d, dz * d]);
  }
  const side = Math.max(...points.map((q) => q[0]));
  // The front and the back are fitted apart (a bust or a thigh in front must not push the back out).
  let front = points[0][1], back = -points[12][1], middle = (front - back) / 2;
  for (let pass = 0; pass < 4; pass++) {
    for (const [x, z] of points) {
      if (x >= side * 0.97) continue;
      const need = Math.abs(z - middle) / (1 - (x / side) ** SQUARE) ** (1 / SQUARE);
      if (z >= middle) front = Math.max(front, middle + need);
      else back = Math.max(back, need - middle);
    }
    middle = (front - back) / 2;
  }
  const depth = (front + back) / 2;
  return [side, depth, middle];
}
/** Heights of the figure (tools/measure.mjs takes them with a tape and compares them with a real body's). */
export const LEVEL = { hps: 1.437, bust: 1.21, waist: 1.033, band: 0.99, hip: 0.822, crotch: 0.772, knee: P.knee[1], ankle: P.ankle[1] };
/**
 * Lengths taken from real garments (tools/reference.mjs gives the sources and the ranges): a
 * T-shirt 64 cm from the shoulder's high point (a long one 69); skirts 43, 48, 58 and 90 cm from the waist; a
 * trouser leg to the ankle bone, 44 cm round at its opening.
 */
export const CUT = { tee: 0.64, crop: 0.4, tunic: 0.69, mini: 0.43, kneeSkirt: 0.48, midi: 0.58, maxi: 0.9, legOpening: 0.44, trouserHem: 0.085 };
const HEM = { tee: LEVEL.hps - CUT.tee, crop: LEVEL.hps - CUT.crop, tunic: LEVEL.hps - CUT.tunic, mini: LEVEL.band - CUT.mini, knee: LEVEL.band - CUT.kneeSkirt, midi: LEVEL.band - CUT.midi, maxi: LEVEL.band - CUT.maxi };

// ---- zones ----
/**
 * Necklines, as real ones are specified: how wide between the shoulders' high points, and how far
 * the front and the back drop below them. The numbers are what the cut is given; tools/measure.mjs
 * takes them again on the made garment (a crew neck reads 17 cm wide, about 10.5 cm and 4.5 cm).
 */
const COLLAR = { wide: { width: 0.21, front: 0.135, back: 0.045 }, crew: { width: 0.17, front: 0.095, back: 0.025 } };
const SLEEVE = { cap: 0.105, short: 0.17, elbow: 0.245 };
/** Not on an arm past a plane `from` metres out from the shoulder joint: an arm hole, cut square. */
const offArms = (from) => {
  const start = add(P.shoulder, mul(A, from));
  const arm = Z.any(Z.capsule({ a: sub(P.shoulder, mul(A, 0.04)), b: P.elbow, r: 0.09 }), Z.capsule({ a: P.elbow, b: add(P.wrist, mul(F, 0.14)), r: 0.09 }));
  // Outside the arm's surroundings, or before the plane.
  return onBothSides(Z.any((p) => -arm(p), Z.before({ at: start, dir: A })));
};
/** A neck hole: an upright oval through the cloth, placed so that its front and back come where the specification says. */
function neckHole(collar, t) {
  // (Thicker cloth sits a centimetre lower on the nape.)
  const { width, front } = COLLAR[collar], back = COLLAR[collar].back + (t > THICK.top ? 0.01 : 0);
  const zFront = reach(LEVEL.hps - front, 0, 1) + t, zBack = reach(LEVEL.hps - back, 0, -1) + t;
  const middle = (zFront - zBack) / 2, depth = (zFront + zBack) / 2, w = width / 2;
  // Nor does the cloth climb the neck outside the oval: in front and behind it ends on a round line
  // from the neckline's lowest point up to the shoulders' high points, as a neckline is cut.
  const high = LEVEL.hps + 0.022;
  const line = (lowest) => (x) => high - (high - lowest) * Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(x) / w) ** 2));
  const inFront = line(LEVEL.hps - front), behind = line(LEVEL.hps - back + 0.012);
  return (p) => (p[1] < 1.26 ? -1 : Math.max((1 - Math.hypot(p[0] / w, (p[2] - middle) / depth)) * Math.min(w, depth), p[1] - (p[2] > middle ? inFront(p[0]) : behind(p[0]))));
}
/** The trunk from a hem up to the shoulders, with a neck hole and arm holes. A high collar has no hole: it goes up the neck. */
const trunk = (hem, collar, armHole = 0.035, t = THICK.top) =>
  Z.all(Z.slab({ yMin: hem, yMax: collar === 'high' ? 1.44 : 1.46, xMax: P.shoulder[0] + 0.057 }), collar === 'high' ? () => -1 : neckHole(collar, t), offArms(armHole));
function sleeves(kind) {
  if (kind === 'none') return null;
  const from = sub(P.shoulder, mul(A, 0.05));
  // Wide round the upper arm, well wider than the arm hole the trunk leaves (offArms): the two
  // overlap deeply under the arm, so that no gap and no seam is left there. Only outwards of the
  // shoulder: so wide a sleeve would otherwise take in the neck.
  const outwards = Z.before({ at: sub(P.shoulder, mul(A, 0.08)), dir: mul(A, -1) });
  if (kind !== 'long') {
    const cut = add(P.shoulder, mul(A, SLEEVE[kind]));
    return Z.both(Z.all(Z.capsule({ a: from, b: add(cut, mul(A, 0.06)), r: 0.13 }), Z.before({ at: cut, dir: A }), outwards));
  }
  const cuff = sub(P.wrist, mul(F, 0.03));
  return Z.both(Z.any(Z.all(Z.capsule({ a: from, b: P.elbow, r: 0.13 }), outwards), Z.all(Z.capsule({ a: sub(P.elbow, mul(F, 0.03)), b: P.wrist, r: 0.085 }), Z.before({ at: cuff, dir: F }))));
}
const topZone = ({ hem, collar = 'crew', sleeve = 'none', t = THICK.top }) => {
  const s = sleeves(sleeve);
  // Without sleeves the arm hole is cut upright, inside the shoulder's point and down to the arm pit,
  // as a real one is: a strap, not a wing.
  if (s) return Z.any(trunk(hem, collar, 0.035, t), s);
  const strap = P.shoulder[0] - 0.045, pit = 1.265;
  return Z.all(trunk(hem, collar, -0.012, t), (p) => Math.min(p[1] - pit, Math.abs(p[0]) - strap));
};
/**
 * The body of a top as a real one hangs: straight down from the bust, the shoulder blades and the
 * ribs, not drawn in at the waist. An oval at each height, as far out as the body is anywhere
 * above it, plus the cloth.
 */
function hangFrom(hem, t) {
  const top = LEVEL.bust, a = [], b = [], z = [], hung = new Map();
  const far = (dx, dz) => {
    const key = `${dx},${dz}`;
    if (!hung.has(key)) hung.set(key, drape(hem, top, dx, dz));
    return hung.get(key);
  };
  // (A real top is a tube, about as far round at its hem as at its chest, and is drawn in under the
  // bust to go round the seat. Drawn in like that, this one came through by a skirt worn under it
  // in deep bends: it is left hanging straight, and tools/measure.mjs reports its hem as too wide.)
  for (let y = top; y > hem - 0.005; y -= Math.min(0.05, Math.max(0.01, y - hem))) {
    // Below the hips a long top widens a little, as a tunic does: it lies over a skirt's flare.
    const height = Math.max(y, hem), grow = Math.min(1, (top - height) / 0.03) * 0.007 - 0.004 + Math.max(0, LEVEL.hip - height) * 0.1;
    const [side, depth, middle] = oval((dx, dz) => far(dx, dz)(height), t + grow);
    (a.push([height, side]), b.push([height, depth]), z.push([height, middle]));
    if (height === hem) break;
  }
  return V.bell({ top, hem, a, b, z, power: SQUARE });
}
// It goes with the skin under it exactly as cloth lying on that skin would (looseSoft is the skin's own
// softness): what is worn under a top lies on the skin, and the two must move as one.
const TRUNK = ['spine', 'chest', 'hips', 'thighL', 'thighR'];
const WAIST = LEVEL.band;
const seat = Z.slab({ yMin: 0.74, yMax: WAIST, xMax: 0.26 });
function legs(length) {
  const thigh = Z.capsule({ a: add(P.hip, [0, 0.05, 0]), b: P.knee, r: 0.135 });
  if (length === 'short') return Z.both(Z.all(thigh, Z.before({ at: lerp3(P.hip, P.knee, 0.45), dir: thighDir })));
  if (length === 'knee') return Z.both(Z.all(thigh, Z.before({ at: lerp3(P.hip, P.knee, 0.9), dir: thighDir })));
  // To the ankle the cloth on the leg stops short of the ankle's crease; the tube (legTubes) goes on down to the hem.
  const y = length === 'calf' ? 0.3 : 0.12;
  return Z.both(Z.any(thigh, Z.all(Z.capsule({ a: P.knee, b: P.ankle, r: 0.115 }), Z.before({ at: [0, y, 0], dir: down }))));
}
const trouserZone = (length) => Z.any(seat, legs(length));
/**
 * A trouser leg below the knee: a straight tube to its opening, as a real one is; it does not follow
 * the calf in to the ankle. The opening sits a little behind the ankle: a heel rises into it in a stride.
 */
function legTubes(t) {
  const opening = CUT.legOpening / (2 * Math.PI) + (t - THICK.bottom);
  const one = (side) => V.tube({ a: [side * P.knee[0], P.knee[1] - 0.02, P.knee[2]], b: [side * P.ankle[0], CUT.trouserHem, P.ankle[2] - 0.015], ra: 0.056 + (t - THICK.bottom), rb: opening });
  return V.any(one(1), one(-1));
}
/** A leg below the knee hangs from the knee and goes with the shin alone. */
const SHINS = ['shinL', 'shinR'];
function shoeZone(height) {
  const x = P.ankle[0];
  const foot = Z.capsule({ a: [x, 0.035, -0.075], b: [x, 0.035, 0.155], r: 0.07 });
  const top = P.ankle[1] + height;
  return Z.both(Z.all(Z.any(foot, Z.capsule({ a: [x, 0.03, P.ankle[2]], b: [x, top + 0.05, P.ankle[2]], r: 0.078 })), Z.before({ at: [0, top, 0], dir: [0, 1, 0] })));
}

/**
 * The bell of a skirt from the waistband down to `hem` (a height): on the body to the hips, then
 * `flare` wider at the hem (an A-line: tools/reference.mjs gives real sweeps).
 */
function bell(hem, t, flare) {
  const top = WAIST - 0.01, hipY = LEVEL.hip;
  const waist = oval((dx, dz) => reach(top, dx, dz), t + 0.003), hip = oval((dx, dz) => reach(hipY, dx, dz), t + 0.005);
  const end = [hip[0] + flare, hip[1] + flare * 0.85, hip[2]];
  const profile = (k) => (hem >= hipY ? [[top, waist[k]], [hem, hip[k]]] : [[top, waist[k]], [hipY, hip[k]], [hem, end[k]]]);
  return V.bell({ top, hem, a: profile(0), b: profile(1), z: profile(2), power: SQUARE });
}
/** What a skirt follows: the hips and the legs, never a hand hanging beside it; the shins only if it reaches them. */
const THIGHS = ['hips', 'spine', 'thighL', 'thighR'], LEGS = [...THIGHS, 'shinL', 'shinR'];
const followFor = (hem) => (hem > 0.5 ? THIGHS : LEGS);
/** From the waist to the hips a skirt lies on the body at its thickness; the bell takes over where it is wider. */
const yoke = Z.slab({ yMin: LEVEL.hip - 0.012, yMax: WAIST, xMax: 0.26 });

// ---- colour: one neutral grey a game tints ----
// No darker band at necks, cuffs and hems: a real rib or hem is the garment's own colour, and a
// band painted on the vertices came out ragged (it follows the triangles) and in patches (see
// `edge` in garment.mjs). Stitching, ribs and weave are for a texture. Only the face that closes a
// hem from below is dark, as the inside of a skirt is.
const UNDER = [0.3, 0.29, 0.32];
// (A bell's end faces are its hem and its top: only the one that faces down is the inside of a skirt.
// The top face came out as a row of dark points on a skirt's waistband: local-results/B1.)
const cloth = (p, n, info) => (info.end === 'loose' && n[1] < 0 ? UNDER : GREY);
const shoePaint = (p) => (p[1] < 0.016 ? SOLE : GREY);
const fixed = (rgb) => () => rgb;

// ---- the items ----
const top = (id, name, length, sleeve, collar, budget) => {
  const hem = LEVEL.hps - length;
  return { id, name, slot: 'top', thickness: THICK.top, zone: topZone({ hem, sleeve, collar }), volume: hangFrom(hem, THICK.top), follow: TRUNK, looseSoft: 0.024, paint: cloth, budget };
};
const bottom = (id, name, length, budget) => ({ id, name, slot: 'bottom', thickness: THICK.bottom, zone: trouserZone(length), volume: length === 'ankle' ? legTubes(THICK.bottom) : undefined, follow: SHINS, paint: cloth, budget });
const skirt = (id, name, hem, flare, budget) => ({ id, name, slot: 'bottom', thickness: THICK.bottom, zone: yoke, volume: bell(hem, THICK.bottom, flare), follow: followFor(hem), paint: cloth, budget });
const full = (id, name, { sleeve, collar = 'crew', skirt: hem, flare = 0.03, legs: length }, budget) => {
  // With legs it is cloth as thin as trousers': thick cloth on thighs as full as real ones meets
  // between them, and tears there when a leg is raised.
  const t = length ? THICK.suit : THICK.full;
  return {
    id, name, slot: 'full', thickness: t,
    zone: length ? Z.any(topZone({ hem: 0.9, sleeve, collar, t }), trouserZone(length)) : topZone({ hem: LEVEL.hip - 0.012, sleeve, collar, t }),
    volume: hem ? bell(hem, t, flare) : length === 'ankle' ? legTubes(t) : undefined, follow: hem ? followFor(hem) : SHINS, paint: cloth, budget,
  };
};
const shoe = (id, name, height, budget, tintable = true) => ({ id, name, slot: 'shoes', thickness: THICK.shoes, zone: shoeZone(height), paint: tintable ? shoePaint : (p) => (p[1] < 0.016 ? SOLE : LEATHER), tintable, budget });
const rigid = (bone, shape, rgb) => ({ ...shape, bone, rigid: true, tag: 'object', zone: 'leather', col: rgb });

// ---- hard objects, at the sizes real ones are sold in (tools/reference.mjs) ----
/** A conical hat: a right cone 42 cm across and 15 cm high, resting on a ring inside it, clear of the hair. */
export const HAT = (() => {
  const radius = 0.21, height = 0.15, room = 0.034, axis = at(0, 0.098, -0.012);
  let apex = 0, crown = 0;
  for (let rho = 0; rho <= 0.12; rho += 0.01)
    for (let k = 0; k < 12; k++) {
      const x = rho * Math.cos((k * Math.PI) / 6), z = axis[2] + rho * Math.sin((k * Math.PI) / 6);
      let y = 1.8;
      while (y > 1.5 && skinField.distance(x, y, z) > 0) y -= 0.002;
      if (y <= 1.5) continue;
      ((apex = Math.max(apex, y + room + (rho * height) / radius)), (crown = Math.max(crown, y)));
    }
  return { radius, height, apex, crown, axis: [0, apex - height, axis[2]] };
})();
/** A 20-litre day pack: 42 x 26 x 14 cm, against the back, hung from straps over the shoulders. */
export const PACK = (() => {
  const h = 0.42, w = 0.26, d = 0.14, back = -(reach(1.2, 0, -1) + THICK.full + 0.006);
  return { h, w, d, back, centre: [0, 1.19, back - d / 2] };
})();
/** The point of the skin reached from a point inside the body, going one way. */
const skinFrom = (from, dir) => {
  let t = 0;
  while (t < 0.3 && skinField.distance(from[0] + dir[0] * t, from[1] + dir[1] * t, from[2] + dir[2] * t) < 0) t += 0.002;
  return [from[0] + dir[0] * t, from[1] + dir[1] * t, from[2] + dir[2] * t];
};
const strapZone = (() => {
  const x = 0.085, r = 0.026;
  const over = skinFrom([x, 1.3, -0.02], [0, 1, 0]);
  const front = [over, skinFrom([x, 1.34, -0.02], [0, 0, 1]), skinFrom([0.1, 1.25, 0], [0, 0, 1]), skinFrom([0, 1.14, 0], [0.98, 0, 0.2]), skinFrom([0, 1.1, 0], [0.86, 0, -0.5])];
  const behind = [over, skinFrom([x, 1.32, -0.02], [0, 0, -1]), skinFrom([x, 1.22, -0.02], [0, 0, -1])];
  const chain = (points) => points.slice(1).map((b, k) => Z.capsule({ a: points[k], b, r }));
  return Z.both(Z.any(...chain(front), ...chain(behind)));
})();
const pouchAt = (side) => {
  const d = [0.77 * side, 0.64], out = reach(0.94, d[0], d[1]) + 0.014;
  return V.blob({ center: [d[0] * out, 0.94, d[1] * out], radii: [0.036, 0.042, 0.045] });
};
const strawPaint = (p, n) => (n[1] < -0.2 ? [0.6, 0.5, 0.3] : Math.hypot(p[0], p[2] - HAT.axis[2]) > HAT.radius - 0.012 ? [0.66, 0.55, 0.32] : STRAW);

// Tried at real lengths and left out: a mini skirt (43 cm) and tops to the middle of the thigh
// (69 cm and longer). In the split kick of the stress clip a raised thigh comes out from under
// them, and the look report sees more than its limit of covered skin or of the cloth's inside.
// Cuts that fail a measure are not in the catalogue.
export const CATALOGUE = [
  top('tank', '背心', CUT.tee, 'none', 'wide', 2300),
  top('crop-tank', '短背心', CUT.crop, 'none', 'wide', 1500),
  top('tee', '短袖', CUT.tee, 'short', 'crew', 3000),
  top('crop-tee', '短版短袖', CUT.crop, 'short', 'crew', 2200),
  top('cap-tee', '蓋袖上衣', CUT.tee, 'cap', 'wide', 2700),
  top('elbow-top', '五分袖', CUT.tee, 'elbow', 'crew', 3400),
  top('shirt', '長袖', CUT.tee, 'long', 'crew', 4000),
  top('turtleneck', '高領長袖', CUT.tee, 'long', 'high', 4200),
  top('crop-shirt', '短版長袖', CUT.crop, 'long', 'crew', 3200),
  bottom('shorts', '短褲', 'short', 1600),
  bottom('knee-shorts', '及膝褲', 'knee', 2200),
  bottom('capri', '七分褲', 'calf', 2800),
  bottom('trousers', '長褲', 'ankle', 3400),
  skirt('skirt', '及膝裙', HEM.knee, 0.03, 2400),
  skirt('long-skirt', '長裙', HEM.maxi, 0.073, 3200),
  full('robe', '長袍', { sleeve: 'long', skirt: HEM.maxi, flare: 0.073 }, 5800),
  full('dress', '短袖洋裝', { sleeve: 'short', skirt: HEM.knee, flare: 0.03, collar: 'wide' }, 4600),
  full('sun-dress', '無袖長洋裝', { sleeve: 'none', skirt: HEM.midi, flare: 0.035, collar: 'wide' }, 4200),
  full('gown', '五分袖長禮服', { sleeve: 'elbow', skirt: HEM.maxi, flare: 0.073, collar: 'wide' }, 5400),
  full('jumpsuit', '連身褲', { sleeve: 'long', legs: 'ankle' }, 5800),
  full('playsuit', '連身短褲', { sleeve: 'short', legs: 'short', collar: 'wide' }, 3800),
  shoe('shoes', '布鞋', 0.02, 1000),
  shoe('ankle-boots', '短靴', 0.1, 1300, false),
  shoe('boots', '靴', 0.2, 1700, false),
  shoe('tall-boots', '長靴', 0.33, 2200, false),
  // Hard objects are solids with edges, each wholly on one joint, where the body under them does not bend.
  {
    // (A bun on the crown stands where the cone is: not worn together.)
    id: 'straw-hat', name: '斗笠', slot: 'hat', tintable: false, budget: 200, apart: ['hair-bun'], paint: fixed(STRAW),
    extra: [rigid('head', E('head', [0, HAT.crown + 0.012, HAT.axis[2]], [0.07, 0.016, 0.075], { blend: 0 }), STRAW)],
    solids: [{ bone: 'head', colour: strawPaint, ...S.lathe({ centre: HAT.axis, profile: [[0, HAT.height], [HAT.radius, 0], [HAT.radius - 0.006, -0.005], [0, HAT.height - 0.012]], sides: 32 }) }],
  },
  {
    // (Long hair hangs where the pack is: not worn together.)
    id: 'pack', name: '背包', slot: 'back', tintable: false, budget: 900, apart: ['hair-long'], thickness: THICK.waist, zone: strapZone, paint: fixed([0.3, 0.33, 0.25]),
    solids: [
      { bone: 'chest', colour: CANVAS, ...S.block({ centre: PACK.centre, half: [PACK.w / 2, PACK.h / 2, PACK.d / 2], power: 5, steps: 6 }) },
      { bone: 'chest', colour: [0.39, 0.44, 0.31], ...S.block({ centre: [0, PACK.centre[1] - 0.085, PACK.back - PACK.d - 0.016], half: [0.095, 0.1, 0.03], power: 4, steps: 4 }) },
    ],
  },
  // A soft object is a loose volume: it gives with the body under it, and what it covers is not drawn.
  // (A belt goes over a dress or a short top. The tops that hang over the waistband would hide it: not worn with them.)
  { id: 'belt-pouch', name: '腰帶與腰包', slot: 'waist', apart: ['tank', 'tee', 'cap-tee', 'elbow-top', 'shirt', 'turtleneck'], tintable: false, budget: 900, thickness: THICK.waist, zone: Z.slab({ yMin: WAIST - 0.037, yMax: WAIST, xMax: 0.26 }), volume: V.any(pouchAt(1), pouchAt(-1)), follow: THIGHS, paint: (p, n, info) => (info.part === 'loose' ? [0.36, 0.28, 0.22] : LEATHER) },
];
