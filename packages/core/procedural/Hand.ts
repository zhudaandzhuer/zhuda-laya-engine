/**
 * A human hand from numbers: a skeleton with adult proportions, a pose given
 * as joint angles, soft parts round each bone joined by fillets, and nails.
 *
 * Built on `Isosurface.ts`. Pure data: the result is `MeshData` for the skin
 * and for the nails, and where each joint ended up. Nothing here touches Laya
 * or comes from a file.
 *
 * The hand's own frame (a right hand; a left one is its mirror in x): the
 * middle of the wrist's crease at the origin, the fingers along +y, the back
 * of the hand toward +z, the thumb toward -x. Metres.
 *
 * The proportions are an adult's of middle size (hand length 0.185, breadth
 * across the knuckles 0.082), the bones' lengths in the ratios anatomy
 * tables give; `length` and `breadth` scale them.
 */
import type { MeshData } from '../runtime3d/Surfaces.ts';
import type { ZhudaLitSurfaceSpec } from '../shaders/LitSurfaceMaterial.ts';
import type { ZhudaVec3 } from './Geometry.ts';
import {
  createZhudaIsosurfaceMesh,
  createZhudaSdfField,
  createZhudaSdfUnion,
  joinZhudaSdfFields,
  splitZhudaMesh,
  zhudaSdfDepthAlong,
  zhudaSmoothMin,
  type ZhudaSdfField,
  type ZhudaSdfShape,
} from './Isosurface.ts';

export type ZhudaHandFinger = 'index' | 'middle' | 'ring' | 'little';
export type ZhudaHandDigit = 'thumb' | ZhudaHandFinger;
export const ZHUDA_HAND_FINGERS: readonly ZhudaHandFinger[] = ['index', 'middle', 'ring', 'little'];
export const ZHUDA_HAND_DIGITS: readonly ZhudaHandDigit[] = ['thumb', ...ZHUDA_HAND_FINGERS];

/** Joint angles in degrees. A finger's are its knuckle, middle and end joints; the thumb's its base, knuckle and end joints. */
export interface ZhudaHandPose {
  /** Bend at each joint toward the palm, degrees: [knuckle, middle, end]. */
  index?: [number, number, number];
  middle?: [number, number, number];
  ring?: [number, number, number];
  little?: [number, number, number];
  /** Bend at [base, knuckle, end]; the base turns the thumb across the palm. */
  thumb?: [number, number, number];
  /** How far the fingers fan out, degrees between neighbours on average (default 6). */
  spread?: number;
  /** How far the thumb stands out from the palm, degrees (default 40). */
  thumbOut?: number;
}

/** A hand at rest: the fingers bend more toward the little one, as a hand left alone does. */
export const ZHUDA_HAND_RELAXED: Readonly<Required<ZhudaHandPose>> = {
  index: [12, 20, 10],
  middle: [16, 26, 12],
  ring: [20, 32, 14],
  little: [24, 38, 16],
  thumb: [8, 12, 16],
  spread: 4,
  thumbOut: 38,
};
/** A hand held up gracefully: the fingers a little bent and apart, more toward the little one. */
export const ZHUDA_HAND_GRACEFUL: Readonly<Required<ZhudaHandPose>> = {
  index: [6, 10, 6],
  middle: [10, 16, 8],
  ring: [16, 24, 10],
  little: [24, 30, 12],
  thumb: [4, 8, 12],
  spread: 7,
  thumbOut: 34,
};
/** A hand laid flat with the fingers a little apart. */
export const ZHUDA_HAND_FLAT: Readonly<Required<ZhudaHandPose>> = {
  index: [0, 4, 2],
  middle: [0, 4, 2],
  ring: [0, 4, 2],
  little: [0, 4, 2],
  thumb: [0, 4, 6],
  spread: 6,
  thumbOut: 44,
};

export interface ZhudaHandOptions {
  side?: 'right' | 'left';
  /** From the wrist's crease to the end of the middle finger, metres (default 0.185; 0.12 to 0.25). */
  length?: number;
  /** Across the knuckles, metres (default 0.082; 0.06 to 0.11). */
  breadth?: number;
  /** Joint angles; any left out are the relaxed pose's. */
  pose?: ZhudaHandPose;
  /** The skin's colour as a display colour (default a light skin, 0.86, 0.66, 0.56). */
  tone?: [number, number, number];
  /** The skin mesh's cell, metres (default 0.0009; 0.0006 to 0.004). */
  cellSize?: number;
  /** How far the forearm runs below the wrist's crease, metres (default 0.05; 0.01 to 0.2). */
  forearm?: number;
  /** The build of the hand beyond its size: slender or strong, nails, veins. */
  build?: ZhudaHandBuild;
}

/** What makes one adult's hand differ from another's beyond its length and breadth. Every value has a neutral default. */
export interface ZhudaHandBuild {
  /** The fingers' thickness, a share of the default (0.8 to 1.2; default 1). */
  fingerWidth?: number;
  /** The tip's radius as a share of the default; the joints between follow (0.75 to 1.1; default 1). */
  taper?: number;
  /** The fingers' length against the palm's; `length` is kept (0.9 to 1.2; default 1). */
  fingerLength?: number;
  /** How much bone shows: the joints' waist and knuckles, the knuckles and tendons on the back (0 to 1.5; default 1). */
  bone?: number;
  /** The flesh of the palm: the ball of the thumb, the heel and the pads (0.85 to 1.15; default 1). */
  flesh?: number;
  /** How far the nails run past the end of the finger, metres (0 to 0.006; default 0.0008). */
  nailFree?: number;
  /** The nails' free edge: 0 square, 0.5 round, 1 almond (narrowing to a soft point) (default 0.5). */
  nailRound?: number;
  /** The nails' colour over the bed, a display colour (default 0.9, 0.66, 0.64). */
  nailTone?: [number, number, number];
  /** How much the veins on the back of the hand show through, as a tint (0 to 1; default 0.3). */
  veins?: number;
  /** How much the tendons on the back of the hand stand out (0 to 1.5; default `bone`). */
  tendons?: number;
  /** How pink the knuckles, the fingertips and the palm's pads are (0 to 1.5; default 0.6). */
  flush?: number;
}

/** A man's hand, fine rather than rough: long, broad, with clean joints, short square-round nails. */
export const ZHUDA_HAND_MALE: Readonly<ZhudaHandOptions> = {
  length: 0.192,
  breadth: 0.087,
  tone: [0.86, 0.68, 0.57],
  build: {
    fingerWidth: 1.04,
    taper: 0.9,
    fingerLength: 1.02,
    bone: 0.9,
    flesh: 1,
    nailFree: 0.0005,
    nailRound: 0.35,
    nailTone: [0.9, 0.63, 0.6],
    veins: 0.3,
  },
};
/** A woman's hand with fair skin: slender, long straight fingers that taper, long almond nails, pink at the knuckles and tips. */
export const ZHUDA_HAND_FEMALE: Readonly<ZhudaHandOptions> = {
  length: 0.172,
  breadth: 0.071,
  tone: [0.96, 0.84, 0.78],
  build: {
    fingerWidth: 0.96,
    taper: 0.88,
    fingerLength: 1.2,
    bone: 0.15,
    flesh: 0.93,
    nailFree: 0.0058,
    nailRound: 0.92,
    nailTone: [0.95, 0.68, 0.68],
    veins: 0.6,
    tendons: 1.0,
    flush: 1.15,
  },
};

export interface ZhudaHandJoint {
  digit: ZhudaHandDigit;
  /** 0 the bone's base (the finger's knuckle, the thumb's base), up to 3 the end of the last bone. */
  index: number;
  position: ZhudaVec3;
}

export interface ZhudaHandMesh {
  /**
   * The skin, in chunks of at most 65535 vertices (one `ZhudaDynamicMesh` each). Its colour a vertex carries the tint as a display colour (a
   * lit surface reads it as light in `s.vertexColor.rgb`) and, in alpha, how
   * thin the hand is there (1 a sheet of nothing, about 0.4 through a finger,
   * 0.25 through the palm): read it into `s.thickness` for light from behind.
   */
  skin: MeshData[];
  /** The five nails, one mesh; their colour a vertex is the nail's tint (whiter at the free edge) and 1. */
  nails: MeshData;
  joints: ZhudaHandJoint[];
  /** Where the tip of each digit is (the end of its flesh, not of its bone). */
  tips: Record<ZhudaHandDigit, ZhudaVec3>;
  side: 'right' | 'left';
}

