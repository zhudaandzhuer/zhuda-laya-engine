/**
 * Declarative procedural PBR textures.
 *
 * A recipe is plain JSON: a base surface plus ordered layers, each selected by
 * a seamless mask. Baking is deterministic CPU work (no GPU, no canvas), so
 * the same recipe gives byte-identical maps in Node, a Worker and a browser.
 * The result follows the engine's existing texture contract: sRGB albedo,
 * tangent-space normal and Laya metallic-gloss packing.
 *
 * A baked set proves the data contract only. How it looks on a device still
 * requires a real draw.
 */
import { cellularNoise, fractalNoise } from './Noise.ts';

export type ZhudaLinearColor = [number, number, number];
type Range = [number, number];
type Frequency = number | [number, number];

export type ZhudaTextureMask =
  | { type: 'constant'; value?: number }
  | { type: 'fbm'; frequency: Frequency; octaves?: number; seed?: number; range?: Range }
  | {
      type: 'cells';
      frequency: Frequency;
      /** distance: 0 at a cell centre; edge: 0 on cell borders; id: one random value per cell. */
      mode?: 'distance' | 'edge' | 'id';
      seed?: number;
      range?: Range;
    }
  | {
      type: 'stripes';
      axis: 'u' | 'v';
      count: number;
      /** sine: smooth ridge per stripe; square: 1 for the first `duty` of each stripe. */
      profile?: 'sine' | 'square';
      duty?: number;
      range?: Range;
    }
  | { type: 'bricks'; columns: number; rows: number; mortar: number; range?: Range };

export interface ZhudaTextureLayer {
  name?: string;
  mask: ZhudaTextureMask;
  /** Optional second mask multiplied into the first, e.g. rust only inside grooves. */
  within?: ZhudaTextureMask;
  opacity?: number;
  /** Linear RGB, 0..1. */
  color?: ZhudaLinearColor;
  roughness?: number;
  metallic?: number;
  /** Signed relief in millimetres where the mask is 1. */
  heightMm?: number;
}

export interface ZhudaTextureRecipe {
  schemaVersion: 1;
  id: string;
  /** Real size of one tile in metres along u and v. */
  tileMeters: [number, number];
  seed?: number;
  base: { color: ZhudaLinearColor; roughness: number; metallic: number };
  layers?: ZhudaTextureLayer[];
}

export interface ZhudaTextureBakeOptions {
  /** Power of two, 16..2048. CPU cost grows with size squared times layer count. */
  size?: number;
  /** Laya's native normal maps use -Y ('directx'). */
  normalConvention?: 'directx' | 'opengl';
}

export interface ZhudaBakedTextureSet {
  readonly id: string;
  readonly size: number;
  readonly tileMeters: [number, number];
  readonly normalConvention: 'directx' | 'opengl';
  /** RGBA8, sRGB-encoded colour. Row 0 is v = 0. */
  readonly albedo: Uint8Array;
  /** RGBA8 tangent-space normal. */
  readonly normal: Uint8Array;
  /** RGBA8 in Laya packing: R = metallic, A = smoothness (1 - roughness). */
  readonly metallicGloss: Uint8Array;
  /** Relief in metres, row-major, same resolution. */
  readonly height: Float32Array;
  /** Bytes held by the three RGBA maps. */
  readonly bytes: number;
}

const ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const unit = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const wholeIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

function frequencyOf(value: Frequency): [number, number] {
  return Array.isArray(value) ? value : [value, value];
}

