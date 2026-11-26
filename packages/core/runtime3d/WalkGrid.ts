// Where a character can walk, and the way from one place to another.
//
// A game gives the ground (a height at a point) and the solid things on it (boxes and upright
// cylinders). From them: a grid of cells a walker of a given size can stand in, the shortest way
// across it, and whether a straight run is clear. Pure numbers, the same on every host; the
// character controller (CharacterController.ts) and a camera boom use the same solids.
import type { Vec3 } from './Math3D.ts';
import type { QueryHit, QueryProvider, QueryRay } from './SceneQueries.ts';

/** A solid thing on the ground: an axis-aligned box, or an upright cylinder. World units. */
export type ZhudaSolid =
  | { kind: 'box'; min: Vec3; max: Vec3 }
  | {
      kind: 'cylinder';
      center: { x: number; z: number };
      radius: number;
      minY: number;
      maxY: number;
    };
export interface ZhudaGroundPoint {
  x: number;
  z: number;
}
export interface ZhudaWalkGridOptions {
  /** The rectangle of ground the grid covers. */
  min: ZhudaGroundPoint;
  max: ZhudaGroundPoint;
  /** Cell size in metres. A quarter to a half of the walker's width is usual. */
  cell: number;
  /** The ground's height at a point, or null where there is none. Default: flat at 0. */
  ground?: (x: number, z: number) => number | null;
  solids?: readonly ZhudaSolid[];
  /** The walker: how wide (radius), how tall, and how high a step it takes. */
  radius?: number;
  height?: number;
  maxStep?: number;
  /** One more rule of the game's: true where nobody may stand. */
  blocked?: (x: number, z: number) => boolean;
}
export interface ZhudaWalkGrid {
  readonly columns: number;
  readonly rows: number;
  readonly cell: number;
  readonly min: ZhudaGroundPoint;
  readonly maxStep: number;
  /** How many cells can be stood in. */
  readonly walkableCells: number;
  cellOf(x: number, z: number): { column: number; row: number } | null;
  centerOf(column: number, row: number): ZhudaGroundPoint;
  walkable(column: number, row: number): boolean;
  /** The ground's height at a cell's middle (NaN where there is no ground). */
  heightOf(column: number, row: number): number;
  isWalkable(x: number, z: number): boolean;
  /** The middle of the nearest cell that can be stood in, within `maxDistance` metres, or null. */
  nearestWalkable(x: number, z: number, maxDistance?: number): ZhudaGroundPoint | null;
}
export interface ZhudaPathOptions {
  /** Take out the corners a straight run can skip (default true). */
  smooth?: boolean;
  /** Give up after visiting this many cells (default: every cell). */
  maxVisited?: number;
}
export interface ZhudaPath {
  found: boolean;
  /** From the start to the goal, both as given; empty when not found. */
  points: ZhudaGroundPoint[];
  /** Metres along the points. */
  length: number;
  /** Cells looked at: what the search cost. */
  visited: number;
}

const finite = (...values: number[]) => values.every(Number.isFinite);

function checkSolid(solid: ZhudaSolid): void {
  if (solid?.kind === 'box') {
    const { min, max } = solid;
    if (
      !min ||
      !max ||
      !finite(min.x, min.y, min.z, max.x, max.y, max.z) ||
      min.x > max.x ||
      min.y > max.y ||
      min.z > max.z
    )
      throw Error('Invalid box solid: min and max, min not above max');
  } else if (solid?.kind === 'cylinder') {
    if (
      !solid.center ||
      !finite(solid.center.x, solid.center.z, solid.radius, solid.minY, solid.maxY) ||
      solid.radius <= 0 ||
      solid.minY > solid.maxY
    )
      throw Error('Invalid cylinder solid: center, radius above 0, minY not above maxY');
  } else throw Error("Invalid solid: kind 'box' or 'cylinder'");
}
/** How far a point on the ground plane is from a solid's footprint (0 inside it). */
export function zhudaSolidDistance(solid: ZhudaSolid, x: number, z: number): number {
  if (solid.kind === 'cylinder')
    return Math.max(0, Math.hypot(x - solid.center.x, z - solid.center.z) - solid.radius);
  const dx = Math.max(solid.min.x - x, 0, x - solid.max.x),
    dz = Math.max(solid.min.z - z, 0, z - solid.max.z);
  return Math.hypot(dx, dz);
}
const spanOf = (solid: ZhudaSolid): [number, number] =>
  solid.kind === 'box' ? [solid.min.y, solid.max.y] : [solid.minY, solid.maxY];
/**
 * Whether a solid stands in the way of something whose feet are at `feet` and whose top is
 * `height` above them: it must rise above a step from the feet and start below the top.
 */
