// Two legs from the reference page's cross-sections, a sheer stocking 0.011
// units off the skin, and the stocking pulled by a hand: the same arithmetic
// as the reference (its pull, its stretch, its limit under the skirt). The
// legs are described in their own units; `LT` metres a unit puts the foot on
// the floor and the waist a metre up.
import { ZhudaDynamicMesh } from 'zhuda-laya-engine';

export const AROUND = 144,
  /** Foot and waist, in leg units. */
  BASE = -2.59,
  /** The floor, under the feet: the ankle (the legs' lowest ring) stands 0.38 units (8 cm) above it. */
  FLOOR = BASE - 0.38,
  TOP = 2.3,
  SPAN = TOP - BASE,
  UP = Math.round((152 * SPAN) / 3.45),
  KNEE = -0.49,
  /** Where the skirt's hem stops a pull from going higher, leg units. */
  HEM_LIMIT = 1.61,
  /** Metres a leg unit. */
  LT = 1.02 / (2.23 + 2.59),
  /** Tiles of knit round the leg and up it (a tile is one wale by two courses). */
  TILES_U = 302,
  TILES_V = Math.round((192 * SPAN) / 3.45),
  /** How far the stocking stands off the skin, units. */
  LIFT = 0.011;
const COLUMNS = AROUND + 1;

// Height, half-width, half-depth, how far the centre sits inward, forward.
// The rows from -1.72 up are the reference's; the two below carry the calf to the ankle.
const SECTIONS = [
  [-2.59, 0.2, 0.226, 0.045, 0.0],
  [-2.2, 0.24, 0.27, 0.04, -0.01],
  [-1.72, 0.291, 0.33, 0.035, -0.006],
  [-1.29, 0.335, 0.369, 0.025, -0.032],
  [-0.98, 0.345, 0.341, 0.008, -0.006],
  [-0.7, 0.334, 0.343, -0.013, 0.052],
  [-0.43, 0.351, 0.378, -0.027, 0.095],
  [-0.16, 0.387, 0.397, -0.034, 0.064],
  [0.24, 0.443, 0.44, -0.042, 0.012],
  [0.68, 0.493, 0.475, -0.055, -0.023],
  [1.11, 0.513, 0.502, -0.083, -0.046],
  [1.73, 0.53, 0.51, -0.109, -0.061],
];
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smoothstep = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const smootherstep = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

function section(y: number, column: number): number {
  let at = 0;
  while (at < SECTIONS.length - 2 && y > SECTIONS[at + 1][0]) at++;
  const before = SECTIONS[Math.max(at - 1, 0)],
    from = SECTIONS[at],
    to = SECTIONS[at + 1],
    after = SECTIONS[Math.min(at + 2, SECTIONS.length - 1)];
  const span = to[0] - from[0],
    t = clamp((y - from[0]) / span, 0, 1);
  const m0 = ((to[column] - before[column]) * span) / (to[0] - before[0]),
    m1 = ((after[column] - from[column]) * span) / (after[0] - from[0]);
  return from[column] + t * (m0 + t * (3 * (to[column] - from[column]) - 2 * m0 - m1 + t * (2 * (from[column] - to[column]) + m0 + m1)));
}

const rowY = (row: number) => BASE + (SPAN * row) / UP;

/**
 * The reference's sections are for a close look at thighs: below the thigh they
 * run too wide for a whole leg (knee about a quarter, ankle a fifth). This
 * narrows them by height toward a slim adult leg: thighs as they are, the knee,
 * the shin and the ankle slimmer.
 */
function slimAt(y: number): number {
  const stations = [
    [-2.59, 0.76],
    [-2.2, 0.74],
    [-1.72, 0.8],
    [-1.1, 0.88],
    [-0.75, 0.84],
    [-0.45, 0.8],
    [-0.1, 0.86],
    [0.5, 0.95],
    [1.0, 1.0],
  ];
  let i = 0;
  while (i < stations.length - 2 && y > stations[i + 1][0]) i++;
  const [y0, a] = stations[i],
    [y1, b] = stations[i + 1];
  const t = clamp((y - y0) / (y1 - y0), 0, 1);
  return a + (b - a) * t * t * (3 - 2 * t);
}
export const rowOf = (y: number) => ((y - BASE) / SPAN) * UP;

