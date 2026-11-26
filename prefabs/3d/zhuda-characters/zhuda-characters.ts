// Zhuda and Zhuer as rigged game models (glTF, one skin each), with the clips
// each file carries. Load with ZhudaModelLibrary.instantiate(characterPath(id),
// { independentMaterials: true }) and play clips with ZhudaAnimationBlend.
//
// After `sync.mjs … 3d/zhuda-characters` the files are served at
// `common/3d/zhuda-characters/assets/<file>` next to the game's index.html.
//
// - zhuda, zhuer: the 2026 redesign (the brother and sister as they are drawn now).
//   The masters are ~/zhuda-zhuer-world/01_角色/豬大|豬二/改版3D/遊戲版/*.glb; these
//   are byte-identical copies (checked 2026-11-25). Used by the home island and the garden island.
// - zhuda-lite: the same Zhuda with the same skeleton and the same 19 clips at 8,990 triangles
//   (the full one has 49,990) and 1.0 MB, for a phone or for many on screen. From the workspace
//   game zhuer-fish-them-out (2026-11-18), where it was made from the full model outside the game.
// - zhuda-watchman: Zhuda from the film 《豬大守夜人》 (films/ancient-city), lantern taken
//   off, ear and tail tip bones added for spring bones, nine clips made for being picked up
//   and thrown (source/pig-clips.py). The floating island's default Zhuda.
//
// All three stand on y = 0, are about 1.15 m tall, and have bones `ear.L.tip`, `ear.R.tip`
// and `tail.tip` that end the spring chains (ZhudaSpringBones) of the ears and the tail.

export type CharacterId = 'zhuda' | 'zhuda-lite' | 'zhuer' | 'zhuda-watchman';

/** The clips every model has: walking about, and being picked up, thrown and landing. */
export const CORE_CLIPS = ['Idle', 'Walk', 'Struggle', 'Dangle', 'Fall', 'Land', 'Cheer', 'Shake', 'Dizzy'] as const;
/** The redesign's extra clips: greeting, performing, resting, reaching. */
export const PERFORMANCE_CLIPS = ['Wave', 'Bow', 'Sing', 'Dance', 'Sit', 'Sleep', 'Talk', 'Point', 'ReachLeft', 'ReachRight'] as const;
export type Clip = (typeof CORE_CLIPS)[number] | (typeof PERFORMANCE_CLIPS)[number];

export interface Character {
  file: string;
  name: string;
  clips: readonly Clip[];
  /** Height of the mesh in metres (feet at 0). */
  heightM: number;
  megabytes: number;
  /** Bones that deform nothing and end a spring chain (ears, tail). */
  springTips: readonly string[];
}

const TIPS = ['ear.L.tip', 'ear.R.tip', 'tail.tip'] as const;

export const CHARACTERS: Record<CharacterId, Character> = {
  zhuda: { file: 'zhuda.glb', name: '豬大（改版）', clips: [...PERFORMANCE_CLIPS, ...CORE_CLIPS], heightM: 1.15, megabytes: 3.5, springTips: TIPS },
  'zhuda-lite': { file: 'zhuda-lite.glb', name: '豬大（改版，輕量 8,990 面）', clips: [...PERFORMANCE_CLIPS, ...CORE_CLIPS], heightM: 1.15, megabytes: 1.0, springTips: TIPS },
  zhuer: { file: 'zhuer.glb', name: '豬二（改版）', clips: [...PERFORMANCE_CLIPS, ...CORE_CLIPS], heightM: 1.14, megabytes: 4.1, springTips: TIPS },
  'zhuda-watchman': { file: 'zhuda-watchman.glb', name: '豬大（守夜人版，影片模型）', clips: CORE_CLIPS, heightM: 1.14, megabytes: 3.7, springTips: TIPS },
};

export const CHARACTERS_BASE = 'common/3d/zhuda-characters/assets/';

/** The served path of a character's model, for a provider rooted at the page. */
export const characterPath = (id: CharacterId) => `${CHARACTERS_BASE}${CHARACTERS[id].file}`;
