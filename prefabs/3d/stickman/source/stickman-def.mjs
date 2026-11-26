// 囂張小黑人：骨架、形狀、臉、兩段 idle。
//
// 做法照路線 humanoid-from-shapes（VerifyZhuda `unified` 分支 3937ed7 的 games/tools/characters，
// 在 games/tools/characters/）：形狀掛在骨頭上 → 引擎的距離場與等值面網格 → 簡化到預算 → 依最近形狀蒙皮
// → 姿勢函式每秒取樣 30 次 → .glb。這裡只放這個角色自己的東西。
//
// 座標：面向 +Z、上 +Y、角色的左手在 +X，公尺；腳底 y = 0，原點在兩腳中間。
// 骨頭在綁定姿勢不轉（A 字手），所以姿勢裡每根骨頭的轉動都是繞世界軸。
import { C, E, Q, add, bothJoints, both, cross, len, mirrored, mul, norm, sub } from '../../../../games/tools/characters/kit.mjs';
import { rig } from '../../../../games/tools/characters/humanoid.mjs';
import { TAU, bump, deg, ease, flip, pitch, poser, roll, yaw } from '../../../../games/tools/characters/hero-kit.mjs';

export const H = 1.2;

// ------------------------------------------------------------------ 骨架（20 根）
const P = {
  root: [0, 0, 0],
  hips: [0, 0.55, 0],
  spine: [0, 0.63, 0],
  chest: [0, 0.72, 0],
  neck: [0, 0.81, 0],
  head: [0, 0.87, 0],
  clav: [0.035, 0.78, 0],
  // 肩關節 0.09（三視圖量的是 0.10）：往內收 1 cm，靠近混元那顆的窄肩（它窄 2.3 cm），手臂根部和身體重疊的地方少、腋下乾淨。
  shoulder: [0.09, 0.78, 0],
  hip: [0.057, 0.49, 0],
  knee: [0.072, 0.275, 0],
  ankle: [0.084, 0.065, 0.0],
};
// 尺寸都是從三視圖（source/turnaround/01-turnaround.png，身高換算成 1.2 m）量的：
// 肩在 0.78、手臂離開身體 33°、肩到手腕 0.30 m（手腕約 0.52 m，手掌在 0.41–0.52，和三視圖逐高度量的一樣）。
const UPPER = 0.16,
  LOWER = 0.14;
// 綁定姿勢照三視圖：上臂離身體 33°、前臂 26°（三視圖的手臂幾乎是直的，只微微往內收）、手 12°（手往下垂、掌心朝大腿），手臂稍微往前。
const armDir = norm([Math.sin(33 * deg), -Math.cos(33 * deg), 0.03]);
const foreDir = norm([Math.sin(26 * deg), -Math.cos(26 * deg), 0.08]);
P.elbow = add(P.shoulder, mul(armDir, UPPER));
P.wrist = add(P.elbow, mul(foreDir, LOWER));
// 左手的框：F 沿手指、W 橫過手掌指向拇指、N 從掌心出去（朝大腿）。
const F = norm([Math.sin(12 * deg), -Math.cos(12 * deg), 0.06]);
// 掌心朝大腿、拇指朝前（三視圖側面看到整個手背和四根指頭、拇指在最前面）：從「正前方」繞手指方向往內只轉 15°。
const W0 = norm(sub([0, 0, 1], mul(F, F[2])));
const W = [Q.apply(Q.axis(F, 15), W0), Q.apply(Q.axis(F, -15), W0)].sort((a, b) => a[0] - b[0])[0];
const N = cross(F, W);
P.grip = add(add(P.wrist, mul(F, 0.06)), mul(N, 0.026));

