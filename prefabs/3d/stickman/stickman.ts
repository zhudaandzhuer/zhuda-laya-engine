// 囂張小黑人：低模（3000 個三角形以內）、帶骨架的黑色小人，兩段可以互相 crossfade 的 idle。
// 一個網格、一個材質、20 根骨頭，畫一次就好（陰影另算）。材質有三張 512 貼圖（底色、法線、環境遮蔽，同一組 UV），
// 從真正的形狀烘出來：手指圓、指縫和腋下有陰影。眼睛和嘴畫在底色貼圖上（照混元 3D 那顆頭的臉），不是幾何貼片，
// 省下的面數給了手。
//
// 載入：ZhudaModelLibrary.instantiate(stickmanPath())，或在純 LayaAir 裡
// Laya.loader.load(<網址>, Laya.Loader.HIERARCHY)。動作用 LayaAir 自己的 Animator：
//   animator.play('Idle_HandsOnHips');
//   animator.crossFade('Idle_ArmsCrossed', fadeShare(0.35, 正在播的那段的秒數));
// LayaAir 的 crossFade 吃的是「正在播的那段」長度的比例，不是秒數，fadeShare() 幫你換算。
// 兩段都要循環：載入後把兩個 state 的 clip.islooping 設成 true（glTF 本身沒有循環旗標）。
//
// 做法在 source/（照路線 humanoid-from-shapes，用 VerifyZhuda unified 分支的人物工具），
// `node 3d/stickman/source/build.mjs` 重做 assets/stickman.glb。
// 這個檔不碰引擎，可以直接用 node 測。

export const STICKMAN_CLIPS = ['Idle_HandsOnHips', 'Idle_ArmsCrossed'] as const;
export type StickmanClip = (typeof STICKMAN_CLIPS)[number];

export interface StickmanInfo {
  file: string;
  name: string;
  /** 腳底到頭頂，公尺（腳底在 y = 0，面向 +Z）。 */
  heightM: number;
  /** 整個模型的三角形數（要求是 3000 以內）。 */
  triangles: number;
  joints: number;
  /** 每段動作的秒數（兩段都是循環）。 */
  clipSeconds: Record<StickmanClip, number>;
}

export const STICKMAN: StickmanInfo = {
  file: 'stickman.glb',
  name: '囂張小黑人',
  heightM: 1.19,
  triangles: 2994,
  joints: 20,
  clipSeconds: { Idle_HandsOnHips: 4, Idle_ArmsCrossed: 3.2 },
};

/** 兩段的中文名（給介面用）。 */
export const STICKMAN_CLIP_NAMES: Record<StickmanClip, string> = {
  Idle_HandsOnHips: '叉腰挺胸',
  Idle_ArmsCrossed: '抱胸點腳',
};

export const STICKMAN_BASE = 'common/3d/stickman/assets/';
/** sync 之後模型在網頁上的路徑（相對 index.html）。 */
export const stickmanPath = () => `${STICKMAN_BASE}${STICKMAN.file}`;

/** 修 glTF 動作的 crossFade 時用到的最小介面（LayaAir 的 Animator 符合它）。 */
export interface CrossFadeAnimator {
  controllerLayerCount: number;
  getControllerLayer(index: number): { states: readonly { clip: unknown }[] } | null | undefined;
}

/**
 * **載入 .glb 之後、第一次 crossFade 之前叫一次。** 回傳修了幾段動作。
 *
 * LayaAir 3.4.2 的 glTF 讀取器（`laya.gltf.js`）把每段動作的 `_nodesDic` 填成「路徑 → 路徑字串」，
 * 讀 `.lani` 時填的是「路徑 → 節點」。`Animator.crossFade` 用這個字典找目標動作的節點索引；拿到字串就找不到，
 * 過渡期間目標動作被當成預設姿勢（綁定的 A 字手），過渡結束才一格跳成目標動作：看起來就是
 * 「手先垂下來、再閃現」。這裡把每段動作的字典改回「路徑 → 節點」（和 .lani 一樣），crossFade 才是真正的連續混合。
 * 只動字典的內容，可以重複叫；`.lani` 讀進來的動作本來就對，不會被改到。
 */
