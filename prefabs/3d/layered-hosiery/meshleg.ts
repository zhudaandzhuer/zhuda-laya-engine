// Legs from a modelled mesh (MPFB / MakeHuman, made in Blender: blender/export_legs.py),
// with a stocking 0.011 units off the skin, pulled and torn as before. Everything
// that the hand-built grid did by rows and columns is done here per vertex: each
// vertex knows how far round its leg it is (turn) and how high (y), so the pull,
// the stretch, where a tear starts, the cloth's bodies and the garments work on
// any mesh. Units are the legs' own (as before): metres / LT, the floor at FLOOR.
import { ZhudaDynamicMesh } from 'zhuda-laya-engine';

export const BASE = -2.59,
  FLOOR = BASE - 0.38,
  /** The waistband (the mesh is cut there). */
  TOP = 2.3,
  SPAN = TOP - BASE,
  /** Rows and columns of the old grid: the scale tears and their search are measured in. */
  UP = Math.round((152 * SPAN) / 3.45),
  AROUND = 144,
  KNEE = -0.49,
  /** Above this a pull fades (it would run under the skirt); the top of the thigh. */
  HEM_LIMIT = 0.62,
  LT = 1.02 / (2.23 + 2.59),
  LIFT = 0.011;

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smoothstep = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const smootherstep = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const toWorld = (x: number, y: number, z: number): [number, number, number] => [x * LT, (y - FLOOR) * LT, z * LT];
export const fromWorld = (p: readonly number[]): [number, number, number] => [p[0] / LT, p[1] / LT + FLOOR, p[2] / LT];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface LegData {
  side: number;
  positions: number[];
  normals: number[];
  indices: number[];
  /** The stocking's rest shape, made in Blender (offset, spanning the toes, outside the skin), metres. */
  sock?: number[];
}

export interface Leg {
  side: number;
  skin: ZhudaDynamicMesh;
  /** The stocking (or, for a garment layer, the garment). */
  hosiery: ZhudaDynamicMesh;
  count: number;
  skinRest: Float32Array;
  skinNormals: Float32Array;
  rest: Float32Array;
  current: Float32Array;
  normals: Float32Array;
  /** Per vertex: how far round the leg (radians, 0 at the front), how high (units), the way out. */
  turn: Float32Array;
  ys: Float32Array;
  outX: Float32Array;
  outZ: Float32Array;
  /** A vertex copied where the texture wraps round the back: its original (-1 for none). */
  twinOf: Int32Array;
  edgeA: Uint32Array;
  edgeB: Uint32Array;
  edgeRest: Float32Array;
  strain: Float32Array;
  indices: Uint16Array;
  uvs: Float32Array;
  colors: Float32Array;
  /** Where the leg's axis is at the top of the thigh, units. */
  axis: [number, number];
  reach: number;
}

/** The leg's axis at each height: the middle of its vertices in bands of 0.1 units, smoothed. */
function axisOf(p: Float32Array, count: number) {
  const bands = new Map<number, { x: number; z: number; n: number }>();
  for (let i = 0; i < count; i++) {
    const b = Math.round(p[i * 3 + 1] / 0.1);
    const s = bands.get(b) ?? { x: 0, z: 0, n: 0 };
    s.x += p[i * 3];
    s.z += p[i * 3 + 2];
    s.n++;
    bands.set(b, s);
  }
  const keys = [...bands.keys()].sort((a, b) => a - b);
  const at = (y: number): [number, number] => {
    const b = y / 0.1;
    let lo = keys[0],
      hi = keys[keys.length - 1];
    for (const k of keys) {
      if (k <= b) lo = k;
      if (k >= b) {
        hi = k;
        break;
      }
    }
    const A = bands.get(lo)!,
      B = bands.get(hi)!;
    const t = hi === lo ? 0 : (b - lo) / (hi - lo);
    return [A.x / A.n + (B.x / B.n - A.x / A.n) * t, A.z / A.n + (B.z / B.n - A.z / A.n) * t];
  };
  return at;
}

