/**
 * Procedural geometry kit.
 *
 * Builders are pure data: they return the engine's existing `MeshData`
 * (POSITION/NORMAL/UV + 16-bit indices) and never touch Laya. Pass the result
 * to `ZhudaDynamicMesh` to draw it.
 *
 * Conventions
 * - Units are metres. UVs are metres too, so a material that repeats every
 *   `tileMeters` keeps real-world texel density on every part.
 * - Triangles use the same front-face winding as the terrain meshes in this
 *   engine: cross(v1 - v0, v2 - v0) points away from the surface normal.
 */
import type { MeshData } from '../runtime3d/Surfaces.ts';

export type ZhudaVec3 = [number, number, number];

const positive = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    throw Error(`${label} must be a positive number`);
  return value;
};
const vec = (value: unknown, label: string): ZhudaVec3 => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((n) => Number.isFinite(n)))
    throw Error(`${label} must be three finite numbers`);
  return value as ZhudaVec3;
};
const sub = (a: ZhudaVec3, b: ZhudaVec3): ZhudaVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: ZhudaVec3, b: ZhudaVec3): ZhudaVec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: ZhudaVec3, b: ZhudaVec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a: ZhudaVec3): ZhudaVec3 => {
  const length = Math.hypot(a[0], a[1], a[2]);
  if (!(length > 1e-12)) throw Error('Degenerate direction in procedural geometry');
  return [a[0] / length, a[1] / length, a[2] / length];
};

class MeshWriter {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];
  private readonly indices: number[] = [];

  vertex(p: ZhudaVec3, n: ZhudaVec3, u: number, v: number): number {
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.uvs.push(u, v);
    return this.positions.length / 3 - 1;
  }
  point(index: number): ZhudaVec3 {
    return [
      this.positions[index * 3],
      this.positions[index * 3 + 1],
      this.positions[index * 3 + 2],
    ];
  }
  /** Adds one triangle, ordering it for the engine winding relative to `outward`. */
  triangle(a: number, b: number, c: number, outward: ZhudaVec3): void {
    const facing = dot(cross(sub(this.point(b), this.point(a)), sub(this.point(c), this.point(a))), outward);
    if (facing > 0) this.indices.push(a, c, b);
    else this.indices.push(a, b, c);
  }
  /** Flat quad with one shared normal; corners may be given in either rotation. */
  quad(corners: [ZhudaVec3, ZhudaVec3, ZhudaVec3, ZhudaVec3], n: ZhudaVec3, uv: number[]): void {
    const base = corners.map((p, i) => this.vertex(p, n, uv[i * 2], uv[i * 2 + 1]));
    this.triangle(base[0], base[1], base[2], n);
    this.triangle(base[0], base[2], base[3], n);
  }
  finish(): MeshData {
    const count = this.positions.length / 3;
    if (count > 65535) throw Error('Procedural mesh exceeds 65535 vertices; split it into parts');
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      indices: new Uint16Array(this.indices),
    };
  }
}

const FACES: Array<{ n: ZhudaVec3; u: ZhudaVec3; v: ZhudaVec3 }> = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
const along = (axis: ZhudaVec3, half: ZhudaVec3) =>
  Math.abs(axis[0]) * half[0] + Math.abs(axis[1]) * half[1] + Math.abs(axis[2]) * half[2];

export interface ZhudaBoxOptions {
  width: number;
  height: number;
  depth: number;
  /** 'center' (default) or 'bottom': the origin sits on the middle of the underside. */
  origin?: 'center' | 'bottom';
  /** Chamfer size in metres; 0 or omitted gives sharp edges. */
  bevel?: number;
}

