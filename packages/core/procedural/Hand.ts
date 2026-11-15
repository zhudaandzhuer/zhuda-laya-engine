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
}

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
type Digit = {
  name: ZhudaHandDigit;
  joints: V[];
  radii: number[];
  segments: Segment[];
};

function poseDigits(
  options: Required<Pick<ZhudaHandOptions, 'length' | 'breadth'>>,
  pose: Required<ZhudaHandPose>,
): Digit[] {
  const sx = options.breadth / 0.082,
    sy = options.length / 0.185;
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
    const radii = f.radii.map((r) => r * sx);
    let at = knuckle;
    for (let i = 0; i < 3; i++) {
      // Bend toward the palm about the finger's side axis.
      const lateral = unit(cross(dir, dorsal));
      const bend = rad(angles[i]);
      dir = turn(dir, lateral, -bend);
      dorsal = turn(dorsal, lateral, -bend);
      const length = f.bones[i] * sy;
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
    const radii = THUMB.radii.map((r) => r * sx);
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
      const next = add(at, mul(dir, THUMB.bones[i] * sy));
      segments.push({ a: at, b: next, ra: radii[i], rb: radii[i + 1], dorsal, lateral, dir });
      joints.push(next);
      at = next;
    }
    digits.unshift({ name: 'thumb', joints, radii, segments });
  }
  return digits;
}

/** The flesh of one digit: a cone along each bone, a ball at each joint, a pad under each bone. */
function digitShapes(d: Digit): ZhudaSdfShape[] {
  const shapes: ZhudaSdfShape[] = [];
  const thumb = d.name === 'thumb';
  d.segments.forEach((s, i) => {
    const length = Math.hypot(...sub(s.b, s.a));
    const last = i === 2;
    // A digit is wider than it is deep; the end bone flattest, under the nail.
    const squash = thumb ? (last ? 0.8 : 0.84) : last ? 0.84 : 0.9;
    // The bone's cone, a little waisted between the joints.
    shapes.push({
      kind: 'roundCone',
      a: s.a,
      b: s.b,
      ra: s.ra,
      rb: s.rb,
      blend: 0.003,
      flatten: { axis: s.dorsal, factor: squash },
    });
    // The joint at the end of the bone (not past the tip).
    if (!last)
      shapes.push({
        kind: 'ellipsoid',
        center: add(s.b, mul(s.dorsal, s.rb * 0.08)),
        radii: [s.rb * 1.01, s.rb * 1.0, s.rb * 0.86 * squash],
        axes: [s.lateral, s.dir, s.dorsal],
        blend: 0.004,
      });
    // The pad of flesh on the palm side of the bone.
    const padAt = last ? 0.62 : 0.5;
    const r = s.ra + (s.rb - s.ra) * padAt;
    shapes.push({
      kind: 'ellipsoid',
      center: add(add(s.a, mul(s.dir, length * padAt)), mul(s.dorsal, -r * (last ? 0.26 : 0.26))),
      radii: [r * (last ? 0.88 : 0.84), length * (last ? 0.6 : 0.46), r * (last ? 0.72 : 0.6)],
      axes: [s.lateral, s.dir, s.dorsal],
      blend: last ? 0.004 : 0.005,
    });
  });
  return shapes;
}