/** Builds a leg from the exported data: units, the texture round and up the leg, the back seam split, the toes marked. */
export function createLeg(scene: any, data: LegData): Leg {
  const n0 = data.positions.length / 3;
  const pos0 = new Float32Array(n0 * 3),
    nor0 = new Float32Array(n0 * 3);
  for (let i = 0; i < n0; i++) {
    pos0.set(fromWorld([data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]]), i * 3);
    nor0.set(data.normals.slice(i * 3, i * 3 + 3), i * 3);
  }
  const axis = axisOf(pos0, n0);
  // Above the ankle the axis follows the leg; on the foot it stays the ankle's, so the foot reads as below the leg.
  const ankleAxis = axis(BASE + 0.05);
  const turns0 = new Float32Array(n0),
    u0 = new Float32Array(n0);
  // Where the ankle stands, and the foot's middle height.
  let ankleZ0 = 0,
    nA = 0;
  for (let i = 0; i < n0; i++)
    if (Math.abs(pos0[i * 3 + 1] - BASE) < 0.05) {
      ankleZ0 += pos0[i * 3 + 2];
      nA++;
    }
  ankleZ0 /= Math.max(1, nA);
    const v0 = new Float32Array(n0);
  for (let i = 0; i < n0; i++) {
    const x = pos0[i * 3],
      y = pos0[i * 3 + 1],
      z = pos0[i * 3 + 2];
    const [cx, cz] = y > BASE ? axis(y) : ankleAxis;
    const t = Math.atan2(x - cx, z - cz);
    turns0[i] = t;
    // Round the leg; on the foot v goes on with the distance forward (the foot draws its knit plainly: see the hook).
    u0[i] = t / (Math.PI * 2) + 0.5;
    const forward = Math.max(0, z - ankleZ0);
    v0[i] = (Math.min(y, BASE) + Math.max(0, y - BASE) - (y < BASE ? forward : 0) - BASE) / SPAN;
  }
  // Triangles that cross the back (u from near 1 to near 0) take copies of their low vertices with u + 1.
  const extra: number[] = [];
  const copyOf = new Map<number, number>();
  const indices: number[] = [];
  for (let t = 0; t < data.indices.length; t += 3) {
    const tri = [data.indices[t], data.indices[t + 1], data.indices[t + 2]];
    const us = tri.map((i) => u0[i]);
    if (Math.max(...us) - Math.min(...us) > 0.5)
      for (let k = 0; k < 3; k++)
        if (us[k] < 0.5) {
          let c = copyOf.get(tri[k]);
          if (c === undefined) {
            c = n0 + extra.length;
            extra.push(tri[k]);
            copyOf.set(tri[k], c);
          }
          tri[k] = c;
        }
    // LayaAir's front faces are wound the other way from glTF and Blender.
    indices.push(tri[0], tri[2], tri[1]);
  }
  const count = n0 + extra.length;
  const skinRest = new Float32Array(count * 3),
    skinNormals = new Float32Array(count * 3),
    turn = new Float32Array(count),
    ys = new Float32Array(count),
    outX = new Float32Array(count),
    outZ = new Float32Array(count),
    twinOf = new Int32Array(count).fill(-1),
    uvs = new Float32Array(count * 2),
    colors = new Float32Array(count * 4).fill(1);
  let ankleZ = 0;
  {
    let n = 0;
    for (let i = 0; i < n0; i++)
      if (Math.abs(pos0[i * 3 + 1] - BASE) < 0.05) {
        ankleZ += pos0[i * 3 + 2];
        n++;
      }
    ankleZ /= Math.max(1, n);
  }
  for (let i = 0; i < count; i++) {
    const o = i < n0 ? i : extra[i - n0];
    if (i >= n0) twinOf[i] = o;
    skinRest.set(pos0.subarray(o * 3, o * 3 + 3), i * 3);
    skinNormals.set(nor0.subarray(o * 3, o * 3 + 3), i * 3);
    const y = pos0[o * 3 + 1];
    turn[i] = turns0[o];
    ys[i] = y;
    outX[i] = Math.sin(turns0[o]);
    outZ[i] = Math.cos(turns0[o]);
    uvs[i * 2] = u0[o] + (i >= n0 ? 1 : 0);
    uvs[i * 2 + 1] = v0[o];
    // The toes: forward of the ball of the foot, low.
    const forward = pos0[o * 3 + 2] - ankleZ;
    const toe = smoothstep(forward, 0.62, 0.8) * (1 - smoothstep(y, FLOOR + 0.4, FLOOR + 0.55));
    colors[i * 4] = colors[i * 4 + 1] = colors[i * 4 + 2] = 1 - toe;
    colors[i * 4 + 3] = 0;
  }
  const rest = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const o = i < n0 ? i : extra[i - n0];
    if (data.sock) rest.set(fromWorld(data.sock.slice(o * 3, o * 3 + 3)), i * 3);
    else for (let k = 0; k < 3; k++) rest[i * 3 + k] = skinRest[i * 3 + k] + skinNormals[i * 3 + k] * LIFT;
  }
  // Edges, once each, for the stretch.
  const seen = new Set<number>(),
    ea: number[] = [],
    eb: number[] = [];
  for (let t = 0; t < indices.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k],
        b = indices[t + ((k + 1) % 3)];
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      if (seen.has(key)) continue;
      seen.add(key);
      ea.push(a);
      eb.push(b);
    }
  const edgeA = Uint32Array.from(ea),
    edgeB = Uint32Array.from(eb),
    edgeRest = new Float32Array(ea.length);
  for (let e = 0; e < ea.length; e++) {
    const a = ea[e] * 3,
      b = eb[e] * 3;
    edgeRest[e] = Math.hypot(rest[a] - rest[b], rest[a + 1] - rest[b + 1], rest[a + 2] - rest[b + 2]) || 1e-6;
  }
  const idx = Uint16Array.from(indices);
  const skin = new ZhudaDynamicMesh({ positions: new Float32Array(count * 3), normals: new Float32Array(count * 3), uvs, indices: idx, colors: colors.slice() }, scene);
  upload(skin, skinRest, skinNormals);
  const hosiery = new ZhudaDynamicMesh({ positions: new Float32Array(count * 3), normals: new Float32Array(count * 3), uvs, indices: idx, colors }, scene);
  hosiery.padBounds(0.3);
  const top = axis(TOP - 0.6);
  const leg: Leg = {
    side: data.side,
    skin,
    hosiery,
    count,
    skinRest,
    skinNormals,
    rest,
    current: rest.slice(),
    normals: new Float32Array(count * 3),
    turn,
    ys,
    outX,
    outZ,
    twinOf,
    edgeA,
    edgeB,
    edgeRest,
    strain: new Float32Array(count),
    indices: idx,
    uvs,
    colors,
    axis: [top[0], top[1]],
    reach: 1,
  };
  finish(leg);
  return leg;
}

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

