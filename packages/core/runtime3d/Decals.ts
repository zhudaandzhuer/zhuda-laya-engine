/**
 * A mark laid on a flat surface: a stain, a wet patch, a scorch, a painted
 * line. A rectangle a few millimetres off the surface, drawn with alpha, lit
 * and shadowed like the surface under it (a physically based material of its
 * own colour and roughness: a dark smooth mark on rough ground reads as wet).
 *
 * Its outline is baked into a small picture when it is made: an oval with a
 * broken, soft edge (`blob`), a rectangle with a soft edge (`patch`), or a
 * ring. It lies on a plane: it does not wrap round a corner or follow a
 * bump, and it is not projected onto what happens to be under it.
 */
import {
  ZhudaDynamicMesh,
  computeMeshTangents,
  createSurfaceMaterial,
  createSurfaceTexture,
  disposeSurfaceMaterial,
} from './Surfaces.ts';

export type ZhudaDecalShape = 'blob' | 'patch' | 'ring';

export interface ZhudaDecalOptions {
  /** Centre of the mark on the surface, world metres. */
  position: readonly number[];
  /** Width and length in metres. */
  size: readonly number[];
  /** The way the surface faces, a direction (default [0, 1, 0]: a floor). */
  normal?: readonly number[];
  /** Turns the mark about that direction, degrees (default 0). */
  angleDeg?: number;
  /** The mark's colour as LayaAir takes surface colours, RGB 0..1 (default [0.02, 0.02, 0.02]). */
  color?: readonly number[];
  /** How much of the surface it covers at its middle, 0..1 (default 0.8). */
  opacity?: number;
  /** Roughness of the mark, 0..1 (default 0.6); low is wet or glossy. */
  roughness?: number;
  /** `blob` (default), `patch` or `ring`. */
  shape?: ZhudaDecalShape;
  /** How wide the soft edge is, as a share of the mark, 0..1 (default 0.35). */
  edge?: number;
  /** How ragged a blob's outline is, 0..1 (default 0.5). */
  ragged?: number;
  /** Which outline: the same seed gives the same mark (default 1). */
  seed?: number;
  /** Side of the baked picture: 64, 128 or 256 (default 128). */
  resolution?: 64 | 128 | 256;
  /** Height off the surface in metres, 0.0005..0.05 (default 0.004). */
  lift?: number;
}

const DECAL_KEYS = [
  'position',
  'size',
  'normal',
  'angleDeg',
  'color',
  'opacity',
  'roughness',
  'shape',
  'edge',
  'ragged',
  'seed',
  'resolution',
  'lift',
] as const;

const numbers = (value: unknown, length: number, most: number) =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= most);

export function validateZhudaDecal(options: ZhudaDecalOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as unknown as Record<string, unknown>;
  for (const key of Object.keys(o))
    if (!(DECAL_KEYS as readonly string[]).includes(key))
      issues.push(`${key}: unknown option (${DECAL_KEYS.join(', ')})`);
  if (!numbers(o.position, 3, 100000)) issues.push('position: use [x, y, z] in metres');
  if (!numbers(o.size, 2, 1000) || !(o.size as number[]).every((n) => n > 0))
    issues.push('size: use [width, length] in metres, both above 0');
  if (o.normal !== undefined) {
    if (!numbers(o.normal, 3, 1000) || Math.hypot(...(o.normal as number[])) < 1e-6)
      issues.push('normal: use a direction [x, y, z]');
  }
  const range = (key: string, min: number, max: number) => {
    const value = o[key];
    if (value !== undefined && !(typeof value === 'number' && value >= min && value <= max))
      issues.push(`${key}: use ${min}..${max}`);
  };
  range('angleDeg', -360000, 360000);
  if (
    o.color !== undefined &&
    !(numbers(o.color, 3, 1) && (o.color as number[]).every((n) => n >= 0))
  )
    issues.push('color: use [r, g, b] of 0..1');
  range('opacity', 0, 1);
  range('roughness', 0, 1);
  if (o.shape !== undefined && !['blob', 'patch', 'ring'].includes(o.shape as string))
    issues.push('shape: use blob, patch or ring');
  range('edge', 0, 1);
  range('ragged', 0, 1);
  if (o.seed !== undefined && !(Number.isInteger(o.seed) && (o.seed as number) >= 0))
    issues.push('seed: use a whole number of 0 or more');
  if (o.resolution !== undefined && ![64, 128, 256].includes(o.resolution as number))
    issues.push('resolution: use 64, 128 or 256');
  range('lift', 0.0005, 0.05);
  return issues;
}

export function resolveZhudaDecal(options: ZhudaDecalOptions): Required<ZhudaDecalOptions> {
  return {
    position: [...options.position],
    size: [...options.size],
    normal: options.normal ? [...options.normal] : [0, 1, 0],
    angleDeg: options.angleDeg ?? 0,
    color: options.color ? [...options.color] : [0.02, 0.02, 0.02],
    opacity: options.opacity ?? 0.8,
    roughness: options.roughness ?? 0.6,
    shape: options.shape ?? 'blob',
    edge: options.edge ?? 0.35,
    ragged: options.ragged ?? 0.5,
    seed: options.seed ?? 1,
    resolution: options.resolution ?? 128,
    lift: options.lift ?? 0.004,
  };
}

/** A repeatable number 0..1 for a grid point and a seed. */
const hash = (x: number, y: number, seed: number) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
/** Smooth noise 0..1 that repeats every `period` along x (an angle going round). */
const ringNoise = (x: number, y: number, period: number, seed: number) => {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    fx = x - x0,
    fy = y - y0,
    sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const at = (i: number, j: number) => hash(((i % period) + period) % period, j, seed);
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx,
    bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
};
const smooth = (edge0: number, edge1: number, value: number) => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * How much of the mark there is at each texel, 0..255: `size * size` values,
 * row 0 first. Nothing reaches the border of the picture, so the rectangle's
 * own edge never shows.
 */
