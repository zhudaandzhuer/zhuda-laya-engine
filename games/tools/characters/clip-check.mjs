// Measures clipping: where one layer of a dressed character comes through the layer that should
// cover it, in every pose of every clip. Nothing is drawn: each model's vertices are skinned here
// exactly as the engine skins them when a part is bound to the body (the body's joint, times the
// difference between the two rest poses, times the part's own inverse bind matrix).
//
// For a pair (inner, outer): at rest, every inner vertex that lies under the outer surface within
// `reach` is paired with the nearest point of an outer triangle. In a pose, the vertex has come
// through when it is on the outer side both of that triangle and of the cloth then nearest to it,
// by more than `tolerance`, and that nearest cloth is not an open edge (an opening).
//
//   const body = loadModel(bytes), part = loadModel(bytes);
//   const poses = posesOf(body, { every: 2 });
//   const result = checkPair(body, { model: body, nodes: ['region-thighs'] }, { model: part }, poses);
//   -> { paired, poking, depth (m), worst: { clip, frame, vertex, at } }
const TYPES = { 5121: [Uint8Array, 1], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// ---- column-major 4 x 4 ----
export function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
export function invert(m) {
  const a = Array.from({ length: 4 }, (_, r) => Array.from({ length: 8 }, (_, c) => (c < 4 ? m[c * 4 + r] : c - 4 === r ? 1 : 0)));
  for (let col = 0; col < 4; col++) {
    let pivot = col;
    for (let r = col + 1; r < 4; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const d = a[col][col];
    for (let c = 0; c < 8; c++) a[col][c] /= d;
    for (let r = 0; r < 4; r++) if (r !== col && a[r][col]) for (let c = 7; c >= 0; c--) a[r][c] -= a[r][col] * a[col][c];
  }
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[c * 4 + r] = a[r][c + 4];
  return o;
}
function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

/** A .glb as this check needs it: mesh nodes with their vertices, the skin, the node tree, the clips. */
export function loadModel(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  const bin = bytes.subarray(20 + jsonLength + 8);
  const read = (i) => {
    const a = doc.accessors[i], v = doc.bufferViews[a.bufferView];
    const [Type, size] = TYPES[a.componentType], width = WIDTH[a.type];
    const start = bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new Type(bin.buffer.slice(start, start + a.count * width * size));
  };
  const skin = doc.skins[0];
  const binds = read(skin.inverseBindMatrices);
  const parent = new Map();
  doc.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const local = (i, pose) => {
    const n = doc.nodes[i], over = pose?.get(i);
    return n.matrix && !over ? n.matrix : trs(over?.translation ?? n.translation, over?.rotation ?? n.rotation, n.scale);
  };
  /** World matrix of every node for a pose (Map node -> { rotation?, translation? }); rest without one. */
  const worlds = (pose) => {
    const out = new Array(doc.nodes.length);
    const at = (i) => out[i] ?? (out[i] = parent.has(i) ? mul(at(parent.get(i)), local(i, pose)) : local(i, pose));
    doc.nodes.forEach((_, i) => at(i));
    return out;
  };
  const rest = worlds();
  const joints = skin.joints.map((node, k) => ({ name: doc.nodes[node].name, node, bind: Array.from(binds.subarray(k * 16, k * 16 + 16)), rest: rest[node] }));
  const meshes = doc.nodes.filter((n) => n.mesh !== undefined).map((n) => {
    const p = doc.meshes[n.mesh].primitives[0];
    return { name: n.name, positions: read(p.attributes.POSITION), joints: read(p.attributes.JOINTS_0), weights: read(p.attributes.WEIGHTS_0), indices: read(p.indices) };
  });
  const clips = (doc.animations ?? []).map((a) => {
    const frames = read(a.samplers[a.channels[0].sampler].input).length;
    const channels = a.channels.map((c) => ({ node: c.target.node, path: c.target.path, values: read(a.samplers[c.sampler].output) }));
    const pose = (frame) => {
      const m = new Map();
      for (const c of channels) {
        const w = c.path === 'rotation' ? 4 : 3;
        (m.get(c.node) ?? m.set(c.node, {}).get(c.node))[c.path] = Array.from(c.values.subarray(frame * w, frame * w + w));
      }
      return m;
    };
    return { name: a.name, frames, pose };
  });
  return { joints, meshes, clips, worlds, nodeName: (i) => doc.nodes[i].name };
}

/** The body's joint worlds for every `every`-th frame of each clip, by joint name; and at rest. */
export function posesOf(body, { every = 2, clips } = {}) {
  const byName = (worlds) => new Map(body.joints.map((j) => [j.name, worlds[j.node]]));
  const out = [];
  for (const clip of body.clips) {
    if (clips && !clips.includes(clip.name)) continue;
    for (let f = 0; f < clip.frames; f += every) out.push({ clip: clip.name, frame: f, joints: byName(body.worlds(clip.pose(f))) });
  }
  return { rest: byName(body.worlds()), list: out };
}

/**
 * A model's vertices in the body's model space for given body joint worlds: as the engine draws a
 * bound part. `nodes`: mesh node names to take (default all). Returns { positions, linear (how each
 * vertex is turned), indices, spans (where each mesh's vertices and triangles start) }.
 */
export function skinned(body, model, jointWorlds, nodes) {
  const bodyBind = new Map(body.joints.map((j) => [j.name, j.bind]));
  const matrices = model.joints.map((j) => {
    if (!bodyBind.has(j.name)) throw Error(`the body has no joint ${j.name}`);
    // body joint x (body's inverse bind x the part's rest) x the part's inverse bind
    return mul(jointWorlds.get(j.name), mul(mul(bodyBind.get(j.name), j.rest), j.bind));
  });
  const meshes = model.meshes.filter((m) => !nodes || nodes.includes(m.name));
  const count = meshes.reduce((n, m) => n + m.positions.length / 3, 0);
  const positions = new Float32Array(count * 3), linear = new Float32Array(count * 9);
  const indices = [];
  const spans = [];
  let base = 0;
  for (const m of meshes) {
    const n = m.positions.length / 3;
    for (let v = 0; v < n; v++) {
      const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
      let px = 0, py = 0, pz = 0;
      const L = (base + v) * 9;
      for (let k = 0; k < 4; k++) {
        const w = m.weights[v * 4 + k];
        if (!w) continue;
        const M = matrices[m.joints[v * 4 + k]];
        px += w * (M[0] * x + M[4] * y + M[8] * z + M[12]);
        py += w * (M[1] * x + M[5] * y + M[9] * z + M[13]);
        pz += w * (M[2] * x + M[6] * y + M[10] * z + M[14]);
        for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) linear[L + c * 3 + r] += w * M[c * 4 + r];
      }
      positions.set([px, py, pz], (base + v) * 3);
    }
    spans.push({ name: m.name, vertex: base, vertices: n, triangle: indices.length / 3, triangles: m.indices.length / 3 });
    for (const i of m.indices) indices.push(i + base);
    base += n;
  }
  return { positions, linear, indices: Uint32Array.from(indices), spans };
}

/** Closest point of triangle abc to p: [distance squared, u, v, w]. */
function closest(p, a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let u, v, w;
  if (d1 <= 0 && d2 <= 0) [u, v, w] = [1, 0, 0];
  else {
    const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]], d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) [u, v, w] = [0, 1, 0];
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) ((v = d1 / (d1 - d3)), (u = 1 - v), (w = 0));
      else {
        const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) [u, v, w] = [0, 0, 1];
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) ((w = d2 / (d2 - d6)), (u = 1 - w), (v = 0));
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) ((w = (d4 - d3) / (d4 - d3 + (d5 - d6))), (v = 1 - w), (u = 0));
            else {
              const den = 1 / (va + vb + vc);
              v = vb * den;
              w = vc * den;
              u = 1 - v - w;
            }
          }
        }
      }
    }
  }
  const q = [a[0] * u + b[0] * v + c[0] * w, a[1] * u + b[1] * v + c[1] * w, a[2] * u + b[2] * v + c[2] * w];
  return [(p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2, u, v, w];
}
const vec = (P, i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
function normalOf(P, I, t) {
  const a = vec(P, I[t * 3]), b = vec(P, I[t * 3 + 1]), c = vec(P, I[t * 3 + 2]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/**
 * Where a triangle's rest normal `n` points in a pose: turned as the skin turns its three corners
 * (weighted u, v, w). It is what the triangle's own normal should be; when the two disagree the
 * triangle has folded over, and its own normal no longer says which side is outside.
 */
function turned(L, I, t, n, u = 1 / 3, v = 1 / 3, w = 1 / 3) {
  const out = [0, 0, 0];
  const k = [u, v, w];
  for (let c = 0; c < 3; c++) {
    const o = I[t * 3 + c] * 9;
    for (let r = 0; r < 3; r++) out[r] += k[c] * (L[o + r] * n[0] + L[o + 3 + r] * n[1] + L[o + 6 + r] * n[2]);
  }
  const l = Math.hypot(out[0], out[1], out[2]) || 1;
  return [out[0] / l, out[1] / l, out[2] / l];
}

/** A grid over the triangles of a flattened mesh (those `allowed`, default all), for nearest-point queries. */
function gridOf(P, I, cell, allowed) {
  const grid = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  for (let t = 0; t < I.length / 3; t++) {
    if (allowed && !allowed(t)) continue;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) ((lo[a] = Math.min(lo[a], P[I[t * 3 + k] * 3 + a])), (hi[a] = Math.max(hi[a], P[I[t * 3 + k] * 3 + a])));
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++)
      for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++)
        for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) (grid.get(key(x, y, z)) ?? grid.set(key(x, y, z), []).get(key(x, y, z))).push(t);
  }
  return (p, each) => {
    const c = p.map((x) => Math.floor(x / cell));
    const seen = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const t of grid.get(key(c[0] + dx, c[1] + dy, c[2] + dz)) ?? []) if (!seen.has(t)) (seen.add(t), each(t));
  };
}
const bit = (mask, t) => (mask[t >> 3] & (1 << (t & 7))) !== 0;
/** Which triangles of a flattened mesh count: `tight` (the first so many of each mesh) and not masked. */
function allowedOf(flat, { tight, masks } = {}) {
  if (!tight && !masks) return null;
  const ok = new Uint8Array(flat.indices.length / 3);
  for (const span of flat.spans) {
    const limit = tight?.[span.name] ?? (typeof tight === 'number' ? tight : span.triangles), mask = masks?.[span.name];
    for (let t = 0; t < span.triangles; t++) if (t < limit && !(mask && bit(mask, t))) ok[span.triangle + t] = 1;
  }
  return (t) => ok[t] === 1;
}
/** Vertices of a flattened mesh welded by place, and its open edges (an edge with one allowed triangle on it). */
function bordersOf(flat, allowed) {
  const P = flat.positions, I = flat.indices;
  const place = new Map(), same = new Uint32Array(P.length / 3);
  for (let v = 0; v < same.length; v++) {
    const k = `${Math.round(P[v * 3] * 1e5)},${Math.round(P[v * 3 + 1] * 1e5)},${Math.round(P[v * 3 + 2] * 1e5)}`;
    same[v] = place.get(k) ?? place.set(k, v).get(k);
  }
  const edge = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  const count = new Map();
  for (let t = 0; t < I.length / 3; t++) {
    if (allowed && !allowed(t)) continue;
    for (let k = 0; k < 3; k++) {
      const e = edge(same[I[t * 3 + k]], same[I[t * 3 + ((k + 1) % 3)]]);
      count.set(e, (count.get(e) ?? 0) + 1);
    }
  }
  const edges = new Set(), vertices = new Set(), list = [];
  for (const [e, n] of count) {
    if (n !== 1) continue;
    const a = Math.floor(e / 4294967296), b = e % 4294967296;
    edges.add(e);
    vertices.add(a);
    vertices.add(b);
    list.push([a, b]);
  }
  return { same, edges, vertices, list, isEdge: (a, b) => edges.has(edge(same[a], same[b])), isVertex: (a) => vertices.has(same[a]) };
}

