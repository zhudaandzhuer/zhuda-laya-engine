// What is worn over the stockings: a skirt (the engine's cloth, rebuilt for each
// style), shorts or trousers (a garment layer over each leg, pulled and torn as
// the stocking is), or nothing. Heights are in leg units: the ankle is -2.63,
// the knee -0.86, the top of the thigh 0.72, the waist 2.3 (the modelled body).

export interface SkirtSpec {
  kind: 'skirt';
  /** Where the hem hangs. */
  hem: number;
  /** How far the hem stands out beyond the hips. */
  flare: number;
  pleats: number;
  pleatDepth: number;
  /** A woven pattern (second colour as displayed); none is a plain colour. */
  pattern?: 'houndstooth';
  color2?: number;
  /** Pressed pleats: a regular zigzag of four cloth columns a pleat (the count then follows the columns), stiffer folds, crease shading. */
  pressed?: boolean;
  rows: number;
  /** Display colour; `stripe` a second one for a band above the hem. */
  color: number;
  stripe?: number;
  /** Air: a light skirt swings more. */
  windDrag: number;
}

export interface PantsSpec {
  kind: 'pants';
  /** Where the leg of the garment ends (its hem). */
  from: number;
  /** How far it stands off the skin at the thigh and at the hem. */
  fit: number;
  hemFit: number;
  fabric: 'denim' | 'wool';
  color: number;
  /** A frayed hem with threads hanging (cut-off shorts); `fringe` how long they hang (1 short .. 3 long). */
  frayed?: boolean;
  fringe?: number;
  /** Rips it comes with: which leg, round the leg (0..1, 0.5 the front), height, size, turn. */
  rips?: { side: number; u: number; y: number; size: number; turn: number }[];
  /** A turned-up cuff. */
  cuff?: boolean;
  tearAt: number;
  /** How far a full pull carries it, against a stocking. */
  reach: number;
  holeSize: number;
}

export interface Bottom {
  id: string;
  name: string;
  note: string;
  spec: SkirtSpec | PantsSpec | { kind: 'none' };
}

export const BOTTOMS: Bottom[] = [
  { id: 'mini', name: 'A 字迷你裙', note: '黑色毛料，裙擺微張。拖曳裙擺可以掀起。', spec: { kind: 'skirt', hem: 0.33, flare: 0.34, pleats: 12, pleatDepth: 0.06, rows: 18, color: 0x161618, windDrag: 2 } },
  { id: 'pleated', name: '百褶短裙', note: '細密的刀褶，駝色，擺動時褶子會打開。', spec: { kind: 'skirt', hem: 0.2, flare: 0.3, pleats: 24, pleatDepth: 0.075, rows: 20, color: 0x8a6a4a, windDrag: 2, pressed: true } },
  { id: 'tennis', name: '白色網球裙', note: '短版白色百褶，褶子細而挺。', spec: { kind: 'skirt', hem: 0.36, flare: 0.36, pleats: 24, pleatDepth: 0.06, rows: 18, color: 0xeeece8, windDrag: 2, pressed: true } },
  { id: 'houndstooth', name: '千鳥格百褶裙', note: '黑白千鳥格毛料，膝上長度。', spec: { kind: 'skirt', hem: 0.02, flare: 0.36, pleats: 24, pleatDepth: 0.08, rows: 22, color: 0xe6e0d4, color2: 0x1a1a1c, pattern: 'houndstooth', windDrag: 2, pressed: true } },
  { id: 'midiPleats', name: '灰色中長百褶裙', note: '過膝的灰色百褶，走起來褶子會打開。', spec: { kind: 'skirt', hem: -1.16, flare: 0.55, pleats: 24, pleatDepth: 0.09, rows: 30, color: 0x6c6c72, windDrag: 3, pressed: true } },
  { id: 'pencil', name: '窄裙', note: '貼身的鉛筆裙，長到膝上。', spec: { kind: 'skirt', hem: -0.55, flare: 0.05, pleats: 0, pleatDepth: 0, rows: 24, color: 0x2a2a30, windDrag: 1.5 } },
  { id: 'midi', name: '飄逸長裙', note: '長過膝蓋的雪紡長裙，要掀起來才撕得到。', spec: { kind: 'skirt', hem: -1.42, flare: 0.95, pleats: 9, pleatDepth: 0.12, rows: 30, color: 0x5a1c2a, windDrag: 4 } },
  { id: 'denimShorts', name: '牛仔短褲', note: '剪口毛邊的丹寧短褲，也撕得破（露出底下的絲襪）。', spec: { kind: 'pants', from: 0.29, fit: 0.045, hemFit: 0.09, fabric: 'denim', color: 0x30507a, frayed: true, tearAt: 1.0, reach: 0.4, holeSize: 0.9 } },
  { id: 'rippedShorts', name: '破洞牛仔短褲', note: '寬鬆淺色丹寧，大破洞、長毛邊。', spec: { kind: 'pants', from: 0.07, fit: 0.07, hemFit: 0.26, fabric: 'denim', color: 0x4f6f98, frayed: true, fringe: 3, tearAt: 1.0, reach: 0.42, holeSize: 1, rips: [{ side: 1, u: 0.5, y: 0.38, size: 0.17, turn: 0.15 }, { side: 1, u: 0.47, y: 0.19, size: 0.07, turn: -0.2 }, { side: -1, u: 0.55, y: 0.26, size: 0.05, turn: 0.3 }] } },
  { id: 'woolShorts', name: '西裝短褲', note: '黑色高腰西裝短褲，短而俐落。', spec: { kind: 'pants', from: 0.41, fit: 0.05, hemFit: 0.1, fabric: 'wool', color: 0x141416, tearAt: 0.98, reach: 0.45, holeSize: 0.9 } },
  { id: 'jeans', name: '牛仔長褲', note: '合身牛仔褲。撕開會留下一條條白色緯紗，像破褲。', spec: { kind: 'pants', from: -2.6, fit: 0.035, hemFit: 0.06, fabric: 'denim', color: 0x26405f, tearAt: 1.04, reach: 0.38, holeSize: 0.85 } },
  { id: 'slacks', name: '西裝長褲', note: '直筒的黑色西裝褲。', spec: { kind: 'pants', from: -2.6, fit: 0.08, hemFit: 0.32, fabric: 'wool', color: 0x18181c, tearAt: 0.98, reach: 0.45, holeSize: 0.9 } },
  { id: 'none', name: '不穿', note: '只有絲襪。', spec: { kind: 'none' } },
];
