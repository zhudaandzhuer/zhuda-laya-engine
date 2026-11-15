/**
 * Cloth: particles held apart by distance constraints, moved by Verlet
 * integration in fixed steps, kept out of bodies, hung from pins and pulled
 * by a hand. A game's cloth, not a measured fabric.
 *
 * Plain arithmetic: no LayaAir, no timer, no random numbers. Time comes in
 * as deltas of the engine's clock (`ZhudaRuntimeSession.layers`); the same
 * deltas give the same cloth to the last bit. `ZhudaCloth` (runtime3d)
 * draws one through a `ZhudaDynamicMesh`.
 */
import {
  ZhudaFixedStep,
  validateZhudaCollider,
  zhudaColliderDepth,
  prepareZhudaTable,
  type ZhudaCollider,
  type ZhudaSimVec3,
  type ZhudaTablePrepared,
} from './ParticleCore.ts';

/** What a constraint holds: the weave (0), the weave's diagonals (1), or the cloth flat (2). */
export const ZHUDA_CLOTH_STRUCTURAL = 0;
export const ZHUDA_CLOTH_SHEAR = 1;
export const ZHUDA_CLOTH_BEND = 2;
/**
 * A span (3): two particles of one thread, several apart, that may come
 * nearer but get no farther apart than the thread between them is long.
 * It stretches nothing and holds nothing in shape; it passes a pull along
 * a thread several particles at a time, where the weave's own constraints
 * pass it one particle a round and leave a heavy cloth stretched.
 */
export const ZHUDA_CLOTH_SPAN = 3;
/**
 * A particle less than this inside a body is on it: a micron. Single
 * precision leaves a particle put on a surface that far in or out, and it
 * is not moved again for it.
 */
const ON_THE_SKIN = 1e-6;
/** How much longer than its thread a span lets two particles get. */
const SPAN_SLACK = 1.01;

/** A cloth at rest: its particles, how they are held together, and the mesh that is drawn. */
export interface ZhudaClothShape {
  /** Three numbers a particle, metres. */
  particles: Float32Array;
  /** Pairs of particles kept a distance apart: `a[i]` and `b[i]` at `rest[i]` metres, of `kind[i]`. */
  constraints: { a: Uint32Array; b: Uint32Array; rest: Float32Array; kind: Uint8Array };
  /** The drawn mesh: which particle each vertex is. A seam has two vertices for one particle. */
  particleOf: Uint32Array;
  /** Two numbers a vertex. */
  uvs: Float32Array;
  /** Triangles of vertices, front faces wound as `ZhudaDynamicMesh` draws them. */
  indices: Uint16Array;
  /** A grid's or a tube's particles across and down; absent for a cloth made from a mesh. */
  columns?: number;
  rows?: number;
}

const finite3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const whole = (v: unknown, min: number, max: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const positive = (v: unknown, max: number) =>
  Number.isFinite(v) && (v as number) > 0 && (v as number) <= max;
const unit = (v: ZhudaSimVec3, name: string): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (!(l > 1e-9)) throw Error(`${name}: a direction, not zero`);
  return [v[0] / l, v[1] / l, v[2] / l];
};

interface ConstraintList {
  a: number[];
  b: number[];
  rest: number[];
  kind: number[];
}
function link(list: ConstraintList, particles: Float32Array, a: number, b: number, kind: number) {
  const rest = Math.hypot(
    particles[a * 3] - particles[b * 3],
    particles[a * 3 + 1] - particles[b * 3 + 1],
    particles[a * 3 + 2] - particles[b * 3 + 2],
  );
  // Two particles in one place cannot be kept apart in any direction.
  if (!(rest > 1e-9)) return;
  list.a.push(a);
  list.b.push(b);
  list.rest.push(rest);
  list.kind.push(kind);
}
const packed = (list: ConstraintList) => ({
  a: Uint32Array.from(list.a),
  b: Uint32Array.from(list.b),
  rest: Float32Array.from(list.rest),
  kind: Uint8Array.from(list.kind),
});

/** A sheet or a tube of `columns` by `rows` particles, with the constraints of a woven cloth. */
function lattice(
  columns: number,
  rows: number,
  wrap: boolean,
  place: (column: number, row: number) => [number, number, number],
): ZhudaClothShape {
  const particles = new Float32Array(columns * rows * 3);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) particles.set(place(c, r), (r * columns + c) * 3);
  // Across: a tube's last column is held to its first.
  const across = (c: number) => (wrap ? ((c % columns) + columns) % columns : c),
    last = wrap ? columns : columns - 1;
  const at = (c: number, r: number) => r * columns + across(c);
  const list: ConstraintList = { a: [], b: [], rest: [], kind: [] };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      if (c < last) link(list, particles, at(c, r), at(c + 1, r), ZHUDA_CLOTH_STRUCTURAL);
      if (r < rows - 1) link(list, particles, at(c, r), at(c, r + 1), ZHUDA_CLOTH_STRUCTURAL);
    }
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < last; c++) {
      link(list, particles, at(c, r), at(c + 1, r + 1), ZHUDA_CLOTH_SHEAR);
      link(list, particles, at(c + 1, r), at(c, r + 1), ZHUDA_CLOTH_SHEAR);
    }
  const lastBend = wrap ? columns : columns - 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      if (c < lastBend && (!wrap || columns > 4))
        link(list, particles, at(c, r), at(c + 2, r), ZHUDA_CLOTH_BEND);
      if (r < rows - 2) link(list, particles, at(c, r), at(c, r + 2), ZHUDA_CLOTH_BEND);
    }
  // Spans along each thread, four, eight and sixteen particles apart, as long as the thread between.
  const thread = (path: number[]) => {
    let far = 0;
    for (let i = 1; i < path.length; i++)
      far += Math.hypot(
        particles[path[i] * 3] - particles[path[i - 1] * 3],
        particles[path[i] * 3 + 1] - particles[path[i - 1] * 3 + 1],
        particles[path[i] * 3 + 2] - particles[path[i - 1] * 3 + 2],
      );
    if (!(far > 1e-9)) return;
    list.a.push(path[0]);
    list.b.push(path[path.length - 1]);
    list.rest.push(far);
    list.kind.push(ZHUDA_CLOTH_SPAN);
  };
  for (const apart of [4, 8, 16]) {
    // Round a tube only while the thread between is the shorter way round.
    const lastAcross = wrap ? (apart * 2 <= columns ? columns : 0) : columns - apart;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < lastAcross; c++)
        thread(Array.from({ length: apart + 1 }, (_, k) => at(c + k, r)));
    for (let r = 0; r < rows - apart; r++)
      for (let c = 0; c < columns; c++)
        thread(Array.from({ length: apart + 1 }, (_, k) => at(c, r + k)));
  }
  // The mesh: a tube has one more column of vertices than of particles, for the seam.
  const meshColumns = wrap ? columns + 1 : columns;
  const particleOf = new Uint32Array(meshColumns * rows),
    uvs = new Float32Array(meshColumns * rows * 2);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < meshColumns; c++) {
      const v = r * meshColumns + c;
      particleOf[v] = at(c, r);
      uvs[v * 2] = c / (meshColumns - 1);
      uvs[v * 2 + 1] = r / (rows - 1);
    }
  const indices = new Uint16Array((meshColumns - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < meshColumns - 1; c++) {
      const v00 = r * meshColumns + c,
        v10 = v00 + 1,
        v01 = v00 + meshColumns,
        v11 = v01 + 1;
      indices.set([v00, v10, v11, v00, v11, v01], k);
      k += 6;
    }
  return { particles, constraints: packed(list), particleOf, uvs, indices, columns, rows };
}

