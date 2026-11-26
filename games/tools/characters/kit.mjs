// Beasts as signed distances: a body of soft parts (round cones and ellipsoids joined with
// fillets, through the engine's public `createZhudaSdfField`), meshed by the engine's
// `createZhudaIsosurfaceMesh`, coloured per part with a little shading baked in, skinned to a
// skeleton and given clips. Written as a .glb by ./rig-glb.mjs.
//
// A beast definition (see ./beasts/*.mjs):
//   { id, title, cell,                     cell: the mesh's detail in metres
//     joints: [{ name, parent, at }],      bind pose, world positions; the first is the root
//     shapes: [shape],                     the body, in order (fillets join a shape to those before it)
//     glow:   [{ bone, shapes, emission, color, cell? }],   emissive parts (eyes, flames), meshes of their own
//     parts?: [{ name, shapes, roughness?, metallic?, cell?, rigid? }],   other meshes of their own,
//             with their own material (armour, weapons, horns): coloured, shaded and skinned like
//             the body; a `rigid` part follows only the joint of its nearest shape (a weapon in
//             a hand), and its shapes do not pull the body's skin; a part with `ownSkin` is
//             skinned by its own shapes only (a serpent coiled round a shell: neither pulls the
//             other)
//     paint?: (p, n, shape, rgb) => rgb,   pattern on top of the parts' colours (display colours 0..1)
//     skin?: metres,                       how far a joint's pull reaches past its own parts (default 2.5 cells)
//     ao?: { step, strength },             crevice shading baked into the vertex colours
//     roughness?, metallic?,
//     clips: { Name: { seconds, loop?, pose: (t) => ({ joint: [xDeg, yDeg, zDeg], $root: [dx, dy, dz] }) } } }
//     (a joint's turn may also be a quaternion [x, y, z, w]: see Q below)
// A shape: one of the engine's SDF shapes plus `bone` (the joint that carries it), `col` (its
// display colour) and optionally `soft` (a sharper or softer skin weight for that joint).
// The model faces +Z, up is +Y, its left is +X; the ground is y = 0.
import { createZhudaIsosurfaceMesh, createZhudaSdfField } from 'zhuda-laya-engine';
import { writeRiggedGlb } from './rig-glb.mjs';

// ------------------------------------------------------------------ vectors
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => mul(a, 1 / (len(a) || 1));
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mix = (a, b, t) => lerp3(a, b, Math.max(0, Math.min(1, t)));
export const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** Three axes square to each other: the second as near `up` as it can be, the third along `forward`. */
export function frame(forward, up = [0, 1, 0]) {
  const z = norm(forward);
  let x = cross(up, z);
  if (len(x) < 1e-6) x = cross([1, 0, 0], z);
  x = norm(x);
  return [x, cross(z, x), z];
}
/** Points along a cubic Bézier curve, `n` + 1 of them. */
export function bezier(p0, p1, p2, p3, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n,
      u = 1 - t;
    return [0, 1, 2].map((a) => u * u * u * p0[a] + 3 * u * u * t * p1[a] + 3 * u * t * t * p2[a] + t * t * t * p3[a]);
  });
}
/** A small seeded random. */
export function random(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
/** Value noise in 3D (0..1), for patterns. */
export function noise3(x, y, z, seed = 0) {
  const h = (i, j, k) => {
    let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647) + Math.imul(seed, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const i = Math.floor(x),
    j = Math.floor(y),
    k = Math.floor(z);
  const fx = x - i,
    fy = y - j,
    fz = z - k;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy),
    sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h(i, j, k), h(i + 1, j, k), sx), l(h(i, j + 1, k), h(i + 1, j + 1, k), sx), sy),
    l(l(h(i, j, k + 1), h(i + 1, j, k + 1), sx), l(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), sx), sy),
    sz,
  );
}
export function fbm3(x, y, z, seed = 0, octaves = 4) {
  let v = 0,
    a = 0.5,
    f = 1,
    t = 0;
  for (let o = 0; o < octaves; o++, a *= 0.5, f *= 2) {
    v += a * noise3(x * f, y * f, z * f, seed + o * 17);
    t += a;
  }
  return v / t;
}

