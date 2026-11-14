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
    const facing = dot(
      cross(sub(this.point(b), this.point(a)), sub(this.point(c), this.point(a))),
      outward,
    );
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
          end === 0 ? [-tangents[0][0], -tangents[0][1], -tangents[0][2]] : tangents[end],
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
  const top = transformZhudaMesh(
      createZhudaBoxMesh({ width: length, height: flange, depth: width }),
      {
        position: [0, depth / 2 - flange / 2, 0],
      },
    ),
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

export interface ZhudaLatheOptions {
  /**
   * The outline as [radius, height] pairs in metres, 2..256 of them, turned
   * about the vertical axis. List it from the bottom up along the outside; a
   * hollow form (a bowl, a pipe) goes on down the inside. A radius of 0 is on
   * the axis.
   */
  profile: readonly (readonly [number, number])[];
  /** Sides around the axis, 3..96 (default 24). */
  segments?: number;
  /** Close the first and the last ring with a flat disc where it is off the axis (default true). */
  caps?: boolean;
  /** A corner of the outline sharper than this many degrees stays an edge (default 30). */
  creaseDeg?: number;
}

export function validateZhudaLathe(options: ZhudaLatheOptions): string[] {
  const issues: string[] = [];
  const o = options ?? ({} as ZhudaLatheOptions);
  const profile = o.profile as unknown;
  if (!Array.isArray(profile) || profile.length < 2 || profile.length > 256)
    issues.push('profile: use 2..256 [radius, height] pairs');
  else
    profile.forEach((point, i) => {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !point.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000)
      )
        issues.push(`profile[${i}]: use [radius, height] in metres`);
      else if (point[0] < 0) issues.push(`profile[${i}]: the radius cannot be negative`);
      else if (i > 0) {
        const before = profile[i - 1];
        if (Array.isArray(before) && before[0] === point[0] && before[1] === point[1])
          issues.push(`profile[${i}]: the same point as the one before it`);
      }
    });
  if (
    o.segments !== undefined &&
    !(Number.isInteger(o.segments) && o.segments >= 3 && o.segments <= 96)
  )
    issues.push('segments: use a whole number 3..96');
  if (o.caps !== undefined && typeof o.caps !== 'boolean') issues.push('caps: true or false');
  if (o.creaseDeg !== undefined && !(o.creaseDeg >= 0 && o.creaseDeg <= 180))
    issues.push('creaseDeg: use 0..180');
  return issues;
}

/** A body of revolution about +Y: bollards, barrels, domes, bowls, columns, cones. */
export function createZhudaLatheMesh(options: ZhudaLatheOptions): MeshData {
  const issues = validateZhudaLathe(options);
  if (issues.length) throw Error('Invalid lathe: ' + issues.join('; '));
  const profile = options.profile,
    sides = options.segments ?? 24,
    caps = options.caps ?? true,
    crease = Math.cos(((options.creaseDeg ?? 30) * Math.PI) / 180),
    count = profile.length - 1;
  // Outward in the outline's own plane: to the right of the way it is drawn.
  const flat: [number, number][] = [];
  const travelled = [0];
  for (let i = 0; i < count; i++) {
    const dr = profile[i + 1][0] - profile[i][0],
      dh = profile[i + 1][1] - profile[i][1],
      length = Math.hypot(dr, dh);
    flat.push([dh / length, -dr / length]);
    travelled.push(travelled[i] + length);
  }
  // The normal a segment uses at one of its ends: shared with its neighbour unless the corner is sharp.
  const at = (segment: number, neighbour: number): [number, number] => {
    const own = flat[segment],
      other = flat[neighbour];
    if (!other || own[0] * other[0] + own[1] * other[1] < crease) return own;
    const x = own[0] + other[0],
      y = own[1] + other[1],
      length = Math.hypot(x, y);
    return length > 1e-9 ? [x / length, y / length] : own;
  };
  const writer = new MeshWriter();
  const EPS = 1e-9;
  // One scale around the axis for the whole form: UVs then run on from ring to
  // ring, and a normal map keeps one direction across them. Toward the axis
  // the texture is squeezed, as on any cap.
  const widest = Math.max(1e-3, ...profile.map((point) => point[0]));
  for (let i = 0; i < count; i++) {
    const ends = [at(i, i - 1), at(i, i + 1)];
    const rings = [0, 1].map((end) => {
      const [radius, height] = profile[i + end],
        normal = ends[end],
        ring: number[] = [];
      for (let s = 0; s <= sides; s++) {
        const angle = (s / sides) * Math.PI * 2,
          cs = Math.cos(angle),
          sn = Math.sin(angle);
        ring.push(
          writer.vertex(
            [radius * cs, height, radius * sn],
            [normal[0] * cs, normal[1], normal[0] * sn],
            angle * widest,
            travelled[i + end],
          ),
        );
      }
      return ring;
    });
    for (let s = 0; s < sides; s++) {
      const middle = ((s + 0.5) / sides) * Math.PI * 2;
      const outward: ZhudaVec3 = [
        flat[i][0] * Math.cos(middle),
        flat[i][1],
        flat[i][0] * Math.sin(middle),
      ];
      // A ring on the axis is one point: that side of the quad has no triangle.
      if (profile[i][0] > EPS)
        writer.triangle(rings[0][s], rings[0][s + 1], rings[1][s + 1], outward);
      if (profile[i + 1][0] > EPS)
        writer.triangle(rings[0][s], rings[1][s + 1], rings[1][s], outward);
    }
  }
  if (caps)
    for (const [end, up] of [
      [0, -1],
      [count, 1],
    ] as const) {
      const [radius, height] = profile[end];
      if (!(radius > EPS)) continue;
      const outward: ZhudaVec3 = [0, up, 0];
      const centre = writer.vertex([0, height, 0], outward, 0, 0),
        rim: number[] = [];
      for (let s = 0; s <= sides; s++) {
        const angle = (s / sides) * Math.PI * 2,
          x = radius * Math.cos(angle),
          z = radius * Math.sin(angle);
        rim.push(writer.vertex([x, height, z], outward, x, z));
      }
      for (let s = 0; s < sides; s++) writer.triangle(centre, rim[s], rim[s + 1], outward);
    }
  return writer.finish();
}

export interface ZhudaExtrudeOptions {
  /**
   * The outline on the ground as [x, z] pairs in metres, 3..256 of them, in
   * either direction. It may be concave; it must not cross itself.
   */
  outline: readonly (readonly [number, number])[];
  /** How far it is raised along +Y, in metres. */
  height: number;
  /** Close the top and the underside (default true). */
  caps?: boolean;
  /**
   * Openings right through the shape (a window in a wall piece, the inside of
   * a letter O), up to 32 of them. Each is an outline of 3..256 [x, z] pairs
   * in either direction, inside the outline and clear of its edges and of
   * the other holes.
   */
  holes?: readonly (readonly (readonly [number, number])[])[];
  /**
   * Cut off or round the top edges by this many metres (default 0, sharp).
   * The wall stops this far below the top and the top is drawn in by it;
   * holes are widened by it at the top. The footprint stays the outline.
   * Needs caps.
   */
  bevel?: number;
  /** 1 (default) cuts the edges off flat; 2..8 rounds them in that many steps. */
  bevelSegments?: number;
  /** Bevel the underside's edges too (default false: a shape standing on the ground). */
  bevelBottom?: boolean;
}