export interface Leg {
  side: number;
  skin: ZhudaDynamicMesh;
  hosiery: ZhudaDynamicMesh;
  /** Leg units, three a vertex. */
  skinRest: Float32Array;
  rest: Float32Array;
  current: Float32Array;
  /** The way out of the leg at each vertex, in the ground plane. */
  outX: Float32Array;
  outZ: Float32Array;
  /** One over the rest distance to the next vertex round and up. */
  invU: Float32Array;
  invV: Float32Array;
  strain: Float32Array;
  normals: Float32Array;
  /** Where the leg's axis is at the top of the thigh, units (for the skirt's bodies). */
  axis: [number, number];
  /** How far a full pull carries this surface, against a stocking (1). */
  reach: number;
}

function grid(): { uvs: Float32Array; indices: Uint16Array } {
  const uvs = new Float32Array(COLUMNS * (UP + 1) * 2),
    indices = new Uint16Array(AROUND * UP * 6);
  let k = 0;
  for (let j = 0; j <= UP; j++)
    for (let i = 0; i <= AROUND; i++) {
      const at = j * COLUMNS + i;
      uvs[at * 2] = i / AROUND;
      uvs[at * 2 + 1] = j / UP;
      if (i < AROUND && j < UP) {
        const b = at + 1,
          d = at + COLUMNS;
        // LayaAir's front faces are wound the other way from three.js.
        indices.set([at, d, b, b, d, d + 1], k);
        k += 6;
      }
    }
  return { uvs, indices };
}

/** Smooth normals of a leg grid, the seam made one line. Positions in units. */
function computeNormals(positions: Float32Array, indices: Uint16Array, normals: Float32Array) {
  normals.fill(0);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3,
      b = indices[t + 1] * 3,
      c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a],
      uy = positions[b + 1] - positions[a + 1],
      uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a],
      vy = positions[c + 1] - positions[a + 1],
      vz = positions[c + 2] - positions[a + 2];
    const nx = uz * vy - uy * vz,
      ny = ux * vz - uz * vx,
      nz = uy * vx - ux * vy;
    for (const p of [a, b, c]) {
      normals[p] += nx;
      normals[p + 1] += ny;
      normals[p + 2] += nz;
    }
  }
  for (let j = 0; j <= UP; j++) {
    const first = j * COLUMNS * 3,
      last = first + AROUND * 3;
    for (let c = 0; c < 3; c++) normals[first + c] = normals[last + c] = normals[first + c] + normals[last + c];
  }
  for (let p = 0; p < normals.length; p += 3) {
    const l = Math.hypot(normals[p], normals[p + 1], normals[p + 2]) || 1;
    normals[p] /= l;
    normals[p + 1] /= l;
    normals[p + 2] /= l;
  }
}

/** Writes positions (units) and normals to a mesh in metres; with `strain`, the vertex colour's alpha. */
function upload(mesh: ZhudaDynamicMesh, positions: Float32Array, normals: Float32Array, strain?: Float32Array) {
  const { vertices, stride, offsets } = mesh;
  const count = positions.length / 3;
  for (let i = 0; i < count; i++) {
    const v = i * stride,
      p = i * 3;
    vertices[v] = positions[p] * LT;
    vertices[v + 1] = (positions[p + 1] - FLOOR) * LT;
    vertices[v + 2] = positions[p + 2] * LT;
    vertices[v + 3] = normals[p];
    vertices[v + 4] = normals[p + 1];
    vertices[v + 5] = normals[p + 2];
    if (strain && offsets.color !== null) vertices[v + offsets.color + 3] = Math.min(1, strain[i] / 2.8);
  }
  mesh.updateRange(0, count);
  mesh.refreshBounds();
}

/** Units to metres, for a point. */
export const toWorld = (x: number, y: number, z: number): [number, number, number] => [x * LT, (y - FLOOR) * LT, z * LT];
export const fromWorld = (p: readonly number[]): [number, number, number] => [p[0] / LT, p[1] / LT + FLOOR, p[2] / LT];

