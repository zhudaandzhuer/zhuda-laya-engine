// 布偶版（`STICKMAN_STYLE=plush`）：還是同一個 2994 面的模型、同一副骨架和動作，只換貼圖和材質，
// 做出「布縫起來的玩偶」的感覺。形狀（網格）一點都不動，縫線、針腳、不織布眼睛都在烘焙時做進貼圖：
//
// - 縫線：照兩片布（前片、後片）縫起來的做法，縫在身體、手臂、腿的側邊（每一段沿骨頭、含左右方向的平面），
//   頭也是前後兩片（耳朵那一圈），腳底一圈、手腕一圈（手套口）。縫線本身是一道細溝，兩邊的布被拉進去一點
//   （寬一點的淺凹），中間的布就鼓鼓的像小枕頭。只改烘焙用的距離場：法線、陰影貼圖照它算。
// - 針腳：橫過縫線的一段段淺色線（底色貼圖），縫線、手腕、腳底都有；眼睛邊緣一圈深色的針腳。
// - 不織布眼睛：眼白往外凸 1.2 mm（法線貼圖看得到厚度和邊）。
// - 材質霧一點（粗糙度 0.9），貼圖 1024（針腳才看得出來）。
//
// 絨毛版（`STICKMAN_STYLE=fuzzy`，見 FUZZY）：使用者說玩偶感是「絨毛感」、不是一堆針線。沒有針腳，
// 縫線只留很淺的布被拉進去的凹；全身（含頭）一層往下梳的細毛流（法線）和一點毛色深淺（底色）；
// 不織布眼睛照舊凸起、不縫邊；材質粗糙度 1，並在 glb 的材質裡寫 KHR_materials_sheen（絨布在輪廓附近泛起的柔光，
// LayaAir 3.4.2 的 glTF 讀取器自己會畫，對方專案不用加程式）。
//
// `makePlush(...)` 包住 build.mjs 原本給烘焙的距離場、法線權重和底色，回傳包好的版本。
import { FOOT, HEAD, RIG } from './stickman-def.mjs';

export const PLUSH = {
  name: 'plush',
  roughness: 0.9,
  texture: 1024,
  // 縫線的溝：細而深的一道（crease），兩邊寬而淺的拉扯（pinch）。公尺。
  crease: { depth: 0.0024, width: 0.0026 },
  pinch: { depth: 0.003, width: 0.011 },
  // 針腳：每 1.3 cm 一針，順著縫線方向寬 4 mm，橫過縫線長 1.1 cm（兩邊各 5.5 mm）。遊戲裡人物不大，針腳要粗才看得到。
  stitch: { spacing: 0.013, along: 0.004, across: 0.0055, colour: [0.6, 0.58, 0.55] },
  // 手腕的縫線圈離手腕多遠（往手肘）、腳底那圈多高。
  cuff: 0.014,
  sole: 0.02,
  // 不織布眼睛凸出來多少；眼睛邊的針腳。
  felt: 0.0012,
  eyeStitch: { inset: 0.0024, spacing: 0.0075, along: 0.0026, colour: [0.3, 0.29, 0.28] },
};

export const FUZZY = {
  name: 'fuzzy',
  roughness: 1,
  texture: 1024,
  // 縫線只剩布被拉進去的淺凹，沒有溝、沒有針腳。
  crease: { depth: 0, width: 0.001 },
  pinch: { depth: 0.0012, width: 0.01 },
  stitch: null,
  cuff: PLUSH.cuff,
  sole: PLUSH.sole,
  felt: PLUSH.felt,
  eyeStitch: null,
  // 毛流：往下梳的細紋（上下拉長 3 倍的雜訊），兩層：4 mm 高 0.3 mm、2.2 mm 高 0.15 mm；毛色深淺 ±5%（9 mm 一團）。
  fuzz: { stretch: 3, octaves: [[0.004, 0.0003], [0.0022, 0.00015]], tint: { size: 0.009, amount: 0.05 } },
  // 寫進 glb 材質的 KHR_materials_sheen：顏色（線性）和粗糙度。另外烘一張柔光強度圖（sheenColorTexture）：
  // 手上只留 20%、凹處（遮蔽暗的地方）降到 35%。低模的指縫是斜斜朝外的面，柔光專照斜看的面，不壓的話每條指縫一道亮線。
  sheen: { color: [0.42, 0.42, 0.42], roughness: 0.4, hands: 0.2, cavity: 0.35 },
  // 布料幾乎不反光：KHR_materials_specular 的 specularFactor 0.2（預設 1）。不調低的話，斜看的指縫一條條亮線（原版也有，只是淡）。
  specular: 0.2,
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const smooth01 = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const segment = (p, a, b) => {
  const d = sub(b, a), L = dot(d, d);
  const t = L > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / L)) : 0;
  return { dist: Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t, p[2] - a[2] - d[2] * t), t };
};
/** 含骨頭方向、法線盡量朝前（+Z）的平面：兩片布的分界。 */
const midPlane = (a, b) => {
  const d = norm(sub(b, a));
  return { a, d, n: norm(sub([0, 0, 1], d.map((v) => v * d[2]))) };
};

