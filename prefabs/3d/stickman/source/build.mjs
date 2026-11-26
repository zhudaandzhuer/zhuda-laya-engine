// 做出 assets/stickman.glb，並寫 source/build-report.json（面數、骨頭、動作、腳有沒有滑）。
//
//   node 3d/stickman/source/build.mjs                 （在 prefabs/ 底下跑，約 10 秒）
//   node 3d/stickman/source/build.mjs --preview <dir> 另外用軟體算圖畫幾張檢查用的圖（不經瀏覽器）
//
// 一個網格、一個材質（一張 32×32 色票貼圖，NEAREST 取樣）、一副 20 根骨頭的骨架、兩段 idle。
// 每段動作都寫滿 20 根骨頭的轉動和根骨頭的位移，所以兩段之間 crossfade 時不會有骨頭被漏掉。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';
import { PNG } from 'pngjs';
import { createZhudaSdfField } from 'zhuda-laya-engine';
import { Q, add, bare, cross, dot, meshOf, mul, norm, skinner, sub } from '../../../../games/tools/characters/kit.mjs';
import { relaxOnSurface, surfaceError } from './surface.mjs';
import { bakeMaps, tangentsOf, unwrap } from './bake.mjs';
import { buildBvh, loadMeshSource, sampleTexture, weld } from './mesh-source.mjs';
import { writeRiggedGlb } from '../../../../games/tools/characters/rig-glb.mjs';
import { look, pngBytes, sheet, writePng } from '../../../../games/tools/characters/raster.mjs';
import { BODY_SHAPES, BUDGET, CELL, CHAIN_LEAD, CLIPS, COLOURS, EYE, FACE_MASK, FEET, FINGER_SHAPES, HAND_SHAPES, HEAD, HEAD_SHAPES, HEEL, MOUTH, RIG, ROUGHNESS, SKIN } from './stickman-def.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 試材質用：STICKMAN_OUT=<別的檔> STICKMAN_ROUGHNESS=0.45 STICKMAN_BODY=#333338 寫到別的地方（不寫報告、不動 assets/）。
const OUT = process.env.STICKMAN_OUT ?? path.join(HERE, '..', 'assets', 'stickman.glb');
const TRIAL = !!process.env.STICKMAN_OUT;
// 試驗：STICKMAN_SOURCE=<別人的高模 .glb>（例如騰訊混元 3D 生成的）。身體（含頭、手）改用那個高模減面的結果，
// 骨架、蒙皮規則、兩段動作照舊；法線和底色從那個高模烘（它的臉畫在底色貼圖裡），不另外放我們的正圓頭和臉。
const SOURCE = process.env.STICKMAN_SOURCE ? path.resolve(process.env.STICKMAN_SOURCE) : null;
// STICKMAN_SOURCE_KEEP=1：高模不減面、不烘焙，直接用它自己的網格、UV、底色和法線貼圖（縮成 STICKMAN_TEX 邊長），只補切線、綁骨架。
// 用來做近看的高清版（面數會超過 3000）。
const KEEP = !!SOURCE && process.env.STICKMAN_SOURCE_KEEP === '1';
if (process.env.STICKMAN_BODY) COLOURS.body = process.env.STICKMAN_BODY;
const ROUGH = process.env.STICKMAN_ROUGHNESS ? Number(process.env.STICKMAN_ROUGHNESS) : ROUGHNESS;
const REPORT = path.join(HERE, 'build-report.json');
const previewDir = process.argv.includes('--preview') ? process.argv[process.argv.indexOf('--preview') + 1] : null;
const started = Date.now();
await MeshoptSimplifier.ready;

const joints = RIG.joints;
const index = new Map(joints.map((j, i) => [j.name, i]));
const def = { skin: SKIN, cell: CELL.body };

// ------------------------------------------------------------------ 色票
const PALETTE = ['body', 'eye', 'mouth'];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const paletteImage = (() => {
  const size = 32, block = 8;
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const slot = Math.floor(y / block) * 4 + Math.floor(x / block);
      const c = hex(COLOURS[PALETTE[slot]] ?? COLOURS.body);
      rgba.set([...c, 255], (y * size + x) * 4);
    }
  return pngBytes(size, size, rgba);
})();
const uvOf = (name) => {
  const slot = PALETTE.indexOf(name);
  return [((slot % 4) * 8 + 4) / 32, (Math.floor(slot / 4) * 8 + 4) / 32];
};

// ------------------------------------------------------------------ 網格：身體、頭
/**
 * 等值面 → 減面到預算。`region`（可省）：某一區（手）固定給 `region.budget` 個三角形——分兩段減：
 * 先鎖住那一區、只減其他地方，再鎖住其他地方、只減那一區。一段減完的話，簡化器會先把細小的指縫、指尖減掉
 * （加權也留不住：試過手附近法線權重放大 6 倍，四根指頭還是被減成一團）。
 */
