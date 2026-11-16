/**
 * Boolean operations on meshes: union, subtract and intersect two closed
 * meshes (`zhuda-laya-engine/csg`, an entry of its own: a game that does not
 * import it does not carry it).
 *
 * Inputs and output are `MeshData`; draw the result with
 * `ZhudaDynamicMesh` (past 65 535 vertices, cut it with `splitZhudaMesh`).
 * The operation is the binary space partitioning of csg.js (MIT, see
 * `Bsp.ts`): exact enough for tens of thousands of triangles, slow beyond.
 * The cut splinters triangles: the report says how many came in and went
 * out. Seams where a split met an unsplit neighbour are mended, so a closed
 * input gives a closed output.
 *
 * Each face of the result keeps the normals, texture coordinates and
 * colours of the triangle it came from, interpolated where it was cut; a
 * face from `b` keeps `b`'s (in a subtraction, turned inward). `groups` says
 * which index ranges came from which input, so a cut face can take a
 * material of its own. Tangents are worked out again when an input had them.
 *
 * Pure: no renderer, no timer. Synchronous: measure before calling it every
 * frame.
 */
import type { MeshData } from '../runtime3d/Surfaces.ts';
import { computeMeshTangents } from '../runtime3d/Surfaces.ts';
import {
  BspNode,
  BspPlane,
  flipPolygon,
  bspIntersect,
  bspSubtract,
  bspUnion,
  type BspPolygon,
  type BspVec,
  type BspVertex,
} from './Bsp.ts';

export type ZhudaCsgOperation = 'union' | 'subtract' | 'intersect';

export interface ZhudaCsgOptions {
  /** Distance in metres under which a point is on a plane (default 1e-5). */
  tolerance?: number;
  /** Refuse an input of more triangles than this (default 50 000). */
  maxTriangles?: number;
}

export interface ZhudaCsgReport {
  operation: ZhudaCsgOperation;
  /** Triangles of `a` and of `b`. */
  trianglesIn: [number, number];
  trianglesOut: number;
  /** Edges of the output used by one triangle only (0 when the result is closed). */
  openEdges: number;
  /**
   * Edges of the output used by more than two triangles (0 when it is a
   * single surface). Either above 0: the cut went wrong (in practice after
   * overlapping curved cuts in succession); do not cut the result again.
   */
  nonManifoldEdges: number;
  milliseconds: number;
}

export interface ZhudaCsgResult {
  mesh: MeshData;
  /** Index ranges of the output by the input they came from (draw each with its own material). */
  groups: { source: 'a' | 'b'; start: number; count: number }[];
  report: ZhudaCsgReport;
}

export interface ZhudaCsgInputCheck {
  triangles: number;
  /** Edges used by one triangle only, once vertices at one place are welded. */
  openEdges: number;
  /** Edges used by more than two triangles. */
  nonManifoldEdges: number;
  /** Triangles without area. */
  degenerateTriangles: number;
  /** What to fix, in words; empty when the mesh can be cut. */
  issues: string[];
}

type V3 = [number, number, number];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function read(mesh: MeshData, name: string): string | null {
  if (!mesh || typeof mesh !== 'object') return `${name}: a MeshData`;
  if (!(mesh.positions instanceof Float32Array) || mesh.positions.length % 3)
    return `${name}.positions: a Float32Array of x, y, z`;
  if (
    !(mesh.indices instanceof Uint16Array || mesh.indices instanceof Uint32Array) ||
    mesh.indices.length % 3
  )
    return `${name}.indices: whole triangles`;
  const count = mesh.positions.length / 3;
  for (let i = 0; i < mesh.indices.length; i++)
    if (mesh.indices[i] >= count)
      return `${name}.indices: index ${mesh.indices[i]} past the last vertex`;
  for (const [key, size] of [
    ['normals', 3],
    ['uvs', 2],
    ['colors', 4],
  ] as const) {
    const values = mesh[key];
    if (
      values !== undefined &&
      (!(values instanceof Float32Array) || values.length !== count * size)
    )
      return `${name}.${key}: ${size} numbers a vertex`;
  }
  return null;
}

const position = (mesh: MeshData, i: number): V3 => [
  mesh.positions[i * 3],
  mesh.positions[i * 3 + 1],
  mesh.positions[i * 3 + 2],
];

/**
 * What stops a mesh from being cut: open edges (a hole, so inside and outside
 * are not told apart), edges of more than two triangles, triangles without
 * area. Vertices at one place (within `tolerance`) count as one.
 */
