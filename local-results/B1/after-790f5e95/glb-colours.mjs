// Vertex colours of a .glb: how many vertices have each colour, and where the dark ones are.
import { readFileSync } from 'node:fs';
const SIZE = { 5126: 4, 5123: 2, 5121: 1 }, N = { VEC3: 3, VEC4: 4 };
function read(file) {
  const b = readFileSync(file);
  const jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8);
  const acc = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = N[a.type], s = SIZE[a.componentType];
    const stride = v.byteStride || n * s, off = (v.byteOffset || 0) + (a.byteOffset || 0), out = [];
    for (let k = 0; k < a.count; k++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        const o = off + k * stride + c * s;
        row.push(a.componentType === 5126 ? bin.readFloatLE(o) : a.componentType === 5123 ? bin.readUInt16LE(o) / 65535 : bin.readUInt8(o) / 255);
      }
      out.push(row);
    }
    return out;
  };
  const rows = [];
  for (const m of json.meshes) for (const p of m.primitives) {
    if (p.attributes.COLOR_0 === undefined) continue;
    const pos = acc(p.attributes.POSITION), col = acc(p.attributes.COLOR_0);
    pos.forEach((q, i) => rows.push({ p: q, c: col[i] }));
  }
  return rows;
}
for (const file of process.argv.slice(2)) {
  const rows = read(file), by = new Map();
  for (const r of rows) {
    const k = r.c.slice(0, 3).map((x) => x.toFixed(3)).join(',');
    const e = by.get(k) ?? { n: 0, yMin: Infinity, yMax: -Infinity };
    e.n++; e.yMin = Math.min(e.yMin, r.p[1]); e.yMax = Math.max(e.yMax, r.p[1]);
    by.set(k, e);
  }
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const dark = rows.filter((r) => lum(r.c) < 0.3);
  console.log(file.split('/').pop(), 'vertices', rows.length, 'dark(<0.3 linear)', dark.length);
  for (const [k, e] of [...by].sort((a, b) => b[1].n - a[1].n).slice(0, 6)) console.log('   rgb', k, 'n', e.n, 'y', e.yMin.toFixed(3), 'to', e.yMax.toFixed(3));
  if (by.size > 6) console.log('   ...', by.size, 'colours in all');
}