const joints = [
  { name: 'root', at: P.root },
  { name: 'hips', parent: 'root', at: P.hips },
  { name: 'spine', parent: 'hips', at: P.spine },
  { name: 'chest', parent: 'spine', at: P.chest },
  { name: 'neck', parent: 'chest', at: P.neck },
  { name: 'head', parent: 'neck', at: P.head },
  ...bothJoints([
    { name: 'clavL', parent: 'chest', at: P.clav },
    { name: 'armL', parent: 'clavL', at: P.shoulder },
    { name: 'foreL', parent: 'armL', at: P.elbow },
    { name: 'handL', parent: 'foreL', at: P.wrist },
    { name: 'thighL', parent: 'hips', at: P.hip },
    { name: 'shinL', parent: 'thighL', at: P.knee },
    { name: 'footL', parent: 'shinL', at: P.ankle },
  ]),
];
const S = (s) => (s === 'L' ? (v) => v : flip);
/** 和 hero-kit 的 heroRig 同樣形狀的物件，poser() 直接能用。 */
export const RIG = {
  H,
  P,
  joints,
  R: rig(joints),
  armDir,
  foreDir,
  F,
  W,
  N,
  S,
  side: (s, v) => S(s)(v),
  bind: {
    upper: (s) => S(s)(armDir),
    lower: (s) => S(s)(foreDir),
    thigh: (s) => S(s)(norm(sub(P.knee, P.hip))),
    shin: (s) => S(s)(norm(sub(P.ankle, P.knee))),
    F: (s) => S(s)(F),
    W: (s) => S(s)(W),
    N: (s) => S(s)(N),
    grip: (s) => S(s)(P.grip),
    wrist: (s) => S(s)(P.wrist),
  },
  lengths: { upper: UPPER, lower: LOWER, thigh: len(sub(P.knee, P.hip)), shin: len(sub(P.ankle, P.knee)) },
};

// ------------------------------------------------------------------ 形狀
/**
 * 頭：正圓球，半徑 0.18 m（和三視圖一樣大），整顆往下坐到肩膀上（下緣 0.82 m），看不到脖子
 * （三視圖露出一小截脖子，使用者要看不到；放大頭會讓比例和三視圖差更多，所以改成往下坐，總高 1.18 m）。
 * 自己一個網格：不是等值面簡化出來的，而是測地線球（二十面體每面細分 5×5，500 個一樣大的三角形），
 * 從哪個角度看輪廓都一樣圓；臉直接貼在這顆球上。
 */
export const HEAD = { centre: [0, 1.016, 0], radii: [0.18, 0.18, 0.18], geodesic: 5 };
export const HEAD_SHAPES = [E('head', HEAD.centre, HEAD.radii)];
/**
 * 臉的圖案（face/face-mask.png，R＝眼白、G＝嘴）：從頭的球心看出去的方向，左右角 yaw、上下角 pitch（度，正＝往上），
 * 每 step 度一格。從混元 3D 照三視圖生成的 50k 版頭上取出來的（face/extract-face.mjs），需求者 說那顆「像」。
 * 建置時照方向查這張圖，把眼睛和嘴畫進底色貼圖。
 */
export const FACE_MASK = { file: 'face/face-mask.png', yaw: [-75, 75], pitch: [-65, 40], step: 0.25 };

/**
 * 左手：三視圖那種手套手——圓手掌、四根粗指頭、一根粗拇指，和一小段插進前臂的手腕。
 * 和身體在同一張連續表面裡（沒有手腕的交會線），減面時手附近的頂點加權，指縫才留得住。
 * 以前是四根細手指＋指節（兩隻手 460 面，需求者 說手的面數要調整）；現在是四根胖指頭、沒有指節，每隻約 300 面。
 * 手的框：F 沿手指、W 指向拇指、N 從掌心出去。
 */