function validateMask(mask: unknown, path: string, issues: string[]): void {
  if (!mask || typeof mask !== 'object' || Array.isArray(mask)) {
    issues.push(`${path}: mask must be an object`);
    return;
  }
  const m = mask as Record<string, unknown>;
  const checkFrequency = () => {
    const f = m.frequency;
    const pair = Array.isArray(f) ? f : [f, f];
    if (pair.length !== 2 || !pair.every((n) => wholeIn(n, 1, 512)))
      issues.push(`${path}.frequency: use integers 1..512 so the tile stays seamless`);
  };
  if (m.range !== undefined) {
    const r = m.range;
    if (!Array.isArray(r) || r.length !== 2 || !r.every(unit) || r[0] === r[1])
      issues.push(`${path}.range: use two different values in 0..1`);
  }
  if (m.seed !== undefined && !wholeIn(m.seed, 0, 0x7fffffff))
    issues.push(`${path}.seed: use a non-negative integer`);
  switch (m.type) {
    case 'constant':
      if (m.value !== undefined && !unit(m.value)) issues.push(`${path}.value: use 0..1`);
      break;
    case 'fbm':
      checkFrequency();
      if (m.octaves !== undefined && !wholeIn(m.octaves, 1, 8))
        issues.push(`${path}.octaves: use an integer 1..8`);
      break;
    case 'cells':
      checkFrequency();
      if (m.mode !== undefined && !['distance', 'edge', 'id'].includes(m.mode as string))
        issues.push(`${path}.mode: use distance, edge or id`);
      break;
    case 'stripes':
      if (m.axis !== 'u' && m.axis !== 'v') issues.push(`${path}.axis: use u or v`);
      if (!wholeIn(m.count, 1, 512)) issues.push(`${path}.count: use an integer 1..512`);
      if (m.profile !== undefined && m.profile !== 'sine' && m.profile !== 'square')
        issues.push(`${path}.profile: use sine or square`);
      if (m.duty !== undefined && !(finite(m.duty) && m.duty > 0 && m.duty < 1))
        issues.push(`${path}.duty: use a value between 0 and 1`);
      break;
    case 'bricks':
      if (!wholeIn(m.columns, 1, 256)) issues.push(`${path}.columns: use an integer 1..256`);
      if (!wholeIn(m.rows, 2, 256) || (m.rows as number) % 2)
        issues.push(`${path}.rows: use an even integer 2..256 so the offset bond tiles`);
      if (!(finite(m.mortar) && m.mortar > 0 && m.mortar < 0.5))
        issues.push(`${path}.mortar: use a cell fraction between 0 and 0.5`);
      break;
    default:
      issues.push(`${path}.type: unknown mask type ${String(m.type)}`);
  }
}

const colorOk = (value: unknown) =>
  Array.isArray(value) && value.length === 3 && value.every(unit);

/** Returns every problem found; an empty list means the recipe can be baked. */
export function validateZhudaTextureRecipe(recipe: unknown): string[] {
  const issues: string[] = [];
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe))
    return ['recipe must be an object'];
  const r = recipe as Record<string, unknown>;
  if (r.schemaVersion !== 1) issues.push('schemaVersion: must be 1');
  if (typeof r.id !== 'string' || !ID.test(r.id))
    issues.push('id: use lowercase letters, digits, dot, dash or underscore (1..64)');
  const tile = r.tileMeters;
  if (
    !Array.isArray(tile) ||
    tile.length !== 2 ||
    !tile.every((n) => finite(n) && n > 0 && n <= 1000)
  )
    issues.push('tileMeters: use two sizes in metres, each above 0 and at most 1000');
  if (r.seed !== undefined && !wholeIn(r.seed, 0, 0x7fffffff))
    issues.push('seed: use a non-negative integer');
  const base = r.base as Record<string, unknown> | undefined;
  if (!base || typeof base !== 'object') issues.push('base: required');
  else {
    if (!colorOk(base.color)) issues.push('base.color: use linear RGB with each channel in 0..1');
    if (!unit(base.roughness)) issues.push('base.roughness: use 0..1');
    if (!unit(base.metallic)) issues.push('base.metallic: use 0..1');
  }
  if (r.layers !== undefined) {
    if (!Array.isArray(r.layers) || r.layers.length > 32)
      issues.push('layers: use an array of at most 32 layers');
    else
      r.layers.forEach((layer: unknown, index: number) => {
        const path = `layers[${index}]`;
        if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
          issues.push(`${path}: layer must be an object`);
          return;
        }
        const l = layer as Record<string, unknown>;
        validateMask(l.mask, `${path}.mask`, issues);
        if (l.within !== undefined) validateMask(l.within, `${path}.within`, issues);
        if (l.opacity !== undefined && !unit(l.opacity)) issues.push(`${path}.opacity: use 0..1`);
        if (l.color !== undefined && !colorOk(l.color))
          issues.push(`${path}.color: use linear RGB with each channel in 0..1`);
        if (l.roughness !== undefined && !unit(l.roughness))
          issues.push(`${path}.roughness: use 0..1`);
        if (l.metallic !== undefined && !unit(l.metallic))
          issues.push(`${path}.metallic: use 0..1`);
        if (l.heightMm !== undefined && !(finite(l.heightMm) && Math.abs(l.heightMm) <= 500))
          issues.push(`${path}.heightMm: use a relief between -500 and 500 millimetres`);
        if (
          l.color === undefined &&
          l.roughness === undefined &&
          l.metallic === undefined &&
          l.heightMm === undefined
        )
          issues.push(`${path}: set at least one of color, roughness, metallic or heightMm`);
      });
  }
  return issues;
}