export function validateZhudaCsgInput(
  mesh: MeshData,
  options: { tolerance?: number } = {},
): ZhudaCsgInputCheck {
  const problem = read(mesh, 'mesh');
  if (problem)
    return {
      triangles: 0,
      openEdges: 0,
      nonManifoldEdges: 0,
      degenerateTriangles: 0,
      issues: [problem],
    };
  const tolerance = options.tolerance ?? 1e-5;
  const ids = new Map<string, number>();
  const weld = (p: V3) => {
    const key = p.map((v) => Math.round(v / tolerance)).join(',');
    let id = ids.get(key);
    if (id === undefined) ids.set(key, (id = ids.size));
    return id;
  };
  const edges = new Map<string, number>();
  let degenerate = 0;
  const triangles = mesh.indices.length / 3;
  for (let t = 0; t < triangles; t++) {
    const p = [0, 1, 2].map((k) => position(mesh, mesh.indices[t * 3 + k])) as V3[];
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]],
      e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const area =
      Math.hypot(
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ) / 2;
    const w = p.map(weld);
    if (!(area > tolerance * tolerance) || new Set(w).size < 3) {
      degenerate++;
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const a = w[k],
        b = w[(k + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  let open = 0,
    many = 0;
  for (const n of edges.values()) {
    if (n === 1) open++;
    else if (n > 2) many++;
  }
  const issues: string[] = [];
  if (!triangles) issues.push('the mesh has no triangles');
  if (open) issues.push(`${open} open edges: the mesh has a hole, so its inside is not known`);
  if (many)
    issues.push(`${many} edges shared by more than two triangles: not a single closed surface`);
  if (degenerate) issues.push(`${degenerate} triangles without area`);
  return {
    triangles,
    openEdges: open,
    nonManifoldEdges: many,
    degenerateTriangles: degenerate,
    issues,
  };
}

/** The engine's triangles as csg.js polygons (turned round: csg.js winds counter-clockwise from outside). */
function toPolygons(mesh: MeshData, source: number, originals: BspPolygon[]): BspPolygon[] {
  const out: BspPolygon[] = [];
  const vertex = (i: number): BspVertex => {
    const v: BspVertex = {
      pos: position(mesh, i),
      normal: mesh.normals
        ? [mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]]
        : [0, 0, 0],
      uv: mesh.uvs ? [mesh.uvs[i * 2], mesh.uvs[i * 2 + 1]] : [0, 0],
    };
    if (mesh.colors)
      v.color = [
        mesh.colors[i * 4],
        mesh.colors[i * 4 + 1],
        mesh.colors[i * 4 + 2],
        mesh.colors[i * 4 + 3],
      ];
    return v;
  };
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const vertices = [
      vertex(mesh.indices[t]),
      vertex(mesh.indices[t + 2]),
      vertex(mesh.indices[t + 1]),
    ];
    const plane = BspPlane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
    if (!plane) continue;
    // Without normals, the face's own.
    if (!mesh.normals) for (const v of vertices) v.normal = [...plane.normal] as BspVec;
    const polygon = { vertices, plane, source, origin: originals.length };
    originals.push(polygon);
    out.push(polygon);
  }
  return out;
}

const polygonArea = (p: BspPolygon) => {
  let x = 0,
    y = 0,
    z = 0;
  const v = p.vertices;
  for (let i = 1; i + 1 < v.length; i++) {
    const e1 = [v[i].pos[0] - v[0].pos[0], v[i].pos[1] - v[0].pos[1], v[i].pos[2] - v[0].pos[2]],
      e2 = [
        v[i + 1].pos[0] - v[0].pos[0],
        v[i + 1].pos[1] - v[0].pos[1],
        v[i + 1].pos[2] - v[0].pos[2],
      ];
    x += e1[1] * e2[2] - e1[2] * e2[1];
    y += e1[2] * e2[0] - e1[0] * e2[2];
    z += e1[0] * e2[1] - e1[1] * e2[0];
  }
  return Math.hypot(x, y, z) / 2;
};

/**
 * An input triangle the other mesh's planes split but kept every piece of
 * comes back whole: the same surface in one triangle instead of splinters
 * (csg.js splits a face by every plane it meets, cut or not).
 */