function handL() {
  // 照混元那顆（需求者 說「像」）：手寬、手厚放大 20%，指頭再加粗 12%（胖胖併在一起的手套）；
  // 沿手指方向只放大 7%（混元的手寬而短，整隻等比放大的話垂下來比它低 2 cm）。
  const k = 1.2, kl = 1.07, kf = k * 1.12;
  const at = (f, w, n) => add(add(add(P.wrist, mul(F, f * kl)), mul(W, w * k)), mul(N, n * k));
  const axes = [W, N, F];
  // 三視圖的手（同比例並排比過，見 preview/hands-compare.jpg）：蓬蓬的手套手，手背寬約 8 cm、腕到指尖約 11.5 cm；
  // 手掌短（約 5.5 cm）、手指長（約 5 cm），四根胖指頭（各約 2.1 cm 粗）併在一起、中間只有淺淺的指縫、圓頭，中間兩根最長；
  // 每根兩節：前半直直往下，後半往掌心勾（正面看是厚厚一團的半握拳）；一根粗拇指在最前面，和四指之間一道縫。
  // 以前指頭細長又張開（低面數下才分得開），和三視圖差最多；併攏的胖指頭靠指縫的法線變化留住頂點，每隻手約 300 面。
  const fingers = [
    // [指根 w, 指尖 w, 指尖 f]：從後（小指）到前（食指）
    [-0.0278, -0.0288, 0.094],
    [-0.00925, -0.0096, 0.104],
    [0.00925, 0.0096, 0.106],
    [0.0278, 0.0288, 0.098],
  ];
  return [
    C('handL', at(-0.03, 0, 0), at(0.004, 0, 0.001), 0.026 * k, 0.026 * k),
    E('handL', at(0.026, 0, 0.004), [0.041 * k, 0.025 * k, 0.03 * kl], { axes, blend: 0.02 }),
    ...fingers.flatMap(([w0, w1, tip]) => {
      const mid = at(tip - 0.026, (w0 + w1) / 2, 0.014);
      return [
        C('handL', at(0.04, w0, 0.006), mid, 0.0112 * kf, 0.0111 * kf, { blend: 0.004 }),
        C('handL', mid, at(tip, w1, 0.044), 0.0111 * kf, 0.0107 * kf, { blend: 0.002 }),
      ];
    }),
    C('handL', at(0.008, 0.032, 0.014), at(0.038, 0.046, 0.03), 0.0145 * kf, 0.0135 * kf, { blend: 0.008 }),
    C('handL', at(0.038, 0.046, 0.03), at(0.058, 0.047, 0.04), 0.0135 * kf, 0.0125 * kf, { blend: 0.003 }),
  ];
}
export const HAND_SHAPES = { L: handL(), R: handL().map(mirrored) };
/** 手指和拇指（手的形狀扣掉前兩個：手腕那一小段、手掌）。建置時只有這些地方不做表面鬆弛。 */
export const FINGER_SHAPES = { L: HAND_SHAPES.L.slice(2), R: HAND_SHAPES.R.slice(2) };

/** 腳：小橢圓，往前凸出、腳尖微微朝外（左腳；右腳鏡像）。 */
// 腳照混元那顆（需求者 說像）：平底、寬、短一點的胖靴子。橢球中心放低（0.03），地面那一刀切在接近最寬的地方，
// 腳底是一大片平的（不是圓底踩在一小塊上）；腳尖低、腳跟和小腿後緣差不多齊。
export const FOOT = { centre: [P.ankle[0] + 0.01, 0.027, P.ankle[2] + 0.02], radii: [0.057, 0.048, 0.09] };

/**
 * 身體：一顆圓潤的豆子（胸、肚子、屁股三顆橢球用大圓角連起來，看不出胸肌腰線）、圓肩、
 * 粗細均勻的圓管手腳、手套手、圓圓的大腳；最後一個把腳底削平。脖子藏在頭和身體裡。
 */