function simplified(shapes, cell, budget, region) {
  return simplifiedMesh(meshOf(shapes, cell), budget, region);
}
function simplifiedMesh(mesh, budget, region) {
  const full = mesh.indices.length / 3;
  const run = (indices, target, lock, error, weight = 0.02) =>
    MeshoptSimplifier.simplifyWithAttributes(indices, mesh.positions, 3, mesh.normals, 3, [weight, weight, weight], lock, target * 3, error, ['Regularize']);
  let idx, err;
  if (region) {
    const nv = mesh.positions.length / 3, inside = new Uint8Array(nv);
    for (let v = 0; v < nv; v++) inside[v] = region.test([mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]]) ? 1 : 0;
    const touching = (ix) => {
      let n = 0;
      for (let t = 0; t < ix.length; t += 3) if (inside[ix[t]] || inside[ix[t + 1]] || inside[ix[t + 2]]) n++;
      return n;
    };
    // 第一段：鎖住手，只減身體。手邊緣的三角形也會被減（沒鎖的那個頂點併到手上），所以量實際剩多少、不夠再減。
    const bodyBudget = budget - region.budget;
    let target = bodyBudget + touching(mesh.indices), rest, e1;
    for (let tries = 0; tries < 6; tries++) {
      [rest, e1] = run(mesh.indices, target, inside, 0.05);
      const over = rest.length / 3 - touching(rest) - bodyBudget;
      if (over <= 0) break;
      target -= over;
    }
    // 第二段：鎖住身體，只減手。法線權重放大到 2：簡化器把三角形留在彎曲大的地方（指尖、指縫），四根指頭才分得開。
    const [both, e2] = run(rest, budget, inside.map((x) => 1 - x), 0.2, 2);
    (idx = both), (err = Math.max(e1, e2));
    region.triangles = touching(idx);
  } else [idx, err] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, budget * 3, 0.05, ['Regularize']);
  if (idx.length > budget * 3) [idx, err] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, budget * 3, 0.2, ['Regularize', 'Permissive']);
  const errorMm = +(err * MeshoptSimplifier.getScale(mesh.positions, 3) * 1000).toFixed(2);
  const remap = new Map();
  for (const v of idx) if (!remap.has(v)) remap.set(v, remap.size);
  const positions = new Float32Array(remap.size * 3), normals = new Float32Array(remap.size * 3);
  for (const [v, i] of remap) {
    positions.set(mesh.positions.subarray(v * 3, v * 3 + 3), i * 3);
    normals.set(mesh.normals.subarray(v * 3, v * 3 + 3), i * 3);
  }
  return { positions, normals, indices: Uint32Array.from(idx, (v) => remap.get(v)), full, errorMm };
}
// 身體（含手）：一整張連續表面。手是手套手（沒有細手指），放進同一張表面就沒有手腕的交會線（兩個網格插在一起，
// 低面數下交會線會變成鋸齒）。腳底削平的那個 subtract 形狀要留在最後。
const ALL_SHAPES = [...BODY_SHAPES.filter((x) => !x.subtract), ...HAND_SHAPES.L, ...HAND_SHAPES.R, ...BODY_SHAPES.filter((x) => x.subtract)];
const bodyField = createZhudaSdfField(ALL_SHAPES.map(bare));
// 各部位自己的距離場：射線只走到自己的表面＋1.2 cm（圓角在這之內），再遠就是別的部位。
const fieldOfBones = (test) => createZhudaSdfField(ALL_SHAPES.filter((x) => !x.subtract && test(x.bone)).map(bare));
const OWN = {
  torso: fieldOfBones((b) => ['neck', 'chest', 'spine', 'hips'].includes(b)),
  arm: { L: fieldOfBones((b) => b === 'armL' || b === 'foreL'), R: fieldOfBones((b) => b === 'armR' || b === 'foreR') },
  leg: { L: fieldOfBones((b) => b === 'thighL' || b === 'shinL'), R: fieldOfBones((b) => b === 'thighR' || b === 'shinR') },
  foot: { L: fieldOfBones((b) => b === 'footL'), R: fieldOfBones((b) => b === 'footR') },
  hand: { L: fieldOfBones((b) => b === 'handL'), R: fieldOfBones((b) => b === 'handR') },
};
const P = RIG.P;
const flipX = (v) => [-v[0], v[1], v[2]];
const sideOf = (s, v) => (s === 'L' ? v : flipX(v));
const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// 一整張連續的表面（接合處的圓角天生平順）：等值面 → 減面到預算 → 表面鬆弛（頂點沿表面往鄰居中間移、再貼回表面，
// 三角形變得大小均勻；不鬆弛的話細手細腳一圈有時 5 邊、有時 7 邊，輪廓一段一段不平）。
// 頭的範圍（高模來源時，這裡的頂點整塊跟著頭骨走）。
const inHead = (p) => Math.hypot(p[0] - HEAD.centre[0], p[1] - HEAD.centre[1], p[2] - HEAD.centre[2]) < HEAD.radii[0] + 0.02 && p[1] > HEAD.centre[1] - HEAD.radii[0] + 0.03;
const source = SOURCE ? loadMeshSource(SOURCE, { height: HEAD.centre[1] + HEAD.radii[0] }) : null;
const surface = KEEP
  ? { positions: source.positions, normals: source.normals, indices: source.indices, full: source.indices.length / 3, errorMm: 0 }
  : source
  ? (() => {
      // 高模：同位置的頂點併起來（UV 接縫），手固定給 BUDGET.hands 個三角形，整個（含頭）減到我們的頭＋身體＋臉的總數。
      const w = weld(source.positions, source.normals, source.indices);
      const hands = { test: (p) => Math.abs(p[0]) > 0.19 && p[1] < 0.56, budget: BUDGET.hands };
      const m = simplifiedMesh(w, BUDGET.body + BUDGET.head, hands);
      m.handTriangles = hands.triangles;
      // 頭照使用者的要求是正圓：頭部範圍的頂點投到我們的正圓球上（高模把眼睛、嘴刻進了幾何，減面後變成臉上的坑）；
      // 眼睛、嘴的樣子由烘焙的底色和法線貼圖來畫。
      const c = HEAD.centre, r = HEAD.radii[0];
      for (let v = 0; v < m.positions.length / 3; v++) {
        const p = [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]];
        if (!inHead(p)) continue;
        const d = norm(sub(p, c));
        m.positions.set(add(c, mul(d, r)), v * 3);
        m.normals.set(d, v * 3);
      }
      return m;
    })()
  : (() => {
  // 手：固定給 BUDGET.hands 個三角形（兩隻），其餘給身體；手的範圍是手的形狀表面 4 mm 以內（含手腕那一小段）。
  const handField = createZhudaSdfField([...HAND_SHAPES.L, ...HAND_SHAPES.R].map(bare));
  const hands = { test: (p) => handField.distance(...p) < 0.004, budget: BUDGET.hands };
  const m = simplified(ALL_SHAPES, CELL.body, BUDGET.body, hands);
  m.handTriangles = hands.triangles;
  // 只有手指不鬆弛（指縫的頂點一鬆弛就滑過去，四根指頭黏成一團）；手掌、手腕照常鬆弛，
  // 不然手腕會出現一圈台階（一邊鬆弛過、一邊沒有，頂點錯開）。
  const fingerField = createZhudaSdfField([...FINGER_SHAPES.L, ...FINGER_SHAPES.R].map(bare));
  return { ...m, ...relaxOnSurface(bodyField, m.positions, m.indices, { iterations: BUDGET.relax, fixed: (p) => fingerField.distance(...p) < 0.003 }) };
})();
/** 測地線球：二十面體每個面切成 f×f 個小三角形、投到球面上；三角形大小一致，法線就是球的法線。 */
function geodesicSphere(centre, r, f) {
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  const FACES = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const pos = [], keys = new Map(), idx = [];
  const vert = (p) => {
    const n = norm(p), key = n.map((v) => Math.round(v * 1e6)).join(',');
    if (!keys.has(key)) (keys.set(key, pos.length / 3), pos.push(...n));
    return keys.get(key);
  };
  for (const [a, bb, c] of FACES) {
    const A = V[a], B = V[bb], Cc = V[c];
    const at = (i, j) => vert(add(add(A, mul(sub(B, A), i / f)), mul(sub(Cc, A), j / f)));
    for (let i = 0; i < f; i++)
      for (let j = 0; j < f - i; j++) {
        idx.push(at(i, j), at(i + 1, j), at(i, j + 1));
        if (i + j < f - 1) idx.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
      }
  }
  // 朝外逆時針（glTF 的正面）。
  for (let k = 0; k < idx.length; k += 3) {
    const [p0, p1, p2] = [0, 1, 2].map((m) => pos.slice(idx[k + m] * 3, idx[k + m] * 3 + 3));
    const n = cross(sub(p1, p0), sub(p2, p0));
    if (dot(n, add(add(p0, p1), p2)) < 0) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  }
  const normals = Float32Array.from(pos);
  const positions = Float32Array.from(pos.map((v, i) => centre[i % 3] + v * r));
  return { positions, normals, indices: Uint32Array.from(idx), full: idx.length / 3 };
}
if (HEAD.radii.some((v) => v !== HEAD.radii[0])) throw Error('the head is a sphere: give one radius');
const head = geodesicSphere(HEAD.centre, HEAD.radii[0], HEAD.geodesic);
if (head.indices.length / 3 !== BUDGET.head) throw Error(`head: ${head.indices.length / 3} triangles, budget ${BUDGET.head}`);