/**
 * 每個點屬於哪一塊（離哪一段骨頭的表面最近），那一塊的縫線離它多遠、順著縫線的座標。
 * 回傳 { d, u }：d＝到最近縫線的距離（公尺，表面附近用平面距離，靠近縫線時就是沿表面的距離），u＝順著縫線的位置（公尺，排針腳用）。
 */
export function seams() {
  const P = RIG.P;
  const parts = [];
  // 身體（含脖子）：前後兩片，縫在 z = 0 的側邊和肩膀上緣。順著縫線的座標用 y + |x|（側邊是直的、肩膀是橫的）。
  parts.push({ owner: (p) => segment(p, [0, 0.5, 0], [0, 0.84, 0]).dist - 0.085, seam: (p) => [{ d: Math.abs(p[2]), u: p[1] + Math.abs(p[0]) }] });
  for (const s of ['L', 'R']) {
    const side = (v) => RIG.side(s, v);
    const shoulder = side(P.shoulder), elbow = side(P.elbow), wrist = side(P.wrist), hip = side(P.hip), knee = side(P.knee), ankle = side(P.ankle);
    const upper = midPlane(shoulder, elbow), fore = midPlane(elbow, wrist);
    const upperLen = Math.hypot(...sub(elbow, shoulder));
    const cuffAt = sub(wrist, fore.d.map((v) => v * PLUSH.cuff));
    // 手腕那一圈：垂直前臂的平面；順著縫線的座標是繞前臂的角度×半徑。
    const ringX = norm([fore.n[1] * fore.d[2] - fore.n[2] * fore.d[1], fore.n[2] * fore.d[0] - fore.n[0] * fore.d[2], fore.n[0] * fore.d[1] - fore.n[1] * fore.d[0]]);
    const cuff = (p) => {
      const q = sub(p, cuffAt);
      if (Math.hypot(...q) > 0.07) return [];
      return [{ d: Math.abs(dot(q, fore.d)), u: Math.atan2(dot(q, fore.n), dot(q, ringX)) * 0.036 }];
    };
    const plane = (pl, offset) => (p) => [{ d: Math.abs(dot(sub(p, pl.a), pl.n)), u: offset + dot(sub(p, pl.a), pl.d) }];
    parts.push({ owner: (p) => segment(p, shoulder, elbow).dist - 0.035, seam: (p) => [...plane(upper, 0)(p), ...cuff(p)] });
    parts.push({ owner: (p) => segment(p, elbow, wrist).dist - 0.036, seam: (p) => [...plane(fore, upperLen)(p), ...cuff(p)] });
    // 手：只有手腕那一圈（手套口）。
    parts.push({ owner: (p) => segment(p, wrist, sub(wrist, fore.d.map((v) => -v * 0.1))).dist - 0.035, seam: cuff });
    // 腿：前後兩片，縫在 z = 0 的兩側。
    parts.push({ owner: (p) => segment(p, hip, knee).dist - 0.05, seam: (p) => [{ d: Math.abs(p[2]), u: -p[1] }] });
    parts.push({ owner: (p) => segment(p, knee, ankle).dist - 0.046, seam: (p) => [{ d: Math.abs(p[2]), u: -p[1] }] });
    // 腳：腳底一圈（像鞋底縫上去）。
    const fc = side(FOOT.centre), fr = FOOT.radii;
    parts.push({
      owner: (p) => {
        const q = sub(p, fc);
        return (Math.hypot(q[0] / fr[0], q[1] / fr[1], q[2] / fr[2]) - 1) * Math.min(...fr);
      },
      seam: (p) => [{ d: Math.abs(p[1] - PLUSH.sole), u: Math.atan2(p[2] - fc[2], p[0] - fc[0]) * 0.07 }],
    });
  }
  // 頭：前後兩片，縫在耳朵那一圈（z = 球心）。順著縫線的座標是繞 z 軸的角度×半徑。
  const hc = HEAD.centre, hr = HEAD.radii[0];
  parts.push({ owner: (p) => Math.hypot(...sub(p, hc)) - hr, seam: (p) => [{ d: Math.abs(p[2] - hc[2]), u: Math.atan2(p[1] - hc[1], p[0] - hc[0]) * hr }] });
  return (p) => {
    let best = null, bestD = Infinity;
    for (const part of parts) {
      const d = part.owner(p);
      if (d < bestD) (bestD = d), (best = part);
    }
    let out = { d: Infinity, u: 0 };
    for (const c of best.seam(p)) if (c.d < out.d) out = c;
    return out;
  };
}