export interface ZhudaClothGridOptions {
  /** Particles across, 2 to 256. */
  columns: number;
  /** Particles down, 2 to 256. */
  rows: number;
  /** Metres across and down. */
  width: number;
  height: number;
  /** Where the first particle (the top left corner) is. Default: the sheet's top edge centred on the origin. */
  origin?: ZhudaSimVec3;
  /** Which way the columns run (default +x) and which way the rows run (default -y: a sheet hanging down). */
  right?: ZhudaSimVec3;
  down?: ZhudaSimVec3;
}

/**
 * A flat sheet. Particle `row * columns + column`; row 0 is the top edge.
 * Its front faces `cross(right, -down)` (+z for a sheet hanging in x and y).
 */
export function createZhudaClothGrid(options: ZhudaClothGridOptions): ZhudaClothShape {
  const { columns, rows, width, height } = options;
  if (!whole(columns, 2, 256)) throw Error('Invalid columns: a whole number, 2 to 256');
  if (!whole(rows, 2, 256)) throw Error('Invalid rows: a whole number, 2 to 256');
  if (columns * rows > 65535) throw Error('A cloth holds at most 65535 particles');
  if (!positive(width, 1000)) throw Error('Invalid width: metres, more than 0');
  if (!positive(height, 1000)) throw Error('Invalid height: metres, more than 0');
  const right = unit(options.right ?? [1, 0, 0], 'right'),
    down = unit(options.down ?? [0, -1, 0], 'down');
  const origin = options.origin ?? [
    (-right[0] * width) / 2,
    (-right[1] * width) / 2,
    (-right[2] * width) / 2,
  ];
  if (!finite3(origin)) throw Error('Invalid origin: three finite numbers');
  return lattice(columns, rows, false, (c, r) => {
    const u = (c / (columns - 1)) * width,
      v = (r / (rows - 1)) * height;
    return [
      origin[0] + right[0] * u + down[0] * v,
      origin[1] + right[1] * u + down[1] * v,
      origin[2] + right[2] * u + down[2] * v,
    ];
  });
}

export interface ZhudaClothTubeOptions {
  /** Particles round, 4 to 256. */
  columns: number;
  /** Rings, 2 to 256. */
  rows: number;
  /** The middle of the first ring (a skirt's waist). */
  center: ZhudaSimVec3;
  /** Which way the rings follow one another (default -y: down). */
  axis?: ZhudaSimVec3;
  /** Where a ring's first particle is, seen from its middle (default +z). */
  forward?: ZhudaSimVec3;
  /** The first ring's radius and the last ring's, metres. */
  topRadius: number;
  bottomRadius: number;
  /** Metres from the first ring to the last, along the axis. */
  length: number;
}

/**
 * A tube closed round: a skirt, a sleeve, a lampshade. Particle `row *
 * columns + column`; its mesh has one more column of vertices, for the
 * seam. Its front faces outward.
 */
export function createZhudaClothTube(options: ZhudaClothTubeOptions): ZhudaClothShape {
  const { columns, rows, topRadius, bottomRadius } = options;
  if (!whole(columns, 4, 256)) throw Error('Invalid columns: a whole number, 4 to 256');
  if (!whole(rows, 2, 256)) throw Error('Invalid rows: a whole number, 2 to 256');
  if ((columns + 1) * rows > 65535) throw Error('A cloth holds at most 65535 vertices');
  if (!positive(topRadius, 1000)) throw Error('Invalid topRadius: metres, more than 0');
  if (!positive(bottomRadius, 1000)) throw Error('Invalid bottomRadius: metres, more than 0');
  if (!positive(options.length, 1000)) throw Error('Invalid length: metres, more than 0');
  if (!finite3(options.center)) throw Error('Invalid center: three finite numbers');
  const axis = unit(options.axis ?? [0, -1, 0], 'axis');
  let forward = unit(options.forward ?? [0, 0, 1], 'forward');
  // Square to the axis, whatever was given.
  const along = forward[0] * axis[0] + forward[1] * axis[1] + forward[2] * axis[2];
  forward = unit(
    [forward[0] - axis[0] * along, forward[1] - axis[1] * along, forward[2] - axis[2] * along],
    'forward (it may not lie along the axis)',
  );
  // Round the axis so that the front of each triangle faces outward.
  const side = [
    forward[1] * axis[2] - forward[2] * axis[1],
    forward[2] * axis[0] - forward[0] * axis[2],
    forward[0] * axis[1] - forward[1] * axis[0],
  ];
  const { center } = options;
  return lattice(columns, rows, true, (c, r) => {
    const t = r / (rows - 1),
      radius = topRadius + (bottomRadius - topRadius) * t,
      angle = (c / columns) * 2 * Math.PI,
      x = Math.cos(angle) * radius,
      y = Math.sin(angle) * radius,
      d = t * options.length;
    return [
      center[0] + forward[0] * x + side[0] * y + axis[0] * d,
      center[1] + forward[1] * x + side[1] * y + axis[1] * d,
      center[2] + forward[2] * x + side[2] * y + axis[2] * d,
    ];
  });
}

export interface ZhudaClothMeshSource {
  /** Three numbers a vertex. */
  positions: ArrayLike<number>;
  /** Triangles. */
  indices: ArrayLike<number>;
  /** Two numbers a vertex; zeros when left out. */
  uvs?: ArrayLike<number>;
  /** Vertices nearer than this are one particle (a seam, a hard edge), metres. Default 1e-5. */
  weld?: number;
}

/**
 * A cloth from a mesh of one's own: every edge of a triangle is held at its
 * length, and across every edge two triangles share, the two far corners
 * are held apart (so the cloth resists folding). Vertices in one place
 * become one particle.
 */
export function createZhudaClothFromMesh(source: ZhudaClothMeshSource): ZhudaClothShape {
  const { positions, indices } = source;
  const count = positions.length / 3;
  if (!Number.isInteger(count) || count < 3 || count > 65535)
    throw Error('Invalid positions: three numbers a vertex, 3 to 65535 vertices');
  if (!indices.length || indices.length % 3) throw Error('Invalid indices: three a triangle');
  for (let i = 0; i < positions.length; i++)
    if (!Number.isFinite(positions[i])) throw Error('Invalid positions: finite numbers');
  for (let i = 0; i < indices.length; i++)
    if (!Number.isInteger(indices[i]) || indices[i] < 0 || indices[i] >= count)
      throw Error(`Invalid indices: ${indices[i]} is not a vertex`);
  if (source.uvs && source.uvs.length !== count * 2)
    throw Error('Invalid uvs: two numbers a vertex');
  const weld = source.weld ?? 1e-5;
  if (!(Number.isFinite(weld) && weld > 0 && weld <= 1))
    throw Error('Invalid weld: metres, more than 0');
  // Vertices that share a cell of the welding grid, or sit across its border within reach.
  const particleOf = new Uint32Array(count);
  const cells = new Map<string, number[]>();
  const found: number[] = [];
  const cell = (v: number) => Math.floor(v / weld);
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3],
      y = positions[v * 3 + 1],
      z = positions[v * 3 + 2];
    let particle = -1;
    search: for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const p of cells.get(`${cell(x) + dx},${cell(y) + dy},${cell(z) + dz}`) ?? [])
            if (Math.hypot(found[p * 3] - x, found[p * 3 + 1] - y, found[p * 3 + 2] - z) <= weld) {
              particle = p;
              break search;
            }
    if (particle < 0) {
      particle = found.length / 3;
      found.push(x, y, z);
      const key = `${cell(x)},${cell(y)},${cell(z)}`;
      const list = cells.get(key);
      if (list) list.push(particle);
      else cells.set(key, [particle]);
    }
    particleOf[v] = particle;
  }
  const particles = Float32Array.from(found);
  const list: ConstraintList = { a: [], b: [], rest: [], kind: [] };
  // Each edge once, and the corner opposite it in each triangle that has it.
  const edges = new Map<number, number[]>();
  const total = particles.length / 3;
  for (let t = 0; t < indices.length; t += 3) {
    const corner = [particleOf[indices[t]], particleOf[indices[t + 1]], particleOf[indices[t + 2]]];
    if (corner[0] === corner[1] || corner[1] === corner[2] || corner[2] === corner[0]) continue;
    for (let e = 0; e < 3; e++) {
      const a = corner[e],
        b = corner[(e + 1) % 3],
        far = corner[(e + 2) % 3];
      const key = Math.min(a, b) * total + Math.max(a, b);
      const seen = edges.get(key);
      if (seen) seen.push(far);
      else {
        edges.set(key, [far]);
        link(list, particles, Math.min(a, b), Math.max(a, b), ZHUDA_CLOTH_STRUCTURAL);
      }
    }
  }
  for (const far of edges.values())
    if (far.length === 2 && far[0] !== far[1])
      link(list, particles, Math.min(far[0], far[1]), Math.max(far[0], far[1]), ZHUDA_CLOTH_BEND);
  return {
    particles,
    constraints: packed(list),
    particleOf,
    uvs: source.uvs ? Float32Array.from(source.uvs) : new Float32Array(count * 2),
    indices: Uint16Array.from(indices),
  };
}

