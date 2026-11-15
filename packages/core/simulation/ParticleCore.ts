/**
 * What cloth and spring bones share: a fixed step fed by the engine's clock,
 * and bodies a particle is kept out of. Plain arithmetic on numbers and typed
 * arrays: no LayaAir, no timer of its own, no random numbers. The same
 * deltas give the same result, to the last bit.
 */

export type ZhudaSimVec3 = readonly [number, number, number];

/** A ball. */
export interface ZhudaSphereCollider {
  type: 'sphere';
  center: [number, number, number];
  radius: number;
}
/** A rod with round ends: every point within `radius` of the line from `a` to `b`. */
export interface ZhudaCapsuleCollider {
  type: 'capsule';
  a: [number, number, number];
  b: [number, number, number];
  radius: number;
}
/**
 * A body turned about an axis whose radius is looked up by height and by
 * angle: a leg, a torso, a vase. `radii` holds `rows` rings of `columns`
 * radii, the ring at the foot of the axis first; a ring's first radius is in
 * the direction `forward` and the rest go round toward `cross(axis,
 * forward)`. Between the table's values the radius is interpolated. The two
 * ends are closed flat.
 */
export interface ZhudaTableCollider {
  type: 'table';
  /** The foot of the axis. */
  origin: [number, number, number];
  /** Along the body, a unit. */
  axis: [number, number, number];
  /** Where the angle is zero: a unit, square to the axis. */
  forward: [number, number, number];
  /** How far along the axis the table reaches, metres. */
  height: number;
  /** Rings, two or more, evenly from the foot to `height`. */
  rows: number;
  /** Radii a ring, three or more, evenly round (the last meets the first). */
  columns: number;
  /** `rows` times `columns` radii, metres. */
  radii: ArrayLike<number>;
}
/** A flat floor or wall without end: everything behind `point`, seen along `normal`, is inside. */
export interface ZhudaPlaneCollider {
  type: 'plane';
  /** Any point of the surface. */
  point: [number, number, number];
  /** Out of the body, a unit. */
  normal: [number, number, number];
}
export type ZhudaCollider =
  | ZhudaSphereCollider
  | ZhudaCapsuleCollider
  | ZhudaTableCollider
  | ZhudaPlaneCollider;

const finite3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const length = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);

/** What is wrong with a collider, in words; empty when nothing is. Pure. */
export function validateZhudaCollider(collider: unknown, path = 'collider'): string[] {
  const issues: string[] = [];
  const c = collider as any;
  if (c === null || typeof c !== 'object') return [`${path}: an object with a type`];
  const radius = (value: unknown, name: string) => {
    if (!(Number.isFinite(value) && (value as number) > 0 && (value as number) <= 1000))
      issues.push(`${path}.${name}: metres, more than 0 and at most 1000`);
  };
  const point = (value: unknown, name: string) => {
    if (!finite3(value)) issues.push(`${path}.${name}: three finite numbers`);
  };
  if (c.type === 'sphere') {
    point(c.center, 'center');
    radius(c.radius, 'radius');
  } else if (c.type === 'capsule') {
    point(c.a, 'a');
    point(c.b, 'b');
    radius(c.radius, 'radius');
  } else if (c.type === 'table') {
    point(c.origin, 'origin');
    point(c.axis, 'axis');
    point(c.forward, 'forward');
    if (finite3(c.axis) && Math.abs(length(c.axis[0], c.axis[1], c.axis[2]) - 1) > 1e-3)
      issues.push(`${path}.axis: a unit vector`);
    if (finite3(c.forward) && Math.abs(length(c.forward[0], c.forward[1], c.forward[2]) - 1) > 1e-3)
      issues.push(`${path}.forward: a unit vector`);
    if (
      finite3(c.axis) &&
      finite3(c.forward) &&
      Math.abs(c.axis[0] * c.forward[0] + c.axis[1] * c.forward[1] + c.axis[2] * c.forward[2]) >
        1e-3
    )
      issues.push(`${path}.forward: square to the axis`);
    radius(c.height, 'height');
    if (!(Number.isInteger(c.rows) && c.rows >= 2 && c.rows <= 1024))
      issues.push(`${path}.rows: a whole number, 2 to 1024`);
    if (!(Number.isInteger(c.columns) && c.columns >= 3 && c.columns <= 1024))
      issues.push(`${path}.columns: a whole number, 3 to 1024`);
    const count = c.rows * c.columns;
    if (c.radii === null || typeof c.radii !== 'object' || typeof c.radii.length !== 'number')
      issues.push(`${path}.radii: an array of rows times columns radii`);
    else if (Number.isInteger(count) && c.radii.length !== count)
      issues.push(`${path}.radii: ${count} radii (rows times columns), not ${c.radii.length}`);
    else
      for (let i = 0; i < c.radii.length; i++)
        if (!(Number.isFinite(c.radii[i]) && c.radii[i] >= 0 && c.radii[i] <= 1000)) {
          issues.push(`${path}.radii[${i}]: metres, 0 to 1000`);
          break;
        }
  } else if (c.type === 'plane') {
    point(c.point, 'point');
    point(c.normal, 'normal');
    if (finite3(c.normal) && Math.abs(length(c.normal[0], c.normal[1], c.normal[2]) - 1) > 1e-3)
      issues.push(`${path}.normal: a unit vector`);
  } else issues.push(`${path}.type: sphere, capsule, table or plane`);
  return issues;
}

