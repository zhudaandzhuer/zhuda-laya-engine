/**
 * Bones bent to reach a point, after the animation has posed them: a foot
 * set on sloping ground, a hand on a rail, a head turned to what it looks
 * at. Three solvers, each plain arithmetic on points (so each can be
 * checked without a runtime), and one class a solver that applies it to
 * LayaAir nodes:
 *
 * - two bones (hip, knee, foot): the exact answer, with a pole the knee
 *   bends toward;
 * - a chain of any length (FABRIK): reached by steps, the root fixed;
 * - an aim: a bone turned to point at something, by at most an angle.
 *
 * Each is blended with the animated pose by a weight, 0..1. They change
 * world rotations only; bone lengths are never changed.
 */
/** A point or a direction in the world: x, y, z. */
export type ZhudaIkPoint = readonly [number, number, number];
/** A turn as a quaternion: x, y, z, w. */
export type ZhudaIkTurn = readonly [number, number, number, number];

const sub = (a: ZhudaIkPoint, b: ZhudaIkPoint): [number, number, number] => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const add = (a: ZhudaIkPoint, b: ZhudaIkPoint): [number, number, number] => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
const scale = (a: ZhudaIkPoint, s: number): [number, number, number] => [
  a[0] * s,
  a[1] * s,
  a[2] * s,
];
const dot = (a: ZhudaIkPoint, b: ZhudaIkPoint) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: ZhudaIkPoint, b: ZhudaIkPoint): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: ZhudaIkPoint) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: ZhudaIkPoint): [number, number, number] => {
  const l = length(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
};
const finite3 = (v: unknown): v is ZhudaIkPoint =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
/** Any direction square to `v`. */
const square = (v: ZhudaIkPoint): [number, number, number] =>
  unit(cross(v, Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));

/** `a * b`: the turn `b`, then the turn `a`. */
export function zhudaQuatMultiply(
  a: ZhudaIkTurn,
  b: ZhudaIkTurn,
): [number, number, number, number] {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
/** A direction turned by a quaternion. */
export function zhudaQuatRotate(q: ZhudaIkTurn, v: ZhudaIkPoint): [number, number, number] {
  const u: ZhudaIkPoint = [q[0], q[1], q[2]];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q[3])), cross(u, t));
}
/** The shortest turn that takes direction `from` to direction `to` (neither need be a unit). */
export function zhudaQuatFromTo(
  from: ZhudaIkPoint,
  to: ZhudaIkPoint,
): [number, number, number, number] {
  const a = unit(from),
    b = unit(to);
  const d = dot(a, b);
  if (d > 1 - 1e-10) return [0, 0, 0, 1];
  if (d < -1 + 1e-10) {
    // Opposite: half a turn about anything square to them.
    const axis = square(a);
    return [axis[0], axis[1], axis[2], 0];
  }
  const axis = cross(a, b);
  const q: [number, number, number, number] = [axis[0], axis[1], axis[2], 1 + d];
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
/** Part of a turn: `weight` 0 is no turn, 1 the whole of it. */
export function zhudaQuatScale(q: ZhudaIkTurn, weight: number): [number, number, number, number] {
  const w = Math.min(1, Math.max(0, weight));
  // Toward the turn the short way round.
  const sign = q[3] < 0 ? -1 : 1;
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q[3]))) * w;
  const s = Math.hypot(q[0], q[1], q[2]);
  if (s < 1e-12) return [0, 0, 0, 1];
  const k = (Math.sin(angle / 2) / s) * sign;
  return [q[0] * k, q[1] * k, q[2] * k, Math.cos(angle / 2)];
}

export interface ZhudaTwoBoneSolution {
  /** Where the middle joint goes. */
  mid: [number, number, number];
  /** Where the end goes: the target, or as near as the bones reach. */
  end: [number, number, number];
  /** False when the target is further than the two bones are long, or nearer than their difference. */
  reached: boolean;
  /** The turn of the first bone, in the world: its new rotation is this times its old one. */
  rootTurn: [number, number, number, number];
  /** The turn of the second bone, in the world, after it has gone with the first. */
  midTurn: [number, number, number, number];
}