const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
type V = ZhudaVec3;
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V): V => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const mix = (a: V, b: V, t: number): V => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Turns `v` about the unit `axis` by `angle` radians (Rodrigues). */
const turn = (v: V, axis: V, angle: number): V => {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c)));
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** What is wrong with the options; empty when a hand can be made. */
export function validateZhudaHand(options: ZhudaHandOptions = {}): string[] {
  const errors: string[] = [];
  if (!options || typeof options !== 'object') return ['options must be an object'];
  const range = (value: unknown, label: string, lo: number, hi: number) => {
    if (
      value !== undefined &&
      !(finite(value) && (value as number) >= lo && (value as number) <= hi)
    )
      errors.push(`${label} must be a number from ${lo} to ${hi}`);
  };
  if (options.side !== undefined && options.side !== 'right' && options.side !== 'left')
    errors.push("side must be 'right' or 'left'");
  range(options.length, 'length', 0.12, 0.25);
  range(options.breadth, 'breadth', 0.06, 0.11);
  range(options.cellSize, 'cellSize', 0.0006, 0.004);
  range(options.forearm, 'forearm', 0.01, 0.2);
  if (options.tone !== undefined) {
    const t = options.tone;
    if (!Array.isArray(t) || t.length !== 3 || !t.every((v) => finite(v) && v >= 0 && v <= 1))
      errors.push('tone must be three numbers from 0 to 1');
  }
  const build = options.build;
  if (build !== undefined) {
    if (!build || typeof build !== 'object') errors.push('build must be an object');
    else {
      range(build.fingerWidth, 'build.fingerWidth', 0.8, 1.2);
      range(build.taper, 'build.taper', 0.75, 1.1);
      range(build.fingerLength, 'build.fingerLength', 0.9, 1.2);
      range(build.tendons, 'build.tendons', 0, 1.5);
      range(build.flush, 'build.flush', 0, 1.5);
      range(build.bone, 'build.bone', 0, 1.5);
      range(build.flesh, 'build.flesh', 0.85, 1.15);
      range(build.nailFree, 'build.nailFree', 0, 0.006);
      range(build.nailRound, 'build.nailRound', 0, 1);
      range(build.veins, 'build.veins', 0, 1);
      const t = build.nailTone;
      if (
        t !== undefined &&
        (!Array.isArray(t) || t.length !== 3 || !t.every((v) => finite(v) && v >= 0 && v <= 1))
      )
        errors.push('build.nailTone must be three numbers from 0 to 1');
    }
  }
  const pose = options.pose;
  if (pose !== undefined) {
    if (!pose || typeof pose !== 'object') errors.push('pose must be an object');
    else {
      for (const digit of ZHUDA_HAND_DIGITS) {
        const a = pose[digit];
        if (a === undefined) continue;
        if (!Array.isArray(a) || a.length !== 3 || !a.every(finite))
          errors.push(`pose.${digit} must be three angles in degrees`);
        else {
          const [lo, hi] = digit === 'thumb' ? [-20, 60] : [-25, 95];
          a.forEach((v, i) => {
            const top = i === 0 && digit !== 'thumb' ? 90 : i === 1 && digit !== 'thumb' ? 110 : hi;
            const bottom = i === 0 ? lo : -10;
            if (v < bottom || v > top)
              errors.push(`pose.${digit}[${i}] must be from ${bottom} to ${top} degrees`);
          });
        }
      }
      range(pose.spread, 'pose.spread', -2, 20);
      range(pose.thumbOut, 'pose.thumbOut', 0, 80);
    }
  }
  return errors;
}

/** The base proportions, at length 0.185 and breadth 0.082: positions of the knuckles, bone lengths and radii. */
const FINGER: Record<
  ZhudaHandFinger,
  {
    knuckle: V;
    /** Where the bone of the palm starts. */
    base: V;
    bones: [number, number, number];
    /** Radius of the flesh at the knuckle, the middle joint, the end joint and the tip. */
    radii: [number, number, number, number];
    /** The finger's own share of the fan, as a part of `spread` (negative toward the thumb). */
    fan: number;
    /** A finger's own turn about its length (degrees): the outer fingers face a little toward the middle. */
    roll: number;
  }
> = {
  index: {
    knuckle: [-0.0275, 0.0935, 0.002],
    base: [-0.012, 0.03, 0.006],
    bones: [0.0405, 0.0235, 0.0115],
    radii: [0.0089, 0.0079, 0.0068, 0.0058],
    fan: -1.0,
    roll: -6,
  },
  middle: {
    knuckle: [-0.007, 0.0965, 0.0035],
    base: [-0.002, 0.03, 0.007],
    bones: [0.0445, 0.0275, 0.0122],
    radii: [0.0092, 0.0082, 0.007, 0.006],
    fan: 0,
    roll: 0,
  },
  ring: {
    knuckle: [0.0125, 0.0915, 0.002],
    base: [0.009, 0.03, 0.006],
    bones: [0.0415, 0.0265, 0.0118],
    radii: [0.0086, 0.0077, 0.0066, 0.0056],
    fan: 0.9,
    roll: 5,
  },
  little: {
    knuckle: [0.03, 0.0845, -0.0015],
    base: [0.019, 0.032, 0.004],
    bones: [0.0355, 0.021, 0.011],
    radii: [0.0075, 0.0067, 0.0059, 0.0051],
    fan: 2.2,
    roll: 12,
  },
};
const THUMB = {
  /** The joint at the wrist the thumb turns on. */
  base: [-0.0185, 0.022, -0.006] as V,
  bones: [0.0445, 0.031, 0.0185] as [number, number, number],
  radii: [0.0125, 0.0099, 0.0094, 0.0076] as [number, number, number, number],
};

type Segment = { a: V; b: V; ra: number; rb: number; dorsal: V; lateral: V; dir: V };
type Resolved = Required<Omit<ZhudaHandOptions, 'build'>> & { build: Required<ZhudaHandBuild> };
const NEUTRAL_BUILD: Required<ZhudaHandBuild> = {
  fingerWidth: 1,
  taper: 1,
  fingerLength: 1,
  bone: 1,
  flesh: 1,
  nailFree: 0.0008,
  nailRound: 0.5,
  nailTone: [0.92, 0.64, 0.62],
  veins: 0.3,
  tendons: -1,
  flush: 0.6,
};
/** The palm's scale along the hand: the middle knuckle at 0.0965 and the finger past it at 0.0885 share `length`. */
const palmScale = (o: Pick<Resolved, 'length' | 'build'>) =>
  o.length / (0.0965 + 0.0885 * o.build.fingerLength);
type Digit = {
  name: ZhudaHandDigit;
  joints: V[];
  radii: number[];
  segments: Segment[];
};

function poseDigits(options: Resolved, pose: Required<ZhudaHandPose>): Digit[] {
  const sx = options.breadth / 0.082,
    sy = palmScale(options);
  const b = options.build;
  // The fingers' bones longer or shorter than the palm's; the thumb half as much.
  const fy = sy * b.fingerLength,
    ty = sy * (1 + (b.fingerLength - 1) * 0.5);
  /** A digit's radius at joint i of 0..3: wider or narrower, and narrowing toward the tip. */
  const width = (r: number, i: number, thumb = false) =>
    // 1.06: the width the joined cones' fillets used to add, now that they add none.
    r * 1.06 * sx * b.fingerWidth * (thumb ? Math.sqrt(b.taper) : b.taper) ** (i / 3);
  const S = (p: V): V => [p[0] * sx, p[1] * sy, p[2] * sx];
  const digits: Digit[] = [];
  for (const name of ZHUDA_HAND_FINGERS) {
    const f = FINGER[name];
    const knuckle = S(f.knuckle);
    // The finger leaves the knuckle along the line of its palm bone, fanned out about the back's normal.
    let dir = unit(sub(knuckle, S(f.base)));
    let dorsal: V = unit(sub([0, 0, 1], mul(dir, dir[2])));
    dir = turn(dir, dorsal, -rad(f.fan * pose.spread) + rad(name === 'middle' ? 0 : 0));
    dorsal = turn(dorsal, dir, rad(f.roll));
    const angles = pose[name];
    const joints: V[] = [knuckle];
    const segments: Segment[] = [];
    const radii = f.radii.map((r, i) => width(r, i));
    let at = knuckle;
    for (let i = 0; i < 3; i++) {
      // Bend toward the palm about the finger's side axis.
      const lateral = unit(cross(dir, dorsal));
      const bend = rad(angles[i]);
      dir = turn(dir, lateral, -bend);
      dorsal = turn(dorsal, lateral, -bend);
      const length = f.bones[i] * fy;
      const next = add(at, mul(dir, length));
      segments.push({ a: at, b: next, ra: radii[i], rb: radii[i + 1], dorsal, lateral, dir });
      joints.push(next);
      at = next;
    }
    digits.push({ name, joints, radii, segments });
  }
  // The thumb: out from the palm by thumbOut, turned across it by its base angle.
  {
    const base = S(THUMB.base);
    const radii = THUMB.radii.map((r, i) => (i === 0 ? r * sx : width(r, i, true)));
    // At thumbOut 0 the thumb lies along the side of the index's palm bone. It swings out
    // toward -x in the palm's plane and, less, forward of the palm.
    let dir = unit([-0.22, 1, -0.12]);
    // The thumb's nail faces about 65 degrees round from the fingers' nails, toward -x.
    let palmar: V = [Math.sin(rad(65)), 0, -Math.cos(rad(65))];
    const radial = rad(pose.thumbOut * 0.8),
      forward = rad(pose.thumbOut * 0.45);
    dir = turn(turn(dir, [0, 0, 1], radial), [1, 0, 0], -forward);
    palmar = turn(turn(palmar, [0, 0, 1], radial), [1, 0, 0], -forward);
    const dorsal0 = mul(palmar, -1);
    let dorsal = unit(sub(dorsal0, mul(dir, dot(dorsal0, dir))));
    const joints: V[] = [base];
    const segments: Segment[] = [];
    let at = base;
    for (let i = 0; i < 3; i++) {
      const lateral = unit(cross(dir, dorsal));
      const bend = rad(pose.thumb[i]);
      dir = turn(dir, lateral, -bend);
      dorsal = turn(dorsal, lateral, -bend);
      const next = add(at, mul(dir, THUMB.bones[i] * ty));
      segments.push({ a: at, b: next, ra: radii[i], rb: radii[i + 1], dorsal, lateral, dir });
      joints.push(next);
      at = next;
    }
    digits.unshift({ name: 'thumb', joints, radii, segments });
  }
  return digits;
}

