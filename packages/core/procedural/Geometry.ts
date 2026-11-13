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
}

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

export function validateZhudaExtrude(options: ZhudaExtrudeOptions): string[] {
  const issues: string[] = [];
  const o = options ?? ({} as ZhudaExtrudeOptions);
  const outline = o.outline as unknown;
  let sound = false;
  if (!Array.isArray(outline) || outline.length < 3 || outline.length > 256)
    issues.push('outline: use 3..256 [x, z] pairs');
  else {
    sound = true;
    outline.forEach((point, i) => {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !point.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000)
      ) {
        issues.push(`outline[${i}]: use [x, z] in metres`);
        sound = false;
      } else {
        const before = outline[(i + outline.length - 1) % outline.length];
        if (Array.isArray(before) && before[0] === point[0] && before[1] === point[1]) {
          issues.push(`outline[${i}]: the same point as the one before it`);
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
          issues.push(`outline: edge ${i} crosses edge ${j}`);
          crossing = true;
          break search;
        }
      }
    if (!crossing && Math.abs(area2(points)) < 1e-9) issues.push('outline: it encloses no area');
  }
  if (!(typeof o.height === 'number' && o.height > 0 && o.height <= 1000))
    issues.push('height: use a positive number of metres');
  if (o.caps !== undefined && typeof o.caps !== 'boolean') issues.push('caps: true or false');
  return issues;
}

/** A flat outline raised to a height: kerbs, steps, signs, wall pieces, L and U profiles. */
export function createZhudaExtrudeMesh(options: ZhudaExtrudeOptions): MeshData {
  const issues = validateZhudaExtrude(options);
  if (issues.length) throw Error('Invalid extrusion: ' + issues.join('; '));
  // Counter-clockwise in (x, z): the outside is then to the right of each edge.
  const points = options.outline.map(([x, z]) => [x, z] as [number, number]);
  if (area2(points) < 0) points.reverse();
  const height = options.height,
    caps = options.caps ?? true,
    writer = new MeshWriter();
  let along = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, z0] = points[i],
      [x1, z1] = points[(i + 1) % points.length],
      length = Math.hypot(x1 - x0, z1 - z0),
      normal: ZhudaVec3 = [(z1 - z0) / length, 0, -(x1 - x0) / length];
    writer.quad(
      [
        [x0, 0, z0],
        [x1, 0, z1],
        [x1, height, z1],
        [x0, height, z0],
      ],
      normal,
      [along, 0, along + length, 0, along + length, height, along, height],
    );
    along += length;
  }
  if (caps) {
    const triangles = fillOutline(points, 'Invalid extrusion');
    for (const [y, up] of [
      [height, 1],
      [0, -1],
    ] as const) {
      const outward: ZhudaVec3 = [0, up, 0];
      const corner = points.map(([x, z]) => writer.vertex([x, y, z], outward, x, z));
      for (const [a, b, c] of triangles) writer.triangle(corner[a], corner[b], corner[c], outward);
    }
  }
  return writer.finish();
}

/**
 * Triangles that fill a counter-clockwise outline that does not cross itself,
 * as indices into it. Ear clipping: cut off a corner that bulges outward and
 * holds no other point.
 */
function fillOutline(
  points: readonly (readonly [number, number])[],
  what: string,
): [number, number, number][] {
  const left = points.map((_, i) => i),
    triangles: [number, number, number][] = [];
  const turn = (a: number, b: number, c: number) =>
    (points[b][0] - points[a][0]) * (points[c][1] - points[a][1]) -
    (points[b][1] - points[a][1]) * (points[c][0] - points[a][0]);
  let guard = points.length * points.length;
  while (left.length > 3 && guard-- > 0) {
    let cut = false;
    for (let i = 0; i < left.length; i++) {
      const a = left[(i + left.length - 1) % left.length],
        b = left[i],
        c = left[(i + 1) % left.length];
      if (turn(a, b, c) <= 1e-12) continue;
      if (
        left.some(
          (p) =>
            p !== a &&
            p !== b &&
            p !== c &&
            turn(a, b, p) >= 0 &&
            turn(b, c, p) >= 0 &&
            turn(c, a, p) >= 0,
        )
      )
        continue;
      triangles.push([a, b, c]);
      left.splice(i, 1);
      cut = true;
      break;
    }
    if (!cut) throw Error(`${what}: the outline could not be filled`);
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
    const triangles = fillOutline(profile, 'Invalid sweep');
    for (const end of [0, count - 1]) {
      const t = frames[end].tangent,
        outward: ZhudaVec3 = end === 0 ? [-t[0], -t[1], -t[2]] : t;
      const corner = profile.map((p) => writer.vertex(at(end, p), outward, p[0], p[1]));
      for (const [a, b, c] of triangles) writer.triangle(corner[a], corner[b], corner[c], outward);
    }
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
