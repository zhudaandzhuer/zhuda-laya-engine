/**
 * Triangle-exact picking without a physics engine.
 *
 * `ZhudaTriangleBvh` keeps a mesh's triangles in a bounding volume hierarchy
 * (binned surface-area split) in the mesh's own space. A ray is carried into
 * that space through the inverse of the world matrix, so moving the mesh is
 * `setMatrix`, not a rebuild. `createZhudaMeshQueryProvider` registers it with
 * `ZhudaSceneQueries`. Pure data: no LayaAir, no GPU read-back.
 */
import { transformPoint, type Matrix4, type Vec3 } from './Math3D.ts';
import type { QueryProvider, QueryRay } from './SceneQueries.ts';

export interface ZhudaMeshHit {
  /** Metres from the ray's origin, along its direction. */
  distance: number;
  /** Where the ray meets the triangle, in world space. */
  position: Vec3;
  /** The triangle's own unit normal in world space, out of its front face. */
  normal: Vec3;
  /** Which triangle: its corners are `indices[3 * triangle .. 3 * triangle + 2]`. */
  triangle: number;
  /** Weights of the triangle's three corners at the hit (they sum to 1): interpolate UVs or normals with them. */
  barycentric: [number, number, number];
  /** Whether the ray met the triangle's front. */
  frontFace: boolean;
}

export interface ZhudaTriangleBvhOptions {
  /** x, y, z per vertex in the mesh's own space. */
  positions: ArrayLike<number>;
  /** Three corners per triangle; omitted, every three vertices are one triangle. */
  indices?: ArrayLike<number>;
  /** The mesh's world matrix, column-major (`transform.worldMatrix.elements`); identity when omitted. */
  matrix?: Matrix4;
  /** Triangles in a leaf, 1..32 (default 4). */
  maxLeafTriangles?: number;
  /**
   * How a front face is wound seen from the front: 'cw' (default: LayaAir and
   * the engine's geometry builders) or 'ccw' (glTF and three.js source data).
   */
  winding?: 'cw' | 'ccw';
}

export interface ZhudaMeshRaycastOptions {
  /** Which faces count (default 'both'). */
  side?: 'both' | 'front' | 'back';
}

const BINS = 12;

