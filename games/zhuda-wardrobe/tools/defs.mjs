// The wardrobe's character as shapes on one skeleton (the kit under games/tools/characters:
// signed-distance shapes, meshed and skinned by buildPart): the body, cut into regions, its three
// hairstyles and its clips. What it wears is tools/catalogue.mjs, made from this body's surface.
//   node tools/build-parts.mjs
import { C, E, Q, add, both, cross, dot, fbm3, hex, lerp3, mul, norm, sub, heroRig, head, hairCap, panelsFollow, hangingPanel, hangFollow, keyed, ring, wave, pitch, yaw, roll } from '../../tools/characters/hero-kit.mjs';
import { relaxedHand, surfaceOf, neutralGrey, motion } from '../../tools/characters/avatar-kit.mjs';

const GREY = [0.8, 0.8, 0.8], TRIM = hex('#3c3a3e'), SOLE = hex('#3c322b'), SKIN = hex('#dcb092'), LIP = hex('#b26a66'), UNDER = hex('#e9e4da'), WOOD = hex('#6e4e36');
export const H = 1.68;
// The figure's girths are a real body's: ASTM D5585 misses size 8 (tools/reference.mjs), checked by
// tools/measure.mjs. NECK and the radii below were set until the tape read within a few per cent.
const FACE = { sex: 'f', skin: SKIN, lip: LIP, jaw: 0.94, brow: 0.94, nose: 0.97, scale: 0.97, neck: 1.43, eyeScale: 1.03 };
const RIG = { H, shoulder: 0.106, hip: 0.054, hand: 1 };
const r0 = heroRig(RIG);
const hd0 = head(r0, FACE);
// Two joints for hair that falls down the back, two for cloth that hangs in front of and behind the legs.
const S0 = hd0.at(0, -0.075, -0.09), S1 = [0, 1.335, -0.166], S2 = [0, 1.165, -0.168];
export const r = heroRig({
  ...RIG,
  extras: [
    { name: 'robeF', parent: 'hips', at: [0, 0.92, 0.098] },
    { name: 'robeB', parent: 'hips', at: [0, 0.92, -0.108] },
    { name: 'hair1', parent: 'head', at: hd0.at(0, -0.06, -0.085) },
    { name: 'hair2', parent: 'hair1', at: S1 },
  ],
});
const { P } = r;
const hd = head(r, FACE);
const at = hd.at, s = hd.s, F = r.foreDir, A = r.armDir;
const skin = (region, more = {}) => ({ tag: region, zone: 'skin', col: SKIN, material: 'body', region, ...more });
const tagged = (shapes, more) => shapes.map((sh) => ({ ...sh, ...more }));