/** Copies, stretch, normals and the upload, after the positions moved. */
function finish(leg: Leg) {
  const s = leg.current,
    { count, twinOf } = leg;
  for (let i = 0; i < count; i++) if (twinOf[i] >= 0) s.set(s.subarray(twinOf[i] * 3, twinOf[i] * 3 + 3), i * 3);
  // Stretch: how much longer the edges round a vertex are than at rest, squared (an area).
  const sum = new Float32Array(count),
    n = new Uint16Array(count);
  for (let e = 0; e < leg.edgeA.length; e++) {
    const a = leg.edgeA[e],
      b = leg.edgeB[e];
    const r = Math.hypot(s[a * 3] - s[b * 3], s[a * 3 + 1] - s[b * 3 + 1], s[a * 3 + 2] - s[b * 3 + 2]) / leg.edgeRest[e];
    sum[a] += r;
    sum[b] += r;
    n[a]++;
    n[b]++;
  }
  for (let i = 0; i < count; i++) {
    const m = n[i] ? sum[i] / n[i] : 1;
    leg.strain[i] = clamp(m * m - 1, 0, 2.8);
  }
  // Normals from the triangles, a copy and its original added together.
  const normals = leg.normals;
  normals.fill(0);
  const ind = leg.indices;
  for (let t = 0; t < ind.length; t += 3) {
    const a = ind[t] * 3,
      b = ind[t + 1] * 3,
      c = ind[t + 2] * 3;
    const ux = s[b] - s[a],
      uy = s[b + 1] - s[a + 1],
      uz = s[b + 2] - s[a + 2];
    const vx = s[c] - s[a],
      vy = s[c + 1] - s[a + 1],
      vz = s[c + 2] - s[a + 2];
    const nx = uz * vy - uy * vz,
      ny = ux * vz - uz * vx,
      nz = uy * vx - ux * vy;
    for (const p of [a, b, c]) {
      normals[p] += nx;
      normals[p + 1] += ny;
      normals[p + 2] += nz;
    }
  }
  for (let i = 0; i < count; i++)
    if (twinOf[i] >= 0) {
      const o = twinOf[i] * 3,
        p = i * 3;
      for (let k = 0; k < 3; k++) normals[o + k] = normals[p + k] = normals[o + k] + normals[p + k];
    }
  for (let p = 0; p < normals.length; p += 3) {
    const l = Math.hypot(normals[p], normals[p + 1], normals[p + 2]) || 1;
    normals[p] /= l;
    normals[p + 1] /= l;
    normals[p + 2] /= l;
  }
  upload(leg.hosiery, s, normals, leg.strain);
}

