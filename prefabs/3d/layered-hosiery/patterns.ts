// Stockings: the kinds a player can put on, and the tiles their yarn is drawn
// from. A tile is packed as the hook reads it: red and green the slope of the
// yarn (128 is flat), blue how much yarn stands there, alpha half the squared
// slope (so mipmaps keep how rough a far knit is).
//
// The kinds follow the usual hosiery terms: denier bands from ultra sheer (10
// and under) through sheer (about 20), semi-opaque (30-40) and opaque (above
// 40); a glossy finish; a mock back seam; a lace-top stocking; fishnet in
// micronet, classic and whale-net sizes; ribbed tights; plumetis dots.

export interface Tile {
  size: number;
  pixels: Uint8Array;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Packs a height field (0..1, size x size, wrapping) into a tile. */
function pack(height: Float32Array, size: number, steepness: number): Tile {
  const at = (column: number, row: number) => height[((row + size) % size) * size + ((column + size) % size)];
  const clamp = (v: number) => Math.min(1, Math.max(-1, v));
  const pixels = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++)
    for (let column = 0; column < size; column++) {
      const k = (row * size + column) * 4;
      const sx = clamp((at(column - 1, row) - at(column + 1, row)) * steepness),
        sy = clamp((at(column, row - 1) - at(column, row + 1)) * steepness);
      pixels[k] = 128 + Math.round(127 * sx);
      pixels[k + 1] = 128 + Math.round(127 * sy);
      pixels[k + 2] = Math.round(255 * at(column, row));
      pixels[k + 3] = Math.round(255 * (sx * sx + sy * sy) * 0.5);
    }
  return { size, pixels };
}

/** Plain knit: one wale across, two courses up. `width` is the yarn against the stitch (0.62 thin .. 2.05 thick). */
export function knitTile(width: number, size = 128): Tile {
  const height = new Float32Array(size * size);
  for (let row = 0; row < size; row++)
    for (let column = 0; column < size; column++) {
      const x = column / size,
        y = (row / size) * 2;
      let h = 0;
      for (let course = -1; course <= 2; course++) {
        const along = y - course,
          across = x + (course % 2) * 0.5,
          turn = Math.PI * 2 * across;
        const spread = 0.17 * Math.sin(Math.PI * (along + 0.07)) + 0.13;
        const off = Math.abs(Math.abs(across - Math.round(across)) - spread);
        const leg = Math.exp(-((off / (0.072 * width)) ** 2)) * smooth(-0.09, 0.09, along) * (1 - smooth(0.71, 0.96, along));
        const head = Math.exp(-(((along - 0.88 - 0.13 * Math.cos(turn)) / (0.13 * width)) ** 2));
        h = Math.max(h, leg * (0.87 + 0.13 * Math.cos(turn)) + head * 0.62);
      }
      height[row * size + column] = Math.min(1, h);
    }
  return pack(height, size, 2.8);
}

/** A fishnet cell: two strands crossing on the diagonals, a knot where they meet. Holes stand at zero. */
export function netTile(strand: number, size = 128): Tile {
  const height = new Float32Array(size * size);
  for (let row = 0; row < size; row++)
    for (let column = 0; column < size; column++) {
      const x = column / size,
        y = row / size;
      const a = Math.abs(((x + y) % 1) - 0.5),
        b = Math.abs((((x - y) % 1) + 1) % 1 - 0.5);
      // Distance to the nearest strand: the lines where x+y or x-y is a whole number
      // (a and b are how far those sums are from the half between two whole numbers).
      const d1 = (0.5 - a) / Math.SQRT2,
        d2 = (0.5 - b) / Math.SQRT2;
      const s1 = Math.exp(-((d1 / strand) ** 2)),
        s2 = Math.exp(-((d2 / strand) ** 2));
      // Knots at the crossings (the corners and the middle of the tile).
      const kx = Math.min(x, 1 - x, Math.abs(x - 0.5)),
        ky = Math.min(y, 1 - y, Math.abs(y - 0.5));
      const onCorner = (Math.min(x, 1 - x) < 0.25) === (Math.min(y, 1 - y) < 0.25);
      const knot = onCorner ? Math.exp(-((Math.hypot(kx, ky) / (strand * 1.9)) ** 2)) : 0;
      height[row * size + column] = Math.min(1, Math.max(s1, s2) * 0.85 + knot * 0.4);
    }
  return pack(height, size, 2.2);
}