// ------------------------------------------------------------------ shapes
/** An ellipsoid carried by `bone`. */
export const E = (bone, center, radii, more = {}) => ({ kind: 'ellipsoid', bone, center, radii, ...more });
/** A round cone carried by `bone`, from radius `ra` at `a` to `rb` at `b`. */
export const C = (bone, a, b, ra, rb, more = {}) => ({ kind: 'roundCone', bone, a, b, ra, rb, ...more });
/** Round cones through a list of points: `bones[i]` (or one bone) carries the i-th piece. */
export function chain(bones, points, radii, more = {}) {
  const out = [];
  for (let i = 0; i + 1 < points.length; i++)
    out.push(C(Array.isArray(bones) ? bones[Math.min(i, bones.length - 1)] : bones, points[i], points[i + 1], radii[i], radii[i + 1], typeof more === 'function' ? more(i) : more));
  return out;
}
const flipX = (p) => [-p[0], p[1], p[2]];
const swapSide = (bone) => bone?.replace(/L$/, '\u0000').replace(/R$/, 'L').replace('\u0000', 'R');
/** A shape and its mirror across x = 0: bones ending in L become R (and the other way). */
export function mirrored(shape) {
  const m = { ...shape, bone: swapSide(shape.bone) };
  if (shape.kind === 'ellipsoid') {
    m.center = flipX(shape.center);
    if (shape.axes) m.axes = shape.axes.map(flipX);
  } else {
    m.a = flipX(shape.a);
    m.b = flipX(shape.b);
  }
  if (shape.flatten) m.flatten = { ...shape.flatten, axis: flipX(shape.flatten.axis) };
  if (shape.keep) m.keep = { ...shape.keep, normal: flipX(shape.keep.normal) };
  return m;
}
/** Shapes on the left side (+x), with their mirrors on the right. */
export const both = (shapes) => shapes.flatMap((s) => [s, mirrored(s)]);
/** Joints on the left, named ...L, with their mirrors ...R (parents mirrored too when they end in L). */
export function bothJoints(joints) {
  return joints.flatMap((j) => [j, { name: swapSide(j.name), parent: j.parent && /L$/.test(j.parent) ? swapSide(j.parent) : j.parent, at: flipX(j.at) }]);
}

const SDF_KEYS = ['kind', 'a', 'b', 'ra', 'rb', 'center', 'radii', 'axes', 'blend', 'subtract', 'flatten', 'keep'];
export const bare = (shape) => Object.fromEntries(SDF_KEYS.filter((k) => shape[k] !== undefined).map((k) => [k, shape[k]]));

// ------------------------------------------------------------------ colour
export const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
/** Hex '#rrggbb' to a display colour 0..1. */
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// ------------------------------------------------------------------ turns as quaternions
/**
 * Quaternions [x, y, z, w] for poses that turn about other axes than the world's (an elbow that
 * folds across a slanting arm): `Q.axis(axis, deg)`, a turn about `axis` (given in the bind
 * pose's frame, which is the joint's own); `Q.of(a, b, ...)`, `a` after `b` after ... (the last
 * is applied first, in the joint's frame); `Q.slerp(a, b, t)`.
 */
export const Q = {
  id: [0, 0, 0, 1],
  axis(axis, deg) {
    const n = norm(axis),
      h = (deg * Math.PI) / 360,
      s = Math.sin(h);
    return [n[0] * s, n[1] * s, n[2] * s, Math.cos(h)];
  },
  mul: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ],
  of: (...qs) => qs.reduce((a, b) => Q.mul(a, b), [0, 0, 0, 1]),
  slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const c = d < 0 ? b.map((v) => -v) : b;
    d = Math.abs(d);
    if (d > 0.9995) {
      const r = a.map((v, i) => v + (c[i] - v) * t);
      const l = Math.hypot(...r);
      return r.map((v) => v / l);
    }
    const th = Math.acos(d),
      s = Math.sin(th);
    return a.map((v, i) => (Math.sin((1 - t) * th) * v + Math.sin(t * th) * c[i]) / s);
  },
  /** Turns a point (relative to the joint) by q. */
  apply(q, v) {
    const u = [q[0], q[1], q[2]],
      w = q[3];
    const t = mul(cross(u, v), 2);
    return add(add(v, mul(t, w)), cross(u, t));
  },
};
const turned = (v) => (v.length === 4 ? Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]) > 1e-6 : v.some((a) => Math.abs(a) > 1e-4));