// ------------------------------------------------------------------ 臉
const LIFT = 0.0025; // 臉浮在頭的真實表面外 2.5 mm（測地線球 f=5 的三角形中心在真實表面內最多約 2 mm）
// 正面正交投影：臉上一點 (x, y) 落在頭的橢球正前方那一面。
function onHead(x, y) {
  const c = HEAD.centre, [a, b, cz] = HEAD.radii;
  const p = [x, y, cz * Math.sqrt(Math.max(0, 1 - (x / a) ** 2 - (y / b) ** 2))];
  const n = norm([p[0] / a ** 2, p[1] / b ** 2, p[2] / cz ** 2]);
  return { p: add(add(c, p), mul(n, LIFT)), n };
}
/** 沿折線等距取 n 點（含頭尾）。 */
function resample(chain, n) {
  const seg = chain.slice(1).map((p, i) => Math.hypot(p[0] - chain[i][0], p[1] - chain[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out = [];
  for (let k = 0; k < n; k++) {
    let want = (total * k) / (n - 1), i = 0;
    while (i < seg.length - 1 && want > seg[i]) (want -= seg[i]), i++;
    const t = seg[i] ? Math.min(1, want / seg[i]) : 0;
    out.push([chain[i][0] + (chain[i + 1][0] - chain[i][0]) * t, chain[i][1] + (chain[i + 1][1] - chain[i][1]) * t]);
  }
  return out;
}
/** 左眼的輪廓（逆時針，正面看）：橢圓被斜線切掉上半；兩個切角保留成尖角。 */
function eyeOutline() {
  const { centre: [ex, ey], radii: [rx, ry], cut, points } = EYE;
  const line = (x) => ey + cut.y + cut.slope * (x - ex);
  const ring = Array.from({ length: 96 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 96 - Math.PI / 2; // 從最下面開始
    return [ex + rx * Math.cos(a), ey + ry * Math.sin(a)];
  });
  const f = ([x, y]) => line(x) - y; // >= 0：留下
  // 從最下面沿逆時針走到第一個切點，經切線回到第二個切點，再走回最下面。
  const arc = [];
  let corners = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) arc.push(a);
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      arc.push(p);
      corners.push(arc.length - 1);
    }
  }
  if (corners.length !== 2) throw Error('eye: the cut must cross the ellipse twice');
  // arc[corners[0]] 是外側（右邊）切點、arc[corners[1]] 是內側切點；中間沒有點（被切掉了）。
  const outer = arc[corners[0]], inner = arc[corners[1]];
  const curve = [...arc.slice(corners[1]), ...arc.slice(0, corners[0] + 1)]; // 內側切點 → 底 → 外側切點
  const lineN = Math.max(3, Math.round(points * 0.3)), curveN = points - lineN + 2;
  const a = resample(curve, curveN), b = resample([outer, inner], lineN);
  return [...a, ...b.slice(1, -1)];
}
function fan(outline, uv, flipX) {
  const pts = flipX ? outline.map(([x, y]) => [-x, y]).reverse() : outline;
  const n = pts.length;
  const c = pts.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
  const rings = [[c], pts.map((p) => [c[0] + (p[0] - c[0]) * 0.55, c[1] + (p[1] - c[1]) * 0.55]), pts];
  const verts = rings.flat().map(([x, y]) => onHead(x, y));
  const tri = [];
  const inner = (i) => 1 + (i % n), outer = (i) => 1 + n + (i % n);
  for (let i = 0; i < n; i++) tri.push(0, inner(i), inner(i + 1), inner(i), outer(i), outer(i + 1), inner(i), outer(i + 1), inner(i + 1));
  return { verts, tri, uv };
}
function mouth() {
  const { from, to, y, curve, tilt, thick, columns: m } = MOUTH;
  const xm = (from + to) / 2;
  const centre = (x) => y + curve * (x - xm) ** 2 + tilt * (x - xm);
  const pts = [[from, centre(from)]];
  for (let i = 1; i < m; i++) {
    const x = from + ((to - from) * i) / m, u = i / m, th = thick * Math.sin(Math.PI * u) ** 0.7;
    const c = centre(x);
    pts.push([x, c - 0.7 * th], [x, c], [x, c + 0.3 * th]); // 下、中、上
  }
  pts.push([to, centre(to)]);
  const L = (i) => 1 + (i - 1) * 3, M = (i) => L(i) + 1, U = (i) => L(i) + 2, END = pts.length - 1;
  const tri = [0, L(1), M(1), 0, M(1), U(1)];
  for (let i = 1; i < m - 1; i++) tri.push(L(i), L(i + 1), M(i + 1), L(i), M(i + 1), M(i), M(i), M(i + 1), U(i + 1), M(i), U(i + 1), U(i));
  tri.push(L(m - 1), END, M(m - 1), M(m - 1), END, U(m - 1));
  return { verts: pts.map(([x, yy]) => onHead(x, yy)), tri, uv: uvOf('mouth') };
}
const eye = eyeOutline();
const faceParts = [fan(eye, uvOf('eye'), false), fan(eye, uvOf('eye'), true), mouth()];