function restoreWhole(polygons: BspPolygon[], originals: BspPolygon[]): BspPolygon[] {
  const pieces = new Map<number, BspPolygon[]>();
  for (const p of polygons) {
    const list = pieces.get(p.origin);
    if (list) list.push(p);
    else pieces.set(p.origin, [p]);
  }
  const out: BspPolygon[] = [];
  for (const [origin, list] of pieces) {
    const whole = originals[origin];
    if (list.length === 1 || list.some((p) => p.vertices.length < 3)) {
      out.push(...list);
      continue;
    }
    const area = polygonArea(whole),
      kept = list.reduce((sum, p) => sum + polygonArea(p), 0);
    if (Math.abs(kept - area) > area * 1e-7) {
      out.push(...list);
      continue;
    }
    // Facing as its pieces do (a subtraction turns the cutter's faces inward).
    out.push(
      list[0].plane.normal[0] * whole.plane.normal[0] +
        list[0].plane.normal[1] * whole.plane.normal[1] +
        list[0].plane.normal[2] * whole.plane.normal[2] >
        0
        ? whole
        : flipPolygon(whole),
    );
  }
  return out;
}

/**
 * Vertices within `radius` of one met before become that one, so that the
 * same point reached by different splits is one point; a polygon left with
 * fewer than three corners is dropped. Deterministic: the first met stays.
 */
function snapVertices(polygons: BspPolygon[], radius: number): BspPolygon[] {
  const grid = new Map<string, BspVec[]>();
  const cell = (v: number) => Math.floor(v / radius);
  const snap = (p: BspVec): BspVec => {
    const [cx, cy, cz] = [cell(p[0]), cell(p[1]), cell(p[2])];
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let z = cz - 1; z <= cz + 1; z++)
          for (const q of grid.get(`${x},${y},${z}`) ?? [])
            if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) <= radius) return q;
    const key = `${cx},${cy},${cz}`;
    const list = grid.get(key);
    if (list) list.push(p);
    else grid.set(key, [p]);
    return p;
  };
  const out: BspPolygon[] = [];
  for (const polygon of polygons) {
    const vertices: BspVertex[] = [];
    for (const v of polygon.vertices) {
      const pos = snap(v.pos);
      if (vertices.length && vertices[vertices.length - 1].pos === pos) continue;
      vertices.push(pos === v.pos ? v : { ...v, pos });
    }
    while (vertices.length > 1 && vertices[0].pos === vertices[vertices.length - 1].pos)
      vertices.pop();
    if (vertices.length >= 3) out.push({ ...polygon, vertices });
  }
  return out;
}

/**
 * A vertex of one polygon that lies on the edge of another, where the first
 * was split and the second not, is put into that edge too: the seam closes.
 */
function mendSeams(polygons: BspPolygon[], tolerance: number, key: (p: BspVec) => string): void {
  const points = new Map<string, BspVec>();
  let min: V3 = [Infinity, Infinity, Infinity],
    max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of polygons)
    for (const v of p.vertices) {
      points.set(key(v.pos), v.pos);
      min = min.map((m, k) => Math.min(m, v.pos[k])) as V3;
      max = max.map((m, k) => Math.max(m, v.pos[k])) as V3;
    }
  if (!points.size) return;
  const all = [...points.values()];
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], tolerance);
  const cell = extent / Math.max(1, Math.round(Math.cbrt(all.length) * 2));
  const grid = new Map<string, BspVec[]>();
  const at = (p: BspVec) => p.map((v, k) => Math.floor((v - min[k]) / cell)) as V3;
  for (const p of all) {
    const c = at(p).join(',');
    const list = grid.get(c);
    if (list) list.push(p);
    else grid.set(c, [p]);
  }
  for (const polygon of polygons) {
    const out: BspVertex[] = [];
    const n = polygon.vertices.length;
    for (let i = 0; i < n; i++) {
      const a = polygon.vertices[i],
        b = polygon.vertices[(i + 1) % n];
      out.push(a);
      const d: V3 = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]];
      const length2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
      if (!(length2 > tolerance * tolerance)) continue;
      const lo = at(a.pos).map((v, k) => Math.min(v, at(b.pos)[k])),
        hi = at(a.pos).map((v, k) => Math.max(v, at(b.pos)[k]));
      const found: { t: number; p: BspVec }[] = [];
      for (let x = lo[0]; x <= hi[0]; x++)
        for (let y = lo[1]; y <= hi[1]; y++)
          for (let z = lo[2]; z <= hi[2]; z++)
            for (const p of grid.get(`${x},${y},${z}`) ?? []) {
              const t =
                ((p[0] - a.pos[0]) * d[0] + (p[1] - a.pos[1]) * d[1] + (p[2] - a.pos[2]) * d[2]) /
                length2;
              if (t <= 1e-9 || t >= 1 - 1e-9) continue;
              const off = Math.hypot(
                a.pos[0] + d[0] * t - p[0],
                a.pos[1] + d[1] * t - p[1],
                a.pos[2] + d[2] * t - p[2],
              );
              if (off <= tolerance) found.push({ t, p });
            }
      found.sort((u, v) => u.t - v.t);
      let last = -1;
      for (const f of found) {
        if (f.t - last < 1e-9) continue;
        last = f.t;
        // The polygon's own attributes along its edge, at the neighbour's point.
        const v = {
          ...a,
          pos: f.p,
          normal: a.normal.map((n, k) => n + (b.normal[k] - n) * f.t) as BspVec,
          uv: [a.uv[0] + (b.uv[0] - a.uv[0]) * f.t, a.uv[1] + (b.uv[1] - a.uv[1]) * f.t] as [
            number,
            number,
          ],
        } as BspVertex;
        if (a.color && b.color)
          v.color = a.color.map((c, k) => c + (b.color![k] - c) * f.t) as [
            number,
            number,
            number,
            number,
          ];
        out.push(v);
      }
    }
    polygon.vertices = out;
  }
}

