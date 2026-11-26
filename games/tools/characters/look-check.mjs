// Looks at a dressed character in every pose from all round, as a player's camera might, and
// counts what must never be seen:
//   holes:  pixels whose nearest surface faces away (one sees through the garment there);
//   shown:  pixels whose nearest surface is skin, or cloth of an inner layer, at a place the
//           garment over it covers (well inside its edges): it has come through.
// It needs no pairing of surfaces and no judgement of which triangle is over which: it is what
// would be on the screen. Areas are in square centimetres of the figure (a pixel is 1 / pxPerMetre
// on a side), for the worst single view and on average.
//
//   const result = lookCheck(body, layers, poses, { pxPerMetre: 300 });
//   body:    the body's model (clip-check.mjs: loadModel)
//   layers:  [{ id, model, hidden?: { mesh: mask }, covers?: (p) => boolean }] the body first, then
//            the parts from the innermost out. `hidden`: triangles not drawn. `covers(p)`: whether
//            a place (at rest) is under this layer's cloth; a layer without it covers nothing.
//   result:  { views, holes: { mean, worst, at }, shown: { mean, worst, at } }
//   dressed(body, layers, poses).at(joints, yaw, pitch) -> one view, with its marks, for a picture
import { skinned } from './clip-check.mjs';
import { look } from './raster.mjs';

/** 26 directions: every 45 degrees round, level and from 35 degrees above and below, and straight up and down. */
export const VIEWS = [];
for (const pitch of [-35, 0, 35]) for (let yaw = 0; yaw < 360; yaw += 45) VIEWS.push([yaw + (pitch ? 22 : 0), pitch]);
VIEWS.push([0, 89], [0, -89]);

/**
 * A dressed figure ready to be looked at: `at(joints, yaw, pitch)` gives one view with what is wrong
 * in it: { view, holes, shown, marks } (pixels; marks: 1 a hole, 2 covered surface that shows).
 */
export function dressed(body, layers, poses, { pxPerMetre = 300 } = {}) {
  // Each layer at rest, flattened as it is drawn, and which of its triangles could show wrongly: one
  // with a corner under some layer outside it.
  const flat = layers.map((layer) => skinned(body, layer.model, poses.rest));
  const hiddenOf = layers.map((layer, k) => {
    if (!layer.hidden) return null;
    const out = new Uint8Array(Math.ceil(flat[k].indices.length / 3 / 8));
    for (const span of flat[k].spans) {
      const mask = layer.hidden[span.name];
      if (!mask) continue;
      for (let t = 0; t < span.triangles; t++) if (mask[t >> 3] & (1 << (t & 7))) out[(span.triangle + t) >> 3] |= 1 << ((span.triangle + t) & 7);
    }
    return out;
  });
  const over = layers.map((_, k) => layers.slice(k + 1).filter((l) => l.covers).map((l) => l.covers));
  const suspect = layers.map((_, k) => {
    if (!over[k].length) return null;
    const P = flat[k].positions, I = flat[k].indices;
    const corner = new Uint8Array(P.length / 3);
    for (let v = 0; v < corner.length; v++) if (over[k].some((covers) => covers([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]))) corner[v] = 1;
    const out = new Uint8Array(I.length / 3);
    for (let t = 0; t < out.length; t++) out[t] = corner[I[t * 3]] | corner[I[t * 3 + 1]] | corner[I[t * 3 + 2]];
    return out;
  });
  let posedFor = null, meshes = null;
  const at = (joints, yaw, pitch, options = {}) => {
    if (posedFor !== joints) ((meshes = layers.map((layer, k) => ({ ...skinned(body, layer.model, joints), hidden: hiddenOf[k], id: k }))), (posedFor = joints));
    const view = look(meshes, { yaw, pitch, pxPerMetre, where: true, ...options });
    const marks = new Uint8Array(view.id.length);
    let holes = 0, shown = 0;
    for (let o = 0; o < view.id.length; o++) {
      const k = view.id[o];
      if (k < 0) continue;
      if (view.back[o]) {
        holes++;
        marks[o] = 1;
        continue;
      }
      const t = view.triangle[o];
      if (!suspect[k] || !suspect[k][t]) continue;
      const P = flat[k].positions, I = flat[k].indices;
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3, w0 = view.bary[o * 2], w1 = view.bary[o * 2 + 1], w2 = 1 - w0 - w1;
      const p = [P[a] * w0 + P[b] * w1 + P[c] * w2, P[a + 1] * w0 + P[b + 1] * w1 + P[c + 1] * w2, P[a + 2] * w0 + P[b + 2] * w1 + P[c + 2] * w2];
      if (over[k].some((covers) => covers(p))) (shown++, (marks[o] = 2));
    }
    return { view, holes, shown, marks };
  };
  return { at, pxPerMetre };
}

export function lookCheck(body, layers, poses, { pxPerMetre = 300, views = VIEWS, rest = true } = {}) {
  const figure = dressed(body, layers, poses, { pxPerMetre });
  const area = 1e4 / (pxPerMetre * pxPerMetre);
  const result = { views: 0, holes: { mean: 0, worst: 0, at: null }, shown: { mean: 0, worst: 0, at: null } };
  const frames = [...(rest ? [{ clip: 'rest', frame: 0, joints: poses.rest }] : []), ...poses.list];
  for (const pose of frames)
    for (const [yaw, pitch] of views) {
      const seen = figure.at(pose.joints, yaw, pitch);
      result.views++;
      for (const key of ['holes', 'shown']) {
        result[key].mean += seen[key] * area;
        if (seen[key] * area > result[key].worst) ((result[key].worst = seen[key] * area), (result[key].at = { clip: pose.clip, frame: pose.frame, yaw, pitch }));
      }
    }
  for (const key of ['holes', 'shown']) ((result[key].mean = +(result[key].mean / result.views).toFixed(3)), (result[key].worst = +result[key].worst.toFixed(2)));
  return result;
}