// ------------------------------------------------------------------ the body, by region
const torso = [
  E('spine', [0, 1.035, 0.0], [0.121, 0.105, 0.093], { blend: 0.05, ...skin('torso') }),
  E('spine', [0, 0.945, 0.012], [0.15, 0.08, 0.108], { blend: 0.05, ...skin('torso') }),
  E('chest', [0, 1.11, -0.004], [0.13, 0.09, 0.1], { blend: 0.04, ...skin('torso') }),
  E('chest', [0, 1.18, -0.008], [0.143, 0.124, 0.104], { blend: 0.05, ...skin('torso') }),
  ...both([E('chest', [0.068, 1.2, 0.07], [0.062, 0.058, 0.062], { blend: 0.04, ...skin('torso') })]),
  E('chest', [0, 1.275, -0.016], [0.15, 0.05, 0.082], { blend: 0.04, ...skin('torso') }),
  // The top of the back, up to the neck: a real back has no hollow between the shoulder blades and the nape.
  E('chest', [0, 1.335, -0.045], [0.085, 0.07, 0.05], { blend: 0.04, ...skin('torso') }),
];
const hips = [
  E('hips', [0, 0.885, -0.006], [0.152, 0.105, 0.108], { blend: 0.03, ...skin('hips') }),
  ...both([E('hips', [0.076, 0.85, -0.062], [0.08, 0.085, 0.07], { blend: 0.045, ...skin('hips') })]),
];
const shoulders = both([
  C('chest', [0.048, 1.33, -0.024], [0.16, 1.318, -0.02], 0.036, 0.04, { blend: 0.04, ...skin('shoulders') }),
  // The slope of a real shoulder: from the side of the neck down to the shoulder's point (about 23 degrees).
  C('chest', [0.05, 1.403, -0.03], [0.168, 1.338, -0.022], 0.04, 0.032, { blend: 0.035, ...skin('shoulders') }),
  E('armL', add(P.shoulder, mul(A, 0.028)), [0.046, 0.046, 0.046], { blend: 0.035, ...skin('shoulders') }),
]);
const upperArms = both([C('armL', add(P.shoulder, mul(A, 0.04)), P.elbow, 0.0435, 0.036, { blend: 0.03, ...skin('upperArms') })]);
const forearms = both([C('foreL', P.elbow, P.wrist, 0.037, 0.0245, { blend: 0.02, ...skin('forearms') })]);
const hands = tagged(both(relaxedHand(r, 'L', { col: SKIN })), { material: 'body', region: 'hands' });
// A thigh stays full to its middle and narrows to the knee; a shin has a calf behind it.
// (It is deeper than it is wide, as a real thigh is at the top: round and as thick as a real one, the
// two would run into each other and the mesher would join the legs down to the knee.)
const thighs = both([
  E('thighL', [P.hip[0] + 0.007, 0.7, 0.0], [0.078, 0.23, 0.097], { blend: 0.012, ...skin('thighs') }),
  C('thighL', [P.hip[0] + 0.004, 0.66, 0.003], P.knee, 0.074, 0.054, { blend: 0.02, ...skin('thighs') }),
]);
const shins = both([
  C('shinL', P.knee, add(P.ankle, [0, 0.012, 0]), 0.053, 0.036, { blend: 0.02, ...skin('shins') }),
  E('shinL', [P.knee[0], P.knee[1] - 0.13, P.knee[2] - 0.022], [0.046, 0.085, 0.05], { blend: 0.03, ...skin('shins') }),
]);
const feetL = [
  E('footL', [P.ankle[0], 0.042, 0.046], [0.047, 0.037, 0.124], { blend: 0.024, ...skin('feet') }),
  E('footL', [P.ankle[0], 0.042, -0.03], [0.04, 0.04, 0.044], { blend: 0.02, ...skin('feet') }),
];
const feet = both(feetL);
const headShapes = tagged([...hd.shapes, ...hd.neck], { material: 'body', region: 'head' });
export const body = [...hips, ...torso, ...shoulders, ...upperArms, ...forearms, ...hands, ...thighs, ...shins, ...feet, ...headShapes];
export const REGIONS = ['head', 'torso', 'shoulders', 'upperArms', 'forearms', 'hands', 'hips', 'thighs', 'shins', 'feet'];

// ------------------------------------------------------------------ what garments need of the figure
/** The figure's own measures, for tools/catalogue.mjs: where its joints are, which way its arms point. */
export const FIGURE = { P, A, F, at, head: hd, rig: r };

// ------------------------------------------------------------------ hair
const crown = at(0, 0.13, -0.02);
const HR = (part, more = {}) => ({ tag: 'hair', zone: 'hair', col: GREY, crown, material: 'hair', skinGroup: 'hair', part, tint: true, ...more });
const sheet = (part, bone, a, b, w0, w1) => {
  const along = norm(sub(b, a));
  const across = norm(cross([0, 0, 1], along)).map((v) => -v);
  const axes = [across, norm(cross(along, across)), along];
  const L = Math.hypot(...sub(b, a));
  return [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => E(bone, lerp3(a, b, t), [w0 + (w1 - w0) * t, 0.018, L * 0.26], { axes, blend: 0.014, ...HR(part, { crown: S0 }) }));
};
const cap = (part) => [
  ...hairCap(hd, { hairline: 0.05, tilt: 0.5, more: HR(part) }),
  C('head', at(-0.045, 0.088, 0.072), at(0.052, 0.05, 0.082), 0.015 * s, 0.006 * s, { blend: 0.01, ...HR(part) }),
  // The hair at the nape stands well off the neck: the neck turns under it when the head does.
  E('head', at(0, -0.03, -0.08), [0.076 * s, 0.075 * s, 0.054 * s], { blend: 0.02, ...HR(part) }),
  ...both([E('head', at(0.064, -0.016, -0.056), [0.034 * s, 0.056 * s, 0.046 * s], { blend: 0.016, ...HR(part) })]),
];
const knotC = at(0, 0.07, -0.098), bunC = at(0, 0.155, -0.035);
export const HAIR = [
  { id: 'hair-long', slot: 'hair', name: '長髮', covers: [], budget: 1800, shapes: [...cap('hair-long'), ...both([C('head', at(0.06, 0.04, 0.05), at(0.067, -0.078, 0.046), 0.011 * s, 0.0045 * s, { blend: 0.008, ...HR('hair-long') })]), E('head', knotC, [0.028 * s, 0.025 * s, 0.024 * s], { blend: 0.014, ...HR('hair-long', { crown: knotC }) }), ...sheet('hair-long', 'hair1', S0, S1, 0.066, 0.074), ...sheet('hair-long', 'hair2', S1, S2, 0.074, 0.048)] },
  { id: 'hair-bob', slot: 'hair', name: '短髮', covers: [], budget: 1500, shapes: [...cap('hair-bob'), ...both([E('head', at(0.066, -0.03, 0.012), [0.022 * s, 0.07 * s, 0.05 * s], { blend: 0.016, ...HR('hair-bob') })]), E('head', at(0, -0.075, -0.07), [0.066 * s, 0.045 * s, 0.04 * s], { blend: 0.02, ...HR('hair-bob') })] },
  { id: 'hair-bun', slot: 'hair', name: '髮髻', covers: [], budget: 1500, shapes: [...cap('hair-bun'), E('head', bunC, [0.036 * s, 0.032 * s, 0.034 * s], { blend: 0.012, ...HR('hair-bun', { crown: bunC }) }), C('head', add(bunC, [-0.052, 0.006, 0]), add(bunC, [0.052, -0.004, 0]), 0.0032, 0.003, { blend: 0.002, tag: 'pin', zone: 'wood', col: WOOD, material: 'hair', skinGroup: 'hair', part: 'hair-bun' })] },
];