export const BODY_SHAPES = [
  // 脖子靠後一點：側面看後頸和背是一條直線（三視圖），前面是下巴底下一點點凹。
  C('neck', [0, 0.77, -0.015], [0, 0.92, -0.015], 0.062, 0.058),
  // 火柴人的身體：一根上窄下寬的直線錐柱（半徑 0.106 → 0.086，照三視圖逐高度量的寬；輪廓是直線、沒有凸凹），前後壓成 83%（三視圖身體厚 0.15）；
  // 沒有胸、腰、骨盆、屁股的起伏（需求者：身體不要像人類那樣有高低差，手摸過去是一個平面）。
  // 頂端收窄＝斜肩（像三視圖）：頂端和胸一樣寬的話，手臂接在頂端的角上，正面看像衣架的直角肩，手一抬更明顯。底下的圓頭就是胯下。
  // 頂端收窄到 0.073（混元那顆身體頂端比較窄）：手臂根部和身體重疊的面積小，腋下一離開肩膀就分開，叉腰時不會鼓出一塊。
  C('spine', [0, 0.58, 0], [0, 0.74, 0], 0.098, 0.071, { blend: 0.05, flatten: { axis: [0, 0, 1], factor: 0.83 } }),
  // 胯：身體錐柱的圓底太圓，要嘛胯下太低、要嘛側面屁股那段太薄。底下墊一顆和身體一樣寬、上下扁的橢球：
  // 正面看身體兩側直直往下接到腿外側（沒有收腰、沒有鼓起），胯下在 0.47 m，側面厚度也和三視圖一樣（0.50 m 約 13 cm）。
  E('hips', [0, 0.545, 0], [0.097, 0.068, 0.072], { blend: 0.02 }),
  ...both([
    // 手臂：微微往下收的圓管（直徑 6.8 → 5.8 cm，三視圖量的），從肩膀那一點直接接上去（沒有肩頭）。和身體只用 0.8 cm 的小圓角：
    // 圓角大了，綁定姿勢時手臂和身體中間的角會被填成一片蹼，叉腰時被拉成「腋下的肉」（使用者：火柴人不是這樣）。
    // 斜肩：脖子根到肩關節一段斜斜的圓錐（像斜方肌），肩膀上緣是一條圓順的斜線（三視圖）；只在手臂上方，不會填到腋下。
    // 三視圖量的肩線：頭的下緣（0.84）一離開頭就往外斜下來，0.85 m 寬 8.4 cm、0.80 m 寬 12.5 cm，接著就是手臂的外緣，中間沒有平台、沒有轉角。
    // 腋下要乾淨（需求者：腋下多了點東西）：斜錐靠手臂那頭細一點、圓角小一點，不會往下填到手臂和身體之間。
    C('clavL', [0.036, 0.843, 0], [0.08, 0.786, 0], 0.04, 0.029, { blend: 0.012 }),
    // 照混元那顆：上臂根部維持原來的粗細（再粗就會和身體黏成一片），往手肘稍微變粗；前臂加粗約 0.8 cm。
    C('armL', sub(P.shoulder, mul(armDir, 0.02)), P.elbow, 0.034, 0.035, { blend: 0.003 }),
    C('foreL', P.elbow, P.wrist, 0.036, 0.035, { blend: 0.02 }),
    // 腿：微微往下收的圓管（直徑 9.2 → 8.2 cm，三視圖量的）；腿的外側貼齊身體側邊（從身體摸到腿是一條直線），兩腿中間一條縫。
    // 三視圖的腿前後比左右厚約 1 cm（正面寬 8.6、側面厚 9.6 cm）：圓管左右壓扁一點。
    // 小腿幾乎不往腳踝收細（混元那顆是粗細一樣的圓管，粗細和原本的差不多）。
    C('thighL', P.hip, P.knee, 0.055, 0.0497, { blend: 0.032, flatten: { axis: [1, 0, 0], factor: 0.86 } }),
    C('shinL', P.knee, P.ankle, 0.046, 0.045, { blend: 0.012, flatten: { axis: [1, 0, 0], factor: 0.936 } }),
    // 腳：圓圓的靴子頭，往前凸出、腳尖微微朝外；和小腿只用小圓角，看得出是一隻腳（大圓角會變成喇叭褲管）。
    E('footL', FOOT.centre, FOOT.radii, { blend: 0.014 }),
  ]),
  E('root', [0, -0.5, 0], [2, 0.506, 2], { subtract: true, blend: 0.006 }),
];

// ------------------------------------------------------------------ 臉（貼在頭的橢球上）
// 臉的座標：正面正交投影，x 往角色的左（正面看是畫面右邊）、y 往上，公尺，原點在頭的中心；和三視圖正面量到的位置一樣。
// 眼睛在頭中心下方約 4 cm、嘴在下方約 13 cm（參考圖的臉偏下，這是可愛的關鍵）。
/** 怒眼：橢圓被一條斜線切掉上半，內側（靠鼻樑）低、外側高。左眼；右眼是鏡像。 */
export const EYE = { centre: [0.081, -0.042], radii: [0.043, 0.031], cut: { y: 0.0135, slope: 0.6 }, points: 20 };
/** 壞笑的嘴：一彎月牙，右邊（角色的左）嘴角翹得比較高。 */
export const MOUTH = { from: -0.044, to: 0.047, y: -0.127, curve: 4.8, tilt: 0.05, thick: 0.013, columns: 12 };
/** 顏色（顯示色）與材質。 */
export const COLOURS = { body: '#404040', eye: '#ececea', mouth: '#d8462e' };
/**
 * 像三視圖那樣的中性炭灰（不偏藍），粗糙度 0.75：只有很柔的反光，像霧面軟膠。
 * 在攝影棚光（觀看台 ?look=studio）下量身體：平均 #373838、暗部 #303131、亮部 #414141；三視圖是 #363635、#2b2b2b、#414040。
 * 在戶外大太陽的遊戲場景裡會看起來更黑：顏色＝材質×光，光是場景的事。
 * 試過的：#1e1e22／0.5（「有質感的黑」，但比三視圖黑很多、偏藍）、#313136／0.62、0.45 加光（太亮）、0.86（霧面沒反光）。
 */