// ------------------------------------------------------------------ 合成一個網格：位置、法線、色票 UV、蒙皮
// 手：手腕那一段跟著前臂轉一點，其餘跟著手。
const skinHand = (s) => skinner({ ...def, skin: 0.015 }, [...BODY_SHAPES.filter((x) => x.bone === 'fore' + s), ...HAND_SHAPES[s]], index);
const HEAD_J = index.get('head');
const pos = [], nor = [], uvs = [], J = [], Wt = [], tris = [], partOf = [];
const counts = {};
function addPart(name, verts, indices, uv, skinOf) {
  // skinOf(位置, 頂點)：環狀網格的頂點帶著它在部位上的位置（s：沿著關節串的距離）。
  const base = pos.length / 3;
  for (const v of verts) {
    pos.push(...v.p);
    partOf.push(name);
    nor.push(...v.n);
    uvs.push(...uv);
    const s = skinOf(v.p, v);
    for (let k = 0; k < 4; k++) J.push(s[k]?.joint ?? 0), Wt.push(s[k]?.w ?? 0);
  }
  for (const i of indices) tris.push(base + i);
  counts[name] = (counts[name] ?? 0) + indices.length / 3;
}
const asVerts = (m) => Array.from({ length: m.positions.length / 3 }, (_, i) => ({ p: [...m.positions.subarray(i * 3, i * 3 + 3)], n: [...m.normals.subarray(i * 3, i * 3 + 3)] }));
const rigidHead = () => [{ joint: HEAD_J, w: 1 }];
// 分部位蒙皮：身體只跟脊椎那幾根，手臂只跟手臂的骨頭（腰才不會被前臂拉出一個包），腿只跟腿。
const J_ = (n) => index.get(n);
const mixW = (list) => {
  const sum = new Map();
  for (const [n, w] of list) if (w > 1e-4) sum.set(J_(n), (sum.get(J_(n)) ?? 0) + w);
  const top = [...sum].map(([joint, w]) => ({ joint, w })).sort((a, b) => b.w - a.w).slice(0, 4);
  const t = top.reduce((a, x) => a + x.w, 0);
  return top.map((x) => ({ joint: x.joint, w: x.w / t }));
};
const SPINE = [['hips', P.hips[1]], ['spine', P.spine[1]], ['chest', P.chest[1]], ['neck', P.neck[1]], ['head', P.head[1] + 0.04]];
const skinTorso = (p) => {
  const y = p[1];
  if (y <= SPINE[0][1]) return mixW([[SPINE[0][0], 1]]);
  for (let i = 0; i + 1 < SPINE.length; i++)
    if (y <= SPINE[i + 1][1]) {
      const t = smooth01((y - SPINE[i][1]) / (SPINE[i + 1][1] - SPINE[i][1]));
      return mixW([[SPINE[i][0], 1 - t], [SPINE[i + 1][0], t]]);
    }
  return mixW([['head', 1]]);
};
/** 一串關節的蒙皮：起點那段混一點上一根（clav／hips），關節前後 `band` 公尺內兩根平滑交接。 */
const skinChain = (names, lens, rootName, { band = 0.03, rootWeight = 0.45, rootFade = [0.5, 2] } = {}) => (p, v) => {
  const s = v.s;
  const root = lens[0], joint = root + lens[1];
  const w = [];
  const k = smooth01((s - (joint - band)) / (2 * band));
  // 根部：rootWeight 的權重給上一根（手臂給 clav、腿給 hips），在 root×rootFade[0] 到 root×rootFade[1] 之間淡掉。
  const r = rootWeight * (1 - smooth01((s - root * rootFade[0]) / (root * (rootFade[1] - rootFade[0]))));
  w.push([names[0], (1 - k) * (1 - r)], [names[1], k * (1 - r)]);
  if (r > 0) w.push([rootName, r]);
  return mixW(w);
};
const skinFoot = (s) => (p) => {
  const k = 0.7 * smooth01((p[1] - (P.ankle[1] - 0.005)) / 0.035);
  return mixW([['foot' + s, 1 - k], ['shin' + s, k]]);
};
/** 一點在一串關節上的位置（離起點多遠）：投到最近的那一段上。 */
const sOnChain = (points, lead, p) => {
  const dir0 = norm(sub(points[1], points[0]));
  const chain = [sub(points[0], mul(dir0, lead)), ...points];
  let best = Infinity, bestS = 0, acc = 0;
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i], d = sub(chain[i + 1], a), L = Math.hypot(...d);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / (L * L)));
    const q = add(a, mul(d, t)), dist = Math.hypot(...sub(p, q));
    if (dist < best) (best = dist), (bestS = acc + t * L);
    acc += L;
  }
  return bestS;
};
{
  // 分部位蒙皮：每個頂點先看離哪個部位（身體、左右手臂、左右腿、左右腳）最近，部位之間只在 1.5 cm 內混合；
  // 腰離前臂 7 cm，分到的前臂權重 ≈ 0（以前所有骨頭一起算、衰減 4 cm，腰側分到 13% 的前臂，叉腰時被拉出一個包）。
  const groups = [['torso', OWN.torso, (p) => skinTorso(p)]];
  for (const s of ['L', 'R']) {
    const armPts = [sideOf(s, P.shoulder), sideOf(s, P.elbow), sideOf(s, P.wrist)], legPts = [sideOf(s, P.hip), sideOf(s, P.knee), sideOf(s, P.ankle)];
    // 手肘前後 ±4.5 cm 平滑交接（±3 cm 時手肘彎起來太尖、內側塌）。
    const armSkin = skinChain(['arm' + s, 'fore' + s], [CHAIN_LEAD.arm, RIG.lengths.upper, RIG.lengths.lower], 'clav' + s, { band: 0.045 });
    const legSkin = skinChain(['thigh' + s, 'shin' + s], [CHAIN_LEAD.leg, RIG.lengths.thigh, RIG.lengths.shin], 'hips', { rootWeight: 1, rootFade: [0.55, 1.4] });
    groups.push(['arm' + s, OWN.arm[s], (p) => armSkin(p, { s: sOnChain(armPts, CHAIN_LEAD.arm, p) })]);
    groups.push(['leg' + s, OWN.leg[s], (p) => legSkin(p, { s: sOnChain(legPts, CHAIN_LEAD.leg, p) })]);
    groups.push(['foot' + s, OWN.foot[s], skinFoot(s)]);
    groups.push(['hand' + s, OWN.hand[s], skinHand(s)]);
  }
  // 手臂和身體之間：肩關節以下（腋下）只在 0.6 cm 內混合，腋下乾淨、不會被手臂拉出一片肉；
  // 肩關節以上在 2 cm 內混合，手一抬，肩膀上緣平順地跟著（不然會在肩膀上緣折出一道痕）。其他部位之間 1.5 cm。
  const shoulderY = P.shoulder[1];
  const softBetween = (g, nearest, p) => {
    if (!(groups[g][0].startsWith('arm') || groups[nearest][0].startsWith('arm'))) return 0.015;
    return p[1] > shoulderY - 0.005 ? 0.02 : 0.006;
  };
  const skinSurface = (p) => {
    const d = groups.map(([, f]) => f.distance(...p));
    const dmin = Math.min(...d);
    const nearest = d.indexOf(dmin);
    const mix = new Map();
    groups.forEach(([, , skin], g) => {
      const w = Math.exp(-(d[g] - dmin) / softBetween(g, nearest, p));
      if (w < 0.01) return;
      for (const x of skin(p)) mix.set(x.joint, (mix.get(x.joint) ?? 0) + w * x.w);
    });
    const top = [...mix].map(([joint, w]) => ({ joint, w })).sort((a, b) => b.w - a.w).slice(0, 4);
    const t = top.reduce((a, x) => a + x.w, 0);
    return top.map((x) => ({ joint: x.joint, w: x.w / t }));
  };
  // 高模不減面時頭和脖子是同一塊網格：0.835～0.87 m 之間從身體的蒙皮漸變到整塊跟頭骨走（硬切會在頭轉動時，頭底下出現一圈硬邊）。
  const headBlend = (p) => {
    const near = Math.hypot(p[0] - HEAD.centre[0], p[1] - HEAD.centre[1], p[2] - HEAD.centre[2]) < HEAD.radii[0] + 0.02;
    const k = near ? smooth01((p[1] - 0.835) / 0.035) : 0;
    if (k >= 1) return rigidHead();
    if (k <= 0) return skinSurface(p);
    const mix = new Map();
    for (const x of skinSurface(p)) mix.set(x.joint, (mix.get(x.joint) ?? 0) + x.w * (1 - k));
    mix.set(HEAD_J, (mix.get(HEAD_J) ?? 0) + k);
    const top = [...mix].map(([joint, w]) => ({ joint, w })).sort((a, b) => b.w - a.w).slice(0, 4);
    const t = top.reduce((a, x) => a + x.w, 0);
    return top.map((x) => ({ joint: x.joint, w: x.w / t }));
  };
  addPart('body', asVerts(surface), surface.indices, uvOf('body'), KEEP ? headBlend : source ? (p) => (inHead(p) ? rigidHead() : skinSurface(p)) : skinSurface);
}
// 有貼圖的版本：眼睛和嘴畫在底色貼圖上（face/face-mask.png，照混元那顆頭的臉），不放貼片幾何，省下的面數給手和身體。
// 色票版（STICKMAN_MAPS=0）沒有貼圖，才用貼片。
const FACE_IN_TEXTURE = process.env.STICKMAN_MAPS !== '0' && !source;
if (!source) {
  addPart('head', asVerts(head), head.indices, uvOf('body'), rigidHead);
  if (!FACE_IN_TEXTURE) for (const [k, part] of faceParts.entries()) addPart(k < 2 ? 'eyes' : 'mouth', part.verts, part.tri, part.uv, rigidHead);
}
const triangles = tris.length / 3;
if (triangles > BUDGET.total && !KEEP) throw Error(`${triangles} triangles: over the budget of ${BUDGET.total}`);