/**
 * At rest, the point of the outer surface each inner vertex lies under: an array by inner vertex of
 * null or { t, u, w1, w2, n, under } (outer triangle, where on it, its normal, how far under).
 * A vertex is under the surface when the nearest point of it within `reach` faces away from the
 * vertex and is not on an open edge of the surface: a vertex whose nearest point is the hem itself
 * lies beside the hem, not under the cloth, and would be counted when the hem swings over it.
 * `within(p)`, when the garment's maker can say it, limits the vertices to those inside the
 * garment's own extent.
 */
function under(restIn, restOut, reach, allowed, within) {
  const P = restOut.positions, I = restOut.indices;
  const near = gridOf(P, I, reach, allowed);
  const border = bordersOf(restOut, allowed);
  const n = restIn.positions.length / 3;
  const out = new Array(n).fill(null);
  const EDGE = 1e-4;
  for (let v = 0; v < n; v++) {
    const p = vec(restIn.positions, v);
    if (within && !within(p)) continue;
    let best = null;
    near(p, (t) => {
      const hit = closest(p, vec(P, I[t * 3]), vec(P, I[t * 3 + 1]), vec(P, I[t * 3 + 2]));
      if (hit[0] <= reach * reach && (!best || hit[0] < best.hit[0])) best = { t, hit };
    });
    if (!best) continue;
    const [, u, w1, w2] = best.hit;
    const ia = I[best.t * 3], ib = I[best.t * 3 + 1], ic = I[best.t * 3 + 2];
    // Where on the triangle the nearest point is: inside it, on one of its edges, or at a corner.
    const zero = [u < EDGE, w1 < EDGE, w2 < EDGE];
    const zeros = zero.filter(Boolean).length;
    if (zeros === 1 && border.isEdge(zero[0] ? ib : ia, zero[2] ? ib : ic)) continue;
    if (zeros === 2 && border.isVertex(!zero[0] ? ia : !zero[1] ? ib : ic)) continue;
    const a = vec(P, ia), b = vec(P, ib), cc = vec(P, ic);
    const q = [a[0] * u + b[0] * w1 + cc[0] * w2, a[1] * u + b[1] * w1 + cc[1] * w2, a[2] * u + b[2] * w1 + cc[2] * w2];
    const nrm = normalOf(P, I, best.t);
    const side = (p[0] - q[0]) * nrm[0] + (p[1] - q[1]) * nrm[1] + (p[2] - q[2]) * nrm[2];
    // Seen edge-on a triangle says nothing about what is under it.
    if (side < 0 && -side >= 0.25 * Math.sqrt(best.hit[0])) out[v] = { t: best.t, u, w1, w2, n: nrm, under: -side };
  }
  return out;
}
/** Distance from each of the given vertices to the nearest open edge of the allowed triangles. */
function toBorder(positions, vertices, restOut, allowed, reach) {
  const P = restOut.positions;
  const borders = bordersOf(restOut, allowed).list;
  const grid = new Map(), cell = reach;
  const key = (x, y, z) => `${x},${y},${z}`;
  borders.forEach(([a, b], i) => {
    const A = vec(P, a), B = vec(P, b);
    const lo = A.map((x, k) => Math.floor(Math.min(x, B[k]) / cell)), hi = A.map((x, k) => Math.floor(Math.max(x, B[k]) / cell));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) (grid.get(key(x, y, z)) ?? grid.set(key(x, y, z), []).get(key(x, y, z))).push(i);
  });
  const out = new Map();
  for (const v of vertices) {
    const p = vec(positions, v), c = p.map((x) => Math.floor(x / cell));
    let best = reach;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const i of grid.get(key(c[0] + dx, c[1] + dy, c[2] + dz)) ?? []) {
        const A = vec(P, borders[i][0]), B = vec(P, borders[i][1]);
        const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ap = [p[0] - A[0], p[1] - A[1], p[2] - A[2]];
        const s = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1)));
        best = Math.min(best, Math.hypot(ap[0] - ab[0] * s, ap[1] - ab[1] * s, ap[2] - ab[2] * s));
      }
    out.set(v, best);
  }
  return out;
}

