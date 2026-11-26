// The stocking bench's tear (games/stocking-tear/src/Main.ts): a ragged hole, ladders running from it,
// loose yarn at its lip. Copied as it is; in 2D, uv is the picture and scale turns it into the units
// the tear's sizes are given in.
export const TEARS = 12;
// A tear: a ragged hole, ladders running from it (`ladder` 0..1), loose yarn at its lip.
export const TEAR_GLSL = `
float zhudaTornHole(vec2 p, vec2 radii, float phase) {
  vec2 q = p / radii;
  q.x += 0.29 * q.y;
  float angle = atan(q.y, q.x + 0.00001);
  float outline = 1.0 + 0.12 * sin(3.0 * angle + phase) + 0.07 * cos(5.0 * angle - phase) + 0.025 * sin(12.0 * angle + phase);
  return (length(q) - outline) * min(radii.x, radii.y);
}
void zhudaTear(vec4 place, vec4 shape, vec2 uv, vec2 scale, vec2 tearDx, vec2 tearDy, float edgeAA, float ladder, inout float fray, inout float runs, inout float tearCoverage) {
  vec2 axis = place.zw;
  float open = shape.w;
  vec2 delta = uv - place.xy;
  delta.x -= floor(delta.x + 0.5);
  delta *= scale;
  float along = dot(delta, axis);
  float across = dot(delta, vec2(axis.y, -axis.x));
  float runLength = shape.x * open;
  if (along < -runLength * 1.2 || along > runLength * 1.9 || abs(across) > shape.y + 0.075) return;
  float phase = shape.z;
  float runCenter = 0.022 * (sin(3.6 * along + phase) - sin(phase)) + 0.008 * sin(14.0 * along);
  float x = across - runCenter;
  vec2 mainSize = vec2(shape.y, shape.y * 1.38) * open;
  float largeHole = zhudaTornHole(vec2(x, along), mainSize, phase);
  float lowerHole = zhudaTornHole(vec2(x + 0.023 * sin(phase), along + runLength * 0.68), mainSize * vec2(0.56, 0.68), phase + 1.3);
  float upperHole = zhudaTornHole(vec2(x + 0.032, along - mainSize.y * 1.39), mainSize * vec2(0.39, 0.32), phase + 2.1);
  float edgeDistance = min(largeHole, min(lowerHole, upperHole));
  float endFade = 1.0 - smoothstep(0.46, 1.0, abs(along) / (runLength * (along > 0.0 ? 1.85 : 1.16)));
  float lane = max(0.004, shape.y * 0.62 * endFade);
  // A ladder's rungs are the courses of the knit, about a millimetre apart. Where
  // they are finer than a pixel they are drawn as what they average to: a thinner
  // band, not stripes.
  float ladderLine = along * 200.0 + phase + 0.27 * sin(x * 22.0 + along * 8.0);
  float rung = abs(fract(ladderLine) - 0.5);
  float gap = 0.14 * endFade * (1.0 - smoothstep(0.46, 1.0, abs(x) / lane));
  float perPixel = (abs(dot(tearDx, axis)) + abs(dot(tearDy, axis))) * 200.0;
  float rungAA = min(0.13, perPixel * 0.55);
  float resolved = 1.0 - smoothstep(0.25, 0.6, perPixel);
  float openStripes = (1.0 - smoothstep(max(0.0, gap - rungAA), gap + rungAA, rung));
  float openRun = mix(clamp(2.0 * gap, 0.0, 1.0), openStripes, resolved) * smoothstep(0.004, 0.075, gap);
  float threadPhase = x * 435.0 + along * 8.0 + phase;
  // No fwidth here: WGSL allows it only in uniform control flow, and this runs under an if.
  float threadPerPixel = 435.0 * 0.5 * (length(tearDx) + length(tearDy)) / 6.2832;
  float remainingThreads = 0.65 + 0.35 * sin(threadPhase) * (1.0 - smoothstep(0.25, 0.6, threadPerPixel));
  runs = max(runs, ladder * clamp(openRun * 0.88 + endFade * (1.0 - smoothstep(0.3, 1.65, abs(x) / lane)) * remainingThreads * 0.36, 0.0, 0.96));
  float lip = 1.0 - smoothstep(0.002, 0.015, abs(edgeDistance));
  float fiberAA = max(0.001, min(0.11, rungAA * 1.85));
  float fiberBand = mix(0.2, 1.0 - smoothstep(max(0.0, 0.08 - fiberAA), 0.08 + fiberAA, abs(fract(ladderLine * 1.85) - 0.5)), resolved);
  float innerLip = smoothstep(-0.013 - edgeAA, -0.013 + edgeAA, edgeDistance) * (1.0 - smoothstep(-edgeAA, edgeAA, edgeDistance));
  float looseYarn = innerLip * fiberBand * max(ladder, 0.4);
  float intactFabric = smoothstep(-edgeAA, edgeAA, edgeDistance);
  tearCoverage = min(tearCoverage, clamp(intactFabric + looseYarn, 0.0, 1.0));
  fray = max(fray, max(lip * 0.50, looseYarn * 0.78));
}`;
export const TEAR_CALLS = (ladder: string) =>
  Array.from({ length: TEARS }, (_, i) => `  if (u_ZhudaTearCount > ${i}.5) zhudaTear(u_ZhudaTearPlace${i}, u_ZhudaTearShape${i}, uv, scale, tearDx, tearDy, edgeAA, ${ladder}, fray, runs, tearCoverage);`).join('\n');
export const TEAR_UNIFORMS = () => ({
  // The lit surface takes no uniform arrays: twelve pairs by name.
  ...Object.fromEntries(Array.from({ length: TEARS }, (_, i) => [[`u_ZhudaTearPlace${i}`, { type: 'vec4' as const, value: [0, 0, 0, 1] }], [`u_ZhudaTearShape${i}`, { type: 'vec4' as const, value: [0, 0, 0, 0] }]]).flat()),
  u_ZhudaTearCount: { type: 'float' as const, value: 0 },
});
