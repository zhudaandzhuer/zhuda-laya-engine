/**
 * 「灰燼之庭」 figures and steel: the stage constants, the knight's and the warden's eight key
 * poses (atlas boxes, planted-foot origins, ten joint pins each), the action key tables, the
 * warden's armour surface, and the flexible blade (shape, contact, collision, spring).
 * Pure logic: no engine. The generic key-pose machinery lives in 2d/cel-motion and is
 * re-exported here, so the rest of this module reads the same as the original game's motion.ts.
 */
import {
  clamp,
  frame,
  mix,
  pin,
  type Key,
  type Point,
  type Pose,
} from "../cel-motion/cel-motion.ts";

export {
  clamp,
  curve,
  fixed,
  frame,
  mix,
  pin,
  poseAt,
  smooth,
  type Frame,
  type Key,
  type Pair,
  type Point,
  type Pose,
  type Rect,
} from "../cel-motion/cel-motion.ts";

export const WIDTH = 1280;
export const HEIGHT = 720;
export const FLOOR = 632;
export const KNIGHT_SCALE = 0.98;
export const WARDEN_SCALE = 0.9;
export const BLADE_LENGTH = 306;
export const BLADE_STEPS = 24;
export const RAD = Math.PI / 180;

// Boxes are atlas pixel edges. A distinct planted-foot origin prevents frame jitter.
export const KNIGHT = [
  frame(
    [42, 88, 314, 476],
    [189, 470],
    [217, 122],
    [188, 205],
    [302, 220],
    [261, 459],
    [119, 461],
    [183, 256],
    [257, 351],
    [167, 356],
    [219, 222],
    [66, 402]
  ),
  frame(
    [393, 90, 711, 478],
    [584, 470],
    [624, 127],
    [576, 207],
    [701, 219],
    [643, 441],
    [489, 461],
    [580, 267],
    [673, 329],
    [548, 376],
    [614, 231],
    [425, 386]
  ),
  frame(
    [809, 83, 1093, 478],
    [981, 470],
    [991, 119],
    [960, 194],
    [883, 126],
    [1055, 460],
    [904, 457],
    [961, 244],
    [1046, 346],
    [977, 358],
    [959, 169],
    [836, 399]
  ),
  frame(
    [1186, 54, 1485, 478],
    [1362, 470],
    [1394, 124],
    [1351, 196],
    [1340, 67],
    [1441, 462],
    [1263, 460],
    [1335, 242],
    [1431, 347],
    [1328, 369],
    [1378, 158],
    [1211, 399]
  ),
  frame(
    [13, 606, 334, 989],
    [165, 978],
    [243, 642],
    [191, 709],
    [322, 765],
    [250, 965],
    [84, 968],
    [174, 769],
    [263, 859],
    [149, 887],
    [234, 725],
    [39, 876]
  ),
  frame(
    [371, 640, 798, 988],
    [568, 978],
    [656, 681],
    [604, 746],
    [787, 749],
    [714, 968],
    [402, 966],
    [595, 812],
    [711, 849],
    [502, 908],
    [708, 749],
    [419, 843]
  ),
  frame(
    [817, 612, 1156, 989],
    [993, 978],
    [1041, 651],
    [1009, 725],
    [1144, 793],
    [1087, 969],
    [901, 967],
    [995, 790],
    [1091, 869],
    [979, 906],
    [1063, 756],
    [844, 895]
  ),
  frame(
    [1206, 633, 1505, 991],
    [1391, 979],
    [1308, 675],
    [1333, 745],
    [1430, 738],
    [1455, 970],
    [1329, 967],
    [1374, 808],
    [1472, 866],
    [1398, 888],
    [1361, 757],
    [1238, 943]
  ),
] as const;

export const WARDEN = [
  frame(
    [76, 19, 376, 436],
    [224, 429],
    [200, 62],
    [219, 142],
    [144, 144],
    [115, 416],
    [350, 418],
    [234, 214],
    [151, 294],
    [289, 318],
    [247, 168],
    [335, 284]
  ),
  frame(
    [498, 21, 848, 435],
    [668, 429],
    [635, 64],
    [655, 144],
    [571, 140],
    [525, 407],
    [812, 408],
    [667, 215],
    [587, 294],
    [742, 325],
    [697, 171],
    [788, 282]
  ),
  frame(
    [958, 23, 1264, 435],
    [1110, 429],
    [1084, 66],
    [1116, 147],
    [1036, 145],
    [996, 417],
    [1232, 399],
    [1136, 211],
    [1041, 291],
    [1168, 337],
    [1050, 170],
    [1240, 283]
  ),
  frame(
    [1344, 38, 1762, 435],
    [1561, 429],
    [1517, 83],
    [1566, 146],
    [1378, 120],
    [1452, 417],
    [1722, 401],
    [1589, 220],
    [1474, 288],
    [1647, 320],
    [1448, 118],
    [1682, 301]
  ),
  frame(
    [85, 456, 387, 872],
    [231, 860],
    [213, 504],
    [234, 576],
    [146, 610],
    [124, 848],
    [355, 850],
    [236, 651],
    [154, 733],
    [291, 766],
    [183, 607],
    [327, 719]
  ),
  frame(
    [503, 456, 821, 878],
    [645, 866],
    [661, 501],
    [676, 574],
    [567, 610],
    [544, 850],
    [731, 860],
    [662, 644],
    [574, 737],
    [651, 756],
    [616, 603],
    [747, 709]
  ),
  frame(
    [937, 467, 1293, 882],
    [1069, 870],
    [1176, 511],
    [1137, 577],
    [998, 576],
    [1002, 842],
    [1160, 860],
    [1100, 624],
    [971, 752],
    [1075, 755],
    [1030, 583],
    [1170, 695]
  ),
  frame(
    [1355, 568, 1761, 876],
    [1536, 864],
    [1430, 626],
    [1490, 664],
    [1398, 826],
    [1491, 855],
    [1723, 851],
    [1591, 701],
    [1504, 743],
    [1594, 832],
    [1430, 726],
    [1662, 779]
  ),
] as const;