// ------------------------------------------------------------------ colour
export function paint(p, n, shape, rgb) {
  if (shape.tint) return [1, 1, 1].map(() => neutralGrey(shape.material === 'hair' ? 'hair' : 'outfit', p, n, shape, { mid: 0.83 }));
  // Plain underclothes painted on the body, so that it can be shown with nothing over it.
  if (shape.region === 'hips' || (shape.region === 'torso' && p[1] > 1.13 && p[1] < 1.275)) return UNDER;
  return rgb;
}
export const face = { head: hd, iris: hex('#4a3022'), brow: hex('#3a2a24'), browAngle: -0.001, blush: 0.05, eyeScale: 1.03 };

// ------------------------------------------------------------------ motion
const M = motion(r);
const { T, R } = M;
const finish = (pose, { lift = 0, sway = 0 } = {}) => {
  // A little ahead of the leg (k above 1), so that the thigh stays behind the cloth it pushes.
  panelsFollow(r, pose, { front: 'robeF', back: 'robeB', has: ['robeF', 'robeB'], k: 1.12 });
  return hangFollow(r, pose, 'hair1', 'hair2', { keep: 0.8, lift: 1 + lift, sway });
};

// Idle (3.2 s, one breath and one shift of weight).
const IDLE = 3.2;
function stance(t) {
  const b = wave(t, IDLE),
    sh = wave(t, IDLE, 0.25),
    l = wave(t, IDLE, 0.55);
  const pose = {};
  T.stand(pose, { L: [P.ankle[0] + 0.012, 0.03, 8], R: [-P.ankle[0] - 0.004, -0.022, -16], drop: 0.012 + 0.003 * b, shift: [0.018 * sh, 0, 0.004 * b], hips: Q.mul(yaw(-4), roll(2.6 * sh)), kneeOut: 0.15 });
  pose.spine = Q.mul(Q.mul(pitch(1 + 1.1 * b), yaw(2)), roll(-2 * sh));
  pose.chest = Q.mul(pitch(-0.8 * b), roll(-0.8 * sh));
  pose.neck = Q.mul(yaw(2 + 4 * l), pitch(-1));
  pose.head = Q.mul(yaw(2 + 5 * l), Q.mul(roll(-2 + 1.2 * sh), pitch(-1)));
  pose.clavL = roll(0.8 * b);
  pose.clavR = roll(-0.8 * b);
  return { pose, b, sh };
}
function rest(t = 0) {
  const { pose, b, sh } = stance(t);
  M.hang(pose, 'L', { swing: 1.2 * b, out: 9, bend: 14 + 2 * b, curl: 14 });
  M.hang(pose, 'R', { swing: 0.8 * b, out: 9, bend: 16, curl: 14 });
  return finish(pose, { sway: 1.5 * sh });
}
const REST = rest(0);