const scratch: number[] = [0, 0, 0];
const fract = (value: number) => value - Math.floor(value);

/**
 * Evaluates one mask at a tile coordinate; the result is in 0..1 and repeats
 * with period 1 in both u and v.
 */
export function evaluateZhudaTextureMask(
  mask: ZhudaTextureMask,
  u: number,
  v: number,
  seed = 0,
): number {
  let value: number;
  switch (mask.type) {
    case 'constant':
      return mask.value ?? 1;
    case 'fbm': {
      const [fx, fy] = frequencyOf(mask.frequency);
      value = fractalNoise(u, v, fx, fy, mask.octaves ?? 4, seed + (mask.seed ?? 0));
      break;
    }
    case 'cells': {
      const [fx, fy] = frequencyOf(mask.frequency);
      cellularNoise(u * fx, v * fy, fx, fy, seed + (mask.seed ?? 0), scratch);
      value =
        mask.mode === 'id'
          ? scratch[2]
          : mask.mode === 'edge'
            ? Math.min(1, scratch[1] - scratch[0])
            : Math.min(1, scratch[0]);
      break;
    }
    case 'stripes': {
      const phase = fract((mask.axis === 'u' ? u : v) * mask.count);
      value =
        mask.profile === 'square'
          ? phase < (mask.duty ?? 0.5)
            ? 1
            : 0
          : 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
      break;
    }
    case 'bricks': {
      const row = Math.floor(fract(v) * mask.rows),
        cu = fract(u * mask.columns + (row % 2) * 0.5),
        cv = fract(v * mask.rows),
        half = mask.mortar / 2;
      value = Math.min(cu, 1 - cu) < half || Math.min(cv, 1 - cv) < half ? 1 : 0;
      break;
    }
  }
  if (mask.range) {
    const t = Math.min(1, Math.max(0, (value - mask.range[0]) / (mask.range[1] - mask.range[0])));
    value = t * t * (3 - 2 * t);
  }
  return value;
}

const toSrgb8 = (linear: number) => {
  const c = linear <= 0 ? 0 : linear >= 1 ? 1 : linear;
  return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
};
const to8 = (value: number) => Math.round((value <= 0 ? 0 : value >= 1 ? 1 : value) * 255);

