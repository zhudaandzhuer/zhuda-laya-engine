// The dark vertices that do not face down: where they are, and how many triangles use each.
import { readFileSync } from 'node:fs';
const SIZE = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }, N = { VEC3: 3, VEC4: 4, SCALAR: 1 };
for (const file of process.argv.slice(2)) {
  const b = readFileSync(file), jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8);
  const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = N[a.type], s = SIZE[a.componentType], stride = v.byteStride || n * s, off = (v.byteOffset || 0) + (a.byteOffset || 0), out = [];
    for (let k = 0; k < a.count; k++) { const row = []; for (let c = 0; c < n; c++) { const o = off + k * stride + c * s; row.push(a.componentType === 5126 ? bin.readFloatLE(o) : a.componentType === 5125 ? bin.readUInt32LE(o) : a.componentType === 5123 ? (a.normalized ? bin.readUInt16LE(o) / 65535 : bin.readUInt16LE(o)) : bin.readUInt8(o) / 255); } out.push(row); } return out; };
  for (const m of json.meshes) for (const p of m.primitives) { if (p.attributes.COLOR_0 === undefined) continue;
    const pos = acc(p.attributes.POSITION), col = acc(p.attributes.COLOR_0), nor = acc(p.attributes.NORMAL), idx = acc(p.indices).map((r) => r[0]);
    const dark = (i) => Math.abs(col[i][0] - 0.073) < 0.004 && Math.abs(col[i][2] - 0.084) < 0.004;
    const use = new Map(); for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const v = idx[t + k]; if (!dark(v) || nor[v][1] < 0) continue; const e = use.get(v) ?? { tris: 0, allDark: 0 }; e.tris++; if ([0, 1, 2].every((j) => dark(idx[t + j]))) e.allDark++; use.set(v, e); }
    console.log(file.split('/').pop(), 'dark vertices not facing down:', use.size);
    for (const [v, e] of [...use].slice(0, 20)) console.log('   v', v, 'pos', pos[v].map((x) => x.toFixed(3)).join(' '), 'n', nor[v].map((x) => x.toFixed(2)).join(' '), 'triangles', e.tris, 'of which all-dark', e.allDark);
  }
}