/** A convex polygon's triangles: a fan, or from its middle where points lie along an edge. */
function triangulate(polygon: BspPolygon): BspVertex[][] {
  const v = polygon.vertices;
  if (v.length === 3) return [v];
  const n = polygon.plane.normal;
  const collinear = (a: BspVertex, b: BspVertex, c: BspVertex) => {
    const e1 = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]] as BspVec,
      e2 = [c.pos[0] - a.pos[0], c.pos[1] - a.pos[1], c.pos[2] - a.pos[2]] as BspVec;
    const cr = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    return Math.abs(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]) < 1e-12;
  };
  let straight = false;
  for (let i = 0; i < v.length && !straight; i++)
    if (collinear(v[i], v[(i + 1) % v.length], v[(i + 2) % v.length])) straight = true;
  if (!straight) {
    const out: BspVertex[][] = [];
    for (let i = 1; i + 1 < v.length; i++) out.push([v[0], v[i], v[i + 1]]);
    return out;
  }
  // A convex polygon with points along its edges: every triangle from its middle has area.
  const k = 1 / v.length;
  const middle: BspVertex = {
    pos: [0, 1, 2].map((c) => v.reduce((s, p) => s + p.pos[c], 0) * k) as BspVec,
    normal: [0, 1, 2].map((c) => v.reduce((s, p) => s + p.normal[c], 0) * k) as BspVec,
    uv: [v.reduce((s, p) => s + p.uv[0], 0) * k, v.reduce((s, p) => s + p.uv[1], 0) * k],
  };
  if (v.every((p) => p.color))
    middle.color = [0, 1, 2, 3].map((c) => v.reduce((s, p) => s + p.color![c], 0) * k) as [
      number,
      number,
      number,
      number,
    ];
  return v.map((p, i) => [middle, p, v[(i + 1) % v.length]]);
}

/**
 * `a` union, minus or intersected with `b`. Both must be closed (see
 * `validateZhudaCsgInput`); an input that is not is refused with what is
 * wrong with it. Triangles without area are left out.
 */