export function bakeZhudaDecalMask(options: {
  shape: ZhudaDecalShape;
  edge: number;
  ragged: number;
  seed: number;
  resolution: number;
}): Uint8Array {
  const n = options.resolution,
    out = new Uint8Array(n * n);
  const soft = Math.max(options.edge, 2 / n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      // -1..1 across the picture.
      const x = ((i + 0.5) / n) * 2 - 1,
        y = ((j + 0.5) / n) * 2 - 1;
      let amount: number;
      if (options.shape === 'patch') {
        // A rectangle that stops a texel short of the border.
        const reach = Math.max(Math.abs(x), Math.abs(y));
        amount = 1 - smooth(1 - soft - 2 / n, 1 - 2 / n, reach);
      } else {
        const r = Math.hypot(x, y),
          turn = (Math.atan2(y, x) / (Math.PI * 2) + 0.5) * 12;
        // The outline moves in and out as it goes round.
        const rim =
          0.96 -
          (options.shape === 'blob'
            ? options.ragged *
              0.45 *
              (0.65 * ringNoise(turn, 0.5, 12, options.seed) +
                0.35 * ringNoise(turn * 2, 7.5, 24, options.seed + 17))
            : 0);
        amount = 1 - smooth(rim * (1 - soft), rim, r);
        if (options.shape === 'ring') amount *= smooth(rim * 0.45, rim * (0.45 + soft * 0.55), r);
        // Thinner in places inside a blob, so that it is not one flat tone.
        else if (options.ragged > 0)
          amount *=
            1 - options.ragged * 0.35 * ringNoise(x * 3 + 20, y * 3 + 20, 64, options.seed + 5);
      }
      out[j * n + i] = Math.round(Math.min(1, Math.max(0, amount)) * 255);
    }
  return out;
}

const cross = (a: readonly number[], b: readonly number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: readonly number[]) => {
  const length = Math.hypot(a[0], a[1], a[2]);
  return a.map((v) => v / length);
};

/**
 * The rectangle of a decal: four corners `lift` off the surface, its width
 * along the first axis and its length along the second, both lying in the
 * surface and turned by `angleDeg` about its normal.
 */
export function zhudaDecalQuad(options: Required<ZhudaDecalOptions>) {
  const n = unit(options.normal);
  // Any direction in the surface; on a floor, world X.
  const seed = Math.abs(n[1]) > 0.999 ? [1, 0, 0] : [0, 1, 0];
  let u = unit(cross(seed, n));
  if (Math.abs(n[1]) > 0.999) u = unit(cross(n, cross(seed, n)));
  let v = cross(n, u);
  const a = (options.angleDeg * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const u2 = u.map((x, i) => x * c + v[i] * s);
  v = v.map((x, i) => x * c - u[i] * s);
  u = u2;
  const [w, d] = options.size;
  const corner = (su: number, sv: number) =>
    options.position.map(
      (p, i) => p + n[i] * options.lift + u[i] * su * (w / 2) + v[i] * sv * (d / 2),
    );
  const corners = [corner(-1, -1), corner(-1, 1), corner(1, 1), corner(1, -1)];
  // The engine's winding: seen from the side the normal points to.
  const face = cross(
    corners[1].map((p, i) => p - corners[0][i]),
    corners[2].map((p, i) => p - corners[0][i]),
  );
  const flip = face[0] * n[0] + face[1] * n[1] + face[2] * n[2] > 0;
  return {
    positions: new Float32Array(corners.flat()),
    normals: new Float32Array([...n, ...n, ...n, ...n]),
    uvs: new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
    indices: new Uint16Array(flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]),
  };
}

export class ZhudaDecal {
  /** The node that draws the mark (a `MeshSprite3D`). */
  readonly node: any;
  private readonly mesh: ZhudaDynamicMesh;
  private readonly material: any;
  private readonly texture: any;
  private disposed = false;

  constructor(scene: any, options: ZhudaDecalOptions) {
    const issues = validateZhudaDecal(options);
    if (issues.length) throw Error('Invalid decal: ' + issues.join('; '));
    const o = resolveZhudaDecal(options);
    const mask = bakeZhudaDecalMask(o),
      n = o.resolution,
      pixels = new Uint8Array(n * n * 4);
    // White with the mark in alpha: the colour comes from the material.
    for (let i = 0; i < n * n; i++) {
      pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 255;
      pixels[i * 4 + 3] = mask[i];
    }
    this.texture = createSurfaceTexture(n, n, pixels, 'color', { mipmap: true });
    const l = (globalThis as any).Laya;
    this.texture.wrapModeU = this.texture.wrapModeV = l.WrapMode.Clamp;
    try {
      this.material = createSurfaceMaterial({
        type: 'pbr',
        color: [o.color[0], o.color[1], o.color[2], o.opacity],
        metallic: 0,
        roughness: o.roughness,
        textures: { albedo: this.texture },
        blend: 'alpha',
        depthWrite: false,
      });
    } catch (error) {
      this.texture.destroy();
      throw error;
    }
    try {
      const quad = zhudaDecalQuad(o);
      this.mesh = new ZhudaDynamicMesh({ ...quad, tangents: computeMeshTangents(quad) }, scene);
    } catch (error) {
      disposeSurfaceMaterial(this.material);
      this.texture.destroy();
      throw error;
    }
    this.node = this.mesh.node;
    const renderer = this.node.meshRenderer;
    renderer.sharedMaterial = this.material;
    renderer.castShadow = false;
    renderer.receiveShadow = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    disposeSurfaceMaterial(this.material);
    this.texture.destroy();
  }
}