type Point2 = readonly [number, number];

const area2 = (outline: readonly (readonly [number, number])[]) => {
  let sum = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x0, z0] = outline[i],
      [x1, z1] = outline[(i + 1) % outline.length];
    sum += x0 * z1 - x1 * z0;
  }
  return sum;
};
/** Whether segments ab and cd cross at a point inside both. */
const crosses = (
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  d: readonly [number, number],
) => {
  const side = (
    p: readonly [number, number],
    q: readonly [number, number],
    r: readonly [number, number],
  ) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = side(a, b, c),
    d2 = side(a, b, d),
    d3 = side(c, d, a),
    d4 = side(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
};

const turn2 = (p: Point2, q: Point2, r: Point2) =>
  (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
/** Distance from p to the segment ab. */
const toSegment = (p: Point2, a: Point2, b: Point2) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length2 = dx * dx + dz * dz,
    t =
      length2 > 0
        ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2))
        : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
};
/** Whether p lies inside the closed ring (crossing count; a point on an edge may go either way). */
const insideRing = (p: Point2, ring: readonly Point2[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
    )
      inside = !inside;
  }
  return inside;
};
/** Closest approach of two closed rings, or 0 where their edges cross. */
const ringGap = (a: readonly Point2[], b: readonly Point2[]) => {
  let gap = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i],
      a1 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j],
        b1 = b[(j + 1) % b.length];
      if (crosses(a0, a1, b0, b1)) return 0;
      gap = Math.min(gap, toSegment(a0, b0, b1), toSegment(b0, a0, a1));
    }
  }
  return gap;
};
/** Whether a closed ring crosses itself. */
const selfCrossing = (ring: readonly Point2[]) => {
  for (let i = 0; i < ring.length; i++)
    for (let j = i + 2; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue;
      if (crosses(ring[i], ring[i + 1], ring[j], ring[(j + 1) % ring.length])) return true;
    }
  return false;
};
/** Smallest gap allowed between a hole and the outline or another hole, in metres. */
const CLEARANCE = 1e-4;

/** The outline counter-clockwise and the holes clockwise: the material is then to the left of every edge. */
function extrudeRings(options: ZhudaExtrudeOptions): [number, number][][] {
  const outline = options.outline.map(([x, z]) => [x, z] as [number, number]);
  if (area2(outline) < 0) outline.reverse();
  const holes = (options.holes ?? []).map((hole) => {
    const ring = hole.map(([x, z]) => [x, z] as [number, number]);
    if (area2(ring) > 0) ring.reverse();
    return ring;
  });
  return [outline, ...holes];
}

/**
 * A ring moved `amount` metres into the material, every edge kept parallel:
 * the outline is drawn in, a hole is widened. Null where a corner turns
 * straight back on itself.
 */
function offsetRing(ring: readonly Point2[], amount: number): [number, number][] | null {
  if (amount === 0) return ring.map(([x, z]) => [x, z]);
  const count = ring.length;
  // Each edge's normal away from the material: to its right.
  const away = ring.map((p, i) => {
    const q = ring[(i + 1) % count],
      length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [(q[1] - p[1]) / length, -(q[0] - p[0]) / length];
  });
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const a = away[(i + count - 1) % count],
      b = away[i],
      k = 1 + a[0] * b[0] + a[1] * b[1];
    if (!(k > 1e-6)) return null;
    out.push([
      ring[i][0] - (amount * (a[0] + b[0])) / k,
      ring[i][1] - (amount * (a[1] + b[1])) / k,
    ]);
  }
  return out;
}

/** Issues where a hole is not inside the outline, clear of it and of the other holes. */
function ringLayoutIssues(rings: readonly (readonly Point2[])[]): string[] {
  const issues: string[] = [];
  const [outline, ...holes] = rings;
  holes.forEach((hole, h) => {
    if (!hole.every((p) => insideRing(p, outline)) || ringGap(hole, outline) < CLEARANCE)
      issues.push(`holes[${h}]: it must lie inside the outline, clear of its edges`);
    for (let g = h + 1; g < holes.length; g++)
      if (
        ringGap(hole, holes[g]) < CLEARANCE ||
        hole.some((p) => insideRing(p, holes[g])) ||
        holes[g].some((p) => insideRing(p, hole))
      )
        issues.push(`holes[${h}]: it overlaps or touches holes[${g}]`);
  });
  return issues;
}

export function validateZhudaExtrude(options: ZhudaExtrudeOptions): string[] {
  const o = options ?? ({} as ZhudaExtrudeOptions);
  const issues = outlineIssues(o.outline, 'outline', '[x, z]', 256);
  let sound = issues.length === 0;
  const holes = o.holes as unknown;
  if (holes !== undefined) {
    if (!Array.isArray(holes) || holes.length > 32) {
      issues.push('holes: use a list of up to 32 outlines');
      sound = false;
    } else
      holes.forEach((hole, h) => {
        const own = outlineIssues(hole, `holes[${h}]`, '[x, z]', 256);
        issues.push(...own);
        if (own.length) sound = false;
      });
  }
  if (!(typeof o.height === 'number' && o.height > 0 && o.height <= 1000))
    issues.push('height: use a positive number of metres');
  if (o.caps !== undefined && typeof o.caps !== 'boolean') issues.push('caps: true or false');
  const bevel = o.bevel ?? 0,
    steps = o.bevelSegments ?? 1;
  let bevelSound = true;
  if (!(typeof bevel === 'number' && bevel >= 0 && bevel <= 100)) {
    issues.push('bevel: use 0..100 metres');
    bevelSound = false;
  }
  if (!(Number.isInteger(steps) && steps >= 1 && steps <= 8)) {
    issues.push('bevelSegments: use a whole number 1..8');
    bevelSound = false;
  }
  if (o.bevelBottom !== undefined && typeof o.bevelBottom !== 'boolean') {
    issues.push('bevelBottom: true or false');
    bevelSound = false;
  }
  if (bevelSound && bevel > 0) {
    if (o.caps === false) issues.push('bevel: a bevel needs caps');
    if (typeof o.height === 'number' && bevel * (o.bevelBottom ? 2 : 1) >= o.height)
      issues.push(
        o.bevelBottom
          ? 'bevel: twice the bevel must be less than the height'
          : 'bevel: it must be less than the height',
      );
  }
  if (sound) {
    const rings = extrudeRings(o);
    const layout = ringLayoutIssues(rings);
    issues.push(...layout);
    if (!layout.length && bevelSound && bevel > 0) {
      // The top, drawn in by the bevel, must still be the same shape: no edge
      // turned round, nothing crossing, every hole still inside.
      const top = rings.map((ring) => offsetRing(ring, bevel));
      const kept = top.every(
        (ring, r) =>
          ring !== null &&
          ring.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])) &&
          ring.every((p, i) => {
            const q = ring[(i + 1) % ring.length],
              a = rings[r][i],
              b = rings[r][(i + 1) % ring.length];
            return (q[0] - p[0]) * (b[0] - a[0]) + (q[1] - p[1]) * (b[1] - a[1]) > 1e-12;
          }) &&
          !selfCrossing(ring),
      );
      if (!kept || ringLayoutIssues(top as [number, number][][]).length)
        issues.push('bevel: too wide for this outline; the top would cross itself');
    }
    const edges = rings.reduce((sum, ring) => sum + ring.length, 0),
      sides = bevel > 0 && bevelSound ? (o.bevelBottom ? 2 : 1) : 0,
      vertices = 4 * edges + sides * 2 * edges * (steps + 1) + (o.caps === false ? 0 : 2 * edges);
    if (vertices > 65535)
      issues.push(
        `outline: ${vertices} vertices is more than one mesh holds (65535); use fewer points`,
      );
  }
  return issues;
}