/** The vertex nearest to (u round, v up), on the leg (not the foot). */
function nearest(leg: Leg, u: number, v: number): number {
  const turn = (u - 0.5) * Math.PI * 2,
    y = BASE + v * SPAN;
  let best = 0,
    score = Infinity;
  for (let i = 0; i < leg.count; i++) {
    const d = wrap(leg.turn[i] - turn) * 0.5,
      dy = leg.ys[i] - y;
    const q = d * d + dy * dy;
    if (q < score) {
      score = q;
      best = i;
    }
  }
  return best;
}

export function offsetAt(leg: Leg, u: number, v: number): [number, number, number] {
  const a = nearest(leg, u, v) * 3;
  return [leg.current[a] - leg.rest[a], leg.current[a + 1] - leg.rest[a + 1], leg.current[a + 2] - leg.rest[a + 2]];
}
export function outwardAt(leg: Leg, u: number, v: number): [number, number, number] {
  const i = nearest(leg, u, v);
  return [leg.outX[i], 0, leg.outZ[i]];
}

/**
 * Pulls the stocking: `amount` 0..1.1 (1 is 1.17 units of pull times the surface's
 * reach) from (u, v) toward `direction`, or straight out. The reference's pull,
 * per vertex: a narrow peak on a wide tent, limited above by the skirt's hem,
 * kept off the skin; the foot does not move.
 */
