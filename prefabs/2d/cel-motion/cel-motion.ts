/**
 * Key-pose + baked in-between "cel" motion for a side-view figure painted as an atlas
 * of eight key poses (no skeleton, no Spine). Pure logic: no engine, runs in node.
 *
 * - A `Frame` is one key pose cut from the atlas: its box, the planted-foot origin and
 *   ten joint pins (the pin layout below). Joints are measured in atlas pixels.
 * - A `Pose` is "between key a and key b at t"; `poseAt()` walks a key table (time →
 *   key) with tangents that keep the wrist, body and blade moving through
 *   intermediate keys; `pin()` gives a joint relative to the feet.
 * - `PoseTrack` makes an interrupted pose travel along the registered in-between strips
 *   (`CelSheet.edges`, baked offline) instead of cross-fading, so the texture and the
 *   joints reach a shared key before entering the next strip.
 * - `Footwork` advances the stride by the distance actually travelled: boots plant,
 *   lift and alternate; knees, belt, elbow and hem follow the weight.
 *
 * Extracted from 「灰燼之庭」(games/ashfall-duel, author CCW): motion.ts, transitions.ts
 * and footwork.ts. Numbers and the order of every operation are unchanged.
 */

export type Point = { x: number; y: number };
export type Pair = readonly [number, number];
export type Rect = readonly [number, number, number, number];
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** The ten pins every frame carries, in this order. Footwork moves them by index. */
export const PIN = {
  helmet: 0,
  chest: 1,
  hand: 2,
  leadBoot: 3,
  rearBoot: 4,
  belt: 5,
  leadKnee: 6,
  rearKnee: 7,
  elbow: 8,
  hem: 9,
} as const;

export interface Frame {
  box: Rect;
  origin: Pair;
  // Helmet, breastplate, weapon hand, lead boot, rear boot, belt, knees, elbow, cloth hem.
  pins: readonly Pair[];
}

/** One key pose: atlas pixel edges, a distinct planted-foot origin (prevents frame jitter), ten pins. */
export function frame(box: Rect, origin: Pair, ...pins: Pair[]): Frame {
  return { box, origin, pins };
}

export interface Pose {
  a: number;
  b: number;
  t: number;
  joints?: Point[];
}
export const fixed = (index: number): Pose => ({ a: index, b: index, t: 0 });
/** [time 0..1, key index]. */
export type Key = readonly [number, number];

function segmentAt(keys: readonly Key[], time: number): number {
  let end = 1;
  while (end < keys.length - 1 && time > keys[end][0]) end++;
  return end;
}

function tangent(left: number, right: number): number {
  return left * right <= 0 ? 0 : (2 * left * right) / (left + right);
}

// The wrist, body and blade keep their velocity through intermediate keys and settle at a reversal.
function interpolate(
  keys: readonly Key[],
  end: number,
  t: number,
  value: (key: number) => number
): number {
  const start = end - 1,
    length = keys[end][0] - keys[start][0];
  const a = value(keys[start][1]),
    b = value(keys[end][1]);
  const slope = (b - a) / length;
  const left =
    start === 0
      ? 0
      : tangent(
          slope,
          (a - value(keys[start - 1][1])) /
            (keys[start][0] - keys[start - 1][0])
        );
  const right =
    end === keys.length - 1
      ? 0
      : tangent(
          slope,
          (value(keys[end + 1][1]) - b) / (keys[end + 1][0] - keys[end][0])
        );
  return (
    mix(a, b, smooth(t)) + length * t * (1 - t) * ((1 - t) * left - t * right)
  );
}