function checkMatrix(matrix: Matrix4 | undefined): {
  forward: Float64Array;
  inverse: Float64Array;
} {
  const m = new Float64Array(matrix ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  if (m.length !== 16 || !m.every(Number.isFinite))
    throw Error('Mesh query matrix must be 16 finite numbers');
  if (m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1)
    throw Error('Mesh query matrix must be affine (no projection)');
  // Inverse of the 3x3 part by cofactors, in double precision; then the
  // translation carried back through it.
  const [a, b, c, , d, e, f, , g, h, k] = m,
    c0 = e * k - f * h,
    c1 = f * g - d * k,
    c2 = d * h - e * g,
    det = a * c0 + b * c1 + c * c2,
    scale = Math.max(...[a, b, c, d, e, f, g, h, k].map(Math.abs));
  if (!(Math.abs(det) > 1e-12 * scale * scale * scale))
    throw Error('Mesh query matrix cannot be inverted (a zero scale)');
  const r = 1 / det,
    inverse = new Float64Array(16);
  inverse.set([
    c0 * r,
    (c * h - b * k) * r,
    (b * f - c * e) * r,
    0,
    c1 * r,
    (a * k - c * g) * r,
    (c * d - a * f) * r,
    0,
    c2 * r,
    (b * g - a * h) * r,
    (a * e - b * d) * r,
    0,
  ]);
  for (let row = 0; row < 3; row++)
    inverse[12 + row] = -(
      inverse[row] * m[12] +
      inverse[4 + row] * m[13] +
      inverse[8 + row] * m[14]
    );
  inverse[15] = 1;
  return { forward: m, inverse };
}

export class ZhudaTriangleBvh {
  /** Triangles kept (those without area are left out of every query). */
  readonly triangleCount: number;
  private readonly positions: Float64Array;
  private readonly corners: Uint32Array;
  private readonly order: Uint32Array;
  private bounds = new Float64Array(0);
  /** Per node: [first, count] for a leaf (count > 0), [right child, 0] inside; the left child follows its parent. */
  private links = new Int32Array(0);
  private nodes = 0;
  private matrix!: Float64Array;
  private inverse!: Float64Array;
  private readonly ccw: boolean;

  constructor(options: ZhudaTriangleBvhOptions) {
    const positions = options?.positions;
    if (!positions || typeof positions.length !== 'number' || positions.length % 3)
      throw Error('Mesh query positions must hold x, y, z per vertex');
    const vertices = positions.length / 3;
    if (vertices < 3) throw Error('Mesh query needs at least one triangle');
    this.positions = new Float64Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      const value = positions[i];
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw Error(`Mesh query position ${Math.floor(i / 3)} is not finite`);
      this.positions[i] = value;
    }
    const indices = options.indices;
    const count = indices ? indices.length : vertices;
    if (count % 3 || count === 0) throw Error('Mesh query indices must come in threes');
    this.corners = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      const index = indices ? indices[i] : i;
      if (!Number.isInteger(index) || index < 0 || index >= vertices)
        throw Error(`Mesh query index ${i} (${index}) is outside the ${vertices} vertices`);
      this.corners[i] = index;
    }
    const leaf = options.maxLeafTriangles ?? 4;
    if (!Number.isInteger(leaf) || leaf < 1 || leaf > 32)
      throw Error('maxLeafTriangles must be a whole number 1..32');
    if (options.winding !== undefined && options.winding !== 'cw' && options.winding !== 'ccw')
      throw Error("winding must be 'cw' or 'ccw'");
    this.ccw = options.winding === 'ccw';
    this.setMatrix(options.matrix);
    // Triangles without area can never be hit; they are left out.
    const kept: number[] = [];
    for (let t = 0; t < count / 3; t++) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = this.triangle(t);
      const ux = bx - ax,
        uy = by - ay,
        uz = bz - az,
        vx = cx - ax,
        vy = cy - ay,
        vz = cz - az;
      if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > 0) kept.push(t);
    }
    this.order = Uint32Array.from(kept);
    this.triangleCount = kept.length;
    if (kept.length) this.build(leaf);
  }

  /** Number of nodes in the hierarchy. */
  get nodeCount() {
    return this.nodes;
  }

  /** Moves the mesh without rebuilding: the next query uses this world matrix. */
  setMatrix(matrix?: Matrix4): void {
    const checked = checkMatrix(matrix);
    this.matrix = checked.forward;
    this.inverse = checked.inverse;
  }

  /** World-space box round the whole mesh, or null when no triangle has area. */
  worldBounds(): { min: Vec3; max: Vec3 } | null {
    if (!this.nodes) return null;
    const b = this.bounds,
      min = { x: Infinity, y: Infinity, z: Infinity },
      max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (let corner = 0; corner < 8; corner++) {
      const p = transformPoint(this.matrix, {
        x: b[corner & 1 ? 3 : 0],
        y: b[corner & 2 ? 4 : 1],
        z: b[corner & 4 ? 5 : 2],
      });
      for (const axis of ['x', 'y', 'z'] as const) {
        min[axis] = Math.min(min[axis], p[axis]);
        max[axis] = Math.max(max[axis], p[axis]);
      }
    }
    return { min, max };
  }

  private triangle(t: number) {
    const p = this.positions,
      a = this.corners[t * 3] * 3,
      b = this.corners[t * 3 + 1] * 3,
      c = this.corners[t * 3 + 2] * 3;
    return [p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]];
  }

  private build(maxLeaf: number) {
    const count = this.order.length,
      centroids = new Float64Array(count * 3),
      boxes = new Float64Array(count * 6);
    for (let i = 0; i < count; i++) {
      const v = this.triangle(this.order[i]);
      for (let k = 0; k < 3; k++) {
        const lo = Math.min(v[k], v[k + 3], v[k + 6]),
          hi = Math.max(v[k], v[k + 3], v[k + 6]);
        boxes[i * 6 + k] = lo;
        boxes[i * 6 + 3 + k] = hi;
        centroids[i * 3 + k] = (v[k] + v[k + 3] + v[k + 6]) / 3;
      }
    }
    // Box and centroid arrays follow `order` while it is partitioned.
    const swap = (i: number, j: number) => {
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      for (let k = 0; k < 3; k++)
        [centroids[i * 3 + k], centroids[j * 3 + k]] = [centroids[j * 3 + k], centroids[i * 3 + k]];
      for (let k = 0; k < 6; k++)
        [boxes[i * 6 + k], boxes[j * 6 + k]] = [boxes[j * 6 + k], boxes[i * 6 + k]];
    };
    /** Orders a range by centroid along one axis, for a split at its median. */
    const sortRange = (start: number, end: number, axis: number) => {
      const ranked = Array.from({ length: end - start }, (_, i) => start + i).sort(
        (a, b) => centroids[a * 3 + axis] - centroids[b * 3 + axis],
      );
      const order = ranked.map((i) => this.order[i]),
        centre = ranked.flatMap((i) => [...centroids.subarray(i * 3, i * 3 + 3)]),
        box = ranked.flatMap((i) => [...boxes.subarray(i * 6, i * 6 + 6)]);
      this.order.set(order, start);
      centroids.set(centre, start * 3);
      boxes.set(box, start * 6);
    };
    const bounds: number[] = [],
      links: number[] = [];
    const area = (b: ArrayLike<number>, o = 0) => {
      const x = b[o + 3] - b[o],
        y = b[o + 4] - b[o + 1],
        z = b[o + 5] - b[o + 2];
      return x * y + y * z + z * x;
    };
    const grow = (into: number[] | Float64Array, from: ArrayLike<number>, o: number, at = 0) => {
      for (let k = 0; k < 3; k++) {
        into[at + k] = Math.min(into[at + k], from[o + k]);
        into[at + 3 + k] = Math.max(into[at + 3 + k], from[o + 3 + k]);
      }
    };
    const node = (start: number, end: number, depth: number): number => {
      const index = links.length / 2,
        box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
        centre = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = start; i < end; i++) {
        grow(box, boxes, i * 6);
        for (let k = 0; k < 3; k++) {
          centre[k] = Math.min(centre[k], centroids[i * 3 + k]);
          centre[3 + k] = Math.max(centre[3 + k], centroids[i * 3 + k]);
        }
      }
      bounds.push(...box);
      links.push(start, end - start);
      const n = end - start;
      if (n <= maxLeaf) return index;
      // Split across the longest spread of centroids, at the cheapest of the
      // bin boundaries by surface area.
      const spread = [0, 1, 2].map((k) => centre[3 + k] - centre[k]),
        axis = spread.indexOf(Math.max(...spread));
      if (!(spread[axis] > 0)) return index;
      const lo = centre[axis],
        scale = BINS / spread[axis],
        bin = (i: number) => Math.min(BINS - 1, Math.floor((centroids[i * 3 + axis] - lo) * scale));
      const binCount = new Array(BINS).fill(0),
        binBox = Array.from({ length: BINS }, () => [
          Infinity,
          Infinity,
          Infinity,
          -Infinity,
          -Infinity,
          -Infinity,
        ]);
      for (let i = start; i < end; i++) {
        const b = bin(i);
        binCount[b]++;
        grow(binBox[b], boxes, i * 6);
      }
      let bestCost = Infinity,
        bestSplit = -1;
      for (let split = 1; split < BINS; split++) {
        const left = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
          right = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        let nl = 0,
          nr = 0;
        for (let b = 0; b < split; b++)
          if (binCount[b]) {
            grow(left, binBox[b], 0);
            nl += binCount[b];
          }
        for (let b = split; b < BINS; b++)
          if (binCount[b]) {
            grow(right, binBox[b], 0);
            nr += binCount[b];
          }
        if (!nl || !nr) continue;
        const cost = area(left) * nl + area(right) * nr;
        if (cost < bestCost) {
          bestCost = cost;
          bestSplit = split;
        }
      }
      // Past depth 48 the split is at the median, which bounds the depth.
      let middle: number;
      if (bestSplit < 0 || depth > 48) {
        sortRange(start, end, axis);
        middle = (start + end) >> 1;
      } else {
        middle = start;
        for (let i = start; i < end; i++)
          if (bin(i) < bestSplit) {
            if (i !== middle) swap(i, middle);
            middle++;
          }
      }
      if (middle === start || middle === end) middle = (start + end) >> 1;
      links[index * 2 + 1] = 0;
      node(start, middle, depth + 1);
      links[index * 2] = node(middle, end, depth + 1);
      return index;
    };
    node(0, count, 0);
    this.bounds = Float64Array.from(bounds);
    this.links = Int32Array.from(links);
    this.nodes = links.length / 2;
  }

  /**
   * The nearest triangle the ray meets within `maxDistance` metres, or null.
   * The direction need not be unit length; distances are in world metres.
   */
  raycast(
    ray: QueryRay,
    maxDistance = Infinity,
    options: ZhudaMeshRaycastOptions = {},
  ): ZhudaMeshHit | null {
    const o = ray?.origin,
      d = ray?.direction;
    if (!o || !d || ![o.x, o.y, o.z, d.x, d.y, d.z].every(Number.isFinite))
      throw Error('Mesh query ray must have a finite origin and direction');
    const length = Math.hypot(d.x, d.y, d.z);
    if (!(length > 1e-12)) throw Error('Mesh query ray direction has no length');
    if (!(maxDistance >= 0)) throw Error('Mesh query distance must be 0 or more');
    const side = options.side ?? 'both';
    if (side !== 'both' && side !== 'front' && side !== 'back')
      throw Error("side must be 'both', 'front' or 'back'");
    if (!this.nodes) return null;
    // Into the mesh's own space. The direction keeps its world length, so a
    // distance along it is the same number in both spaces.
    const m = this.inverse,
      wx = d.x / length,
      wy = d.y / length,
      wz = d.z / length,
      ox = m[0] * o.x + m[4] * o.y + m[8] * o.z + m[12],
      oy = m[1] * o.x + m[5] * o.y + m[9] * o.z + m[13],
      oz = m[2] * o.x + m[6] * o.y + m[10] * o.z + m[14],
      dx = m[0] * wx + m[4] * wy + m[8] * wz,
      dy = m[1] * wx + m[5] * wy + m[9] * wz,
      dz = m[2] * wx + m[6] * wy + m[10] * wz;
    const ix = 1 / dx,
      iy = 1 / dy,
      iz = 1 / dz;
    const bounds = this.bounds;
    /** Where the ray enters node n's box, or Infinity when it misses or enters beyond `best`. */
    const enter = (n: number, best: number) => {
      let near = 0,
        far = best;
      const b = n * 6;
      for (let k = 0; k < 3; k++) {
        const origin = k === 0 ? ox : k === 1 ? oy : oz,
          direction = k === 0 ? dx : k === 1 ? dy : dz,
          inverse = k === 0 ? ix : k === 1 ? iy : iz,
          lo = bounds[b + k],
          hi = bounds[b + 3 + k];
        if (direction === 0) {
          if (origin < lo || origin > hi) return Infinity;
          continue;
        }
        let t0 = (lo - origin) * inverse,
          t1 = (hi - origin) * inverse;
        if (t0 > t1) [t0, t1] = [t1, t0];
        if (t0 > near) near = t0;
        if (t1 < far) far = t1;
        if (near > far) return Infinity;
      }
      return near;
    };
    let best = maxDistance,
      found = -1,
      foundU = 0,
      foundV = 0,
      foundFront = true;
    const stack = [0];
    while (stack.length) {
      const n = stack.pop()!;
      if (enter(n, best) === Infinity) continue;
      const first = this.links[n * 2],
        count = this.links[n * 2 + 1];
      if (count === 0) {
        const left = n + 1,
          right = first,
          nearLeft = enter(left, best),
          nearRight = enter(right, best);
        // Visit the nearer child first: it is pushed last.
        if (nearLeft <= nearRight) {
          if (nearRight !== Infinity) stack.push(right);
          if (nearLeft !== Infinity) stack.push(left);
        } else {
          if (nearLeft !== Infinity) stack.push(left);
          stack.push(right);
        }
        continue;
      }
      for (let i = first; i < first + count; i++) {
        const t = this.order[i],
          [ax, ay, az, bx, by, bz, cx, cy, cz] = this.triangle(t);
        // Möller-Trumbore.
        const e1x = bx - ax,
          e1y = by - ay,
          e1z = bz - az,
          e2x = cx - ax,
          e2y = cy - ay,
          e2z = cz - az,
          px = dy * e2z - dz * e2y,
          py = dz * e2x - dx * e2z,
          pz = dx * e2y - dy * e2x,
          det = e1x * px + e1y * py + e1z * pz;
        if (det === 0) continue;
        // det < 0: the ray runs along cross(e1, e2), which is the back of a
        // clockwise-wound front face.
        const front = this.ccw ? det > 0 : det < 0;
        if ((side === 'front' && !front) || (side === 'back' && front)) continue;
        const inv = 1 / det,
          sx = ox - ax,
          sy = oy - ay,
          sz = oz - az,
          u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y,
          qy = sz * e1x - sx * e1z,
          qz = sx * e1y - sy * e1x,
          v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const distance = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (distance < 0 || distance > best) continue;
        if (distance === best && found >= 0 && t > found) continue;
        best = distance;
        found = t;
        foundU = u;
        foundV = v;
        foundFront = front;
      }
    }
    if (found < 0) return null;
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = this.triangle(found);
    const e1 = [bx - ax, by - ay, bz - az],
      e2 = [cx - ax, cy - ay, cz - az],
      g = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ],
      // The front's normal in the mesh's own space, carried out by the
      // inverse transpose (it stays outward under a mirroring matrix too).
      sign = this.ccw ? 1 : -1,
      n = [
        sign * (m[0] * g[0] + m[1] * g[1] + m[2] * g[2]),
        sign * (m[4] * g[0] + m[5] * g[1] + m[6] * g[2]),
        sign * (m[8] * g[0] + m[9] * g[1] + m[10] * g[2]),
      ],
      nl = Math.hypot(n[0], n[1], n[2]);
    return {
      distance: best,
      position: { x: o.x + wx * best, y: o.y + wy * best, z: o.z + wz * best },
      normal: { x: n[0] / nl, y: n[1] / nl, z: n[2] / nl },
      triangle: found,
      barycentric: [1 - foundU - foundV, foundU, foundV],
      frontFace: foundFront,
    };
  }
}