export const ROUGHNESS = 0.75;

// ------------------------------------------------------------------ 兩段 idle
const T = poser(RIG);
/** 兩段共用的站姿：腳的位置一樣，crossfade 時腳不滑。[x, z, 腳尖朝外的角度] */
export const FEET = { L: [0.087, 0.006, 10], R: [-0.087, -0.006, -10] };
export const HEEL = 0.042; // 腳跟（踮腳尖、打拍子的支點）在踝後方多遠

/** 一隻腳：踩在 FEET 的位置；pitchDeg < 0 是以腳跟為支點把腳尖翹起來。 */
function foot(s, pitchDeg = 0) {
  const [x, z, yd] = FEET[s];
  const a0 = [x, P.ankle[1], z];
  const heel = add(a0, Q.apply(yaw(yd), [0, -P.ankle[1], -HEEL]));
  const a = add(heel, Q.apply(Q.mul(yaw(yd), pitch(pitchDeg)), [0, P.ankle[1], HEEL]));
  return [a[0], a[2], yd, a[1] - P.ankle[1], pitchDeg];
}

/** 頭與脖子：抬下巴（pitch < 0）、轉頭、歪頭。 */
function look(pose, { up = 0, turn = 0, tilt = 0 }) {
  pose.neck = Q.of(yaw(turn * 0.35), pitch(-up * 0.3), roll(tilt * 0.3));
  pose.head = Q.of(yaw(turn * 0.65), pitch(-up * 0.7), roll(tilt * 0.7));
}

/**
 * Idle_HandsOnHips（4 秒）：囂張的叉腰——上身挺直、胸口往前頂、手掌扣在腰側偏前、手肘往兩側撐開；
 * 重心壓在右腳、骨盆往右推，呼吸兩次；慢慢轉頭往左邊斜眼看過去，停一下，「哼」地把下巴一抬轉回來。
 * （以前的版本手放得低又偏後、手肘往後收、上身往後仰、膝蓋微彎，需求者 說「太像老頭」：像扶著腰伸懶腰。）
 */
function handsOnHips(t) {
  const L = 4;
  const ph = t / L;
  const breath = Math.sin(TAU * 2 * ph);
  const sway = Math.sin(TAU * ph);
  const pose = {};
  T.stand(pose, {
    L: foot('L'),
    R: foot('R'),
    drop: 0.012 + 0.003 * (0.5 + 0.5 * Math.sin(TAU * 2 * ph + 1.2)),
    shift: [-0.02 + 0.004 * sway, 0, 0],
    hips: Q.of(yaw(-8 + 2 * sway), roll(-6 + 1.2 * sway)),
    kneeOut: 0.35,
  });
  // 上身挺直（不往後仰）、胸口往前頂一點、肩膀打開。
  pose.spine = Q.of(pitch(1 - 0.5 * breath), roll(3.5));
  pose.chest = Q.of(pitch(-3 - 1.2 * breath), roll(2), yaw(6));
  const turn = 20 * ease(t, 0.45, 1.15) - 28 * ease(t, 1.95, 2.55) + 8 * ease(t, 3.2, 3.85);
  const up = 9 + 6 * bump(t, 1.9, 2.95) + 1.2 * breath;
  look(pose, { up, turn, tilt: 5 * ease(t, 0.45, 1.15) - 9 * ease(t, 1.95, 2.55) + 4 * ease(t, 3.2, 3.85) });
  // 手掌扣在腰側偏前（跟著腰走），指頭往前下包住腰，手肘往兩側撐開、略往下：
  // 手肘往上翹的話上臂抬太高，肩膀被蒙皮拉得聳起來（使用者：手臂跟身體連接處難看）。
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    const sq = T.world(pose, 'spine');
    const wrist = T.place(pose, 'spine', [sx * 0.132, 0.632, 0.006]);
    T.armTo(pose, s, wrist, Q.apply(sq, [sx, -0.3, 0.05]));
    T.handFrame(pose, s, Q.apply(sq, norm([-sx * 0.3, -0.5, 0.81])), Q.apply(sq, [-sx, 0, 0.2]));
  }
  return pose;
}