/**
 * A collider's radius at a height and an angle, as the collision reads it:
 * for drawing the same body, or for checking a table. `height` is clamped
 * to the table, `angle` (radians, from `forward` toward `cross(axis,
 * forward)`) goes round.
 */
export function zhudaTableRadius(table: ZhudaTableCollider, height: number, angle: number): number {
  const { rows, columns, radii } = table;
  const rf = Math.min(1, Math.max(0, height / table.height)) * (rows - 1);
  const r0 = Math.min(rows - 2, Math.floor(rf)),
    tr = rf - r0;
  let u = angle / (2 * Math.PI);
  u -= Math.floor(u);
  const cf = u * columns;
  const c0 = Math.floor(cf) % columns,
    c1 = (c0 + 1) % columns,
    tc = cf - Math.floor(cf);
  const low = radii[r0 * columns + c0] * (1 - tc) + radii[r0 * columns + c1] * tc,
    high = radii[(r0 + 1) * columns + c0] * (1 - tc) + radii[(r0 + 1) * columns + c1] * tc;
  return low * (1 - tr) + high * tr;
}

/**
 * How much farther out from its axis a table's surface is when it is grown
 * by a margin, at most, as a multiple of the margin: on a shoulder that is
 * nearly flat the growth is upward, not outward, and the top takes over.
 */
const TABLE_STEEPEST = 8;
/** Which way a table's surface faces at a place: filled by `tableFacing`. */
const facing = new Float64Array(3);
const slopes = new Float64Array(2);

/**
 * What is worked out once about a table for asking about many points: its
 * widest radius, and how its radius changes with height and round the body
 * at each of its own values.
 */
export interface ZhudaTablePrepared {
  reach: number;
  byHeight: Float32Array;
  byAngle: Float32Array;
}

/** How a table's radius changes at one of its own values: with height (0) and with angle (1), into `slopes`. */
function tableSlopes(table: ZhudaTableCollider, row: number, column: number) {
  const { rows, columns, radii } = table,
    up = Math.min(rows - 1, row + 1),
    down = Math.max(0, row - 1),
    on = (column + 1) % columns,
    back = (column + columns - 1) % columns;
  slopes[0] = Math.fround(
    (radii[up * columns + column] - radii[down * columns + column]) /
      ((up - down) * (table.height / (rows - 1))),
  );
  slopes[1] = Math.fround(
    (radii[row * columns + on] - radii[row * columns + back]) / ((4 * Math.PI) / columns),
  );
}

/**
 * Works a table out for `zhudaColliderDepth`. `into` is filled again when
 * it is the right size (a body that moves or changes every frame makes no
 * garbage). The answer for a point is the same with it and without.
 */
