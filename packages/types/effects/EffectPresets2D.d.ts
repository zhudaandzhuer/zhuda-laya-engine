// Generated from TypeScript source; run npm run types:generate.
/**
 * Ready effects for a 2D game or interface, as data: each is a
 * `ParticleEffectSpec` in pixels and seconds, on canvas axes (+X right, +Y
 * down, angles in radians from +X), whose emitters name the built-in sprites
 * (`EffectSprites.ts`). Nothing is loaded from a file. `ZhudaEffect2D` plays
 * one.
 *
 * `kind` says how it runs: `loop` goes on until stopped (a torch, snow);
 * `burst` happens once from its start and ends by itself (coins, a hit).
 * `sizePixels` is roughly the box it fills at scale 1 and `origin` where its
 * (x, y) lies in that box, as fractions from the top left: a torch's origin
 * is at the bottom of its flames, rain's at the top of the sky it falls
 * through.
 */
import type { ParticleEffectSpec } from '../particles/ParticleTypes.js';
export interface ZhudaEffectPreset2D {
    description: string;
    kind: 'loop' | 'burst';
    /** Width and height it fills at scale 1, in pixels. */
    sizePixels: [number, number];
    /** Where its (x, y) is inside that box: fractions of the width and height from the top left. */
    origin: [number, number];
    /** A burst is over after this long; a loop has settled into its look by then. */
    seconds: number;
    effect: ParticleEffectSpec;
}
export declare const ZHUDA_EFFECT_PRESETS_2D: Readonly<Record<string, ZhudaEffectPreset2D>>;
/** The preset ids, sorted. */
export declare const ZHUDA_EFFECT_PRESET_IDS_2D: readonly string[];
/** Every issue in a 2D preset (none expected in the built-in ones): for tests and for a preset of one's own. */
export declare function validateZhudaEffectPreset2D(preset: ZhudaEffectPreset2D): string[];