export function pull(leg: Leg, amount: number, u: number, v: number, direction: readonly number[] | null) {
  const { rest, current: s, skinRest, outX, outZ, turn, ys, count, twinOf } = leg;
  const gripTurn = (u - 0.5) * Math.PI * 2,
    gripY = BASE + clamp(v, 0, 1) * SPAN;
  const limit = Math.max(gripY + 0.28, 0.2);
  for (let i = 0; i < count; i++) {
    if (twinOf[i] >= 0) continue;
    const p = i * 3,
      y = ys[i];
    const d = Math.abs(wrap(turn[i] - gripTurn)),
      dy = y - gripY;
    const around = Math.exp(-((d / 1.02) ** 2)) * (1 - smootherstep(d, 1.06, 1.64));
    const vertical = Math.exp(-((dy / (dy > 0 ? 0.49 : 0.46)) ** 2) * 0.85) * (1 - smoothstep(y, limit, Math.max(limit + 0.02, HEM_LIMIT))) * smoothstep(y, BASE, BASE + 0.25);
    const weight = amount * vertical * around;
    if (weight < 1e-5) {
      s[p] = rest[p];
      s[p + 1] = rest[p + 1];
      s[p + 2] = rest[p + 2];
      continue;
    }
    const te = (dy / 0.18) ** 2 + (d / 0.35) ** 2,
      peak = Math.exp(-0.68 * te - 0.58 * (Math.sqrt(te + 0.0225) - 0.15)),
      ripple = 0.008 * weight * Math.sin((19 * dy) / (1 + d * 1.5) + d * 2.4),
      gather = weight * (-0.18 * dy + 0.006 * Math.sin(8 * d));
    const ox = outX[i],
      oz = outZ[i];
    if (direction) {
      const reach = (0.73 + 0.27 * peak) * 1.17 * weight * leg.reach,
        outward = direction[0] * ox + direction[2] * oz;
      const soft = Math.max(0, 0.1 - Math.abs(outward)),
        inward = Math.min(0, outward) - (soft * soft) / 0.4,
        wave = Math.max(-0.003, ripple);
      s[p] = rest[p] + reach * (direction[0] - inward * ox) + wave * ox;
      s[p + 1] = rest[p + 1] + reach * direction[1] + gather;
      s[p + 2] = rest[p + 2] + reach * (direction[2] - inward * oz) + wave * oz;
    } else {
      s[p] = rest[p] + weight * leg.reach * (0.84 + 0.33 * peak) * ox;
      s[p + 1] = rest[p + 1] + gather;
      s[p + 2] = rest[p + 2] + weight * leg.reach * (0.84 + 0.33 * peak) * oz;
    }
    // Nowhere under the skin.
    const off = (s[p] - skinRest[p]) * ox + (s[p + 2] - skinRest[p + 2]) * oz,
      push = Math.max(0, 0.009 - off);
    s[p] += push * ox;
    s[p + 2] += push * oz;
  }
  finish(leg);
}

/** Puts a surface back where it rests. */
export function relax(leg: Leg) {
  leg.current.set(leg.rest);
  finish(leg);
}

/** Near (u, v), the place of most stretch, a little nearer counted more: where a tear starts. */
export function tearOrigin(leg: Leg, u: number, v: number): [number, number] {
  const gripTurn = (u - 0.5) * Math.PI * 2,
    gripY = BASE + v * SPAN;
  const col = (Math.PI * 2) / AROUND,
    row = SPAN / UP;
  let best = -Infinity,
    at: [number, number] = [u, v];
  for (let i = 0; i < leg.count; i++) {
    if (leg.twinOf[i] >= 0 || leg.ys[i] < BASE) continue;
    const di = wrap(leg.turn[i] - gripTurn) / col,
      dj = (leg.ys[i] - gripY) / row;
    if (Math.abs(di) > 8 || Math.abs(dj) > 7) continue;
    const score = leg.strain[i] - 0.023 * (di * di + dj * dj);
    if (score > best) {
      best = score;
      at = [leg.turn[i] / (Math.PI * 2) + 0.5, (leg.ys[i] - BASE) / SPAN];
    }
  }
  return at;
}

/**
 * The leg as a body for the cloth: radii round a fixed upright axis, read off the
 * skin in bands of height and sectors of angle, from `from` to the waist, metres.
 */