/** Axis-aligned box, optionally chamfered. X = width, Y = height, Z = depth. */
export function createZhudaBoxMesh(options: ZhudaBoxOptions): MeshData {
  const half: ZhudaVec3 = [
      positive(options.width, 'width') / 2,
      positive(options.height, 'height') / 2,
      positive(options.depth, 'depth') / 2,
    ],
    bevel = options.bevel ?? 0,
    lift = options.origin === 'bottom' ? half[1] : 0;
  if (options.origin !== undefined && options.origin !== 'center' && options.origin !== 'bottom')
    throw Error('origin must be center or bottom');
  if (!Number.isFinite(bevel) || bevel < 0 || bevel >= Math.min(half[0], half[1], half[2]))
    throw Error('bevel must be at least 0 and smaller than half the shortest side');
  const writer = new MeshWriter();
  const place = (x: number, y: number, z: number): ZhudaVec3 => [x, y + lift, z];
  for (const face of FACES) {
    const hn = along(face.n, half),
      hu = along(face.u, half) - bevel,
      hv = along(face.v, half) - bevel;
    const corner = (su: number, sv: number) =>
      place(
        face.n[0] * hn + face.u[0] * hu * su + face.v[0] * hv * sv,
        face.n[1] * hn + face.u[1] * hu * su + face.v[1] * hv * sv,
        face.n[2] * hn + face.u[2] * hu * su + face.v[2] * hv * sv,
      );
    writer.quad([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], face.n, [
      0,
      0,
      hu * 2,
      0,
      hu * 2,
      hv * 2,
      0,
      hv * 2,
    ]);
  }
  if (bevel > 0) {
    const width = bevel * Math.SQRT2;
    // Twelve edge chamfers: the edge runs along axis c between faces a and b.
    for (let c = 0; c < 3; c++) {
      const a = (c + 1) % 3,
        b = (c + 2) % 3;
      for (const sa of [-1, 1])
        for (const sb of [-1, 1]) {
          const point = (onA: boolean, sc: number) => {
            const p: ZhudaVec3 = [0, 0, 0];
            p[a] = sa * (onA ? half[a] : half[a] - bevel);
            p[b] = sb * (onA ? half[b] - bevel : half[b]);
            p[c] = sc * (half[c] - bevel);
            return place(p[0], p[1], p[2]);
          };
          const n: ZhudaVec3 = [0, 0, 0];
          n[a] = sa * Math.SQRT1_2;
          n[b] = sb * Math.SQRT1_2;
          const length = (half[c] - bevel) * 2;
          writer.quad([point(true, -1), point(true, 1), point(false, 1), point(false, -1)], n, [
            0,
            0,
            length,
            0,
            length,
            width,
            0,
            width,
          ]);
        }
    }
    // Eight corner triangles close the chamfered edges.
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const n = normalize([sx, sy, sz]),
            p0 = place(sx * half[0], sy * (half[1] - bevel), sz * (half[2] - bevel)),
            p1 = place(sx * (half[0] - bevel), sy * half[1], sz * (half[2] - bevel)),
            p2 = place(sx * (half[0] - bevel), sy * (half[1] - bevel), sz * half[2]),
            i0 = writer.vertex(p0, n, 0, 0),
            i1 = writer.vertex(p1, n, width, 0),
            i2 = writer.vertex(p2, n, width / 2, width);
          writer.triangle(i0, i1, i2, n);
        }
  }
  return writer.finish();
}

export interface ZhudaTubeOptions {
  /** Centre line; at least two distinct points. */
  path: ZhudaVec3[];
  radius: number;
  /** Sides around the tube, 3..64 (default 8). */
  radialSegments?: number;
  /** Close both ends with flat caps (default true). */
  caps?: boolean;
}