const WALK = 1.0,
  RUN = 0.66;
function walkPose(t) {
  const { pose, s: w } = M.gait(t, WALK, { duty: 0.6, reach: 0.3, back: 0.41, toe: 32, lift: 0.085, drop: 0.028, bob: 0.011, twist: 6, roll: 3.5, sway: 0.014, lean: 3, width: -0.016, arms: { swing: 13, out: 9, bend: 14, pump: 8, curl: 14 } });
  pose.neck = yaw(-2 * w);
  pose.head = Q.mul(yaw(-1.5 * w), pitch(-2));
  return finish(pose, { lift: 3, sway: 2.5 * w });
}
function runPose(t) {
  const { pose, s: w } = M.gait(t, RUN, { duty: 0.3, reach: 0.27, back: 0.4, lift: 0.22, drop: 0.045, dip: 0.02, flight: 0.036, heel: 8, toe: 40, twist: 9, roll: 3, sway: 0.004, lean: 12, width: -0.012, arms: { swing: 26, out: 13, bend: 80, pump: 10, fwd: 6, curl: 30 } });
  pose.neck = Q.mul(pitch(-4), yaw(-4 * w));
  pose.head = Q.mul(pitch(-5), yaw(-2 * w));
  return finish(pose, { lift: 18, sway: 5 * w });
}

// Greet (1.8 s): the right hand raised beside her head, palm out, a little wave and a nod, then
// back to the idle pose.
function raised(a, nod = 1) {
  const { pose } = stance(0);
  pose.spine = Q.mul(pose.spine, roll(-2));
  pose.head = Q.mul(pose.head, Q.mul(roll(-6 * nod), pitch(7 * nod)));
  M.hang(pose, 'L', { swing: 0, out: 9, bend: 14, curl: 14 });
  const cq = T.world(pose, 'chest');
  const sh = R.place(pose, 'armR');
  const wrist = add(sh, Q.apply(cq, [-0.13, 0.13, 0.17]));
  const fingers = Q.apply(cq, Q.apply(roll(a), norm([-0.12, 1, 0.12])));
  const palm = Q.apply(cq, Q.apply(roll(a), norm([0, -0.1, 1])));
  T.handFrame(pose, 'R', norm(fingers), norm(palm), wrist, [-1, -0.7, -0.1]);
  return finish(pose, { sway: 1 });
}
const greet = (t) =>
  finish(
    keyed(t, [
      [0, REST],
      [0.42, raised(0, 0.6)],
      [0.62, raised(14)],
      [0.82, raised(-10)],
      [1.02, raised(12)],
      [1.22, raised(0, 0.6)],
      [1.8, REST],
    ]),
  );

// Poses no clip of the game reaches, for the clipping check only (the name starts with `_`: the game
// does not offer it): arms overhead with a twist, a deep bend at hip, knee and elbow, a high kick.
const hard = (set) => {
  const pose = {};
  set(pose);
  return finish(pose);
};
const STRESS = [
  hard(() => {}),
  hard((p) => ((p.armL = roll(135)), (p.armR = roll(-135)), (p.spine = yaw(30)), (p.chest = yaw(20)), (p.head = yaw(-35)))),
  hard((p) => ((p.thighL = pitch(-95)), (p.shinL = pitch(110)), (p.thighR = pitch(-95)), (p.shinR = pitch(110)), (p.spine = pitch(30)), (p.foreL = pitch(-100)), (p.foreR = pitch(-100)), (p.armL = pitch(-40)), (p.armR = pitch(-40)))),
  hard((p) => ((p.thighL = pitch(-100)), (p.thighR = pitch(25)), (p.shinR = pitch(40)), (p.spine = Q.mul(pitch(-12), roll(10))), (p.armL = Q.mul(roll(60), pitch(-50))), (p.armR = Q.mul(roll(-80), pitch(40))), (p.neck = pitch(20)))),
  hard(() => {}),
];
const stress = (t) => keyed(t, STRESS.map((pose, i) => [i * 0.8, pose]));

export const clips = {
  Idle: { seconds: IDLE, pose: (t) => rest(t) },
  Walk: { seconds: WALK, pose: walkPose },
  Run: { seconds: RUN, pose: runPose },
  Greet: { seconds: 1.8, loop: false, pose: greet },
  _Stress: { seconds: 3.2, loop: false, pose: stress },
};
