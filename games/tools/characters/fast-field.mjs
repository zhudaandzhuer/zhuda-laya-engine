// The signed distance of many shapes, sped up for points near the surface: space is cut into a
// grid, and each cell keeps a field of only the shapes whose boxes come within `margin` of it.
// A shape further than `margin` from a point changes neither the value there nor which shape is
// nearest, as long as `margin` is more than the widest fillet plus how far from the surface the
// point is (`reach`): the smooth minimum only mixes shapes closer than their fillet. For a point
// outside the grid, or in a cell no shape comes near, the whole field answers.
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

export function fastField(shapes, { cells = 12, reach = 0.3 } = {}) {
  const full = createZhudaSdfField(shapes.map(bare));
  const { min, max } = full.bounds;
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const size = extent / cells;
  const maxBlend = Math.max(0, ...shapes.map((s) => s.blend ?? 0));
  const margin = maxBlend * 1.5 + reach + size * 0.05;
  const boxes = shapes.map(boxOf);
  const n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((max[a] - min[a]) / size)));
  const cache = new Map();
  const cellOf = (x, y, z) => {
    const i = Math.floor((x - min[0]) / size),
      j = Math.floor((y - min[1]) / size),
      k = Math.floor((z - min[2]) / size);
    if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) return null;
    const key = (i * n[1] + j) * n[2] + k;
    let c = cache.get(key);
    if (c === undefined) {
      const lo = [min[0] + i * size - margin, min[1] + j * size - margin, min[2] + k * size - margin];
      const hi = [lo[0] + size + 2 * margin, lo[1] + size + 2 * margin, lo[2] + size + 2 * margin];
      const sel = [];
      boxes.forEach(([bl, bh], s) => {
        if (bl[0] <= hi[0] && bh[0] >= lo[0] && bl[1] <= hi[1] && bh[1] >= lo[1] && bl[2] <= hi[2] && bh[2] >= lo[2]) sel.push(s);
      });
      // A cut with nothing before it in this cell cuts nothing here (what it cuts is out of reach).
      while (sel.length && shapes[sel[0]].subtract) sel.shift();
      // A cell no shape comes near, or one where every shape does, is answered by the whole field.
      const additive = sel.filter((s) => !shapes[s].subtract);
      c = additive.length === 0 || sel.length === shapes.length ? null : { sel, field: createZhudaSdfField(sel.map((s) => bare(shapes[s]))) };
      cache.set(key, c);
    }
    return c;
  };
  return {
    bounds: full.bounds,
    distance(x, y, z) {
      const c = cellOf(x, y, z);
      return c ? c.field.distance(x, y, z) : full.distance(x, y, z);
    },
    nearest(x, y, z) {
      const c = cellOf(x, y, z);
      return c ? c.sel[c.field.nearest(x, y, z)] : full.nearest(x, y, z);
    },
  };
}