/**
 * A flat outline raised to a height: kerbs, steps, signs, wall pieces, L and
 * U profiles; with `holes`, windows and doorways; with `bevel`, worn or
 * rounded top edges.
 */
export function createZhudaExtrudeMesh(options: ZhudaExtrudeOptions): MeshData {
  const issues = validateZhudaExtrude(options);
  if (issues.length) throw Error('Invalid extrusion: ' + issues.join('; '));
  const rings = extrudeRings(options);
  const height = options.height,
    caps = options.caps ?? true,
    bevel = options.bevel ?? 0,
    steps = options.bevelSegments ?? 1,
    bevelBottom = bevel > 0 && options.bevelBottom === true,
    low = bevelBottom ? bevel : 0,
    high = bevel > 0 ? height - bevel : height,
    writer = new MeshWriter();
  // Across a bevel, step k is drawn in by `inset` and raised by `rise` from
  // where the wall stops; its normal is tilted from level toward up by `tilt`.
  // A flat cut has one tilt; a rounded one follows a quarter circle.
  const profile = Array.from({ length: steps + 1 }, (_, k) => {
    const angle = (k / steps) * (Math.PI / 2);
    // The ends are exact, so that the band meets the wall and the cap.
    return {
      inset: k === 0 ? 0 : k === steps ? bevel : bevel * (1 - Math.cos(angle)),
      rise: k === 0 ? 0 : k === steps ? bevel : bevel * Math.sin(angle),
      arc: steps === 1 ? k * bevel * Math.SQRT2 : bevel * angle,
      tilt: steps === 1 ? Math.PI / 4 : angle,
    };
  });
  for (const ring of rings) {
    const count = ring.length,
      rows = bevel > 0 ? profile.map((step) => offsetRing(ring, step.inset)!) : [];
    let along = 0;
    for (let i = 0; i < count; i++) {
      const [x0, z0] = ring[i],
        [x1, z1] = ring[(i + 1) % count],
        length = Math.hypot(x1 - x0, z1 - z0),
        away: [number, number] = [(z1 - z0) / length, -(x1 - x0) / length];
      writer.quad(
        [
          [x0, low, z0],
          [x1, low, z1],
          [x1, high, z1],
          [x0, high, z0],
        ],
        [away[0], 0, away[1]],
        [along, low, along + length, low, along + length, high, along, high],
      );
      const bands: [number, 1 | -1][] = bevel > 0 ? [[high, 1]] : [];
      if (bevelBottom) bands.push([low, -1]);
      for (const [base, up] of bands) {
        const tilted = (tilt: number): ZhudaVec3 => [
          away[0] * Math.cos(tilt),
          up * Math.sin(tilt),
          away[1] * Math.cos(tilt),
        ];
        const band = profile.map((step, k) => {
          const a = rows[k][i],
            b = rows[k][(i + 1) % count],
            y = k === steps ? (up > 0 ? height : 0) : base + up * step.rise,
            v = base + up * step.arc,
            n = tilted(step.tilt);
          return [
            writer.vertex([a[0], y, a[1]], n, along, v),
            writer.vertex([b[0], y, b[1]], n, along + length, v),
          ];
        });
        for (let k = 0; k < steps; k++) {
          const outward = tilted((profile[k].tilt + profile[k + 1].tilt) / 2);
          writer.triangle(band[k][0], band[k][1], band[k + 1][1], outward);
          writer.triangle(band[k][0], band[k + 1][1], band[k + 1][0], outward);
        }
      }
      along += length;
    }
  }
  if (caps)
    for (const [y, up, inset] of [
      [height, 1, bevel],
      [0, -1, bevelBottom ? bevel : 0],
    ] as const) {
      const capRings = rings.map((ring) => offsetRing(ring, inset)!),
        points = capRings.flat(),
        spans: [number, number][] = [];
      for (let r = 0, first = 0; r < capRings.length; first += capRings[r].length, r++)
        spans.push([first, capRings[r].length]);
      const outward: ZhudaVec3 = [0, up, 0];
      const corner = points.map(([x, z]) => writer.vertex([x, y, z], outward, x, z));
      for (const [a, b, c] of fillRegion(points, spans, 'Invalid extrusion'))
        writer.triangle(corner[a], corner[b], corner[c], outward);
    }
  return writer.finish();
}

/**
 * Triangles that fill an outline with holes, as indices into `points`.
 * `rings` gives each ring as [first, count]: the first is the outline,
 * counter-clockwise; the rest are holes, clockwise, inside it and clear of it
 * and of each other. Each hole is joined to the outline by a cut, rightmost
 * hole first, which leaves one outline to fill by ear clipping.
 */
function fillRegion(
  points: readonly Point2[],
  rings: readonly (readonly [number, number])[],
  what: string,
): [number, number, number][] {
  const ring = ([first, count]: readonly [number, number]) =>
    Array.from({ length: count }, (_, i) => first + i);
  const right = (indices: number[]) => Math.max(...indices.map((i) => points[i][0]));
  let polygon = ring(rings[0]);
  const holes = rings
    .slice(1)
    .map(ring)
    .sort((a, b) => right(b) - right(a));
  for (const hole of holes) polygon = joinHole(points, polygon, hole, what);
  return clipEars(points, polygon, what);
}

/**
 * Joins a hole to the polygon: from the hole's rightmost point M along +x to
 * the first edge met, then to a corner of the polygon that M can see.
 */