export interface ZhudaMeshQueryProviderOptions extends ZhudaMeshRaycastOptions {
  entityId: string;
  instanceId?: string | number;
  layer?: number;
}

/**
 * A `QueryProvider` for `ZhudaSceneQueries` that answers with the triangle a
 * ray meets on this mesh. The hit carries `triangle`, `barycentric` and
 * `frontFace` beside the usual position, normal and distance.
 */
export function createZhudaMeshQueryProvider(
  bvh: ZhudaTriangleBvh,
  options: ZhudaMeshQueryProviderOptions,
): QueryProvider & { raycast: (ray: QueryRay, maxDistance: number) => ZhudaMeshHit | null } {
  if (!(bvh instanceof ZhudaTriangleBvh))
    throw Error('Mesh query provider needs a ZhudaTriangleBvh');
  if (!options?.entityId) throw Error('Mesh query provider needs a stable entityId');
  if (options.layer !== undefined && !(Number.isInteger(options.layer) && options.layer >= 0))
    throw Error('Mesh query layer must be a whole number bit mask');
  const side = options.side ?? 'both';
  return {
    entityId: options.entityId,
    instanceId: options.instanceId,
    layer: options.layer,
    raycast: (ray, maxDistance) => bvh.raycast(ray, maxDistance, { side }),
  };
}