/**
 * What of `inner` need not be drawn while `outer` is worn over it: for each mesh of `inner`, a bit
 * per triangle (in the file's order), set where all three corners lie under the outer surface and
 * further than `margin` from its open edges (so that skin still shows a little way into a cuff).
 * Only what follows the body counts on either side: `tight` is how many leading triangles of a
 * mesh do ({ mesh: count }, or one count; default all). Cloth that hangs on joints of its own
 * swings away from what was under it, and a hole would show.
 * Returns { masks: { mesh: Uint8Array }, hidden, triangles }.
 */
export function coverMasks(body, inner, outer, poses, { reach = 0.04, margin = 0.01 } = {}) {
  const restIn = skinned(body, inner.model, poses.rest, inner.nodes), restOut = skinned(body, outer.model, poses.rest, outer.nodes);
  const allowed = allowedOf(restOut, { tight: outer.tight });
  const pairs = under(restIn, restOut, reach, allowed);
  const covered = [];
  pairs.forEach((pr, v) => pr && covered.push(v));
  const far = toBorder(restIn.positions, covered, restOut, allowed, Math.max(margin, 0.02));
  const deep = new Uint8Array(pairs.length);
  for (const v of covered) if (far.get(v) > margin) deep[v] = 1;
  const masks = {};
  let hidden = 0, triangles = 0;
  for (const span of restIn.spans) {
    const mask = new Uint8Array(Math.ceil(span.triangles / 8));
    const limit = inner.tight?.[span.name] ?? (typeof inner.tight === 'number' ? inner.tight : span.triangles);
    let any = 0;
    for (let t = 0; t < limit; t++) {
      const o = (span.triangle + t) * 3;
      if (deep[restIn.indices[o]] && deep[restIn.indices[o + 1]] && deep[restIn.indices[o + 2]]) ((mask[t >> 3] |= 1 << (t & 7)), any++);
    }
    triangles += span.triangles;
    hidden += any;
    if (any) masks[span.name] = mask;
  }
  return { masks, hidden, triangles };
}

