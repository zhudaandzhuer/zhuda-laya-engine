// A colour table for the post-quality draw check, written as a grading tool
// writes a .cube file: a title, comments, a domain, and the entries with red
// changing fastest. The look warms the highlights, cools the shadows and
// lifts the blacks a little.

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** The look as arithmetic on a display colour 0..1. */
export function lookColour([r, g, b]) {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Shadows toward teal, highlights toward orange.
  const warm = luma * luma * (3 - 2 * luma);
  const tint = [0.06 * (warm * 2 - 1), 0.01 * (warm * 2 - 1), -0.07 * (warm * 2 - 1)];
  const lifted = (v) => 0.03 + 0.97 * v ** 0.92;
  return [r, g, b].map((v, k) => clamp01(lifted(v) + tint[k]));
}

/** The text of the table, `size` entries along each edge. */
export function lookCubeText(size = 17) {
  const lines = [
    '# Created for the post-quality check',
    'TITLE "Warm highlights, cool shadows"',
    '',
    `LUT_3D_SIZE ${size}`,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
    '# red changes fastest',
  ];
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++)
        lines.push(
          lookColour([r / (size - 1), g / (size - 1), b / (size - 1)])
            .map((v) => v.toFixed(6))
            .join(' '),
        );
  return lines.join('\r\n') + '\r\n';
}