export function createLeg(scene: any, side: number): Leg {
  const { uvs, indices } = grid();
  const count = COLUMNS * (UP + 1);
  const skinRest = new Float32Array(count * 3),
    rest = new Float32Array(count * 3),
    outX = new Float32Array(count),
    outZ = new Float32Array(count);
  for (let j = 0; j <= UP; j++) {
    const y = rowY(j);
    const knee = 0.063 * Math.exp(-(((y - KNEE) / 0.62) ** 2)),
      calf = 0.047 * (1 - smootherstep(y, -1.62, -0.82));
    const centreX = side * (0.51 - section(y, 3) - knee + calf) + 0.025 * y,
      centreZ = section(y, 4) + (side > 0 ? -0.042 : 0.031);
    const slim = slimAt(y);
    const radiusX = (section(y, 1) + 0.035) * slim,
      radiusZ = section(y, 2) * (0.25 + 0.75 * slim);
    const twist = -side * 0.12 * Math.exp(-(((y - KNEE) / 0.78) ** 2)),
      st = Math.sin(twist),
      ct = Math.cos(twist);
    for (let i = 0; i <= AROUND; i++) {
      const at = j * COLUMNS + i,
        turn = (i / AROUND - 0.5) * Math.PI * 2,
        s = Math.sin(turn),
        c = Math.cos(turn);
      const kneecap = 0.02 * Math.exp(-(((y - KNEE) / 0.21) ** 2)) * Math.max(0, c) ** 8;
      const muscle = 1 + 0.034 * Math.cos(2 * turn - y * 0.65) + 0.022 * side * Math.sin(3 * turn + y);
      const across = radiusX * s * muscle,
        forward = radiusZ * c * muscle + kneecap;
      const x = centreX + across * ct + forward * st,
        z = centreZ - across * st + forward * ct;
      skinRest.set([x, y, z], at * 3);
      outX[at] = s * ct + c * st;
      outZ[at] = c * ct - s * st;
      // (The reference had a little wave in the yarn behind the knee; on a whole leg it read as ripples: left out.)
      const lift = LIFT;
      rest.set([x + outX[at] * lift, y, z + outZ[at] * lift], at * 3);
    }
  }
  const invU = new Float32Array(count),
    invV = new Float32Array(count);
  for (let j = 0; j <= UP; j++)
    for (let i = 0; i <= AROUND; i++) {
      const at = j * COLUMNS + i,
        a = at * 3,
        u = (j * COLUMNS + (i < AROUND ? i + 1 : AROUND - 1)) * 3,
        v = ((j < UP ? j + 1 : UP - 1) * COLUMNS + i) * 3;
      invU[at] = 1 / Math.hypot(rest[a] - rest[u], rest[a + 1] - rest[u + 1], rest[a + 2] - rest[u + 2]);
      invV[at] = 1 / Math.hypot(rest[a] - rest[v], rest[a + 1] - rest[v + 1], rest[a + 2] - rest[v + 2]);
    }
  const normals = new Float32Array(count * 3);
  computeNormals(skinRest, indices, normals);
  const skin = new ZhudaDynamicMesh({ positions: new Float32Array(count * 3), normals: new Float32Array(count * 3), uvs, indices }, scene);
  upload(skin, skinRest, normals);
  const colors = new Float32Array(count * 4).fill(1);
  for (let i = 0; i < count; i++) colors[i * 4 + 3] = 0;
  const hosiery = new ZhudaDynamicMesh({ positions: new Float32Array(count * 3), normals: new Float32Array(count * 3), uvs, indices, colors }, scene);
  hosiery.padBounds(0.3);
  const top = rowY(UP);
  const leg: Leg = {
    side,
    skin,
    hosiery,
    skinRest,
    rest,
    current: rest.slice(),
    outX,
    outZ,
    invU,
    invV,
    strain: new Float32Array(count),
    normals: new Float32Array(count * 3),
    axis: [side * (0.51 - section(top, 3)) + 0.025 * top, section(top, 4) + (side > 0 ? -0.042 : 0.031)],
    reach: 1,
  };
  finish(leg);
  return leg;
}

/** Stretch at each vertex from its distances to its neighbours, the normals, and the upload. */
function finish(leg: Leg) {
  const s = leg.current;
  for (let j = 0; j <= UP; j++) {
    for (let i = 0; i <= AROUND; i++) {
      const at = j * COLUMNS + i,
        a = at * 3,
        u = (j * COLUMNS + (i < AROUND ? i + 1 : AROUND - 1)) * 3,
        v = ((j < UP ? j + 1 : UP - 1) * COLUMNS + i) * 3;
      const du = Math.hypot(s[a] - s[u], s[a + 1] - s[u + 1], s[a + 2] - s[u + 2]),
        dv = Math.hypot(s[a] - s[v], s[a + 1] - s[v + 1], s[a + 2] - s[v + 2]);
      leg.strain[at] = clamp(du * dv * leg.invU[at] * leg.invV[at] - 1, 0, 2.8);
    }
    leg.strain[j * COLUMNS + AROUND] = leg.strain[j * COLUMNS];
  }
  computeNormals(s, leg.hosiery.data.indices as Uint16Array, leg.normals);
  upload(leg.hosiery, s, leg.normals, leg.strain);
}

