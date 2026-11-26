// A skeleton for a mesh that was not made here: reading the mesh, and giving it weights.
//
// The kit's own `skinner` (kit.mjs) weights surfaces it built from shapes, each shape knowing its
// bone. A mesh from a generator or a scan knows nothing: one fused surface, texture seams, no
// parts. This file reads such a .glb, finds which vertices are the same place and which pieces
// are connected, and weights it from the bones' places alone:
//
//   const mesh = readGlbMesh(bytes)                       one primitive, with its textures
//   const { place, places } = weld(mesh.positions)        vertices that share a position
//   const pieces = connected(mesh.indices, place, places.length / 3)
//   const { joints, weights } = skinByDistance(points, bones, options)
//
// The weights are from distance to each bone's segment, sharpened, cut to four joints a vertex
// and smoothed over the surface. They are not a heat or a geodesic solve: where two parts of the
// body lie close in the bind pose (an arm against the side, a leg against the other) the caller
// says which bones a vertex may take (`allowed`), or the surface tears. What bends badly is seen
// by bending it: look before making clips.

/** One primitive of a .glb with what it needs to be written again: attributes, indices, material, images. */
export function readGlbMesh(bytes, { mesh = 0, primitive = 0 } = {}) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw Error('Not a .glb');
  let json = null, bin = null;
  for (let at = 12; at < view.byteLength; ) {
    const length = view.getUint32(at, true), type = view.getUint32(at + 4, true);
    const chunk = bytes.subarray(at + 8, at + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) bin = chunk;
    at += 8 + length;
  }
  if (!json || !bin) throw Error('A .glb with a JSON and a binary chunk is needed');
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const ARRAY = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const read = (index) => {
    const accessor = json.accessors[index], bufferView = json.bufferViews[accessor.bufferView];
    const Type = ARRAY[accessor.componentType], size = SIZE[accessor.type], width = Type.BYTES_PER_ELEMENT * size;
    const stride = bufferView.byteStride || width, start = bin.byteOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const out = new Type(accessor.count * size), data = new DataView(bin.buffer, start);
    const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[accessor.componentType];
    for (let i = 0; i < accessor.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = data[get](i * stride + k * Type.BYTES_PER_ELEMENT, true);
    return out;
  };
  const prim = json.meshes?.[mesh]?.primitives?.[primitive];
  if (!prim) throw Error(`No mesh ${mesh} primitive ${primitive}`);
  if ((prim.mode ?? 4) !== 4) throw Error('Only triangles are read');
  const positions = Float32Array.from(read(prim.attributes.POSITION));
  const count = positions.length / 3;
  const indices = prim.indices !== undefined ? Uint32Array.from(read(prim.indices)) : Uint32Array.from({ length: count }, (_, i) => i);
  const optional = (name) => (prim.attributes[name] !== undefined ? Float32Array.from(read(prim.attributes[name])) : null);
  const material = json.materials?.[prim.material] ?? null;
  const images = (json.images ?? []).map((image) => {
    const bufferView = json.bufferViews[image.bufferView];
    return { mime: image.mimeType, bytes: bin.slice(bufferView.byteOffset ?? 0, (bufferView.byteOffset ?? 0) + bufferView.byteLength) };
  });
  const imageOf = (texture) => (texture ? json.textures[texture.index].source : undefined);
  return {
    positions,
    normals: optional('NORMAL'),
    uvs: optional('TEXCOORD_0'),
    tangents: optional('TANGENT'),
    indices,
    material,
    images,
    /** Which image each of the material's textures is, as `writeRiggedGlb` names them. */
    textures: material
      ? {
          baseColor: imageOf(material.pbrMetallicRoughness?.baseColorTexture),
          metallicRoughness: imageOf(material.pbrMetallicRoughness?.metallicRoughnessTexture),
          normal: imageOf(material.normalTexture),
          occlusion: imageOf(material.occlusionTexture),
          emissive: imageOf(material.emissiveTexture),
        }
      : {},
    generator: json.asset?.generator ?? null,
  };
}

/**
 * Vertices that are the same place (a texture seam splits one place into several vertices).
 * `place[v]` is the place of vertex v; `places` are the places' positions.
 */