export function legTable(leg: Leg, from: number, grow = 0.02) {
  const rows = 14,
    columns = 24;
  const [ax, az] = leg.axis;
  const radii = new Array(rows * columns).fill(0);
  const band = (TOP - from) / (rows - 1);
  for (let i = 0; i < leg.count; i++) {
    const y = leg.skinRest[i * 3 + 1];
    if (y < from - band || y > TOP + band) continue;
    const r = clamp(Math.round((y - from) / band), 0, rows - 1);
    const dx = leg.skinRest[i * 3] - ax,
      dz = leg.skinRest[i * 3 + 2] - az;
    const c = ((Math.round((Math.atan2(dx, dz) / (Math.PI * 2)) * columns) % columns) + columns) % columns;
    radii[r * columns + c] = Math.max(radii[r * columns + c], Math.hypot(dx, dz));
  }
  // Sectors with no vertex (a thin band) take their neighbours'.
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++)
      if (!radii[r * columns + c]) {
        const near = [radii[r * columns + ((c + 1) % columns)], radii[r * columns + ((c + columns - 1) % columns)], r > 0 ? radii[(r - 1) * columns + c] : 0, r < rows - 1 ? radii[(r + 1) * columns + c] : 0];
        radii[r * columns + c] = Math.max(...near, 0.15);
      }
  return {
    type: 'table' as const,
    origin: toWorld(ax, from, az),
    axis: [0, 1, 0] as [number, number, number],
    forward: [0, 0, 1] as [number, number, number],
    height: (TOP - from) * LT,
    rows,
    columns,
    radii: radii.map((r) => (r + grow) * LT),
  };
}

/** How far the two legs reach in a direction from the middle at a height, units: the hips under a skirt. */
export function hipReach(legs: Leg[], y: number, angle: number): number {
  const dx = Math.sin(angle),
    dz = Math.cos(angle);
  let reach = 0,
    found = false;
  for (const width of [0.06, 0.15, 0.4])
    if (!found)
      for (const leg of legs)
        for (let i = 0; i < leg.count; i++) {
          if (Math.abs(leg.skinRest[i * 3 + 1] - y) > width) continue;
          found = true;
          reach = Math.max(reach, leg.skinRest[i * 3] * dx + leg.skinRest[i * 3 + 2] * dz);
        }
  return reach;
}

/**
 * A garment over a leg (trousers, shorts): the leg's own mesh, `lift(y)` units off
 * the skin along its normals, so it is pulled and torn the same way.
 */
export function createLayer(scene: any, leg: Leg, lift: (y: number) => number, reach: number): Leg {
  const count = leg.count;
  const rest = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const l = lift(leg.ys[i]);
    for (let k = 0; k < 3; k++) rest[i * 3 + k] = leg.skinRest[i * 3 + k] + leg.skinNormals[i * 3 + k] * l;
  }
  const edgeRest = new Float32Array(leg.edgeA.length);
  for (let e = 0; e < edgeRest.length; e++) {
    const a = leg.edgeA[e] * 3,
      b = leg.edgeB[e] * 3;
    edgeRest[e] = Math.hypot(rest[a] - rest[b], rest[a + 1] - rest[b + 1], rest[a + 2] - rest[b + 2]) || 1e-6;
  }
  const colors = new Float32Array(count * 4).fill(1);
  for (let i = 0; i < count; i++) colors[i * 4 + 3] = 0;
  const mesh = new ZhudaDynamicMesh({ positions: new Float32Array(count * 3), normals: new Float32Array(count * 3), uvs: leg.uvs, indices: leg.indices, colors }, scene);
  mesh.padBounds(0.2);
  const layer: Leg = { ...leg, hosiery: mesh, rest, current: rest.slice(), edgeRest, strain: new Float32Array(count), normals: new Float32Array(count * 3), colors, reach };
  finish(layer);
  return layer;
}

/**
 * Cloth does not follow the body into the crotch or between the buttocks: it spans
 * the gap. For a fabric layer (a stocking or a garment), near the crotch the front
 * and back profiles of the two legs together are filled where they dip (as water
 * fills a valley), and the layer is lifted out to that surface, fading out a few
 * centimetres below the crotch so the legs stay apart.
 */