/** The vertex nearest a place on the stocking given as (u round, v up), 0..1. */
export const vertexAt = (u: number, v: number) => Math.round(clamp(v, 0, 1) * UP) * COLUMNS + Math.round(clamp(u, 0, 1) * AROUND);

/** How far the stocking at (u, v) already stands from where it rests, units. */
export function offsetAt(leg: Leg, u: number, v: number): [number, number, number] {
  const a = vertexAt(u, v) * 3;
  return [leg.current[a] - leg.rest[a], leg.current[a + 1] - leg.rest[a + 1], leg.current[a + 2] - leg.rest[a + 2]];
}
export function outwardAt(leg: Leg, u: number, v: number): [number, number, number] {
  const at = vertexAt(u, v);
  return [leg.outX[at], 0, leg.outZ[at]];
}

const angular = new Float32Array(COLUMNS),
  around = new Float32Array(COLUMNS),
  vertical = new Float32Array(UP + 1);

/**
 * Pulls the stocking: `amount` 0..1.1 (1 is 1.17 units of pull), from (u, v),
 * toward `direction` (a unit vector in leg units) or, without one, straight
 * out. Limited above by the skirt's hem and below by the skin.
 */
export function pull(leg: Leg, amount: number, u: number, v: number, direction: readonly number[] | null) {
  const { rest, current: s, skinRest, outX, outZ } = leg;
  const row = Math.round(clamp(v, 0, 1) * UP),
    column = Math.round(clamp(u, 0, 1) * AROUND),
    gripAt = row * COLUMNS + column,
    gripY = rest[gripAt * 3 + 1];
  const turnOf = (i: number) => (i / AROUND - 0.5) * Math.PI * 2;
  for (let i = 0; i <= AROUND; i++) {
    const d = Math.acos(Math.cos(turnOf(i) - turnOf(column)));
    angular[i] = d;
    around[i] = Math.exp(-((d / 1.02) ** 2)) * (1 - smootherstep(d, 1.06, 1.64));
  }
  const limit = Math.max(gripY + 0.28, 1.01);
  for (let j = 0; j <= UP; j++) {
    const dy = rest[j * COLUMNS * 3 + 1] - gripY;
    vertical[j] = Math.exp(-((dy / (dy > 0 ? 0.49 : 0.46)) ** 2) * 0.85) * (1 - smoothstep(rest[j * COLUMNS * 3 + 1], limit, Math.max(limit + 0.02, HEM_LIMIT)));
  }
  for (let j = 0; j <= UP; j++)
    for (let i = 0; i <= AROUND; i++) {
      const at = j * COLUMNS + i,
        p = at * 3,
        d = angular[i],
        y = rest[p + 1],
        dy = y - gripY,
        weight = amount * vertical[j] * around[i];
      if (weight === 0) {
        s[p] = rest[p];
        s[p + 1] = y;
        s[p + 2] = rest[p + 2];
        continue;
      }
      const te = (dy / 0.18) ** 2 + (d / 0.35) ** 2,
        peak = Math.exp(-0.68 * te - 0.58 * (Math.sqrt(te + 0.0225) - 0.15)),
        ripple = 0.008 * weight * Math.sin((19 * dy) / (1 + d * 1.5) + d * 2.4),
        gather = weight * (-0.18 * dy + 0.006 * Math.sin(8 * d));
      if (direction) {
        const reach = (0.73 + 0.27 * peak) * 1.17 * weight * leg.reach,
          ox = outX[at],
          oz = outZ[at],
          outward = direction[0] * ox + direction[2] * oz;
        // What would go into the leg goes round it instead.
        const soft = Math.max(0, 0.1 - Math.abs(outward)),
          inward = Math.min(0, outward) - (soft * soft) / 0.4,
          wave = Math.max(-0.003, ripple);
        s[p] = rest[p] + reach * (direction[0] - inward * ox) + wave * ox;
        s[p + 1] = y + reach * direction[1] + gather;
        s[p + 2] = rest[p + 2] + reach * (direction[2] - inward * oz) + wave * oz;
      } else {
        s[p] = rest[p] - weight * leg.reach * (0.84 + 0.33 * peak);
        s[p + 1] = y + gather;
        s[p + 2] = rest[p + 2] + weight * (0.13 + ripple + 0.39 * (rest[gripAt * 3 + 2] - rest[p + 2]));
      }
      s[p + 1] = Math.max(BASE + 0.004, s[p + 1]);
    }
  // Nowhere under the skin: what was moved up or down keeps 0.009 units off it.
  if (direction && amount > 0)
    for (let j = 0; j <= UP; j++) {
      if (vertical[j] < 1e-4) continue;
      for (let i = 0; i <= AROUND; i++) {
        if (around[i] < 1e-4) continue;
        const p = (j * COLUMNS + i) * 3;
        if (Math.abs(s[p + 1] - rest[p + 1]) < 1e-4) continue;
        const r = clamp(rowOf(s[p + 1]), 0, UP),
          r0 = Math.floor(r),
          r1 = Math.min(UP, r0 + 1),
          f = r - r0;
        const a = (r0 * COLUMNS + i) * 3,
          b = (r1 * COLUMNS + i) * 3;
        const sx = skinRest[a] + (skinRest[b] - skinRest[a]) * f,
          sz = skinRest[a + 2] + (skinRest[b + 2] - skinRest[a + 2]) * f;
        const ox = outX[a / 3] + (outX[b / 3] - outX[a / 3]) * f,
          oz = outZ[a / 3] + (outZ[b / 3] - outZ[a / 3]) * f;
        const off = (s[p] - sx) * ox + (s[p + 2] - sz) * oz,
          push = Math.max(0, 0.009 - off);
        s[p] += push * ox;
        s[p + 2] += push * oz;
      }
    }
  finish(leg);
}

