// The surface hooks of the layered hosiery, for the engine's ZhudaLitSurfaceMaterial:
// HOSIERY (a knitted stocking: yarn and gaps from a tile, lace, seams, a garter strap, tears
// with ladders), GARMENT (shorts and trousers as a second layer: denim, wool, frayed hems,
// tears without ladders) and SKIRT (cloth with pressed pleats and a houndstooth check).
//
// Three things every hook here obeys, each learnt the hard way (see the README):
//  - no `fwidth`/`dFdx` under an `if` or in a function called from one: WGSL allows a
//    derivative only in uniform control flow, so the derivatives are taken once at the top and
//    passed in;
//  - the lit surface takes no uniform arrays: the TEARS tears are 2 x TEARS named uniforms;
//  - every material of one shader name is made with the same starting values (the name's
//    contract includes them): make it with zeros, then `set()` its own values.

import { BASE, SPAN } from './meshleg.ts';

const vOf = (y: number) => (y - BASE) / SPAN;

/** How many tears one surface can carry. */
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

export const HOSIERY = `${TEAR_GLSL}
// Lace: in each cell a flower (five to six petals, an open eye), a small flower
// between cells, two leaves on the diagonal and a vine, on a fine net. 1 is
// solid yarn, 0 an open hole.
float zhudaFlower(vec2 c, float petals, float size, float turn) {
  float r = length(c);
  float a = atan(c.y, c.x) + turn;
  float outline = size * (0.58 + 0.42 * abs(cos(a * petals * 0.5)));
  float petal = smoothstep(outline + 0.015, outline - 0.01, r);
  float gap = 1.0 - smoothstep(0.0, 0.018, abs(sin(a * petals * 0.5)) * r) ;
  float eye = smoothstep(size * 0.16, size * 0.24, r);
  float ring = 1.0 - smoothstep(0.008, 0.02, abs(r - size * 0.12));
  return max(petal * eye * (1.0 - 0.85 * gap * step(size * 0.3, r)), ring);
}
float zhudaLacePattern(vec2 q, float ground) {
  vec2 id = floor(q);
  vec2 c = fract(q) - 0.5;
  float h = zhudaHash(id);
  float big = zhudaFlower(c - vec2(0.06 * (h - 0.5), 0.04 * (h - 0.5)), 5.0 + floor(h * 2.0), 0.27 + 0.05 * h, h * 6.2832);
  vec2 c2 = fract(q + 0.5) - 0.5;
  float small = zhudaFlower(c2, 6.0, 0.12, zhudaHash(floor(q + 0.5) + 7.0) * 6.2832);
  vec2 l = vec2(c.x - c.y, c.x + c.y) * 0.7071;
  float leaf = smoothstep(1.0, 0.85, length(vec2((abs(l.x) - 0.36) / 0.1, l.y / 0.045)));
  float vine = 1.0 - smoothstep(0.01, 0.02, abs(c.y + 0.44 - 0.05 * sin(q.x * 6.2832)));
  vec2 m = fract(q * vec2(10.0, 11.5)) - 0.5;
  float net = 1.0 - smoothstep(0.03, 0.07, min(abs(m.y), abs(abs(m.x) - abs(m.y) * 0.58)));
  return clamp(max(max(big, small), max(max(leaf, vine), net * ground)), 0.0, 1.0);
}
void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  vec2 k = vec2(uv.x * u_ZhudaKnitScale.x, uv.y * u_ZhudaKnitScale.y + 0.22 * sin(uv.x * 39.0 + uv.y * 29.0));
  vec4 knit = zhudaSample_u_ZhudaKnit(k);
  // The foot (v below 0) draws its knit as its average: the stitches cannot follow its
  // shape well there, and at this size they are not seen anyway.
  float onFoot = smoothstep(0.01, -0.05, uv.y);
  knit = mix(knit, vec4(0.5, 0.5, mix(0.66, 0.3, step(u_ZhudaKnitParams.w, 0.01)), 0.06), onFoot);
  float footprint = max(length(dFdx(k)), length(dFdy(k))) + onFoot * 4.0;
  float detail = 1.0 - smoothstep(0.32, 1.12, footprint);
  float strain = s.vertexColor.a * 2.8;
  float tension = smoothstep(0.08, 1.8, strain);
  vec2 slope = (knit.rg * 255.0 - 128.0) / 127.0;
  float slopeVariance = max(0.0, 2.0 * knit.a - dot(slope, slope));
  float fiber = knit.b;
  float depth = u_ZhudaKnitParams.x, relief = u_ZhudaKnitParams.y, grain = u_ZhudaKnitParams.z, gapFloor = u_ZhudaKnitParams.w;
  float ladder = u_ZhudaKnitScale.z, gloss = u_ZhudaKnitScale.w;
  float mottling = sin(k.x * 0.73 + sin(k.y * 0.29) * 2.0) * cos(k.y * 1.74 + k.x * 0.31);
  float yarn = mix(gapFloor, 1.14, fiber);
  // Plumetis: a small dot of dense yarn every so many stitches.
  if (u_ZhudaKnitStyle.w > 0.5) {
    vec2 d = vec2(k.x / 9.0 + 0.5 * floor(k.y / 7.0), k.y / 7.0);
    float spot = 1.0 - smoothstep(0.17, 0.24, length((fract(d) - 0.5) * vec2(1.0, 1.4)));
    yarn += 2.6 * spot;
    slope *= 1.0 - 0.6 * spot;
  }
  // A mock seam down the back of the leg.
  if (u_ZhudaKnitStyle.x > 0.5) {
    float seam = 1.0 - smoothstep(0.0012, 0.0024, min(uv.x, 1.0 - uv.x));
    yarn += 3.0 * seam;
  }
  // Lace all over the leg: the knit gives way to flowers on a net.
  if (u_ZhudaKnitExtra.x > 0.5) {
    yarn = 1.2 * zhudaLacePattern(vec2(uv.x * 13.0, uv.y * 21.0), 0.16);
    slope *= 0.35;
  }
  // A lace top: a band of the same lace, its top in scallops with a fringe, bare skin above.
  float bare = 0.0;
  if (u_ZhudaKnitStyle.y < 1.5) {
    float t = (uv.y - u_ZhudaKnitStyle.y) / max(u_ZhudaKnitStyle.z - u_ZhudaKnitStyle.y, 0.001);
    float bumps = 18.0;
    float scallop = 1.0 - 0.16 * (1.0 - sqrt(abs(sin(uv.x * 3.14159 * bumps))));
    float fringe = 0.03 * step(0.5, fract(uv.x * 900.0)) * zhudaHash(vec2(floor(uv.x * 900.0), 2.0));
    if (t > scallop + fringe) bare = 1.0;
    else if (t > 0.0) {
      float band = zhudaLacePattern(vec2(uv.x * bumps, t * 2.6 + 0.3), 0.6);
      // A solid edge along the scallops, a firm welt where the lace meets the knit.
      float edge = 1.0 - smoothstep(0.0, 0.025, abs(t - scallop));
      float welt = 1.0 - smoothstep(0.0, 0.05, t);
      yarn = mix(yarn, 1.3 * max(band, max(edge, welt)), smoothstep(0.0, 0.03, t));
      slope *= 0.4;
    }
  }
  // Tights have a denser panty top from just below the crotch up (u_ZhudaKnitExtra.w: where it starts, as v; 0 for none).
  if (u_ZhudaKnitExtra.w > 0.0) yarn += 2.4 * smoothstep(u_ZhudaKnitExtra.w - 0.012, u_ZhudaKnitExtra.w + 0.012, uv.y);
  // A reinforced toe, knit denser, as most stockings have (the mesh marks the toes in its colour).
  float toe = clamp(1.0 - s.vertexColor.r, 0.0, 1.0);
  yarn += toe * (u_ZhudaKnitExtra.x > 0.5 ? 0.8 : 2.4);
  if (uv.y < 0.0) bare = 0.0;
  s.baseColor *= mix(0.60, 1.66, fiber) * (1.0 + grain * detail * mottling);

  float fray = 0.0, runs = 0.0, tearCoverage = 1.0;
  vec2 scale = vec2(2.7, ${SPAN.toFixed(3)});
  vec2 tearDx = dFdx(uv) * scale, tearDy = dFdy(uv) * scale;
  float edgeAA = clamp(0.55 * max(length(tearDx), length(tearDy)), 0.0003, 0.02);
${TEAR_CALLS('ladder')}
  s.baseColor *= mix(1.0, 1.36, fray);

  s.roughness = clamp(mix(s.roughness, 0.16, gloss) + 0.085 + 0.10 * tension + 0.30 * slopeVariance * relief * (1.0 - 0.6 * gloss), 0.04, 1.0);
  float bumpWeight = mix(0.62, 0.23, tension) * mix(0.35, 1.0, detail);
  s.normalTS = normalize(vec3(slope * vec2(0.50, 0.66) * relief * bumpWeight, 1.0));

  // Beer-Lambert through one porous layer: sheer seen straight on, dense toward the edge, thinner where stretched.
  float path = max(0.23, abs(dot(normalize(n), s.viewDirection)));
  float fabricAlpha = 1.0 - exp(-depth * yarn / (pow(path, 0.52) * (1.0 + 0.50 * strain)));
  s.alpha = max(fray * 0.83, fabricAlpha * (1.0 - runs)) * tearCoverage * (1.0 - bare);
  // Garter: a leather strap from the lace top up under the skirt, a cross on it.
  if (u_ZhudaKnitExtra.y > 0.5) {
    float du = abs(uv.x - u_ZhudaKnitExtra.z) * ${(2.7).toFixed(2)};
    float dv = (uv.y - u_ZhudaKnitStyle.z) * ${SPAN.toFixed(3)};
    float strap = step(du, 0.035) * step(-0.02, dv);
    float crossAt = dv - 0.17;
    float upright = step(du, 0.05) * step(abs(crossAt), 0.13);
    float bar = step(du, 0.13) * step(abs(crossAt - 0.04), 0.035);
    float shape = max(strap, max(upright, bar));
    if (shape > 0.5) {
      s.alpha = 1.0;
      s.baseColor = vec3(0.012, 0.011, 0.013);
      s.roughness = 0.32;
      s.normalTS = normalize(vec3(0.0, 0.0, 1.0));
      s.emission *= 0.0;
      s.sheenColor *= 0.2;
    }
  }

  s.sheenColor *= mix(0.77, mix(0.53, 1.22, fiber), detail * (1.0 - 0.68 * tension)) * (1.0 + 0.8 * gloss);
  s.sheenRoughness = mix(mix(s.sheenRoughness, 0.83, 0.42 * tension), 0.3, gloss * 0.5);
  float grazing = 1.0 - clamp(dot(normalize(n), s.viewDirection), 0.0, 1.0);
  float thigh = smoothstep(${vOf(-0.45).toFixed(4)}, ${vOf(0.58).toFixed(4)}, uv.y);
  float rim = pow(grazing, u_ZhudaKnitRim.y) * u_ZhudaKnitRim.x * mix(0.52, 1.0, thigh) * (1.0 + gloss);
  float yarnShine = mix(0.72, mix(0.46, 1.0, fiber), detail);
  s.emission += u_ZhudaKnitRimColor.rgb * rim * yarnShine * mix(1.0, 0.46, tension) * s.alpha;
}`;