function joinHole(points: readonly Point2[], polygon: number[], hole: number[], what: string) {
  let m = 0;
  for (let i = 1; i < hole.length; i++) {
    const p = points[hole[i]],
      q = points[hole[m]];
    if (p[0] > q[0] || (p[0] === q[0] && p[1] < q[1])) m = i;
  }
  const M = points[hole[m]];
  let nearest = Infinity,
    edge = -1;
  for (let i = 0; i < polygon.length; i++) {
    const a = points[polygon[i]],
      b = points[polygon[(i + 1) % polygon.length]];
    if (a[1] === b[1] || (a[1] - M[1]) * (b[1] - M[1]) > 0) continue;
    const x = a[0] + ((M[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
    if (x >= M[0] && x < nearest) {
      nearest = x;
      edge = i;
    }
  }
  if (edge < 0) throw Error(`${what}: a hole could not be joined to the outline`);
  const I: Point2 = [nearest, M[1]],
    a = polygon[edge],
    b = polygon[(edge + 1) % polygon.length];
  let target = points[a][0] > points[b][0] ? a : b;
  if (points[a][0] === I[0] && points[a][1] === I[1]) target = a;
  else if (points[b][0] === I[0] && points[b][1] === I[1]) target = b;
  else {
    // A corner inside the triangle M, I, P may hide P from M: then the one
    // closest in angle to the line from M is seen.
    const P = points[target];
    let best = Infinity,
      bestDistance = Infinity,
      seen = -1;
    for (const index of polygon) {
      if (index === target) continue;
      const R = points[index],
        d1 = turn2(M, I, R),
        d2 = turn2(I, P, R),
        d3 = turn2(P, M, R);
      if ((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) continue;
      const dx = R[0] - M[0],
        dz = Math.abs(R[1] - M[1]);
      if (!(dx > 0)) continue;
      const tan = dz / dx,
        distance = Math.hypot(dx, dz);
      if (tan < best - 1e-12 || (Math.abs(tan - best) <= 1e-12 && distance < bestDistance)) {
        best = tan;
        bestDistance = distance;
        seen = index;
      }
    }
    if (seen >= 0) target = seen;
  }
  // A corner already used by a cut appears twice: join at the copy whose
  // angle opens toward M.
  let at = -1;
  for (let k = 0; k < polygon.length && at < 0; k++) {
    if (polygon[k] !== target) continue;
    const before = points[polygon[(k + polygon.length - 1) % polygon.length]],
      here = points[target],
      after = points[polygon[(k + 1) % polygon.length]],
      inLeft = turn2(before, here, M) >= 0,
      outLeft = turn2(here, after, M) >= 0;
    if (turn2(before, here, after) >= 0 ? inLeft && outLeft : inLeft || outLeft) at = k;
  }
  if (at < 0) at = polygon.indexOf(target);
  return [
    ...polygon.slice(0, at + 1),
    ...hole.slice(m),
    ...hole.slice(0, m),
    hole[m],
    target,
    ...polygon.slice(at + 1),
  ];
}

/**
 * Ear clipping of a counter-clockwise polygon given as indices into `points`
 * (a corner may appear twice where a cut joins a hole): cut off a corner that
 * bulges outward and holds no other point. A corner on a straight line is cut
 * only when nothing else is left.
 */
function clipEars(points: readonly Point2[], polygon: number[], what: string) {
  const left = polygon.slice(),
    triangles: [number, number, number][] = [];
  const corner = (i: number): [number, number, number] => [
    left[(i + left.length - 1) % left.length],
    left[i],
    left[(i + 1) % left.length],
  ];
  const ear = (i: number, flat: boolean) => {
    const [a, b, c] = corner(i),
      A = points[a],
      B = points[b],
      C = points[c],
      t = turn2(A, B, C);
    if (flat ? t < -1e-12 : t <= 1e-12) return false;
    for (const p of left) {
      if (p === a || p === b || p === c) continue;
      const P = points[p];
      if (turn2(A, B, P) >= 0 && turn2(B, C, P) >= 0 && turn2(C, A, P) >= 0) return false;
    }
    return true;
  };
  let i = 0,
    misses = 0,
    flat = false;
  while (left.length > 3) {
    if (ear(i, flat)) {
      triangles.push(corner(i));
      left.splice(i, 1);
      // The corner before may have become an ear.
      i = (i + left.length - 1) % left.length;
      misses = 0;
      flat = false;
    } else {
      i = (i + 1) % left.length;
      if (++misses < left.length) continue;
      if (flat) throw Error(`${what}: the outline could not be filled`);
      flat = true;
      misses = 0;
    }
  }
  triangles.push([left[0], left[1], left[2]]);
  return triangles;
}

/** Checks a closed outline of [a, b] pairs: finite, no point twice in a row, no crossing, some area. */
function outlineIssues(outline: unknown, name: string, pair: string, most: number): string[] {
  const issues: string[] = [];
  let sound = false;
  if (!Array.isArray(outline) || outline.length < 3 || outline.length > most)
    issues.push(`${name}: use 3..${most} ${pair} pairs`);
  else {
    sound = true;
    outline.forEach((point, i) => {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !point.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000)
      ) {
        issues.push(`${name}[${i}]: use ${pair} in metres`);
        sound = false;
      } else {
        const before = outline[(i + outline.length - 1) % outline.length];
        if (Array.isArray(before) && before[0] === point[0] && before[1] === point[1]) {
          issues.push(`${name}[${i}]: the same point as the one before it`);
          sound = false;
        }
      }
    });
  }
  if (sound) {
    const points = outline as [number, number][];
    let crossing = false;
    search: for (let i = 0; i < points.length; i++)
      for (let j = i + 2; j < points.length; j++) {
        if (i === 0 && j === points.length - 1) continue;
        if (crosses(points[i], points[i + 1], points[j], points[(j + 1) % points.length])) {
          issues.push(`${name}: edge ${i} crosses edge ${j}`);
          crossing = true;
          break search;
        }
      }
    if (!crossing && Math.abs(area2(points)) < 1e-9) issues.push(`${name}: it encloses no area`);
  }
  return issues;
}

export interface ZhudaSweepOptions {
  /**
   * The cross-section as [across, up] pairs in metres, 3..64 of them, in
   * either direction: across is to the left of the way the path runs, up is
   * up. It may be concave; it must not cross itself. [0, 0] lies on the path.
   */
  profile: readonly (readonly [number, number])[];
  /** The line the section is carried along, 2..1024 points in metres. */
  path: readonly (readonly [number, number, number])[];
  /** The path returns to its first point: a ring with no ends (default false). */
  closed?: boolean;
  /** Close the two ends (default true); ignored on a closed path. */
  caps?: boolean;
}

export function validateZhudaSweep(options: ZhudaSweepOptions): string[] {
  const o = options ?? ({} as ZhudaSweepOptions);
  const issues = outlineIssues(o.profile, 'profile', '[across, up]', 64);
  const path = o.path as unknown;
  if (!Array.isArray(path) || path.length < 2 || path.length > 1024)
    issues.push('path: use 2..1024 [x, y, z] points');
  else {
    let sound = true;
    path.forEach((point, i) => {
      if (
        !Array.isArray(point) ||
        point.length !== 3 ||
        !point.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100000)
      ) {
        issues.push(`path[${i}]: use [x, y, z] in metres`);
        sound = false;
      } else if (
        i > 0 &&
        Array.isArray(path[i - 1]) &&
        path[i - 1].every((n: unknown, k: number) => n === point[k])
      ) {
        issues.push(`path[${i}]: the same point as the one before it`);
        sound = false;
      }
    });
    if (sound && o.closed === true) {
      if (path.length < 3) {
        issues.push('path: a closed path needs three points or more');
        sound = false;
      } else if (path[0].every((n: number, k: number) => n === path[path.length - 1][k])) {
        issues.push('path: a closed path does not repeat its first point at the end');
        sound = false;
      }
    }
    // A corner sharper than about 150 degrees would stretch the section without end.
    if (sound) {
      const points = path as ZhudaVec3[];
      const count = points.length;
      for (let i = 0; i < count; i++) {
        const closed = o.closed === true;
        if (!closed && (i === 0 || i === count - 1)) continue;
        const before = normalize(sub(points[i], points[(i + count - 1) % count])),
          after = normalize(sub(points[(i + 1) % count], points[i]));
        if (dot(before, after) < -0.87)
          issues.push(`path[${i}]: the path turns back on itself here`);
      }
    }
  }
  if (o.closed !== undefined && typeof o.closed !== 'boolean') issues.push('closed: true or false');
  if (o.caps !== undefined && typeof o.caps !== 'boolean') issues.push('caps: true or false');
  return issues;
}

/**
 * A cross-section carried along a path: kerbs and gutters round a bend,
 * rails, cornices, cables, walls that follow a street. The section stays
 * upright (its up is the world's, as far as the path allows) and keeps its
 * width through a corner. Each edge of the section is a flat band with its
 * own normal; the corners of the path are not rounded.
 */
export function createZhudaSweepMesh(options: ZhudaSweepOptions): MeshData {
  const issues = validateZhudaSweep(options);
  if (issues.length) throw Error('Invalid sweep: ' + issues.join('; '));
  const profile = options.profile.map(([a, b]) => [a, b] as [number, number]);
  // Counter-clockwise seen along the path: the outside is then to the right of each edge.
  if (area2(profile) < 0) profile.reverse();
  const path = options.path.map((p) => [p[0], p[1], p[2]] as ZhudaVec3),
    closed = options.closed ?? false,
    caps = (options.caps ?? true) && !closed,
    count = path.length;
  const direction = (i: number) => normalize(sub(path[(i + 1) % count], path[i]));
  // At each point: the way the path runs there, the section's across and up
  // axes, and how much wider the section is drawn to keep its width through
  // the corner.
  const frames: { tangent: ZhudaVec3; across: ZhudaVec3; up: ZhudaVec3; wide: number }[] = [];
  let carried: ZhudaVec3 | undefined;
  for (let i = 0; i < count; i++) {
    const before = closed || i > 0 ? direction((i + count - 1) % count) : undefined,
      after = closed || i < count - 1 ? direction(i) : undefined;
    const tangent = normalize(
      before && after
        ? [before[0] + after[0], before[1] + after[1], before[2] + after[2]]
        : (after ?? before)!,
    );
    // Across is level and to the left of the way the path runs; where the
    // path runs straight up or down, the across of the point before is kept.
    let across: ZhudaVec3;
    if (Math.abs(tangent[1]) < 0.999) across = normalize(cross([0, 1, 0], tangent));
    else {
      const from: ZhudaVec3 = carried ?? [1, 0, 0],
        k = dot(from, tangent);
      across = normalize([
        from[0] - tangent[0] * k,
        from[1] - tangent[1] * k,
        from[2] - tangent[2] * k,
      ]);
    }
    carried = across;
    const up = cross(tangent, across);
    const half = before && after ? Math.max(dot(before, tangent), 0.25) : 1;
    frames.push({ tangent, across, up, wide: 1 / half });
  }
  const at = (i: number, [a, b]: readonly [number, number]): ZhudaVec3 => {
    const f = frames[i],
      p = path[i];
    return [
      p[0] + f.across[0] * a * f.wide + f.up[0] * b,
      p[1] + f.across[1] * a * f.wide + f.up[1] * b,
      p[2] + f.across[2] * a * f.wide + f.up[2] * b,
    ];
  };
  const writer = new MeshWriter();
  const travelled: number[] = [0];
  for (let i = 1; i <= count; i++)
    travelled.push(travelled[i - 1] + Math.hypot(...sub(path[i % count], path[i - 1])));
  let round = 0;
  for (let e = 0; e < profile.length; e++) {
    const p0 = profile[e],
      p1 = profile[(e + 1) % profile.length],
      length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]),
      // Outward in the section's own plane.
      n2: [number, number] = [(p1[1] - p0[1]) / length, -(p1[0] - p0[0]) / length];
    const normalAt = (i: number): ZhudaVec3 => {
      const f = frames[i];
      return normalize([
        f.across[0] * n2[0] + f.up[0] * n2[1],
        f.across[1] * n2[0] + f.up[1] * n2[1],
        f.across[2] * n2[0] + f.up[2] * n2[1],
      ]);
    };
    const rows: [number, number][] = [];
    const steps = closed ? count + 1 : count;
    for (let k = 0; k < steps; k++) {
      const i = k % count,
        n = normalAt(i);
      rows.push([
        writer.vertex(at(i, p0), n, round, travelled[k]),
        writer.vertex(at(i, p1), n, round + length, travelled[k]),
      ]);
    }
    for (let k = 0; k < rows.length - 1; k++) {
      const outward = normalAt(k % count);
      writer.triangle(rows[k][0], rows[k][1], rows[k + 1][1], outward);
      writer.triangle(rows[k][0], rows[k + 1][1], rows[k + 1][0], outward);
    }
    round += length;
  }
  if (caps) {
    const triangles = fillRegion(profile, [[0, profile.length]], 'Invalid sweep');
    for (const end of [0, count - 1]) {
      const t = frames[end].tangent,
        outward: ZhudaVec3 = end === 0 ? [-t[0], -t[1], -t[2]] : t;
      const corner = profile.map((p) => writer.vertex(at(end, p), outward, p[0], p[1]));
      for (const [a, b, c] of triangles) writer.triangle(corner[a], corner[b], corner[c], outward);
    }
  }
  return writer.finish();
}