/**
 * The flesh of one digit: along each bone two cones that meet a little
 * narrower in the bone's middle (how much, by `bone`), a low knob of bone on
 * the back of the middle joint, and a pad on the palm side of each bone.
 */
function digitShapes(d: Digit, bone: number): ZhudaSdfShape[] {
  const shapes: ZhudaSdfShape[] = [];
  const thumb = d.name === 'thumb';
  d.segments.forEach((s, i) => {
    const length = Math.hypot(...sub(s.b, s.a));
    const last = i === 2;
    // A digit is wider than it is deep; the end bone flattest, under the nail.
    const squash = thumb ? (last ? 0.8 : 0.84) : last ? 0.84 : 0.9;
    const flatten = { axis: s.dorsal, factor: squash };
    const waist = last ? 1 : 1 - 0.035 * bone;
    const middle = add(s.a, mul(s.dir, length * 0.5));
    const rm = ((s.ra + s.rb) / 2) * waist;
    // Two cones in a line need no fillet (a smooth union bulges where they meet, and the
    // finger looks beaded); across a joint a small one.
    shapes.push(
      { kind: 'roundCone', a: s.a, b: middle, ra: s.ra, rb: rm, blend: 0.001, flatten },
      { kind: 'roundCone', a: middle, b: s.b, ra: rm, rb: s.rb, blend: 0, flatten },
    );
    // The knob of bone on the back of the middle joint (a finger's) or the knuckle (the thumb's).
    if (bone > 0.5 && i === 0)
      shapes.push({
        kind: 'ellipsoid',
        center: add(s.b, mul(s.dorsal, s.rb * squash * (0.42 + 0.1 * bone))),
        radii: [s.rb * 0.45, s.rb * 0.62, s.rb * 0.4],
        axes: [s.lateral, s.dir, s.dorsal],
        blend: 0.0035,
      });
    // The pad of flesh on the palm side of the bone.
    const padAt = last ? 0.62 : 0.5;
    const r = s.ra + (s.rb - s.ra) * padAt;
    shapes.push({
      kind: 'ellipsoid',
      center: add(add(s.a, mul(s.dir, length * padAt)), mul(s.dorsal, -r * (last ? 0.3 : 0.36))),
      radii: [r * (last ? 0.78 : 0.62), length * (last ? 0.6 : 0.5), r * (last ? 0.7 : 0.6)],
      axes: [s.lateral, s.dir, s.dorsal],
      blend: last ? 0.004 : 0.005,
    });
  });
  return shapes;
}

/** The palm, the wrist and the forearm. */
function palmShapes(digits: Digit[], options: Resolved): ZhudaSdfShape[] {
  const sx = options.breadth / 0.082,
    sy = palmScale(options);
  const S = (p: V): V => [p[0] * sx, p[1] * sy, p[2] * sx];
  const { flesh, bone } = options.build;
  const shapes: ZhudaSdfShape[] = [];
  // Forearm into the wrist: an oval, wider than deep.
  shapes.push({
    kind: 'roundCone',
    a: S([0.001, -options.forearm / sy, 0.001]),
    // The wrist's end only a little toward the palm: further, it filled the valley between
    // the two balls of the hand and left a straight step across the heel.
    b: S([0.0, 0.004, -0.0008]),
    // A slender build has a slimmer wrist.
    ra: 0.0285 * sx * (0.9 + 0.1 * Math.min(bone, 1)),
    // Less at the wrist's end: the heel of the hand would stand over it as a ledge.
    rb: 0.0265 * sx * (0.96 + 0.04 * Math.min(bone, 1)),
    // Deeper than it was (0.66): the heel of the hand stood over a thin wrist as a ledge.
    flatten: { axis: [0, 0, 1], factor: 0.73 },
  });
  // The wrist's bones, a flat block.
  shapes.push({
    kind: 'ellipsoid',
    // Narrower than the hand above it: wider, it made the little finger's edge bulge at the
    // wrist and pinch in above.
    center: S([0.002, 0.02, 0.0025]),
    radii: [0.0255 * sx, 0.024 * sy, 0.0135 * sx],
    blend: 0.012,
  });
  // The palm's bones with their flesh: a ray from the wrist to each knuckle, joined into a plate.
  for (const name of ZHUDA_HAND_FINGERS) {
    const f = FINGER[name];
    const digit = digits.find((d) => d.name === name)!;
    const knuckle = digit.joints[0];
    shapes.push({
      kind: 'roundCone',
      a: S(f.base),
      b: knuckle,
      ra: 0.0105 * sx,
      rb: digit.radii[0] * 1.02,
      blend: 0.011,
      flatten: { axis: [0, 0, 1], factor: 0.8 },
    });
  }
  // The heads of the palm's bones, seen on the back as knuckles.
  for (const name of ZHUDA_HAND_FINGERS) {
    const d = digits.find((x) => x.name === name)!;
    const head = sub(d.joints[0], mul(d.segments[0].dir, 0.004 * sy));
    shapes.push({
      kind: 'ellipsoid',
      center: add(head, [0, 0, 0.0035 * sx * (0.75 + 0.25 * bone)]),
      radii: [d.radii[0] * 0.78, 0.008 * sy, 0.0055 * sx * (0.8 + 0.2 * bone)],
      axes: [d.segments[0].lateral, d.segments[0].dir, d.segments[0].dorsal],
      blend: 0.007,
    });
  }
  // The little finger's edge of the hand, one smooth line from the wrist to the knuckle:
  // the heel and the palm's bone pushed it out in two plateaus.
  {
    const little = digits.find((d) => d.name === 'little')!;
    shapes.push({
      kind: 'roundCone',
      a: S([0.0172, 0.006, -0.0015]),
      // Ending short of the knuckle: over it, it stood on the back as a bump.
      b: sub(little.joints[0], mul(little.segments[0].dir, 0.013 * sy)),
      ra: 0.0094 * sx,
      rb: little.radii[0] * 0.92,
      blend: 0.012,
      flatten: { axis: [0, 0, 1], factor: 0.74 },
    });
  }
  // The heel as one broad rise: an ellipse through the palm's side about 21.5 mm out at
  // 12 mm above the wrist, 19 at 24 and 15 at 40, so the palm turns down onto the heel
  // gradually. (The heel's pads all ended along one line, and the light caught the bend.)
  shapes.push({
    kind: 'ellipsoid',
    center: S([0.004, 0.004, 0.0058]),
    radii: [0.024 * sx, 0.05 * sy, 0.0222 * sx * flesh],
    // Only its palm side: set this deep, its back would stand out of the back of the hand.
    keep: { normal: [0, 0, 1], offset: 0.004 * sx },
    blend: 0.012,
  });
  // The flesh of the palm between its balls: without it the middle of the palm was 14 mm
  // thinner than the heel, a pit rather than a cup.
  shapes.push({
    kind: 'ellipsoid',
    // Down to the heel, so the palm runs onto it in a slope rather than a step.
    // Deep in the hand and wide, so its face is a broad gentle curve: a thin wide one was
    // flat across the middle and put all the curving into one line above the heel.
    center: S([0.003, 0.052, 0.0128]),
    radii: [0.03 * sx, 0.046 * sy, 0.0222 * sx * flesh],
    keep: { normal: [0, 0, 1], offset: 0.0 },
    blend: 0.014,
  });
  // The pad under the knuckles, along their curve.
  shapes.push({
    kind: 'ellipsoid',
    center: S([0.001, 0.081, -0.0066]),
    radii: [0.032 * sx, 0.015 * sy, 0.0052 * sx * flesh],
    axes: [unit([1, -0.2, 0]), unit([0.2, 1, 0]), [0, 0, 1]],
    blend: 0.014,
  });
  // The ball of the thumb and the heel of the hand on the little finger's side.
  shapes.push({
    kind: 'ellipsoid',
    // Out far enough that the thumb's side of the hand bulges from the wrist to the thumb
    // (it ran as a straight line, and the thumb seemed stuck on).
    // Its inner edge stops at the life line, as the ball of the thumb's does: past it, it
    // filled the valley between the two balls of the hand.
    center: S([-0.0228, 0.032, -0.0112]),
    radii: [0.0172 * sx * flesh, 0.031 * sy, 0.0138 * sx * flesh],
    axes: [unit([0.92, 0.39, 0]), unit([-0.39, 0.92, 0]), [0, 0, 1]],
    blend: 0.012,
  });
  shapes.push({
    kind: 'ellipsoid',
    // Placed so the little finger's edge widens steadily from the wrist to the knuckle.
    // Inside the line of the edge below (it pushed past it as a plateau).
    // A rounded pad standing toward the palm side (outward it pushed the edge past its line).
    // Down to the wrist: the heel on this side is this pad, not a bar across the palm.
    center: S([0.0168, 0.032, -0.0086]),
    radii: [0.0098 * sx * flesh, 0.034 * sy, 0.0112 * sx * flesh],
    axes: [unit([1, 0.12, 0]), unit([-0.12, 1, 0]), [0, 0, 1]],
    blend: 0.012,
  });
  // No hollow cut into the palm: the middle pad sits lower than the pads round it, and that
  // is the cup. A cut deep enough to show also reached the heel's pads, which stand further
  // out, and its fillet carved a line across the palm above the heel.
  return shapes;
}

