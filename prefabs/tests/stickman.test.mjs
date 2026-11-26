// 囂張小黑人：讀回 assets/stickman.glb，檢查 需求者 的三個要求（低模 3000 面以內、兩段 idle、能 crossfade）、烘焙的貼圖，
// 以及 stickman.ts 的常數、fadeShare、StickmanIdles 自動輪播。不需要瀏覽器。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { STICKMAN, STICKMAN_CLIPS, StickmanIdles, fadeShare, repairGltfCrossFade, stickmanPath } = await import('../3d/stickman/stickman.ts');

const bytes = fs.readFileSync(new URL('../3d/stickman/assets/stickman.glb', import.meta.url));
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const jsonLength = view.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
const binStart = 20 + jsonLength + 8;
/** An accessor's numbers (float, or unsigned for indices). */
function read(index) {
  const a = gltf.accessors[index], bv = gltf.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type] * a.count;
  const at = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  return new T(bytes.buffer.slice(bytes.byteOffset + at, bytes.byteOffset + at + n * T.BYTES_PER_ELEMENT));
}
const report = JSON.parse(fs.readFileSync(new URL('../3d/stickman/source/build-report.json', import.meta.url), 'utf8'));

test('one skinned mesh, one primitive, one material: one draw call, with baked colour, normal and occlusion maps', () => {
  assert.equal(gltf.meshes.length, 1);
  assert.equal(gltf.meshes[0].primitives.length, 1);
  assert.equal(gltf.materials.length, 1);
  assert.equal(gltf.skins.length, 1);
  const m = gltf.materials[0], pbr = m.pbrMetallicRoughness;
  // Three images on the one UV set (LayaAir 3.4.2's glTF reader takes texCoord 0 only).
  assert.deepEqual(gltf.images.map((i) => i.name), ['stickman-basecolor', 'stickman-normal', 'stickman-occlusion']);
  assert.equal(pbr.baseColorTexture.index, 0);
  assert.equal(m.normalTexture.index, 1);
  assert.equal(m.occlusionTexture.index, 2);
  for (const t of [pbr.baseColorTexture, m.normalTexture, m.occlusionTexture]) assert.ok(!t.texCoord, 'texCoord 0');
  // Soft matte vinyl like the turnaround: a faint sheen only (0.45 was too shiny for the user).
  assert.ok(pbr.roughnessFactor >= 0.6 && pbr.roughnessFactor <= 0.85, `roughness ${pbr.roughnessFactor}`);
  // Linear with mipmaps, clamped: the charts sit 8 texels apart with their edges carried into the gaps.
  assert.deepEqual(gltf.samplers[0], { magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 });
  const attrs = Object.keys(gltf.meshes[0].primitives[0].attributes).sort();
  assert.deepEqual(attrs, ['JOINTS_0', 'NORMAL', 'POSITION', 'TANGENT', 'TEXCOORD_0', 'WEIGHTS_0']);
});

test('the bake: UVs inside the image, unit tangents with a handedness, no chart overlapping another', () => {
  const prim = gltf.meshes[0].primitives[0];
  const uv = read(prim.attributes.TEXCOORD_0), tan = read(prim.attributes.TANGENT), nrm = read(prim.attributes.NORMAL);
  for (const v of uv) assert.ok(v >= 0 && v <= 1, `uv ${v}`);
  for (let i = 0; i < tan.length; i += 4) {
    assert.ok(Math.abs(Math.hypot(tan[i], tan[i + 1], tan[i + 2]) - 1) < 1e-3, `tangent ${i / 4}`);
    assert.ok(tan[i + 3] === 1 || tan[i + 3] === -1, 'w is ±1');
    const n = (i / 4) * 3;
    assert.ok(Math.abs(tan[i] * nrm[n] + tan[i + 1] * nrm[n + 1] + tan[i + 2] * nrm[n + 2]) < 1e-3, 'tangent ⟂ normal');
  }
  assert.equal(report.textures.overlapTexels, 0);
  assert.equal(report.textures.size, 512);
  assert.ok(report.textures.steepestNormalDeg <= 80.5);
});

test('at most 3000 triangles, and the numbers in stickman.ts and the build report are the file’s', () => {
  const prim = gltf.meshes[0].primitives[0];
  const triangles = gltf.accessors[prim.indices].count / 3;
  assert.ok(triangles <= 3000, `${triangles} triangles`);
  assert.equal(triangles, STICKMAN.triangles);
  assert.equal(triangles, report.triangles);
  const pos = gltf.accessors[prim.attributes.POSITION];
  assert.ok(pos.min[1] >= -0.001 && pos.min[1] < 0.01, 'the soles are on y = 0');
  assert.ok(Math.abs(pos.max[1] - pos.min[1] - STICKMAN.heightM) < 0.002, 'heightM');
  assert.equal(gltf.skins[0].joints.length, STICKMAN.joints);
  assert.ok(STICKMAN.joints <= 24);
  // Weights add up to one on every vertex.
  const w = read(prim.attributes.WEIGHTS_0);
  for (let v = 0; v < w.length; v += 4) assert.ok(Math.abs(w[v] + w[v + 1] + w[v + 2] + w[v + 3] - 1) < 1e-4, `vertex ${v / 4}`);
  assert.equal(stickmanPath(), 'common/3d/stickman/assets/stickman.glb');
});

