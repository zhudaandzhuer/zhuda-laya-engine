// A garment as the body's own surface moved outwards: the surface at `thickness` from the body,
// kept inside a zone (a slab for the trunk, capsules round the limbs, planes where cuffs and hems
// are cut), plus loose volumes (the bell of a skirt) and shapes of its own (a hat). The cloth ends
// in a face that reaches the skin (a cuff has thickness; nobody sees inside a sleeve or up a
// skirt), so a garment and the body in it make one closed solid.
//
// Cloth at `thickness` takes the weights of the point of the body under it, so it moves exactly as
// the skin does; loose cloth takes the weights the body would have at the cloth's own place (the
// half of a skirt before a thigh follows that thigh). Neither needs joints of its own: a garment
// follows any animation of the body's skeleton. Loose cloth has both sides (two triangles for one).
//
//   const { glb, stats, ends } = await buildGarment(figure, { id, thickness, zone, volume, extra, paint, budget });
//   stats.tight: how many leading triangles are cloth on the body (the rest are loose or the
//   garment's own shapes).  ends: a bit per triangle, set on the faces cuffs and hems end in.
//   const under = coverOf(figure, item);   under(p) -> whether a place at rest is hidden under the garment
//
// figure: { joints, body (shapes), skin } as the body was built from.
// zone:   (p) => number, negative inside the garment (see `zone` below); omit for an object made
//         only of `extra` shapes.
// volume: (p) => number, negative inside loose cloth (see `volume` below), already cut to length.
// follow: joints loose cloth may follow (default all); looseSoft: how softly (metres, 0.035).
// extra:  shapes of the garment's own (kit shapes on joints); `rigid` ones follow their one joint.
// paint:  (p, n, info) => display rgb, info = { part: 'cloth' | 'loose' | 'extra', shape, edge, end }
//         `end` is 'loose' or 'cloth' for a vertex that only the face closing a hem or a cuff uses.
//         `edge` is how far the point is from the zone's (or the volume's) boundary in space. That is
//         not how far it is from the garment's rim: a zone's boundary also runs close to the cloth
//         where it merely encloses a limb. Do not shade by it (it darkened the seat of trousers).
//         where edge is how far inside the zone's boundary the point is (0 at a cuff or hem), metres.
import { createZhudaIsosurfaceMesh } from 'zhuda-laya-engine';
import { MeshoptSimplifier } from 'meshoptimizer';
import { fastField } from './fast-field.mjs';
import { withoutScraps } from './islands.mjs';
import { skinner, toLinear } from './kit.mjs';
import { writeRiggedGlb } from './rig-glb.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function segment(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const t = Math.max(0, Math.min(1, dot(ap, ab) / (dot(ab, ab) || 1)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}
/** Zones: each is (p) => metres, negative inside. */
export const zone = {
  /** Between two heights, and no further than `xMax` from the middle. */
  slab: ({ yMin = -Infinity, yMax = Infinity, xMax = Infinity }) => (p) => Math.max(yMin - p[1], p[1] - yMax, Math.abs(p[0]) - xMax),
  /** Within `r` of the segment a-b. */
  capsule: ({ a, b, r }) => (p) => segment(p, a, b) - r,
  /** Not within `r` of the segment a-b (a neck hole, an arm hole). */
  outside: ({ a, b, r }) => (p) => r - segment(p, a, b),
  /** On the near side of a plane through `at`: a cuff or a hem cut square across `dir`. */
  before: ({ at, dir }) => (p) => dot(sub(p, at), dir),
  all: (...zones) => (p) => Math.max(...zones.map((z) => z(p))),
  any: (...zones) => (p) => Math.min(...zones.map((z) => z(p))),
  /** A zone and its mirror image across the body's middle. */
  both: (z) => (p) => Math.min(z(p), z([-p[0], p[1], p[2]])),
};