/** Near (u, v), the place of most stretch, a little nearer counted more: where a tear starts. */
export function tearOrigin(leg: Leg, u: number, v: number): [number, number] {
  const column = Math.round(u * AROUND),
    row = Math.round(v * UP);
  let best = -Infinity,
    at: [number, number] = [u, v];
  for (let dj = -7; dj <= 7; dj++) {
    const j = clamp(row + dj, 0, UP);
    for (let di = -8; di <= 8; di++) {
      const i = (column + di + AROUND) % AROUND;
      const score = leg.strain[j * COLUMNS + i] - 0.023 * (di * di + dj * dj);
      if (score > best) {
        best = score;
        at = [i / AROUND, j / UP];
      }
    }
  }
  return at;
}

/**
 * The leg as a body for the cloth: a table of radii round a fixed upright
 * axis, read off the skin itself (each ring, each direction), from `from`
 * to the waist, in metres. Out a little by `grow` units for the stocking.
 */
export function legTable(leg: Leg, from: number, grow = 0.02) {
  const rows = 14,
    columns = 24,
    radii: number[] = [];
  const [ax, az] = leg.axis;
  for (let r = 0; r < rows; r++) {
    const y = from + ((TOP - from) * r) / (rows - 1);
    const j = Math.round(clamp(rowOf(y), 0, UP));
    for (let c = 0; c < columns; c++) {
      const angle = (c / columns) * Math.PI * 2,
        dx = Math.sin(angle),
        dz = Math.cos(angle);
      // The farthest place of the ring in this direction from the axis.
      let reach = 0;
      for (let i = 0; i < AROUND; i++) {
        const a = (j * COLUMNS + i) * 3,
          b = (j * COLUMNS + i + 1) * 3;
        const x0 = leg.skinRest[a] - ax,
          z0 = leg.skinRest[a + 2] - az,
          x1 = leg.skinRest[b] - ax,
          z1 = leg.skinRest[b + 2] - az;
        // Ray (dx, dz) against the edge from (x0, z0) to (x1, z1).
        const ex = x1 - x0,
          ez = z1 - z0,
          det = dx * -ez - dz * -ex;
        if (Math.abs(det) < 1e-9) continue;
        const t = (x0 * -ez - z0 * -ex) / det,
          k = (dx * z0 - dz * x0) / det;
        if (t > 0 && k >= 0 && k <= 1) reach = Math.max(reach, t);
      }
      radii.push((reach + grow) * LT);
    }
  }
  return {
    type: 'table' as const,
    origin: toWorld(ax, from, az),
    axis: [0, 1, 0] as [number, number, number],
    forward: [0, 0, 1] as [number, number, number],
    height: (TOP - from) * LT,
    rows,
    columns,
    radii,
  };
}