/** Ribbed knit: a raised rib and a sunk one across the tile, the loops of the knit on them. */
export function ribTile(size = 128): Tile {
  const knit = knitTile(1.75, size).pixels;
  const height = new Float32Array(size * size);
  for (let row = 0; row < size; row++)
    for (let column = 0; column < size; column++) {
      const x = column / size;
      const rib = 0.5 + 0.5 * Math.cos(Math.PI * 2 * x);
      height[row * size + column] = Math.min(1, 0.45 + 0.4 * rib ** 0.7 + 0.15 * (knit[(row * size + column) * 4 + 2] / 255));
    }
  return pack(height, size, 1.6);
}

export type TileKind = { kind: 'knit'; width: number } | { kind: 'net'; strand: number } | { kind: 'rib' };

export interface StockingType {
  id: string;
  name: string;
  note: string;
  tile: TileKind;
  /** Tiles round the leg and up it. */
  tilesU: number;
  tilesV: number;
  /** How much light a full layer of yarn stops. */
  depth: number;
  /** The coverage left between the yarn (knit 0.36; a net's holes are open: 0). */
  gapFloor: number;
  relief: number;
  grain: number;
  roughness: number;
  sheen: number;
  sheenRoughness: number;
  /** 0..1: a glossy finish (lower roughness, a brighter edge). */
  gloss: number;
  /** How hard it must be pulled before it tears (the pull runs to 1.1). */
  tearAt: number;
  /** How far a tear runs into ladders (0 none: a net does not ladder). */
  ladder: number;
  /** How big its holes are, against a 20 denier knit. */
  holeSize: number;
  seam?: boolean;
  /** A lace top: where the lace starts and where the stocking ends, as a share of the leg's height. */
  lace?: [number, number];
  dots?: boolean;
  /** Lace all over the leg: flowers and leaves on a fine net, open between. */
  fullLace?: boolean;
  /** Garter straps from the lace top up under the skirt, each with a cross. */
  garter?: boolean;
  colors: number[];
}

/** Colours as displayed. */
export const COLORS: Record<number, string> = {
  0x1c1a1e: '黑',
  0xb58a74: '膚',
  0x6a6870: '灰',
  0xe9e6e6: '白',
  0xb9b8bc: '淺灰',
  0x5a1824: '酒紅',
  0x1d2440: '深藍',
};

const TV = 272; // knit courses (two to a tile) up the leg, as the reference has