// ------------------------------------------------------------------ 法線貼圖（STICKMAN_MAPS=0 做舊的色票版：沒有貼圖，只有 32×32 色票）
// 面數不變，從距離場（真正的形狀）烘一張法線貼圖和一張環境遮蔽：低模的光影照著圓的形狀走，指縫有陰影。
// 一張 UV 給全部貼圖（LayaAir 3.4.2 的 glTF 讀取器只認第一組 UV），所以底色也換成同一張 UV 的貼圖。
const MAPS = process.env.STICKMAN_MAPS !== '0';
const TEX = Number(process.env.STICKMAN_TEX ?? BUDGET.texture);
let tangents = null, maps = null, unwrapped = null;
if (KEEP) {
  // 高模自己的 UV 和貼圖：底色、法線縮成 TEX 邊長（每 k×k 個像素平均），切線照它的 UV 算。
  uvs.length = 0;
  for (const v of source.uvs) uvs.push(v);
  tangents = tangentsOf(Float32Array.from(pos), Float32Array.from(nor), source.uvs, source.indices);
  const shrink = (png) => {
    const k = Math.max(1, Math.round(png.width / TEX)), W = png.width / k, H = png.height / k;
    const out = new PNG({ width: W, height: H });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        for (let c = 0; c < 4; c++) {
          let sum = 0;
          for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) sum += png.data[((y * k + j) * png.width + x * k + i) * 4 + c];
          out.data[(y * W + x) * 4 + c] = Math.round(sum / (k * k));
        }
    return PNG.sync.write(out, { colorType: 2, inputColorType: 6 });
  };
  maps = { baseColor: shrink(source.baseColor), normal: shrink(source.normalMap), stats: { size: TEX, source: 'kept' } };
} else if (MAPS) {
  const GROUPS = ['body', 'head', 'eyes', 'mouth'];
  const triGroup = Int32Array.from({ length: triangles }, (_, t) => GROUPS.indexOf(partOf[tris[t * 3]]));
  // 貼圖空間多分給手（指縫、指尖的法線和陰影要細），頭和臉最少（正圓球本來就平順、臉是平的、只有一點陰影）。
  const handField = createZhudaSdfField([...HAND_SHAPES.L, ...HAND_SHAPES.R].map(bare));
  // 臉的方向（從頭的球心看出去，度）：眼睛、嘴那一帶貼圖要細（邊才利），其他的頭很粗就夠。
  const faceAngles = (p) => {
    const d = norm(sub(p, HEAD.centre));
    return [(Math.atan2(d[0], d[2]) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180) / Math.PI];
  };
  const onFace = (p) => {
    const [yaw, pitch] = faceAngles(p);
    return Math.abs(yaw) < 52 && pitch > -58 && pitch < 18;
  };
  const centroid = (t) => [0, 1, 2].map((a) => (pos[tris[t * 3] * 3 + a] + pos[tris[t * 3 + 1] * 3 + a] + pos[tris[t * 3 + 2] * 3 + a]) / 3);
  const density = (t) => {
    if (triGroup[t] > 0) return FACE_IN_TEXTURE && onFace(centroid(t)) ? 3.5 : 0.4;
    const c = centroid(t);
    if (source) return Math.abs(c[0]) > 0.19 && c[1] < 0.56 ? 3.2 : inHead(c) ? (c[2] > 0.05 ? 3 : 1) : 1;
    return handField.distance(...c) < 0.01 ? 3.2 : 1;
  };
  // 頭的分塊從正臉開始長（塊與塊的接縫不會切過眼睛）。
  const prefer = (t) => (triGroup[t] === 1 ? -Math.hypot(...faceAngles(centroid(t))) : -1e9);
  unwrapped = unwrap({ positions: Float32Array.from(pos), indices: Uint32Array.from(tris), group: triGroup, density, prefer, size: TEX, padding: 8 });
  const pick = (arr, w) => {
    const out = [];
    for (const v of unwrapped.vmapping) for (let k = 0; k < w; k++) out.push(arr[v * w + k]);
    return out;
  };
  const [P2, N2, J2, W2, part2] = [pick(pos, 3), pick(nor, 3), pick(J, 4), pick(Wt, 4), Array.from(unwrapped.vmapping, (v) => partOf[v])];
  for (const [arr, next] of [[pos, P2], [nor, N2], [J, J2], [Wt, W2], [partOf, part2], [uvs, Array.from(unwrapped.uvs)], [tris, Array.from(unwrapped.indices)]]) {
    arr.length = 0;
    for (const v of next) arr.push(v);
  }
  tangents = tangentsOf(Float32Array.from(pos), Float32Array.from(nor), unwrapped.uvs, unwrapped.indices);
  const headField = createZhudaSdfField(HEAD_SHAPES.map(bare));
  const aoField = createZhudaSdfField([...ALL_SHAPES.filter((x) => !x.subtract), ...HEAD_SHAPES, ...ALL_SHAPES.filter((x) => x.subtract)].map(bare));
  const colourOfGroup = (g) => hex(COLOURS[g === 2 ? 'eye' : g === 3 ? 'mouth' : 'body']);
  // 臉：照方向查臉的圖案（R＝眼白、G＝嘴，雙線性），疊在身體色上。
  const faceMask = FACE_IN_TEXTURE ? PNG.sync.read(fs.readFileSync(path.join(HERE, FACE_MASK.file))) : null;
  const maskAt = (yaw, pitch, ch) => {
    const W = faceMask.width, H = faceMask.height;
    const x = (yaw - FACE_MASK.yaw[0]) / FACE_MASK.step - 0.5, y = (FACE_MASK.pitch[1] - pitch) / FACE_MASK.step - 0.5;
    if (x < 0 || y < 0 || x > W - 1 || y > H - 1) return 0;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const v = (xx, yy) => faceMask.data[(Math.min(H - 1, yy) * W + Math.min(W - 1, xx)) * 4 + ch] / 255;
    return (v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx) * (1 - fy) + (v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx) * fy;
  };
  const [cBody, cEye, cMouth] = ['body', 'eye', 'mouth'].map((k) => hex(COLOURS[k]).map((v) => v / 255));
  const colourAt = faceMask
    ? (p, g) => {
        if (g !== 1) return null;
        const [yaw, pitch] = faceAngles(p);
        const e = maskAt(yaw, pitch, 0), m = maskAt(yaw, pitch, 1);
        return [0, 1, 2].map((k) => cBody[k] * (1 - e - m) + cEye[k] * e + cMouth[k] * m);
      }
    : null;
  const bakeStarted = Date.now();
  maps = bakeMaps({
    positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: unwrapped.uvs, tangents, indices: unwrapped.indices,
    group: triGroup, chartOfTri: unwrapped.chartOfTri, size: TEX,
    surfaceOf: (g) => (g === 0 ? bodyField : headField), aoField, colourOf: colourOfGroup, colourAt,
    // 法線貼圖只用在手（離手的形狀 1 cm 內全用、3 cm 外不用）：身體、頭的低模法線本來就準，用了只會多出塊與塊之間的接縫。
    normalWeight: source ? () => 1 : (p) => smooth01((0.03 - handField.distance(...p)) / 0.02),
    // 高模來源：沿低模法線找高模的表面，取那裡的法線和底色（沒找到、或找到的是背面就不改）。
    highSample: source
      ? (() => {
          const bvh = buildBvh(source.positions, source.indices);
          const { indices: SI, normals: SN, uvs: SU } = source;
          return (p, n) => {
            const h = bvh.nearestOnLine(p, n, 0.03);
            if (!h) return null;
            const v = [SI[h.tri * 3], SI[h.tri * 3 + 1], SI[h.tri * 3 + 2]], w = [1 - h.b1 - h.b2, h.b1, h.b2];
            const nn = norm([0, 1, 2].map((a) => w[0] * SN[v[0] * 3 + a] + w[1] * SN[v[1] * 3 + a] + w[2] * SN[v[2] * 3 + a]));
            if (dot(nn, n) < 0.2) return null;
            const uv = [0, 1].map((k) => w[0] * SU[v[0] * 2 + k] + w[1] * SU[v[1] * 2 + k] + w[2] * SU[v[2] * 2 + k]);
            return { normal: nn, colour: source.baseColor ? sampleTexture(source.baseColor, uv[0], uv[1]) : null };
          };
        })()
      : null,
  });
  maps.stats.seconds = +((Date.now() - bakeStarted) / 1000).toFixed(1);
}