/** Round tube swept along a polyline with twist-free frames. */
export function createZhudaTubeMesh(options: ZhudaTubeOptions): MeshData {
  const radius = positive(options.radius, 'radius'),
    sides = options.radialSegments ?? 8,
    caps = options.caps ?? true;
  if (!Number.isInteger(sides) || sides < 3 || sides > 64)
    throw Error('radialSegments must be an integer 3..64');
  if (!Array.isArray(options.path) || options.path.length < 2 || options.path.length > 1024)
    throw Error('path needs 2..1024 points');
  const path = options.path.map((p, i) => vec(p, `path[${i}]`));
  const directions = path.slice(1).map((p, i) => normalize(sub(p, path[i])));
  const tangents = path.map((_, i) =>
    i === 0
      ? directions[0]
      : i === path.length - 1
        ? directions[directions.length - 1]
        : normalize([
            directions[i - 1][0] + directions[i][0],
            directions[i - 1][1] + directions[i][1],
            directions[i - 1][2] + directions[i][2],
          ]),
  );
  const seedAxis: ZhudaVec3 = Math.abs(tangents[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let side = normalize(cross(seedAxis, tangents[0]));
  const writer = new MeshWriter();
  const rings: number[][] = [];
  let travelled = 0;
  for (let i = 0; i < path.length; i++) {
    const t = tangents[i];
    if (i > 0) {
      travelled += Math.hypot(...sub(path[i], path[i - 1]));
      const k = dot(side, t);
      side = normalize([side[0] - t[0] * k, side[1] - t[1] * k, side[2] - t[2] * k]);
    }
    const other = cross(t, side);
    const ring: number[] = [];
    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2,
        cs = Math.cos(angle),
        sn = Math.sin(angle),
        n: ZhudaVec3 = [
          side[0] * cs + other[0] * sn,
          side[1] * cs + other[1] * sn,
          side[2] * cs + other[2] * sn,
        ];
      ring.push(
        writer.vertex(
          [path[i][0] + n[0] * radius, path[i][1] + n[1] * radius, path[i][2] + n[2] * radius],
          n,
          (s / sides) * Math.PI * 2 * radius,
          travelled,
        ),
      );
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++)
    for (let s = 0; s < sides; s++) {
      // Any vector on the outward side of this strip is enough to orient it.
      const ref = normalize(
        sub(midpoint(writer, rings[i][s], rings[i + 1][s + 1]), midLine(path, i)),
      );
      writer.triangle(rings[i][s], rings[i][s + 1], rings[i + 1][s + 1], ref);
      writer.triangle(rings[i][s], rings[i + 1][s + 1], rings[i + 1][s], ref);
    }
  if (caps)
    for (const end of [0, path.length - 1]) {
      const outward: ZhudaVec3 =
          end === 0
            ? [-tangents[0][0], -tangents[0][1], -tangents[0][2]]
            : tangents[end],
        centre = writer.vertex(path[end], outward, 0, 0),
        rim: number[] = [];
      for (let s = 0; s <= sides; s++) {
        const angle = (s / sides) * Math.PI * 2;
        rim.push(
          writer.vertex(
            writer.point(rings[end][s]),
            outward,
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
          ),
        );
      }
      for (let s = 0; s < sides; s++) writer.triangle(centre, rim[s], rim[s + 1], outward);
    }
  return writer.finish();
}
function midpoint(writer: MeshWriter, a: number, b: number): ZhudaVec3 {
  const p = writer.point(a),
    q = writer.point(b);
  return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
}
function midLine(path: ZhudaVec3[], i: number): ZhudaVec3 {
  return [
    (path[i][0] + path[i + 1][0]) / 2,
    (path[i][1] + path[i + 1][1]) / 2,
    (path[i][2] + path[i + 1][2]) / 2,
  ];
}

/** Straight round rod between two points. */
export function createZhudaRodMesh(
  from: ZhudaVec3,
  to: ZhudaVec3,
  radius: number,
  radialSegments = 8,
): MeshData {
  return createZhudaTubeMesh({ path: [vec(from, 'from'), vec(to, 'to')], radius, radialSegments });
}

export interface ZhudaIBeamOptions {
  length: number;
  /** Overall section height (flange to flange). */
  depth: number;
  /** Flange width. */
  width: number;
  flangeThickness: number;
  webThickness: number;
  /** Direction the beam runs along (default 'x'). The section height is Y, or Z for a 'y' beam. */
  axis?: 'x' | 'y' | 'z';
}

/** Structural I-section: two flanges and a web, centred on the origin. */
export function createZhudaIBeamMesh(options: ZhudaIBeamOptions): MeshData {
  const length = positive(options.length, 'length'),
    depth = positive(options.depth, 'depth'),
    width = positive(options.width, 'width'),
    flange = positive(options.flangeThickness, 'flangeThickness'),
    web = positive(options.webThickness, 'webThickness'),
    axis = options.axis ?? 'x';
  if (flange * 2 >= depth) throw Error('flangeThickness must be less than half the depth');
  if (web > width) throw Error('webThickness cannot exceed the flange width');
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') throw Error('axis must be x, y or z');
  const top = transformZhudaMesh(createZhudaBoxMesh({ width: length, height: flange, depth: width }), {
      position: [0, depth / 2 - flange / 2, 0],
    }),
    bottom = transformZhudaMesh(
      createZhudaBoxMesh({ width: length, height: flange, depth: width }),
      { position: [0, -depth / 2 + flange / 2, 0] },
    ),
    middle = createZhudaBoxMesh({ width: length, height: depth - flange * 2, depth: web }),
    beam = mergeZhudaMeshes([top, bottom, middle])[0];
  return axis === 'x'
    ? beam
    : transformZhudaMesh(beam, axis === 'z' ? { yawDeg: 90 } : { rollDeg: 90 });
}

export interface ZhudaMeshTransform {
  position?: ZhudaVec3;
  /** Rotation about +Y, applied after pitch and roll. */
  yawDeg?: number;
  /** Rotation about +X. */
  pitchDeg?: number;
  /** Rotation about +Z, applied first. */
  rollDeg?: number;
  /** Uniform positive scale, applied before rotation. */
  scale?: number;
}

/** Returns a transformed copy (scale, then roll, pitch, yaw, then translation). UVs are unchanged. */
export function transformZhudaMesh(data: MeshData, transform: ZhudaMeshTransform): MeshData {
  const position = transform.position ? vec(transform.position, 'position') : [0, 0, 0],
    scale = transform.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw Error('scale must be a positive number');
  const angles = [transform.pitchDeg ?? 0, transform.yawDeg ?? 0, transform.rollDeg ?? 0];
  if (!angles.every(Number.isFinite)) throw Error('rotation angles must be finite');
  const [px, py, pz] = angles.map((deg) => (deg * Math.PI) / 180),
    cx = Math.cos(px),
    sx = Math.sin(px),
    cy = Math.cos(py),
    sy = Math.sin(py),
    cz = Math.cos(pz),
    sz = Math.sin(pz);
  // R = Ry * Rx * Rz
  const m = [
    cy * cz + sy * sx * sz,
    -cy * sz + sy * sx * cz,
    sy * cx,
    cx * sz,
    cx * cz,
    -sx,
    -sy * cz + cy * sx * sz,
    sy * sz + cy * sx * cz,
    cy * cx,
  ];
  const rotate = (source: Float32Array, i: number, k: number, target: Float32Array, add: number[]) => {
    const x = source[i] * k,
      y = source[i + 1] * k,
      z = source[i + 2] * k;
    target[i] = m[0] * x + m[1] * y + m[2] * z + add[0];
    target[i + 1] = m[3] * x + m[4] * y + m[5] * z + add[1];
    target[i + 2] = m[6] * x + m[7] * y + m[8] * z + add[2];
  };
  const positions = new Float32Array(data.positions.length),
    normals = data.normals ? new Float32Array(data.normals.length) : undefined;
  for (let i = 0; i < positions.length; i += 3) {
    rotate(data.positions, i, scale, positions, position);
    if (normals && data.normals) rotate(data.normals, i, 1, normals, [0, 0, 0]);
  }
  return {
    positions,
    normals,
    uvs: data.uvs ? new Float32Array(data.uvs) : undefined,
    indices: data.indices.slice(),
  };
}

/**
 * Concatenates meshes that share one material. Output is split into chunks of
 * at most `maxVertices` so each chunk fits one `ZhudaDynamicMesh`.
 */
export function mergeZhudaMeshes(parts: readonly MeshData[], maxVertices = 65535): MeshData[] {
  if (!Number.isInteger(maxVertices) || maxVertices < 3 || maxVertices > 65535)
    throw Error('maxVertices must be an integer 3..65535');
  const chunks: MeshData[] = [];
  let group: MeshData[] = [],
    vertices = 0;
  const flush = () => {
    if (!group.length) return;
    const indexCount = group.reduce((sum, part) => sum + part.indices.length, 0),
      positions = new Float32Array(vertices * 3),
      normals = new Float32Array(vertices * 3),
      uvs = new Float32Array(vertices * 2),
      indices = new Uint16Array(indexCount);
    let v = 0,
      k = 0;
    for (const part of group) {
      const count = part.positions.length / 3;
      positions.set(part.positions, v * 3);
      if (part.normals) normals.set(part.normals, v * 3);
      else for (let i = 0; i < count; i++) normals[(v + i) * 3 + 1] = 1;
      if (part.uvs) uvs.set(part.uvs, v * 2);
      for (let i = 0; i < part.indices.length; i++) indices[k++] = part.indices[i] + v;
      v += count;
    }
    chunks.push({ positions, normals, uvs, indices });
    group = [];
    vertices = 0;
  };
  for (const part of parts) {
    const count = part.positions.length / 3;
    if (!Number.isInteger(count) || count < 3 || part.indices.length % 3)
      throw Error('Cannot merge an invalid mesh');
    if (count > maxVertices) throw Error('A single part exceeds maxVertices; split it first');
    if (vertices + count > maxVertices) flush();
    group.push(part);
    vertices += count;
  }
  flush();
  return chunks;
}

export function computeZhudaMeshBounds(data: MeshData): { min: ZhudaVec3; max: ZhudaVec3 } {
  const min: ZhudaVec3 = [Infinity, Infinity, Infinity],
    max: ZhudaVec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < data.positions.length; i += 3)
    for (let a = 0; a < 3; a++) {
      const value = data.positions[i + a];
      if (value < min[a]) min[a] = value;
      if (value > max[a]) max[a] = value;
    }
  return { min, max };
}
