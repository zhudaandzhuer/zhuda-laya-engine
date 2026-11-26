// node glb-dark-heights.mjs <parts .glb>...
// For each part: the dark (hem-closing) vertices by height, in 5 cm bands, with how far from the axis they are.
import { readFileSync } from 'node:fs';
const SIZE = { 5126: 4, 5123: 2, 5121: 1 }, N = { VEC3: 3, VEC4: 4 };
for (const file of process.argv.slice(2)) {
  const b = readFileSync(file), jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8);
  const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = N[a.type], s = SIZE[a.componentType], stride = v.byteStride || n * s, off = (v.byteOffset || 0) + (a.byteOffset || 0), out = [];
    for (let k = 0; k < a.count; k++) { const row = []; for (let c = 0; c < n; c++) { const o = off + k * stride + c * s; row.push(a.componentType === 5126 ? bin.readFloatLE(o) : a.componentType === 5123 ? bin.readUInt16LE(o) / 65535 : bin.readUInt8(o) / 255); } out.push(row); } return out; };
  const bands = new Map(); let total = 0, lo = Infinity, hi = -Infinity;
  for (const m of json.meshes) for (const p of m.primitives) { if (p.attributes.COLOR_0 === undefined) continue; const pos = acc(p.attributes.POSITION), col = acc(p.attributes.COLOR_0), nor = p.attributes.NORMAL !== undefined ? acc(p.attributes.NORMAL) : null;
    pos.forEach((q, i) => { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); const c = col[i]; if (Math.abs(c[0] - 0.073) > 0.004 || Math.abs(c[2] - 0.084) > 0.004) return; total++; const k = Math.floor(q[1] / 0.05); const e = bands.get(k) ?? { n: 0, r: 0, ny: 0 }; e.n++; e.r += Math.hypot(q[0], q[2]); e.ny += nor ? nor[i][1] : 0; bands.set(k, e); }); }
  console.log(file.split('/').pop().padEnd(18), 'part y', lo.toFixed(2), 'to', hi.toFixed(2), ' hem-dark', total, ' ', [...bands].sort((a, b) => a[0] - b[0]).map(([k, e]) => `${(k * 0.05).toFixed(2)}:${e.n}(r${(e.r / e.n).toFixed(2)},ny${(e.ny / e.n).toFixed(1)})`).join(' '));
}