export function zhudaSolidBlocks(
  solid: ZhudaSolid,
  feet: number,
  height: number,
  maxStep: number,
): boolean {
  const [bottom, top] = spanOf(solid);
  return top > feet + maxStep && bottom < feet + height;
}

export function createZhudaWalkGrid(options: ZhudaWalkGridOptions): ZhudaWalkGrid {
  const { min, max, cell } = options ?? ({} as ZhudaWalkGridOptions);
  const radius = options?.radius ?? 0.3,
    height = options?.height ?? 1.7,
    maxStep = options?.maxStep ?? 0.35;
  if (
    !min ||
    !max ||
    !finite(min.x, min.z, max.x, max.z, cell, radius, height, maxStep) ||
    !(max.x > min.x) ||
    !(max.z > min.z)
  )
    throw Error('Invalid walk grid: min and max of the ground it covers');
  if (!(cell > 0) || radius < 0 || !(height > 0) || maxStep < 0)
    throw Error('Invalid walk grid: cell above 0, radius, height above 0, maxStep');
  const columns = Math.ceil((max.x - min.x) / cell - 1e-9),
    rows = Math.ceil((max.z - min.z) / cell - 1e-9);
  if (columns * rows > 4_000_000)
    throw Error(`Walk grid of ${columns} by ${rows} cells: use a larger cell`);
  const solids = [...(options.solids ?? [])];
  solids.forEach(checkSolid);
  const ground = options.ground ?? (() => 0);
  const heights = new Float32Array(columns * rows),
    open = new Uint8Array(columns * rows);
  let walkableCells = 0;
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const x = min.x + (column + 0.5) * cell,
        z = min.z + (row + 0.5) * cell,
        y = ground(x, z),
        i = row * columns + column;
      if (y === null || !Number.isFinite(y)) {
        heights[i] = NaN;
        continue;
      }
      heights[i] = y;
      if (options.blocked?.(x, z)) continue;
      if (
        solids.some(
          (solid) =>
            zhudaSolidBlocks(solid, y, height, maxStep) && zhudaSolidDistance(solid, x, z) < radius,
        )
      )
        continue;
      open[i] = 1;
      walkableCells++;
    }
  const inside = (column: number, row: number) =>
    column >= 0 && row >= 0 && column < columns && row < rows;
  const cellOf = (x: number, z: number) => {
    const column = Math.floor((x - min.x) / cell),
      row = Math.floor((z - min.z) / cell);
    return inside(column, row) ? { column, row } : null;
  };
  const centerOf = (column: number, row: number) => ({
    x: min.x + (column + 0.5) * cell,
    z: min.z + (row + 0.5) * cell,
  });
  const walkable = (column: number, row: number) =>
    inside(column, row) && open[row * columns + column] === 1;
  return {
    columns,
    rows,
    cell,
    min: { x: min.x, z: min.z },
    maxStep,
    walkableCells,
    cellOf,
    centerOf,
    walkable,
    heightOf: (column, row) => (inside(column, row) ? heights[row * columns + column] : NaN),
    isWalkable: (x, z) => {
      const at = cellOf(x, z);
      return !!at && walkable(at.column, at.row);
    },
    nearestWalkable: (x, z, maxDistance = Infinity) => {
      const at = cellOf(
        Math.min(Math.max(x, min.x), min.x + columns * cell - 1e-9),
        Math.min(Math.max(z, min.z), min.z + rows * cell - 1e-9),
      )!;
      const reach = Math.min(Math.max(columns, rows), Math.ceil(maxDistance / cell) + 1);
      let best: ZhudaGroundPoint | null = null,
        bestDistance = maxDistance;
      // Rings of cells outwards; one ring more after the first find, as a corner cell may be nearer.
      for (let ring = 0, last = Infinity; ring <= reach && ring <= last; ring++)
        for (let row = at.row - ring; row <= at.row + ring; row++)
          for (let column = at.column - ring; column <= at.column + ring; column++) {
            if (
              Math.max(Math.abs(row - at.row), Math.abs(column - at.column)) !== ring ||
              !walkable(column, row)
            )
              continue;
            const c = centerOf(column, row),
              d = Math.hypot(c.x - x, c.z - z);
            if (d <= bestDistance)
              ((best = c), (bestDistance = d), (last = Math.min(last, ring + 1)));
          }
      return best;
    },
  };
}

/** Whether two neighbouring cells can be stepped between (both open, and not too high a step). */
function stepOk(grid: ZhudaWalkGrid, c0: number, r0: number, c1: number, r1: number): boolean {
  if (!grid.walkable(c1, r1)) return false;
  return Math.abs(grid.heightOf(c1, r1) - grid.heightOf(c0, r0)) <= grid.maxStep + 1e-6;
}