export const TYPES: StockingType[] = [
  { id: 'ultra8', name: '超薄透膚 8D', note: '幾乎看不見的一層，一拉就破，梯形抽絲最長。', tile: { kind: 'knit', width: 0.62 }, tilesU: 302, tilesV: TV, depth: 0.48, gapFloor: 0.36, relief: 0.8, grain: 0.02, roughness: 0.4, sheen: 0.9, sheenRoughness: 0.6, gloss: 0.1, tearAt: 0.78, ladder: 1, holeSize: 1.1, colors: [0xb58a74, 0x1c1a1e] },
  { id: 'sheer20', name: '輕薄 20D', note: '最常見的透膚絲襪：正面透、邊緣深。', tile: { kind: 'knit', width: 1 }, tilesU: 302, tilesV: TV, depth: 1.34, gapFloor: 0.36, relief: 1, grain: 0.025, roughness: 0.43, sheen: 0.92, sheenRoughness: 0.63, gloss: 0, tearAt: 0.92, ladder: 1, holeSize: 1, colors: [0x1c1a1e, 0xb58a74, 0x6a6870, 0xe9e6e6, 0x5a1824, 0x1d2440] },
  { id: 'semi40', name: '半透 40D', note: '半透半遮，比較耐拉。', tile: { kind: 'knit', width: 1.34 }, tilesU: 302, tilesV: TV, depth: 1.72, gapFloor: 0.36, relief: 1.1, grain: 0.04, roughness: 0.5, sheen: 0.8, sheenRoughness: 0.68, gloss: 0, tearAt: 0.98, ladder: 0.8, holeSize: 0.92, colors: [0x1c1a1e, 0x6a6870, 0x1d2440, 0x5a1824] },
  { id: 'opaque80', name: '不透 80D', note: '幾乎不透膚，要用力才拉得破，破口較小。', tile: { kind: 'knit', width: 1.75 }, tilesU: 302, tilesV: TV, depth: 4.6, gapFloor: 0.36, relief: 1.15, grain: 0.06, roughness: 0.6, sheen: 0.75, sheenRoughness: 0.75, gloss: 0, tearAt: 1.04, ladder: 0.55, holeSize: 0.8, colors: [0x1c1a1e, 0x6a6870, 0x1d2440, 0x5a1824, 0xe9e6e6] },
  { id: 'thick120', name: '厚實 120D', note: '冬天的保暖褲襪，霧面，最難撕。', tile: { kind: 'knit', width: 2.05 }, tilesU: 302, tilesV: TV, depth: 8, gapFloor: 0.36, relief: 0.63, grain: 0.14, roughness: 0.78, sheen: 1, sheenRoughness: 0.88, gloss: 0, tearAt: 1.08, ladder: 0.35, holeSize: 0.72, colors: [0x1c1a1e, 0x6a6870, 0x1d2440] },
  { id: 'glossy15', name: '亮面 15D', note: '有光澤的表面處理，側光下一道亮邊。', tile: { kind: 'knit', width: 0.85 }, tilesU: 302, tilesV: TV, depth: 1.0, gapFloor: 0.36, relief: 0.79, grain: 0.08, roughness: 0.29, sheen: 0.95, sheenRoughness: 0.38, gloss: 0.85, tearAt: 0.88, ladder: 1, holeSize: 1, colors: [0xb58a74, 0x1c1a1e, 0x6a6870] },
  { id: 'seam15', name: '後縫線 15D', note: '腿後一道縫線（現代多為仿縫線），轉到背面看得到。', tile: { kind: 'knit', width: 0.85 }, tilesU: 302, tilesV: TV, depth: 1.0, gapFloor: 0.36, relief: 1, grain: 0.03, roughness: 0.42, sheen: 0.9, sheenRoughness: 0.6, gloss: 0.2, tearAt: 0.88, ladder: 1, holeSize: 1, seam: true, colors: [0x1c1a1e, 0xb58a74] },
  { id: 'lacetop', name: '蕾絲邊大腿襪 20D', note: '襪口一圈蕾絲，上面是裸膚。', tile: { kind: 'knit', width: 1 }, tilesU: 302, tilesV: TV, depth: 1.34, gapFloor: 0.36, relief: 1, grain: 0.025, roughness: 0.43, sheen: 0.92, sheenRoughness: 0.63, gloss: 0.1, tearAt: 0.92, ladder: 1, holeSize: 1, lace: [0.489, 0.555], colors: [0x1c1a1e, 0xe9e6e6, 0xb58a74, 0x5a1824] },
  { id: 'garter', name: '蕾絲吊帶襪（十字）', note: '寬版花朵蕾絲襪口，皮革吊帶上一個十字。', tile: { kind: 'knit', width: 1 }, tilesU: 302, tilesV: TV, depth: 1.34, gapFloor: 0.36, relief: 1, grain: 0.025, roughness: 0.43, sheen: 0.92, sheenRoughness: 0.63, gloss: 0.1, tearAt: 0.92, ladder: 1, holeSize: 1, lace: [0.44, 0.532], garter: true, colors: [0x1c1a1e, 0x5a1824] },
  { id: 'laceTights', name: '蕾絲花紋褲襪', note: '整腿都是鏤空花朵蕾絲，網底很薄，破了只會開洞。', tile: { kind: 'knit', width: 0.62 }, tilesU: 302, tilesV: TV, depth: 2.4, gapFloor: 0, relief: 0.8, grain: 0.02, roughness: 0.55, sheen: 0.8, sheenRoughness: 0.7, gloss: 0, tearAt: 0.86, ladder: 0.15, holeSize: 1.2, fullLace: true, colors: [0xb9b8bc, 0xe9e6e6, 0x1c1a1e] },
  { id: 'micronet', name: '細網 Micronet', note: '網眼很小，遠看像有紋路的絲襪。', tile: { kind: 'net', strand: 0.08 }, tilesU: 180, tilesV: 266, depth: 4, gapFloor: 0, relief: 1.2, grain: 0.02, roughness: 0.5, sheen: 0.7, sheenRoughness: 0.7, gloss: 0, tearAt: 0.9, ladder: 0, holeSize: 1.1, colors: [0x1c1a1e, 0xb58a74] },
  { id: 'fishnet', name: '經典網襪', note: '中等菱形網眼，破了只會開洞，不會抽絲。', tile: { kind: 'net', strand: 0.06 }, tilesU: 120, tilesV: 178, depth: 6, gapFloor: 0, relief: 1.4, grain: 0.02, roughness: 0.5, sheen: 0.6, sheenRoughness: 0.7, gloss: 0, tearAt: 0.86, ladder: 0, holeSize: 1.35, colors: [0x1c1a1e, 0x5a1824, 0xe9e6e6] },
  { id: 'whalenet', name: '大網 Whale net', note: '網眼最大、露膚最多，一扯就斷。', tile: { kind: 'net', strand: 0.04 }, tilesU: 32, tilesV: 47, depth: 7, gapFloor: 0, relief: 1.5, grain: 0.02, roughness: 0.55, sheen: 0.5, sheenRoughness: 0.75, gloss: 0, tearAt: 0.7, ladder: 0, holeSize: 1.7, colors: [0x1c1a1e, 0x5a1824] },
  { id: 'rib', name: '羅紋褲襪', note: '直條羅紋針織，厚而有彈性。', tile: { kind: 'rib' }, tilesU: 110, tilesV: 150, depth: 4.2, gapFloor: 0.5, relief: 1.3, grain: 0.06, roughness: 0.7, sheen: 0.8, sheenRoughness: 0.8, gloss: 0, tearAt: 1.06, ladder: 0.25, holeSize: 0.8, colors: [0x6a6870, 0x1c1a1e, 0xe9e6e6, 0x5a1824] },
  { id: 'dots', name: '點點 Plumetis', note: '透膚底上織出一顆顆小點。', tile: { kind: 'knit', width: 1 }, tilesU: 302, tilesV: TV, depth: 1.2, gapFloor: 0.36, relief: 1, grain: 0.025, roughness: 0.45, sheen: 0.9, sheenRoughness: 0.63, gloss: 0, tearAt: 0.92, ladder: 0.9, holeSize: 1, dots: true, colors: [0x1c1a1e, 0xb58a74, 0xe9e6e6] },
];

const tiles = new Map<string, Tile>();
/** The tile of a kind, made once. */
export function tileOf(type: StockingType): Tile {
  const key = JSON.stringify(type.tile);
  let tile = tiles.get(key);
  if (!tile) {
    tile = type.tile.kind === 'knit' ? knitTile(type.tile.width) : type.tile.kind === 'net' ? netTile(type.tile.strand) : ribTile();
    tiles.set(key, tile);
  }
  return tile;
}

export const display = (hex: number) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((c) => c / 255) as [number, number, number];