// ------------------------------------------------------------------ the build
function quatFromEulerDeg([x, y, z]) {
  const r = Math.PI / 360;
  const qx = [Math.sin(x * r), 0, 0, Math.cos(x * r)],
    qy = [0, Math.sin(y * r), 0, Math.cos(y * r)],
    qz = [0, 0, Math.sin(z * r), Math.cos(z * r)];
  const m = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  // Turn about y (heading), then x (pitch), then z (roll), each in the frame the last left.
  return m(m(qy, qx), qz);
}

export function meshOf(shapes, cell, removeFloating = true) {
  const field = createZhudaSdfField(shapes.map(bare));
  const pad = cell * 3;
  const mesh = createZhudaIsosurfaceMesh({
    distance: field.distance,
    min: field.bounds.min.map((v) => v - pad),
    max: field.bounds.max.map((v) => v + pad),
    cellSize: cell,
    project: 3,
    ...(removeFloating ? { removeFloating: { anchor: 'largest' } } : {}),
  });
  // The engine's meshes wind the other way round from glTF.
  const idx = mesh.indices instanceof Uint32Array ? mesh.indices : Uint32Array.from(mesh.indices);
  for (let t = 0; t < idx.length; t += 3) {
    const k = idx[t + 1];
    idx[t + 1] = idx[t + 2];
    idx[t + 2] = k;
  }
  return { field, positions: mesh.positions, normals: mesh.normals, indices: idx };
}

/**
 * Builds the .glb of a beast definition. Returns { glb, stats }.
 * `colorSpace`: how COLOR_0 is written. glTF says linear; the engine (LayaAir's loader) reads
 * it as a display colour and darkens linear values a second time (report SCN-16: a linear 0.6
 * drew as 86/255 where the same colour as a material factor drew as 155). 'display' (default) is
 * for this engine; 'linear' is the glTF rule, for other tools.
 */
/** A definition's clips, its poses sampled thirty times a second, as rig-glb's animations. */
export function sampleClips(def, joints) {
  return Object.entries(def.clips ?? {}).map(([name, clip]) => {
    const frames = Math.max(2, Math.round(clip.seconds * 30) + 1);
    const times = new Float32Array(frames);
    const poses = [];
    for (let f = 0; f < frames; f++) {
      const t = (f / (frames - 1)) * clip.seconds;
      times[f] = t;
      poses.push(clip.pose(t, t / clip.seconds));
    }
    const channels = [];
    for (const [j, joint] of joints.entries()) {
      if (!poses.some((p) => p[joint.name] && turned(p[joint.name]))) continue;
      const values = new Float32Array(frames * 4);
      poses.forEach((p, f) => {
        const v = p[joint.name] ?? [0, 0, 0];
        values.set(v.length === 4 ? v : quatFromEulerDeg(v), f * 4);
      });
      channels.push({ joint: j, path: 'rotation', values });
    }
    if (poses.some((p) => p.$root)) {
      const root = joints[0].at;
      const values = new Float32Array(frames * 3);
      poses.forEach((p, f) => values.set(add(root, p.$root ?? [0, 0, 0]), f * 3));
      channels.push({ joint: 0, path: 'translation', values });
    }
    return { name, times, channels };
  });
}

/**
 * The skin of a definition's body: for a point, the joints whose parts are nearest and their
 * weights (up to four), falling off over each part's `soft` (or the definition's `skin`).
 */
export function skinner(def, shapes, index) {
  const groups = new Map();
  for (const s of shapes) if (!s.subtract) (groups.get(s.bone) ?? groups.set(s.bone, []).get(s.bone)).push(s);
  const boneFields = [...groups.entries()].map(([bone, list]) => ({
    joint: index.get(bone),
    field: createZhudaSdfField(list.map((s) => ({ ...bare(s), blend: s.blend ?? 0 }))),
    soft: list.find((s) => s.soft)?.soft ?? def.skin ?? def.cell * 2.5,
  }));
  return (p) => {
    const d = boneFields.map((b) => b.field.distance(p[0], p[1], p[2]));
    const dmin = Math.min(...d);
    const w = boneFields.map((b, i) => ({ joint: b.joint, w: Math.exp(-(d[i] - dmin) / b.soft) }));
    w.sort((a, b) => b.w - a.w);
    const top = w.slice(0, 4).filter((x) => x.w > 0.004);
    const total = top.reduce((a, x) => a + x.w, 0);
    return top.map((x) => ({ joint: x.joint, w: x.w / total }));
  };
}