/** What is wrong with a shape, in words; empty when nothing is. Pure. */
export function validateZhudaClothShape(shape: unknown): string[] {
  const s = shape as ZhudaClothShape;
  if (s === null || typeof s !== 'object') return ['shape: an object'];
  const issues: string[] = [];
  const count = s.particles instanceof Float32Array ? s.particles.length / 3 : NaN;
  if (!Number.isInteger(count) || count < 2 || count > 65535)
    return ['shape.particles: a Float32Array, three numbers a particle, 2 to 65535 particles'];
  for (let i = 0; i < s.particles.length; i++)
    if (!Number.isFinite(s.particles[i])) {
      issues.push(`shape.particles[${i}]: a finite number`);
      break;
    }
  const c = s.constraints;
  if (
    !c ||
    !(c.a instanceof Uint32Array) ||
    !(c.b instanceof Uint32Array) ||
    !(c.rest instanceof Float32Array) ||
    !(c.kind instanceof Uint8Array) ||
    c.a.length !== c.b.length ||
    c.a.length !== c.rest.length ||
    c.a.length !== c.kind.length
  )
    issues.push('shape.constraints: a, b, rest and kind, one of each a constraint');
  else
    for (let i = 0; i < c.a.length; i++) {
      if (c.a[i] >= count || c.b[i] >= count) {
        issues.push(
          `shape.constraints[${i}]: particle ${Math.max(c.a[i], c.b[i])} is not there (${count} particles)`,
        );
        break;
      }
      if (c.a[i] === c.b[i]) {
        issues.push(`shape.constraints[${i}]: a particle cannot be held to itself`);
        break;
      }
      if (!(Number.isFinite(c.rest[i]) && c.rest[i] > 0)) {
        issues.push(`shape.constraints[${i}].rest: metres, more than 0`);
        break;
      }
      if (c.kind[i] > ZHUDA_CLOTH_SPAN) {
        issues.push(
          `shape.constraints[${i}].kind: 0 (structural), 1 (shear), 2 (bend) or 3 (span)`,
        );
        break;
      }
    }
  const vertices = s.particleOf instanceof Uint32Array ? s.particleOf.length : NaN;
  if (!Number.isInteger(vertices) || vertices < 3 || vertices > 65535)
    issues.push('shape.particleOf: a Uint32Array, one particle a vertex, 3 to 65535 vertices');
  else {
    for (let v = 0; v < vertices; v++)
      if (s.particleOf[v] >= count) {
        issues.push(`shape.particleOf[${v}]: particle ${s.particleOf[v]} is not there`);
        break;
      }
    if (!(s.uvs instanceof Float32Array) || s.uvs.length !== vertices * 2)
      issues.push('shape.uvs: a Float32Array, two numbers a vertex');
    if (!(s.indices instanceof Uint16Array) || !s.indices.length || s.indices.length % 3)
      issues.push('shape.indices: a Uint16Array, three vertices a triangle');
    else
      for (let i = 0; i < s.indices.length; i++)
        if (s.indices[i] >= vertices) {
          issues.push(`shape.indices[${i}]: vertex ${s.indices[i]} is not there`);
          break;
        }
  }
  return issues;
}

export interface ZhudaClothOptions {
  /** Seconds a step (default 1/240: four steps a frame at sixty frames a second; 1/1000 to 1/10). */
  step?: number;
  /** How many times a step goes over the constraints (default 2; 1 to 32). Smaller steps do more for a stiff cloth than more rounds. */
  rounds?: number;
  /** The most steps one `advance` runs; time over that is dropped (default 8, a thirtieth of a second; 1 to 64). */
  maxSteps?: number;
  /** Metres a second a second (default 0, -9.81, 0). */
  gravity?: ZhudaSimVec3;
  /** How fast a particle loses its speed whichever way it moves: the share it keeps after a second is `exp(-drag)` (default 1; 0 to 20). */
  drag?: number;
  /**
   * How much each kind of constraint gives: 0 is as stiff as the rounds
   * make it, more is softer. Defaults: structural 0, shear 3e-4, bend 2e-4
   * (0 to 1). A woven cloth gives little along its threads and much across
   * them: with a stiff shear a sheet behaves like a sheet of paper.
   */
  compliance?: { structural?: number; shear?: number; bend?: number };
  /** How far outside a body the cloth is kept, metres (default 0.01; 0 to 0.5). */
  thickness?: number;
  /**
   * How well the cloth grips a body it lies on (default 0.5; 0 to 4): it
   * stays on a slope whose rise over its run is less than this, and slides
   * on a steeper one.
   */
  friction?: number;
  /** The fastest a particle moves, metres a second (default 6; 0.1 to 100). See `ZhudaClothSolver` on thin bodies. */
  maxSpeed?: number;
  /** The air's velocity, metres a second (default none). */
  wind?: ZhudaSimVec3;
  /**
   * How hard the air that meets the cloth face on pushes it, a second
   * (default 2; 0 for no air; 0 to 50). It is what a wind blows a cloth
   * with, and what stops a cloth swinging: still air resists a cloth that
   * moves face on, and lets it slide edge on.
   */
  windDrag?: number;
  /**
   * How much farther from the pin it hangs from a particle may get than
   * the cloth between them is long, as a share (default 0.02; 0 to 1; false
   * for no such limit). Without it a cloth hung from few pins stretches
   * like rubber where it hangs: the rounds of a step pass a pull along
   * only a few particles at a time.
   */
  tether?: number | false;
  /** The fastest a hand that holds a particle moves, metres a second (default 10; 0.1 to 100). */
  grabSpeed?: number;
  /**
   * How far ahead of the cloth a hand may get, as a share of the weave's
   * spacing at the particle it holds (default 0.1; 0.01 to 2). A hand
   * pulls the particle to itself outright; held back to this, it cannot
   * tear the particle away from its neighbours faster than the weave
   * passes the pull on. Where the threads at the particle are stretched by
   * more than a twentieth (the cloth is taut) the hand's lead is cut, step
   * by step, to a sixty-fourth of this: a hand asked to go where the cloth
   * cannot reach waits at the cloth.
   */
  grabStretch?: number;
}

export interface ZhudaClothResolved {
  step: number;
  rounds: number;
  maxSteps: number;
  gravity: [number, number, number];
  drag: number;
  compliance: { structural: number; shear: number; bend: number };
  thickness: number;
  friction: number;
  maxSpeed: number;
  wind: [number, number, number];
  windDrag: number;
  tether: number | false;
  grabSpeed: number;
  grabStretch: number;
}