export function weld(positions, tolerance = 1e-5) {
  const count = positions.length / 3, place = new Uint32Array(count), seen = new Map(), places = [];
  const key = (v) => `${Math.round(positions[v * 3] / tolerance)},${Math.round(positions[v * 3 + 1] / tolerance)},${Math.round(positions[v * 3 + 2] / tolerance)}`;
  for (let v = 0; v < count; v++) {
    const k = key(v);
    let p = seen.get(k);
    if (p === undefined) {
      p = places.length / 3;
      seen.set(k, p);
      places.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    }
    place[v] = p;
  }
  return { place, places: Float32Array.from(places) };
}

/** Which places are joined by an edge: `neighbours[p]` is a list of places. */
export function neighboursOf(indices, place, count) {
  const sets = Array.from({ length: count }, () => new Set());
  for (let t = 0; t < indices.length; t += 3) {
    const a = place[indices[t]], b = place[indices[t + 1]], c = place[indices[t + 2]];
    (sets[a].add(b), sets[a].add(c), sets[b].add(a), sets[b].add(c), sets[c].add(a), sets[c].add(b));
  }
  return sets.map((s) => [...s].filter((p, i, list) => list.indexOf(p) === i));
}

/**
 * The connected pieces of the surface, largest first: `piece[p]` for each place, and for each
 * piece its number of places, its triangles and its box.
 */
export function connected(indices, place, count) {
  const parent = Uint32Array.from({ length: count }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const a = find(place[indices[t]]);
    for (const k of [1, 2]) {
      const b = find(place[indices[t + k]]);
      if (a !== b) parent[b] = a;
    }
  }
  const byRoot = new Map();
  for (let p = 0; p < count; p++) {
    const root = find(p);
    if (!byRoot.has(root)) byRoot.set(root, { places: 0, triangles: 0 });
    byRoot.get(root).places++;
  }
  for (let t = 0; t < indices.length; t += 3) byRoot.get(find(place[indices[t]])).triangles++;
  const order = [...byRoot.entries()].sort((a, b) => b[1].triangles - a[1].triangles);
  const number = new Map(order.map(([root], i) => [root, i]));
  const piece = Uint32Array.from({ length: count }, (_, p) => number.get(find(p)));
  return { piece, pieces: order.map(([, info]) => info) };
}

const distanceToSegment = (p, a, b) => {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], length2 = abx * abx + aby * aby + abz * abz;
  let t = length2 > 1e-12 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / length2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { distance: Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t), t };
};

/**
 * Weights for points from bones' places.
 *
 * points:  Float32Array, 3 a point (the welded places, so that a seam's two sides move as one)
 * bones:   [{ joint, from: [x, y, z], to: [x, y, z], reach?, sharpness? }]
 *          a segment the bone holds, and the index of the joint it turns. Several bones may name
 *          one joint. `reach` (metres) is where a bone's hold ends: for a chain of hair or cloth
 *          that lies on the body, about the chain's own half width; without it a bone holds any
 *          distance away.
 * options: { allowed?: (point index, bone index) => boolean,   which bones a point may take
 *            neighbours?: number[][], smooth?: number,         passes of averaging with neighbours
 *            sharpness?: number (default 4: weight falls with distance to that power),
 *            rigid?: Uint32Array of a group for each point (0: none): the points of a group all
 *                    take the weights of the group's middle: a bead, a buckle, a tassel }
 * Returns { joints: Uint8Array, weights: Float32Array } 4 a point, weights summing to 1, most first.
 */