// Shorts and trousers: denim (an indigo twill with white weft, faded at the
// front, white threads left across a rip) or wool; cut away below the hem, a
// frayed hem or a cuff; torn as a stocking is, without ladders.
export const GARMENT = `${TEAR_GLSL}
void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  float from = u_ZhudaGarment.x, denim = u_ZhudaGarment.y, frayed = u_ZhudaGarment.z, cuff = u_ZhudaGarment.w;
  // Fine weave fades out where it is finer than a pixel (else it beats against the pixels: moire).
  float twillPhase = uv.x * 2200.0 + uv.y * 3000.0;
  float twillFade = 1.0 - smoothstep(0.6, 2.4, fwidth(twillPhase));
  float lineFade = 1.0 - smoothstep(0.6, 2.4, fwidth(uv.y * 5400.0));
  float twill = sin(twillPhase) * twillFade;
  float slub = mix(0.5, zhudaHash(vec2(floor(uv.y * 1500.0), 3.0)), 1.0 - smoothstep(0.3, 1.2, fwidth(uv.y * 1500.0)));
  vec3 cloth = u_ZhudaGarmentColor.rgb;
  float front = exp(-pow((uv.x - 0.5) * 5.0, 2.0)) * smoothstep(${vOf(-0.6).toFixed(4)}, ${vOf(0.9).toFixed(4)}, uv.y);
  vec3 weave = mix(cloth * (0.82 + 0.18 * twill) * (0.9 + 0.2 * slub), cloth * 1.6 + 0.04, denim * front * 0.3);
  weave = mix(weave, vec3(0.8, 0.8, 0.78), denim * 0.08 * (0.5 + 0.5 * sin(uv.y * 5400.0) * lineFade));
  float alpha = 1.0;
  vec3 color = weave;
  float edge = uv.y - from;
  if (edge < 0.0) {
    alpha = 0.0;
    // Cut-off threads, each its own length.
    float column = floor(uv.x * 900.0);
    float hang = zhudaHash(vec2(column, 7.0)) * 0.010 * frayed * (0.4 + 0.6 * zhudaHash(vec2(floor(uv.x * 60.0), 9.0)));
    float strand = 1.0 - smoothstep(0.2, 0.42, abs(fract(uv.x * 900.0) - 0.5));
    if (-edge < hang) { alpha = strand; color = vec3(0.78, 0.8, 0.84); }
  } else if (cuff > 0.5 && edge < 0.016) {
    color *= 0.75 + 0.25 * smoothstep(0.0, 0.003, edge) * smoothstep(0.016, 0.012, edge);
  } else if (frayed > 0.5 && edge < 0.004 * frayed) {
    color = mix(vec3(0.75, 0.78, 0.84), color, edge / (0.004 * frayed));
  }
  float fray = 0.0, runs = 0.0, tearCoverage = 1.0;
  vec2 scale = vec2(2.7, ${SPAN.toFixed(3)});
  vec2 tearDx = dFdx(uv) * scale, tearDy = dFdy(uv) * scale;
  float edgeAA = clamp(0.55 * max(length(tearDx), length(tearDy)), 0.0003, 0.02);
${TEAR_CALLS('0.0')}
  // A rip in denim leaves its white weft across the hole.
  float weft = denim * (1.0 - smoothstep(0.12, 0.26, abs(fract(uv.y * ${(SPAN * 80).toFixed(1)}) - 0.5))) * step(0.3, zhudaHash(vec2(floor(uv.y * ${(SPAN * 80).toFixed(1)}), 11.0)));
  float hole = 1.0 - tearCoverage;
  color = mix(color, vec3(0.86, 0.86, 0.84), max(fray * 0.6, weft * hole));
  s.baseColor = color;
  s.alpha = alpha * max(tearCoverage, weft * hole);
  s.roughness = mix(0.62, 0.86, denim);
  s.normalTS = normalize(vec3(0.16 * twill, 0.1 * twill, 1.0));
}`;