/**
 * Two bones, `root` to `mid` to `end`, bent so that `end` is at `target`.
 * The middle joint bends toward `pole` (a point; default: the way it is
 * bent now, so an animated knee keeps its side). Bone lengths are kept: a
 * target out of reach is pointed at with the bones almost straight.
 */
export function zhudaSolveTwoBone(
  root: ZhudaIkPoint,
  mid: ZhudaIkPoint,
  end: ZhudaIkPoint,
  target: ZhudaIkPoint,
  pole?: ZhudaIkPoint,
): ZhudaTwoBoneSolution {
  for (const [name, v] of Object.entries({ root, mid, end, target }))
    if (!finite3(v)) throw Error(`Two-bone IK: ${name} must be three finite numbers`);
  if (pole !== undefined && !finite3(pole))
    throw Error('Two-bone IK: pole must be three finite numbers');
  const upper = length(sub(mid, root)),
    lower = length(sub(end, mid));
  if (!(upper > 1e-9 && lower > 1e-9)) throw Error('Two-bone IK: the bones have no length');
  const toTarget = sub(target, root);
  const wanted = length(toTarget);
  // Never quite straight and never folded flat: the bend keeps a side.
  const longest = (upper + lower) * 0.9999,
    shortest = Math.abs(upper - lower) * 1.0001 + 1e-9;
  const distance = Math.min(longest, Math.max(shortest, wanted));
  const reached = wanted <= longest && wanted >= shortest;
  const along = wanted > 1e-9 ? unit(toTarget) : unit(sub(end, root));
  // The side the middle joint is on: toward the pole, else where it is now, square to the line to the target.
  const reference = sub(pole ?? mid, root);
  let side = sub(reference, scale(along, dot(reference, along)));
  if (length(side) < 1e-6) side = sub(sub(mid, root), scale(along, dot(sub(mid, root), along)));
  const bend = length(side) < 1e-6 ? square(along) : unit(side);
  // The law of cosines gives the angle at the root.
  const cosine = Math.min(
    1,
    Math.max(-1, (upper * upper + distance * distance - lower * lower) / (2 * upper * distance)),
  );
  const sine = Math.sqrt(1 - cosine * cosine);
  const newMid = add(root, add(scale(along, upper * cosine), scale(bend, upper * sine)));
  const newEnd = add(root, scale(along, distance));
  const rootTurn = zhudaQuatFromTo(sub(mid, root), sub(newMid, root));
  // Where the second bone points once it has gone with the first.
  const carried = zhudaQuatRotate(rootTurn, sub(end, mid));
  const midTurn = zhudaQuatFromTo(carried, sub(newEnd, newMid));
  return { mid: newMid, end: newEnd, reached, rootTurn, midTurn };
}

/**
 * A chain of joints reaching for `target` with its first joint fixed
 * (FABRIK): from the end back and from the root forward, until the end is
 * within `tolerance` or `iterations` are used up. Lengths are kept. Returns
 * the joints' new places; the input is not changed.
 */
export function zhudaSolveChain(
  joints: readonly ZhudaIkPoint[],
  target: ZhudaIkPoint,
  iterations = 12,
  tolerance = 1e-4,
): { joints: [number, number, number][]; reached: boolean; error: number } {
  if (!Array.isArray(joints) || joints.length < 2 || joints.length > 64 || !joints.every(finite3))
    throw Error('Chain IK: 2..64 joints of three finite numbers');
  if (!finite3(target)) throw Error('Chain IK: target must be three finite numbers');
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 200)
    throw Error('Chain IK: iterations 1..200');
  if (!(tolerance > 0)) throw Error('Chain IK: tolerance above 0');
  const points = joints.map((joint) => [...joint] as [number, number, number]);
  const lengths = points.slice(1).map((point, i) => length(sub(point, points[i])));
  if (lengths.some((l) => !(l > 1e-9))) throw Error('Chain IK: a bone has no length');
  const root = [...points[0]] as [number, number, number];
  const total = lengths.reduce((sum, l) => sum + l, 0);
  const last = points.length - 1;
  if (length(sub(target, root)) >= total) {
    // Out of reach: a straight line toward it.
    const along = unit(sub(target, root));
    for (let i = 1; i <= last; i++) points[i] = add(points[i - 1], scale(along, lengths[i - 1]));
    return { joints: points, reached: false, error: length(sub(target, points[last])) };
  }
  let error = length(sub(target, points[last]));
  for (let pass = 0; pass < iterations && error > tolerance; pass++) {
    points[last] = [...target] as [number, number, number];
    for (let i = last - 1; i >= 0; i--) {
      const way = unit(sub(points[i], points[i + 1]));
      points[i] = add(points[i + 1], scale(length(way) ? way : [0, 1, 0], lengths[i]));
    }
    points[0] = [...root] as [number, number, number];
    for (let i = 1; i <= last; i++) {
      const way = unit(sub(points[i], points[i - 1]));
      points[i] = add(points[i - 1], scale(length(way) ? way : [0, 1, 0], lengths[i - 1]));
    }
    error = length(sub(target, points[last]));
  }
  return { joints: points, reached: error <= tolerance, error };
}