/**
 * A mask by a test on places: for each mesh of `inner` (a model in the body's space at rest), a bit
 * per triangle, set where `covered(p)` holds at all three corners. Use it when the tool that made a
 * garment can say exactly what lies under it (garment.mjs: coverOf). `inner.tight` as in coverMasks.
 * Returns { masks: { mesh: Uint8Array }, hidden, triangles }.
 */
export function maskWhere(body, inner, poses, covered) {
  const rest = skinned(body, inner.model, poses.rest, inner.nodes);
  const n = rest.positions.length / 3, deep = new Uint8Array(n);
  for (let v = 0; v < n; v++) if (covered(vec(rest.positions, v))) deep[v] = 1;
  const masks = {};
  let hidden = 0, triangles = 0;
  for (const span of rest.spans) {
    const mask = new Uint8Array(Math.ceil(span.triangles / 8));
    const limit = inner.tight?.[span.name] ?? (typeof inner.tight === 'number' ? inner.tight : span.triangles);
    let any = 0;
    for (let t = 0; t < limit; t++) {
      const o = (span.triangle + t) * 3;
      if (deep[rest.indices[o]] && deep[rest.indices[o + 1]] && deep[rest.indices[o + 2]]) ((mask[t >> 3] |= 1 << (t & 7)), any++);
    }
    triangles += span.triangles;
    hidden += any;
    if (any) masks[span.name] = mask;
  }
  return { masks, hidden, triangles };
}