/** Bakes a validated recipe on the CPU. Throws with every validation issue listed. */
export function bakeZhudaTextureSet(
  recipe: ZhudaTextureRecipe,
  options: ZhudaTextureBakeOptions = {},
): ZhudaBakedTextureSet {
  const issues = validateZhudaTextureRecipe(recipe);
  if (issues.length) throw Error(`Invalid texture recipe: ${issues.join('; ')}`);
  const size = options.size ?? 256;
  if (!Number.isInteger(size) || size < 16 || size > 2048 || (size & (size - 1)) !== 0)
    throw Error('Bake size must be a power of two between 16 and 2048');
  const normalConvention = options.normalConvention ?? 'directx';
  if (normalConvention !== 'directx' && normalConvention !== 'opengl')
    throw Error('normalConvention must be directx or opengl');

  const layers = recipe.layers ?? [],
    seed = Math.imul(recipe.seed ?? 0, 0x9e37) | 0,
    pixels = size * size,
    albedo = new Uint8Array(pixels * 4),
    normal = new Uint8Array(pixels * 4),
    metallicGloss = new Uint8Array(pixels * 4),
    height = new Float32Array(pixels);

  for (let j = 0; j < size; j++) {
    const v = (j + 0.5) / size;
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size;
      let r = recipe.base.color[0],
        g = recipe.base.color[1],
        b = recipe.base.color[2],
        roughness = recipe.base.roughness,
        metallic = recipe.base.metallic,
        relief = 0;
      for (let k = 0; k < layers.length; k++) {
        const layer = layers[k];
        let amount = evaluateZhudaTextureMask(layer.mask, u, v, seed + k * 101);
        if (layer.within) amount *= evaluateZhudaTextureMask(layer.within, u, v, seed + k * 101 + 53);
        amount *= layer.opacity ?? 1;
        if (amount <= 0) continue;
        if (layer.color) {
          r += (layer.color[0] - r) * amount;
          g += (layer.color[1] - g) * amount;
          b += (layer.color[2] - b) * amount;
        }
        if (layer.roughness !== undefined) roughness += (layer.roughness - roughness) * amount;
        if (layer.metallic !== undefined) metallic += (layer.metallic - metallic) * amount;
        if (layer.heightMm !== undefined) relief += layer.heightMm * 0.001 * amount;
      }
      const p = j * size + i,
        o = p * 4;
      albedo[o] = toSrgb8(r);
      albedo[o + 1] = toSrgb8(g);
      albedo[o + 2] = toSrgb8(b);
      albedo[o + 3] = 255;
      metallicGloss[o] = to8(metallic);
      metallicGloss[o + 1] = 255;
      metallicGloss[o + 3] = to8(1 - roughness);
      height[p] = relief;
    }
  }

  // Central differences with wrap-around keep the normal map seamless too.
  const stepU = (2 * recipe.tileMeters[0]) / size,
    stepV = (2 * recipe.tileMeters[1]) / size,
    flipY = normalConvention === 'directx' ? -1 : 1;
  for (let j = 0; j < size; j++) {
    const up = ((j + 1) % size) * size,
      down = ((j - 1 + size) % size) * size;
    for (let i = 0; i < size; i++) {
      const right = (i + 1) % size,
        left = (i - 1 + size) % size,
        nx = -(height[j * size + right] - height[j * size + left]) / stepU,
        ny = -(height[up + i] - height[down + i]) / stepV,
        scale = 1 / Math.hypot(nx, ny, 1),
        o = (j * size + i) * 4;
      normal[o] = Math.round((nx * scale * 0.5 + 0.5) * 255);
      normal[o + 1] = Math.round((ny * scale * flipY * 0.5 + 0.5) * 255);
      normal[o + 2] = Math.round((scale * 0.5 + 0.5) * 255);
      normal[o + 3] = 255;
    }
  }

  return {
    id: recipe.id,
    size,
    tileMeters: [recipe.tileMeters[0], recipe.tileMeters[1]],
    normalConvention,
    albedo,
    normal,
    metallicGloss,
    height,
    bytes: pixels * 12,
  };
}

/** Short stable fingerprint (FNV-1a) of the three maps, for determinism evidence. */
export function fingerprintZhudaTextureSet(set: ZhudaBakedTextureSet): string {
  let h = 0x811c9dc5;
  for (const map of [set.albedo, set.normal, set.metallicGloss])
    for (let i = 0; i < map.length; i++) h = Math.imul(h ^ map[i], 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}