/** The farthest the two legs reach in a direction from the middle, at a height, units: the hips under a skirt. */
export function hipReach(legs: Leg[], y: number, angle: number): number {
  const j = Math.round(clamp(rowOf(y), 0, UP)),
    dx = Math.sin(angle),
    dz = Math.cos(angle);
  // The support of the two rings together: a skirt spans the gap between the legs.
  let reach = 0;
  for (const leg of legs)
    for (let i = 0; i < AROUND; i++) {
      const a = (j * COLUMNS + i) * 3;
      reach = Math.max(reach, leg.skinRest[a] * dx + leg.skinRest[a + 2] * dz);
    }
  return reach;
}

/**
 * A garment over a leg (trousers, shorts): the same grid as the stocking, `lift`
 * units off the skin at each height, so it is pulled and torn the same way.
 * It shares the leg's skin (for picking and for keeping off it). Where it does
 * not reach is cut away by its material.
 */
export function createLayer(scene: any, leg: Leg, lift: (y: number) => number, reach: number): Leg {
  const { uvs, indices } = grid();
  const count = COLUMNS * (UP + 1);
  const rest = new Float32Array(count * 3);
  for (let at = 0; at < count; at++) {
    const p = at * 3,
      y = leg.skinRest[p + 1],
      l = lift(y);
    rest.set([leg.skinRest[p] + leg.outX[at] * l, y, leg.skinRest[p + 2] + leg.outZ[at] * l], p);
  }
  const invU = new Float32Array(count),
    invV = new Float32Array(count);
  for (let j = 0; j <= UP; j++)
    for (let i = 0; i <= AROUND; i++) {
      const at = j * COLUMNS + i,
        a = at * 3,
        u = (j * COLUMNS + (i < AROUND ? i + 1 : AROUND - 1)) * 3,
        v = ((j < UP ? j + 1 : UP - 1) * COLUMNS + i) * 3;
      invU[at] = 1 / Math.hypot(rest[a] - rest[u], rest[a + 1] - rest[u + 1], rest[a + 2] - rest[u + 2]);
      invV[at] = 1 / Math.hypot(rest[a] - rest[v], rest[a + 1] - rest[v + 1], rest[a + 2] - rest[v + 2]);
    }
  const colors = new Float32Array(count * 4).fill(1);
  for (let i = 0; i < count; i++) colors[i * 4 + 3] = 0;
  const mesh = new ZhudaDynamicMesh({ positions: new Float32Array(count * 3), normals: new Float32Array(count * 3), uvs, indices, colors }, scene);
  mesh.padBounds(0.2);
  const layer: Leg = { ...leg, hosiery: mesh, rest, current: rest.slice(), invU, invV, strain: new Float32Array(count), normals: new Float32Array(count * 3), reach };
  finish(layer);
  return layer;
}

/** Puts a surface back where it rests. */
export function relax(leg: Leg) {
  leg.current.set(leg.rest);
  finish(leg);
}

/**
 * A stockinged foot that goes on from the leg: a tube swept from the leg's lowest ring
 * (the same vertices, so there is no seam) down round the heel and forward to the
 * toes. Its section turns from the ankle's shape into the foot's (taller at the heel,
 * wide at the ball, low at the toes), the sole flat on the floor, the toes rounded and
 * turned a little outward. Skin, and the stocking 0.011 units off it. Texture
 * coordinates go on from the leg's: u round as on the leg, v below 0 down the foot.
 */
