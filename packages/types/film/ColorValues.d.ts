// Generated from TypeScript source; run npm run types:generate.
/**
 * One meaning for every colour a look or a film scene gives: a display value,
 * as a colour picker shows it (sRGB). LayaAir decodes the colours it is handed
 * as its own `Color` type (surfaces, lights, flat ambient, sky, distance fog).
 * Where this engine hands a colour to a shader of its own, it decodes it here
 * the same way, so that the same number is the same light everywhere: light
 * from the ground, the colour of light fog and of water, a lamp's glow in the
 * fog, the sun in beams and on water.
 *
 * Intensities are not colours: they stay linear.
 */
/** LayaAir's decoding of one channel (`Color.toLinear`): the sRGB curve up to 1, a 2.4th power above. */
export declare function zhudaDisplayToLinear(value: number): number;
/** The inverse: the display value that decodes to this much light. */
export declare function zhudaLinearToDisplay(value: number): number;
/** A display colour as the light it stands for. */
export declare const zhudaDecodeColor: (rgb: readonly number[]) => [number, number, number];
/**
 * The display colour that stands for this much light. Use it to carry a value
 * over that was written while a field was still read as scene-linear
 * (`ambient` beside `ambientGround`, `ambientGround`, `lightFog.color`, a
 * water node's `color`): `zhudaEncodeColor(old)` draws what `old` drew.
 */
export declare const zhudaEncodeColor: (rgb: readonly number[]) => [number, number, number];