export function skinByDistance(points, bones, options = {}) {
  const count = points.length / 3, sharp = options.sharpness ?? 4, jointCount = Math.max(...bones.map((b) => b.joint)) + 1;
  if (!bones.length) throw Error('No bones');
  if (jointCount > 256) throw Error('More than 256 joints: the weights are written with a byte a joint');
  const raw = (p, index) => {
    const row = new Map();
    let nearest = -1, nearestDistance = Infinity;
    for (let b = 0; b < bones.length; b++) {
      if (options.allowed && !options.allowed(index, b)) continue;
      const bone = bones[b], { distance } = distanceToSegment(p, bone.from, bone.to);
      if (bone.reach === undefined && distance < nearestDistance) ((nearest = bone.joint), (nearestDistance = distance));
      // Within reach a bone's hold fades to nothing at its edge.
      const fade = bone.reach === undefined ? 1 : Math.max(0, 1 - distance / bone.reach) ** 2 * (3 - 2 * Math.max(0, 1 - distance / bone.reach));
      if (fade <= 0) continue;
      const w = fade / Math.max(distance, 1e-4) ** (bone.sharpness ?? sharp);
      row.set(bone.joint, Math.max(row.get(bone.joint) ?? 0, w));
    }
    if (!row.size) {
      if (nearest < 0) throw Error(`Point ${index} may take no bone`);
      row.set(nearest, 1);
    }
    return row;
  };
  // Dense rows while smoothing; four are kept at the end.
  let rows = Array.from({ length: count }, (_, i) => normalise(raw([points[i * 3], points[i * 3 + 1], points[i * 3 + 2]], i)));
  if (options.rigid) {
    const groups = new Map();
    for (let i = 0; i < count; i++) if (options.rigid[i]) (groups.get(options.rigid[i]) ?? groups.set(options.rigid[i], []).get(options.rigid[i])).push(i);
    for (const members of groups.values()) {
      const middle = [0, 0, 0];
      for (const i of members) for (let k = 0; k < 3; k++) middle[k] += points[i * 3 + k] / members.length;
      const row = normalise(raw(middle, members[0]));
      for (const i of members) rows[i] = row;
    }
  }
  for (let pass = 0; pass < (options.smooth ?? 0); pass++) {
    const next = rows.map((row, i) => {
      if (options.rigid?.[i]) return row;
      const near = options.neighbours?.[i] ?? [];
      if (!near.length) return row;
      const sum = new Map(row);
      // Itself once, its neighbours together once; a bone a point may not take stays out.
      for (const n of near) for (const [joint, w] of rows[n]) if (!options.allowedJoint || options.allowedJoint(i, joint)) sum.set(joint, (sum.get(joint) ?? 0) + w / near.length);
      return normalise(sum);
    });
    rows = next;
  }
  const joints = new Uint8Array(count * 4), weights = new Float32Array(count * 4);
  rows.forEach((row, i) => {
    const top = [...row.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), total = top.reduce((s, [, w]) => s + w, 0);
    top.forEach(([joint, w], k) => ((joints[i * 4 + k] = joint), (weights[i * 4 + k] = w / total)));
  });
  return { joints, weights };
}
function normalise(row) {
  let total = 0;
  for (const w of row.values()) total += w;
  const out = new Map();
  for (const [joint, w] of row) if (w / total > 1e-4) out.set(joint, w / total);
  return out;
}

/**
 * Shares a limb's weights out along it between joints laid on it. `limb` is { joint, from, to }:
 * the joint that holds the limb's weights now and the limb's segment. `stops` are [{ joint, at }]
 * in order, `at` from 0 (the limb's start) to 1 (its end): a point at share t of the limb gives
 * what `limb.joint` held to the two stops it lies between, by how near it is to each (before the
 * first stop all of it goes to the first, after the last to the last). A forearm: the forearm at
 * 0 and its twist joints further on, so that a turn of the wrist is spread along it. An upper
 * arm: a twist joint near the shoulder that turns back, and the upper arm itself near the elbow.
 * Four joints a point are kept. In place.
 */
export function shareAlongLimb(points, skin, limb, stops) {
  for (let i = 0; i < points.length / 3; i++) {
    const slot = [0, 1, 2, 3].find((k) => skin.joints[i * 4 + k] === limb.joint && skin.weights[i * 4 + k] > 0);
    if (slot === undefined) continue;
    const { t } = distanceToSegment([points[i * 3], points[i * 3 + 1], points[i * 3 + 2]], limb.from, limb.to);
    let k = 0;
    while (k + 1 < stops.length && t > stops[k + 1].at) k++;
    const a = stops[k], b = stops[k + 1] ?? a, span = b.at - a.at;
    const share = span > 1e-9 ? Math.max(0, Math.min(1, (t - a.at) / span)) : 0;
    const w = skin.weights[i * 4 + slot], row = new Map();
    for (let s = 0; s < 4; s++) if (s !== slot && skin.weights[i * 4 + s] > 0) row.set(skin.joints[i * 4 + s], (row.get(skin.joints[i * 4 + s]) ?? 0) + skin.weights[i * 4 + s]);
    row.set(a.joint, (row.get(a.joint) ?? 0) + w * (1 - share));
    if (share > 0) row.set(b.joint, (row.get(b.joint) ?? 0) + w * share);
    const top = [...row.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4), total = top.reduce((sum, [, v]) => sum + v, 0);
    for (let s = 0; s < 4; s++) ((skin.joints[i * 4 + s] = top[s]?.[0] ?? 0), (skin.weights[i * 4 + s] = top[s] ? top[s][1] / total : 0));
  }
}
