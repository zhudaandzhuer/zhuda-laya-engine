// Generated from TypeScript source; run npm run types:generate.
export interface ZhudaSynthEnvelope {
    /** Linear rise to full level. */
    attackSec?: number;
    /** Time held at full level after the attack. */
    holdSec?: number;
    /** Exponential fall; the level is about 1% after this long. */
    releaseSec: number;
}
interface SynthLayerBase {
    /** Linear gain, 0..4. */
    gain: number;
    envelope: ZhudaSynthEnvelope;
    /** Delay before this layer starts. */
    startSec?: number;
    lowpassHz?: number;
    highpassHz?: number;
}
export type ZhudaSynthLayer = (SynthLayerBase & {
    type: 'noise';
    color?: 'white' | 'pink' | 'brown';
}) | (SynthLayerBase & {
    type: 'tone';
    wave?: 'sine' | 'square' | 'saw' | 'triangle';
    frequencyHz: number;
    /** Glide target reached at the end of the sound. */
    endFrequencyHz?: number;
});
export interface ZhudaSynthRecipe {
    schemaVersion: 1;
    id: string;
    durationSec: number;
    sampleRate?: number;
    seed?: number;
    layers: ZhudaSynthLayer[];
    /** Peak level after normalisation, 0..1 (default 0.9). */
    peak?: number;
}
export declare function validateZhudaSynthRecipe(recipe: unknown): string[];
/** Renders the recipe to mono samples in -1..1. Same recipe, same samples. */
export declare function renderZhudaSynth(recipe: ZhudaSynthRecipe): {
    sampleRate: number;
    samples: Float32Array;
};
/** Wraps mono samples as a 16-bit PCM WAV file. */
export declare function encodeZhudaWav(samples: Float32Array, sampleRate: number): Uint8Array;
/** Convenience: recipe straight to WAV bytes. */
export declare function renderZhudaSynthWav(recipe: ZhudaSynthRecipe): Uint8Array;
export {};