/**
 * How far `inner` comes through `outer` over the poses. inner, outer: { model, nodes?, masks? }
 * (`masks`: triangles not drawn, as coverMasks returns them; a vertex only they use is not looked at;
 * on the outer, triangles that are not cloth to stay under, such as the faces its cuffs end in).
 * `outer.within(p)`: whether a place at rest is inside the garment's own extent, when its maker knows.
 * A vertex under the cloth at rest has come through in a pose when it is then on the outer side of
 * the cloth nearest to it, by more than `tolerance`, and that nearest cloth is not an open edge.
 * Returns { paired, poking, depth, worst }: vertices paired at rest, the most of them through at
 * once, the deepest (metres), and the clip and frame of the deepest.
 */
export function checkPair(body, inner, outer, poses, { reach = 0.04, tolerance = 0.001, detail = false, around = 0.045 } = {}) {
  const restIn = skinned(body, inner.model, poses.rest, inner.nodes), restOut = skinned(body, outer.model, poses.rest, outer.nodes);
  const I = restOut.indices, R = restOut.positions;
  const drawnOut = allowedOf(restOut, { masks: outer.masks });
  const all = under(restIn, restOut, reach, drawnOut, outer.within);
  // Inner vertices still drawn: those of a triangle no mask hides.
  let drawn = null;
  if (inner.masks) {
    drawn = new Uint8Array(all.length);
    const ok = allowedOf(restIn, { masks: inner.masks });
    for (let t = 0; t < restIn.indices.length / 3; t++) if (ok(t)) for (let k = 0; k < 3; k++) drawn[restIn.indices[t * 3 + k]] = 1;
  }
  const pairs = [];
  all.forEach((pr, v) => pr && (!drawn || drawn[v]) && pairs.push({ v, ...pr }));
  const result = { paired: pairs.length, poking: 0, depth: 0, worst: null };
  if (!pairs.length) return result;
  // In a pose a vertex is measured against the cloth nearest to it then, among the triangles that
  // were round its place at rest and that it was behind (cloth slides over what it covers; the
  // triangle that was over a vertex at rest need not be the one over it now).
  const border = bordersOf(restOut, drawnOut);
  const nearRest = gridOf(R, I, around, drawnOut);
  const restNormal = new Map();
  const normalAtRest = (t) => restNormal.get(t) ?? restNormal.set(t, normalOf(R, I, t)).get(t);
  for (const pr of pairs) {
    const p = vec(restIn.positions, pr.v);
    pr.round = [];
    nearRest(p, (t) => {
      const a = vec(R, I[t * 3]);
      if (closest(p, a, vec(R, I[t * 3 + 1]), vec(R, I[t * 3 + 2]))[0] > around * around) return;
      // Only cloth the vertex was behind at rest: a sleeve's underside faces the ribs it closes on,
      // and the ribs were never under it.
      const n = normalAtRest(t);
      if ((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] + (p[2] - a[2]) * n[2] < 0) pr.round.push(t);
    });
    if (!pr.round.includes(pr.t)) pr.round.push(pr.t);
  }
  const EDGE = 1e-4;
  const list = detail ? new Map() : null;
  for (const pose of poses.list) {
    const A = skinned(body, inner.model, pose.joints, inner.nodes).positions, posed = skinned(body, outer.model, pose.joints, outer.nodes), B = posed.positions;
    let through = 0;
    for (const pr of pairs) {
      const p = vec(A, pr.v);
      let best = null, bt = -1;
      for (const t of pr.round) {
        const hit = closest(p, vec(B, I[t * 3]), vec(B, I[t * 3 + 1]), vec(B, I[t * 3 + 2]));
        if (!best || hit[0] < best[0]) ((best = hit), (bt = t));
      }
      const [, u, w1, w2] = best;
      const ia = I[bt * 3], ib = I[bt * 3 + 1], ic = I[bt * 3 + 2];
      // Nearest to an open edge of the cloth: the vertex is at the opening (a neck in a collar, a
      // boot below a hem), beside the cloth and not behind it.
      const zero = [u < EDGE, w1 < EDGE, w2 < EDGE], zeros = zero.filter(Boolean).length;
      if (zeros === 1 && border.isEdge(zero[0] ? ib : ia, zero[2] ? ib : ic)) continue;
      if (zeros === 2 && border.isVertex(!zero[0] ? ia : !zero[1] ? ib : ic)) continue;
      const a = vec(B, ia), b = vec(B, ib), c = vec(B, ic);
      const q = [a[0] * u + b[0] * w1 + c[0] * w2, a[1] * u + b[1] * w1 + c[1] * w2, a[2] * u + b[2] * w1 + c[2] * w2];
      // The triangle's own normal while it still faces the way the skin turned it; where it has
      // folded over (a crease closing in an armpit), the way it should face.
      const should = turned(posed.linear, I, bt, normalAtRest(bt), u, w1, w2);
      let nrm = normalOf(B, I, bt);
      if (nrm[0] * should[0] + nrm[1] * should[1] + nrm[2] * should[2] < 0.3) nrm = should;
      const nearest = (p[0] - q[0]) * nrm[0] + (p[1] - q[1]) * nrm[1] + (p[2] - q[2]) * nrm[2];
      if (nearest <= tolerance) continue;
      // And it must also have passed the very cloth that was over it at rest. Where a crease closes
      // (under an arm, behind a knee) cloth of the other side comes nearest without the skin having
      // gone anywhere; where cloth slides, the triangle of rest is left behind without anything
      // showing. A vertex is through when both say so, by the lesser of the two.
      const ra = vec(B, I[pr.t * 3]), rb = vec(B, I[pr.t * 3 + 1]), rc = vec(B, I[pr.t * 3 + 2]);
      const rq = [ra[0] * pr.u + rb[0] * pr.w1 + rc[0] * pr.w2, ra[1] * pr.u + rb[1] * pr.w1 + rc[1] * pr.w2, ra[2] * pr.u + rb[2] * pr.w1 + rc[2] * pr.w2];
      const rShould = turned(posed.linear, I, pr.t, pr.n, pr.u, pr.w1, pr.w2);
      let rn = normalOf(B, I, pr.t);
      if (rn[0] * rShould[0] + rn[1] * rShould[1] + rn[2] * rShould[2] < 0.3) rn = rShould;
      const d = Math.min(nearest, (p[0] - rq[0]) * rn[0] + (p[1] - rq[1]) * rn[1] + (p[2] - rq[2]) * rn[2]);
      if (d > tolerance) through++;
      if (d > result.depth) ((result.depth = d), (result.worst = { clip: pose.clip, frame: pose.frame, vertex: pr.v, at: p.map((x) => +x.toFixed(3)), rest: vec(restIn.positions, pr.v).map((x) => +x.toFixed(3)), underMm: +(pr.under * 1000).toFixed(1) }));
      if (d > tolerance && list) list.set(pr.v, Math.max(list.get(pr.v) ?? 0, d));
    }
    result.poking = Math.max(result.poking, through);
  }
  // With `detail`: every vertex that came through, deepest first: [{ rest, depthMm, underMm, mesh }].
  if (list) {
    const meshOf = (v) => restIn.spans.find((sp) => v >= sp.vertex && v < sp.vertex + sp.vertices).name;
    const byVertex = new Map(pairs.map((pr) => [pr.v, pr]));
    result.list = [...list].sort((a, b) => b[1] - a[1]).map(([v, d]) => ({ rest: vec(restIn.positions, v).map((x) => +x.toFixed(3)), depthMm: +(d * 1000).toFixed(1), underMm: +(byVertex.get(v).under * 1000).toFixed(1), mesh: meshOf(v) }));
  }
  return result;
}

