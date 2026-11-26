// Ten small scanned plants and stones (Poly Haven, CC0), in their game-weight
// versions: ferns, shrubs, nettles, moss, boulders, a stump. They came from the
// film "城外河流與城池" (films/ancient-city/assets/nature-game) and dressed the
// floating island. Sizes are the model's own extent in metres (x, y, z) before
// any scale; `cutout` models use alpha-tested leaves.
//
// After `sync.mjs … 3d/nature-pack` the files are served at
// `common/3d/nature-pack/assets/<id>.glb` next to the game's index.html.

export interface NaturePiece {
  /** Model extent in metres before scaling: x, y (height), z. */
  size: [number, number, number];
  triangles: number;
  /** Leaves drawn with an alpha cut-out (double-sided cards). */
  cutout: boolean;
  /** What it is, for picking one by eye. */
  what: string;
}

export const NATURE_PACK_BASE = 'common/3d/nature-pack/assets/';

export const NATURE_PACK = {
  fern_02: { size: [1.973, 0.428, 1.724], triangles: 1536, cutout: true, what: '蕨類一叢' },
  moss_01: { size: [0.215, 0.04, 0.029], triangles: 204, cutout: true, what: '一小撮苔蘚' },
  namaqualand_boulder_04: { size: [2.521, 1.904, 2.495], triangles: 3640, cutout: false, what: '大圓石' },
  namaqualand_boulder_06: { size: [0.675, 0.651, 1.212], triangles: 3639, cutout: false, what: '中石頭' },
  namaqualand_stones_01: { size: [1.023, 0.084, 0.113], triangles: 700, cutout: false, what: '一排小碎石' },
  nettle_plant: { size: [1.083, 0.218, 0.095], triangles: 474, cutout: true, what: '蕁麻（細長葉）' },
  rock_moss_set_01: { size: [8.036, 1.764, 6.948], triangles: 4200, cutout: false, what: '長苔的石頭一組（攤開很大，通常縮小用）' },
  shrub_02: { size: [6.054, 1.703, 2.285], triangles: 932, cutout: true, what: '寬灌木' },
  shrub_03: { size: [1.367, 0.403, 0.151], triangles: 326, cutout: true, what: '小灌木' },
  tree_stump_01: { size: [1.425, 0.571, 1.59], triangles: 2800, cutout: false, what: '樹樁' },
} satisfies Record<string, NaturePiece>;

export type NatureId = keyof typeof NATURE_PACK;

/** The served path of one piece, for ZhudaModelLibrary.instantiate (relative to a provider rooted at the page). */
export const naturePath = (id: NatureId) => `${NATURE_PACK_BASE}${id}.glb`;