/** The web of skin between the thumb and the index finger. */
function webShapes(digits: Digit[], sx: number): ZhudaSdfShape[] {
  const thumb = digits[0],
    index = digits[1];
  // The muscle between the thumb's palm bone and the index's: a flat mass on the back, a web
  // of skin at its free edge.
  const t0 = mix(thumb.joints[0], thumb.joints[1], 0.35);
  const t1 = mix(thumb.joints[0], thumb.joints[1], 0.85);
  const i1 = mix(index.joints[0], index.joints[1], 0.06);
  const i0 = add(i1, [0.004 * sx, -0.03 * sx, 0]);
  const middle = mix(mix(t0, t1, 0.5), mix(i0, i1, 0.5), 0.5);
  const across = unit(sub(mix(i0, i1, 0.5), mix(t0, t1, 0.5)));
  const along = unit(sub(mix(t1, i1, 0.5), mix(t0, i0, 0.5)));
  const normal = unit(cross(across, along));
  const out = unit(sub(along, mul(across, dot(along, across))));
  return [
    {
      kind: 'ellipsoid',
      center: middle,
      radii: [
        Math.hypot(...sub(mix(i0, i1, 0.5), mix(t0, t1, 0.5))) * 0.5,
        Math.hypot(...sub(mix(t1, i1, 0.5), mix(t0, i0, 0.5))) * 0.55,
        0.0075 * sx,
      ],
      axes: [across, out, unit(cross(across, out))],
      blend: 0.01,
    },
    {
      kind: 'roundCone',
      a: t1,
      b: i1,
      ra: 0.0055 * sx,
      rb: 0.006 * sx,
      blend: 0.008,
      flatten: { axis: normal, factor: 0.6 },
    },
  ];
}