/** Whether a straight run from `a` to `b` stays on cells that can be stood in, with no step too high. */
export function zhudaWalkLineClear(
  grid: ZhudaWalkGrid,
  a: ZhudaGroundPoint,
  b: ZhudaGroundPoint,
): boolean {
  let at = grid.cellOf(a.x, a.z);
  if (!at || !grid.walkable(at.column, at.row) || !grid.isWalkable(b.x, b.z)) return false;
  const length = Math.hypot(b.x - a.x, b.z - a.z),
    steps = Math.max(1, Math.ceil(length / (grid.cell * 0.25)));
  for (let k = 1; k <= steps; k++) {
    const t = k / steps,
      next = grid.cellOf(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (!next) return false;
    if (next.column === at.column && next.row === at.row) continue;
    // A move across a corner must be clear on both sides of it: nobody squeezes between two blocks.
    if (
      next.column !== at.column &&
      next.row !== at.row &&
      (!stepOk(grid, at.column, at.row, next.column, at.row) ||
        !stepOk(grid, at.column, at.row, at.column, next.row))
    )
      return false;
    if (!stepOk(grid, at.column, at.row, next.column, next.row)) return false;
    at = next;
  }
  return true;
}

/**
 * The shortest way over the grid from `from` to `to` (A* over eight neighbours, no cutting of
 * corners), with the corners a straight run can skip taken out. Both ends must be in cells that
 * can be stood in: use `grid.nearestWalkable` first for a point that may not be.
 */
export function findZhudaPath(
  grid: ZhudaWalkGrid,
  from: ZhudaGroundPoint,
  to: ZhudaGroundPoint,
  options: ZhudaPathOptions = {},
): ZhudaPath {
  const none = (visited: number): ZhudaPath => ({ found: false, points: [], length: 0, visited });
  const start = grid.cellOf(from.x, from.z),
    goal = grid.cellOf(to.x, to.z);
  if (
    !start ||
    !goal ||
    !grid.walkable(start.column, start.row) ||
    !grid.walkable(goal.column, goal.row)
  )
    return none(0);
  const { columns, rows } = grid,
    total = columns * rows,
    maxVisited = options.maxVisited ?? total;
  if (!Number.isFinite(maxVisited) || maxVisited <= 0) throw Error('Invalid maxVisited');
  const startIndex = start.row * columns + start.column,
    goalIndex = goal.row * columns + goal.column;
  const cost = new Float64Array(total).fill(Infinity),
    parent = new Int32Array(total).fill(-1),
    closed = new Uint8Array(total);
  // A binary heap of [estimate, index] pairs.
  const heap: number[] = [];
  const push = (estimate: number, index: number) => {
    let i = heap.length;
    heap.push(estimate, index);
    while (i > 0) {
      const p = ((i / 2 - 1) >> 1) * 2;
      if (heap[p] <= heap[i]) break;
      [heap[p], heap[i], heap[p + 1], heap[i + 1]] = [heap[i], heap[p], heap[i + 1], heap[p + 1]];
      i = p;
    }
  };
  const pop = () => {
    const index = heap[1],
      lastIndex = heap.pop()!,
      lastEstimate = heap.pop()!;
    if (heap.length) {
      heap[0] = lastEstimate;
      heap[1] = lastIndex;
      for (let i = 0; ; ) {
        const l = i * 2 + 2,
          r = l + 2;
        let m = i;
        if (l < heap.length && heap[l] < heap[m]) m = l;
        if (r < heap.length && heap[r] < heap[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i], heap[m + 1], heap[i + 1]] = [heap[i], heap[m], heap[i + 1], heap[m + 1]];
        i = m;
      }
    }
    return index;
  };
  const estimate = (index: number) => {
    const dc = Math.abs((index % columns) - goal.column),
      dr = Math.abs(Math.floor(index / columns) - goal.row);
    return (Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr)) * grid.cell;
  };
  cost[startIndex] = 0;
  push(estimate(startIndex), startIndex);
  let visited = 0;
  while (heap.length) {
    const index = pop();
    if (closed[index]) continue;
    closed[index] = 1;
    if (++visited > maxVisited) return none(visited);
    if (index === goalIndex) break;
    const column = index % columns,
      row = Math.floor(index / columns);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const c = column + dc,
          r = row + dr;
        if (!stepOk(grid, column, row, c, r)) continue;
        if (
          dr &&
          dc &&
          (!stepOk(grid, column, row, c, row) || !stepOk(grid, column, row, column, r))
        )
          continue;
        const next = r * columns + c,
          g = cost[index] + (dr && dc ? Math.SQRT2 : 1) * grid.cell;
        if (closed[next] || g >= cost[next]) continue;
        cost[next] = g;
        parent[next] = index;
        push(g + estimate(next), next);
      }
  }
  if (!closed[goalIndex]) return none(visited);
  const cells: number[] = [];
  for (let index = goalIndex; index !== -1; index = parent[index]) cells.push(index);
  cells.reverse();
  let points: ZhudaGroundPoint[] = cells.map((index) =>
    grid.centerOf(index % columns, Math.floor(index / columns)),
  );
  // The ends as they were given, not the middles of their cells.
  points[0] = { x: from.x, z: from.z };
  points[points.length - 1] = { x: to.x, z: to.z };
  if (options.smooth !== false && points.length > 2) {
    const kept = [points[0]];
    for (let anchor = 0; anchor < points.length - 1; ) {
      let far = anchor + 1;
      for (let probe = points.length - 1; probe > anchor + 1; probe--)
        if (zhudaWalkLineClear(grid, points[anchor], points[probe])) {
          far = probe;
          break;
        }
      kept.push(points[far]);
      anchor = far;
    }
    points = kept;
  }
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return { found: true, points, length, visited };
}