/** The palm, the wrist and the forearm. */
function palmShapes(digits: Digit[], options: Required<ZhudaHandOptions>): ZhudaSdfShape[] {
  const sx = options.breadth / 0.082,
    sy = options.length / 0.185;
  const S = (p: V): V => [p[0] * sx, p[1] * sy, p[2] * sx];
  const shapes: ZhudaSdfShape[] = [];
  // Forearm into the wrist: an oval, wider than deep.
  shapes.push({
    kind: 'roundCone',
    a: S([0.001, -options.forearm / sy, 0.001]),
    b: S([0.0, 0.004, 0.0]),
    ra: 0.0285 * sx,
    rb: 0.0265 * sx,
    flatten: { axis: [0, 0, 1], factor: 0.66 },
  });
  // The wrist's bones, a flat block.
  shapes.push({
    kind: 'ellipsoid',
    center: S([0.002, 0.02, 0.001]),
    radii: [0.029 * sx, 0.024 * sy, 0.0145 * sx],
    blend: 0.012,
  });
  // The palm's bones with their flesh: a ray from the wrist to each knuckle, joined into a plate.
  for (const name of ZHUDA_HAND_FINGERS) {
    const f = FINGER[name];
    const knuckle = digits.find((d) => d.name === name)!.joints[0];
    shapes.push({
      kind: 'roundCone',
      a: S(f.base),
      b: knuckle,
      ra: 0.0105 * sx,
      rb: f.radii[0] * sx * 1.02,
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
      center: add(head, [0, 0, 0.0035 * sx]),
      radii: [FINGER[name].radii[0] * sx * 0.78, 0.008 * sy, 0.0055 * sx],
      axes: [d.segments[0].lateral, d.segments[0].dir, d.segments[0].dorsal],
      blend: 0.007,
    });
  }
  // The pad under the knuckles, along their curve.
  shapes.push({
    kind: 'ellipsoid',
    center: S([0.001, 0.08, -0.0068]),
    radii: [0.032 * sx, 0.013 * sy, 0.0072 * sx],
    axes: [unit([1, -0.2, 0]), unit([0.2, 1, 0]), [0, 0, 1]],
    blend: 0.01,
  });
  // The ball of the thumb and the heel of the hand on the little finger's side.
  shapes.push({
    kind: 'ellipsoid',
    center: S([-0.0185, 0.033, -0.0115]),
    radii: [0.017 * sx, 0.031 * sy, 0.0138 * sx],
    axes: [unit([0.92, 0.39, 0]), unit([-0.39, 0.92, 0]), [0, 0, 1]],
    blend: 0.012,
  });
  shapes.push({
    kind: 'ellipsoid',
    center: S([0.021, 0.04, -0.0078]),
    radii: [0.0115 * sx, 0.031 * sy, 0.0102 * sx],
    axes: [unit([1, 0.12, 0]), unit([-0.12, 1, 0]), [0, 0, 1]],
    blend: 0.012,
  });
  // The hollow in the middle of the palm.
  shapes.push({
    kind: 'ellipsoid',
    center: S([0.003, 0.054, -0.0258]),
    radii: [0.015 * sx, 0.02 * sy, 0.0065 * sx],
    blend: 0.02,
    subtract: true,
  });
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

/** A nail on the end bone of a digit, seated on the skin: a curved plate with a rounded free edge. */
function nailField(field: ZhudaSdfField, d: Digit) {
  const s = d.segments[2];
  const L = Math.hypot(...sub(s.b, s.a));
  const r = s.rb;
  const thumb = d.name === 'thumb';
  // Along the bone from the end joint: from the cuticle to the free edge, just short of the tip.
  const u0 = L * (thumb ? 0.12 : 0.18),
    u1 = L + r * (thumb ? 0.62 : 0.6);
  const halfWidth = r * (thumb ? 0.78 : 0.74);
  const bend = r * (thumb ? 1.25 : 1.05); // how curved it is across
  const thick = 0.0006;
  const heightAt = (u: number) => surfaceAlong(field, add(s.a, mul(s.dir, u)), s.dorsal, r * 2.5);
  // The skin's height along the bone, sampled; past the flesh's end the nail runs on straight.
  const uEnd = L + r * 0.35;
  const samples = 24;
  const heights = Array.from({ length: samples + 1 }, (_, i) =>
    heightAt(u0 + ((uEnd - u0) * i) / samples),
  );
  const endSlope = (heights[samples] - heights[samples - 2]) / ((2 * (uEnd - u0)) / samples);
  const skinAt = (u: number) => {
    if (u >= uEnd) return heights[samples] + Math.max(endSlope, -0.35) * (u - uEnd) * 0.5;
    const f = (Math.max(u, u0) - u0) / ((uEnd - u0) / samples);
    const i = Math.min(Math.floor(f), samples - 1);
    return heights[i] + (heights[i + 1] - heights[i]) * (f - i);
  };
  // The plate's axis: under the skin's top by its curvature; sunk under the fold at the cuticle.
  const axisAt = (u: number) =>
    skinAt(u) - bend + thick * 0.5 + 0.00015 - 0.0006 * (1 - smooth(u0, u0 + 0.002, u));
  const corner = halfWidth * 0.7;
  const distance = (x: number, y: number, z: number) => {
    const p = sub([x, y, z], s.a);
    const u = dot(p, s.dir),
      lat = dot(p, s.lateral),
      up = dot(p, s.dorsal) - axisAt(u);
    const radial = Math.hypot(lat, up);
    const shell = Math.abs(radial - bend) - thick * 0.5;
    // Across the plate as an arc length; the outline is a rectangle with round ends.
    const across = bend * Math.atan2(lat, up);
    const cu = (u0 + u1) / 2,
      hu = (u1 - u0) / 2;
    const qx = Math.abs(across) - (halfWidth - corner),
      qy = Math.abs(u - cu) - (hu - corner);
    const outline =
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - corner;
    // The plate's rim rounded over its thickness, not a knife edge.
    const rr = thick * 0.45;
    const a = shell + rr,
      b = outline + rr;
    return Math.hypot(Math.max(a, 0), Math.max(b, 0)) + Math.min(Math.max(a, b), 0) - rr;
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
  return { distance, min, max, s, u0, u1 };
}

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
function creases(body: ZhudaSdfField, digits: Digit[], o: Required<ZhudaHandOptions>): Crease[] {
  const sx = o.breadth / 0.082,
    sy = o.length / 0.185;
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
      arc(at(0, L0 * 0.4), axisAt(0), palmar(0), 60, 0.0022, 0.00045, 0.55);
      arc(at(1, -0.0011 * sy), axisAt(1), palmar(1), 70, 0.0018, 0.00042, 0.55);
      arc(at(1, 0.0011 * sy), axisAt(1), palmar(1), 62, 0.0016, 0.00035, 0.45);
      arc(at(2, 0.0005 * sy), axisAt(2), palmar(2), 68, 0.0016, 0.00035, 0.45);
      // Faint wrinkles over the back of the middle joint, shorter toward the ends.
      [
        [-0.0024, 22],
        [-0.0006, 30],
        [0.0013, 26],
      ].forEach(([u, spread]) =>
        arc(at(1, u * sy), axisAt(1), d.segments[1].dorsal, spread, 0.0012, 0.00014, 0.22, 8),
      );
    } else {
      arc(at(1, -0.0008 * sy), axisAt(1), palmar(1), 62, 0.002, 0.00045, 0.55);
      arc(at(1, 0.0013 * sy), axisAt(1), palmar(1), 56, 0.0016, 0.00035, 0.45);
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
      [-0.027, 0.07],
      [-0.017, 0.066],
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
      [-0.026, 0.0705],
      [-0.0175, 0.062],
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
function tendonShapes(
  trunk: ZhudaSdfField,
  digits: Digit[],
  o: Required<ZhudaHandOptions>,
): ZhudaSdfShape[] {
  const sx = o.breadth / 0.082,
    sy = o.length / 0.185;
  const shapes: ZhudaSdfShape[] = [];
  const skinAbove = (p: V): V => {
    const inside: V = [p[0], p[1], 0];
    return add(inside, [0, 0, surfaceAlong(trunk, inside, [0, 0, 1], 0.04)]);
  };
  for (const name of ZHUDA_HAND_FINGERS) {
    const d = digits.find((x) => x.name === name)!;
    const r = 0.0019 * sx * (name === 'little' ? 0.8 : 1);
    const start = sub(d.joints[0], mul(d.segments[0].dir, 0.009 * sy));
    const end: V = [start[0] * 0.3 + 0.002 * sx, 0.014 * sy, 0];
    // Raised 0.45 mm behind the knuckle, under the skin by its own thickness at the wrist.
    const a = add(skinAbove(start), [0, 0, -r + 0.00045 * sx]);
    const b = add(skinAbove(end), [0, 0, -r * 1.6]);
    shapes.push({ kind: 'roundCone', a, b, ra: r, rb: r * 0.8, blend: 0.006 });
  }
  return shapes;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toDisplay = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** Makes the hand. Throws with every problem `validateZhudaHand` finds. */
export function createZhudaHandMesh(options: ZhudaHandOptions = {}): ZhudaHandMesh {
  const errors = validateZhudaHand(options);
  if (errors.length) throw Error(`Invalid hand: ${errors.join('; ')}`);
  const o: Required<ZhudaHandOptions> = {
    side: options.side ?? 'right',
    length: options.length ?? 0.185,
    breadth: options.breadth ?? 0.082,
    pose: options.pose ?? {},
    tone: options.tone ?? [0.86, 0.66, 0.56],
    cellSize: options.cellSize ?? 0.0009,
    forearm: options.forearm ?? 0.05,
  };
  const pose = { ...ZHUDA_HAND_RELAXED, ...o.pose } as Required<ZhudaHandPose>;
  const sx = o.breadth / 0.082;
  const digits = poseDigits(o, pose);
  const plain = createZhudaSdfField([...palmShapes(digits, o), ...webShapes(digits, sx)]);
  const trunk = createZhudaSdfField([
    ...palmShapes(digits, o),
    ...webShapes(digits, sx),
    ...tendonShapes(plain, digits, o),
  ]);
  const limbs = digits.map((d) => ({
    field: createZhudaSdfField(digitShapes(d)),
    blend: d.name === 'thumb' ? 0.012 : 0.0085,
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
  const distance = (x: number, y: number, z: number) => body.distance(x * m, y, z);
  const bmin = mirror(body.bounds.min),
    bmax = mirror(body.bounds.max);
  const min: V = [Math.min(bmin[0], bmax[0]), body.bounds.min[1], body.bounds.min[2]];
  const max: V = [Math.max(bmin[0], bmax[0]), body.bounds.max[1], body.bounds.max[2]];
  // The forearm is cut where it leaves the box: the mesh is closed at its end by a plane.
  const cut = -o.forearm + 0.004;
  const closed = (x: number, y: number, z: number) => Math.max(distance(x, y, z), cut - y);
  min[1] = Math.max(min[1], cut - 0.004);

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
      // On a digit, its own palm side; elsewhere the palm's.
      let palmSide = palmNormalDot(nq);
      let flushAmount = 0;
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
        palmSide = -dot(nq, d.segments[best].dorsal);
        // Warmer over the joints on the back and at the tips.
        const atJoint =
          best < 2 ? smooth(0.78, 1, bestU) : best === 2 ? 1 - smooth(0, 0.15, bestU) : 0;
        const top = Math.max(-palmSide, 0) ** 3;
        const tip = best === 2 ? smooth(0.5, 1, bestU) * smooth(-0.2, 0.6, palmSide) : 0;
        flushAmount = Math.max(atJoint * 0.35 * top, tip * 0.45);
      } else {
        // The knuckles at the end of the palm's bones.
        flushAmount =
          smooth(0.07 * (o.length / 0.185), 0.095 * (o.length / 0.185), q[1]) *
          0.35 *
          Math.max(-palmNormalDot(nq), 0);
      }
      const palm = smooth(-0.1, 0.5, palmSide);
      let c = mix(tone, palmTone, palm);
      // The palm side is paler and pinker; its pads redder.
      c = mix(c, [c[0] * 1.02, c[1] * 0.9, c[2] * 0.9], palm * 0.6);
      c = mix(c, flush, flushAmount * 0.6);
      // Darker and a little redder in the bottom of a crease.
      const crease = creaseAt(q);
      c = mix(c, [c[0] * 0.8, c[1] * 0.68, c[2] * 0.66], crease);
      const depth = zhudaSdfDepthAlong(distance, sub(p, mul(n, 0.0004)), mul(n, -1), 0.06);
      const thin = Math.exp(-depth / 0.016);
      return [toDisplay(c[0]), toDisplay(c[1]), toDisplay(c[2]), thin];
    },
  });

  // Nails: each seated on the skin as it is, meshed finer than the skin.
  const parts: MeshData[] = [];
  for (const d of digits) {
    const nail = nailField(body, d);
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
          // Pink over the bed, a pale half-moon at the cuticle, white where it leaves the finger.
          const free = smooth(nail.u1 - 0.0019, nail.u1 - 0.0011, u);
          const moon = 1 - smooth(nail.u0 + 0.0008, nail.u0 + 0.0028, u);
          let c = mix([0.9, 0.6, 0.6], [0.93, 0.8, 0.78], moon * 0.7);
          c = mix(c, [0.96, 0.93, 0.89], free);
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
