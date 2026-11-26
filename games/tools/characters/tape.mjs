// A tape measure for meshes: girths as a tailor takes them. A plane cuts the triangles; the points
// of the cut that belong to what is being measured (one leg, the trunk without the arms) are
// wrapped by a tape, which bridges hollows: the length of their convex hull.
//   const cut = slice(positions, indices, { point, normal })        -> [[x, y, z], ...] on the plane
//   girth(cut, { point, normal, keep })                             -> metres round the kept points
//   level(meshes, y, keep)                                          -> girth of a horizontal cut
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** The points where a mesh's edges cross a plane. */
export function slice(positions, indices, { point, normal }) {
  const n = unit(normal), out = [];
  const side = new Float32Array(positions.length / 3);
  for (let v = 0; v < side.length; v++) side[v] = (positions[v * 3] - point[0]) * n[0] + (positions[v * 3 + 1] - point[1]) * n[1] + (positions[v * 3 + 2] - point[2]) * n[2];
  for (let t = 0; t < indices.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k], b = indices[t + ((k + 1) % 3)];
      if (side[a] > 0 === side[b] > 0) continue;
      const s = side[a] / (side[a] - side[b]);
      out.push([positions[a * 3] + (positions[b * 3] - positions[a * 3]) * s, positions[a * 3 + 1] + (positions[b * 3 + 1] - positions[a * 3 + 1]) * s, positions[a * 3 + 2] + (positions[b * 3 + 2] - positions[a * 3 + 2]) * s]);
    }
  return out;
}

/** The tape round the points of a cut (those `keep` accepts): the length of their convex hull, and its extents. */
export function girth(points, { normal, keep } = {}) {
  const n = unit(normal ?? [0, 1, 0]);
  const u = unit(cross(Math.abs(n[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0], n)), v = cross(n, u);
  const flat = points.filter((p) => !keep || keep(p)).map((p) => [dot(p, u), dot(p, v)]);
  if (flat.length < 3) return { girth: 0, points: flat.length, width: 0, depth: 0 };
  flat.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of flat) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of flat.reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  let length = 0;
  for (let i = 0; i < hull.length; i++) length += Math.hypot(hull[i][0] - hull[(i + 1) % hull.length][0], hull[i][1] - hull[(i + 1) % hull.length][1]);
  const xs = hull.map((p) => p[0]), ys = hull.map((p) => p[1]);
  return { girth: length, points: flat.length, width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

/** Whether a mesh's surface crosses the plane x = 0 at height y (within `band` of it): the legs are joined there. */
export function joinedAt(meshes, y, band = 0.004) {
  for (const m of meshes) {
    const P = m.positions, I = m.indices;
    for (let t = 0; t < I.length; t += 3) {
      const ys = [P[I[t] * 3 + 1], P[I[t + 1] * 3 + 1], P[I[t + 2] * 3 + 1]], xs = [P[I[t] * 3], P[I[t + 1] * 3], P[I[t + 2] * 3]];
      if (Math.min(...ys) > y + band || Math.max(...ys) < y - band) continue;
      if (Math.min(...xs) < 0 && Math.max(...xs) > 0) return true;
    }
  }
  return false;
}
/** The girth of a horizontal cut through several meshes at height y, of the points `keep` accepts. */
export function level(meshes, y, keep) {
  const points = meshes.flatMap((m) => slice(m.positions, m.indices, { point: [0, y, 0], normal: [0, 1, 0] }));
  return girth(points, { normal: [0, 1, 0], keep });
}
/** The girth round a limb: a cut square to its axis at `along` metres from `from` towards `to`, within `reach` of the axis. */
export function round(meshes, from, to, along, reach = 0.1) {
  const axis = unit(sub(to, from)), point = [from[0] + axis[0] * along, from[1] + axis[1] * along, from[2] + axis[2] * along];
  const points = meshes.flatMap((m) => slice(m.positions, m.indices, { point, normal: axis }));
  return girth(points, { normal: axis, keep: (p) => Math.hypot(...sub(p, point)) < reach });
}
/** The largest (or smallest) of a measure taken at steps over a range: [value, where]. */
export function extreme(from, to, step, measure, most = true) {
  let best = null;
  for (let s = from; s <= to + 1e-9; s += step) {
    const value = measure(s);
    if (value > 0 && (!best || (most ? value > best[0] : value < best[0]))) best = [value, s];
  }
  return best ?? [0, from];
}