/**
 * The same solids as something a ray can hit, for `ZhudaSceneQueries` (and so for
 * `resolveCameraBoom`): the camera then keeps clear of what the character cannot walk through.
 */
export function zhudaSolidQueryProvider(
  solids: readonly ZhudaSolid[],
  entityId = 'solids',
  layer?: number,
): QueryProvider {
  const list = [...solids];
  list.forEach(checkSolid);
  const raycast = (ray: QueryRay, maxDistance: number): Omit<QueryHit, 'entityId'> | null => {
    const { origin: o, direction: d } = ray;
    let best: Omit<QueryHit, 'entityId'> | null = null;
    const take = (distance: number, normal: Vec3) => {
      if (distance < 0 || distance > maxDistance || (best && distance >= best.distance)) return;
      best = {
        distance,
        normal,
        position: { x: o.x + d.x * distance, y: o.y + d.y * distance, z: o.z + d.z * distance },
      };
    };
    for (const solid of list) {
      if (solid.kind === 'box') {
        // Slabs: the latest entry and the earliest exit over the three axes.
        let enter = -Infinity,
          exit = Infinity,
          axis = 0,
          sign = 0;
        const axes = [
          ['x', solid.min.x, solid.max.x],
          ['y', solid.min.y, solid.max.y],
          ['z', solid.min.z, solid.max.z],
        ] as const;
        let missed = false;
        axes.forEach(([key, lo, hi], k) => {
          const from = o[key],
            dir = d[key];
          if (Math.abs(dir) < 1e-12) {
            if (from < lo || from > hi) missed = true;
            return;
          }
          const t0 = (lo - from) / dir,
            t1 = (hi - from) / dir,
            near = Math.min(t0, t1),
            far = Math.max(t0, t1);
          if (near > enter) ((enter = near), (axis = k), (sign = dir > 0 ? -1 : 1));
          exit = Math.min(exit, far);
        });
        if (missed || enter > exit || exit < 0 || enter < 0) continue;
        take(enter, {
          x: axis === 0 ? sign : 0,
          y: axis === 1 ? sign : 0,
          z: axis === 2 ? sign : 0,
        });
      } else {
        // The side of the cylinder, then its two caps.
        const fx = o.x - solid.center.x,
          fz = o.z - solid.center.z,
          a = d.x * d.x + d.z * d.z;
        if (a > 1e-12) {
          const b = fx * d.x + fz * d.z,
            c = fx * fx + fz * fz - solid.radius * solid.radius,
            disc = b * b - a * c;
          if (disc >= 0) {
            const t = (-b - Math.sqrt(disc)) / a,
              y = o.y + d.y * t;
            if (t >= 0 && y >= solid.minY && y <= solid.maxY)
              take(t, { x: (fx + d.x * t) / solid.radius, y: 0, z: (fz + d.z * t) / solid.radius });
          }
        }
        if (Math.abs(d.y) > 1e-12)
          for (const [capY, ny] of [
            [solid.maxY, 1],
            [solid.minY, -1],
          ] as const) {
            const t = (capY - o.y) / d.y;
            if (t >= 0 && d.y * ny < 0 && Math.hypot(fx + d.x * t, fz + d.z * t) <= solid.radius)
              take(t, { x: 0, y: ny, z: 0 });
          }
      }
    }
    return best;
  };
  return { entityId, layer, raycast };
}