export function wardenSurface(
  pose: Pose,
  x: number,
  y: number,
  aim: number
): Point {
  const head = pin(WARDEN, pose, 0, WARDEN_SCALE),
    chest = pin(WARDEN, pose, 1, WARDEN_SCALE);
  return {
    x: x + chest.x - 33 + (aim < 0 ? (head.x - chest.x) * -aim : -7 * aim),
    y: y + chest.y + (aim < 0 ? (chest.y - head.y - 4) * aim : 72 * aim),
  };
}

export interface Blade {
  grip: Point;
  angle: number;
  bend: number;
  contactU?: number;
  touching?: boolean;
}

/** Project the steel along the line between the guard and the moving armor surface. */
export function plantBlade(
  grip: Point,
  contact: Point,
  deflection: number
): Blade {
  const dx = contact.x - grip.x,
    dy = contact.y - grip.y,
    span = Math.hypot(dx, dy);
  const bend = clamp(deflection, -span * 0.32, span * 0.32);
  // A close blow meets the middle of the edge. Preserve the full length past that point.
  let u = clamp(span / BLADE_LENGTH, 0, 1);
  for (let i = 0; i < 5; i++) {
    const cross = bend * u * u * (1.5 - 0.5 * u);
    u = clamp(
      Math.sqrt(Math.max(0, span * span - cross * cross)) / BLADE_LENGTH,
      0,
      1
    );
  }
  const cross = bend * u * u * (1.5 - 0.5 * u);
  return {
    grip,
    bend,
    contactU: u,
    angle: Math.atan2(dy, dx) - Math.atan2(cross, BLADE_LENGTH * u),
    touching: true,
  };
}

export function onBlade(blade: Blade, u: number): Point {
  const c = Math.cos(blade.angle),
    s = Math.sin(blade.angle);
  const along = BLADE_LENGTH * u;
  // A clamped cantilever is straight at the hilt. Its free end lags under acceleration.
  const across = blade.bend * u * u * (1.5 - 0.5 * u);
  return {
    x: blade.grip.x + along * c - across * s,
    y: blade.grip.y + along * s + across * c,
  };
}

export function intersectsPlate(blade: Blade, target: Point): Point | null {
  // Intersect the drawn polyline with the local plate ellipse, including between samples.
  const rx = 19,
    ry = 22;
  let prev = onBlade(blade, 0.04);
  for (let i = 2; i <= BLADE_STEPS; i++) {
    const next = onBlade(blade, i / BLADE_STEPS);
    const x0 = (prev.x - target.x) / rx,
      y0 = (prev.y - target.y) / ry;
    const dx = (next.x - prev.x) / rx,
      dy = (next.y - prev.y) / ry;
    const a = dx * dx + dy * dy,
      b = 2 * (x0 * dx + y0 * dy),
      c = x0 * x0 + y0 * y0 - 1;
    if (c <= 0) return prev;
    const disc = b * b - 4 * a * c;
    if (disc >= 0 && a > 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t <= 1)
        return { x: mix(prev.x, next.x, t), y: mix(prev.y, next.y, t) };
    }
    prev = next;
  }
  return null;
}

export class FlexibleBlade {
  angle = -48 * RAD;
  speed = 0;
  bend = 0;
  velocity = 0;

  trackStraight(angle: number, dt: number): void {
    this.speed = dt > 0 ? (angle - this.angle) / dt : 0;
    this.angle = angle;
    this.bend = this.velocity = 0;
  }

  step(angle: number, dt: number, power: number, drive = true): void {
    if (dt <= 0) return;
    const speed = (angle - this.angle) / dt;
    const acceleration = clamp((speed - this.speed) / dt, -420, 420);
    // Angular acceleration sets the load. Stiffness and damping return the steel to rest.
    const load = drive
      ? clamp(-acceleration * (0.055 + 0.035 * power), -13, 13)
      : 0;
    this.velocity += ((load - this.bend) * 1400 - this.velocity * 43) * dt;
    this.bend = clamp(this.bend + this.velocity * dt, -35, 35);
    this.speed = speed;
    this.angle = angle;
  }

  reset(angle = -48 * RAD): void {
    this.angle = angle;
    this.speed = this.bend = this.velocity = 0;
  }
}

export const SWING_POSES: readonly Key[] = [
  [0, 0],
  [0.13, 0],
  [0.35, 4],
  [0.52, 5],
  [0.61, 5],
  [0.78, 6],
  [1, 0],
];
export const CHARGED_POSES: readonly Key[] = [
  [0, 3],
  [0.09, 3],
  [0.36, 4],
  [0.5, 5],
  [0.58, 5],
  [0.76, 6],
  [1, 0],
];
export const BASH_POSES: readonly Key[] = [
  [0, 0],
  [0.32, 2],
  [0.49, 2],
  [0.62, 3],
  [0.73, 3],
  [1, 0],
];
export const STAGGER_POSES: readonly Key[] = [
  [0, 4],
  [0.13, 5],
  [0.38, 6],
  [0.59, 6],
  [0.8, 5],
  [1, 0],
];
