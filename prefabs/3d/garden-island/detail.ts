// The second layer of the island, all thin leaves and petals built as quads:
// leaves over every crown (so a crown reads as foliage, not a lump), fallen
// blossom under the blossom trees, clumps of flowers in the lawn, and the
// shallows and the foam along the shore.
import { ZhudaDynamicMesh, createSurfaceMaterial, zhudaMarkFoliage, type MeshData } from 'zhuda-laya-engine';
import { SEA_Y, TREES, grassGrows, groundAt, heightAt, noise, pathDistance, rimAt, waterEdge, type TreeKind } from './land.ts';
import { random, type V3 } from '../math.ts';

type RGB = [number, number, number];

/** Quads gathered for one surface. */
class Quads {
  private readonly p: number[] = [];
  private readonly n: number[] = [];
  /** A four-cornered leaf: `a` to `c` is its length, `b` and `d` its sides; `normal` is what the light sees. */
  add(a: V3, b: V3, c: V3, d: V3, normal: V3) {
    this.p.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) this.n.push(...normal);
  }
  get count() {
    return this.p.length / 12;
  }
  /** Meshes of at most 16,000 quads each. */
  data(): MeshData[] {
    const out: MeshData[] = [];
    const total = this.count;
    for (let first = 0; first < total; first += 16000) {
      const n = Math.min(16000, total - first);
      // Both windings, with the one normal: a leaf is lit the same from either side.
      const indices = new Uint32Array(n * 12);
      for (let i = 0; i < n; i++) indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3, i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 12);
      out.push({
        positions: new Float32Array(this.p.slice(first * 12, (first + n) * 12)),
        normals: new Float32Array(this.n.slice(first * 12, (first + n) * 12)),
        uvs: new Float32Array(n * 8),
        indices,
      });
    }
    return out;
  }
}