/**
 * Idle_ArmsCrossed（3.2 秒）：雙手抱胸、歪頭，右腳尖不耐煩地點地三下，然後「哼」地把臉別開，再轉回來。
 * 腳的位置和叉腰那段一樣，只有右腳尖會翹起來。
 */
function armsCrossed(t) {
  const L = 3.2;
  const ph = t / L;
  const breath = Math.sin(TAU * ph);
  const tap = [0.18, 0.52, 0.86].reduce((a, t0) => a + bump(t, t0, t0 + 0.3), 0);
  const pose = {};
  T.stand(pose, {
    L: foot('L'),
    R: foot('R', -20 * tap),
    drop: 0.011 + 0.003 * (0.5 + 0.5 * breath) + 0.004 * tap,
    shift: [0.016, 0, 0.002],
    hips: Q.of(yaw(5), roll(5)),
    kneeOut: 0.3,
  });
  pose.spine = Q.of(pitch(-3 - 0.6 * breath), roll(-2.5));
  pose.chest = Q.of(pitch(-5 - 1.4 * breath + 1.5 * tap), roll(-3), yaw(-4));
  const away = ease(t, 1.45, 1.8) - ease(t, 2.55, 3.05);
  look(pose, { up: 8 + 5 * away, turn: -24 * away + 2 * tap, tilt: 8 - 4 * away });
  const cq = T.world(pose, 'chest');
  const inChest = (p) => T.place(pose, 'chest', p);
  // 左前臂在下、貼著胸口；右前臂在上、在外。手塞在對面的上臂旁。
  T.armTo(pose, 'L', inChest([-0.058, 0.66, 0.114]), Q.apply(cq, [1, -0.7, 0.15]));
  T.handFrame(pose, 'L', Q.apply(cq, norm([-1, 0.06, -0.3])), Q.apply(cq, [0, 0.1, -1]));
  T.armTo(pose, 'R', inChest([0.064, 0.7, 0.142]), Q.apply(cq, [-1, -0.7, 0.15]));
  T.handFrame(pose, 'R', Q.apply(cq, norm([1, 0.06, -0.34])), Q.apply(cq, [0, 0.1, -1]));
  return pose;
}

export const CLIPS = {
  Idle_HandsOnHips: { seconds: 4, pose: handsOnHips },
  Idle_ArmsCrossed: { seconds: 3.2, pose: armsCrossed },
};

/** 預算：總共 3000 個三角形以內（需求者 的要求）。texture：法線、遮蔽、底色三張貼圖的邊長（512 時手分到 3.2 倍的貼圖密度，和 1024 看不出差別）。body 含兩隻手，其中 hands 個固定給手（四根胖指頭、圓頭、往掌心勾留得住的量：每隻 200 面指尖會尖，300 面才圓）。 */
export const BUDGET = { total: 3000, head: 500, body: 2494, hands: 700, relax: 15, texture: 512 };
/** 蒙皮時沿關節串量位置用：手臂的串從肩膀往身體裡多延伸 3 cm，腿的串從髖關節往骨盆裡多延伸 11 cm（那段主要跟骨盆走）。 */
export const CHAIN_LEAD = { arm: 0.03, leg: 0.11 };
export const CELL = { body: 0.003, head: 0.007, hand: 0.0025 };
/** 蒙皮：一根骨頭的拉力超出它自己的形狀多遠。 */
export const SKIN = 0.04;