export function repairGltfCrossFade(animator: CrossFadeAnimator): number {
  type Node = { fullPath: string };
  type Clip = { _nodes?: { count: number; getNodeByIndex(i: number): Node }; _nodesDic?: Record<string, unknown> };
  let repaired = 0;
  for (let layer = 0; layer < animator.controllerLayerCount; layer++)
    for (const state of animator.getControllerLayer(layer)?.states ?? []) {
      const clip = state.clip as Clip | null;
      const nodes = clip?._nodes,
        dic = clip?._nodesDic;
      if (!nodes || !dic) continue;
      let changed = false;
      for (let i = 0; i < nodes.count; i++) {
        const node = nodes.getNodeByIndex(i);
        if (node && dic[node.fullPath] !== node) ((dic[node.fullPath] = node), (changed = true));
      }
      if (changed) repaired++;
    }
  return repaired;
}

/** LayaAir 的 crossFade 要的過渡長度：`seconds` 換成正在播的那段長度的比例（0..1）。 */
export function fadeShare(seconds: number, playingClipSeconds: number): number {
  if (!(playingClipSeconds > 0)) return 0;
  return Math.min(1, Math.max(0, seconds / playingClipSeconds));
}

export interface IdleShuffleOptions {
  /** 第一段（預設叉腰）。 */
  first?: StickmanClip;
  /** 每段播幾輪才換（含頭尾），每次換段時隨機取。預設 [2, 3]。 */
  loops?: readonly [number, number];
  /** 換段時的過渡秒數，預設 0.35。 */
  fadeSeconds?: number;
  /** 0..1 的亂數，預設 Math.random（測試時給固定的）。 */
  random?: () => number;
}

/**
 * 兩段 idle 自動輪流：一段播滿幾輪，在它回到開頭的那一刻 crossfade 到另一段。
 * 不碰引擎：`play(clip, fadeSeconds)` 由遊戲接到 Animator（第一次 fadeSeconds 是 0，直接播）。
 * 每幀叫 `update(dt)`；`hold(clip)` 停在某一段不再自動換（再叫 `resume()` 恢復）。
 */
export class StickmanIdles {
  clip: StickmanClip;
  /** 這一段已經播了幾秒（從這一段開始算）。 */
  time = 0;
  private loopsLeft: number;
  private held = false;
  private readonly loops: readonly [number, number];
  private readonly fade: number;
  private readonly random: () => number;
  private readonly play: (clip: StickmanClip, fadeSeconds: number) => void;

  constructor(play: (clip: StickmanClip, fadeSeconds: number) => void, options: IdleShuffleOptions = {}) {
    this.play = play;
    this.loops = options.loops ?? [2, 3];
    if (!(this.loops[0] >= 1 && this.loops[1] >= this.loops[0])) throw Error('loops must be [min, max] with 1 <= min <= max');
    this.fade = options.fadeSeconds ?? 0.35;
    this.random = options.random ?? Math.random;
    this.clip = options.first ?? 'Idle_HandsOnHips';
    this.loopsLeft = this.pickLoops();
    this.play(this.clip, 0);
  }

  private pickLoops() {
    const [a, b] = this.loops;
    return a + Math.floor(this.random() * (b - a + 1));
  }

  /** 換到某一段（用過渡），並從那一段重新數輪數。 */
  switchTo(clip: StickmanClip, fadeSeconds = this.fade) {
    this.clip = clip;
    this.time = 0;
    this.loopsLeft = this.pickLoops();
    this.play(clip, fadeSeconds);
  }

  hold(clip: StickmanClip) {
    this.held = true;
    if (clip !== this.clip) this.switchTo(clip);
  }

  resume() {
    this.held = false;
    this.time = 0;
    this.loopsLeft = this.pickLoops();
  }

  update(dt: number) {
    this.time += dt;
    if (this.held) return;
    const length = STICKMAN.clipSeconds[this.clip];
    if (this.time >= length * this.loopsLeft) this.switchTo(this.clip === 'Idle_HandsOnHips' ? 'Idle_ArmsCrossed' : 'Idle_HandsOnHips');
  }
}