// ------------------------------------------------------------------ 動作：每段都寫滿全部骨頭
const fixSign = (q, prev) => (prev && q[0] * prev[0] + q[1] * prev[1] + q[2] * prev[2] + q[3] * prev[3] < 0 ? q.map((v) => -v) : q);
const unit = (q) => {
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
};
const animations = [];
const motionReport = {};
for (const [name, clip] of Object.entries(CLIPS)) {
  const frames = Math.round(clip.seconds * 30) + 1;
  const times = new Float32Array(frames);
  const rot = joints.map(() => new Float32Array(frames * 4));
  const tr = new Float32Array(frames * 3);
  const poses = [];
  for (let f = 0; f < frames; f++) {
    const t = (f / (frames - 1)) * clip.seconds;
    times[f] = t;
    const pose = clip.pose(t);
    poses.push(pose);
    joints.forEach((j, i) => {
      let q = pose[j.name] ?? Q.id;
      if (q.length !== 4) throw Error(`${name}: ${j.name} is not a quaternion`);
      q = fixSign(unit(q), f ? [...rot[i].subarray((f - 1) * 4, f * 4)] : null);
      rot[i].set(q, f * 4);
    });
    tr.set(add(joints[0].at, pose.$root ?? [0, 0, 0]), f * 3);
  }
  animations.push({ name, times, channels: [...joints.map((_, i) => ({ joint: i, path: 'rotation', values: rot[i] })), { joint: 0, path: 'translation', values: tr }] });
  // 腳：左腳兩段都踩著不動；右腳在叉腰那段不動、抱胸那段只有腳尖翹（腳跟不動）。
  const heel = (s) => add(RIG.side(s, RIG.P.ankle), [0, -RIG.P.ankle[1], -HEEL]);
  const drift = (s, point) => {
    const first = RIG.R.place(poses[0], 'foot' + s, point);
    return Math.max(...poses.map((p) => Math.hypot(...sub(RIG.R.place(p, 'foot' + s, point), first))));
  };
  // 第一格和最後一格要一樣（循環接得上）。
  let seam = 0;
  for (const r of rot) for (let k = 0; k < 4; k++) seam = Math.max(seam, Math.abs(r[k] - r[(frames - 1) * 4 + k]));
  const hands = poses.map((p) => ['L', 'R'].map((s) => RIG.R.place(p, 'hand' + s)));
  motionReport[name] = {
    seconds: clip.seconds,
    frames,
    loopSeamQuat: +seam.toExponential(2),
    leftAnkleDriftMm: +(drift('L', RIG.P.ankle) * 1000).toFixed(2),
    rightHeelDriftMm: +(drift('R', heel('R')) * 1000).toFixed(2),
    rightAnkleMovesMm: +(drift('R', RIG.side('R', RIG.P.ankle)) * 1000).toFixed(1),
    wristsAtStart: hands[0].map((h) => h.map((v) => +v.toFixed(3))),
  };
}