/** The pose at `time` (0..1) along a key table; with `frames`, also the interpolated joints. */
export function poseAt(
  keys: readonly Key[],
  time: number,
  frames?: readonly Frame[],
  scale = 1
): Pose {
  const end = segmentAt(keys, time);
  const [start, a] = keys[end - 1],
    [finish, b] = keys[end];
  const t = clamp((time - start) / (finish - start), 0, 1);
  const pose: Pose = { a, b, t: smooth(t) };
  if (frames) {
    pose.joints = frames[a].pins.map((_, joint) => {
      const axis = (d: 0 | 1) =>
        scale *
        interpolate(
          keys,
          end,
          t,
          (index) => frames[index].pins[joint][d] - frames[index].origin[d]
        );
      return { x: axis(0), y: axis(1) };
    });
  }
  return pose;
}

/** A scalar along a [time, value] table with the same tangents as poseAt (e.g. a sword angle). */
export function curve(keys: readonly Key[], time: number): number {
  const end = segmentAt(keys, time);
  const start = keys[end - 1][0];
  return interpolate(
    keys,
    end,
    clamp((time - start) / (keys[end][0] - start), 0, 1),
    (v) => v
  );
}

/** Joint `index` of `pose`, relative to the planted foot, at `scale`. */
export function pin(
  frames: readonly Frame[],
  pose: Pose,
  index: number,
  scale: number
): Point {
  if (pose.joints) return pose.joints[index];
  const a = frames[pose.a],
    b = frames[pose.b];
  return {
    x:
      scale *
      mix(
        a.pins[index][0] - a.origin[0],
        b.pins[index][0] - b.origin[0],
        pose.t
      ),
    y:
      scale *
      mix(
        a.pins[index][1] - a.origin[1],
        b.pins[index][1] - b.origin[1],
        pose.t
      ),
  };
}

/**
 * One baked in-between: [page, x, y, w, h, pivotX, pivotY] — the atlas page index, the
 * tile's box on that page and the planted-foot pivot inside the tile.
 */
export type Cel = readonly number[];
/** The in-betweens of one figure: page URLs (relative to the asset base) and "a-b" → cels from key a to key b. */
export interface CelSheet {
  pages: readonly string[];
  edges: Readonly<Record<string, readonly Cel[]>>;
}

type Edge = Pick<Pose, "a" | "b" | "t">;
interface Segment {
  a: number;
  b: number;
  from: number;
  to: number;
  size: number;
}

function canonical(p: Edge): Edge {
  if (p.t <= 0.00001 || p.a === p.b) return fixed(p.a);
  if (p.t >= 0.99999) return fixed(p.b);
  return p.a < p.b
    ? { a: p.a, b: p.b, t: p.t }
    : { a: p.b, b: p.a, t: 1 - p.t };
}

// Interrupted poses keep travelling on the actual registered strips. Both the
// texture and its joints reach the common key before entering the next strip.
export class PoseTrack {
  private readonly lengths: number[][];
  private readonly distances: number[][];
  private readonly next: number[][];
  private cursor: Edge = fixed(0);
  private group = "";
  private previous?: Pose;
  private departure?: Pose;
  private elapsed = 0;