/** 縫線的溝有多深（加到距離場上＝表面往裡收）。 */
export const groove = (d, style = PLUSH) => style.crease.depth * Math.exp(-((d / style.crease.width) ** 2)) + style.pinch.depth * Math.exp(-((d / style.pinch.width) ** 2));

/** 三維的平滑雜訊（值雜訊，-1..1）：整數格點上的亂數、格子裡三線性內插（smoothstep 權重）。 */
const hash3 = (x, y, z) => {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return 2 * l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w) - 1;
}

/** 一針的濃淡（0..1）：橫過縫線 `across` 以內、順著縫線每 `spacing` 一段寬 `along`。 */
const stitchAt = ({ d, u }, { spacing, along, across }) => {
  const q = Math.abs((((u / spacing) % 1) + 1) % 1 - 0.5) * spacing;
  return smooth01((across - d) / 0.0012) * smooth01((along / 2 - q) / 0.0009);
};

/**
 * 包住烘焙的輸入。`surfaceOf(g)`、`aoField`、`normalWeight(p)`、`colourAt(p, g)` 是 build.mjs 原本的；
 * `faceAngles(p)` 給頭上一點的 [yaw, pitch]（度），`maskAt(yaw, pitch, 通道)` 查臉的圖案（0＝眼白、1＝嘴），`cBody` 是身體色（0..1）。
 * `style`：PLUSH（縫線＋針腳）或 FUZZY（絨毛）。
 */