export function zhudaCsg(
  a: MeshData,
  b: MeshData,
  operation: ZhudaCsgOperation,
  options: ZhudaCsgOptions = {},
): ZhudaCsgResult {
  const started = performance.now();
  if (!['union', 'subtract', 'intersect'].includes(operation))
    throw Error('CSG: operation is union, subtract or intersect');
  const tolerance = options.tolerance ?? 1e-5;
  const maxTriangles = options.maxTriangles ?? 50000;
  if (!(finite(tolerance) && tolerance > 0 && tolerance < 1))
    throw Error('CSG: tolerance 0..1 metres');
  if (!(Number.isInteger(maxTriangles) && maxTriangles > 0))
    throw Error('CSG: maxTriangles a whole number');
  for (const [mesh, name] of [
    [a, 'a'],
    [b, 'b'],
  ] as const) {
    const check = validateZhudaCsgInput(mesh, { tolerance });
    // Triangles without area are left out; a hole or a shared edge stops the cut.
    const stopping = check.issues.filter((issue) => !/without area/.test(issue));
    if (stopping.length) throw Error(`CSG: ${name} cannot be cut: ${stopping.join('; ')}`);
    if (check.triangles > maxTriangles)
      throw Error(
        `CSG: ${name} has ${check.triangles} triangles; at most ${maxTriangles} (maxTriangles)`,
      );
  }
  const ta = a.indices.length / 3,
    tb = b.indices.length / 3;
  const originals: BspPolygon[] = [];
  const treeA = new BspNode(tolerance, toPolygons(a, 0, originals)),
    treeB = new BspNode(tolerance, toPolygons(b, 1, originals));
  const cut =
    operation === 'union'
      ? bspUnion(treeA, treeB)
      : operation === 'subtract'
        ? bspSubtract(treeA, treeB)
        : bspIntersect(treeA, treeB);
  // Points a few splits apart can land a hair from each other: one point each, before seams are mended.
  const polygons = snapVertices(restoreWhole(cut, originals), tolerance * 10);
  const key = (p: BspVec) => p.map((v) => Math.round(v / tolerance)).join(',');
  // Tighter than the snapping: wider, a point near (not on) an edge was put into it and folded triangles.
  mendSeams(polygons, tolerance * 0.01, key);
  // Welded output: one vertex for each place with the same attributes.
  const colors = !!(a.colors && b.colors);
  const vertexIds = new Map<string, number>();
  const pos: number[] = [],
    nor: number[] = [],
    uv: number[] = [],
    col: number[] = [];
  const add = (v: BspVertex) => {
    const length = Math.hypot(v.normal[0], v.normal[1], v.normal[2]) || 1;
    const n = v.normal.map((c) => c / length);
    const id =
      key(v.pos) +
      '|' +
      n.map((c) => Math.round(c * 1e5)).join(',') +
      '|' +
      v.uv.map((c) => Math.round(c * 1e5)).join(',') +
      (colors && v.color ? '|' + v.color.map((c) => Math.round(c * 1e5)).join(',') : '');
    let index = vertexIds.get(id);
    if (index === undefined) {
      index = pos.length / 3;
      vertexIds.set(id, index);
      pos.push(...v.pos);
      nor.push(...n);
      uv.push(...v.uv);
      if (colors) col.push(...(v.color ?? [1, 1, 1, 1]));
    }
    return index;
  };
  const indices: number[] = [];
  const groups: ZhudaCsgResult['groups'] = [];
  // The triangles of `a` first, then of `b`: one index range each.
  for (const source of [0, 1]) {
    const start = indices.length;
    for (const polygon of polygons) {
      if (polygon.source !== source) continue;
      for (const tri of triangulate(polygon)) {
        const [i0, i1, i2] = tri.map(add);
        if (i0 === i1 || i1 === i2 || i0 === i2) continue;
        // Back to the engine's winding.
        indices.push(i0, i2, i1);
      }
    }
    if (indices.length > start)
      groups.push({ source: source ? 'b' : 'a', start, count: indices.length - start });
  }
  const count = pos.length / 3;
  const mesh: MeshData = {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    uvs: new Float32Array(uv),
    ...(colors ? { colors: new Float32Array(col) } : {}),
    indices: count <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices),
  };
  if (a.tangents || b.tangents) mesh.tangents = computeMeshTangents(mesh);
  // Every triangle counts here, slivers too: leaving one out would open its edges.
  const { open: openEdges, many: nonManifoldEdges } = countEdges(mesh, tolerance * 10);
  return {
    mesh,
    groups,
    report: {
      operation,
      trianglesIn: [ta, tb],
      trianglesOut: indices.length / 3,
      openEdges,
      nonManifoldEdges,
      milliseconds: performance.now() - started,
    },
  };
}

/** Edges used by one triangle only and by more than two, once vertices within `tolerance` are welded. */
function countEdges(mesh: MeshData, tolerance: number): { open: number; many: number } {
  const ids = new Map<string, number>();
  const weld = (i: number) => {
    const key = [0, 1, 2].map((k) => Math.round(mesh.positions[i * 3 + k] / tolerance)).join(',');
    let id = ids.get(key);
    if (id === undefined) ids.set(key, (id = ids.size));
    return id;
  };
  const edges = new Map<string, number>();
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const w = [weld(mesh.indices[t]), weld(mesh.indices[t + 1]), weld(mesh.indices[t + 2])];
    for (let k = 0; k < 3; k++) {
      const a = w[k],
        b = w[(k + 1) % 3];
      if (a === b) continue;
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  let open = 0,
    many = 0;
  for (const n of edges.values()) {
    if (n === 1) open++;
    else if (n > 2) many++;
  }
  return { open, many };
}