/**
 * The turn that points a bone at something: `forward` is the way the bone
 * faces now, in the world; `from` where it is; `target` what it should face.
 * The turn is at most `maxDeg` (default 180) and `weight` of the way.
 */
export function zhudaAimTurn(
  forward: ZhudaIkPoint,
  from: ZhudaIkPoint,
  target: ZhudaIkPoint,
  maxDeg = 180,
  weight = 1,
): [number, number, number, number] {
  if (!finite3(forward) || !finite3(from) || !finite3(target))
    throw Error('Aim: forward, from and target must be three finite numbers');
  if (!(maxDeg >= 0 && maxDeg <= 180)) throw Error('Aim: maxDeg 0..180');
  if (!(weight >= 0 && weight <= 1)) throw Error('Aim: weight 0..1');
  const way = sub(target, from);
  if (length(way) < 1e-9 || length(forward) < 1e-9) return [0, 0, 0, 1];
  const whole = zhudaQuatFromTo(forward, way);
  const angle = (2 * Math.acos(Math.min(1, Math.abs(whole[3]))) * 180) / Math.PI;
  const share = angle > maxDeg ? maxDeg / angle : 1;
  return zhudaQuatScale(whole, share * weight);
}

const runtime = () => (globalThis as any).Laya;
const place = (node: any): [number, number, number] => {
  const p = node.transform.position;
  return [p.x, p.y, p.z];
};
/** Turns a node in the world: its new rotation is `turn` times the one it has. */
function turnNode(node: any, turn: ZhudaIkTurn) {
  const l = runtime();
  const now = node.transform.rotation;
  const next = zhudaQuatMultiply(turn, [now.x, now.y, now.z, now.w]);
  const length = Math.hypot(next[0], next[1], next[2], next[3]) || 1;
  node.transform.rotation = new l.Quaternion(
    next[0] / length,
    next[1] / length,
    next[2] / length,
    next[3] / length,
  );
}
const live = (nodes: any[], what: string) => {
  for (const node of nodes)
    if (!node?.transform || node.destroyed)
      throw Error(`${what}: live nodes with a transform are expected`);
};
const mix = (a: ZhudaIkPoint, b: ZhudaIkPoint, t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * A limb of two bones on LayaAir nodes: `root` (a hip), `mid` (a knee,
 * below `root`) and `end` (a foot, below `mid`). Call `solve` after the
 * animation has posed the frame; the next frame's animation starts from
 * its own pose again.
 */
export class ZhudaTwoBoneIK {
  private readonly nodes: [any, any, any];
  constructor(root: any, mid: any, end: any) {
    live([root, mid, end], 'Two-bone IK');
    this.nodes = [root, mid, end];
  }
  /**
   * Bends the limb so its end is at `target` (world). `pole`: a world point
   * the middle joint bends toward. `weight` 0..1: how far from the animated
   * pose toward the target (default 1). Returns whether the target was
   * within reach and where the end went.
   */
  solve(
    target: ZhudaIkPoint,
    options: { pole?: ZhudaIkPoint; weight?: number } = {},
  ): { reached: boolean; end: [number, number, number] } {
    const [root, mid, end] = this.nodes;
    live(this.nodes, 'Two-bone IK');
    const weight = options.weight ?? 1;
    if (!(weight >= 0 && weight <= 1)) throw Error('Two-bone IK: weight 0..1');
    const from = place(end);
    if (weight === 0) return { reached: true, end: from };
    const solved = zhudaSolveTwoBone(
      place(root),
      place(mid),
      from,
      mix(from, target, weight),
      options.pole,
    );
    turnNode(root, solved.rootTurn);
    turnNode(mid, solved.midTurn);
    return { reached: solved.reached, end: solved.end };
  }
}

/** A chain of nodes, each below the one before, reaching for a point with the first fixed. */
export class ZhudaChainIK {
  private readonly nodes: any[];
  constructor(nodes: readonly any[]) {
    if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > 64)
      throw Error('Chain IK: 2..64 nodes');
    live([...nodes], 'Chain IK');
    this.nodes = [...nodes];
  }
  solve(
    target: ZhudaIkPoint,
    options: { weight?: number; iterations?: number; tolerance?: number } = {},
  ): { reached: boolean; error: number } {
    live(this.nodes, 'Chain IK');
    const weight = options.weight ?? 1;
    if (!(weight >= 0 && weight <= 1)) throw Error('Chain IK: weight 0..1');
    const joints = this.nodes.map(place);
    if (weight === 0) return { reached: true, error: 0 };
    const solved = zhudaSolveChain(
      joints,
      mix(joints[joints.length - 1], target, weight),
      options.iterations,
      options.tolerance,
    );
    // Root first: each bone is turned onto its new line after its parents have moved it.
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const here = place(this.nodes[i]),
        next = place(this.nodes[i + 1]);
      turnNode(
        this.nodes[i],
        zhudaQuatFromTo(sub(next, here), sub(solved.joints[i + 1], solved.joints[i])),
      );
    }
    return { reached: solved.reached, error: solved.error };
  }
}