const OPTION_KEYS = [
  'step',
  'rounds',
  'maxSteps',
  'gravity',
  'drag',
  'compliance',
  'thickness',
  'friction',
  'maxSpeed',
  'wind',
  'windDrag',
  'tether',
  'grabSpeed',
  'grabStretch',
];

/** A cloth's options with their defaults. Throws, with the name, on one out of range or unknown. Pure. */
export function resolveZhudaClothOptions(options: ZhudaClothOptions = {}): ZhudaClothResolved {
  if (options === null || typeof options !== 'object') throw Error('Invalid cloth options');
  for (const key of Object.keys(options))
    if (!OPTION_KEYS.includes(key)) throw Error(`Unknown cloth option: ${key}`);
  const number = (name: string, value: unknown, fallback: number, min: number, max: number) => {
    if (value === undefined) return fallback;
    if (!(Number.isFinite(value) && (value as number) >= min && (value as number) <= max))
      throw Error(`Invalid ${name}: ${min} to ${max}`);
    return value as number;
  };
  const vector = (name: string, value: unknown, fallback: [number, number, number]) => {
    if (value === undefined) return fallback;
    if (!finite3(value)) throw Error(`Invalid ${name}: three finite numbers`);
    return [value[0], value[1], value[2]] as [number, number, number];
  };
  const rounds = options.rounds ?? 2;
  if (!whole(rounds, 1, 32)) throw Error('Invalid rounds: a whole number, 1 to 32');
  const give = options.compliance ?? {};
  if (give === null || typeof give !== 'object') throw Error('Invalid compliance');
  for (const key of Object.keys(give))
    if (!['structural', 'shear', 'bend'].includes(key))
      throw Error(`Unknown compliance: ${key} (structural, shear, bend)`);
  // The step and the cap are checked by the fixed step itself, with the same words.
  const fixed = new ZhudaFixedStep({
    step: options.step ?? 1 / 240,
    maxSteps: options.maxSteps ?? 8,
  });
  return {
    step: fixed.step,
    rounds,
    maxSteps: fixed.maxSteps,
    gravity: vector('gravity', options.gravity, [0, -9.81, 0]),
    drag: number('drag', options.drag, 1, 0, 20),
    compliance: {
      structural: number('compliance.structural', give.structural, 0, 0, 1),
      shear: number('compliance.shear', give.shear, 3e-4, 0, 1),
      bend: number('compliance.bend', give.bend, 2e-4, 0, 1),
    },
    thickness: number('thickness', options.thickness, 0.01, 0, 0.5),
    friction: number('friction', options.friction, 0.5, 0, 4),
    maxSpeed: number('maxSpeed', options.maxSpeed, 6, 0.1, 100),
    wind: vector('wind', options.wind, [0, 0, 0]),
    windDrag: number('windDrag', options.windDrag, 2, 0, 50),
    tether: options.tether === false ? false : number('tether', options.tether, 0.02, 0, 1),
    grabSpeed: number('grabSpeed', options.grabSpeed, 10, 0.1, 100),
    grabStretch: number('grabStretch', options.grabStretch, 0.1, 0.01, 2),
  };
}

export interface ZhudaClothReport {
  particles: number;
  constraints: number;
  triangles: number;
  colliders: number;
  pinned: number;
  grabbed: number;
  /** Steps run and steps dropped since the cloth was made or reset. */
  steps: number;
  dropped: number;
  /** Seconds of the clock gathered and not yet spent. */
  pendingSeconds: number;
  /** Particles deeper inside a body than a tenth of a millimetre. Pins are counted too. */
  inside: number;
  /** The most any weave constraint is longer than its rest length, as a share of it. */
  maxStretch: number;
  /** Half the sum of the squares of the particles' speeds (masses of one). */
  kineticEnergy: number;
  /** The smallest body radius a particle cannot cross in one step: `maxSpeed * step`. */
  safeRadius: number;
}

/**
 * A cloth in motion.
 *
 * Each step: every free particle keeps its motion (less the air's drag),
 * takes gravity and the wind, and moves, no faster than `maxSpeed`; then
 * `rounds` times the constraints pull particles back to their distances
 * and the bodies push them out; the bodies have the last word, so a step
 * ends with no particle inside one. A particle is tested where it is, not
 * along its path: it cannot cross a body whose radius is more than
 * `maxSpeed * step` (2.5 cm by default); a thinner body may be crossed by a
 * fast cloth, and `inspect().safeRadius` says where the line is.
 *
 * Positions are in one space, the world's unless the cloth's owner says
 * otherwise; bodies and pins are given in the same space and may be moved
 * between steps.
 */
export class ZhudaClothSolver {
  readonly shape: ZhudaClothShape;
  readonly options: ZhudaClothResolved;
  /** Where each particle is: three numbers each. Read it; write through `pin`, `movePin`, `reset`. */
  readonly positions: Float32Array;
  /** Where each particle was a step ago. */
  readonly previous: Float32Array;
  /** How far each particle's weave is stretched, as a share of its rest length; filled by `measureStrain`. */
  readonly strain: Float32Array;
  readonly count: number;
  private readonly clock: ZhudaFixedStep;
  private readonly inverseMass: Float32Array;
  private readonly lambda: Float32Array;
  private readonly alpha: Float32Array;
  private readonly triangles: Uint32Array;
  private readonly air: Float32Array;
  private readonly facing: Uint16Array;
  private readonly touched: Uint8Array;
  /** How far the bodies have pushed each particle back this step: how hard it presses on them. */
  private readonly pressed: Float32Array;
  private readonly normal: Float32Array;
  private readonly scratch = new Float64Array(6);
  private readonly bodies = new Map<number, ZhudaCollider>();
  /** Each table worked out for the step: its slopes, its widest radius. */
  private readonly tables = new Map<number, ZhudaTablePrepared>();

  private nextBody = 1;
  /** A hand's hold on a particle: where the hand is, where it wants to be, and what its hold has done this step. */
  private readonly hands = new Map<
    number,
    { at: Float64Array; to: Float64Array; slack: number; lead: number; threads: number[] }
  >();
  private readonly structuralCount: Uint16Array;
  /** For each particle: the pin it hangs from (-1: none) and how far from it it may get. */
  private readonly anchor: Int32Array;
  private readonly leash: Float32Array;
  private tethersStale = true;
  /** Rounds run in all: odd ones go over the constraints backwards. */
  private sweeps = 0;
  /** The weave as a graph, for finding how much cloth lies between a particle and a pin. */
  private readonly neighbours: { start: Uint32Array; to: Uint32Array; far: Float32Array };
  private disposed = false;

