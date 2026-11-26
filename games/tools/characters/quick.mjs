// A quick look at a hero while its shapes and clips are being worked on: the same definition
// meshed at a coarse cell, coloured per vertex by its surface (no bake), skinned as the textured
// build skins it, with its clips. Not a deliverable.
import { createZhudaIsosurfaceMesh } from 'zhuda-laya-engine';
import { fastField } from './fast-field.mjs';
import { ownerOf } from './owner.mjs';
import { sampleClips, skinner } from './kit.mjs';
import { writeRiggedGlb } from './rig-glb.mjs';

export function quickGlb(def, { cell = 0.008 } = {}) {
  const joints = def.joints;
  const index = new Map(joints.map((j, i) => [j.name, i]));
  for (const s of def.shapes) if (!index.has(s.bone)) throw Error(`${def.id}: unknown joint ${s.bone}`);
  const field = fastField(def.shapes, { reach: cell * 6 });
  const pad = cell * 3;
  const mesh = createZhudaIsosurfaceMesh({ distance: field.distance, min: field.bounds.min.map((v) => v - pad), max: field.bounds.max.map((v) => v + pad), cellSize: cell, project: 3, maxVertices: 4000000 });
  const idx = Uint32Array.from(mesh.indices);
  for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  const nv = mesh.positions.length / 3;
  // An avatar (`materials`) is cut into materials by the shape a point lies on, as the textured build does.
  const owner = def.materials ? ownerOf(def.shapes) : null;
  const grouped = def.shapes.some((s) => s.rigid || s.skinGroup);
  const skinOf = skinner(def, grouped ? def.shapes.filter((s) => !s.rigid && !s.skinGroup) : def.shapes, index);
  const colors = new Float32Array(nv * 4),
    J = new Uint8Array(nv * 4),
    Wt = new Float32Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    const p = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
    const n = [mesh.normals[v * 3], mesh.normals[v * 3 + 1], mesh.normals[v * 3 + 2]];
    const shape = def.shapes[owner ? owner(p[0], p[1], p[2]) : field.nearest(p[0], p[1], p[2])];
    const surf = def.surface(p, n, shape, { h: 0, curvature: 0, occlusion: 1, base: n });
    let c = surf.emission && surf.emission.some((x) => x > 0) ? surf.emission : surf.color;
    // An avatar's `quickTint` ({ hair, outfit }: display colours) shows which parts are which material.
    if (def.quickTint?.[shape.material]) c = c.map((v, i) => v * def.quickTint[shape.material][i]);
    colors.set([c[0], c[1], c[2], 1], v * 4);
    const s = shape.rigid ? [{ joint: index.get(shape.bone), w: 1 }] : skinOf(p);
    s.forEach((x, k) => {
      J[v * 4 + k] = x.joint;
      Wt[v * 4 + k] = x.w;
    });
  }
  const animations = sampleClips(def, joints);
  const glb = writeRiggedGlb({
    name: def.id,
    joints: joints.map((j) => ({ name: j.name, parent: j.parent ? index.get(j.parent) : -1, position: j.at })),
    primitives: [{ positions: mesh.positions, normals: mesh.normals, colors, joints: J, weights: Wt, indices: idx, material: 0 }],
    materials: [{ name: def.id, color: [1, 1, 1, 1], roughness: 0.7, metallic: 0 }],
    animations,
  });
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < nv; v++)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], mesh.positions[v * 3 + a]);
      hi[a] = Math.max(hi[a], mesh.positions[v * 3 + a]);
    }
  return { glb, stats: { triangles: idx.length / 3, joints: joints.length, size: hi.map((v, a) => +(v - lo[a]).toFixed(2)), min: lo } };
}
