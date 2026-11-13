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
export function zhudaDisplayToLinear(value: number): number {
  if (value <= 0.04045) return value / 12.92;
  if (value < 1) return Math.pow((value + 0.055) / 1.055, 2.4);
  return Math.pow(value, 2.4);
}

/** The inverse: the display value that decodes to this much light. */
export function zhudaLinearToDisplay(value: number): number {
  if (value <= 0.0031308) return value * 12.92;
  if (value < 1) return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  return Math.pow(value, 1 / 2.4);
}

/** A display colour as the light it stands for. */
export const zhudaDecodeColor = (rgb: readonly number[]): [number, number, number] => [
  zhudaDisplayToLinear(rgb[0]),
  zhudaDisplayToLinear(rgb[1]),
  zhudaDisplayToLinear(rgb[2]),
];

/**
 * The display colour that stands for this much light. Use it to carry a value
 * over that was written while a field was still read as scene-linear
 * (`ambient` beside `ambientGround`, `ambientGround`, `lightFog.color`, a
 * water node's `color`): `zhudaEncodeColor(old)` draws what `old` drew.
 */
export const zhudaEncodeColor = (rgb: readonly number[]): [number, number, number] => [
  zhudaLinearToDisplay(rgb[0]),
  zhudaLinearToDisplay(rgb[1]),
  zhudaLinearToDisplay(rgb[2]),
];