/** Loose volumes: each is (p) => metres (about), negative inside. */
export const volume = {
  /**
   * A bell hanging from `top` down to `hem` (heights): an ellipse at each height. `a` (half the
   * width, x), `b` (half the depth, z) and `z` (its middle) are each a number or a profile
   * [[height, value], ...] from the top down, eased between its points. `power` above 2 squares the
   * oval: a trunk is flatter in front and behind than an ellipse.
   */
  bell: ({ top, hem, a, b, z = 0, power = 2 }) => {
    const profile = (v) => {
      if (typeof v === 'number') return () => v;
      const pts = [...v].sort((p, q) => q[0] - p[0]);
      return (y) => {
        if (y >= pts[0][0]) return pts[0][1];
        for (let i = 1; i < pts.length; i++)
          if (y >= pts[i][0]) {
            const k = (pts[i - 1][0] - y) / (pts[i - 1][0] - pts[i][0]);
            return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * (k * k * (3 - 2 * k) * 0.5 + k * 0.5);
          }
        return pts[pts.length - 1][1];
      };
    };
    const A = profile(a), B = profile(b), Zc = profile(z);
    const f = (p) => {
      const ax = A(p[1]), bz = B(p[1]);
      const r = (Math.abs(p[0] / ax) ** power + Math.abs((p[2] - Zc(p[1])) / bz) ** power) ** (1 / power);
      return Math.max((r - 1) * Math.min(ax, bz), p[1] - top, hem - p[1]);
    };
    /** Whether a face of the bell (its middle, its normal) is one it is cut by, its hem or its top, and not its cloth. */
    f.isEnd = (m, n) => Math.min(Math.abs(m[1] - hem), Math.abs(m[1] - top)) < 0.008 && Math.abs(n[1]) > 0.7;
    const most = (v) => (typeof v === 'number' ? v : Math.max(...v.map((q) => q[1]))), least = (v) => (typeof v === 'number' ? v : Math.min(...v.map((q) => q[1])));
    f.bounds = { min: [-most(a), hem, least(z) - most(b)], max: [most(a), top, most(z) + most(b)] };
    // It hangs round the body and must hold it (see standsOut).
    f.holds = true;
    return f;
  },
  /**
   * A straight round tube from `a` to `b` (a trouser leg below the knee, a wide cuff): `ra` wide at
   * `a`, `rb` at `b`, cut square at both. A real trouser leg is one: it does not narrow to the ankle.
   */
  tube: ({ a, b, ra, rb }) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L, (b[2] - a[2]) / L];
    const along = (p) => (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1] + (p[2] - a[2]) * u[2];
    const f = (p) => {
      const t = along(p), k = Math.max(0, Math.min(1, t / L));
      const radial = Math.hypot(p[0] - a[0] - u[0] * t, p[1] - a[1] - u[1] * t, p[2] - a[2] - u[2] * t);
      return Math.max(radial - (ra + (rb - ra) * k), -t, t - L);
    };
    f.isEnd = (m, n) => Math.min(Math.abs(along(m)), Math.abs(along(m) - L)) < 0.008 && Math.abs(n[0] * u[0] + n[1] * u[1] + n[2] * u[2]) > 0.7;
    // Cut square: it reaches past its ends only as far as it leans.
    const lean = u.map((v) => Math.sqrt(Math.max(0, 1 - v * v)));
    f.bounds = { min: a.map((v, k) => Math.min(v - ra * lean[k], b[k] - rb * lean[k])), max: a.map((v, k) => Math.max(v + ra * lean[k], b[k] + rb * lean[k])) };
    f.holds = true;
    return f;
  },
  /** A rounded lump (a pouch, a pocket, a puffed shoulder): an ellipsoid at `center` with `radii`. */
  blob: ({ center, radii }) => {
    const least = Math.min(...radii);
    const f = (p) => (Math.hypot((p[0] - center[0]) / radii[0], (p[1] - center[1]) / radii[1], (p[2] - center[2]) / radii[2]) - 1) * least;
    f.bounds = { min: center.map((c, k) => c - radii[k]), max: center.map((c, k) => c + radii[k]) };
    return f;
  },
  any: (...volumes) => {
    const f = (p) => Math.min(...volumes.map((v) => v(p)));
    f.isEnd = (m, n) => volumes.some((v) => v.isEnd?.(m, n) && v(m) < 0.004);
    f.holds = volumes.every((v) => v.holds);
    f.bounds = { min: [0, 1, 2].map((k) => Math.min(...volumes.map((v) => v.bounds.min[k]))), max: [0, 1, 2].map((k) => Math.max(...volumes.map((v) => v.bounds.max[k]))) };
    return f;
  },
};

