// Generated from TypeScript source; run npm run types:generate.
/**
 * Numbers that describe a drawn frame, for authors who cannot judge a picture
 * by eye and as a check on those who can. Pure: takes the pixels of a preview.
 *
 * The thresholds behind `flags` were set against frames of this engine (see
 * docs/plans/records/quality-defaults). A flag is a reason to look, not a
 * verdict: a night scene is rightly dark.
 */
/** Twelve hue names, 30 degrees each, starting at red. */
export declare const ZHUDA_FRAME_HUES: readonly ["red", "orange", "yellow", "lime", "green", "spring", "cyan", "azure", "blue", "violet", "magenta", "rose"];
export type ZhudaFrameFlag = 'underexposed' | 'burnt-out' | 'crushed' | 'low-contrast' | 'hard-edges';
export interface ZhudaFrameMetrics {
    width: number;
    height: number;
    /** Mean luminance of the encoded picture, 0..1. */
    meanLuminance: number;
    /** Luminance below which 5, 50 and 95 percent of the pixels fall, 0..1. */
    luminance: {
        p05: number;
        p50: number;
        p95: number;
    };
    /** Share of pixels with every channel at or above 250: detail lost in white. */
    clippedShare: number;
    /** Share of pixels with every channel at or below 5: detail lost in black. */
    crushedShare: number;
    /** Mean saturation, 0..1. */
    saturation: number;
    /**
     * Strongly coloured pixels by hue: each hue that covers at least 0.2 percent
     * of the frame, with its share. A hue the scene has no source for is a
     * defect to look into (a stale uniform, a wrong texture).
     */
    vivid: {
        hue: (typeof ZHUDA_FRAME_HUES)[number];
        share: number;
    }[];
    /**
     * Of the strong luminance steps that run along an edge, the share with no
     * softer step on either side: high for outlines drawn without
     * anti-aliasing, low with it. Film grain hides hard edges from it.
     */
    hardEdgeShare: number;
    /** Reasons to look at the frame again; empty when none of the checks fires. */
    flags: ZhudaFrameFlag[];
}
/** Measures an RGBA frame (8 bits per channel, rows top to bottom). */
export declare function measureZhudaFrame(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): ZhudaFrameMetrics;
