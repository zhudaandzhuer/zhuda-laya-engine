// Looks at a posed, dressed character from outside, without a browser: a small orthographic
// rasteriser with a depth buffer. For every pixel it finds the nearest triangle of everything
// drawn, and whether that triangle faces the eye. A graphics card does not draw a triangle seen
// from behind, so a pixel whose nearest triangle faces away is a hole: one sees through the
// garment there (cloth folded inside out, an edge left open).
//
//   const view = look(meshes, { yaw, pitch, pxPerMetre });
//   meshes: [{ positions, indices, hidden? (bit per triangle), id }]
//   view:   { width, height, id (Int16Array: mesh id or -1), triangle, back (Uint8Array), depth,
//             bary (with { where: true }: the weights of the triangle's first two corners at each pixel) }
//   writePng(path, width, height, rgba)
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/** The eye's axes for a direction: yaw about y (0 looks at the front, along -z), pitch up from level; degrees. */
export function axes(yaw, pitch) {
  const a = (yaw * Math.PI) / 180, e = (pitch * Math.PI) / 180;
  // The eye sits at `toEye` from the figure and looks back at it.
  const toEye = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  const right = [Math.cos(a), 0, -Math.sin(a)];
  const up = [toEye[1] * right[2] - toEye[2] * right[1], toEye[2] * right[0] - toEye[0] * right[2], toEye[0] * right[1] - toEye[1] * right[0]];
  return { toEye, right, up };
}

export function look(meshes, { yaw = 0, pitch = 0, pxPerMetre = 300, bounds, where = false } = {}) {
  const { toEye, right, up } = axes(yaw, pitch);
  // Screen: x right, y up, depth = distance towards the eye (larger is nearer).
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  const projected = meshes.map((m) => {
    const n = m.positions.length / 3, out = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
      const sx = x * right[0] + y * right[1] + z * right[2], sy = x * up[0] + y * up[1] + z * up[2];
      out[v * 3] = sx;
      out[v * 3 + 1] = sy;
      out[v * 3 + 2] = x * toEye[0] + y * toEye[1] + z * toEye[2];
      if (sx < lo[0]) lo[0] = sx;
      if (sy < lo[1]) lo[1] = sy;
      if (sx > hi[0]) hi[0] = sx;
      if (sy > hi[1]) hi[1] = sy;
    }
    return out;
  });
  if (bounds) ((lo = [bounds[0], bounds[1]]), (hi = [bounds[2], bounds[3]]));
  const pad = 2 / pxPerMetre;
  const width = Math.max(1, Math.ceil((hi[0] - lo[0] + pad * 2) * pxPerMetre)), height = Math.max(1, Math.ceil((hi[1] - lo[1] + pad * 2) * pxPerMetre));
  const depth = new Float32Array(width * height).fill(-Infinity), id = new Int16Array(width * height).fill(-1), triangle = new Int32Array(width * height).fill(-1), back = new Uint8Array(width * height);
  // With `where`: where on its triangle each pixel lies (the weights of its first two corners).
  const bary = where ? new Float32Array(width * height * 2) : null;
  meshes.forEach((m, k) => {
    const S = projected[k], I = m.indices, hidden = m.hidden;
    for (let t = 0; t < I.length / 3; t++) {
      if (hidden && hidden[t >> 3] & (1 << (t & 7))) continue;
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ax = (S[a] - lo[0] + pad) * pxPerMetre, ay = (S[a + 1] - lo[1] + pad) * pxPerMetre, bx = (S[b] - lo[0] + pad) * pxPerMetre, by = (S[b + 1] - lo[1] + pad) * pxPerMetre, cx = (S[c] - lo[0] + pad) * pxPerMetre, cy = (S[c + 1] - lo[1] + pad) * pxPerMetre;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (area === 0) continue;
      // Counter-clockwise on screen (x right, y up) faces the eye.
      const facesAway = area < 0 ? 1 : 0;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
      const inv = 1 / area;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const d = S[a + 2] * w0 + S[b + 2] * w1 + S[c + 2] * w2, o = y * width + x;
          // Nearer wins; of two at the same depth (a face given both sides) the one facing the eye.
          if (d > depth[o] + 1e-7 || (d > depth[o] - 1e-7 && back[o] && !facesAway)) {
            depth[o] = d;
            id[o] = m.id ?? k;
            triangle[o] = t;
            back[o] = facesAway;
            if (bary) ((bary[o * 2] = w0), (bary[o * 2 + 1] = w1));
          }
        }
    }
  });
  return { width, height, id, triangle, back, depth, bary, pxPerMetre };
}

/**
 * A picture of a view: each mesh its colour, shaded by depth, holes in magenta; with `marks` (look-check.mjs)
 * covered surface that shows in yellow. colours: { id: [r, g, b] } 0-255.
 */
export function picture(view, colours, { hole = [255, 0, 255], shown = [255, 225, 0], ground = [245, 245, 245], marks } = {}) {
  const { width, height } = view;
  const rgba = new Uint8Array(width * height * 4);
  let near = -Infinity, far = Infinity;
  for (let o = 0; o < width * height; o++) if (view.id[o] >= 0) ((near = Math.max(near, view.depth[o])), (far = Math.min(far, view.depth[o])));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = y * width + x, p = ((height - 1 - y) * width + x) * 4;
      let c = ground;
      if (view.id[o] >= 0) {
        if (view.back[o]) c = hole;
        else if (marks && marks[o] === 2) c = shown;
        else {
          // Shade by the slope of the depth buffer: enough to read the form.
          const dx = (view.depth[o + 1] ?? view.depth[o]) - view.depth[o], dy = (view.depth[o + width] ?? view.depth[o]) - view.depth[o];
          const slope = Math.min(1, Math.hypot(Number.isFinite(dx) ? dx : 0, Number.isFinite(dy) ? dy : 0) * view.pxPerMetre * 0.5);
          const k = (0.55 + 0.45 * ((view.depth[o] - far) / (near - far || 1))) * (1 - 0.45 * slope);
          const base = colours[view.id[o]] ?? [200, 200, 200];
          c = [base[0] * k, base[1] * k, base[2] * k];
        }
      }
      rgba[p] = c[0];
      rgba[p + 1] = c[1];
      rgba[p + 2] = c[2];
      rgba[p + 3] = 255;
    }
  return rgba;
}

/** Pictures side by side: tiles [{ width, height, rgba }] in `columns` columns. */
export function sheet(tiles, columns) {
  const w = Math.max(...tiles.map((t) => t.width)), h = Math.max(...tiles.map((t) => t.height));
  const rows = Math.ceil(tiles.length / columns);
  const rgba = new Uint8Array(w * columns * h * rows * 4).fill(245);
  tiles.forEach((t, i) => {
    const ox = (i % columns) * w + ((w - t.width) >> 1), oy = Math.floor(i / columns) * h + (h - t.height);
    for (let y = 0; y < t.height; y++) rgba.set(t.rgba.subarray(y * t.width * 4, (y + 1) * t.width * 4), ((oy + y) * w * columns + ox) * 4);
  });
  return { width: w * columns, height: h * rows, rgba };
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]) & 255] ^ (c >>> 8);
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0, 8 + data.length);
  return out;
}
export function writePng(path, width, height, rgba) {
  writeFileSync(path, pngBytes(width, height, rgba));
}
/** A PNG file's bytes (RGBA, 8 bits a channel). */
export function pngBytes(width, height, rgba) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
