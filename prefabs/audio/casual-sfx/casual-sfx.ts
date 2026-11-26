// audio/casual-sfx: forty-one short sounds for a casual game's interface and small events,
// synthesised in a page (`source/sfx-lab.html`, an OfflineAudioContext: no samples of anyone
// else's), AAC in .m4a. After `zhuda-prefab-sync . audio/casual-sfx` they are served at
// `common/audio/casual-sfx/assets/<id>.m4a` beside the game's index.html; play them through the
// engine's one audio authority (docs/audio.md), not a second AudioContext.
// From the workspace game zhuda-counting-pigs (2026-11-18). Route: docs/routes/story-counting-2d.md.

/** Every sound, by what it is for. Lengths are in the module's README. */
export const CASUAL_SFX = {
  /** Buttons, menus, text. */
  interface: ['ui_click', 'ui_hover', 'menu_open', 'text_blip', 'buy', 'cant_afford', 'upgrade', 'place_item', 'clean_reject'],
  /** Counting up, rewards, money. */
  reward: ['coin', 'count_ding', 'count_10', 'count_100', 'count_1000', 'gold_shine', 'offline_reward', 'layer_up', 'ending_chime'],
  /** A character's small reactions. */
  reaction: ['oink', 'giggle', 'kiss', 'pout', 'surprise', 'question', 'idea'],
  /** Things that happen in a scene. */
  event: ['jump_boing', 'land_thud', 'potato_drop', 'mud_bubble', 'mud_splash', 'fly_flap', 'fly_catch', 'star_shoot', 'star_catch', 'blanket', 'dream_whoosh', 'clock_tick'],
  /** Longer beds that loop or sit under a scene. */
  ambience: ['birds', 'night_ambience', 'dream_pad', 'lullaby'],
} as const;

export type CasualSfxGroup = keyof typeof CASUAL_SFX;
export type CasualSfxId = (typeof CASUAL_SFX)[CasualSfxGroup][number];

/** Every id, in the order of the groups. */
export const CASUAL_SFX_IDS: readonly CasualSfxId[] = Object.values(CASUAL_SFX).flat();

/** Where a sound is served once synced; `base` is the game's page folder ('' by default). */
export function casualSfxPath(id: CasualSfxId, base = ''): string {
  return `${base}common/audio/casual-sfx/assets/${id}.m4a`;
}