export function buildBeast(def, { colorSpace = 'display' } = {}) {
  const joints = def.joints.map((j) => ({ ...j }));
  const index = new Map(joints.map((j, i) => [j.name, i]));
  for (const j of joints) {
    if (j.parent && !index.has(j.parent)) throw Error(`${def.id}: joint ${j.name} has an unknown parent ${j.parent}`);
    if (j.parent && index.get(j.parent) > index.get(j.name)) throw Error(`${def.id}: joint ${j.name} comes before its parent`);
  }
  for (const s of [...def.shapes, ...(def.parts ?? []).flatMap((p) => p.shapes), ...(def.glow ?? []).flatMap((g) => g.shapes.map((x) => ({ ...x, bone: g.bone })))])
    if (!index.has(s.bone)) throw Error(`${def.id}: a shape names an unknown joint ${s.bone}`);

  const cell = def.cell;
  const body = meshOf(def.shapes, cell);
  const parts = (def.parts ?? []).map((part) => ({ part, ...meshOf(part.shapes, part.cell ?? cell, false) }));

  // Skin: each joint's own parts as a field; a vertex follows the joints whose parts are
  // nearest, falling off over `soft` metres.
  const groups = new Map();
  for (const s of [...def.shapes, ...parts.filter((p) => !p.part.rigid && !p.part.ownSkin).flatMap((p) => p.part.shapes)])
    if (!s.subtract) (groups.get(s.bone) ?? groups.set(s.bone, []).get(s.bone)).push(s);
  const fieldsOf = (groups) =>
    [...groups.entries()].map(([bone, shapes]) => ({
      joint: index.get(bone),
      field: createZhudaSdfField(shapes.map((s) => ({ ...bare(s), blend: s.blend ?? 0 }))),
      soft: shapes.find((s) => s.soft)?.soft ?? def.skin ?? cell * 2.5,
    }));
  const skinBy = (boneFields) => (p) => {
    const d = boneFields.map((b) => b.field.distance(p[0], p[1], p[2]));
    const dmin = Math.min(...d);
    const w = boneFields.map((b, i) => ({ joint: b.joint, w: Math.exp(-(d[i] - dmin) / b.soft) }));
    w.sort((a, b) => b.w - a.w);
    const top = w.slice(0, 4).filter((x) => x.w > 0.004);
    const total = top.reduce((a, x) => a + x.w, 0);
    return top.map((x) => ({ joint: x.joint, w: x.w / total }));
  };
  const skinOf = skinBy(fieldsOf(groups));

  // Colour: the nearest part's colour, the beast's pattern, and crevices darkened (by the body
  // and every other part: armour shades the skin under its edge).
  const ao = { step: cell * 2.2, strength: 0.85, ...(def.ao ?? {}) };
  const aoMax = [1, 2, 3, 4, 5].reduce((a, i) => a + i * ao.step * 0.6 ** i, 0);
  const solid = parts.length ? (x, y, z) => Math.min(body.field.distance(x, y, z), ...parts.map((p) => p.field.distance(x, y, z))) : body.field.distance;
  const enc = colorSpace === 'linear' ? toLinear : (x) => x;
  const dress = (mesh, shapes, rigid, skin = skinOf) => {
    const nv = mesh.positions.length / 3;
    const colors = new Float32Array(nv * 4);
    const jointsAttr = new Uint8Array(nv * 4),
      weightsAttr = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      const p = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
      const n = [mesh.normals[v * 3], mesh.normals[v * 3 + 1], mesh.normals[v * 3 + 2]];
      const shape = shapes[mesh.field.nearest(p[0], p[1], p[2])];
      let rgb = shape.col ?? [0.5, 0.5, 0.5];
      if (def.paint) rgb = def.paint(p, n, shape, rgb);
      let occ = 0;
      for (let i = 1; i <= 5; i++) {
        const h = i * ao.step;
        occ += Math.max(0, h - solid(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h)) * 0.6 ** i;
      }
      const shade = 1 - ao.strength * Math.min(1, occ / aoMax);
      colors.set([enc(Math.min(1, rgb[0] * shade)), enc(Math.min(1, rgb[1] * shade)), enc(Math.min(1, rgb[2] * shade)), 1], v * 4);
      const s = rigid ? [{ joint: index.get(shape.bone), w: 1 }] : skin(p);
      s.forEach((x, k) => {
        jointsAttr[v * 4 + k] = x.joint;
        weightsAttr[v * 4 + k] = x.w;
      });
    }
    return { positions: mesh.positions, normals: mesh.normals, colors, joints: jointsAttr, weights: weightsAttr, indices: mesh.indices };
  };
  const primitives = [{ ...dress(body, def.shapes, false), material: 0 }];
  const materials = [{ name: `${def.id}-body`, color: [1, 1, 1, 1], roughness: def.roughness ?? 0.72, metallic: def.metallic ?? 0 }];
  for (const { part, ...mesh } of parts) {
    materials.push({ name: `${def.id}-${part.name}`, color: [1, 1, 1, 1], roughness: part.roughness ?? def.roughness ?? 0.72, metallic: part.metallic ?? 0 });
    let skin = skinOf;
    if (part.ownSkin) {
      const own = new Map();
      for (const s of part.shapes) if (!s.subtract) (own.get(s.bone) ?? own.set(s.bone, []).get(s.bone)).push(s);
      skin = skinBy(fieldsOf(own));
    }
    primitives.push({ ...dress(mesh, part.shapes, part.rigid, skin), material: materials.length - 1 });
  }

  // Emissive parts: their own meshes, all on one joint each.
  // A glowing part with `surface: k` is moved along the body's surface normal until its centre
  // lies k of its smallest radius inside the body: eyes that show, whatever the fillets did.
  const settle = (shape, k) => {
    if (k === undefined) return shape;
    // A round cone settles each end on its own.
    if (shape.kind === 'roundCone')
      return { ...shape, a: settle({ kind: 'ellipsoid', center: shape.a, radii: [shape.ra, shape.ra, shape.ra] }, k).center, b: settle({ kind: 'ellipsoid', center: shape.b, radii: [shape.rb, shape.rb, shape.rb] }, k).center };
    let c = shape.center;
    const r = Math.min(...shape.radii);
    for (let i = 0; i < 8; i++) {
      const d = body.field.distance(c[0], c[1], c[2]);
      const e = 1e-3;
      const g = norm([
        body.field.distance(c[0] + e, c[1], c[2]) - d,
        body.field.distance(c[0], c[1] + e, c[2]) - d,
        body.field.distance(c[0], c[1], c[2] + e) - d,
      ]);
      c = sub(c, mul(g, d + k * r));
    }
    return { ...shape, center: c };
  };
  for (const [g, glow] of (def.glow ?? []).entries()) {
    const part = meshOf(glow.shapes.map((x) => settle(x, glow.surface)), glow.cell ?? cell * 0.5, false);
    const count = part.positions.length / 3;
    const j = new Uint8Array(count * 4),
      w = new Float32Array(count * 4);
    for (let v = 0; v < count; v++) {
      j[v * 4] = index.get(glow.bone);
      w[v * 4] = 1;
    }
    const lin = (c) => c.map(toLinear);
    materials.push({ name: `${def.id}-${glow.name ?? 'glow' + g}`, color: [...lin(glow.color ?? [1, 1, 1]), 1], roughness: 0.4, emissive: glow.emission.map((v) => (v <= 1 ? toLinear(v) : v ** 2.4)) });
    primitives.push({ positions: part.positions, normals: part.normals, joints: j, weights: w, indices: part.indices, material: materials.length - 1 });
  }

  const animations = sampleClips(def, joints);

  const glb = writeRiggedGlb({
    name: def.id,
    joints: joints.map((j) => ({ name: j.name, parent: j.parent ? index.get(j.parent) : -1, position: j.at })),
    primitives,
    materials,
    animations,
  });
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const p of primitives)
    for (let v = 0; v < p.positions.length; v += 3)
      for (let a = 0; a < 3; a++) {
        bounds.min[a] = Math.min(bounds.min[a], p.positions[v + a]);
        bounds.max[a] = Math.max(bounds.max[a], p.positions[v + a]);
      }
  return {
    glb,
    stats: {
      id: def.id,
      title: def.title,
      vertices: primitives.reduce((a, p) => a + p.positions.length / 3, 0),
      triangles: primitives.reduce((a, p) => a + p.indices.length / 3, 0),
      joints: joints.length,
      clips: animations.map((a) => ({ name: a.name, seconds: +a.times[a.times.length - 1].toFixed(3), loop: def.clips[a.name].loop !== false })),
      size: bounds.max.map((v, a) => +(v - bounds.min[a]).toFixed(2)),
      bounds: { min: bounds.min.map((v) => +v.toFixed(3)), max: bounds.max.map((v) => +v.toFixed(3)) },
      bytes: glb.length,
    },
  };
}