export type ZhudaCurveKind = 'centripetal' | 'chordal' | 'uniform';

export interface ZhudaCurveOptions {
  /** Points the curve passes through: 2..256 [x, y, z] in metres (3 or more when closed). */
  points: readonly (readonly [number, number, number])[];
  /** The curve runs on from the last point back round to the first (default false). */
  closed?: boolean;
  /**
   * How a Catmull-Rom curve spaces its points (default 'centripetal': no
   * loops or cusps where points bunch up; 'chordal' bends wider; 'uniform' is
   * the classic curve).
   */
  kind?: ZhudaCurveKind;
}

export function validateZhudaCurve(options: ZhudaCurveOptions): string[] {
  const o = options ?? ({} as ZhudaCurveOptions);
  const issues: string[] = [];
  const closed = o.closed === true,
    points = o.points as unknown,
    least = closed ? 3 : 2;
  if (o.closed !== undefined && typeof o.closed !== 'boolean') issues.push('closed: true or false');
  if (o.kind !== undefined && !['centripetal', 'chordal', 'uniform'].includes(o.kind))
    issues.push('kind: use centripetal, chordal or uniform');
  if (!Array.isArray(points) || points.length < least || points.length > 256)
    issues.push(`points: use ${least}..256 [x, y, z] points`);
  else
    points.forEach((point, i) => {
      if (
        !Array.isArray(point) ||
        point.length !== 3 ||
        !point.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100000)
      )
        issues.push(`points[${i}]: use [x, y, z] in metres`);
      else {
        const before = i > 0 ? points[i - 1] : closed ? points[points.length - 1] : undefined;
        if (
          Array.isArray(before) &&
          before.length === 3 &&
          before.every((n: unknown, k: number) => n === point[k])
        )
          issues.push(
            i > 0
              ? `points[${i}]: the same point as the one before it`
              : 'points: a closed curve does not repeat its first point at the end',
          );
      }
    });
  return issues;
}