export function createFoot(scene: any, leg: Leg) {
  const ALONG = 48,
    cols = AROUND + 1;
  let ax = 0,
    az = 0;
  for (let i = 0; i < AROUND; i++) {
    ax += leg.skinRest[i * 3] / AROUND;
    az += leg.skinRest[i * 3 + 2] / AROUND;
  }
  // The centre line: a curve from the ankle's ring down to the heel's turn, then to the toes.
  const p0 = [ax, BASE, az],
    p1 = [ax, FLOOR + 0.24, az + 0.04],
    p2 = [ax + leg.side * 0.11, FLOOR + 0.09, az + 1.02];
  const curve = (t: number) => [0, 1, 2].map((c) => (1 - t) ** 2 * p0[c] + 2 * (1 - t) * t * p1[c] + t * t * p2[c]);
  const tangent = (t: number) => {
    const d = [0, 1, 2].map((c) => 2 * (1 - t) * (p1[c] - p0[c]) + 2 * t * (p2[c] - p1[c]));
    const l = Math.hypot(d[0], d[1], d[2]);
    return d.map((c) => c / l);
  };
  const station = (t: number, stations: number[][]) => {
    let i = 0;
    while (i < stations.length - 2 && t > stations[i + 1][0]) i++;
    const [t0, v0] = stations[i],
      [t1, v1] = stations[i + 1];
    const k = clamp((t - t0) / (t1 - t0), 0, 1);
    return v0 + (v1 - v0) * k * k * (3 - 2 * k);
  };
  // Half width (across) and half height (along the section's other axis), units.
  const widthAt = (t: number) => station(t, [[0, 0.18], [0.3, 0.18], [0.6, 0.2], [0.82, 0.19], [1, 0.13]]);
  const heightAt = (t: number) => station(t, [[0, 0.19], [0.3, 0.26], [0.55, 0.17], [0.78, 0.11], [1, 0.07]]);
  // The toes are rounded from above (the width closes on a circle) and stay a little thick at the tip.
  const toeClose = (t: number) => Math.max(0.18, Math.sqrt(1 - clamp((t - 0.86) / 0.14, 0, 1) ** 2));
  // The ankle ring as offsets in its own frame (across = x, other = z at the top).
  const ring: number[][] = [];
  for (let i = 0; i <= AROUND; i++) ring.push([leg.skinRest[i * 3] - ax, leg.skinRest[i * 3 + 2] - az]);

  const count = cols * (ALONG + 1);
  const skin = new Float32Array(count * 3),
    uvs = new Float32Array(count * 2),
    indices = new Uint16Array(AROUND * ALONG * 6);
  let travelled = 0,
    last = curve(0);
  for (let j = 0; j <= ALONG; j++) {
    const t = j / ALONG,
      c = curve(t),
      T = tangent(t);
    travelled += Math.hypot(c[0] - last[0], c[1] - last[1], c[2] - last[2]);
    last = c;
    // The section's axes: across (x, kept square to the tangent) and the other, N = T x across.
    let X = [1, 0, 0];
    const dot = X[0] * T[0] + X[1] * T[1] + X[2] * T[2];
    X = X.map((v, k) => v - dot * T[k]);
    const xl = Math.hypot(X[0], X[1], X[2]);
    X = X.map((v) => v / xl);
    let N = [T[1] * X[2] - T[2] * X[1], T[2] * X[0] - T[0] * X[2], T[0] * X[1] - T[1] * X[0]];
    // N points to the front at the ankle (toward +z) and up along the foot.
    if (N[2] + N[1] < 0) N = N.map((v) => -v);
    const blend = smoothstep(t, 0.04, 0.45),
      // The last ring closes to a point: no opening at the tip.
      w = j === ALONG ? 0 : widthAt(t) * toeClose(t),
      h = j === ALONG ? 0 : heightAt(t) * Math.max(0.45, toeClose(t));
    for (let i = 0; i <= AROUND; i++) {
      const at = j * cols + i,
        turn = (i / AROUND - 0.5) * Math.PI * 2;
      // From the ankle's own ring to an ellipse; across is x, the other runs from front (+N) to back.
      const ex = w * Math.sin(turn),
        en = h * Math.cos(turn);
      const ox = ring[i][0] + (ex - ring[i][0]) * blend,
        on = ring[i][1] + (en - ring[i][1]) * blend;
      let x = c[0] + X[0] * ox + N[0] * on,
        y = c[1] + X[1] * ox + N[1] * on,
        z = c[2] + X[2] * ox + N[2] * on;
      // The sole lies flat on the floor.
      y = Math.max(y, FLOOR + 0.006);
      if (j === 0) {
        x = leg.skinRest[i * 3];
        y = leg.skinRest[i * 3 + 1];
        z = leg.skinRest[i * 3 + 2];
      }
      skin.set([x, y, z], at * 3);
      uvs.set([i / AROUND, -travelled / SPAN], at * 2);
    }
  }
  let k = 0;
  for (let j = 0; j < ALONG; j++)
    for (let i = 0; i < AROUND; i++) {
      const at = j * cols + i,
        b = at + 1,
        d = at + cols;
      // The leg's rows go up and these go down: the other winding from the leg's.
      indices.set([at, b, d, b, d + 1, d], k);
      k += 6;
    }
  const normalsOf = (positions: Float32Array) => {
    const normals = new Float32Array(positions.length);
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3,
        b = indices[t + 1] * 3,
        c = indices[t + 2] * 3;
      const ux = positions[b] - positions[a],
        uy = positions[b + 1] - positions[a + 1],
        uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a],
        vy = positions[c + 1] - positions[a + 1],
        vz = positions[c + 2] - positions[a + 2];
      // LayaAir's front faces: the outward normal is v x u (as for the legs).
      const n = [uz * vy - uy * vz, ux * vz - uz * vx, uy * vx - ux * vy];
      for (const p of [a, b, c]) for (let q = 0; q < 3; q++) normals[p + q] += n[q];
    }
    for (let j = 0; j <= ALONG; j++) {
      const first = j * cols * 3,
        lastC = first + AROUND * 3;
      for (let q = 0; q < 3; q++) normals[first + q] = normals[lastC + q] = normals[first + q] + normals[lastC + q];
    }
    for (let p = 0; p < normals.length; p += 3) {
      const l = Math.hypot(normals[p], normals[p + 1], normals[p + 2]) || 1;
      normals[p] /= l;
      normals[p + 1] /= l;
      normals[p + 2] /= l;
    }
    return normals;
  };
  const skinNormals = normalsOf(skin);
  // Outward check: the middle rows' normals against the way from the centre line.
  let outward = 0;
  for (let j = 8; j < ALONG - 8; j++) {
    const c = curve(j / ALONG);
    for (let i = 0; i < AROUND; i += 4) {
      const p = (j * cols + i) * 3;
      outward += skinNormals[p] * (skin[p] - c[0]) + skinNormals[p + 1] * (skin[p + 1] - c[1]) + skinNormals[p + 2] * (skin[p + 2] - c[2]);
    }
  }
  if (outward < 0) {
    for (let t = 0; t < indices.length; t += 3) {
      const b = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = b;
    }
    skinNormals.set(normalsOf(skin));
  }
  const sock = new Float32Array(skin.length);
  for (let p = 0; p < skin.length; p += 3) {
    const sole = skinNormals[p + 1] < -0.7;
    for (let q = 0; q < 3; q++) sock[p + q] = skin[p + q] + skinNormals[p + q] * (sole ? 0.004 : LIFT);
  }
  // The first ring is the stocking's own lowest ring, so the two meet exactly.
  for (let i = 0; i <= AROUND; i++) sock.set(leg.rest.subarray(i * 3, i * 3 + 3), i * 3);
  const world = (positions: Float32Array) => {
    const out = new Float32Array(positions.length);
    for (let p = 0; p < positions.length; p += 3) out.set(toWorld(positions[p], positions[p + 1], positions[p + 2]), p);
    return out;
  };
  const colors = new Float32Array(count * 4).fill(1);
  for (let i = 0; i < count; i++) colors[i * 4 + 3] = 0;
  // The shared ring takes the leg's own normals, so the shading runs on without a line.
  const sockNormals = normalsOf(sock);
  const legSkin = leg.skin.vertices,
    stride = leg.skin.stride;
  for (let i = 0; i <= AROUND; i++) {
    skinNormals.set(legSkin.subarray(i * stride + 3, i * stride + 6), i * 3);
    sockNormals.set(leg.normals.subarray(i * 3, i * 3 + 3), i * 3);
  }
  const skinMesh = new ZhudaDynamicMesh({ positions: world(skin), normals: skinNormals, uvs, indices }, scene);
  const sockMesh = new ZhudaDynamicMesh({ positions: world(sock), normals: sockNormals, uvs, indices, colors }, scene);
  // Where the toe begins (the last sixth of the way), as the texture's v.
  const toeV = uvs[(Math.round(ALONG * 0.84) * cols) * 2 + 1];
  return { skin: skinMesh, hosiery: sockMesh, toeV };
}