/**
 * Folds: triangles of a model that face the other way from how the skin turned them (cloth turned
 * inside out where a crease closes). Returns { triangles, area (m2 at rest), worst: { clip, frame, at } }
 * for the pose with the most folded area, and `ever`: the triangles folded in any pose. `first`:
 * look only at so many leading triangles (a garment's cloth on the body; its loose cloth has both
 * sides and may turn over).
 */
export function folds(body, model, poses, nodes, { first = Infinity } = {}) {
  const rest = skinned(body, model, poses.rest, nodes);
  const I = rest.indices, count = Math.min(first, I.length / 3);
  const normals = [], areas = new Float32Array(count);
  for (let t = 0; t < count; t++) {
    const a = vec(rest.positions, I[t * 3]), b = vec(rest.positions, I[t * 3 + 1]), c = vec(rest.positions, I[t * 3 + 2]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    areas[t] = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    normals.push(normalOf(rest.positions, I, t));
  }
  const result = { triangles: 0, area: 0, worst: null, ever: new Set() };
  for (const pose of poses.list) {
    const posed = skinned(body, model, pose.joints, nodes);
    let n = 0, area = 0, at = null, biggest = 0;
    for (let t = 0; t < count; t++) {
      if (areas[t] < 1e-9) continue;
      const own = normalOf(posed.positions, I, t), should = turned(posed.linear, I, t, normals[t]);
      if (own[0] * should[0] + own[1] * should[1] + own[2] * should[2] >= 0) continue;
      n++;
      area += areas[t];
      result.ever.add(t);
      if (areas[t] > biggest) ((biggest = areas[t]), (at = vec(posed.positions, I[t * 3]).map((x) => +x.toFixed(3))));
    }
    if (area > result.area) ((result.area = area), (result.triangles = n), (result.worst = { clip: pose.clip, frame: pose.frame, at }));
  }
  return result;
}
