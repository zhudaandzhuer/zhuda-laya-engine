// Generated from TypeScript source; run npm run types:generate.
/**
 * Ready effects for a 3D scene, as data: each is a `ParticleEffectSpec3D` in
 * metres and seconds whose emitters name the built-in sprites
 * (`EffectSprites.ts`). Nothing is loaded from a file. `ZhudaEffect3D` plays
 * one; a film scene's `effect` node places one.
 *
 * `kind` says how it runs: `loop` goes on until stopped (a fire, rain);
 * `burst` happens once from its start and ends by itself (an explosion, a
 * hit). `sizeMeters` is roughly how much room it takes at scale 1, to place it
 * and to frame a camera on it.
 */
import type { ParticleEffectSpec3D } from '../particles/ParticleTypes3D.js';
export interface ZhudaEffectPreset3D {
    description: string;
    kind: 'loop' | 'burst';
    /** Width, height and depth it fills at scale 1, in metres. */
    sizeMeters: [number, number, number];
    /** A burst is over after this long; a loop has settled into its look by then. */
    seconds: number;
    effect: ParticleEffectSpec3D;
}
export declare const ZHUDA_EFFECT_PRESETS_3D: Readonly<Record<string, ZhudaEffectPreset3D>>;
/** The preset ids, sorted. */
export declare const ZHUDA_EFFECT_PRESET_IDS_3D: readonly string[];
/** Every issue in the built-in presets (none expected): for tests and for a preset of one's own. */
export declare function validateZhudaEffectPreset3D(preset: ZhudaEffectPreset3D): string[];