export function prepareZhudaTable(
  table: ZhudaTableCollider,
  into?: ZhudaTablePrepared,
): ZhudaTablePrepared {
  const count = table.rows * table.columns;
  const prepared =
    into && into.byHeight.length === count
      ? into
      : { reach: 0, byHeight: new Float32Array(count), byAngle: new Float32Array(count) };
  let widest = 0;
  for (let row = 0; row < table.rows; row++)
    for (let column = 0; column < table.columns; column++) {
      const i = row * table.columns + column;
      tableSlopes(table, row, column);
      prepared.byHeight[i] = slopes[0];
      prepared.byAngle[i] = slopes[1];
      if (table.radii[i] > widest) widest = table.radii[i];
    }
  prepared.reach = widest;
  return prepared;
}

/**
 * A table's surface is where the distance from the axis equals the radius
 * for the height and the angle. How the radius changes with height and
 * round the body says which way the surface faces there: a shoulder faces
 * up as much as out, an oval a little along itself. Fills `facing` with
 * how fast "distance less radius" grows along the axis and round it, and
 * the square of how fast it grows in all (out from the axis it grows by
 * one); returns how many times a margin square to the surface is as a
 * margin out from the axis. The slopes are the table's own at its values,
 * read between them as the radius is. No allocation.
 */
function tableFacing(
  table: ZhudaTableCollider,
  h: number,
  angle: number,
  radius: number,
  prepared?: ZhudaTablePrepared,
) {
  const { rows, columns } = table;
  const rf = Math.min(1, Math.max(0, h / table.height)) * (rows - 1);
  const r0 = Math.min(rows - 2, Math.floor(rf)),
    tr = rf - r0;
  let u = angle / (2 * Math.PI);
  u -= Math.floor(u);
  const cf = u * columns;
  const c0 = Math.floor(cf) % columns,
    c1 = (c0 + 1) % columns,
    tc = cf - Math.floor(cf);
  let byHeight = 0,
    byAngle = 0;
  for (let corner = 0; corner < 4; corner++) {
    const row = r0 + (corner >> 1),
      column = corner & 1 ? c1 : c0,
      weight = (corner >> 1 ? tr : 1 - tr) * (corner & 1 ? tc : 1 - tc);
    if (prepared) {
      byHeight += prepared.byHeight[row * columns + column] * weight;
      byAngle += prepared.byAngle[row * columns + column] * weight;
    } else {
      tableSlopes(table, row, column);
      byHeight += slopes[0] * weight;
      byAngle += slopes[1] * weight;
    }
  }
  facing[0] = -byHeight;
  facing[1] = radius > 1e-6 ? -byAngle / radius : 0;
  facing[2] = 1 + facing[0] * facing[0] + facing[1] * facing[1];
  return Math.min(Math.sqrt(facing[2]), TABLE_STEEPEST);
}

/**
 * How deep a point is inside a collider grown by `margin` (more than 0:
 * inside), and the way out. A table is grown square to its surface, as a
 * ball is: on a shoulder the margin is upward as much as outward; its depth
 * by its side is measured square to its surface, to the first order (the
 * surface is curved; whether a point is inside is exact). `out` receives
 * where the point is put (0..2: on the grown surface, or a hair outside a
 * table's) and the direction it was pushed in, a unit (3..5); it is written
 * only when the point is inside. No allocation. `prepared` is a table
 * worked out beforehand (`prepareZhudaTable`), for callers that ask about
 * many points; the answer is the same without it.
 */