/** The LayaAir `Mesh` members `readZhudaLayaMeshTriangles` reads. */
export interface ZhudaLayaMeshLike {
  getPositions(out: { x: number; y: number; z: number }[]): void;
  getIndices(): ArrayLike<number>;
}

/**
 * Positions and triangle corners of a LayaAir mesh (all of its sub-meshes),
 * for a `ZhudaTriangleBvh`. LayaAir keeps a mesh's CPU copy only while it is
 * readable: a mesh loaded without it throws here.
 */
export function readZhudaLayaMeshTriangles(mesh: ZhudaLayaMeshLike): {
  positions: Float32Array;
  indices: Uint32Array;
} {
  if (!mesh || typeof mesh.getPositions !== 'function' || typeof mesh.getIndices !== 'function')
    throw Error('Not a LayaAir mesh: it needs getPositions and getIndices');
  let points: { x: number; y: number; z: number }[] = [],
    indices: ArrayLike<number>;
  try {
    mesh.getPositions(points);
    indices = mesh.getIndices();
  } catch (error) {
    throw Error(
      'This LayaAir mesh keeps no CPU copy of its vertices (it is not readable): ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  points = points ?? [];
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => positions.set([p.x, p.y, p.z], i * 3));
  return { positions, indices: Uint32Array.from(indices ?? []) };
}