/** `share`: how much of the leaves, petals and flowers to make, 0..1; `cast`: whether the crowns' leaves cast shadows. */
export function buildDetail(scene: Laya.Scene3D, share = 1, cast = true): { dispose(): void } {
  const owned: { dispose(): void }[] = [];
  const materials: Laya.Material[] = [];
  const rand = random(303);
  const put = (quads: Quads, color: RGB, options: { roughness?: number; alpha?: number; wind?: boolean; cast?: boolean; emission?: RGB } = {}) => {
    if (!quads.count) return;
    const material = createSurfaceMaterial({
      type: 'pbr',
      color: [color[0], color[1], color[2], options.alpha ?? 1],
      roughness: options.roughness ?? 0.8,
      metallic: 0,
      ...(options.alpha !== undefined ? { blend: 'alpha' as const, depthWrite: false } : {}),
      ...(options.emission ? { emission: options.emission } : {}),
    }) as Laya.Material;
    materials.push(material);
    for (const data of quads.data()) {
      const mesh = new ZhudaDynamicMesh(data, scene);
      const r = (mesh.node as Laya.MeshSprite3D).meshRenderer;
      r.sharedMaterial = material;
      r.castShadow = options.cast ?? false;
      r.receiveShadow = true;
      owned.push(mesh);
      if (options.wind) owned.push(zhudaMarkFoliage(mesh.node));
    }
  };
  /** A leaf at `at`, its length along `along`, its width along `side`. */
  const leaf = (quads: Quads, at: V3, along: V3, side: V3, length: number, width: number, normal: V3) => {
    const h = length / 2,
      w = width / 2;
    quads.add(
      [at[0] - along[0] * h, at[1] - along[1] * h, at[2] - along[2] * h],
      [at[0] + side[0] * w, at[1] + side[1] * w, at[2] + side[2] * w],
      [at[0] + along[0] * h, at[1] + along[1] * h, at[2] + along[2] * h],
      [at[0] - side[0] * w, at[1] - side[1] * w, at[2] - side[2] * w],
      normal,
    );
  };
  const unit = (): V3 => {
    const u = rand() * 2 - 1,
      a = rand() * Math.PI * 2,
      s = Math.sqrt(1 - u * u);
    return [Math.cos(a) * s, u, Math.sin(a) * s];
  };
  const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a: V3): V3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };

  // ---- leaves over the crowns: two shades a kind, light ones toward the top -------
  const shades: Record<TreeKind, [RGB, RGB]> = {
    pink: [[1, 0.74, 0.83], [0.9, 0.47, 0.63]],
    rose: [[0.97, 0.52, 0.68], [0.76, 0.27, 0.46]],
    violet: [[0.76, 0.63, 0.95], [0.5, 0.36, 0.74]],
    green: [[0.5, 0.68, 0.33], [0.27, 0.45, 0.22]],
  };
  const light: Record<TreeKind, Quads> = { pink: new Quads(), rose: new Quads(), violet: new Quads(), green: new Quads() };
  const dark: Record<TreeKind, Quads> = { pink: new Quads(), rose: new Quads(), violet: new Quads(), green: new Quads() };
  const fallen: Record<'pink' | 'violet', Quads> = { pink: new Quads(), violet: new Quads() };
  for (const t of TREES) {
    const y = groundAt(t.x, t.z) ?? 0;
    const top: V3 = [t.x + t.lean * t.height * 0.5, y + t.height, t.z + Math.cos(t.turn) * t.lean * t.height * 0.3];
    const lumps: [V3, number][] = [[top, t.crown]];
    for (let k = 0; k < 2; k++) {
      const a = t.turn / 57.3 + 1.3 + k * 2.6;
      lumps.push([[top[0] + Math.cos(a) * t.crown * 0.75, top[1] - t.crown * (0.25 + 0.2 * k), top[2] + Math.sin(a) * t.crown * 0.75], t.crown * 0.55]);
    }
    for (const [centre, size] of lumps) {
      const count = Math.round(150 * size * size * 0.42 * share);
      for (let i = 0; i < count; i++) {
        const d = unit();
        if (d[1] < -0.55) continue;
        // On the lump's skin, a little in or out, so the outline is ragged.
        const reach = size * (0.86 + 0.26 * rand());
        const at: V3 = [centre[0] + d[0] * reach * 0.98, centre[1] + d[1] * reach * 0.66, centre[2] + d[2] * reach * 0.98];
        const along = norm(cross(d, unit()));
        const side = norm(cross(d, along));
        // Tilted out of the skin, like a leaf on a twig.
        const tilt = (rand() - 0.3) * 0.9;
        const out: V3 = norm([along[0] + d[0] * tilt, along[1] + d[1] * tilt - 0.15, along[2] + d[2] * tilt]);
        const length = (0.34 + 0.3 * rand()) / Math.sqrt(share);
        const isLight = d[1] + (rand() - 0.5) * 0.7 > 0.25;
        leaf((isLight ? light : dark)[t.kind], at, out, side, length, length * 0.62, norm([d[0], d[1] + 0.35, d[2]]));
      }
    }
    // Fallen blossom on the ground under it.
    if (t.kind !== 'green') {
      const into = fallen[t.kind === 'violet' ? 'violet' : 'pink'];
      for (let i = 0; i < 260 * share; i++) {
        const a = rand() * Math.PI * 2,
          r = Math.sqrt(rand()) * t.crown * 1.7;
        const x = t.x + Math.cos(a) * r,
          z = t.z + Math.sin(a) * r;
        if (waterEdge(x, z) < 0.15) continue;
        // In the grass they lie on the blades' tips; on the path, on the ground.
        const lift = grassGrows(x, z) ? 0.12 + 0.1 * rand() : 0.035;
        const b = rand() * Math.PI * 2;
        const s = 0.07 + 0.06 * rand();
        leaf(into, [x, heightAt(x, z) + lift, z], [Math.cos(b), 0.15 * (rand() - 0.5), Math.sin(b)], [-Math.sin(b), 0.2 * (rand() - 0.5), Math.cos(b)], s, s * 0.75, [0, 1, 0]);
      }
    }
  }
  for (const kind of Object.keys(light) as TreeKind[]) {
    put(light[kind], shades[kind][0], { wind: true, cast });
    put(dark[kind], shades[kind][1], { wind: true, cast });
  }
  put(fallen.pink, [1, 0.72, 0.82]);
  put(fallen.violet, [0.8, 0.68, 0.97]);

  // ---- flowers in the lawn: clumps of white stars on stems, and low violet ones -----
  {
    const stems = new Quads(),
      white = new Quads(),
      hearts = new Quads(),
      violet = new Quads();
    for (let tries = 0, clumps = 0; tries < 6000 && clumps < 190 * share; tries++) {
      const cx = -36 + rand() * 72,
        cz = -36 + rand() * 72;
      // Along the path and the water's edge, and here and there in the open.
      const near = Math.min(pathDistance(cx, cz) - 1, waterEdge(cx, cz) - 0.9);
      if (!grassGrows(cx, cz) || near < 0.15 || (near > 2.2 && noise(cx * 0.4, cz * 0.4) < 0.72)) continue;
      clumps++;
      const tall = rand() < 0.55;
      const n = tall ? 5 + Math.floor(rand() * 5) : 9 + Math.floor(rand() * 8);
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2,
          r = Math.sqrt(rand()) * (tall ? 0.5 : 0.7);
        const x = cx + Math.cos(a) * r,
          z = cz + Math.sin(a) * r;
        const y = heightAt(x, z);
        const h = tall ? 0.42 + 0.22 * rand() : 0.16 + 0.08 * rand();
        const lean: V3 = [(rand() - 0.5) * 0.14, 1, (rand() - 0.5) * 0.14];
        const head: V3 = [x + lean[0] * h, y + h, z + lean[2] * h];
        const b = rand() * Math.PI * 2;
        const side: V3 = [Math.cos(b), 0, Math.sin(b)];
        leaf(stems, [x + lean[0] * h * 0.5, y + h * 0.5, z + lean[2] * h * 0.5], norm(lean), side, h, 0.022, [0, 1, 0]);
        if (tall) {
          // two long leaves from the foot
          for (let k = 0; k < 2; k++) {
            const c = b + 1.2 + k * 2.4;
            leaf(stems, [x + Math.cos(c) * 0.07, y + h * 0.36, z + Math.sin(c) * 0.07], norm([Math.cos(c) * 0.35, 1, Math.sin(c) * 0.35]), [-Math.sin(c), 0, Math.cos(c)], h * 0.8, 0.05, [0, 1, 0]);
          }
        }
        // The flower faces up and a little toward its lean: six petals round a heart.
        const size = tall ? 0.085 : 0.045;
        const into = tall ? white : violet;
        for (let k = 0; k < 6; k++) {
          const c = b + (k / 6) * Math.PI * 2;
          const dir: V3 = norm([Math.cos(c), 0.28, Math.sin(c)]);
          leaf(into, [head[0] + dir[0] * size * 0.6, head[1] + dir[1] * size * 0.6, head[2] + dir[2] * size * 0.6], dir, [-Math.sin(c), 0, Math.cos(c)], size * 1.25, size * 0.7, [0, 1, 0]);
        }
        if (tall) leaf(hearts, [head[0], head[1] + 0.02, head[2]], [1, 0, 0], [0, 0, 1], size * 0.7, size * 0.7, [0, 1, 0]);
      }
    }
    put(stems, [0.3, 0.52, 0.24], { wind: true });
    put(white, [0.98, 0.97, 0.9], { wind: true, roughness: 0.6 });
    put(hearts, [0.98, 0.78, 0.2], { wind: true });
    put(violet, [0.66, 0.56, 0.95], { wind: true });
  }

  return {
    dispose() {
      for (const o of owned.reverse()) o.dispose();
      for (const m of materials) m.destroy();
    },
  };
}