/** Where the skin's surface is, going out from a point along a direction (for seating a nail). */
function surfaceAlong(field: ZhudaSdfField, from: V, dir: V, reach: number): number {
  let lo = 0,
    hi = reach;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (field.distance(...add(from, mul(dir, mid))) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * A nail on the end bone of a digit, seated a little into the skin: a curved
 * plate, round at the cuticle, square or oval at its free edge, running
 * `nailFree` past where the flesh under it ends.
 */
function nailField(field: ZhudaSdfField, d: Digit, b: Required<ZhudaHandBuild>) {
  const s = d.segments[2];
  const L = Math.hypot(...sub(s.b, s.a));
  const r = s.rb;
  const thumb = d.name === 'thumb';
  // How far the flesh runs past the end of the bone, along it.
  const reach = surfaceAlong(field, s.b, s.dir, r * 3);
  const u0 = L * (thumb ? 0.2 : 0.1);
  // Where the nail leaves the flesh: the tip curves down under it before the flesh ends.
  const uFlesh = L + reach * 0.72;
  const u1 = uFlesh + b.nailFree;
  const halfWidth = r * (thumb ? 0.7 : 0.76);
  // How curved it is across: a little more than the skin under it, so its sides tuck into the
  // folds along them instead of standing up as walls.
  const bend = r * (thumb ? 0.9 : 0.95);
  const thick = 0.00055;
  const heightAt = (u: number) => surfaceAlong(field, add(s.a, mul(s.dir, u)), s.dorsal, r * 2.5);
  // The skin's height along the bone, sampled; past the flesh's end the nail runs on, curving
  // down a little.
  const uEnd = L + reach * 0.5;
  const samples = 24;
  const heights = Array.from({ length: samples + 1 }, (_, i) =>
    heightAt(u0 + ((uEnd - u0) * i) / samples),
  );
  const endSlope = (heights[samples] - heights[samples - 2]) / ((2 * (uEnd - u0)) / samples);
  const skinAt = (u: number) => {
    if (u >= uEnd) {
      const past = u - uEnd;
      // A long nail curves on down past the tip, as the finger would (a C seen from the side).
      return heights[samples] + Math.max(endSlope, -0.3) * past * 0.45 - past * past * 28;
    }
    const f = (Math.max(u, u0) - u0) / ((uEnd - u0) / samples);
    const i = Math.min(Math.floor(f), samples - 1);
    return heights[i] + (heights[i + 1] - heights[i]) * (f - i);
  };
  // The plate's axis: under the skin's top by its curvature, set 0.08 mm into the skin, and
  // sunk under the fold at the cuticle.
  const axisAt = (u: number) =>
    skinAt(u) - bend + thick * 0.5 - 0.00008 - 0.0003 * (1 - smooth(u0, u0 + 0.0012, u));
  const almond = Math.max(0, b.nailRound - 0.6) / 0.4;
  const proximal = halfWidth * 0.95,
    distal = halfWidth * Math.min(0.38 + 0.6 * b.nailRound, 0.95);
  const cu = (u0 + u1) / 2,
    hu = (u1 - u0) / 2;
  const distance = (x: number, y: number, z: number) => {
    const p = sub([x, y, z], s.a);
    const u = dot(p, s.dir),
      lat = dot(p, s.lateral),
      up = dot(p, s.dorsal) - axisAt(u);
    const radial = Math.hypot(lat, up);
    // A little thicker where it runs free of the finger: seen from the side it is a nail,
    // not a blade.
    const t = thick + 0.0002 * smooth(uFlesh, u1, u);
    const shell = Math.abs(radial - bend) - t * 0.5;
    // Across the plate as an arc length; the outline a rectangle with round ends, rounder at
    // the free edge for an oval nail.
    const across = bend * Math.atan2(lat, up);
    const corner = u > cu ? distal : proximal;
    // An almond nail narrows past the flesh toward a soft point.
    const narrow = almond * smooth(uFlesh - 0.002, u1, u);
    const qx = Math.abs(across) / (1 - 0.45 * narrow) - (halfWidth - corner),
      qy = Math.abs(u - cu) - (hu - corner);
    const outline =
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - corner;
    // The plate's rim rounded over its thickness, not a knife edge.
    const rr = thick * 0.45;
    const a = shell + rr,
      c = outline + rr;
    return Math.hypot(Math.max(a, 0), Math.max(c, 0)) + Math.min(Math.max(a, c), 0) - rr;
  };
  /** A point on the nail's top: along the bone, and across it as a share of its half width. */
  const onTop = (u: number, share: number): V => {
    const angle = (share * halfWidth) / bend;
    return add(
      add(add(s.a, mul(s.dir, u)), mul(s.lateral, bend * Math.sin(angle))),
      mul(s.dorsal, axisAt(u) + bend * Math.cos(angle)),
    );
  };
  const corners: V[] = [];
  for (const u of [u0 - 0.001, u1 + 0.001])
    for (const l of [-halfWidth - 0.001, halfWidth + 0.001])
      for (const h of [-0.004, 0.003]) {
        const c = add(
          add(add(s.a, mul(s.dir, u)), mul(s.lateral, l)),
          mul(s.dorsal, axisAt(u) + bend + h),
        );
        corners.push(c);
      }
  const min = [0, 1, 2].map((k) => Math.min(...corners.map((c) => c[k])) - 0.0015) as V;
  const max = [0, 1, 2].map((k) => Math.max(...corners.map((c) => c[k])) + 0.0015) as V;
  return { distance, min, max, s, u0, u1, uFlesh, halfWidth, onTop };
}

/** The skin that holds a nail: a low fold along each side of it and over its root. */
function nailFolds(nail: ReturnType<typeof nailField>, sx: number): ZhudaSdfShape[] {
  const shapes: ZhudaSdfShape[] = [];
  const r = 0.0007 * sx;
  const { s, u0, uFlesh, onTop } = nail;
  const run = uFlesh - 0.0012 * sx - (u0 + 0.0008);
  for (const side of [-1, 1]) {
    const points: V[] = [];
    for (let i = 0; i <= 6; i++) {
      const u = u0 + 0.0008 + (run * i) / 6;
      // Beside the nail's edge, a little lower than its top, lower toward the tip.
      const p = onTop(u, side * 1.04);
      const fall = i / 6;
      points.push(
        add(add(p, mul(s.lateral, side * r * 0.55)), mul(s.dorsal, -r * (0.75 + 0.5 * fall))),
      );
    }
    for (let i = 0; i < 6; i++)
      shapes.push({ kind: 'roundCone', a: points[i], b: points[i + 1], ra: r, rb: r * 0.8 });
  }
  // Over the root: an arc across, just behind where the nail shows.
  const arc: V[] = [];
  for (let i = 0; i <= 8; i++) {
    const share = -1.05 + (2.1 * i) / 8;
    arc.push(
      add(
        add(
          onTop(u0 + 0.0006 * sx - 0.0006 * Math.abs(share) ** 2, share),
          mul(s.dorsal, -r * 0.55),
        ),
        mul(s.dir, -r * 0.2),
      ),
    );
  }
  for (let i = 0; i < 8; i++)
    shapes.push({ kind: 'roundCone', a: arc[i], b: arc[i + 1], ra: r * 1.05, rb: r * 1.05 });
  return shapes;
}

/** The veins that show on the back of the hand: lines in the hand's plane, base proportions. */
const VEINS: Array<Array<[number, number]>> = [
  [
    [0.026, 0.07],
    [0.022, 0.05],
    [0.016, 0.03],
    [0.012, 0.012],
    [0.01, -0.012],
  ],
  [
    [0.004, 0.074],
    [0.006, 0.055],
    [0.002, 0.035],
    [-0.002, 0.018],
    [-0.004, -0.008],
  ],
  [
    [-0.016, 0.07],
    [-0.019, 0.05],
    [-0.021, 0.03],
    [-0.021, 0.01],
    [-0.019, -0.014],
  ],
  // The arch across the back joins them; it bows toward the fingers in the middle.
  [
    [0.02, 0.05],
    [0.011, 0.056],
    [0.0, 0.058],
    [-0.011, 0.055],
    [-0.019, 0.049],
  ],
];
/** How strongly each vein shows: the arch, thinner and deeper, least. */
const VEIN_STRENGTH = [1, 0.85, 1, 0.45];

/** A crease to cut: points on the skin, the outward direction at each, how wide and how deep, how dark. */
type Crease = { points: V[]; out: V[]; width: number; depth: number; strength: number };

/** Capsules along a crease, raised so they cut only `depth` into the skin, thinning to nothing at the ends. */
function creaseCapsules(c: Crease): ZhudaSdfShape[] {
  const shapes: ZhudaSdfShape[] = [];
  const n = c.points.length - 1;
  const r = c.width / 2;
  const at = (i: number) => {
    const fade = Math.max(0, Math.sin((Math.PI * i) / n)) ** 0.6;
    // The capsule's middle sits r - depth outside the skin; toward the ends it lifts clear of
    // the skin and of the fillet that joins it, so a crease fades out instead of grazing.
    return add(c.points[i], mul(c.out[i], r - c.depth * fade + 0.0014 * (1 - fade)));
  };
  for (let i = 0; i < n; i++)
    shapes.push({ kind: 'roundCone', a: at(i), b: at(i + 1), ra: r, rb: r });
  return shapes;
}
/** Points along straight runs between control points, `per` to a run. */
function along(control: V[], per: number): V[] {
  const out: V[] = [];
  for (let i = 0; i < control.length - 1; i++)
    for (let k = 0; k < per; k++) out.push(mix(control[i], control[i + 1], k / per));
  out.push(control[control.length - 1]);
  return out;
}

/**
 * The creases of the skin: across the palm side of each finger joint (two at
 * the middle joint), where a finger leaves the palm, the thumb's, the three
 * long lines of the palm, the wrist's, and faint wrinkles over the backs of
 * the middle joints. Each is seated on the skin as it is.
 */
function creases(body: ZhudaSdfField, digits: Digit[], o: Resolved): Crease[] {
  const sx = o.breadth / 0.082,
    sy = palmScale(o);
  const list: Crease[] = [];
  /** An arc round a digit at a place on its axis, from `side` (unit, square to the axis), `spread` degrees each way. */
  const arc = (
    centre: V,
    axis: V,
    side: V,
    spread: number,
    width: number,
    depth: number,
    strength: number,
    samples = 12,
  ) => {
    const points: V[] = [],
      out: V[] = [];
    for (let i = 0; i <= samples; i++) {
      const dir = turn(side, axis, rad(-spread + (2 * spread * i) / samples));
      points.push(add(centre, mul(dir, surfaceAlong(body, centre, dir, 0.03))));
      out.push(dir);
    }
    list.push({ points, out, width: width * sx, depth: depth * sx, strength });
  };
  for (const d of digits) {
    const at = (segment: number, u: number) => {
      const s = d.segments[segment];
      return add(s.a, mul(s.dir, u));
    };
    const palmar = (segment: number) => mul(d.segments[segment].dorsal, -1);
    const axisAt = (segment: number) => d.segments[segment].dir;
    if (d.name !== 'thumb') {
      const L0 = Math.hypot(...sub(d.segments[0].b, d.segments[0].a));
      // Across the palm side only: wrapped further they notch the finger's outline seen from
      // the back, and the finger looks beaded.
      arc(at(0, L0 * 0.4), axisAt(0), palmar(0), 52, 0.0022, 0.00045, 0.55);
      arc(at(1, -0.0011 * sy), axisAt(1), palmar(1), 52, 0.0018, 0.00042, 0.55);
      arc(at(1, 0.0011 * sy), axisAt(1), palmar(1), 46, 0.0016, 0.00035, 0.45);
      arc(at(2, 0.0005 * sy), axisAt(2), palmar(2), 50, 0.0016, 0.00035, 0.45);
      // Faint wrinkles over the back of the middle joint, shorter toward the ends.
      [
        [-0.0024, 22],
        [-0.0006, 30],
        [0.0013, 26],
      ].forEach(([u, spread]) =>
        arc(
          at(1, u * sy),
          axisAt(1),
          d.segments[1].dorsal,
          spread,
          0.0012,
          0.00014 * (0.5 + 0.5 * Math.min(o.build.bone, 1)),
          0.22 * (0.4 + 0.6 * Math.min(o.build.bone, 1)),
          8,
        ),
      );
    } else {
      // Not round toward the web: there the arc would cut into it.
      arc(at(1, 0.0012 * sy), axisAt(1), palmar(1), 42, 0.002, 0.00045, 0.55);
      arc(at(1, 0.0032 * sy), axisAt(1), palmar(1), 40, 0.0016, 0.00035, 0.45);
      arc(at(2, 0.0006 * sy), axisAt(2), palmar(2), 68, 0.0018, 0.0004, 0.5);
    }
  }
  // The palm's lines, drawn on the palm from inside it.
  const onPalm = (xy: Array<[number, number]>, width: number, depth: number, strength: number) => {
    // Only where the line runs over the palm: a point whose start is not inside the body is
    // past the palm's edge, and the line stops there.
    const points = along(
      xy.map(([x, y]) => [x * sx, y * sy, -0.002 * sx] as V),
      5,
    )
      .filter((p) => body.distance(...p) < -0.002)
      .map((p) => add(p, [0, 0, -surfaceAlong(body, p, [0, 0, -1], 0.04)]));
    if (points.length < 3) return;
    list.push({
      points,
      out: points.map(() => [0, 0, -1] as V),
      width: width * sx,
      depth: depth * sx,
      strength,
    });
  };
  // The heart line, from the little finger's edge to between the index and middle fingers.
  onPalm(
    [
      [0.036, 0.066],
      [0.024, 0.07],
      [0.009, 0.0755],
      [-0.005, 0.082],
      [-0.013, 0.0865],
    ],
    0.0024,
    0.0005,
    0.5,
  );
  // The head line, from the web of the thumb across the middle of the palm.
  onPalm(
    [
      [-0.023, 0.069],
      [-0.016, 0.0655],
      [-0.003, 0.06],
      [0.011, 0.054],
      [0.021, 0.0505],
    ],
    0.0022,
    0.00045,
    0.45,
  );
  // The life line, round the ball of the thumb to the wrist.
  onPalm(
    [
      [-0.0225, 0.069],
      [-0.0165, 0.0615],
      [-0.0105, 0.049],
      [-0.0068, 0.034],
      [-0.0058, 0.019],
      [-0.0065, 0.008],
    ],
    0.0024,
    0.0005,
    0.5,
  );
  // The wrist's two creases.
  onPalm(
    [
      [-0.022, 0.0025],
      [-0.008, 0.0],
      [0.008, 0.0],
      [0.022, 0.0025],
    ],
    0.002,
    0.0004,
    0.4,
  );
  onPalm(
    [
      [-0.019, -0.0075],
      [-0.006, -0.009],
      [0.008, -0.009],
      [0.019, -0.0075],
    ],
    0.0016,
    0.00025,
    0.25,
  );
  return list;
}

/**
 * The tendons on the back of the hand: one strand from behind each knuckle
 * toward the middle of the wrist, a little above the skin near the knuckle
 * and sinking into it toward the wrist.
 */
function tendonShapes(trunk: ZhudaSdfField, digits: Digit[], o: Resolved): ZhudaSdfShape[][] {
  const sx = o.breadth / 0.082,
    sy = palmScale(o);
  const shapes: ZhudaSdfShape[][] = [];
  const skinAbove = (p: V): V => {
    const inside: V = [p[0], p[1], 0];
    return add(inside, [0, 0, surfaceAlong(trunk, inside, [0, 0, 1], 0.04)]);
  };
  for (const name of ZHUDA_HAND_FINGERS) {
    const d = digits.find((x) => x.name === name)!;
    if (o.build.tendons < 0.05) continue;
    const r = 0.0026 * sx * (name === 'little' ? 0.8 : 1);
    // From just behind the knuckle, sunk there, up to its highest a third of the way to the
    // wrist, and under again at the wrist: two cones joined without a fillet (a fillet
    // bulges where two pieces meet), the pair joined to the hand with one. (One long slim
    // ellipsoid broke down: the ellipsoid's distance is an estimate, poor at 13 to 1.)
    const start = sub(d.joints[0], mul(d.segments[0].dir, 0.005 * sy));
    const end: V = [start[0] * 0.35 + 0.002 * sx, 0.004 * sy, 0];
    const top = mix(start, end, 0.42);
    const raise = 0.00042 * sx * Math.min(o.build.tendons, 1.3) ** 2;
    const a = add(skinAbove(start), [0, 0, -r * 1.3]);
    const m = add(skinAbove(top), [0, 0, -r + raise]);
    const b = add(skinAbove(end), [0, 0, -r * 2.6]);
    shapes.push([
      { kind: 'roundCone', a, b: m, ra: r * 0.85, rb: r },
      { kind: 'roundCone', a: m, b, ra: r, rb: r * 0.8 },
    ]);
  }
  return shapes;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toDisplay = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** Makes the hand. Throws with every problem `validateZhudaHand` finds. */
export function createZhudaHandMesh(options: ZhudaHandOptions = {}): ZhudaHandMesh {
  const errors = validateZhudaHand(options);
  if (errors.length) throw Error(`Invalid hand: ${errors.join('; ')}`);
  const o: Resolved = {
    build: { ...NEUTRAL_BUILD, ...options.build } as Required<ZhudaHandBuild>,
    side: options.side ?? 'right',
    length: options.length ?? 0.185,
    breadth: options.breadth ?? 0.082,
    pose: options.pose ?? {},
    tone: options.tone ?? [0.86, 0.66, 0.56],
    cellSize: options.cellSize ?? 0.0009,
    forearm: options.forearm ?? 0.05,
  };
  if (o.build.tendons < 0) o.build.tendons = o.build.bone;
  const pose = { ...ZHUDA_HAND_RELAXED, ...o.pose } as Required<ZhudaHandPose>;
  const sx = o.breadth / 0.082;
  const digits = poseDigits(o, pose);
  const plain = createZhudaSdfField([...palmShapes(digits, o), ...webShapes(digits, sx)]);
  // Each tendon a field of its own, joined to the palm with a fillet as a whole; a narrow
  // one, since a fillet itself swells the skin by up to a quarter of its width.
  const trunk = joinZhudaSdfFields(
    plain,
    tendonShapes(plain, digits, o).map((pair) => ({
      field: createZhudaSdfField(pair),
      blend: 0.004,
    })),
  );
  const limbs = digits.map((d) => ({
    field: createZhudaSdfField(digitShapes(d, o.build.bone)),
    // The little finger joins the hand's edge with a fuller fillet: no corner at its base.
    blend: d.name === 'thumb' ? 0.012 : d.name === 'little' ? 0.013 : 0.0085,
  }));
  const joined = joinZhudaSdfFields(trunk, limbs);
  // The creases are cut last, into the skin as it is; they reach no deeper than a millimetre,
  // so only a point that near the surface asks them.
  const lines = creases(joined, digits, o);
  const owner: number[] = [];
  const cuts: ZhudaSdfShape[] = [];
  lines.forEach((line, i) =>
    creaseCapsules(line).forEach((shape) => {
      cuts.push(shape);
      owner.push(i);
    }),
  );
  const creaseField = createZhudaSdfUnion(cuts, { reach: 0.003 });
  const body: ZhudaSdfField = {
    bounds: joined.bounds,
    nearest: joined.nearest,
    distance(x, y, z) {
      const d = joined.distance(x, y, z);
      if (d > 0.0025 || d < -0.0025) return d;
      return -zhudaSmoothMin(-d, creaseField.distance(x, y, z), 0.0009);
    },
  };
  // The nails, seated on the skin as it is; then the folds of skin that hold them.
  const nailFields = digits.map((d) => nailField(body, d, o.build));
  const folds = createZhudaSdfUnion(
    nailFields.flatMap((n) => nailFolds(n, sx)),
    { reach: 0.003 },
  );
  const held: ZhudaSdfField = {
    bounds: body.bounds,
    nearest: body.nearest,
    distance(x, y, z) {
      const d = body.distance(x, y, z);
      if (d > 0.003 || d < -0.003) return d;
      return zhudaSmoothMin(d, folds.distance(x, y, z), 0.0011);
    },
  };
  /** How much a crease darkens a point of the skin: its strength in its bottom, none at its edge. */
  const creaseAt = (q: V) => {
    const i = creaseField.nearest(...q);
    if (i < 0) return 0;
    const line = lines[owner[i]];
    // Inside a capsule by more than its radius less its depth is the bottom of the crease.
    const inside = -creaseField.distance(...q) - (line.width / 2 - line.depth);
    return line.strength * smooth(-0.0002 * sx, line.depth, inside);
  };
  // A left hand is the right one seen in a mirror across x: the field is read mirrored.
  const m = o.side === 'left' ? -1 : 1;
  const mirror = (p: V): V => [p[0] * m, p[1], p[2]];
  const distance = (x: number, y: number, z: number) => held.distance(x * m, y, z);
  const bmin = mirror(body.bounds.min),
    bmax = mirror(body.bounds.max);
  const min: V = [Math.min(bmin[0], bmax[0]), body.bounds.min[1], body.bounds.min[2]];
  const max: V = [Math.max(bmin[0], bmax[0]), body.bounds.max[1], body.bounds.max[2]];
  // The forearm is cut where it leaves the box: the mesh is closed at its end by a plane.
  const cut = -o.forearm + 0.004;
  const closed = (x: number, y: number, z: number) => Math.max(distance(x, y, z), cut - y);
  min[1] = Math.max(min[1], cut - 0.004);

  const sy = palmScale(o);
  const veinLines = VEINS.map((line) => line.map(([x, y]) => [x * sx, y * sy] as [number, number]));
  const tone = o.tone.map(toLinear) as V;
  const palmTone = mix(tone, mul(tone, 1), 0).map((v, k) => v * [1.06, 1.0, 1.0][k]) as V;
  const flush: V = [0.82, 0.42, 0.36].map(toLinear) as V;
  const palmNormalDot = (n: V) => -n[2];
  const skin = createZhudaIsosurfaceMesh({
    distance: closed,
    min,
    max,
    cellSize: o.cellSize,
    project: 3,
    uv: (p) => [p[0] * m, p[1]],
    color: (p, n) => {
      const q = mirror(p);
      const nq = mirror(n);
      const part = body.nearest(...q);
      // The palm's rule: its own palm side, its knuckles.
      const palmRule = {
        side: palmNormalDot(nq),
        flush:
          smooth(0.07 * palmScale(o), 0.095 * palmScale(o), q[1]) *
          0.35 *
          Math.max(-palmNormalDot(nq), 0),
      };
      let palmSide = palmRule.side;
      let flushAmount = palmRule.flush;
      if (part >= 0) {
        const d = digits[part];
        let best = 0,
          bestU = 0,
          bestD = Infinity;
        d.segments.forEach((s, i) => {
          const L = Math.hypot(...sub(s.b, s.a));
          const u = Math.min(Math.max(dot(sub(q, s.a), s.dir), 0), L);
          const dist = Math.hypot(...sub(q, add(s.a, mul(s.dir, u))));
          if (dist < bestD) {
            bestD = dist;
            best = i;
            bestU = u / L;
          }
        });
        const side = -dot(nq, d.segments[best].dorsal);
        // Warmer over the joints on the back (the knuckle where the finger starts too) and at
        // the tips, fading along the bone rather than in rings.
        const top = Math.max(-side, 0) ** 2;
        const atJoint =
          best === 0
            ? Math.max(1 - smooth(0, 0.35, bestU), smooth(0.7, 1, bestU))
            : best === 1
              ? Math.max(1 - smooth(0, 0.3, bestU), smooth(0.75, 1, bestU))
              : 1 - smooth(0, 0.3, bestU);
        const tip = best === 2 ? smooth(0.45, 1, bestU) * smooth(-0.4, 0.6, side) : 0;
        const digitFlush = Math.max(atJoint * 0.3 * top, tip * 0.45);
        // Where the finger meets the palm the two rules blend, so no seam shows.
        const w = smooth(-0.004, 0.004, trunk.distance(...q) - limbs[part].field.distance(...q));
        palmSide = palmRule.side + (side - palmRule.side) * w;
        flushAmount = palmRule.flush + (digitFlush - palmRule.flush) * w;
      }
      const palm = smooth(-0.1, 0.5, palmSide);
      let c = mix(tone, palmTone, palm);
      // The palm side is paler and pinker; its pads redder.
      c = mix(c, [c[0] * 1.02, c[1] * 0.9, c[2] * 0.9], palm * 0.6);
      c = mix(c, flush, Math.min(flushAmount * o.build.flush, 0.85));
      // A fine darker line where the skin meets a nail, round its root and sides.
      for (const nail of nailFields) {
        const e = nail.distance(...q);
        if (e < 0.0012 * sx)
          c = mix(c, [c[0] * 0.86, c[1] * 0.74, c[2] * 0.72], 1 - smooth(0.0002, 0.0012 * sx, e));
      }
      // Darker and a little redder in the bottom of a crease.
      const crease = creaseAt(q);
      c = mix(c, [c[0] * 0.8, c[1] * 0.68, c[2] * 0.66], crease);
      // Veins under the skin of the back, bluer where they run.
      if (o.build.veins > 0 && part < 0 && nq[2] > 0.15) {
        let vein = 0;
        veinLines.forEach((line, k) => {
          let near = Infinity,
            at = 0,
            run = 0;
          const total = line
            .slice(1)
            .reduce((n, p, i) => n + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);
          for (let i = 0; i < line.length - 1; i++) {
            const a = line[i],
              b2 = line[i + 1];
            const ab = [b2[0] - a[0], b2[1] - a[1]],
              ap = [q[0] - a[0], q[1] - a[1]];
            const length = Math.hypot(ab[0], ab[1]);
            const t = Math.min(
              Math.max((ap[0] * ab[0] + ap[1] * ab[1]) / (ab[0] ** 2 + ab[1] ** 2), 0),
              1,
            );
            const d = Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t);
            if (d < near) {
              near = d;
              at = (run + t * length) / total;
            }
            run += length;
          }
          const w = 0.0016 * sx;
          // A vein comes up out of the skin and goes back under it: faint at its two ends.
          const ends = smooth(0, 0.3, at) * (1 - smooth(0.85, 1, at));
          vein = Math.max(vein, Math.exp(-((near / w) ** 2)) * VEIN_STRENGTH[k] * ends);
        });
        vein *= o.build.veins * smooth(0.15, 0.6, nq[2]);
        c = mix(c, [c[0] * 0.8, c[1] * 0.86, c[2] * 1.04], vein * 0.7);
      }
      // How thick the hand is here: along the normal, and, where the palm's skin faces the
      // front, also straight through the hand, the shorter. (Along the normal alone, a slope of the
      // heel sent the line lengthwise through the wrist: the heel read far thicker than the
      // palm above it, and the light through the palm stopped there in a straight edge.)
      let depth = zhudaSdfDepthAlong(distance, sub(p, mul(n, 0.0004)), mul(n, -1), 0.06);
      // Faded in as the skin turns to face front or back: switched on at once, it made bands
      // down the sides where it switched.
      // On the palm's side only, where the heel's slope was the trouble.
      const facing = part < 0 ? smooth(0.15, 0.6, -n[2]) : 0;
      if (facing > 0) {
        const through: V = [0, 0, 1];
        const across = zhudaSdfDepthAlong(distance, sub(p, mul(n, 0.0004)), through, 0.06);
        depth += (Math.min(depth, across) - depth) * facing;
      }
      const thin = Math.exp(-depth / 0.016);
      return [toDisplay(c[0]), toDisplay(c[1]), toDisplay(c[2]), thin];
    },
  });

  // Nails: meshed finer than the skin.
  const parts: MeshData[] = [];
  const bed = o.build.nailTone;
  for (const nail of nailFields) {
    const nm = (p: V) => mirror(p);
    const mn = mirror(nail.min),
      mx = mirror(nail.max);
    parts.push(
      createZhudaIsosurfaceMesh({
        distance: (x, y, z) => nail.distance(x * m, y, z),
        min: [Math.min(mn[0], mx[0]), nail.min[1], nail.min[2]],
        max: [Math.max(mn[0], mx[0]), nail.max[1], nail.max[2]],
        cellSize: Math.min(o.cellSize * 0.3, 0.00026),
        project: 3,
        uv: (p) => {
          const q = nm(p);
          return [dot(sub(q, nail.s.a), nail.s.lateral), dot(sub(q, nail.s.a), nail.s.dir)];
        },
        color: (p) => {
          const q = nm(p);
          const u = dot(sub(q, nail.s.a), nail.s.dir);
          // Pink where the bed is under it, a pale half-moon at the root, white and clearer
          // where there is no skin under it.
          const gap = body.distance(...q);
          const free = smooth(0.0011, 0.0019, gap) * smooth(nail.uFlesh - 0.001, nail.uFlesh, u);
          const moon = 1 - smooth(nail.u0 + 0.0006, nail.u0 + 0.0024, u);
          // Paler toward the sides, where the plate turns down into the folds.
          const side = Math.abs(dot(sub(q, nail.s.a), nail.s.lateral)) / nail.halfWidth;
          let c = mix(bed, [0.95, 0.88, 0.86], Math.max(moon * 0.55, smooth(0.6, 1, side) * 0.35));
          c = mix(c, [0.97, 0.91, 0.87], free * 0.8);
          return [c[0], c[1], c[2], 1];
        },
      }),
    );
  }
  const nails = concat(parts);

  const joints: ZhudaHandJoint[] = [];
  const tips = {} as Record<ZhudaHandDigit, V>;
  for (const d of digits) {
    d.joints.forEach((j, index) => joints.push({ digit: d.name, index, position: mirror(j) }));
    const last = d.segments[2];
    tips[d.name] = mirror(
      add(last.b, mul(last.dir, surfaceAlong(body, last.b, last.dir, last.rb * 2))),
    );
  }
  return { skin: splitZhudaMesh(skin), nails, joints, tips, side: o.side };
}

function concat(parts: MeshData[]): MeshData {
  const count = parts.reduce((n, p) => n + p.positions.length / 3, 0);
  if (count > 65535) throw Error('The nails need more than 65535 vertices; give a larger cellSize');
  const positions = new Float32Array(count * 3),
    normals = new Float32Array(count * 3),
    uvs = new Float32Array(count * 2),
    colors = new Float32Array(count * 4);
  const indices = new Uint16Array(parts.reduce((n, p) => n + p.indices.length, 0));
  let v = 0,
    i = 0;
  for (const p of parts) {
    positions.set(p.positions, v * 3);
    normals.set(p.normals!, v * 3);
    uvs.set(p.uvs!, v * 2);
    colors.set(p.colors!, v * 4);
    for (let k = 0; k < p.indices.length; k++) indices[i + k] = p.indices[k] + v;
    v += p.positions.length / 3;
    i += p.indices.length;
  }
  return { positions, normals, uvs, colors, indices };
}

export interface ZhudaHandSurfaceOptions {
  /** A prefix for the two shader names (each name is a shader contract: one per look, not per hand). */
  name: string;
  /** How much fine creasing shows close up (0 to 2; default 1). */
  detail?: number;
  /** Faint blotches of colour across the skin (0 to 2; default 1). */
  mottle?: number;
  /** The skin's roughness between its creases (0.25 to 0.8; default 0.48). */
  roughness?: number;
  /** The colour light takes through skin, as light (default 1, 0.3, 0.2). */
  subsurfaceColor?: [number, number, number];
}

/**
 * The lit surfaces a `createZhudaHandMesh` hand is drawn with: skin that reads
 * the mesh's tint and thinness, light round and through it, a soft network of
 * fine creases that fades out where it would be smaller than a pixel,
 * faint blotches of colour; and glossy nails. Pass each to
 * `new ZhudaLitSurfaceMaterial(spec)`, and give the skin the hand's place
 * with `setZhudaHandSkinSpace` whenever the hand moves, turns or scales: the
 * fine pattern is in the hand's own space and stays on it.
 */
export function createZhudaHandSurfaces(options: ZhudaHandSurfaceOptions): {
  skin: ZhudaLitSurfaceSpec;
  nail: ZhudaLitSurfaceSpec;
} {
  const errors: string[] = [];
  if (typeof options?.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(options.name))
    errors.push('name must be letters, digits and _, starting with a letter');
  const num = (v: unknown, label: string, lo: number, hi: number, d: number) => {
    if (v === undefined) return d;
    if (!(finite(v) && (v as number) >= lo && (v as number) <= hi))
      errors.push(`${label} must be a number from ${lo} to ${hi}`);
    return v as number;
  };
  const detail = num(options?.detail, 'detail', 0, 2, 1);
  const mottle = num(options?.mottle, 'mottle', 0, 2, 1);
  const roughness = num(options?.roughness, 'roughness', 0.25, 0.8, 0.48);
  const sss = options?.subsurfaceColor ?? [1, 0.3, 0.2];
  if (!Array.isArray(sss) || sss.length !== 3 || !sss.every((v) => finite(v) && v >= 0 && v <= 1))
    errors.push('subsurfaceColor must be three numbers from 0 to 1');
  if (errors.length) throw Error(`Invalid hand surfaces: ${errors.join('; ')}`);
  const f = (v: number) => v.toFixed(4);
  const skin: ZhudaLitSurfaceSpec = {
    name: `${options.name}Skin`,
    common: true,
    material: { roughness, metallic: 0 },
    subsurface: {
      color: [...sss] as [number, number, number],
      wrap: 0.45,
      back: 1.6,
      power: 3,
      distortion: 0.25,
    },
    // The faint soft glow skin has where it turns from the eye.
    sheen: { color: [0.26, 0.22, 0.2], roughness: 0.55 },
    // The world-to-hand transform, a row each (`setZhudaHandSkinSpace`).
    uniforms: {
      u_ZhudaSkinX: { type: 'vec4', value: [1, 0, 0, 0] },
      u_ZhudaSkinY: { type: 'vec4', value: [0, 1, 0, 0] },
      u_ZhudaSkinZ: { type: 'vec4', value: [0, 0, 1, 0] },
    },
    surface: `float zhudaSkinRelief(vec3 q){
  // Creases: where a noise crosses its middle, a network of soft lines about half a
  // millimetre apart. (A finer layer and pores broke into dark dots: thinner than a pixel.)
  float a=1.0-abs(2.0*zhudaNoise(q*1800.0)-1.0);
  return -smoothstep(0.8,1.0,a);
}
vec3 zhudaSkinSpace(vec3 p){
  vec4 w=vec4(p,1.0);
  return vec3(dot(u_ZhudaSkinX,w),dot(u_ZhudaSkinY,w),dot(u_ZhudaSkinZ,w));
}
void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  s.baseColor *= s.vertexColor.rgb;
  s.thickness = s.vertexColor.a;
  vec3 q = zhudaSkinSpace(p);
  // Faint blotches: a little redder here, a little paler there.
  float m = zhudaFbm(q * 70.0) - 0.5;
  s.baseColor *= mix(vec3(1.0), vec3(1.05, 0.95, 0.94), clamp(m * 2.2 * ${f(mottle)}, -1.0, 1.0));
  // The fine relief, faded out where a pixel is wider than about a quarter millimetre.
  float footprint = max(length(dFdx(p)), length(dFdy(p)));
  float show = ${f(detail)} * (1.0 - smoothstep(0.00009, 0.00022, footprint));
  float r = ${f(roughness)};
  if (show > 0.001) {
    float e = 0.00004;
    float h0 = zhudaSkinRelief(q);
    float ht = zhudaSkinRelief(zhudaSkinSpace(p + s.tangent * e));
    float hb = zhudaSkinRelief(zhudaSkinSpace(p + s.bitangent * e));
    // The slope across the surface, a 0.05 mm relief.
    vec2 slope = vec2(ht - h0, hb - h0) / e * 0.00005 * show;
    s.normalTS = normalize(vec3(-slope, 1.0));
    r = mix(r, 0.62, clamp(-h0 * 0.6 * show, 0.0, 1.0));
  }
  s.roughness = r;
}`,
  };
  const nail: ZhudaLitSurfaceSpec = {
    name: `${options.name}Nail`,
    material: { roughness: 0.18, metallic: 0, clearCoat: 0.5, clearCoatRoughness: 0.06 },
    // A nail is thin and clear: light wraps round it and comes through it, so seen edge on
    // it is pale, not a dark blade.
    // The light through it takes the bed's pink (a paler one washed the nail out).
    subsurface: { color: [1, 0.55, 0.5], wrap: 0.6, back: 0.9, power: 2, distortion: 0.2 },
    surface: `void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  s.baseColor *= s.vertexColor.rgb;
  s.thickness = 1.0;
}`,
  };
  return { skin, nail };
}

/**
 * Gives a hand's skin (a material made from `createZhudaHandSurfaces().skin`)
 * the hand's place, so its fine pattern stays on the hand: `worldMatrix` is
 * the hand node's world matrix as 16 numbers in LayaAir's order (the axes in
 * 0..2, 4..6, 8..10, the position in 12..14), e.g.
 * `node.transform.worldMatrix.elements`. Call it when the hand moves.
 */
export function setZhudaHandSkinSpace(
  skin: { set(name: string, value: readonly number[]): void },
  worldMatrix: ArrayLike<number>,
): void {
  if (!worldMatrix || worldMatrix.length < 16) throw Error('worldMatrix must be 16 numbers');
  const m = Array.from({ length: 16 }, (_, i) => worldMatrix[i]);
  if (!m.every(finite)) throw Error('worldMatrix must be 16 finite numbers');
  // The 3 by 3 part, a column an axis: world = A * local + t.
  const a = [
    [m[0], m[4], m[8]],
    [m[1], m[5], m[9]],
    [m[2], m[6], m[10]],
  ];
  const t = [m[12], m[13], m[14]];
  const det =
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  if (!(Math.abs(det) > 1e-12)) throw Error('worldMatrix cannot be inverted');
  const inv = [
    [
      (a[1][1] * a[2][2] - a[1][2] * a[2][1]) / det,
      (a[0][2] * a[2][1] - a[0][1] * a[2][2]) / det,
      (a[0][1] * a[1][2] - a[0][2] * a[1][1]) / det,
    ],
    [
      (a[1][2] * a[2][0] - a[1][0] * a[2][2]) / det,
      (a[0][0] * a[2][2] - a[0][2] * a[2][0]) / det,
      (a[0][2] * a[1][0] - a[0][0] * a[1][2]) / det,
    ],
    [
      (a[1][0] * a[2][1] - a[1][1] * a[2][0]) / det,
      (a[0][1] * a[2][0] - a[0][0] * a[2][1]) / det,
      (a[0][0] * a[1][1] - a[0][1] * a[1][0]) / det,
    ],
  ];
  // local = inv * (world - t): a row each, with its offset in w.
  const rows = inv.map((r) => [r[0], r[1], r[2], -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2])]);
  skin.set('u_ZhudaSkinX', rows[0]);
  skin.set('u_ZhudaSkinY', rows[1]);
  skin.set('u_ZhudaSkinZ', rows[2]);
}
