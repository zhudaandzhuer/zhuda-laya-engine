// Generated from TypeScript source; run npm run types:generate.
/** 16-bit floats, for light stored at half the size of 32-bit floats. Pure. */
/** A 32-bit float as the 16 bits of a half float, rounded to nearest; values past its range become its largest. */
export declare function zhudaFloatToHalf(value: number): number;
/** Float pixels as half floats. */
export declare function zhudaToHalfFloats(pixels: Float32Array): Uint16Array;
/**
 * Scene-linear RGBA float pixels as LayaAir's RGBD: 8 bits a channel, with
 * the colour divided by its largest channel where that is over 1 and the
 * divisor's reciprocal in alpha (`decodeRGBD`: rgb / a). Reaches 255; coarse
 * above 1, and filtered on encoded values.
 */
export declare function zhudaToRgbd(pixels: Float32Array): Uint8Array;