/**
 * Hard things with edges, made as meshes and not as soft shapes: a cone is a cone and a box has
 * corners. Each is carried whole by one joint (`item.solids`: [{ bone, colour, ...mesh }]).
 */
export const solid = {
  /** A shape turned round an upright axis through `centre`: `profile` is [[radius, height], ...], traced clockwise (out and down, then back in). */
  lathe: ({ centre, profile, sides = 28 }) => {
    const positions = [], normals = [], indices = [];
    for (let i = 0; i + 1 < profile.length; i++) {
      const [r0, h0] = profile[i], [r1, h1] = profile[i + 1], dl = Math.hypot(r1 - r0, h1 - h0) || 1;
      const nr = -(h1 - h0) / dl, nh = (r1 - r0) / dl, base = positions.length / 3;
      for (let j = 0; j <= sides; j++) {
        const c = Math.cos((j / sides) * Math.PI * 2), q = Math.sin((j / sides) * Math.PI * 2);
        for (const [r, h] of [[r0, h0], [r1, h1]]) (positions.push(centre[0] + r * c, centre[1] + h, centre[2] + r * q), normals.push(nr * c, nh, nr * q));
      }
      for (let j = 0; j < sides; j++) {
        const v = base + j * 2;
        if (r0 > 1e-6) indices.push(v, v + 2, v + 1);
        if (r1 > 1e-6) indices.push(v + 1, v + 2, v + 3);
      }
    }
    return orient({ positions, normals, indices });
  },
  /** A box with rounded edges (a pack, a case): `half` its half extents, `power` how square (2 is an ellipsoid). */
  block: ({ centre, half, power = 6, steps = 6 }) => {
    const positions = [], normals = [], indices = [];
    for (let axis = 0; axis < 3; axis++)
      for (const side of [-1, 1]) {
        const base = positions.length / 3, u = (axis + 1) % 3, v = (axis + 2) % 3;
        for (let i = 0; i <= steps; i++)
          for (let j = 0; j <= steps; j++) {
            const q = [0, 0, 0];
            ((q[axis] = side), (q[u] = (i / steps) * 2 - 1), (q[v] = (j / steps) * 2 - 1));
            const scale = (Math.abs(q[0]) ** power + Math.abs(q[1]) ** power + Math.abs(q[2]) ** power) ** (-1 / power);
            const n = q.map((x, k) => (Math.sign(x) * Math.abs(x * scale) ** (power - 1)) / half[k]), nl = Math.hypot(...n) || 1;
            (positions.push(...q.map((x, k) => centre[k] + x * scale * half[k])), normals.push(n[0] / nl, n[1] / nl, n[2] / nl));
          }
        for (let i = 0; i < steps; i++)
          for (let j = 0; j < steps; j++) {
            const a0 = base + i * (steps + 1) + j, b0 = a0 + steps + 1;
            indices.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
          }
      }
    return orient({ positions, normals, indices });
  },
};
/** Turns each triangle to face the way its corners' normals point. */
function orient(mesh) {
  const { positions: P, normals: N, indices: I } = mesh;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * (N[a] + N[b] + N[c]) + n[1] * (N[a + 1] + N[b + 1] + N[c + 1]) + n[2] * (N[a + 2] + N[b + 2] + N[c + 2]) < 0) [I[t + 1], I[t + 2]] = [I[t + 2], I[t + 1]];
  }
  return mesh;
}