export function bridgeCrotch(legs: Leg[], layers: Leg[], lift: (y: number) => number) {
  let crotch = Infinity;
  for (const leg of legs)
    for (let i = 0; i < leg.count; i++) if (Math.abs(leg.skinRest[i * 3]) < 0.03) crotch = Math.min(crotch, leg.skinRest[i * 3 + 1]);
  if (!isFinite(crotch)) return;
  const y0 = crotch - 0.4,
    y1 = crotch + 0.6,
    bh = 0.04,
    bands = Math.ceil((y1 - y0) / bh),
    x0 = -0.9,
    bw = 0.03,
    cols = Math.ceil(1.8 / bw);
  const front = new Float32Array(bands * cols).fill(-Infinity),
    back = new Float32Array(bands * cols).fill(Infinity);
  for (const leg of legs)
    for (let i = 0; i < leg.count; i++) {
      const y = leg.skinRest[i * 3 + 1];
      if (y < y0 || y >= y1) continue;
      const b = Math.floor((y - y0) / bh),
        c = clamp(Math.floor((leg.skinRest[i * 3] - x0) / bw), 0, cols - 1),
        z = leg.skinRest[i * 3 + 2];
      front[b * cols + c] = Math.max(front[b * cols + c], z);
      back[b * cols + c] = Math.min(back[b * cols + c], z);
    }
  // Fill the valleys of each band's profile.
  for (let b = 0; b < bands; b++) {
    const row = b * cols;
    const left = new Float32Array(cols),
      right = new Float32Array(cols),
      leftB = new Float32Array(cols),
      rightB = new Float32Array(cols);
    let m = -Infinity,
      n = Infinity;
    for (let c = 0; c < cols; c++) {
      m = Math.max(m, front[row + c]);
      n = Math.min(n, back[row + c]);
      left[c] = m;
      leftB[c] = n;
    }
    m = -Infinity;
    n = Infinity;
    for (let c = cols - 1; c >= 0; c--) {
      m = Math.max(m, front[row + c]);
      n = Math.min(n, back[row + c]);
      right[c] = m;
      rightB[c] = n;
    }
    for (let c = 0; c < cols; c++) {
      if (isFinite(front[row + c])) front[row + c] = Math.max(front[row + c], Math.min(left[c], right[c]));
      if (isFinite(back[row + c])) back[row + c] = Math.min(back[row + c], Math.max(leftB[c], rightB[c]));
    }
  }
  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const y = layer.ys[i];
      if (y < y0 || y >= y1) continue;
      const w = smoothstep(y, crotch - 0.32, crotch - 0.02);
      if (w <= 0) continue;
      const b = Math.floor((y - y0) / bh),
        c = clamp(Math.floor((layer.skinRest[i * 3] - x0) / bw), 0, cols - 1);
      const f = front[b * cols + c],
        k = back[b * cols + c];
      if (!isFinite(f) || !isFinite(k)) continue;
      const mid = (f + k) / 2,
        z = layer.rest[i * 3 + 2],
        l = lift(y);
      if (layer.skinRest[i * 3 + 2] >= mid) {
        const target = f + l;
        if (z < target) layer.rest[i * 3 + 2] = z + (target - z) * w;
      } else {
        const target = k - l;
        if (z > target) layer.rest[i * 3 + 2] = z + (target - z) * w;
      }
    }
    // The new rest shape is the unstretched one.
    for (let e = 0; e < layer.edgeA.length; e++) {
      const a = layer.edgeA[e] * 3,
        b2 = layer.edgeB[e] * 3;
      layer.edgeRest[e] = Math.hypot(layer.rest[a] - layer.rest[b2], layer.rest[a + 1] - layer.rest[b2 + 1], layer.rest[a + 2] - layer.rest[b2 + 2]) || 1e-6;
    }
    relax(layer);
  }
}