  constructor(shape: ZhudaClothShape, options: ZhudaClothOptions = {}) {
    const issues = validateZhudaClothShape(shape);
    if (issues.length) throw Error(`Invalid cloth shape: ${issues.join('; ')}`);
    this.shape = shape;
    this.options = resolveZhudaClothOptions(options);
    this.clock = new ZhudaFixedStep(this.options);
    this.count = shape.particles.length / 3;
    this.positions = Float32Array.from(shape.particles);
    this.previous = Float32Array.from(shape.particles);
    this.strain = new Float32Array(this.count);
    this.inverseMass = new Float32Array(this.count).fill(1);
    const constraints = shape.constraints.a.length;
    this.lambda = new Float32Array(constraints);
    this.alpha = new Float32Array(constraints);
    this.setCompliance(this.options.compliance);
    // The triangles by particle, for the air; a seam's two vertices are one particle.
    const { indices, particleOf } = shape;
    const triangles: number[] = [];
    for (let t = 0; t < indices.length; t += 3) {
      const a = particleOf[indices[t]],
        b = particleOf[indices[t + 1]],
        c = particleOf[indices[t + 2]];
      if (a !== b && b !== c && c !== a) triangles.push(a, b, c);
    }
    this.triangles = Uint32Array.from(triangles);
    this.air = new Float32Array(this.count * 3);
    this.facing = new Uint16Array(this.count);
    for (const p of this.triangles) this.facing[p]++;
    this.touched = new Uint8Array(this.count);

    this.pressed = new Float32Array(this.count);
    this.normal = new Float32Array(this.count * 3);
    this.structuralCount = new Uint16Array(this.count);
    const { a, b, kind } = shape.constraints;
    for (let i = 0; i < constraints; i++)
      if (kind[i] === ZHUDA_CLOTH_STRUCTURAL) {
        this.structuralCount[a[i]]++;
        this.structuralCount[b[i]]++;
      }
    this.anchor = new Int32Array(this.count).fill(-1);
    this.leash = new Float32Array(this.count);
    // The weave and its diagonals (not the constraints that keep it flat: they skip a particle).
    const { rest } = shape.constraints;
    const degree = new Uint32Array(this.count + 1);
    for (let i = 0; i < constraints; i++)
      if (kind[i] !== ZHUDA_CLOTH_BEND) {
        degree[a[i] + 1]++;
        degree[b[i] + 1]++;
      }
    for (let i = 0; i < this.count; i++) degree[i + 1] += degree[i];
    const to = new Uint32Array(degree[this.count]),
      far = new Float32Array(degree[this.count]),
      fill = Uint32Array.from(degree.subarray(0, this.count));
    for (let i = 0; i < constraints; i++)
      if (kind[i] !== ZHUDA_CLOTH_BEND) {
        to[fill[a[i]]] = b[i];
        far[fill[a[i]]++] = rest[i];
        to[fill[b[i]]] = a[i];
        far[fill[b[i]]++] = rest[i];
      }
    this.neighbours = { start: degree, to, far };
  }

  /**
   * For every particle, the pin with the least cloth between them and how
   * much that is: the shortest way along the weave and its diagonals, which
   * is never shorter than the cloth itself, so the limit never forbids a
   * shape the cloth could take. Worked out again when a pin is set or let
   * go, not when one is moved.
   */
  private tether() {
    this.tethersStale = false;
    const { anchor, leash, count } = this,
      { start, to, far } = this.neighbours;
    anchor.fill(-1);
    const reach = new Float64Array(count).fill(Infinity);
    // The nearest first, from a heap ordered by how far along the weave each is.
    const heap: number[] = [];
    const push = (i: number) => {
      heap.push(i);
      let at = heap.length - 1;
      while (at > 0) {
        const up = (at - 1) >> 1;
        // Ties go to the lower particle, so the order is the same every time.
        if (reach[heap[up]] < reach[i] || (reach[heap[up]] === reach[i] && heap[up] < i)) break;
        heap[at] = heap[up];
        at = up;
      }
      heap[at] = i;
    };
    const pop = () => {
      const top = heap[0],
        last = heap.pop() as number;
      if (heap.length) {
        let at = 0;
        for (;;) {
          let child = at * 2 + 1;
          if (child >= heap.length) break;
          const other = child + 1;
          if (
            other < heap.length &&
            (reach[heap[other]] < reach[heap[child]] ||
              (reach[heap[other]] === reach[heap[child]] && heap[other] < heap[child]))
          )
            child = other;
          if (
            reach[last] < reach[heap[child]] ||
            (reach[last] === reach[heap[child]] && last < heap[child])
          )
            break;
          heap[at] = heap[child];
          at = child;
        }
        heap[at] = last;
      }
      return top;
    };
    for (let i = 0; i < count; i++)
      if (this.inverseMass[i] === 0) {
        reach[i] = 0;
        anchor[i] = i;
        push(i);
      }
    const done = new Uint8Array(count);
    while (heap.length) {
      const i = pop();
      if (done[i]) continue;
      done[i] = 1;
      for (let k = start[i]; k < start[i + 1]; k++) {
        const j = to[k],
          next = reach[i] + far[k];
        if (next < reach[j]) {
          reach[j] = next;
          anchor[j] = anchor[i];
          push(j);
        }
      }
    }
    const slack = 1 + (this.options.tether === false ? 0 : this.options.tether);
    for (let i = 0; i < count; i++) {
      leash[i] = Number.isFinite(reach[i]) ? reach[i] * slack : 0;
      if (this.inverseMass[i] === 0) anchor[i] = -1;
    }
  }

  private alive() {
    if (this.disposed) throw Error('Disposed cloth');
  }
  private particle(index: number, what = 'particle') {
    if (!Number.isInteger(index) || index < 0 || index >= this.count)
      throw Error(`Invalid ${what}: 0 to ${this.count - 1}`);
  }

  /** How much each kind of constraint gives, from now on. */
  setCompliance(compliance: { structural?: number; shear?: number; bend?: number }) {
    this.alive();
    const next = resolveZhudaClothOptions({
      compliance: { ...this.options.compliance, ...compliance },
    }).compliance;
    this.options.compliance = next;
    const by = [next.structural, next.shear, next.bend, 0],
      { kind } = this.shape.constraints,
      dt2 = this.options.step * this.options.step;
    for (let i = 0; i < kind.length; i++) this.alpha[i] = by[kind[i]] / dt2;
  }
  setGravity(x: number, y: number, z: number) {
    this.alive();
    this.options.gravity = resolveZhudaClothOptions({ gravity: [x, y, z] }).gravity;
  }
  /** The air's velocity and how hard it pushes, from now on. */
  setWind(x: number, y: number, z: number, windDrag = this.options.windDrag) {
    this.alive();
    const next = resolveZhudaClothOptions({ wind: [x, y, z], windDrag });
    this.options.wind = next.wind;
    this.options.windDrag = next.windDrag;
  }

  /**
   * Holds a particle where it is, or at a place. It no longer falls, and
   * no body moves it.
   */
  pin(index: number, at?: ZhudaSimVec3) {
    this.alive();
    this.particle(index);
    if (this.hands.has(index)) throw Error(`Particle ${index} is held by a hand: release it first`);
    if (at !== undefined && !finite3(at)) throw Error('Invalid place: three finite numbers');
    this.inverseMass[index] = 0;
    this.tethersStale = true;
    if (at) this.positions.set(at, index * 3);
    this.previous.set(this.positions.subarray(index * 3, index * 3 + 3), index * 3);
  }
  /**
   * Moves a pinned particle: with what it hangs from, each frame, a little
   * at a time. For a jump, `shift` the cloth.
   */
  movePin(index: number, x: number, y: number, z: number) {
    this.alive();
    this.particle(index);
    if (this.inverseMass[index] !== 0) throw Error(`Particle ${index} is not pinned`);
    if (![x, y, z].every(Number.isFinite)) throw Error('Invalid place: three finite numbers');
    this.positions.set([x, y, z], index * 3);
    this.previous.set([x, y, z], index * 3);
  }
  unpin(index: number) {
    this.alive();
    this.particle(index);
    if (this.inverseMass[index] !== 0) throw Error(`Particle ${index} is not pinned`);
    this.inverseMass[index] = 1;
    this.tethersStale = true;
  }
  isPinned(index: number): boolean {
    this.particle(index);
    return this.inverseMass[index] === 0;
  }