/** A node turned to face a point: a head, an eye, a turret. */
export class ZhudaAimIK {
  private readonly node: any;
  private readonly forward: ZhudaIkPoint;
  /** @param forward the way the node faces, in its own space (default -Z, LayaAir's forward). */
  constructor(node: any, forward: ZhudaIkPoint = [0, 0, -1]) {
    live([node], 'Aim');
    if (!finite3(forward) || length(forward) < 1e-9)
      throw Error('Aim: forward must be a direction');
    this.node = node;
    this.forward = [...forward] as [number, number, number];
  }
  /** Turns the node toward `target` (world), by at most `maxDeg` from the animated pose and `weight` of the way. */
  solve(target: ZhudaIkPoint, options: { maxDeg?: number; weight?: number } = {}): void {
    live([this.node], 'Aim');
    const now = this.node.transform.rotation;
    const facing = zhudaQuatRotate([now.x, now.y, now.z, now.w], this.forward);
    turnNode(
      this.node,
      zhudaAimTurn(facing, place(this.node), target, options.maxDeg ?? 180, options.weight ?? 1),
    );
  }
}

/**
 * Calls `solve` every frame once LayaAir's own animation has posed the
 * scene and before the skin is worked out: the place for a solver while a
 * clip plays by itself. LayaAir poses the bones again every frame, after
 * scripts' `onUpdate` and `onLateUpdate` (a solve made there is undone),
 * and works out the skin before `onPreRender` (a solve made there moves
 * the bones but not the mesh). Returns a function that stops it; it also
 * stops when `node` is destroyed. With `ZhudaModelAnimationSampler` or
 * `ZhudaAnimationBlend` posing the model, solve right after them instead.
 */
export function runZhudaAfterAnimation(node: any, solve: () => void): () => void {
  const l = runtime();
  if (!l?.Script || !node || typeof node.addComponent !== 'function' || node.destroyed)
    throw Error('After animation: a live node is expected');
  if (typeof solve !== 'function') throw Error('After animation: a function is expected');
  const Hook = class extends l.Script {
    onAfterSceneUpdate() {
      solve();
    }
  };
  const hook = node.addComponent(Hook);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (!hook.destroyed) hook.destroy();
  };
}