/** How wide the rounded seam is where loose cloth leaves cloth that lies on the body. */
const SEAM = 0.016;
/** How far into the skin the faces at a garment's edges reach. */
const INTO = 0.005;
/** How far under the cloth's surface a point must be, and how far inside its edges, to count as covered. */
const UNDER = 0.003, FROM_EDGE = 0.008;
function fieldsOf(figure, { thickness = 0.012, zone: inside, volume: loose, extra = [] }) {
  const bodyField = fastField(figure.body, { reach: 0.12 });
  const extraField = extra.length ? fastField(extra, { reach: 0.06 }) : null;
  /** The cloth alone (not the body, not the garment's own shapes): negative inside it. */
  const cloth = (p, db) => {
    let d = inside ? Math.max(db - thickness, inside(p)) : Infinity;
    if (loose) {
      // Joined with a rounded seam (16 mm): cloth leaves the body in a curve, not at a crease.
      const l = loose(p), h = Math.max(0, SEAM - Math.abs(d - l)) / SEAM;
      d = Math.min(d, l) - h * h * SEAM * 0.25;
    }
    return d;
  };
  return { bodyField, extraField, cloth };
}
/**
 * Whether a point is hidden under a garment: inside its cloth (the skin, or thinner cloth worn
 * under it), `UNDER` below its surface and `FROM_EDGE` inside its cuffs and hems, so that what is
 * under a cuff still shows a little way in. With { under: 0, fromEdge: 0 } it says whether a point
 * is within the garment at all (not past a cuff or a hem): what a clipping check should look at.
 * The garment's own shapes (a hat, a pouch) hide nothing.
 */
export function coverOf(figure, item, { under = UNDER, fromEdge = FROM_EDGE, looseEdge = 0.001, looseHem = 0.03 } = {}) {
  const { thickness = 0.012, zone: inside, volume: loose } = item;
  const { bodyField } = fieldsOf(figure, item);
  return (p) => {
    // A loose volume is closed by the face its hem ends in: nothing in it shows, right up to that
    // face (`looseEdge` inside it).
    // But for the 3 cm above its hem (`looseHem`): a thigh raised in a stride lifts what is worn there out
    // from under a hem, and what was not drawn there would be missing.
    if (loose && loose(p) < -looseEdge && p[1] > loose.bounds.min[1] + looseHem) return true;
    if (!inside || inside(p) > -fromEdge) return false;
    return bodyField.distance(p[0], p[1], p[2]) < thickness - under;
  };
}

/**
 * The points of the skin that stand out of a garment's loose cloth at rest, where that cloth hangs
 * round the body (a bell, a trouser leg: `volume.holds`). Such skin is drawn in front of the cloth,
 * and no check of the poses finds it: it was never under the cloth, so nothing pairs it with it.
 * `points` are the body's vertices at rest (not its arms: a hand may hang beside a skirt).
 */
export function standsOut(figure, item, points, { tolerance = 0.001 } = {}) {
  const loose = item.volume;
  if (!loose?.holds) return { count: 0, depth: 0, at: null };
  const within = coverOf(figure, item, { under: 0, fromEdge: 0, looseEdge: 0, looseHem: 0 }), { min, max } = loose.bounds;
  let count = 0, depth = 0, at = null;
  for (const p of points) {
    if (p[1] < min[1] + 0.012 || p[1] > max[1] - 0.012 || p[0] < min[0] - 0.03 || p[0] > max[0] + 0.03 || p[2] < min[2] - 0.03 || p[2] > max[2] + 0.03) continue;
    const d = loose(p);
    if (d <= tolerance || within(p)) continue;
    count++;
    if (d > depth) ((depth = d), (at = p));
  }
  return { count, depth, at };
}