export const SKIRT = `
void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  float phase = uv.x * 2600.0 + uv.y * 520.0;
  float twill = sin(phase) * (1.0 - smoothstep(0.6, 2.4, fwidth(phase)));
  // Pressed pleats: four cloth columns a pleat, from the outer crease (0) over a face to the
  // inner crease (0.5) and back. Each face is lit as a flat pressed plane, the inner crease
  // is shadowed, the outer one catches a line of light; the edges are as sharp as a pixel allows.
  float pleats = u_ZhudaSkirtPleat.x, pressed = u_ZhudaSkirtPleat.y;
  float q = uv.x * pleats;
  float w = clamp(fwidth(q) * 1.5, 0.002, 0.25);
  float f = fract(q);
  float face = smoothstep(0.5 - w, 0.5 + w, f) - smoothstep(1.0 - w, 1.0, f) - (1.0 - smoothstep(0.0, w, f));
  float open = smoothstep(0.0, 0.35, uv.y);
  float inner = exp(-pow((f - 0.5) / max(0.05, w), 2.0));
  float outer = exp(-pow(min(f, 1.0 - f) / max(0.04, w), 2.0));
  // Houndstooth: a two-colour twill check, light and dark squares joined by diagonal teeth.
  vec3 cloth = u_ZhudaSkirtColor.rgb;
  if (u_ZhudaSkirtPleat.z > 0.5) {
    vec2 g = vec2(uv.x * 260.0, uv.y * 52.0);
    vec2 cell = mod(floor(g), 2.0);
    vec2 h = fract(g);
    // In the squares between a dark and a light one, diagonal stripes, only on the half
    // that touches the dark square: the dark squares grow the teeth.
    float stripes = step(0.5, fract((h.x + h.y) * 2.0));
    float half_ = cell.x > cell.y ? step(h.x, h.y) : step(h.y, h.x);
    float tone = mix(1.0 - stripes * half_, 1.0 - cell.x, step(abs(cell.x - cell.y), 0.5));
    // Finer than a pixel, the check is seen as its average grey.
    float seen = 1.0 - smoothstep(0.35, 0.8, max(fwidth(g.x), fwidth(g.y)));
    cloth = mix(u_ZhudaSkirtColor2.rgb, u_ZhudaSkirtColor.rgb, mix(0.5, tone, seen));
  }
  s.baseColor = cloth * (0.9 + 0.1 * twill) * (1.0 + pressed * open * 0.12 * outer);
  s.occlusion *= 1.0 - pressed * open * 0.55 * inner;
  s.roughness = u_ZhudaSkirtColor.w - pressed * 0.15 * outer;
  s.normalTS = normalize(vec3(0.10 * twill + pressed * open * 0.55 * (1.0 - 2.0 * face), 0.05 * twill, 1.0));
}`;