// ------------------------------------------------------------------ 寫檔
const glb = writeRiggedGlb({
  name: 'stickman',
  generator: 'zhuda-laya-engine prefabs/3d/stickman (kit: games/tools/characters)',
  joints: joints.map((j) => ({ name: j.name, parent: j.parent ? index.get(j.parent) : -1, position: j.at })),
  primitives: [
    {
      positions: Float32Array.from(pos),
      normals: Float32Array.from(nor),
      uvs: Float32Array.from(uvs),
      ...(tangents ? { tangents } : {}),
      joints: Uint8Array.from(J),
      weights: Float32Array.from(Wt),
      indices: triangles * 3 < 65536 && pos.length / 3 < 65536 ? Uint16Array.from(tris) : Uint32Array.from(tris),
      material: 0,
    },
  ],
  ...(maps
    ? {
        // 一個材質、三張貼圖（同一組 UV）：底色、法線、環境遮蔽。線性取樣＋mipmap，貼邊（塊與塊之間留了 8 像素再往外補色）。
        materials: [{ name: 'stickman', color: [1, 1, 1, 1], roughness: ROUGH, metallic: 0, textures: { baseColor: 0, normal: 1, ...(maps.occlusion ? { occlusion: 2 } : {}) } }],
        images: [
          { name: 'stickman-basecolor', mime: 'image/png', bytes: maps.baseColor },
          { name: 'stickman-normal', mime: 'image/png', bytes: maps.normal },
          ...(maps.occlusion ? [{ name: 'stickman-occlusion', mime: 'image/png', bytes: maps.occlusion }] : []),
        ],
        sampler: { magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 },
      }
    : {
        materials: [{ name: 'stickman', color: [1, 1, 1, 1], roughness: ROUGH, metallic: 0, textures: { baseColor: 0 } }],
        images: [{ name: 'stickman-palette', mime: 'image/png', bytes: paletteImage }],
        sampler: { magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 },
      }),
  animations,
});
fs.writeFileSync(OUT, glb);
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) (lo[a] = Math.min(lo[a], pos[i + a])), (hi[a] = Math.max(hi[a], pos[i + a]));
const report = {
  file: 'assets/stickman.glb',
  bytes: glb.length,
  triangles,
  budget: BUDGET.total,
  parts: counts,
  vertices: pos.length / 3,
  textures: KEEP
    ? { ...maps.stats, bytes: { baseColor: maps.baseColor.length, normal: maps.normal.length } }
    : maps
    ? {
        size: TEX,
        charts: unwrapped.charts,
        movedForOverlap: unwrapped.movedForOverlap,
        texelsPerMetre: unwrapped.texelsPerMetre,
        chartFill: unwrapped.fill,
        ...maps.stats,
        bytes: { baseColor: maps.baseColor.length, normal: maps.normal.length, occlusion: maps.occlusion.length },
      }
    : { palette: '32x32' },
  meshedBeforeSimplify: { body: surface.full },
  handTriangles: surface.handTriangles,
  simplifyErrorMm: { body: surface.errorMm },
  // 規則網格離真正的表面多遠（露在外面的三角形的中心與邊中點）。
  bodySurfaceError: source ? null : surfaceError(bodyField, surface.positions, surface.indices),
  // 身體上（離身體比離手臂近的頂點）各高度分到的手臂骨頭權重，新舊兩種蒙皮對照。
  // 舊的：所有骨頭一起依最近形狀算、衰減 4 cm（腰側分到前臂，叉腰時被拉出一個包）；新的：分部位，部位之間只在 1.5 cm 內混合。
  armWeightOnBody: (() => {
    const arm = new Set(['armL', 'foreL', 'handL', 'armR', 'foreR', 'handR'].map((n) => index.get(n)));
    const old = skinner(def, [...BODY_SHAPES, ...HEAD_SHAPES, ...HAND_SHAPES.L, ...HAND_SHAPES.R], index);
    const bands = [[0.5, 0.56], [0.56, 0.62], [0.62, 0.68], [0.68, 0.74]];
    const out = {};
    for (const [lo, hi] of bands) {
      let now = 0, before = 0;
      for (let v = 0; v < pos.length / 3; v++) {
        const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
        if (p[1] < lo || p[1] >= hi || partOf[v] !== 'body') continue;
        if (OWN.torso.distance(...p) >= Math.min(OWN.arm.L.distance(...p), OWN.arm.R.distance(...p))) continue;
        let w = 0;
        for (let k = 0; k < 4; k++) if (arm.has(J[v * 4 + k])) w += Wt[v * 4 + k];
        now = Math.max(now, w);
        before = Math.max(before, old(p).filter((x) => arm.has(x.joint)).reduce((a, x) => a + x.w, 0));
      }
      out[`${lo}-${hi}m`] = { before: +before.toFixed(3), now: +now.toFixed(3) };
    }
    return out;
  })(),
  headRoundness: (() => {
    // 頭的每個三角形中心與邊中點離正球多遠（頂點都在球面上）。
    const P = head.positions, I = head.indices, r = HEAD.radii[0], c = HEAD.centre;
    let worst = 0;
    const at = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    for (let k = 0; k < I.length; k += 3) {
      const [a, b2, d] = [at(I[k]), at(I[k + 1]), at(I[k + 2])];
      for (const q of [mul(add(add(a, b2), d), 1 / 3), mul(add(a, b2), 0.5), mul(add(b2, d), 0.5), mul(add(a, d), 0.5)]) worst = Math.max(worst, r - Math.hypot(...sub(q, c)));
    }
    let vmax = 0;
    for (let v = 0; v < P.length / 3; v++) vmax = Math.max(vmax, Math.abs(Math.hypot(...sub(at(v), c)) - r));
    return { radiusM: r, verticesOffSphereMm: +(vmax * 1000).toFixed(3), deepestInsideSphereMm: +(worst * 1000).toFixed(2), triangles: I.length / 3 };
  })(),
  vertices: pos.length / 3,
  joints: joints.map((j) => j.name),
  meshes: 1,
  materials: 1,
  clips: motionReport,
  heightM: +(hi[1] - lo[1]).toFixed(3),
  bounds: { min: lo.map((v) => +v.toFixed(3)), max: hi.map((v) => +v.toFixed(3)) },
  feet: FEET,
  seconds: +((Date.now() - started) / 1000).toFixed(1),
};
if (!TRIAL) fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ triangles, parts: counts, bytes: glb.length, vertices: report.vertices, textures: report.textures, heightM: report.heightM, clips: motionReport, seconds: report.seconds }, null, 1));

