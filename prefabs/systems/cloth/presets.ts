// How a kind of cloth behaves, as settings for the engine's cloth (ZhudaCloth). Numbers only: no engine.
//
// The kinds, and what tells them apart, follow the presets of the MagicCloth plugin for LayaAir (a port of
// Unity's MagicCloth 2) that a member of the LayaAir team gave this project: a game's cloth is not weighed like
// real cloth. It falls under about half of real gravity or less, so it floats and settles slowly; it loses its
// swing quickly; a skirt is stiff against folding where a soft skirt is not; no particle moves faster than a few
// metres a second; it slides on a body rather than gripping it; and a skirt takes a fifth of the wind a cape
// takes. Their values are read from those presets (gravity 5, 3 and 7; bending stiffness 1, 0.23 and 1; a speed
// limit of 4; friction 0.05; wind influence 0.2, 0.2 and 1) and turned into this solver's own measures. None
// of the plugin's code is used.

export interface ClothPreset {
  /** Metres a second a second, downward: well under 9.81. */
  gravity: number;
  /** Speed lost whichever way a particle moves (the engine's `drag`): how soon a swing dies. */
  drag: number;
  /** How hard air met face on pushes (the engine's `windDrag`). */
  windDrag: number;
  /** How much the cloth gives to folding and to skewing (compliance: larger is softer). */
  bend: number;
  shear: number;
  /** How well it grips a body, and how far it is kept outside one, metres. */
  friction: number;
  thickness: number;
  /** The fastest a particle moves, metres a second. */
  maxSpeed: number;
  /** The share of the scene's wind it feels. */
  windInfluence: number;
  /** Seconds it is run unseen before it is first shown, to hang as it will hang. */
  settleSeconds: number;
}

export const CLOTH_PRESETS = {
  /** A skirt with body: keeps its shape, swings a little, settles soon. */
  skirt: { gravity: 5, drag: 2.4, windDrag: 2.2, bend: 5e-5, shear: 3e-4, friction: 0.12, thickness: 0.012, maxSpeed: 4, windInfluence: 0.2, settleSeconds: 2.5 },
  /** A light skirt: falls slower still, folds easily, drifts longer. */
  softSkirt: { gravity: 3, drag: 1.7, windDrag: 2.6, bend: 4.5e-4, shear: 5e-4, friction: 0.12, thickness: 0.012, maxSpeed: 4, windInfluence: 0.2, settleSeconds: 3 },
  /** A cape or a hanging panel: heavier, and the wind has all of it. */
  cape: { gravity: 7, drag: 1.9, windDrag: 3, bend: 6e-5, shear: 3e-4, friction: 0.2, thickness: 0.012, maxSpeed: 4, windInfluence: 1, settleSeconds: 2.5 },
} satisfies Record<string, ClothPreset>;

export type ClothPresetName = keyof typeof CLOTH_PRESETS;

/** A preset as the options the engine's cloth takes. */
export function clothOptions(preset: ClothPreset) {
  return {
    gravity: [0, -preset.gravity, 0] as [number, number, number],
    drag: preset.drag,
    windDrag: preset.windDrag,
    compliance: { structural: 0, shear: preset.shear, bend: preset.bend },
    friction: preset.friction,
    thickness: preset.thickness,
    maxSpeed: preset.maxSpeed,
  };
}