  /** `edges`: the figure's baked strips (CelSheet.edges); only these key pairs can be shown. */
  constructor(
    frames: readonly Frame[],
    edges: CelSheet["edges"],
    scale: number
  ) {
    this.frames = frames;
    this.scale = scale;
    const size = frames.length;
    this.lengths = Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) => (i === j ? 0 : Infinity))
    );
    this.next = this.lengths.map((row) => row.map((_, j) => j));
    for (const [key, tiles] of Object.entries(edges)) {
      const [a, b] = key.split("-").map(Number);
      this.lengths[a][b] = this.lengths[b][a] = tiles.length + 1;
    }
    this.distances = this.lengths.map((row) => [...row]);
    for (let k = 0; k < size; k++)
      for (let i = 0; i < size; i++)
        for (let j = 0; j < size; j++) {
          const via = this.distances[i][k] + this.distances[k][j];
          if (via < this.distances[i][j]) {
            this.distances[i][j] = via;
            this.next[i][j] = this.next[i][k];
          }
        }
  }
  private frames: readonly Frame[];
  private scale: number;

  reset(): void {
    this.group = "";
    this.previous = this.departure = undefined;
    this.cursor = fixed(0);
  }

  private move(goal: Edge, budget: number): Edge {
    const cur = this.cursor;
    if (cur.a === goal.a && cur.b === goal.b) {
      const distance = this.lengths[cur.a][cur.b] * Math.abs(cur.t - goal.t);
      return distance <= budget
        ? goal
        : canonical({
            a: cur.a,
            b: cur.b,
            t: mix(cur.t, goal.t, budget / distance),
          });
    }
    const segments: Segment[] = [];
    const add = (a: number, b: number, from: number, to: number) => {
      const size = this.lengths[a][b] * Math.abs(to - from);
      if (size > 0) segments.push({ a, b, from, to, size });
    };
    {
      let best = Infinity,
        start = cur.a,
        finish = goal.a;
      for (const [s, t] of [
        [cur.a, 0],
        [cur.b, 1],
      ])
        for (const [f, u] of [
          [goal.a, 0],
          [goal.b, 1],
        ]) {
          const cost =
            Math.abs(t - cur.t) * this.lengths[cur.a][cur.b] +
            this.distances[s][f] +
            Math.abs(goal.t - u) * this.lengths[goal.a][goal.b];
          if (cost < best) {
            best = cost;
            start = s;
            finish = f;
          }
        }
      add(cur.a, cur.b, cur.t, start === cur.a ? 0 : 1);
      for (let at = start; at !== finish; ) {
        const to = this.next[at][finish];
        add(at, to, 0, 1);
        at = to;
      }
      add(goal.a, goal.b, finish === goal.a ? 0 : 1, goal.t);
    }
    for (const s of segments) {
      if (s.size > budget)
        return canonical({
          a: s.a,
          b: s.b,
          t: mix(s.from, s.to, budget / s.size),
        });
      budget -= s.size;
    }
    return goal;
  }

  /**
   * The pose to show this step. `group` names the action (a new name starts a 0.105 s
   * hand-over from the previous joints); `target` is where the action wants the figure.
   */
  sample(group: string, target: Pose, dt: number): Pose {
    const goal = canonical(target);
    if (!Number.isFinite(this.lengths[goal.a][goal.b]))
      throw Error("缺少動作影格 " + goal.a + "-" + goal.b);
    if (this.group !== group) {
      this.group = group;
      this.departure = this.previous;
      this.elapsed = 0;
    }
    this.elapsed += dt;
    const blend = this.departure
      ? smooth(clamp(this.elapsed / 0.105, 0, 1))
      : 1;
    this.cursor = this.previous
      ? this.move(goal, dt * (36 + 104 * blend))
      : goal;
    const current = this.cursor;
    const joints = this.frames[0].pins.map((_, i) => {
      const raw = pin(this.frames, goal, i, this.scale),
        desired = pin(this.frames, target, i, this.scale);
      const shown = pin(this.frames, current, i, this.scale);
      const x = shown.x + desired.x - raw.x,
        y = shown.y + desired.y - raw.y;
      if (blend >= 1 || !this.departure?.joints) return { x, y };
      const old = this.departure.joints[i];
      return { x: mix(old.x, x, blend), y: mix(old.y, y, blend) };
    });
    if (blend === 1) this.departure = undefined;
    this.previous = { ...current, joints };
    return this.previous;
  }
}

const stance = 0.56;
const cycleTime = (t: number) => t - Math.floor(t);

// During stance the boot travels backwards exactly as far as the body travels forwards.
function footAt(phase: number, stride: number) {
  const p = cycleTime(phase);
  const swing = clamp((p - stance) / (1 - stance), 0, 1);
  const travel = swing ** 3 * (10 - 15 * swing + 6 * swing * swing);
  return {
    x: stride * (stance / 2 - p + travel),
    lift: Math.sin(Math.PI * swing) ** 2,
  };
}

