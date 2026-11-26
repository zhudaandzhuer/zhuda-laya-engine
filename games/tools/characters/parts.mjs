// A character as separate parts on one skeleton: a body cut into regions, and garments, hair and
// shoes each a model of its own whose joints have the body's names, so that a game can bind a part
// to the body's skeleton and show or hide a region of the body under it.
//
// A part is cut from the surface of the body with that part on it: the definition's shapes are
// meshed together and the triangles that lie on the shapes `keep` accepts are kept. A garment is
// therefore the outside of the garment only, flush with the body where it ends, and it is skinned
// by the same rule as the body under it.
//
//   const { glb, stats } = await buildPart(def, { id, keep, groupOf, budgets, clips });
//
// def: { joints, shapes, surface(p, n, shape, info) -> { color (display), roughness }, skin, clips }
//   as hero-kit's heroDef returns it. A shape may carry `rigid` (wholly on its own joint) or
//   `skinGroup` (skinned among the shapes of that group only: hair on the hair's joints).
// keep(shape): whether a shape belongs to this part.
// groupOf(shape): the name of the node a kept shape's triangles go to (default one node, `id`).
// hug:     [from, to] metres: a part with joints of its own follows the skin under it where it lies
//          nearer than `from` to the body, and its own joints beyond `to` (default [0.01, 0.03]; null: never).
// budgets: { group: triangles } each group is simplified to, its open edges left where they are
//   so that neighbouring groups and parts still meet.
// clips: true writes the definition's clips (the body); parts worn on a body need none.
import { createZhudaIsosurfaceMesh } from 'zhuda-laya-engine';
import { MeshoptSimplifier } from 'meshoptimizer';
import { fastField } from './fast-field.mjs';
import { ownerOf } from './owner.mjs';
import { withoutScraps } from './islands.mjs';
import { sampleClips, skinner, toLinear } from './kit.mjs';
import { writeRiggedGlb } from './rig-glb.mjs';

function boxOf(s) {
  const pad = (s.blend ?? 0) * 1.5;
  if (s.kind === 'ellipsoid') {
    const r = Math.max(...s.radii) + pad;
    return [s.center.map((v) => v - r), s.center.map((v) => v + r)];
  }
  const r = Math.max(s.ra, s.rb) + pad;
  return [s.a.map((v, i) => Math.min(v, s.b[i]) - r), s.a.map((v, i) => Math.max(v, s.b[i]) + r)];
}