export async function buildGarment(figure, item) {
  const { id, thickness = 0.012, zone: inside, volume: loose, follow, looseSoft = 0.035, extra = [], solids = [], paint, budget = 3000, cell = 0.006, error = 0.02 } = item;
  await MeshoptSimplifier.ready;
  const { joints, body } = figure;
  const index = new Map(joints.map((j, i) => [j.name, i]));
  for (const s of extra) if (!index.has(s.bone)) throw Error(`${id}: unknown joint ${s.bone}`);
  const { bodyField, extraField, cloth } = fieldsOf(figure, item);
  // The garment alone, as a solid: its cloth and its own shapes, less the body. It reaches INTO the
  // skin a little, so that the face a cuff ends in passes into the arm (the body is drawn with far
  // fewer triangles than it was shaped with, and lies a few millimetres inside its true surface: a
  // cuff that stopped at the true surface would leave a slit to see into).
  const distance = (x, y, z) => {
    const db = bodyField.distance(x, y, z);
    let d = cloth([x, y, z], db);
    if (extraField) d = Math.min(d, extraField.distance(x, y, z));
    return Math.max(d, -db - INTO);
  };
  const pad = cell * 3 + thickness;
  const lo = [...bodyField.bounds.min], hi = [...bodyField.bounds.max];
  if (loose) {
    if (!loose.bounds) throw Error(`${id}: a loose volume needs bounds ({ min, max }) on its function`);
    for (let a = 0; a < 3; a++) ((lo[a] = Math.min(lo[a], loose.bounds.min[a])), (hi[a] = Math.max(hi[a], loose.bounds.max[a])));
  }
  if (extraField) for (let a = 0; a < 3; a++) ((lo[a] = Math.min(lo[a], extraField.bounds.min[a])), (hi[a] = Math.max(hi[a], extraField.bounds.max[a])));
  const mesh = createZhudaIsosurfaceMesh({ distance, min: lo.map((v) => v - pad), max: hi.map((v) => v + pad), cellSize: cell, project: 3, maxVertices: 6000000 });
  const P = mesh.positions, N = mesh.normals;
  const all = Uint32Array.from(mesh.indices);
  for (let t = 0; t < all.length; t += 3) [all[t + 1], all[t + 2]] = [all[t + 2], all[t + 1]];
  // What a point of the surface is: the garment's own shape, its cloth, or the face inside the body
  // where the solid was cut off (not kept: nothing sees it).
  const kind = (x, y, z) => {
    const db = bodyField.distance(x, y, z);
    if (db < -INTO + 0.002) return 'body';
    if (extraField && extraField.distance(x, y, z) < 0.002 && cloth([x, y, z], db) > 0.002) return 'extra';
    return 'cloth';
  };
  const kept = [];
  for (let t = 0; t < all.length; t += 3) {
    const a = all[t] * 3, b = all[t + 1] * 3, c = all[t + 2] * 3;
    if (kind((P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3) !== 'body') kept.push(all[t], all[t + 1], all[t + 2]);
  }
  if (!kept.length) throw Error(`${id}: nothing of it is outside the body`);
  let idx = Uint32Array.from(kept);
  const meshed = idx.length / 3;
  if (idx.length > budget * 3) idx = MeshoptSimplifier.simplify(idx, P, 3, budget * 3, error, ['LockBorder', 'Regularize'])[0];
  // Scraps of a few triangles, left where shapes cross inside the body, are not part of the garment.
  idx = withoutScraps(P, idx, { least: 12 }).indices;
  // Cloth on the body first, loose cloth and the garment's own shapes after: the `tight` leading
  // triangles lie at the garment's thickness from the skin (and may be hidden under an outer layer).
  // `ends` marks the faces a cuff or hem ends in: what is under one is at an opening, not behind cloth.
  let tight = 0;
  const endFaces = [];
  /** The vertices only an end face uses (the middle of the face closing a hem), and of which kind. */
  const endOnly = new Map();
  {
    const groups = { cloth: [], clothEnd: [], loose: [], looseEnd: [], own: [] };
    const slope = (f, m) => {
      const h = 0.001;
      const g = [f([m[0] + h, m[1], m[2]]) - f([m[0] - h, m[1], m[2]]), f([m[0], m[1] + h, m[2]]) - f([m[0], m[1] - h, m[2]]), f([m[0], m[1], m[2] + h]) - f([m[0], m[1], m[2] - h])];
      const l = Math.hypot(g[0], g[1], g[2]) || 1;
      return [g[0] / l, g[1] / l, g[2] / l];
    };
    const body3 = (q) => bodyField.distance(q[0], q[1], q[2]);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const m = [(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3];
      const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / nl, n[1] / nl, n[2] / nl];
      const db = body3(m);
      let group = 'own';
      if (kind(m[0], m[1], m[2]) !== 'extra') {
        if (db <= thickness + 0.004) {
          // A face the cloth was cut by looks along the zone's edge, not away from the body.
          const out = slope(body3, m), edge = inside && inside(m) > -0.006 ? slope(inside, m) : null;
          const along = edge ? n[0] * edge[0] + n[1] * edge[1] + n[2] * edge[2] : -1, away = n[0] * out[0] + n[1] * out[1] + n[2] * out[2];
          group = along > away || loose?.isEnd?.(m, n) ? 'clothEnd' : 'cloth';
        } else group = loose?.isEnd?.(m, n) ? 'looseEnd' : 'loose';
      }
      groups[group].push(idx[t], idx[t + 1], idx[t + 2]);
    }
    // Loose cloth is given both sides. It follows the legs softly, and in a long stride or a high
    // kick some of it turns over (most of all the face its hem ends in, stretched between the legs
    // and the hem); seen from behind it would be a hole, and the skin inside a skirt is not drawn.
    for (const v of groups.clothEnd) endOnly.set(v, 'cloth');
    for (const v of groups.looseEnd) endOnly.set(v, 'loose');
    for (const list of [groups.cloth, groups.loose, groups.own]) for (const v of list) endOnly.delete(v);
    for (const list of [groups.loose, groups.looseEnd]) for (let t = 0, n = list.length; t < n; t += 3) list.push(list[t], list[t + 2], list[t + 1]);
    idx = Uint32Array.from([...groups.cloth, ...groups.clothEnd, ...groups.loose, ...groups.looseEnd, ...groups.own]);
    tight = (groups.cloth.length + groups.clothEnd.length) / 3;
    const ends = new Uint8Array(Math.ceil(idx.length / 3 / 8));
    const mark = (from, count) => {
      for (let t = from; t < from + count; t++) ends[t >> 3] |= 1 << (t & 7);
    };
    mark(groups.cloth.length / 3, groups.clothEnd.length / 3);
    mark(tight + groups.loose.length / 3, groups.looseEnd.length / 3);
    endFaces.push(ends, (groups.clothEnd.length + groups.looseEnd.length) / 3);
  }
  const remap = new Map();
  for (const v of idx) if (!remap.has(v)) remap.set(v, remap.size);
  const nv = remap.size;
  const def = { skin: figure.skin ?? 0.024, cell: 0.004 };
  const plainBody = body.filter((s) => !s.rigid && !s.skinGroup);
  const bodySkin = skinner(def, plainBody, index);
  // Loose cloth follows the joints named in `follow` only (a skirt: hips and legs, not a hand that
  // hangs beside it), and more softly than the skin: it has no surface under it to stay on.
  const followed = follow ? plainBody.filter((sh) => follow.includes(sh.bone)) : plainBody;
  if (loose && !followed.length) throw Error(`${id}: none of the joints in follow has a shape of the body`);
  const looseSkin = loose ? skinner({ ...def, skin: looseSoft }, followed.map((sh) => ({ ...sh, soft: undefined })), index) : null;
  const ownSkin = extra.some((s) => !s.rigid) ? skinner(def, [...plainBody, ...extra.filter((s) => !s.rigid)], index) : null;
  /**
   * Where a point of the cloth takes its weights: towards the body by the garment's thickness at
   * most. Cloth on the body lands on the skin under it; loose cloth stays where it hangs.
   */
  const anchor = (p) => {
    let q = p, left = thickness + 0.002;
    for (let step = 0; step < 3 && left > 1e-4; step++) {
      const d = bodyField.distance(q[0], q[1], q[2]), h = 0.0015;
      if (d <= 0) break;
      const g = [bodyField.distance(q[0] + h, q[1], q[2]) - bodyField.distance(q[0] - h, q[1], q[2]), bodyField.distance(q[0], q[1] + h, q[2]) - bodyField.distance(q[0], q[1] - h, q[2]), bodyField.distance(q[0], q[1], q[2] + h) - bodyField.distance(q[0], q[1], q[2] - h)];
      const l = Math.hypot(g[0], g[1], g[2]) || 1, move = Math.min(d, left);
      q = [q[0] - (move * g[0]) / l, q[1] - (move * g[1]) / l, q[2] - (move * g[2]) / l];
      left -= move;
    }
    return q;
  };
  /**
   * The weights of a point of the cloth: the skin's under it where it lies on the body, the loose
   * cloth's own (softer, of the joints it may follow) where it hangs well clear, and between the two
   * a mixture, so that a skirt leaves the hips without a seam that would tear when a leg is raised.
   */
  const clothSkin = (p) => {
    const q = anchor(p);
    const tight = bodySkin(q);
    if (!looseSkin) return tight;
    let k = Math.max(0, Math.min(1, (bodyField.distance(p[0], p[1], p[2]) - thickness - 0.002) / 0.03));
    k = k * k * (3 - 2 * k);
    if (k <= 0) return tight;
    const sum = new Map();
    for (const x of tight) sum.set(x.joint, (sum.get(x.joint) ?? 0) + x.w * (1 - k));
    for (const x of looseSkin(q)) sum.set(x.joint, (sum.get(x.joint) ?? 0) + x.w * k);
    const top = [...sum].map(([joint, w]) => ({ joint, w })).sort((a, b) => b.w - a.w).slice(0, 4).filter((x) => x.w > 0.004);
    const total = top.reduce((a, x) => a + x.w, 0);
    return top.map((x) => ({ joint: x.joint, w: x.w / total }));
  };
  for (const sd of solids) if (!index.has(sd.bone)) throw Error(`${id}: unknown joint ${sd.bone}`);
  const total = nv + solids.reduce((n, sd) => n + sd.positions.length / 3, 0);
  const positions = new Float32Array(total * 3), normals = new Float32Array(total * 3), colors = new Float32Array(total * 4), J = new Uint8Array(total * 4), W = new Float32Array(total * 4);
  for (const [v, i] of remap) {
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    positions.set(p, i * 3);
    normals.set(n, i * 3);
    const part = kind(p[0], p[1], p[2]) === 'extra' ? 'extra' : bodyField.distance(p[0], p[1], p[2]) > thickness + 0.004 ? 'loose' : 'cloth';
    const shape = part === 'extra' ? extra[extraField.nearest(p[0], p[1], p[2])] : null;
    const c = paint ? paint(p, n, { part, shape, edge: part === 'loose' ? -loose(p) : inside ? -inside(p) : Infinity, end: endOnly.get(v) ?? null }) : [0.8, 0.8, 0.8];
    colors.set([toLinear(c[0]), toLinear(c[1]), toLinear(c[2]), 1], i * 4);
    const skin = shape?.rigid ? [{ joint: index.get(shape.bone), w: 1 }] : shape ? ownSkin(p) : clothSkin(p);
    skin.forEach((x, k) => ((J[i * 4 + k] = x.joint), (W[i * 4 + k] = x.w)));
  }
  // The garment's solids, after everything else: each whole on its one joint.
  const allIndices = Array.from(idx, (v) => remap.get(v));
  let at = nv;
  for (const sd of solids) {
    for (let v = 0; v < sd.positions.length / 3; v++) {
      const p = [sd.positions[v * 3], sd.positions[v * 3 + 1], sd.positions[v * 3 + 2]], n = [sd.normals[v * 3], sd.normals[v * 3 + 1], sd.normals[v * 3 + 2]];
      const c = typeof sd.colour === 'function' ? sd.colour(p, n) : sd.colour;
      (positions.set(p, (at + v) * 3), normals.set(n, (at + v) * 3), colors.set([toLinear(c[0]), toLinear(c[1]), toLinear(c[2]), 1], (at + v) * 4));
      ((J[(at + v) * 4] = index.get(sd.bone)), (W[(at + v) * 4] = 1));
    }
    for (const v of sd.indices) allIndices.push(at + v);
    at += sd.positions.length / 3;
  }
  const glb = writeRiggedGlb({
    name: id,
    joints: joints.map((j) => ({ name: j.name, parent: j.parent ? index.get(j.parent) : -1, position: j.at })),
    primitives: [{ positions, normals, colors, joints: J, weights: W, indices: Uint32Array.from(allIndices), material: 0 }],
    materials: [{ name: id, color: [1, 1, 1, 1], roughness: 0.8, metallic: 0 }],
    partNames: [id],
    animations: [],
  });
  return { glb, ends: endFaces[0], stats: { triangles: allIndices.length / 3, tight, ends: endFaces[1], meshed, vertices: total } };
}