export function zhudaColliderDepth(
  collider: ZhudaCollider,
  margin: number,
  x: number,
  y: number,
  z: number,
  out?: Float32Array | Float64Array | number[],
  prepared?: ZhudaTablePrepared,
): number {
  if (collider.type === 'sphere' || collider.type === 'capsule') {
    let cx: number, cy: number, cz: number;
    if (collider.type === 'sphere') {
      const { center } = collider;
      cx = center[0];
      cy = center[1];
      cz = center[2];
    } else {
      const { a, b } = collider;
      const abx = b[0] - a[0],
        aby = b[1] - a[1],
        abz = b[2] - a[2];
      const span = abx * abx + aby * aby + abz * abz;
      let t = span > 1e-18 ? ((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / span : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      cx = a[0] + abx * t;
      cy = a[1] + aby * t;
      cz = a[2] + abz * t;
    }
    const dx = x - cx,
      dy = y - cy,
      dz = z - cz;
    const distance = length(dx, dy, dz),
      reach = collider.radius + margin;
    if (distance >= reach) return reach - distance;
    if (out) {
      // A point at the very middle has no way out of its own: up.
      const nx = distance > 1e-9 ? dx / distance : 0,
        ny = distance > 1e-9 ? dy / distance : 1,
        nz = distance > 1e-9 ? dz / distance : 0;
      out[0] = cx + nx * reach;
      out[1] = cy + ny * reach;
      out[2] = cz + nz * reach;
      out[3] = nx;
      out[4] = ny;
      out[5] = nz;
    }
    return reach - distance;
  }
  if (collider.type === 'plane') {
    const { point, normal } = collider;
    const depth =
      margin -
      ((x - point[0]) * normal[0] + (y - point[1]) * normal[1] + (z - point[2]) * normal[2]);
    if (depth > 0 && out) {
      out[0] = x + normal[0] * depth;
      out[1] = y + normal[1] * depth;
      out[2] = z + normal[2] * depth;
      out[3] = normal[0];
      out[4] = normal[1];
      out[5] = normal[2];
    }
    return depth;
  }
  const { origin, axis, forward } = collider;
  const dx = x - origin[0],
    dy = y - origin[1],
    dz = z - origin[2];
  const h = dx * axis[0] + dy * axis[1] + dz * axis[2];
  const below = h + margin,
    above = collider.height + margin - h;
  if (below <= 0 || above <= 0) return Math.min(below, above);
  // What is left of the point once its height is taken away: out from the axis.
  const rx = dx - axis[0] * h,
    ry = dy - axis[1] * h,
    rz = dz - axis[2] * h;
  const r = length(rx, ry, rz);
  // The most a grown surface is farther out than the body's own.
  const grown = margin * TABLE_STEEPEST;
  if (prepared && r >= prepared.reach + grown) return prepared.reach + grown - r;
  // cross(axis, forward): where a quarter turn is.
  const sx = axis[1] * forward[2] - axis[2] * forward[1],
    sy = axis[2] * forward[0] - axis[0] * forward[2],
    sz = axis[0] * forward[1] - axis[1] * forward[0];
  const angle =
    r > 1e-9
      ? Math.atan2(rx * sx + ry * sy + rz * sz, rx * forward[0] + ry * forward[1] + rz * forward[2])
      : 0;
  const radius = zhudaTableRadius(collider, h, angle);
  if (r >= radius + grown) return radius + grown - r;
  const side = radius + margin * tableFacing(collider, h, angle, radius, prepared) - r;
  if (side <= 0) return side;
  // Inside. The way out by the side is square to the surface.
  const alongAxis = facing[0],
    round = facing[1],
    steep = facing[2];
  const bySide = side / Math.sqrt(steep);
  // Out by the nearest of the side, the foot and the top.
  const depth = Math.min(bySide, below, above);
  if (out) {
    if (depth === bySide) {
      const ox = r > 1e-9 ? rx / r : forward[0],
        oy = r > 1e-9 ? ry / r : forward[1],
        oz = r > 1e-9 ? rz / r : forward[2];
      // Round the axis, a quarter turn on from outward.
      const tx = axis[1] * oz - axis[2] * oy,
        ty = axis[2] * ox - axis[0] * oz,
        tz = axis[0] * oy - axis[1] * ox;
      const nx = ox + axis[0] * alongAxis + tx * round,
        ny = oy + axis[1] * alongAxis + ty * round,
        nz = oz + axis[2] * alongAxis + tz * round;
      const move = side / steep;
      let px = x + nx * move,
        py = y + ny * move,
        pz = z + nz * move;
      // The surface is not flat: where that step fell short, straight out to it from there.
      const qx = px - origin[0],
        qy = py - origin[1],
        qz = pz - origin[2];
      const qh = qx * axis[0] + qy * axis[1] + qz * axis[2];
      if (qh + margin > 0 && collider.height + margin - qh > 0) {
        const ux = qx - axis[0] * qh,
          uy = qy - axis[1] * qh,
          uz = qz - axis[2] * qh;
        const ur = length(ux, uy, uz);
        const turned =
          ur > 1e-9
            ? Math.atan2(
                ux * sx + uy * sy + uz * sz,
                ux * forward[0] + uy * forward[1] + uz * forward[2],
              )
            : 0;
        const bare = zhudaTableRadius(collider, qh, turned);
        const there = bare + margin * tableFacing(collider, qh, turned, bare, prepared);
        if (ur < there) {
          const wx = ur > 1e-9 ? ux / ur : ox,
            wy = ur > 1e-9 ? uy / ur : oy,
            wz = ur > 1e-9 ? uz / ur : oz;
          px = origin[0] + axis[0] * qh + wx * there;
          py = origin[1] + axis[1] * qh + wy * there;
          pz = origin[2] + axis[2] * qh + wz * there;
        }
      }
      const size = Math.sqrt(steep);
      out[0] = px;
      out[1] = py;
      out[2] = pz;
      out[3] = nx / size;
      out[4] = ny / size;
      out[5] = nz / size;
    } else {
      const sign = depth === below ? -1 : 1,
        move = depth === below ? -below : above;
      out[0] = x + axis[0] * move;
      out[1] = y + axis[1] * move;
      out[2] = z + axis[2] * move;
      out[3] = axis[0] * sign;
      out[4] = axis[1] * sign;
      out[5] = axis[2] * sign;
    }
  }
  return depth;
}

/** A table's widest radius. */
export function zhudaTableReach(table: ZhudaTableCollider): number {
  let widest = 0;
  for (let i = 0; i < table.radii.length; i++) if (table.radii[i] > widest) widest = table.radii[i];
  return widest;
}

export interface ZhudaFixedStepOptions {
  /** Seconds a step. */
  step: number;
  /** The most steps one call may ask for; time over that is dropped. */
  maxSteps: number;
}

/**
 * Gathers the clock's deltas and hands them out in whole steps. What is
 * left of a delta waits for the next one. A delta that holds more steps
 * than `maxSteps` is not caught up with: the steps over the cap are
 * dropped, so a long gap (a lost focus, a breakpoint) moves the simulation
 * by the cap and no further.
 */
export class ZhudaFixedStep {
  readonly step: number;
  readonly maxSteps: number;
  /** Steps handed out in all. */
  steps = 0;
  /** Steps dropped in all. */
  dropped = 0;
  private pending = 0;
  constructor(options: ZhudaFixedStepOptions) {
    const { step, maxSteps } = options;
    if (!(Number.isFinite(step) && step >= 1 / 1000 && step <= 1 / 10))
      throw Error('Invalid step: seconds, 1/1000 to 1/10');
    if (!(Number.isInteger(maxSteps) && maxSteps >= 1 && maxSteps <= 64))
      throw Error('Invalid maxSteps: a whole number, 1 to 64');
    this.step = step;
    this.maxSteps = maxSteps;
  }
  /** Takes a delta in seconds; returns how many steps to run now. */
  take(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0)
      throw Error('Invalid delta: seconds, zero or more');
    this.pending += deltaSeconds;
    const whole = Math.floor(this.pending / this.step + 1e-9);
    this.pending = Math.max(0, this.pending - whole * this.step);
    const now = Math.min(whole, this.maxSteps);
    this.steps += now;
    this.dropped += whole - now;
    return now;
  }
  /** How far into the next step the gathered time is, 0..1. */
  get alpha(): number {
    return Math.min(1, this.pending / this.step);
  }
  /** Seconds gathered and not yet spent. */
  get pendingSeconds(): number {
    return this.pending;
  }
  reset() {
    this.pending = 0;
    this.steps = 0;
    this.dropped = 0;
  }
}
