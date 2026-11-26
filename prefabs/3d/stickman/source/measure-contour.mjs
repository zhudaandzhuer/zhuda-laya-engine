// 綁定姿勢的外輪廓：正面（身體＋腿的外側）與側面（前緣、後緣），每 5 mm 一列，找台階（凸出或凹進）。
// node 3d/stickman/source/measure-contour.mjs [glb]（在 prefabs/ 底下跑；預設量 assets/stickman.glb）
// 需求者 要「身體沒有人類的高低差，手摸過去是一個平面」：看身體接到腿、前緣、後緣有沒有凸出或凹進去。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { look } from '../../../../games/tools/characters/raster.mjs';
const bytes = fs.readFileSync(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'stickman.glb'));
const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const jl = dv.getUint32(12, true);
const g = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jl)));
const bin = 20 + jl + 8;
const read = (i) => { const a = g.accessors[i], v = g.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC3: 3 }[a.type] * a.count; const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType]; const at = bytes.byteOffset + bin + (v.byteOffset ?? 0); return new T(bytes.buffer.slice(at, at + n * T.BYTES_PER_ELEMENT)); };
const prim = g.meshes[0].primitives[0];
const positions = read(prim.attributes.POSITION), indices = Uint32Array.from(read(prim.indices));
// 側面只看身體和腿：綁定姿勢的手臂、手垂在身體兩側（離中線 16 cm 以外），側面看會疊在身體前面，量到的是拇指不是身體。
const bodyOnly = Uint32Array.from(
  Array.from({ length: indices.length / 3 }, (_, t) => t).filter((t) => Math.max(...[0, 1, 2].map((k) => Math.abs(positions[indices[t * 3 + k] * 3]))) < 0.16).flatMap((t) => [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]]),
);
const px = 1000, B = [-0.45, -0.02, 0.45, 1.25];
const pad = 2 / px;
function contour(yaw, pick) {
  const v = look([{ positions, indices: yaw === 0 ? indices : bodyOnly }], { yaw, pitch: 0, pxPerMetre: px, bounds: B });
  const cx = Math.round((0 - B[0] + pad) * px);
  const rows = [];
  for (let y = 0.1; y <= 0.66; y += 0.005) { // 腋下（0.68 m）以上手臂接進來，不算
    const r = Math.round((y - B[1] + pad) * px);
    const at = (x) => v.id[r * v.width + x] >= 0;
    rows.push({ y: +y.toFixed(3), x: pick(at, cx, v.width) });
  }
  return rows;
}
// 正面左側：從中線往外，跳過胯下的縫，第一段的外緣（手臂在更外面，中間有空隙）。
const outerLeft = (at, cx, w) => { let x = cx + Math.round(0.03 * px); while (x < w && !at(x)) x++; while (x < w && at(x)) x++; return (x - cx) / px; }; // 從中線外 3 cm 起算（跳過胯下中間那一小塊）
// 側面：面向 +Z 在 yaw 90 時朝畫面左；前緣＝最左邊的點、後緣＝最右邊的點（離中線）。
const front = (at, cx, w) => { let x = 0; while (x < w && !at(x)) x++; return (cx - x) / px; };
const back = (at, cx, w) => { let x = w - 1; while (x > 0 && !at(x)) x--; return (x - cx) / px; };
const report = (name, rows) => {
  let worst = 0, where = 0;
  for (let i = 6; i + 6 < rows.length; i++) {
    const bump = rows[i].x - (rows[i - 6].x + rows[i + 6].x) / 2; // 這一列比上下各 3 cm 的平均凸出（＋）或凹進（－）多少
    if (Math.abs(bump) > Math.abs(worst)) (worst = bump), (where = rows[i].y);
  }
  const line = rows.filter((_, i) => i % 6 === 0).map((r) => `${r.y.toFixed(2)}:${(r.x * 100).toFixed(1)}`).join('  ');
  console.log(`${name}  最大的凸凹（比上下各 3 cm 的平均） ${(worst * 1000).toFixed(1)} mm（在 ${where} m）\n   ${line}`);
};
report('正面外側（身體→腿）', contour(0, outerLeft));
report('側面前緣', contour(90, front));
report('側面後緣', contour(90, back));
