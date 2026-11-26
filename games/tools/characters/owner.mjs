// Which shape a point of the surface belongs to, for cutting a definition into materials
// (./textured.mjs, ./bake-core.mjs, only for definitions with `materials`).
//
// The engine's `nearest` (the shape of least distance) is biased for that: where shapes are joined
// with wide fillets the surface lies outside each of them (up to a quarter of the fillet), and a
// flattened shape reports its distance multiplied by its factor, so a thin flattened trim counts
// as nearest centimetres beyond its edge. Here a point belongs to the last shape, in the
// definition's order, whose own surface it lies on (distance at most `epsilon`, a flattened
// shape's distance divided by its factor): a trim laid over a garment is on top of it. Where no
// shape's surface is that close (in a fillet), it is the shape of least corrected distance.
import { createZhudaSdfField } from 'zhuda-laya-engine';
import { bare } from './kit.mjs';

function boxOf(s) {
  if (s.kind === 'ellipsoid') {
    const r = Math.max(...s.radii);
    return [s.center.map((v) => v - r), s.center.map((v) => v + r)];
  }
  const r = Math.max(s.ra, s.rb);
  return [s.a.map((v, i) => Math.min(v, s.b[i]) - r), s.a.map((v, i) => Math.max(v, s.b[i]) + r)];
}

/**
 * `(x, y, z) => index into shapes` among `ids` (default all; cuts are never owners). Shapes are
 * looked up through a grid of `cell`-metre cells, each holding the shapes whose boxes come within
 * `margin` of it (all of them where none does).
 */
export function ownerOf(shapes, { ids = shapes.map((_, i) => i), epsilon = 0.0012, cell = 0.04, margin = 0.03 } = {}) {
  const parts = ids
    .filter((i) => !shapes[i].subtract)
    .map((i) => {
      const s = shapes[i];
      const field = createZhudaSdfField([{ ...bare(s), blend: 0 }]);
      const k = s.flatten && s.flatten.factor < 1 ? s.flatten.factor : 1;
      return { i, d: (x, y, z) => field.distance(x, y, z) / k, box: boxOf(s) };
    });
  const lo = [0, 1, 2].map((a) => Math.min(...parts.map((p) => p.box[0][a])) - margin);
  const cache = new Map();
  const cellOf = (x, y, z) => {
    const g = [Math.floor((x - lo[0]) / cell), Math.floor((y - lo[1]) / cell), Math.floor((z - lo[2]) / cell)];
    const key = g.join(',');
    let list = cache.get(key);
    if (!list) {
      const a = g.map((v, k) => lo[k] + v * cell - margin),
        b = g.map((v, k) => lo[k] + (v + 1) * cell + margin);
      list = parts.filter((p) => p.box[0].every((v, k) => v <= b[k]) && p.box[1].every((v, k) => v >= a[k]));
      if (!list.length) list = parts;
      cache.set(key, list);
    }
    return list;
  };
  return (x, y, z) => {
    let late = -1,
      best = -1,
      bestD = Infinity;
    for (const p of cellOf(x, y, z)) {
      const d = p.d(x, y, z);
      if (d <= epsilon && p.i > late) late = p.i;
      if (d < bestD) (bestD = d), (best = p.i);
    }
    return late >= 0 ? late : best;
  };
}