test('two idles with the names and lengths stickman.ts gives', () => {
  assert.deepEqual(gltf.animations.map((a) => a.name), [...STICKMAN_CLIPS]);
  for (const a of gltf.animations) {
    const times = read(a.samplers[0].input);
    assert.equal(times[0], 0);
    assert.ok(Math.abs(times.at(-1) - STICKMAN.clipSeconds[a.name]) < 1e-5, a.name);
  }
});

test('crossfade-safe: every clip turns every joint and moves the root, so a fade never leaves a bone behind', () => {
  const joints = gltf.skins[0].joints;
  const channelsOf = (a) => a.channels.map((c) => `${gltf.nodes[c.target.node].name}.${c.target.path}`).sort();
  const want = [...joints.map((n) => `${gltf.nodes[n].name}.rotation`), `${gltf.nodes[joints[0]].name}.translation`].sort();
  for (const a of gltf.animations) assert.deepEqual(channelsOf(a), want, a.name);
});

test('each idle loops: its last frame is its first, and it moves (the bones are not still)', () => {
  for (const a of gltf.animations) {
    let moved = 0;
    for (const s of a.samplers) {
      const v = read(s.output);
      const n = gltf.accessors[s.output].type === 'VEC4' ? 4 : 3;
      for (let k = 0; k < n; k++) assert.ok(Math.abs(v[k] - v[v.length - n + k]) < 1e-5, `${a.name}: seam`);
      for (let i = n; i < v.length; i += n) moved = Math.max(moved, Math.abs(v[i] - v[0]), Math.abs(v[i + 1] - v[1]));
    }
    assert.ok(moved > 0.02, `${a.name} moves`);
  }
});

test('the feet stay where they are in both idles (only the right toes lift when it taps)', () => {
  for (const name of STICKMAN_CLIPS) {
    const r = report.clips[name];
    assert.ok(r.leftAnkleDriftMm < 0.5, `${name} left ankle ${r.leftAnkleDriftMm} mm`);
    assert.ok(r.rightHeelDriftMm < 0.5, `${name} right heel ${r.rightHeelDriftMm} mm`);
  }
  assert.ok(report.clips.Idle_HandsOnHips.rightAnkleMovesMm < 0.5);
  assert.ok(report.clips.Idle_ArmsCrossed.rightAnkleMovesMm > 10, 'the tap lifts the toes');
});

test('fadeShare turns seconds into the share of the playing clip LayaAir wants', () => {
  assert.equal(fadeShare(0.4, 4), 0.1);
  assert.equal(fadeShare(0.35, 3.2), 0.35 / 3.2);
  assert.equal(fadeShare(10, 4), 1);
  assert.equal(fadeShare(0.3, 0), 0);
});

test('StickmanIdles plays the first idle, then fades to the other after whole loops, and hold() stops it', () => {
  const calls = [];
  const idles = new StickmanIdles((clip, fade) => calls.push([clip, fade]), { loops: [2, 2], random: () => 0.5 });
  assert.deepEqual(calls, [['Idle_HandsOnHips', 0]]);
  for (let i = 0; i < 7.9 * 60; i++) idles.update(1 / 60);
  assert.equal(calls.length, 1, 'not before two loops of 4 s');
  for (let i = 0; i < 0.2 * 60; i++) idles.update(1 / 60);
  assert.deepEqual(calls[1], ['Idle_ArmsCrossed', 0.35]);
  for (let i = 0; i < 6.5 * 60; i++) idles.update(1 / 60);
  assert.deepEqual(calls[2], ['Idle_HandsOnHips', 0.35], 'two loops of 3.2 s');
  idles.hold('Idle_ArmsCrossed');
  assert.deepEqual(calls[3], ['Idle_ArmsCrossed', 0.35]);
  for (let i = 0; i < 30 * 60; i++) idles.update(1 / 60);
  assert.equal(calls.length, 4, 'held');
  idles.hold('Idle_ArmsCrossed');
  assert.equal(calls.length, 4, 'holding the clip that plays does not restart it');
  assert.throws(() => new StickmanIdles(() => {}, { loops: [3, 2] }));
});

test('repairGltfCrossFade puts nodes back into the clip dictionaries LayaAir 3.4.2’s glTF reader fills with strings', () => {
  // What laya.gltf.js builds: _nodesDic[fullPath] = fullPath. Animator.crossFade reads _nodesDic[path]._indexInList.
  const clipOf = (paths) => {
    const nodes = paths.map((fullPath, i) => ({ fullPath, _indexInList: i }));
    return { _nodes: { count: nodes.length, getNodeByIndex: (i) => nodes[i] }, _nodesDic: Object.fromEntries(paths.map((p) => [p, p])), nodes };
  };
  const a = clipOf(['root.transform.localRotation', 'root/hips.transform.localRotation']);
  const b = clipOf(['root.transform.localRotation', 'root/hips.transform.localRotation']);
  const lani = clipOf(['x.transform.localPosition']);
  lani._nodesDic['x.transform.localPosition'] = lani.nodes[0]; // a .lani clip is already right
  const animator = { controllerLayerCount: 1, getControllerLayer: () => ({ states: [{ clip: a }, { clip: b }, { clip: lani }, { clip: null }] }) };
  assert.equal(repairGltfCrossFade(animator), 2);
  for (const c of [a, b]) for (const n of c.nodes) assert.equal(c._nodesDic[n.fullPath]._indexInList, n._indexInList);
  assert.equal(repairGltfCrossFade(animator), 0, 'a second call changes nothing');
});