export function makePlush({ surfaceOf, aoField, normalWeight, colourAt, faceAngles, maskAt, cBody, headGroup = 1, style = PLUSH }) {
  const seamAt = seams();
  // 毛流：往下梳（y 方向拉長）的細紋，加到距離場上（正負都有＝表面有細細的起伏）。
  const fuzz = style.fuzz
    ? (p) => {
        let h = 0;
        for (const [size, amp] of style.fuzz.octaves) h += amp * noise3(p[0] / size, p[1] / (size * style.fuzz.stretch), p[2] / size);
        return h;
      }
    : () => 0;
  const withGroove = (field, extra = () => 0) => ({
    distance: (x, y, z) => {
      const p = [x, y, z];
      return field.distance(x, y, z) + groove(seamAt(p).d, style) + extra(p);
    },
  });
  // 不織布眼睛：眼白往外凸（距離場減一點＝表面往外）。只在臉那一帶查圖案。
  const onFace = (p) => {
    const [yaw, pitch] = faceAngles(p);
    return Math.abs(yaw) < 60 && pitch > -62 && pitch < 30 ? [yaw, pitch] : null;
  };
  const felt = (p) => {
    const f = onFace(p);
    return f ? -style.felt * smooth01((maskAt(f[0], f[1], 0) - 0.15) / 0.7) : 0;
  };
  // 兩隻眼睛各自的中心（臉的圖案上眼白的重心），排眼睛邊那一圈針腳用。
  const eyes = [];
  for (const sign of [-1, 1]) {
    let sy = 0, sp = 0, w = 0;
    for (let yaw = 0; yaw <= 60; yaw += 0.5)
      for (let pitch = -60; pitch <= 30; pitch += 0.5) {
        const e = maskAt(sign * yaw, pitch, 0);
        (sy += sign * yaw * e), (sp += pitch * e), (w += e);
      }
    if (w > 0) eyes.push([sy / w, sp / w]);
  }
  const degPerMetre = 180 / Math.PI / HEAD.radii[0];
  const eyeStitch = (yaw, pitch) => {
    if (!style.eyeStitch || maskAt(yaw, pitch, 0) < 0.5) return 0;
    // 往內縮 inset 的那一圈：周圍 8 個方向有一個在眼睛外面，就是靠邊的那一圈。
    const r = style.eyeStitch.inset * degPerMetre;
    let edge = false;
    for (let k = 0; k < 8 && !edge; k++) edge = maskAt(yaw + r * Math.cos((k * Math.PI) / 4), pitch + r * Math.sin((k * Math.PI) / 4), 0) < 0.5;
    if (!edge) return 0;
    const c = eyes.reduce((a, b) => (Math.hypot(yaw - b[0], pitch - b[1]) < Math.hypot(yaw - a[0], pitch - a[1]) ? b : a));
    const u = (Math.atan2(pitch - c[1], yaw - c[0]) * Math.hypot(yaw - c[0], pitch - c[1])) / degPerMetre;
    const { spacing, along } = style.eyeStitch;
    const q = Math.abs((((u / spacing) % 1) + 1) % 1 - 0.5) * spacing;
    return smooth01((along / 2 - q) / 0.0008);
  };
  const mix = (a, b, t) => [0, 1, 2].map((k) => a[k] * (1 - t) + b[k] * t);
  return {
    surfaceOf: (g) => withGroove(surfaceOf(g), (p) => fuzz(p) + (g === headGroup ? felt(p) : 0)),
    aoField: withGroove(aoField),
    // 柔光強度（0..1，線性）：手上、凹處調低。存成 sRGB（sheenColorTexture 是顏色貼圖），所以開 1/2.2 次方。
    sheenAt: style.sheen
      ? (p, g, occ) => {
          const hand = normalWeight(p);
          const k = (1 - (1 - style.sheen.hands) * hand) * (style.sheen.cavity + (1 - style.sheen.cavity) * smooth01((occ - 0.5) / 0.4));
          return Math.pow(k, 1 / 2.2);
        }
      : null,
    normalWeight: (p) => {
      // 絨毛：全身都用法線貼圖（毛流在每個地方）。
      if (style.fuzz) return 1;
      // 縫線兩邊 2 cm 內、臉上（眼睛的厚度）用法線貼圖；其他地方照原本的（只有手）。
      const nearSeam = smooth01((0.022 - seamAt(p).d) / 0.008);
      const face = Math.hypot(...sub(p, HEAD.centre)) < HEAD.radii[0] + 0.01 && onFace(p) ? 1 : 0;
      return Math.max(normalWeight(p), nearSeam, face);
    },
    colourAt: (p, g) => {
      let c = (colourAt && colourAt(p, g)) ?? cBody;
      if (style.fuzz) {
        const { size, amount } = style.fuzz.tint;
        const k = 1 + amount * noise3(p[0] / size + 17.3, p[1] / size, p[2] / size);
        c = c.map((v) => Math.min(1, v * k));
      }
      if (style.stitch) {
        const s = stitchAt(seamAt(p), style.stitch);
        if (s > 0) c = mix(c, style.stitch.colour, 0.85 * s);
      }
      if (g === headGroup && style.eyeStitch) {
        const f = onFace(p);
        if (f) {
          const e = eyeStitch(f[0], f[1]);
          if (e > 0) c = mix(c, style.eyeStitch.colour, 0.9 * e);
        }
      }
      return c;
    },
  };
}

/**
 * 在 glb 的每個材質寫上 KHR_materials_sheen（絨布在輪廓附近泛起的柔光）：顏色（線性 RGB）和粗糙度，
 * `texture`＝柔光強度圖（sheenColorTexture）的貼圖編號；`specular` 給了就再寫 KHR_materials_specular（反光多強）。
 * 只改 JSON 那一段，二進位資料原封不動。LayaAir 3.4.2 的 glTF 讀取器讀這個擴充，用它自己的 glTF 著色器畫。
 */
export function withSheen(glb, { color, roughness }, texture = null, specular = null) {
  const jsonLength = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  for (const m of gltf.materials) m.extensions = { ...(m.extensions ?? {}), KHR_materials_sheen: { sheenColorFactor: [...color], sheenRoughnessFactor: roughness, ...(texture !== null ? { sheenColorTexture: { index: texture } } : {}) } };
  if (specular !== null) for (const m of gltf.materials) m.extensions.KHR_materials_specular = { specularFactor: specular };
  gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed ?? []), 'KHR_materials_sheen', ...(specular !== null ? ['KHR_materials_specular'] : [])])].sort();
  let text = Buffer.from(JSON.stringify(gltf));
  if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
  const rest = glb.subarray(20 + jsonLength);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + text.length + rest.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, text, rest]);
}