/** Steps per curve segment in the table that measures length along it. */
const CURVE_TABLE_STEPS = 64;

/**
 * A Catmull-Rom curve measured by length: `at(s)` is the point `s` metres
 * along it and the way it runs there.
 */
function curveByLength(options: ZhudaCurveOptions) {
  const points = options.points.map((p) => [p[0], p[1], p[2]] as ZhudaVec3),
    closed = options.closed ?? false,
    kind = options.kind ?? 'centripetal',
    count = points.length,
    segments = closed ? count : count - 1,
    power = kind === 'centripetal' ? 0.25 : kind === 'chordal' ? 0.5 : 0;
  // Before the first point and after the last of an open curve, the line
  // carries straight on.
  const point = (i: number): ZhudaVec3 => {
    if (closed) return points[((i % count) + count) % count];
    if (i < 0) return points[0].map((v, k) => 2 * v - points[1][k]) as ZhudaVec3;
    if (i >= count)
      return points[count - 1].map((v, k) => 2 * v - points[count - 2][k]) as ZhudaVec3;
    return points[i];
  };
  // Each segment as a cubic c0 + c1 t + c2 t² + c3 t³, from the
  // non-uniform Catmull-Rom tangents at its two ends.
  const cubic = Array.from({ length: segments }, (_, s) => {
    const p0 = point(s - 1),
      p1 = point(s),
      p2 = point(s + 1),
      p3 = point(s + 2);
    let d0 = Math.pow(Math.hypot(...sub(p1, p0)) ** 2, power),
      d1 = Math.pow(Math.hypot(...sub(p2, p1)) ** 2, power),
      d2 = Math.pow(Math.hypot(...sub(p3, p2)) ** 2, power);
    if (d1 < 1e-4) d1 = 1;
    if (d0 < 1e-4) d0 = d1;
    if (d2 < 1e-4) d2 = d1;
    return [0, 1, 2].map((k) => {
      const t1 =
          power === 0
            ? (p2[k] - p0[k]) / 2
            : ((p1[k] - p0[k]) / d0 - (p2[k] - p0[k]) / (d0 + d1) + (p2[k] - p1[k]) / d1) * d1,
        t2 =
          power === 0
            ? (p3[k] - p1[k]) / 2
            : ((p2[k] - p1[k]) / d1 - (p3[k] - p1[k]) / (d1 + d2) + (p3[k] - p2[k]) / d2) * d1;
      return [p1[k], t1, -3 * p1[k] + 3 * p2[k] - 2 * t1 - t2, 2 * p1[k] - 2 * p2[k] + t1 + t2];
    });
  });
  const evaluate = (u: number) => {
    const s = Math.min(Math.floor(u), segments - 1),
      t = u - s,
      c = cubic[s];
    return {
      point: c.map((q) => q[0] + t * (q[1] + t * (q[2] + t * q[3]))) as ZhudaVec3,
      slope: c.map((q) => q[1] + t * (2 * q[2] + 3 * t * q[3])) as ZhudaVec3,
    };
  };
  const steps = segments * CURVE_TABLE_STEPS,
    lengths = new Float64Array(steps + 1);
  let previous = evaluate(0).point;
  for (let i = 1; i <= steps; i++) {
    const next = evaluate(i / CURVE_TABLE_STEPS).point;
    lengths[i] = lengths[i - 1] + Math.hypot(...sub(next, previous));
    previous = next;
  }
  const length = lengths[steps];
  if (!(length > 1e-9)) throw Error('Degenerate curve: it has no length');
  const at = (s: number) => {
    const target = Math.max(0, Math.min(length, s));
    let lo = 0,
      hi = steps;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] <= target) lo = mid;
      else hi = mid;
    }
    const span = lengths[hi] - lengths[lo],
      u = (lo + (span > 0 ? (target - lengths[lo]) / span : 0)) / CURVE_TABLE_STEPS,
      here = evaluate(u);
    let tangent = here.slope;
    // A cusp has no slope: take the way the curve runs either side of it.
    if (!(Math.hypot(...tangent) > 1e-9))
      tangent = sub(
        evaluate(Math.min(segments, u + 1e-4)).point,
        evaluate(Math.max(0, u - 1e-4)).point,
      );
    return { point: here.point, tangent: normalize(tangent) };
  };
  return { length, at };
}

/**
 * `count` points (2..4096) along a Catmull-Rom curve, the same distance
 * apart. An open curve starts and ends on its first and last points; a
 * closed one does not repeat its start. Feed them to `createZhudaSweepMesh`
 * (with `closed` for a closed curve) or `createZhudaTubeMesh`.
 */
export function sampleZhudaCurve(options: ZhudaCurveOptions, count: number): ZhudaVec3[] {
  const issues = validateZhudaCurve(options);
  if (!(Number.isInteger(count) && count >= 2 && count <= 4096))
    issues.push('count: use a whole number 2..4096');
  if (issues.length) throw Error('Invalid curve: ' + issues.join('; '));
  const curve = curveByLength(options),
    closed = options.closed ?? false;
  return Array.from(
    { length: count },
    (_, i) => curve.at((curve.length * i) / (closed ? count : count - 1)).point,
  );
}

/** What `sampleZhudaCurvePath` reads of a LayaAir `CurvePath`: a point a share 0..1 of the way along. */
export interface ZhudaCurvePathLike {
  getPointAt(t: number): { readonly x: number; readonly y: number; readonly z: number };
}

/**
 * `count` points (2..4096) along a LayaAir `CurvePath` (Catmull-Rom or
 * Bezier; it measures by length), for `createZhudaTubeMesh` or
 * `createZhudaSweepMesh`. With `closed`, the last point is not repeated, as
 * a closed sweep wants. A point the same as the one before is left out.
 */
export function sampleZhudaCurvePath(
  path: ZhudaCurvePathLike,
  count: number,
  options: { closed?: boolean } = {},
): ZhudaVec3[] {
  if (!path || typeof path.getPointAt !== 'function')
    throw Error('Invalid curve path: it needs getPointAt(t)');
  if (!(Number.isInteger(count) && count >= 2 && count <= 4096))
    throw Error('Invalid curve path: count must be a whole number 2..4096');
  const closed = options.closed === true,
    out: ZhudaVec3[] = [];
  for (let i = 0; i < count; i++) {
    // LayaAir hands back one shared vector: copy it at once.
    const p = path.getPointAt(i / (closed ? count : count - 1)),
      point: ZhudaVec3 = [p?.x, p?.y, p?.z];
    if (!point.every(Number.isFinite)) throw Error(`Invalid curve path: point ${i} is not finite`);
    const last = out[out.length - 1];
    if (!last || last.some((v, k) => v !== point[k])) out.push(point);
  }
  if (closed && out.length > 1 && out[0].every((v, k) => v === out[out.length - 1][k])) out.pop();
  if (out.length < 2) throw Error('Invalid curve path: it has no length');
  return out;
}