/**
 * Walking driven by real distance. `facing` is +1 (looks right) or -1, `stride` the
 * length of one full step cycle, `cruise` the top walking speed (units per second).
 * Key 0 must be the guard pose and key 1 the step pose (walkPose blends 0 → 1).
 */
export class Footwork {
  speed = 0;
  private phase = stance / 2;
  private weight = 0;
  private facing: number;
  private stride: number;
  private cruise: number;

  constructor(facing: number, stride: number, cruise: number) {
    this.facing = facing;
    this.stride = stride;
    this.cruise = cruise;
  }

  reset(): void {
    this.speed = this.weight = 0;
    this.phase = stance / 2;
  }

  /** Eases the speed toward `target` (accelerating, or braking faster); returns the distance for this step. */
  move(target: number, dt: number): number {
    const braking = target === 0 || this.speed * target < 0;
    const limit = this.cruise * (braking ? 12 : 8.5) * dt;
    const before = this.speed;
    this.speed += clamp(target - before, -limit, limit);
    return (before + this.speed) * 0.5 * dt;
  }

  /** Advances the stride by the distance actually moved; returns the boot pin (3 or 4) that just planted. */
  travel(distance: number, dt: number): number | undefined {
    const target = clamp(Math.abs(distance) / (dt * this.cruise * 0.65), 0, 1);
    this.weight = mix(this.weight, target, 1 - Math.exp(-24 * dt));
    if (this.weight < 0.001) this.weight = 0;
    const before = this.phase;
    this.phase += (distance * this.facing) / this.stride;
    const boundary = this.phase >= before ? 0 : stance;
    const halfStep = Math.floor((this.phase - boundary) * 2);
    if (
      this.weight > 0.35 &&
      halfStep !== Math.floor((before - boundary) * 2)
    ) {
      const crossed = this.phase >= before ? halfStep : halfStep + 1;
      return crossed % 2 === 0 ? 3 : 4;
    }
  }

  walkPose(): Pose {
    return {
      a: 0,
      b: 1,
      t: ((1 - Math.cos(this.phase * Math.PI * 2)) / 2) * this.weight,
    };
  }

  /** Puts the boots on the ground, lifts the swinging one, bobs and breathes the upper body. */
  shape(
    pose: Pose,
    frames: readonly Frame[],
    scale: number,
    time: number,
    walking: boolean
  ): Pose {
    const joints =
      pose.joints ?? frames[0].pins.map((_, i) => pin(frames, pose, i, scale));
    const lead = footAt(this.phase, this.stride);
    const rear = footAt(this.phase + 0.5, this.stride);
    const weight = this.weight;
    const direction = clamp(this.speed / this.cruise, -1, 1);
    const bob = weight * (1.5 - 5 * (lead.lift + rear.lift));
    const breath = Math.sin(time * 2.3 + this.facing) * (walking ? 1.35 : 0.25);
    for (const i of [0, 1, 2, 5, 8, 9]) {
      const upper = i === 5 ? 0.55 : 1;
      joints[i].x += direction * (i === 9 ? -11 : 8 * upper);
      joints[i].y += (bob + breath) * upper;
    }
    for (const [leg, foot] of [lead, rear].entries()) {
      const boot = 3 + leg,
        knee = 6 + leg;
      const planted = pin(frames, fixed(0), boot, scale);
      const footX = this.facing * foot.x;
      const footY = -23 * foot.lift;
      joints[boot].x = mix(joints[boot].x, planted.x + footX, weight);
      joints[boot].y = mix(joints[boot].y, planted.y + footY, weight);
      joints[knee].x += weight * (0.48 * footX + this.facing * 15 * foot.lift);
      joints[knee].y += weight * (0.55 * footY + 2.5);
    }
    return { ...pose, joints };
  }
}