  /**
   * A hand takes hold of a particle where it is. `dragTo` then says where
   * the hand wants to be; it goes there no faster than `grabSpeed`, and
   * the particle follows as far as the cloth lets it.
   */
  grab(index: number) {
    this.alive();
    this.particle(index);
    if (this.inverseMass[index] === 0)
      throw Error(`Particle ${index} is pinned: unpin it before a hand takes it`);
    if (this.hands.has(index)) throw Error(`Particle ${index} is held already`);
    const at = Float64Array.from(this.positions.subarray(index * 3, index * 3 + 3));
    // The weave's spacing here: the shortest thread the particle is held by.
    const { a, b, rest, kind } = this.shape.constraints;
    let spacing = Infinity;
    const threads: number[] = [];
    for (let i = 0; i < a.length; i++)
      if (kind[i] === ZHUDA_CLOTH_STRUCTURAL && (a[i] === index || b[i] === index)) {
        spacing = Math.min(spacing, rest[i]);
        threads.push(i);
      }
    if (!Number.isFinite(spacing)) spacing = 0.05;
    this.hands.set(index, {
      at,
      to: Float64Array.from(at),
      slack: spacing * this.options.grabStretch,
      lead: spacing * this.options.grabStretch,
      threads,
    });
  }
  dragTo(index: number, x: number, y: number, z: number) {
    this.alive();
    const hand = this.hands.get(index);
    if (!hand) throw Error(`Particle ${index} is not held`);
    if (![x, y, z].every(Number.isFinite)) throw Error('Invalid place: three finite numbers');
    hand.to.set([x, y, z]);
  }
  /** The hand lets go; the particle keeps the motion it had. */
  release(index: number) {
    this.alive();
    if (!this.hands.delete(index)) throw Error(`Particle ${index} is not held`);
  }
  isGrabbed(index: number): boolean {
    return this.hands.has(index);
  }
  /** Where the hand that holds a particle is now. */
  handOf(index: number): [number, number, number] {
    const hand = this.hands.get(index);
    if (!hand) throw Error(`Particle ${index} is not held`);
    return [hand.at[0], hand.at[1], hand.at[2]];
  }

  /**
   * The particle a ray (a pointer's, from the camera) would touch: of the
   * layer of cloth it comes to first, the particle it passes closest to; -1
   * when none is within `reach` metres of it. `direction` need not be a
   * unit.
   */
  nearestToRay(origin: ZhudaSimVec3, direction: ZhudaSimVec3, reach = 0.1): number {
    this.alive();
    if (!finite3(origin) || !finite3(direction))
      throw Error('Invalid ray: an origin and a direction of three finite numbers');
    if (!(Number.isFinite(reach) && reach > 0)) throw Error('Invalid reach: metres, more than 0');
    const d = unit(direction, 'direction');
    const p = this.positions;
    // The nearest layer of cloth the ray passes within reach of...
    let front = Infinity;
    for (let i = 0; i < this.count; i++) {
      const x = p[i * 3] - origin[0],
        y = p[i * 3 + 1] - origin[1],
        z = p[i * 3 + 2] - origin[2];
      const along = x * d[0] + y * d[1] + z * d[2];
      if (along < 0 || along >= front) continue;
      if (x * x + y * y + z * z - along * along <= reach * reach) front = along;
    }
    if (front === Infinity) return -1;
    // ...and of that layer, the particle the ray passes closest to.
    let best = -1,
      bestOff = Infinity;
    for (let i = 0; i < this.count; i++) {
      const x = p[i * 3] - origin[0],
        y = p[i * 3 + 1] - origin[1],
        z = p[i * 3 + 2] - origin[2];
      const along = x * d[0] + y * d[1] + z * d[2];
      if (along < 0 || along > front + reach) continue;
      const off = x * x + y * y + z * z - along * along;
      if (off <= reach * reach && off < bestOff) {
        best = i;
        bestOff = off;
      }
    }
    return best;
  }

  /** Adds a body the cloth is kept out of; returns a number to move or remove it by. */
  addCollider(collider: ZhudaCollider): number {
    this.alive();
    const issues = validateZhudaCollider(collider);
    if (issues.length) throw Error(`Invalid collider: ${issues.join('; ')}`);
    const id = this.nextBody++;
    this.bodies.set(id, collider);
    return id;
  }
  /** Puts another body in a body's place (it moved, it changed shape). */
  setCollider(id: number, collider: ZhudaCollider) {
    this.alive();
    if (!this.bodies.has(id)) throw Error(`No collider ${id}`);
    const issues = validateZhudaCollider(collider);
    if (issues.length) throw Error(`Invalid collider: ${issues.join('; ')}`);
    this.bodies.set(id, collider);
  }
  removeCollider(id: number) {
    this.alive();
    if (!this.bodies.delete(id)) throw Error(`No collider ${id}`);
    this.tables.delete(id);
  }
  get colliders(): ReadonlyMap<number, ZhudaCollider> {
    return this.bodies;
  }

  /**
   * Takes a delta of the clock, in seconds, and runs the whole steps it
   * holds with what was left over before. Zero changes nothing. Returns
   * how many steps ran and how many were dropped for being over the cap.
   */
  advance(deltaSeconds: number): { steps: number; dropped: number } {
    this.alive();
    const before = this.clock.dropped;
    const steps = this.clock.take(deltaSeconds);
    for (let i = 0; i < steps; i++) this.stepOnce();
    return { steps, dropped: this.clock.dropped - before };
  }

  /**
   * Carries the whole cloth somewhere else as it is: every particle, pin
   * and hand moved by the same amount, its motion kept. For when what it
   * hangs from is put elsewhere at once (a character set down at another
   * place): pins moved far in one frame would throw the cloth after them.
   * The bodies are their owner's to move.
   */
  shift(x: number, y: number, z: number) {
    this.alive();
    if (![x, y, z].every(Number.isFinite)) throw Error('Invalid shift: three finite numbers');
    const p = this.positions,
      q = this.previous;
    for (let k = 0; k < p.length; k += 3) {
      p[k] += x;
      p[k + 1] += y;
      p[k + 2] += z;
      q[k] += x;
      q[k + 1] += y;
      q[k + 2] += z;
    }
    for (const hand of this.hands.values()) {
      hand.at[0] += x;
      hand.at[1] += y;
      hand.at[2] += z;
      hand.to[0] += x;
      hand.to[1] += y;
      hand.to[2] += z;
    }
  }

  /** Back to the shape it was made in, at rest; pins, hands and bodies stay. */
  reset() {
    this.alive();
    for (let i = 0; i < this.count; i++)
      if (this.inverseMass[i] !== 0) {
        this.positions.set(this.shape.particles.subarray(i * 3, i * 3 + 3), i * 3);
        this.previous.set(this.shape.particles.subarray(i * 3, i * 3 + 3), i * 3);
      }
    for (const [index, hand] of this.hands) {
      hand.at.set(this.positions.subarray(index * 3, index * 3 + 3));
      hand.to.set(hand.at);
    }
    this.clock.reset();
    this.sweeps = 0;
  }