export interface ZhudaCurveTubeOptions extends ZhudaCurveOptions {
  radius: number;
  /** Rings along the curve, 2..2048 (default 64), the same distance apart. */
  tubularSegments?: number;
  /** Sides around the tube, 3..64 (default 12). */
  radialSegments?: number;
  /** Close the two ends of an open curve with flat caps (default true). */
  caps?: boolean;
}

export function validateZhudaCurveTube(options: ZhudaCurveTubeOptions): string[] {
  const o = options ?? ({} as ZhudaCurveTubeOptions);
  const issues = validateZhudaCurve(o);
  if (!(typeof o.radius === 'number' && o.radius > 0 && o.radius <= 100))
    issues.push('radius: use a positive number of metres, up to 100');
  const along = o.tubularSegments ?? 64,
    around = o.radialSegments ?? 12;
  if (!(Number.isInteger(along) && along >= 2 && along <= 2048))
    issues.push('tubularSegments: use a whole number 2..2048');
  if (!(Number.isInteger(around) && around >= 3 && around <= 64))
    issues.push('radialSegments: use a whole number 3..64');
  if (o.caps !== undefined && typeof o.caps !== 'boolean') issues.push('caps: true or false');
  const vertices = (along + 1) * (around + 1) + (o.closed ? 0 : 2 * (around + 2));
  if (Number.isFinite(vertices) && vertices > 65535)
    issues.push(`tubularSegments: ${vertices} vertices is more than one mesh holds (65535)`);
  return issues;
}

/**
 * A round tube along a Catmull-Rom curve through the given points: pipes,
 * cables, handles, a loop of hose. Its rings are spaced evenly along the
 * curve and turn with it as little as possible (rotation-minimising frames);
 * a closed tube's seam is twisted into place over its whole length. A radius
 * wider than the tightest bend folds the tube into itself; that is not
 * checked.
 */
export function createZhudaCurveTubeMesh(options: ZhudaCurveTubeOptions): MeshData {
  const issues = validateZhudaCurveTube(options);
  if (issues.length) throw Error('Invalid curve tube: ' + issues.join('; '));
  const radius = options.radius,
    along = options.tubularSegments ?? 64,
    around = options.radialSegments ?? 12,
    closed = options.closed ?? false,
    caps = (options.caps ?? true) && !closed,
    curve = curveByLength(options);
  const stations = Array.from({ length: along + 1 }, (_, i) => {
    const s = (curve.length * i) / along;
    return { s, ...curve.at(s) };
  });
  // Rotation-minimising frames by double reflection (Wang et al. 2008).
  const first = stations[0].tangent;
  let side = normalize(cross(Math.abs(first[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], first));
  const sides: ZhudaVec3[] = [side];
  for (let i = 1; i <= along; i++) {
    const before = stations[i - 1],
      here = stations[i],
      v1 = sub(here.point, before.point),
      c1 = dot(v1, v1);
    if (c1 > 1e-18) {
      const reflect = (a: ZhudaVec3, v: ZhudaVec3, c: number): ZhudaVec3 => {
        const k = (2 / c) * dot(v, a);
        return [a[0] - k * v[0], a[1] - k * v[1], a[2] - k * v[2]];
      };
      const sideL = reflect(side, v1, c1),
        tangentL = reflect(before.tangent, v1, c1),
        v2 = sub(here.tangent, tangentL),
        c2 = dot(v2, v2);
      side = c2 > 1e-18 ? reflect(sideL, v2, c2) : sideL;
    }
    const k = dot(side, here.tangent);
    side = normalize([
      side[0] - here.tangent[0] * k,
      side[1] - here.tangent[1] * k,
      side[2] - here.tangent[2] * k,
    ]);
    sides.push(side);
  }
  if (closed) {
    // Turn every ring a share of the twist left at the seam.
    const t = stations[0].tangent,
      last = sides[along],
      twist = Math.atan2(dot(cross(last, sides[0]), t), dot(last, sides[0]));
    for (let i = 1; i <= along; i++) {
      const angle = (twist * stations[i].s) / curve.length,
        ti = stations[i].tangent,
        other = cross(ti, sides[i]);
      sides[i] = normalize([
        sides[i][0] * Math.cos(angle) + other[0] * Math.sin(angle),
        sides[i][1] * Math.cos(angle) + other[1] * Math.sin(angle),
        sides[i][2] * Math.cos(angle) + other[2] * Math.sin(angle),
      ]);
    }
  }
  const writer = new MeshWriter();
  const rings: number[][] = [];
  for (let i = 0; i <= along; i++) {
    const ring: number[] = [];
    // A closed tube's last ring lies exactly on its first (a seam for the UVs only).
    const station = closed && i === along ? stations[0] : stations[i],
      r = closed && i === along ? sides[0] : sides[i],
      b = cross(station.tangent, r);
    for (let j = 0; j <= around; j++) {
      const angle = (j / around) * Math.PI * 2,
        n: ZhudaVec3 = [
          r[0] * Math.cos(angle) + b[0] * Math.sin(angle),
          r[1] * Math.cos(angle) + b[1] * Math.sin(angle),
          r[2] * Math.cos(angle) + b[2] * Math.sin(angle),
        ];
      ring.push(
        writer.vertex(
          [
            station.point[0] + n[0] * radius,
            station.point[1] + n[1] * radius,
            station.point[2] + n[2] * radius,
          ],
          n,
          angle * radius,
          stations[i].s,
        ),
      );
    }
    rings.push(ring);
  }
  for (let i = 0; i < along; i++)
    for (let j = 0; j < around; j++) {
      const angle = ((j + 0.5) / around) * Math.PI * 2,
        r = sides[i],
        b = cross(stations[i].tangent, r),
        outward: ZhudaVec3 = [
          r[0] * Math.cos(angle) + b[0] * Math.sin(angle),
          r[1] * Math.cos(angle) + b[1] * Math.sin(angle),
          r[2] * Math.cos(angle) + b[2] * Math.sin(angle),
        ];
      writer.triangle(rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], outward);
      writer.triangle(rings[i][j], rings[i + 1][j + 1], rings[i + 1][j], outward);
    }
  if (caps)
    for (const end of [0, along]) {
      const t = stations[end].tangent,
        outward: ZhudaVec3 = end === 0 ? [-t[0], -t[1], -t[2]] : t,
        centre = writer.vertex(stations[end].point, outward, 0, 0),
        rim: number[] = [];
      for (let j = 0; j <= around; j++) {
        const angle = (j / around) * Math.PI * 2;
        rim.push(
          writer.vertex(
            writer.point(rings[end][j]),
            outward,
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
          ),
        );
      }
      for (let j = 0; j < around; j++) writer.triangle(centre, rim[j], rim[j + 1], outward);
    }
  return writer.finish();
}