export async function buildPart(def, { id, keep, groupOf = () => id, budgets = {}, cell = 0.006, clips = false, error = 0.02, hug = [0.01, 0.03] }) {
  await MeshoptSimplifier.ready;
  const { joints, shapes } = def;
  const index = new Map(joints.map((j, i) => [j.name, i]));
  for (const s of shapes) if (!index.has(s.bone)) throw Error(`${id}: unknown joint ${s.bone}`);
  const kept = shapes.filter(keep);
  if (!kept.length) throw Error(`${id}: no shape kept`);
  // The box of the kept shapes, for the record. (The whole definition is meshed: the mesher refuses a
  // box the surface runs out of, and the rest of the body is what cuts the part's edges.)
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const s of kept) {
    const [a, b] = boxOf(s);
    for (let k = 0; k < 3; k++) (lo[k] = Math.min(lo[k], a[k])), (hi[k] = Math.max(hi[k], b[k]));
  }
  const pad = cell * 3;
  const field = fastField(shapes, { reach: cell * 6 });
  // A part built on shapes it does not keep (hair on a head) is meshed alone, less those shapes, and
  // reaches INTO them a little: the body is drawn with far fewer triangles than it was shaped with
  // and lies a few millimetres inside its true surface, so a part that stopped at the true surface
  // would leave a slit along its edge to see into.
  const rest = shapes.filter((s) => !keep(s));
  const INTO = 0.005;
  const keptField = rest.length ? fastField(kept, { reach: cell * 6 }) : null, restField = rest.length ? fastField(rest, { reach: cell * 6 + 0.03 }) : null;
  const distance = rest.length ? (x, y, z) => Math.max(keptField.distance(x, y, z), -restField.distance(x, y, z) - INTO) : field.distance;
  const mesh = createZhudaIsosurfaceMesh({ distance, min: field.bounds.min.map((v) => v - pad), max: field.bounds.max.map((v) => v + pad), cellSize: cell, project: 3, maxVertices: 6000000 });
  const P = mesh.positions, N = mesh.normals;
  const all = Uint32Array.from(mesh.indices);
  for (let t = 0; t < all.length; t += 3) [all[t + 1], all[t + 2]] = [all[t + 2], all[t + 1]];
  const owner = ownerOf(shapes);
  const keptOwner = rest.length ? ownerOf(kept) : null;
  // Triangles by group, by the shape their middle lies on.
  const groups = new Map();
  for (let t = 0; t < all.length; t += 3) {
    const a = all[t] * 3, b = all[t + 1] * 3, c = all[t + 2] * 3;
    const m = [(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3];
    // Alone: every triangle is the part's, but for the face inside the body where it was cut off.
    if (restField && restField.distance(m[0], m[1], m[2]) < -INTO + 0.002) continue;
    const shape = keptOwner ? kept[keptOwner(m[0], m[1], m[2])] : shapes[owner(m[0], m[1], m[2])];
    if (!keep(shape)) continue;
    const g = groupOf(shape);
    (groups.get(g) ?? groups.set(g, []).get(g)).push(all[t], all[t + 1], all[t + 2]);
  }
  const plain = shapes.filter((s) => !s.rigid && !s.skinGroup);
  const skinners = new Map([[undefined, skinner(def, plain.length ? plain : shapes, index)]]);
  for (const g of new Set(shapes.map((s) => s.skinGroup).filter(Boolean))) skinners.set(g, skinner(def, shapes.filter((s) => s.skinGroup === g && !s.rigid), index));
  // Where a part with joints of its own (hair) lies on the body it was not built with the skin of,
  // it follows the skin under it instead: nearer than hug[0] wholly, further than hug[1] not at all.
  // The neck turns under the hair at the nape; hair that followed only the head would let it through.
  const under = shapes.filter((s) => !keep(s) && !s.rigid && !s.skinGroup);
  const underField = hug && under.length ? fastField(under, { reach: hug[1] * 2 }) : null;
  const underSkin = underField ? skinner(def, under, index) : null;
  const hugged = (p, own) => {
    if (!underField) return own;
    let d = underField.distance(p[0], p[1], p[2]);
    if (d >= hug[1]) return own;
    let q = p;
    for (let step = 0; step < 3 && d > 1e-4; step++) {
      const h = 0.0015;
      const g = [underField.distance(q[0] + h, q[1], q[2]) - underField.distance(q[0] - h, q[1], q[2]), underField.distance(q[0], q[1] + h, q[2]) - underField.distance(q[0], q[1] - h, q[2]), underField.distance(q[0], q[1], q[2] + h) - underField.distance(q[0], q[1], q[2] - h)];
      const l = Math.hypot(g[0], g[1], g[2]) || 1;
      q = [q[0] - (d * g[0]) / l, q[1] - (d * g[1]) / l, q[2] - (d * g[2]) / l];
      d = underField.distance(q[0], q[1], q[2]);
    }
    const first = underField.distance(p[0], p[1], p[2]);
    let k = Math.max(0, Math.min(1, (first - hug[0]) / (hug[1] - hug[0])));
    k = k * k * (3 - 2 * k);
    const sum = new Map();
    for (const x of underSkin(q)) sum.set(x.joint, (sum.get(x.joint) ?? 0) + x.w * (1 - k));
    for (const x of own) sum.set(x.joint, (sum.get(x.joint) ?? 0) + x.w * k);
    const top = [...sum].map(([joint, w]) => ({ joint, w })).sort((a, b) => b.w - a.w).slice(0, 4).filter((x) => x.w > 0.004);
    const total = top.reduce((a, x) => a + x.w, 0);
    return top.map((x) => ({ joint: x.joint, w: x.w / total }));
  };
  const primitives = [], materials = [], partNames = [], stats = { groups: {}, joints: joints.length, min: [...lo], max: [...hi], meshed: all.length / 3 };
  for (const [g, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let idx = Uint32Array.from(list);
    const target = Math.floor(budgets[g] ?? Infinity) * 3;
    if (idx.length > target) idx = MeshoptSimplifier.simplify(idx, P, 3, target, error, ['LockBorder', 'Regularize'])[0];
    idx = withoutScraps(P, idx, { least: 12 }).indices;
    const remap = new Map();
    for (const v of idx) if (!remap.has(v)) remap.set(v, remap.size);
    const nv = remap.size;
    const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), colors = new Float32Array(nv * 4), J = new Uint8Array(nv * 4), W = new Float32Array(nv * 4);
    let rough = 0;
    for (const [v, i] of remap) {
      const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
      positions.set(p, i * 3);
      normals.set(n, i * 3);
      // The vertex takes the colour and the skin of a kept shape: at a cut it may sit on the body's side.
      let shape = keptOwner ? kept[keptOwner(p[0], p[1], p[2])] : shapes[owner(p[0], p[1], p[2])];
      if (!keep(shape) || groupOf(shape) !== g) shape = kept.filter((s) => groupOf(s) === g).reduce((best, s) => (dist(s, p) < dist(best, p) ? s : best));
      const surf = def.surface(p, n, shape, { h: 0, curvature: 0, occlusion: 1, base: n });
      rough += surf.roughness ?? 0.7;
      colors.set([toLinear(surf.color[0]), toLinear(surf.color[1]), toLinear(surf.color[2]), 1], i * 4);
      const skin = shape.rigid ? [{ joint: index.get(shape.bone), w: 1 }] : shape.skinGroup ? hugged(p, skinners.get(shape.skinGroup)(p)) : skinners.get(shape.skinGroup)(p);
      skin.forEach((x, k) => ((J[i * 4 + k] = x.joint), (W[i * 4 + k] = x.w)));
    }
    primitives.push({ positions, normals, colors, joints: J, weights: W, indices: idx.map((v) => remap.get(v)), material: materials.length });
    materials.push({ name: g, color: [1, 1, 1, 1], roughness: +(rough / Math.max(1, nv)).toFixed(2), metallic: 0 });
    partNames.push(g);
    stats.groups[g] = idx.length / 3;
  }
  stats.triangles = Object.values(stats.groups).reduce((a, b) => a + b, 0);
  const glb = writeRiggedGlb({
    name: id,
    joints: joints.map((j) => ({ name: j.name, parent: j.parent ? index.get(j.parent) : -1, position: j.at })),
    primitives,
    materials,
    partNames,
    animations: clips ? sampleClips(def, joints) : [],
  });
  return { glb, stats };
}

/** A rough distance from a point to a shape's middle line, for choosing among a group's shapes. */
function dist(s, p) {
  if (s.kind === 'ellipsoid') return Math.hypot(p[0] - s.center[0], p[1] - s.center[1], p[2] - s.center[2]) - Math.min(...s.radii);
  const ab = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]], ap = [p[0] - s.a[0], p[1] - s.a[1], p[2] - s.a[2]];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t) - (s.ra + (s.rb - s.ra) * t);
}

/** What a GLB written here holds, read back from its JSON chunk: for checks and manifests. */
export function inspectGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))));
  const skin = json.skins?.[0];
  return {
    joints: (skin?.joints ?? []).map((n) => json.nodes[n].name),
    parts: json.nodes.filter((n) => n.mesh !== undefined).map((n) => ({ name: n.name, triangles: json.accessors[json.meshes[n.mesh].primitives[0].indices].count / 3 })),
    clips: (json.animations ?? []).map((a) => a.name),
    bytes: bytes.byteLength,
  };
}