// ------------------------------------------------------------------ 軟體算圖（不經瀏覽器，只給做的時候看）
if (previewDir) {
  fs.mkdirSync(previewDir, { recursive: true });
  const P3 = Float32Array.from(pos), N3 = Float32Array.from(nor), I3 = Uint32Array.from(tris);
  const colourOf = (v) => hex(COLOURS[partOf[v] === 'eyes' ? 'eye' : partOf[v] === 'mouth' ? 'mouth' : 'body']);
  const posed = (pose) => {
    const world = joints.map((j) => RIG.R.world(pose, j.name));
    const place = joints.map((j) => RIG.R.place(pose, j.name));
    const p = new Float32Array(P3.length), n = new Float32Array(N3.length);
    for (let v = 0; v < P3.length / 3; v++) {
      const x = [P3[v * 3], P3[v * 3 + 1], P3[v * 3 + 2]], nn = [N3[v * 3], N3[v * 3 + 1], N3[v * 3 + 2]];
      let a = [0, 0, 0], b = [0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const w = Wt[v * 4 + k];
        if (!w) continue;
        const j = J[v * 4 + k];
        a = add(a, mul(add(Q.apply(world[j], sub(x, joints[j].at)), place[j]), w));
        b = add(b, mul(Q.apply(world[j], nn), w));
      }
      p.set(a, v * 3);
      n.set(norm(b), v * 3);
    }
    return { p, n };
  };
  const shade = (pose, yawDeg, pitchDeg, bounds = [-0.5, -0.05, 0.5, 1.3], px = 260) => {
    const { p, n } = posed(pose);
    const view = look([{ positions: p, indices: I3 }], { yaw: yawDeg, pitch: pitchDeg, pxPerMetre: px, where: true, bounds });
    const { width, height } = view;
    const rgba = new Uint8Array(width * height * 4);
    const light = norm([0.5, 0.8, 0.6]), fill = norm([-0.6, 0.2, 0.4]);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const o = y * width + x, q = ((height - 1 - y) * width + x) * 4;
        let c = [214, 222, 232];
        const t = view.triangle[o];
        if (t >= 0) {
          const w0 = view.bary[o * 2], w1 = view.bary[o * 2 + 1], w2 = 1 - w0 - w1;
          const [va, vb, vc] = [I3[t * 3], I3[t * 3 + 1], I3[t * 3 + 2]];
          const nn = norm([0, 1, 2].map((a) => n[va * 3 + a] * w0 + n[vb * 3 + a] * w1 + n[vc * 3 + a] * w2));
          const base = colourOf(va).map((v) => v / 255);
          const lin = base.map((v) => v ** 2.2);
          const k = 0.25 + 0.9 * Math.max(0, nn[0] * light[0] + nn[1] * light[1] + nn[2] * light[2]) + 0.25 * Math.max(0, nn[0] * fill[0] + nn[1] * fill[1] + nn[2] * fill[2]);
          const spec = 0.35 * Math.max(0, nn[0] * 0.4 + nn[1] * 0.55 + nn[2] * 0.73) ** 24;
          c = lin.map((v) => Math.min(255, 255 * (v * k + spec) ** (1 / 2.2)));
          if (view.back[o]) c = [255, 0, 255];
        }
        rgba.set([c[0], c[1], c[2], 255], q);
      }
    return { width, height, rgba };
  };
  const bind = {};
  const tiles = [shade(bind, 0, 0), shade(bind, 35, 8), shade(bind, 90, 0)];
  for (const [name, clip] of Object.entries(CLIPS)) {
    for (const k of [0, 0.3, 0.55, 0.8]) tiles.push(shade(clip.pose(clip.seconds * k), 20, 6));
    tiles.push(shade(clip.pose(clip.seconds * 0.3), 90, 0));
  }
  const s = sheet(tiles, 4);
  writePng(path.join(previewDir, 'node-sheet.png'), s.width, s.height, s.rgba);
  const face = shade({}, 0, 0);
  writePng(path.join(previewDir, 'node-front.png'), face.width, face.height, face.rgba);
  // 手的特寫：綁定姿勢的左手，正面、外側、斜下方。
  const w = RIG.P.wrist, hb = (sx) => [sx - 0.11, w[1] - 0.14, sx + 0.11, w[1] + 0.06];
  const hands = sheet([shade({}, 0, 0, hb(w[0] + 0.04), 1400), shade({}, 90, 0, hb(-w[2] - 0.04), 1400), shade({}, 40, -30, hb(0.07), 1400)], 3);
  writePng(path.join(previewDir, 'node-hand.png'), hands.width, hands.height, hands.rgba);
  console.log('preview', previewDir);
}