export interface ZhudaTorusOptions {
  /** From the middle of the hole to the middle of the tube, in metres. */
  radius: number;
  /** The tube's own radius: less than `radius`. */
  tube: number;
  /** Sides around the tube, 3..64 (default 16). */
  radialSegments?: number;
  /** Steps around the hole, 3..256 (default 48). */
  tubularSegments?: number;
}

export function validateZhudaTorus(options: ZhudaTorusOptions): string[] {
  const o = options ?? ({} as ZhudaTorusOptions);
  const issues: string[] = [];
  const radiusOk = typeof o.radius === 'number' && o.radius > 0 && o.radius <= 1000;
  if (!radiusOk) issues.push('radius: use a positive number of metres');
  if (!(typeof o.tube === 'number' && o.tube > 0))
    issues.push('tube: use a positive number of metres');
  else if (radiusOk && o.tube >= o.radius)
    issues.push('tube: it must be less than radius, or the ring closes up its hole');
  const around = o.radialSegments ?? 16,
    along = o.tubularSegments ?? 48;
  if (!(Number.isInteger(around) && around >= 3 && around <= 64))
    issues.push('radialSegments: use a whole number 3..64');
  if (!(Number.isInteger(along) && along >= 3 && along <= 256))
    issues.push('tubularSegments: use a whole number 3..256');
  return issues;
}

/** A ring-shaped tube lying flat about +Y, centred on the origin: rings, tyres, handles, haloes. */
export function createZhudaTorusMesh(options: ZhudaTorusOptions): MeshData {
  const issues = validateZhudaTorus(options);
  if (issues.length) throw Error('Invalid torus: ' + issues.join('; '));
  const { radius, tube } = options,
    around = options.radialSegments ?? 16,
    along = options.tubularSegments ?? 48,
    writer = new MeshWriter(),
    grid: number[][] = [];
  const normal = (theta: number, phi: number): ZhudaVec3 => [
    Math.cos(phi) * Math.cos(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(theta),
  ];
  for (let i = 0; i <= along; i++) {
    const theta = (i / along) * Math.PI * 2,
      row: number[] = [];
    for (let j = 0; j <= around; j++) {
      const phi = (j / around) * Math.PI * 2,
        n = normal(theta, phi);
      row.push(
        writer.vertex(
          [
            radius * Math.cos(theta) + tube * n[0],
            tube * n[1],
            radius * Math.sin(theta) + tube * n[2],
          ],
          n,
          theta * radius,
          phi * tube,
        ),
      );
    }
    grid.push(row);
  }
  for (let i = 0; i < along; i++)
    for (let j = 0; j < around; j++) {
      const outward = normal(((i + 0.5) / along) * Math.PI * 2, ((j + 0.5) / around) * Math.PI * 2);
      writer.triangle(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], outward);
      writer.triangle(grid[i][j], grid[i + 1][j + 1], grid[i + 1][j], outward);
    }
  return writer.finish();
}

export interface ZhudaRingOptions {
  outerRadius: number;
  /** The hole's radius; 0 (default) gives a disc. */
  innerRadius?: number;
  /** Steps around, 3..256 (default 48). */
  segments?: number;
  /**
   * Omitted: a flat ring at y = 0 facing +Y, seen from above only (a marker
   * on the ground). Given: a solid washer this many metres thick, from y = 0 up.
   */
  thickness?: number;
}

export function validateZhudaRing(options: ZhudaRingOptions): string[] {
  const o = options ?? ({} as ZhudaRingOptions);
  const issues: string[] = [];
  const outerOk = typeof o.outerRadius === 'number' && o.outerRadius > 0 && o.outerRadius <= 1000;
  if (!outerOk) issues.push('outerRadius: use a positive number of metres');
  const inner = o.innerRadius ?? 0;
  if (!(typeof inner === 'number' && inner >= 0)) issues.push('innerRadius: use 0 or more metres');
  else if (outerOk && inner >= o.outerRadius)
    issues.push('innerRadius: it must be less than outerRadius');
  const segments = o.segments ?? 48;
  if (!(Number.isInteger(segments) && segments >= 3 && segments <= 256))
    issues.push('segments: use a whole number 3..256');
  if (
    o.thickness !== undefined &&
    !(typeof o.thickness === 'number' && o.thickness > 0 && o.thickness <= 1000)
  )
    issues.push('thickness: use a positive number of metres');
  return issues;
}

/** A flat ring or disc, or with `thickness` a washer or coin, about +Y on the origin. */
export function createZhudaRingMesh(options: ZhudaRingOptions): MeshData {
  const issues = validateZhudaRing(options);
  if (issues.length) throw Error('Invalid ring: ' + issues.join('; '));
  const outer = options.outerRadius,
    inner = options.innerRadius ?? 0,
    segments = options.segments ?? 48,
    writer = new MeshWriter();
  const angleOf = (j: number) => (j / segments) * Math.PI * 2;
  const face = (y: number, up: 1 | -1) => {
    const outward: ZhudaVec3 = [0, up, 0];
    const circle = (r: number) =>
      Array.from({ length: segments + 1 }, (_, j) => {
        const x = r * Math.cos(angleOf(j)),
          z = r * Math.sin(angleOf(j));
        return writer.vertex([x, y, z], outward, x, z);
      });
    const rim = circle(outer);
    if (inner > 0) {
      const hole = circle(inner);
      for (let j = 0; j < segments; j++) {
        writer.triangle(hole[j], rim[j], rim[j + 1], outward);
        writer.triangle(hole[j], rim[j + 1], hole[j + 1], outward);
      }
    } else {
      const centre = writer.vertex([0, y, 0], outward, 0, 0);
      for (let j = 0; j < segments; j++) writer.triangle(centre, rim[j], rim[j + 1], outward);
    }
  };
  const wall = (r: number, height: number, facing: 1 | -1) => {
    const column = (j: number, y: number) => {
      const a = angleOf(j),
        n: ZhudaVec3 = [facing * Math.cos(a), 0, facing * Math.sin(a)];
      return writer.vertex([r * Math.cos(a), y, r * Math.sin(a)], n, a * r, y);
    };
    const bottom = Array.from({ length: segments + 1 }, (_, j) => column(j, 0)),
      top = Array.from({ length: segments + 1 }, (_, j) => column(j, height));
    for (let j = 0; j < segments; j++) {
      const a = angleOf(j + 0.5),
        outward: ZhudaVec3 = [facing * Math.cos(a), 0, facing * Math.sin(a)];
      writer.triangle(bottom[j], bottom[j + 1], top[j + 1], outward);
      writer.triangle(bottom[j], top[j + 1], top[j], outward);
    }
  };
  if (options.thickness === undefined) face(0, 1);
  else {
    face(options.thickness, 1);
    face(0, -1);
    wall(outer, options.thickness, 1);
    if (inner > 0) wall(inner, options.thickness, -1);
  }
  return writer.finish();
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
  const rotate = (
    source: Float32Array,
    i: number,
    k: number,
    target: Float32Array,
    add: number[],
  ) => {
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
