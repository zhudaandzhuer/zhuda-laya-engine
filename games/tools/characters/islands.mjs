// Pieces of a mesh: triangles joined through shared corners (corners at the same place count as
// one). A garment or a region of a body is a few pieces at most (two shoes, two sleeves); a piece
// of a few triangles is a scrap the mesher left where shapes cross, usually inside the body, and
// anything measured against it is measured wrong.
//   const pieces = islands(positions, indices)          -> [[triangle, ...], ...] largest first
//   const kept = withoutScraps(positions, indices, { least: 24 })   -> indices without the scraps
export function islands(positions, indices) {
  const place = new Map(), same = new Int32Array(positions.length / 3);
  for (let v = 0; v < same.length; v++) {
    const k = `${Math.round(positions[v * 3] * 1e5)},${Math.round(positions[v * 3 + 1] * 1e5)},${Math.round(positions[v * 3 + 2] * 1e5)}`;
    same[v] = place.get(k) ?? place.set(k, v).get(k);
  }
  const parent = new Int32Array(same.length).map((_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const a = find(same[indices[t]]), b = find(same[indices[t + 1]]), c = find(same[indices[t + 2]]);
    parent[b] = a;
    parent[find(c)] = a;
  }
  const groups = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const root = find(same[indices[t]]);
    (groups.get(root) ?? groups.set(root, []).get(root)).push(t / 3);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/** The indices without the pieces of fewer than `least` triangles (the largest piece always stays). */
export function withoutScraps(positions, indices, { least = 24 } = {}) {
  const pieces = islands(positions, indices);
  const keep = pieces.filter((p, i) => i === 0 || p.length >= least);
  if (keep.length === pieces.length) return { indices, dropped: 0, pieces: pieces.length };
  const out = new Uint32Array(keep.reduce((n, p) => n + p.length, 0) * 3);
  let o = 0;
  for (const piece of keep) for (const t of piece) (out.set([indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]], o), (o += 3));
  return { indices: out, dropped: indices.length / 3 - out.length / 3, pieces: keep.length };
}