  private stepOnce() {
    const o = this.options,
      dt = o.step,
      p = this.positions,
      q = this.previous,
      w = this.inverseMass,
      n = this.count;
    const keep = Math.exp(-o.drag * dt),
      limit = o.maxSpeed * dt,
      gx = o.gravity[0] * dt * dt,
      gy = o.gravity[1] * dt * dt,
      gz = o.gravity[2] * dt * dt;
    // The air: each triangle is pushed along its own normal by the air that meets it.
    const air = this.air;
    if (o.windDrag > 0) {
      air.fill(0);
      const t = this.triangles;
      for (let i = 0; i < t.length; i += 3) {
        const a = t[i] * 3,
          b = t[i + 1] * 3,
          c = t[i + 2] * 3;
        const ux = p[b] - p[a],
          uy = p[b + 1] - p[a + 1],
          uz = p[b + 2] - p[a + 2],
          vx = p[c] - p[a],
          vy = p[c + 1] - p[a + 1],
          vz = p[c + 2] - p[a + 2];
        let nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        const size = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (!(size > 1e-12)) continue;
        nx /= size;
        ny /= size;
        nz /= size;
        // The air's velocity as the triangle sees it: the wind less its own motion.
        const rx = o.wind[0] - (p[a] - q[a] + p[b] - q[b] + p[c] - q[c]) / (3 * dt),
          ry =
            o.wind[1] -
            (p[a + 1] - q[a + 1] + p[b + 1] - q[b + 1] + p[c + 1] - q[c + 1]) / (3 * dt),
          rz =
            o.wind[2] -
            (p[a + 2] - q[a + 2] + p[b + 2] - q[b + 2] + p[c + 2] - q[c + 2]) / (3 * dt);
        const push = nx * rx + ny * ry + nz * rz,
          px = nx * push,
          py = ny * push,
          pz = nz * push;
        air[a] += px;
        air[a + 1] += py;
        air[a + 2] += pz;
        air[b] += px;
        air[b + 1] += py;
        air[b + 2] += pz;
        air[c] += px;
        air[c + 1] += py;
        air[c + 2] += pz;
      }
    }
    const blow = o.windDrag * dt * dt;
    for (let i = 0; i < n; i++) {
      if (w[i] === 0) continue;
      const k = i * 3;
      let vx = (p[k] - q[k]) * keep + gx,
        vy = (p[k + 1] - q[k + 1]) * keep + gy,
        vz = (p[k + 2] - q[k + 2]) * keep + gz;
      if (blow > 0 && this.facing[i]) {
        const share = blow / this.facing[i];
        vx += air[k] * share;
        vy += air[k + 1] * share;
        vz += air[k + 2] * share;
      }
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (speed > limit) {
        const slow = limit / speed;
        vx *= slow;
        vy *= slow;
        vz *= slow;
      }
      q[k] = p[k];
      q[k + 1] = p[k + 1];
      q[k + 2] = p[k + 2];
      p[k] += vx;
      p[k + 1] += vy;
      p[k + 2] += vz;
    }
    // Each hand goes toward where it wants to be, no faster than it may, and
    // no farther ahead of the particle it holds than its slack.
    const reach = o.grabSpeed * dt;
    for (const hand of this.hands.values()) {
      const dx = hand.to[0] - hand.at[0],
        dy = hand.to[1] - hand.at[1],
        dz = hand.to[2] - hand.at[2];
      const far = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const share = far > reach ? reach / far : 1;
      hand.at[0] += dx * share;
      hand.at[1] += dy * share;
      hand.at[2] += dz * share;
    }
    this.leashHands(false);
    const { a, b, rest, kind } = this.shape.constraints,
      lambda = this.lambda,
      alpha = this.alpha;
    lambda.fill(0);
    this.touched.fill(0);
    this.pressed.fill(0);
    this.prepareTables();
    const tethered = o.tether !== false;
    if (tethered && this.tethersStale) this.tether();
    const anchor = this.anchor,
      leash = this.leash;
    for (let round = 0; round < o.rounds; round++) {
      // The hands first, the weave after: where the two disagree the cloth wins and the hand lags.
      for (const [index, hand] of this.hands) {
        const k = index * 3;
        p[k] = hand.at[0];
        p[k + 1] = hand.at[1];
        p[k + 2] = hand.at[2];
      }
      // Over the constraints one way, then the other: a pull is passed on both ways alike.
      const backwards = (this.sweeps++ & 1) === 1,
        total = a.length;
      for (let at = 0; at < total; at++) {
        const i = backwards ? total - 1 - at : at;
        const ka = a[i] * 3,
          kb = b[i] * 3,
          wa = w[a[i]],
          wb = w[b[i]];
        if (wa + wb === 0) continue;
        const dx = p[ka] - p[kb],
          dy = p[ka + 1] - p[kb + 1],
          dz = p[ka + 2] - p[kb + 2];
        const far = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!(far > 1e-12)) continue;
        let change: number;
        if (kind[i] === ZHUDA_CLOTH_SPAN) {
          // Nearer is free; no farther than the thread between is long.
          const most = rest[i] * SPAN_SLACK;
          if (far <= most) continue;
          change = (most - far) / (wa + wb);
        } else {
          change = (rest[i] - far - alpha[i] * lambda[i]) / (wa + wb + alpha[i]);
          lambda[i] += change;
        }
        const sx = (dx / far) * change,
          sy = (dy / far) * change,
          sz = (dz / far) * change;
        p[ka] += sx * wa;
        p[ka + 1] += sy * wa;
        p[ka + 2] += sz * wa;
        p[kb] -= sx * wb;
        p[kb + 1] -= sy * wb;
        p[kb + 2] -= sz * wb;
      }
      // No particle farther from the pin it hangs from than the cloth between them is long.
      if (tethered)
        for (let i = 0; i < n; i++) {
          const pin = anchor[i];
          if (pin < 0) continue;
          const k = i * 3,
            kp = pin * 3;
          const dx = p[k] - p[kp],
            dy = p[k + 1] - p[kp + 1],
            dz = p[k + 2] - p[kp + 2];
          const far = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (far <= leash[i]) continue;
          const back = leash[i] / far;
          p[k] = p[kp] + dx * back;
          p[k + 1] = p[kp + 1] + dy * back;
          p[k + 2] = p[kp + 2] + dz * back;
        }
      // (After the last round the bodies are asked below.)
      if (round < o.rounds - 1) this.pushOut();
    }
    if (this.bodies.size) {
      // Where each particle touches a body, and which way that body faces there.
      this.pushOut();
      // Where a particle touches a body it grips it: how hard it was pressed in
      // (how far the body pushed it back this step) times the friction is how
      // much of its sliding the body takes away. A particle pressed harder than
      // it slides stays put, so a cloth lies on a slope less steep than its
      // friction; one that slides more keeps the rest. Its motion into the
      // body is gone.
      const grip = o.friction,
        normal = this.normal,
        pressed = this.pressed;
      for (let i = 0, k = 0; i < n; i++, k += 3) {
        if (!this.touched[i]) continue;
        const vx = p[k] - q[k],
          vy = p[k + 1] - q[k + 1],
          vz = p[k + 2] - q[k + 2];
        const into = vx * normal[k] + vy * normal[k + 1] + vz * normal[k + 2];
        let tx = vx - normal[k] * into,
          ty = vy - normal[k + 1] * into,
          tz = vz - normal[k + 2] * into;
        const slide = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (slide > 1e-12 && grip > 0) {
          const held = grip * pressed[i],
            taken = held >= slide ? 1 : held / slide;
          p[k] -= tx * taken;
          p[k + 1] -= ty * taken;
          p[k + 2] -= tz * taken;
          tx *= 1 - taken;
          ty *= 1 - taken;
          tz *= 1 - taken;
        }
        const away = into > 0 ? into : 0;
        q[k] = p[k] - (tx + normal[k] * away);
        q[k + 1] = p[k + 1] - (ty + normal[k + 1] * away);
        q[k + 2] = p[k + 2] - (tz + normal[k + 2] * away);
      }
      // The bodies have the last word: held back along a curved body, or pushed
      // out of one body into another, a particle may be inside one again. Out of
      // one body is out of it for good; where there are several they are asked
      // again, a few times.
      if (this.pushOut() && this.bodies.size > 1)
        for (let pass = 0; pass < 3 && this.pushOut(); pass++);
    }
    // Where the cloth pulled a held particle back, its hand comes back with it.
    this.leashHands(true);
  }

  /**
   * No hand farther from the particle it holds than its lead. After a
   * step the lead is set for the next one: halved where the threads at the
   * particle are stretched by more than a twentieth (the cloth is taut:
   * pulling harder would only stretch the weave at the hand), grown again
   * where they are not. So a hand moves a slack cloth briskly and waits at
   * a taut one.
   */
  private leashHands(after: boolean) {
    const p = this.positions,
      { a, b, rest } = this.shape.constraints;
    for (const [index, hand] of this.hands) {
      const k = index * 3;
      if (after) {
        let stretched = 0;
        for (const i of hand.threads) {
          const ka = a[i] * 3,
            kb = b[i] * 3;
          const far = Math.hypot(p[ka] - p[kb], p[ka + 1] - p[kb + 1], p[ka + 2] - p[kb + 2]);
          stretched = Math.max(stretched, far / rest[i] - 1);
        }
        hand.lead =
          stretched > 0.05
            ? Math.max(hand.lead * 0.5, hand.slack / 64)
            : Math.min(hand.lead * 1.5, hand.slack);
      }
      const dx = hand.at[0] - p[k],
        dy = hand.at[1] - p[k + 1],
        dz = hand.at[2] - p[k + 2];
      const far = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (far > hand.lead) {
        const back = hand.lead / far;
        hand.at[0] = p[k] + dx * back;
        hand.at[1] = p[k + 1] + dy * back;
        hand.at[2] = p[k + 2] + dz * back;
      }
    }
  }

  /**
   * Pushes every free particle out of every body; says whether any was
   * moved. A floor, a ball and a rod are worked out here, over all the
   * particles at once, by the arithmetic `zhudaColliderDepth` does a point
   * at a time (the two are held to each other by `countInside`, which asks
   * it); a table is asked there.
   */
  private pushOut(): boolean {
    if (!this.bodies.size) return false;
    const p = this.positions,
      w = this.inverseMass,
      normal = this.normal,
      touched = this.touched,
      pressed = this.pressed,
      n = this.count,
      margin = this.options.thickness;
    let moved = false;
    for (const [id, body] of this.bodies) {
      if (body.type === 'plane') {
        const nx = body.normal[0],
          ny = body.normal[1],
          nz = body.normal[2],
          level = body.point[0] * nx + body.point[1] * ny + body.point[2] * nz + margin;
        for (let i = 0, k = 0; i < n; i++, k += 3) {
          if (w[i] === 0) continue;
          const depth = level - (p[k] * nx + p[k + 1] * ny + p[k + 2] * nz);
          if (depth <= ON_THE_SKIN) continue;
          p[k] += nx * depth;
          p[k + 1] += ny * depth;
          p[k + 2] += nz * depth;
          normal[k] = nx;
          normal[k + 1] = ny;
          normal[k + 2] = nz;
          touched[i] = 1;
          pressed[i] += depth;
          moved = true;
        }
      } else if (body.type === 'sphere' || body.type === 'capsule') {
        const rod = body.type === 'capsule',
          from = rod ? body.a : body.center,
          ax = from[0],
          ay = from[1],
          az = from[2],
          abx = rod ? body.b[0] - ax : 0,
          aby = rod ? body.b[1] - ay : 0,
          abz = rod ? body.b[2] - az : 0,
          span = abx * abx + aby * aby + abz * abz,
          reach = body.radius + margin,
          reach2 = reach * reach;
        for (let i = 0, k = 0; i < n; i++, k += 3) {
          if (w[i] === 0) continue;
          let dx = p[k] - ax,
            dy = p[k + 1] - ay,
            dz = p[k + 2] - az;
          let cx = ax,
            cy = ay,
            cz = az;
          if (span > 1e-18) {
            let t = (dx * abx + dy * aby + dz * abz) / span;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            cx += abx * t;
            cy += aby * t;
            cz += abz * t;
            dx = p[k] - cx;
            dy = p[k + 1] - cy;
            dz = p[k + 2] - cz;
          }
          const far2 = dx * dx + dy * dy + dz * dz;
          if (far2 >= reach2) continue;
          const far = Math.sqrt(far2);
          if (reach - far <= ON_THE_SKIN) continue;
          // A point at the very middle has no way out of its own: up.
          const ux = far > 1e-9 ? dx / far : 0,
            uy = far > 1e-9 ? dy / far : 1,
            uz = far > 1e-9 ? dz / far : 0;
          p[k] = cx + ux * reach;
          p[k + 1] = cy + uy * reach;
          p[k + 2] = cz + uz * reach;
          normal[k] = ux;
          normal[k + 1] = uy;
          normal[k + 2] = uz;
          touched[i] = 1;
          pressed[i] += reach - far;
          moved = true;
        }
      } else {
        const out = this.scratch,
          prepared = this.tables.get(id);
        for (let i = 0, k = 0; i < n; i++, k += 3) {
          if (w[i] === 0) continue;
          const depth = zhudaColliderDepth(body, margin, p[k], p[k + 1], p[k + 2], out, prepared);
          if (depth <= ON_THE_SKIN) continue;
          p[k] = out[0];
          p[k + 1] = out[1];
          p[k + 2] = out[2];
          normal[k] = out[3];
          normal[k + 1] = out[4];
          normal[k + 2] = out[5];
          touched[i] = 1;
          pressed[i] += depth;
          moved = true;
        }
      }
    }
    return moved;
  }

  /** Each table worked out as it is now (a body may have been moved or changed since the last step). */
  private prepareTables() {
    for (const [id, body] of this.bodies)
      if (body.type === 'table') this.tables.set(id, prepareZhudaTable(body, this.tables.get(id)));
  }

  /**
   * How many particles are inside a body by more than `tolerance` metres
   * (default a tenth of a millimetre; single precision moves a particle put
   * on a surface by less). `margin` is how far outside the body the surface
   * counted from is: the cloth's thickness by default, 0 for the body
   * itself. Pins are counted.
   */
  countInside(tolerance = 1e-4, margin = this.options.thickness): number {
    this.alive();
    this.prepareTables();
    const p = this.positions;
    let inside = 0;
    for (let i = 0; i < this.count; i++)
      for (const [id, body] of this.bodies)
        if (
          zhudaColliderDepth(
            body,
            margin,
            p[i * 3],
            p[i * 3 + 1],
            p[i * 3 + 2],
            undefined,
            this.tables.get(id),
          ) > tolerance
        ) {
          inside++;
          break;
        }
    return inside;
  }

  /**
   * Fills `strain` with how far each particle's weave is stretched (the
   * mean over its structural constraints of how much longer than its rest
   * length each is, as a share; 0 where it is slack) and returns the most
   * any one constraint is stretched.
   */
  measureStrain(): number {
    this.alive();
    const { a, b, rest, kind } = this.shape.constraints,
      p = this.positions,
      strain = this.strain;
    strain.fill(0);
    let most = 0;
    for (let i = 0; i < a.length; i++) {
      if (kind[i] !== ZHUDA_CLOTH_STRUCTURAL) continue;
      const ka = a[i] * 3,
        kb = b[i] * 3;
      const far = Math.hypot(p[ka] - p[kb], p[ka + 1] - p[kb + 1], p[ka + 2] - p[kb + 2]);
      const longer = Math.max(0, far / rest[i] - 1);
      strain[a[i]] += longer;
      strain[b[i]] += longer;
      if (longer > most) most = longer;
    }
    for (let i = 0; i < this.count; i++)
      if (this.structuralCount[i]) strain[i] /= this.structuralCount[i];
    return most;
  }

  inspect(): ZhudaClothReport {
    this.alive();
    const p = this.positions,
      q = this.previous,
      dt = this.options.step;
    let energy = 0,
      pinned = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.inverseMass[i] === 0) pinned++;
      const k = i * 3;
      const vx = (p[k] - q[k]) / dt,
        vy = (p[k + 1] - q[k + 1]) / dt,
        vz = (p[k + 2] - q[k + 2]) / dt;
      energy += 0.5 * (vx * vx + vy * vy + vz * vz);
    }
    return {
      particles: this.count,
      constraints: this.shape.constraints.a.length,
      triangles: this.triangles.length / 3,
      colliders: this.bodies.size,
      pinned,
      grabbed: this.hands.size,
      steps: this.clock.steps,
      dropped: this.clock.dropped,
      pendingSeconds: this.clock.pendingSeconds,
      inside: this.countInside(),
      maxStretch: this.measureStrain(),
      kineticEnergy: energy,
      safeRadius: this.options.maxSpeed * dt,
    };
  }

  /** Lets go of everything; the cloth takes no more calls. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.bodies.clear();
    this.hands.clear();
  }
}
