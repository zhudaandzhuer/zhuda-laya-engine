// 撕襪實驗室: a test bench on the engine's public API (no score, no clock). Two
// legs in stockings, and over them a skirt, shorts, trousers or nothing. Drag a
// leg to pull what is on top there, pull hard and it tears; through a hole in a
// garment the stocking below can be pulled in turn. Drag a skirt's hem to lift
// it; drag elsewhere to turn round, the wheel to come nearer. The kinds of
// stocking are in patterns.ts, what is worn over them in bottoms.ts.
import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaSceneLook,
  ZhudaLitSurfaceMaterial,
  ZhudaHdrEnvironment,
  zhudaStudioEnvironment,
  ZhudaCloth,
  createZhudaClothTube,
  createSurfaceTexture,
  createSurfaceMaterial,
  ZhudaTriangleBvh,
  ZhudaDynamicMesh,
} from 'zhuda-laya-engine';
import { TYPES, COLORS, tileOf, display, type StockingType } from './patterns';
import { BOTTOMS, type Bottom, type PantsSpec, type SkirtSpec } from './bottoms';
import { AROUND, BASE, LT, SPAN, TOP, UP, bridgeCrotch, clamp, createLayer, createLeg, hipReach, legTable, offsetAt, outwardAt, pull, relax, tearOrigin, toWorld, type Leg, type LegData } from './meshleg';
import { createHud } from './hud';

const TEARS = 12;
const state: { ready: boolean; error?: string; note?: any; api?: any } = { ready: false };
Reflect.set(window, '__GAME__', state);

let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const vOf = (y: number) => (y - BASE) / SPAN;

// A tear: a ragged hole, ladders running from it (`ladder` 0..1), loose yarn at its lip.
const TEAR_GLSL = `
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
const TEAR_CALLS = (ladder: string) =>
  Array.from({ length: TEARS }, (_, i) => `  if (u_ZhudaTearCount > ${i}.5) zhudaTear(u_ZhudaTearPlace${i}, u_ZhudaTearShape${i}, uv, scale, tearDx, tearDy, edgeAA, ${ladder}, fray, runs, tearCoverage);`).join('\n');
const TEAR_UNIFORMS = () => ({
  // The lit surface takes no uniform arrays: twelve pairs by name.
  ...Object.fromEntries(Array.from({ length: TEARS }, (_, i) => [[`u_ZhudaTearPlace${i}`, { type: 'vec4' as const, value: [0, 0, 0, 1] }], [`u_ZhudaTearShape${i}`, { type: 'vec4' as const, value: [0, 0, 0, 0] }]]).flat()),
  u_ZhudaTearCount: { type: 'float' as const, value: 0 },
});

const HOSIERY = `${TEAR_GLSL}
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
const GARMENT = `${TEAR_GLSL}
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

const SKIRT = `
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

async function main() {
  const params = new URLSearchParams(location.search);
  const number = (name: string, fallback: number) => (params.has(name) ? Number(params.get(name)) : fallback);
  const container = document.querySelector<HTMLElement>('#game')!;
  const coarse = matchMedia('(pointer: coarse)').matches;
  // Phones: the canvas at twice CSS pixels and the 3D picture at three quarters of it,
  // brought up with FSR (measured on a vivo V40: the knit shows, ~43 fps; the old 1.5 cap
  // with a plain stretch lost the knit at ~52 fps, full native resolution ran at ~23 fps).
  const context = await ZhudaEngine.boot({ container, dprCap: number('dpr', 2), features: ['core', '3d', 'postProcess'], bgColor: '#05080f' });
  Reflect.set(window, '__GAME_RENDERER__', () => context.renderer.errors.slice(0, 6));
  const scene = Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.3, 0.3, 0.32, 1] });
  const size = () => ({ width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) });

  // --- camera: turned round the thighs; drawn back on a narrow screen so both legs fit ----------
  const target: [number, number, number] = [0, number('ty', 0.645), 0];
  const view = { yaw: (number('yaw', 0) * Math.PI) / 180, pitch: (number('pitch', 3) * Math.PI) / 180, fov: 30, zoom: number('zoom', 1) };
  const eye: [number, number, number] = [0, 0, 0];
  let distance = 0.95;
  const placeEye = () => {
    const { width, height } = size(),
      t = Math.tan((view.fov * Math.PI) / 360);
    // From the waistband down to the soles: the top of the picture is the skirt, the
    // bottom the feet (zoom brings it nearer round the same middle).
    // A narrow screen keeps the drawer's bar (about 60 px) at the bottom: the feet stand above it.
    const reserved = width > 760 ? 0 : 60 / height;
    const top = toWorld(0, TOP - 0.1, 0)[1],
      span = (top + 0.03) / (1 - reserved),
      bottom = top - span;
    target[1] = params.has('ty') ? number('ty', 0.5) : (top + bottom) / 2;
    distance = Math.max(span / 2 / t, 0.3 / (t * (width / height))) * view.zoom;
    // On a wide screen the panel takes the right side: the legs stand in the middle of what is left.
    const panel = width > 760 ? 284 : 0,
      shift = (panel / 2 / height) * 2 * distance * t;
    target[0] = Math.cos(view.yaw) * shift;
    target[2] = -Math.sin(view.yaw) * shift;
    eye[0] = target[0] + Math.sin(view.yaw) * Math.cos(view.pitch) * distance;
    eye[1] = target[1] + Math.sin(view.pitch) * distance;
    eye[2] = target[2] + Math.cos(view.yaw) * Math.cos(view.pitch) * distance;
  };
  placeEye();
  const camera = Zhuda3D.createCamera(scene, { position: eye, fov: view.fov, near: 0.03, far: 60, clearColor: [0.012, 0.02, 0.04, 1] });
  const aimCamera = () => {
    placeEye();
    camera.transform.position = new Laya.Vector3(...eye);
    camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0));
  };
  aimCamera();
  const look = new ZhudaSceneLook(
    scene,
    camera,
    {
      preset: 'day' as const,
      atmosphere: false,
      sky: [0.012, 0.02, 0.04],
      // The floor fades into the background behind the figure: no horizon line.
      fog: { color: [0.012, 0.02, 0.04], start: 2.6, end: 4.2 },
      ambient: [0.2, 0.2, 0.23],
      ambientGround: [0.16, 0.14, 0.13],
      sun: { azimuthDeg: -8, elevationDeg: 68, intensity: 1.7, color: [1, 0.94, 0.88] },
      shadows: { distance: 5, resolution: (coarse ? 1024 : 2048) as 1024 | 2048, cascades: 2 as const, softness: 'soft' as const, strength: 0.75 },
      grade: { exposure: 0.8, bloom: 0.22, ao: number('ao', 0.6), aoRadius: 0.1, antialias: ((params.get('aa') as any) || 'smaa') as 'fxaa' | 'smaa' | 'msaa' | 'none', toneMapping: 'agx' as any, saturation: 1.08, grain: 0.1, vignette: 0.32 },
    },
    { quality: (params.has('q') ? number('q', 2) : coarse ? 2 : 3) as 0 | 1 | 2 | 3 },
  );
  // The 3D picture can be drawn smaller than the canvas and brought up with FSR
  // (the panel stays at the canvas's own sharpness).
  // (FSR is skipped under LayaAir's own FXAA, so phones use SMAA.)
  const renderScale = number('rs', coarse ? 0.75 : 1);
  if (renderScale < 1) look.setRenderScale(renderScale, { upscale: (params.get('up') as any) || 'fsr' });
  new ZhudaHdrEnvironment(scene, { cube: zhudaStudioEnvironment({ intensity: 0.35, walls: [0.09, 0.085, 0.085] }) }, { camera, sky: false });
  // Cyan lights from behind on both sides, dimmer than the sun so the sun keeps its shadow
  // (LayaAir gives the shadow to the brightest directional light).
  for (const side of [-1, 1]) {
    const rim = Zhuda3D.createDirectionalLight(scene);
    rim.light.color = new Laya.Color(0.18, 1.05, 1.45, 1);
    rim.light.intensity = 1.5 * (side > 0 ? 1 : 0.8);
    rim.node.transform.position = new Laya.Vector3(side * 1.7, 0.75, -1.6);
    rim.node.transform.lookAt(new Laya.Vector3(0, 0.62, 0), new Laya.Vector3(0, 1, 0));
  }

  // --- legs ---------------------------------------------------------------------------
  const skin = new ZhudaLitSurfaceMaterial({
    name: 'ZhudaGameSkin',
    subsurface: { color: [0.95, 0.5, 0.4], wrap: 0.45, back: 0.2 },
    surface: 'void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) { s.thickness = 0.3; }',
    material: { color: [0xc7 / 255, 0xa8 / 255, 0x9d / 255, 1], roughness: 0.62 },
  });
  // The legs: modelled in Blender with MPFB (blender/export_legs.py), cut at the waistband.
  const legData = (await (await fetch('assets/legs.json')).json()) as { legs: LegData[]; joints: Record<string, number[]> };
  // The panty top of tights starts 6 cm below the crotch.
  const pantyV = (legData.joints.crotch[1] / LT + (BASE - 0.38) - 0.28 - BASE) / SPAN;
  const legs: Leg[] = [];
  for (const side of [-1, 1]) {
    const leg = createLeg(scene, legData.legs.find((l) => l.side === side)!);
    leg.skin.node.meshRenderer.sharedMaterial = skin.material;
    leg.skin.node.meshRenderer.castShadow = leg.skin.node.meshRenderer.receiveShadow = true;
    leg.hosiery.node.meshRenderer.castShadow = false;
    leg.hosiery.node.meshRenderer.receiveShadow = true;
    legs.push(leg);
  }
  // The stocking spans the crotch as cloth does.
  bridgeCrotch(legs, legs, () => 0.011);
  // A floor in the background's colour, so the feet stand and cast their shadows.
  const floor = new Laya.MeshSprite3D(Zhuda3D.createPrimitiveMesh('box', { width: 12, height: 0.1, depth: 12 }));
  floor.meshRenderer.sharedMaterial = createSurfaceMaterial({ type: 'pbr', color: [0.008, 0.01, 0.016, 1], roughness: 0.9 });
  floor.meshRenderer.receiveShadow = true;
  floor.transform.position = new Laya.Vector3(0, -0.05, 0);
  scene.addChild(floor);
  const pickers = legs.map((leg) => {
    const positions = new Float32Array(leg.skinRest.length);
    for (let i = 0; i < positions.length; i += 3) positions.set(toWorld(leg.skinRest[i], leg.skinRest[i + 1], leg.skinRest[i + 2]), i);
    return new ZhudaTriangleBvh({ positions, indices: leg.skin.data.indices });
  });
  const uvOf = (leg: Leg, hit: { triangle: number; barycentric: [number, number, number] }) => {
    const indices = leg.skin.data.indices,
      uvs = leg.skin.data.uvs!;
    let u = 0,
      v = 0;
    for (let c = 0; c < 3; c++) {
      const vertex = indices[hit.triangle * 3 + c];
      u += uvs[vertex * 2] * hit.barycentric[c];
      v += uvs[vertex * 2 + 1] * hit.barycentric[c];
    }
    return [u, v] as [number, number];
  };
  // Above the waistband, a fitted black top: a tube round the hips that narrows to the waist.
  {
    const columns = 64,
      rows = 14,
      from = TOP - 0.2,
      to = TOP + 1.6;
    const positions = new Float32Array((columns + 1) * (rows + 1) * 3),
      normals = new Float32Array(positions.length),
      uvs = new Float32Array((columns + 1) * (rows + 1) * 2),
      indices = new Uint16Array(columns * rows * 6);
    let k = 0;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows,
        y = from + (to - from) * t;
      const waist = 1 - 0.17 * Math.sin(Math.min(1, t / 0.55) * Math.PI * 0.5) + (0.06 * Math.max(0, t - 0.55)) / 0.45;
      for (let c = 0; c <= columns; c++) {
        const angle = (c / columns) * Math.PI * 2,
          at = r * (columns + 1) + c;
        const reach = (hipReach(legs, TOP, angle) + 0.07) * waist;
        positions.set(toWorld(Math.sin(angle) * reach, y, Math.cos(angle) * reach), at * 3);
        normals.set([Math.sin(angle), 0, Math.cos(angle)], at * 3);
        uvs.set([c / columns, t], at * 2);
        if (r < rows && c < columns) {
          const b = at + 1,
            d = at + columns + 1;
          indices.set([at, b, d, b, d + 1, d], k);
          k += 6;
        }
      }
    }
    const top = new ZhudaDynamicMesh({ positions, normals, uvs, indices }, scene);
    top.node.meshRenderer.sharedMaterial = createSurfaceMaterial({ type: 'pbr', color: [0.014, 0.014, 0.017, 1], roughness: 1 });
    top.node.meshRenderer.castShadow = top.node.meshRenderer.receiveShadow = true;
  }

  // --- what can be torn: each surface has its material, its tears and its rules -----------------
  type Tears = { center: number[]; axis: number[]; shape: number[]; count: number };
  type Rules = { tearAt: number; holeSize: number; ladder: number; lace?: [number, number] };
  const materials = new Map<Leg, ZhudaLitSurfaceMaterial>();
  const tears = new Map<Leg, Tears>();
  const rules = new Map<Leg, Rules>();
  const freshTears = (): Tears => ({ center: new Array(TEARS * 2).fill(0), axis: new Array(TEARS * 2).fill(0), shape: new Array(TEARS * 4).fill(0), count: 0 });
  const writeTears = (surface: Leg) => {
    const list = tears.get(surface)!,
      material = materials.get(surface)!;
    for (let i = 0; i < list.count; i++) {
      material.set(`u_ZhudaTearPlace${i}`, [list.center[i * 2], list.center[i * 2 + 1], list.axis[i * 2], list.axis[i * 2 + 1]]);
      material.set(`u_ZhudaTearShape${i}`, list.shape.slice(i * 4, i * 4 + 4));
    }
    material.set('u_ZhudaTearCount', list.count);
  };
  /** Whether (u, v) lies in a hole already torn in this surface. */
  const inHole = (surface: Leg, u: number, v: number) => {
    const list = tears.get(surface);
    if (!list) return false;
    for (let i = 0; i < list.count; i++) {
      const du = u - list.center[i * 2],
        dv = v - list.center[i * 2 + 1];
      if (Math.hypot((du - Math.round(du)) * 2.7, dv * SPAN) < list.shape[i * 4 + 1] * 1.25) return true;
    }
    return false;
  };

  // Stockings: one material a leg, made again for each kind.
  const textures = new Map<string, any>();
  const textureOf = (type: StockingType) => {
    const key = JSON.stringify(type.tile);
    if (!textures.has(key)) {
      const tile = tileOf(type);
      textures.set(key, createSurfaceTexture(tile.size, tile.size, tile.pixels, 'data', { mipmap: true, anisoLevel: 16 }));
    }
    return textures.get(key);
  };
  // The engine's shader contract includes each uniform's starting value: every material of one
  // shader is made with the same zeros, and its own values are set straight after (see HANDOFF).
  const withValues = (material: ZhudaLitSurfaceMaterial, values: Record<string, number[] | number>) => {
    for (const [name, value] of Object.entries(values)) material.set(name, value);
    return material;
  };
  const zeros = (names: string[]) => Object.fromEntries(names.map((name) => [name, { type: 'vec4' as const, value: [0, 0, 0, 0] }]));
  const stockingMaterial = (type: StockingType, shade: number, side: number) =>
    withValues(new ZhudaLitSurfaceMaterial(
      {
        name: 'ZhudaGameStocking',
        surface: HOSIERY,
        common: true,
        // The edge glow takes a little of the yarn's own colour.
        // Dark yarn glows less at its edge than light yarn (a black stocking stays black).
        sheen: { color: display(shade).map((c, _, all) => (0.35 + 0.65 * c ** 0.5) * type.sheen * 0.65 * (0.18 + 0.82 * Math.max(...all) ** 0.8)) as [number, number, number], roughness: type.sheenRoughness },
        uniforms: {
          u_ZhudaKnit: { type: 'texture2D' },
          ...zeros(['u_ZhudaKnitParams', 'u_ZhudaKnitScale', 'u_ZhudaKnitStyle', 'u_ZhudaKnitExtra', 'u_ZhudaKnitRim', 'u_ZhudaKnitRimColor']),
          ...TEAR_UNIFORMS(),
        },
        material: { color: [...display(shade), 1], roughness: type.roughness, metallic: 0, blend: 'alpha', doubleSided: false, anisotropy: 0.64, anisotropyRotationDeg: 73 } as any,
      },
      { u_ZhudaKnit: textureOf(type) },
    ), {
      u_ZhudaKnitParams: [type.depth, type.relief, type.grain, type.gapFloor],
      u_ZhudaKnitScale: [type.tilesU, type.tilesV, type.ladder, type.gloss],
      u_ZhudaKnitStyle: [type.seam ? 1 : 0, type.lace ? type.lace[0] : 2, type.lace ? type.lace[1] : 2, type.dots ? 1 : 0],
      // All-over lace; garter; where the strap runs round the leg (a little to the outside of the front).
      u_ZhudaKnitExtra: [type.fullLace ? 1 : 0, type.garter ? 1 : 0, 0.5 + side * 0.07, type.lace ? 0 : pantyV],
      u_ZhudaKnitRim: [0.38, 2.7, 0, 0],
      u_ZhudaKnitRimColor: [0.13, 0.68, 0.99, 0],
    });
  const garmentMaterial = (spec: PantsSpec) =>
    withValues(new ZhudaLitSurfaceMaterial({
      name: 'ZhudaGameGarment',
      surface: GARMENT,
      common: true,
      sheen: { color: spec.fabric === 'wool' ? [0.18, 0.18, 0.2] : [0.25, 0.27, 0.32], roughness: 0.75 },
      uniforms: {
        ...zeros(['u_ZhudaGarment', 'u_ZhudaGarmentColor']),
        ...TEAR_UNIFORMS(),
      },
      material: { color: [1, 1, 1, 1], roughness: 0.8, metallic: 0, blend: 'cutout', doubleSided: true } as any,
    }), {
      u_ZhudaGarment: [vOf(spec.from), spec.fabric === 'denim' ? 1 : 0, spec.frayed ? spec.fringe ?? 1 : 0, spec.cuff ? 1 : 0],
      u_ZhudaGarmentColor: [...display(spec.color).map((c) => c ** 2.2), 1],
    });

  let current = TYPES.find((t) => t.id === params.get('type')) || TYPES[1];
  let color = params.has('color') ? Number(params.get('color')) : current.colors[0];
  let bottom = BOTTOMS.find((b) => b.id === params.get('bottom')) || BOTTOMS[0];
  let garments: (Leg | null)[] = [null, null];
  let skirt: { cloth: ZhudaCloth; material: ZhudaLitSurfaceMaterial; columns: number; rows: number } | null = null;

  // --- skirts: the engine's cloth, rebuilt for each style --------------------------------------
  const buildSkirt = (spec: SkirtSpec) => {
    const columns = coarse ? 64 : 96,
      rows = coarse ? Math.round(spec.rows * 0.75) : spec.rows;
    // Pressed pleats take four columns each: outer crease, face, inner crease, face.
    const pleatCount = spec.pressed ? columns / 4 : spec.pleats;
    const waistY = TOP - 0.02;
    const shape = createZhudaClothTube({ columns, rows, center: toWorld(0, waistY, 0), topRadius: 0.2, bottomRadius: 0.3, length: (waistY - spec.hem) * LT });
    // A tube is round and a waist is not: each ring is laid round the hips (as far
    // as the legs reach in each direction, a flare, folds), its particles evenly
    // along it, and every constraint takes its new length.
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1),
        y = waistY - t * (waistY - spec.hem);
      const ring: [number, number][] = [];
      const samples = 360;
      for (let a = 0; a <= samples; a++) {
        const angle = (a / samples) * Math.PI * 2;
        const fold = spec.pleats && !spec.pressed ? Math.abs(((angle / (Math.PI * 2)) * spec.pleats) % 1 - 0.5) * 2 - 0.5 : 0;
        // A fitted skirt follows the legs down; a flared one hangs from the hips.
        const body = spec.flare < 0.1 ? hipReach(legs, y, angle) : hipReach(legs, Math.max(y, 1.05), angle);
        const reach = body + 0.06 + spec.flare * t * t + fold * (spec.pleatDepth * (0.3 + 0.7 * t));
        ring.push([Math.sin(angle) * reach, Math.cos(angle) * reach]);
      }
      const lengths = [0];
      for (let a = 1; a <= samples; a++) lengths.push(lengths[a - 1] + Math.hypot(ring[a][0] - ring[a - 1][0], ring[a][1] - ring[a - 1][1]));
      for (let c = 0; c < columns; c++) {
        const want = (c / columns) * lengths[samples];
        let a = 1;
        while (a < samples && lengths[a] < want) a++;
        const f = (want - lengths[a - 1]) / (lengths[a] - lengths[a - 1] || 1);
        let x = ring[a - 1][0] + (ring[a][0] - ring[a - 1][0]) * f,
          z = ring[a - 1][1] + (ring[a][1] - ring[a - 1][1]) * f;
        if (spec.pressed) {
          // The zigzag: out at the outer crease, in at the inner one; stitched flat at the
          // hips, open from a third of the way down.
          const depth = spec.pleatDepth * (0.12 + 0.88 * Math.min(1, t / 0.35) ** 2) * [1, 0, -1, 0][c % 4];
          const l = Math.hypot(x, z) || 1;
          x += (x / l) * depth;
          z += (z / l) * depth;
        }
        shape.particles.set(toWorld(x, y, z), (r * columns + c) * 3);
      }
    }
    const { a: ca, b: cb, rest } = shape.constraints;
    for (let i = 0; i < rest.length; i++) {
      const p = shape.particles;
      rest[i] = Math.hypot(p[ca[i] * 3] - p[cb[i] * 3], p[ca[i] * 3 + 1] - p[cb[i] * 3 + 1], p[ca[i] * 3 + 2] - p[cb[i] * 3 + 2]);
    }
    // Pressed pleats keep their folds: a stiffer bend. Wool loses its swing quickly (a high
    // drag); a light chiffon keeps a little more.
    const cloth = new ZhudaCloth(shape, scene, { thickness: 0.008, friction: 0.6, compliance: { structural: 0, shear: 4e-4, bend: spec.pressed ? 2e-5 : 6e-4 }, windDrag: spec.windDrag, drag: spec.windDrag > 3 ? 2.5 : 4.5 });
    const material = withValues(new ZhudaLitSurfaceMaterial({
      name: 'ZhudaGameSkirt',
      surface: SKIRT,
      sheen: { color: [0.07, 0.07, 0.08], roughness: 0.85 },
      uniforms: zeros(['u_ZhudaSkirtColor', 'u_ZhudaSkirtColor2', 'u_ZhudaSkirtPleat']),
      material: { doubleSided: true, roughness: 0.8 },
    }), { u_ZhudaSkirtColor: [...display(spec.color).map((c) => c ** 2.2), spec.windDrag > 3 ? 0.55 : 0.8], u_ZhudaSkirtPleat: [pleatCount, spec.pressed ? 1 : 0, spec.pattern === 'houndstooth' ? 1 : 0, 0], u_ZhudaSkirtColor2: [...display(spec.color2 ?? spec.color).map((c) => c ** 2.2), 1] });
    cloth.node.meshRenderer.sharedMaterial = material.material;
    cloth.node.meshRenderer.castShadow = cloth.node.meshRenderer.receiveShadow = true;
    for (let c = 0; c < columns; c++) cloth.solver.pin(c);
    for (const leg of legs) cloth.solver.addCollider(legTable(leg, Math.min(spec.hem - 0.6, -0.4), 0.015));
    for (let i = 0; i < 200; i++) cloth.update(1 / 60);
    return { cloth, material, columns, rows };
  };
  const buildGarments = (spec: PantsSpec) => {
    const fit = (y: number) => spec.fit + (spec.hemFit - spec.fit) * clamp((0.6 - y) / (0.6 - spec.from), 0, 1);
    const layers = legs.map((leg) => {
      const layer = createLayer(scene, leg, fit, spec.reach);
      const material = garmentMaterial(spec);
      layer.hosiery.node.meshRenderer.sharedMaterial = material.material;
      layer.hosiery.node.meshRenderer.castShadow = layer.hosiery.node.meshRenderer.receiveShadow = true;
      materials.set(layer, material);
      tears.set(layer, freshTears());
      rules.set(layer, { tearAt: spec.tearAt, holeSize: spec.holeSize, ladder: 0 });
      return layer;
    });
    // Trousers span the crotch too.
    bridgeCrotch(legs, layers, fit);
    return layers;
  };

  const surfaces = () => [...legs, ...garments.filter((g): g is Leg => !!g)];

  // --- the pull, as the reference drives it -------------------------------------------------
  const grip = { leg: legs[0] as Leg, u: 0.5, v: 0.6, direction: null as number[] | null };
  let amount = 0,
    goal = 0,
    speed = 0,
    dirty = false;
  const setGrip = (surface: Leg, u: number, v: number, direction: number[] | null) => {
    if (grip.leg !== surface) relax(grip.leg);
    Object.assign(grip, { leg: surface, u, v, direction });
    dirty = true;
  };

  type Held =
    | { kind: 'leg'; id: number; x: number; y: number; leg: Leg; u: number; v: number; start: number[]; out: number[]; unit: number; right: number[]; up: number[]; engaged: boolean }
    | { kind: 'skirt'; id: number; x: number; y: number; pinch: { index: number; offset: number[] }[]; anchor: number[]; at: number[]; want: number[]; out: number[]; unit: number; right: number[]; up: number[] }
    | { kind: 'turn'; id: number; x: number; y: number };
  let held: Held | null = null;

  const newRound = () => {
    for (const surface of surfaces()) {
      tears.set(surface, freshTears());
      if (materials.has(surface)) writeTears(surface);
      relax(surface);
    }
    // Rips a garment comes with, already open.
    if (bottom.spec.kind === 'pants')
      for (const rip of bottom.spec.rips ?? []) {
        const garment = garments[rip.side < 0 ? 0 : 1];
        const list = garment && tears.get(garment);
        if (!garment || !list) continue;
        const i = list.count++;
        list.center.splice(i * 2, 2, rip.u, vOf(rip.y));
        list.axis.splice(i * 2, 2, Math.sin(rip.turn), Math.cos(rip.turn));
        list.shape.splice(i * 4, 4, rip.size * 0.5, rip.size, rip.u * 17, 1);
        writeTears(garment);
      }
    grip.leg = legs[0];
    amount = goal = speed = 0;
    held = null;
    hud.update();
  };
  const dress = (type: StockingType, shade: number) => {
    current = type;
    color = shade;
    for (const leg of legs) {
      const old = materials.get(leg);
      const material = stockingMaterial(type, shade, leg.side);
      leg.hosiery.node.meshRenderer.sharedMaterial = material.material;
      materials.set(leg, material);
      old?.dispose();
      rules.set(leg, { tearAt: type.tearAt, holeSize: type.holeSize, ladder: type.ladder, lace: type.lace });
    }
    newRound();
  };
  const wear = (next: Bottom) => {
    bottom = next;
    if (skirt) {
      skirt.cloth.dispose();
      skirt.material.dispose();
      skirt = null;
    }
    for (const garment of garments)
      if (garment) {
        materials.get(garment)?.dispose();
        garment.hosiery.dispose();
        materials.delete(garment);
        tears.delete(garment);
        rules.delete(garment);
      }
    garments = [null, null];
    if (next.spec.kind === 'skirt') skirt = buildSkirt(next.spec);
    if (next.spec.kind === 'pants') garments = buildGarments(next.spec);
    newRound();
  };

  const tear = () => {
    const surface = grip.leg,
      rule = rules.get(surface)!;
    const [u, v] = tearOrigin(surface, grip.u, grip.v);
    const list = tears.get(surface)!;
    // A lace-top stocking ends at its top: nothing to tear above it.
    const above = !!rule.lace && v > rule.lace[1];
    let near = false;
    for (let i = 0; i < list.count; i++) {
      const du = u - list.center[i * 2],
        dv = v - list.center[i * 2 + 1];
      if (Math.hypot((du - Math.round(du)) * 2.7, dv * SPAN) < 0.105 * rule.holeSize) near = true;
    }
    if (!near && !above && list.count < TEARS) {
      const i = list.count++;
      const turn = (u - 0.5) * Math.PI * 2,
        d = grip.direction || [0, 0, 0];
      const sideways = grip.direction ? d[0] * Math.cos(turn) - d[2] * Math.sin(turn) : -0.32,
        upward = grip.direction ? d[1] : 0;
      const angle = Math.atan2(-upward, 0.54 + Math.abs(sideways)) * 0.67 + (random() - 0.5) * 0.3;
      const h = rule.holeSize;
      list.center.splice(i * 2, 2, u, v);
      list.axis.splice(i * 2, 2, Math.sin(angle), Math.cos(angle));
      list.shape.splice(i * 4, 4, (0.49 + 0.16 * random() + 0.05 * Math.abs(sideways)) * (0.45 + 0.55 * rule.ladder) * 0.6 * h, (0.095 + 0.045 * random() + 0.025 * Math.abs(upward)) * h, random() * Math.PI * 2, 0.52);
      writeTears(surface);
    }
    goal = 0;
    speed = -9;
    held = null;
  };

  // --- the pointer ------------------------------------------------------------------
  const surface = container;
  const rayAt = (clientX: number, clientY: number) => {
    const box = surface.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * 2 - 1,
      y = 1 - ((clientY - box.top) / box.height) * 2;
    const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]],
      fl = Math.hypot(f[0], f[1], f[2]);
    const forward = f.map((c) => c / fl);
    const rl = Math.hypot(forward[2], forward[0]);
    const right = [-forward[2] / rl, 0, forward[0] / rl];
    const up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
    const t = Math.tan((view.fov * Math.PI) / 360),
      aspect = box.width / box.height;
    const direction = [0, 1, 2].map((c) => forward[c] + right[c] * x * t * aspect + up[c] * y * t);
    const l = Math.hypot(direction[0], direction[1], direction[2]);
    return { origin: [...eye], direction: direction.map((c) => c / l), right, up, height: box.height };
  };
  const v3 = (c: number[]) => ({ x: c[0], y: c[1], z: c[2] });
  const down = (event: PointerEvent) => {
    if (held || event.button !== 0 || (event.target as HTMLElement).closest?.('[data-hud]')) return;
    const ray = rayAt(event.clientX, event.clientY);
    let best: any = null;
    legs.forEach((leg, i) => {
      const hit = pickers[i].raycast({ origin: v3(ray.origin), direction: v3(ray.direction) }, 10, { side: 'front' });
      if (hit && (!best || hit.distance < best.distance)) best = { kind: 'leg', distance: hit.distance, index: i, hit };
    });
    if (skirt) {
      const { solver } = skirt.cloth;
      const particle = solver.nearestToRay(ray.origin as any, ray.direction as any, coarse ? 0.03 : 0.015);
      if (particle >= 0 && !solver.isPinned(particle)) {
        const p = solver.positions.subarray(particle * 3, particle * 3 + 3);
        const d = (p[0] - ray.origin[0]) * ray.direction[0] + (p[1] - ray.origin[1]) * ray.direction[1] + (p[2] - ray.origin[2]) * ray.direction[2];
        if (!best || d < best.distance + 0.01) best = { kind: 'skirt', distance: d, particle };
      }
    }
    surface.setPointerCapture?.(event.pointerId);
    if (!best) {
      held = { kind: 'turn', id: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    const metresPerPixel = (Math.max(0.1, best.distance) * 2 * Math.tan((view.fov * Math.PI) / 360)) / ray.height;
    if (best.kind === 'skirt' && skirt) {
      const { solver } = skirt.cloth,
        { columns, rows } = skirt;
      const p = Array.from(solver.positions.subarray(best.particle * 3, best.particle * 3 + 3));
      const ol = Math.hypot(p[0] * 0.31, p[2]) || 1;
      // Fingers take a pinch of cloth: the particle picked and its eight neighbours are
      // pinned and carried together; the cloth round them makes the fold itself. (The
      // engine's hand holds one particle and waits whenever its threads stretch, which
      // made a larger held patch jitter.)
      const row = Math.floor(best.particle / columns),
        column = best.particle % columns,
        pinch: { index: number; offset: number[] }[] = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          if (r < 1 || r >= rows) continue;
          const index = r * columns + ((column + dc + columns) % columns);
          if (solver.isPinned(index)) continue;
          const q = solver.positions.subarray(index * 3, index * 3 + 3);
          solver.pin(index);
          pinch.push({ index, offset: [q[0] - p[0], q[1] - p[1], q[2] - p[2]] });
        }
      held = { kind: 'skirt', id: event.pointerId, x: event.clientX, y: event.clientY, pinch, anchor: p, at: [...p], want: [...p], out: [(p[0] * 0.31) / ol, 0, p[2] / ol], unit: metresPerPixel, right: ray.right, up: ray.up };
      return;
    }
    // On the leg: the garment where it covers, unless this is a hole in it; else the stocking.
    const leg = legs[best.index];
    const [u, v] = uvOf(leg, best.hit);
    const garment = garments[best.index];
    const spec = bottom.spec;
    const onGarment = !!garment && spec.kind === 'pants' && v >= vOf(spec.from) && !inHole(garment, u, v);
    const target = onGarment ? garment! : leg;
    held = { kind: 'leg', id: event.pointerId, x: event.clientX, y: event.clientY, leg: target, u, v, start: offsetAt(target, u, v), out: outwardAt(target, u, v), unit: metresPerPixel / LT, right: ray.right, up: ray.up, engaged: false };
  };
  const move = (event: PointerEvent) => {
    if (!held || held.id !== event.pointerId) return;
    const dx = event.clientX - held.x,
      dy = event.clientY - held.y;
    if (held.kind === 'turn') {
      view.yaw = clamp(view.yaw - dx * 0.006, -0.9, 0.9);
      view.pitch = clamp(view.pitch + dy * 0.004, -0.27, 0.45);
      held.x = event.clientX;
      held.y = event.clientY;
      aimCamera();
      return;
    }
    if (held.kind === 'skirt') {
      if (!skirt) return;
      const h = held;
      const w = [0, 1, 2].map((c) => h.right[c] * dx * h.unit - h.up[c] * dy * h.unit);
      const length = Math.hypot(w[0], w[1], w[2]);
      const towards = [0, 1, 2].map((c) => w[c] + h.out[c] * 0.23 * length);
      // A long skirt can be lifted farther: up to six tenths of its length.
      const most = Math.max(0.9, (TOP - (bottom.spec.kind === 'skirt' ? bottom.spec.hem : TOP)) * 0.6) * LT;
      const tl = Math.hypot(towards[0], towards[1], towards[2]),
        k = tl > most ? most / tl : 1;
      // Where the fingers are asked to be; each frame the pinch moves toward it, no faster than a hand.
      h.want = [0, 1, 2].map((c) => h.anchor[c] + towards[c] * k);
      return;
    }
    if (!held.engaged && Math.hypot(dx, dy) < 3) return;
    if (!held.engaged) {
      setGrip(held.leg, held.u, held.v, null);
      amount = Math.min(1, Math.hypot(held.start[0], held.start[1], held.start[2]) / (1.17 * held.leg.reach));
      speed = 0;
      held.engaged = true;
    }
    const h = held;
    // The pointer's travel, scaled to how far a full pull carries this surface.
    const w = [0, 1, 2].map((c) => h.start[c] / h.leg.reach + h.right[c] * dx * h.unit - h.up[c] * dy * h.unit);
    const outward = w[0] * h.out[0] + w[1] * h.out[1] + w[2] * h.out[2],
      bias = Math.hypot(Math.hypot(w[0], w[1], w[2]), outward) * 0.19;
    for (let c = 0; c < 3; c++) w[c] += h.out[c] * Math.max(0, bias - outward);
    const length = Math.hypot(w[0], w[1], w[2]);
    goal = clamp(length / 1.17, 0, 1.1);
    grip.direction = length > 1e-6 ? w.map((c) => c / length) : null;
    dirty = true;
  };
  const up = (event: PointerEvent) => {
    if (!held || held.id !== event.pointerId) return;
    if (held.kind === 'skirt' && skirt) for (const { index } of held.pinch) skirt.cloth.solver.unpin(index);
    if (held.kind === 'leg' && held.engaged && !(event.type === 'pointerup' && goal >= rules.get(held.leg)!.tearAt)) goal = 0;
    held = null;
  };
  const guard = (handler: (event: PointerEvent) => void) => (event: PointerEvent) => {
    try {
      handler(event);
    } catch (error: any) {
      state.note = { ...state.note, inputError: String(error?.stack || error).slice(0, 400) };
    }
  };
  // Capture phase: LayaAir's own input handling on the canvas must not keep the events from the game.
  surface.addEventListener('pointerdown', guard(down), true);
  surface.addEventListener('pointermove', guard(move), true);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, guard(up) as any, true);
  surface.addEventListener(
    'wheel',
    (event) => {
      if ((event.target as HTMLElement).closest?.('[data-hud]')) return;
      view.zoom = clamp(view.zoom * Math.exp(event.deltaY * 0.001), 0.45, 1.8);
      aimCamera();
      event.preventDefault();
    },
    { passive: false },
  );

  const hud = createHud(container, {
    types: TYPES,
    colors: COLORS,
    bottoms: BOTTOMS,
    current: () => current,
    color: () => color,
    bottom: () => bottom,
    choose: (type, shade) => dress(type, shade),
    wear: (next) => wear(next),
    reset: () => {
      wear(bottom);
      view.yaw = 0;
      view.pitch = (3 * Math.PI) / 180;
      view.zoom = 1;
      aimCamera();
    },
  });
  dress(current, color);
  wear(bottom);

  // --- each frame, on the engine's clock -------------------------------------------------
  const timing = { cloth: 0, pull: 0, frames: 0 };
  const step = (delta: number) => {
    const dt = Math.min(delta, 0.04);
    const before = performance.now();
    if (skirt && held?.kind === 'skirt') {
      const h = held;
      const d = [0, 1, 2].map((c) => h.want[c] - h.at[c]),
        far = Math.hypot(d[0], d[1], d[2]),
        most = 1.6 * dt; // metres a second
      const k = far > most ? most / far : 1;
      for (let c = 0; c < 3; c++) h.at[c] += d[c] * k;
      for (const { index, offset } of h.pinch) skirt.cloth.solver.movePin(index, h.at[0] + offset[0], h.at[1] + offset[1], h.at[2] + offset[2]);
    }
    if (skirt) skirt.cloth.update(delta);
    const mid = performance.now();
    const holding = held?.kind === 'leg' && held.engaged,
      resting = !holding && goal === 0;
    const stiffness = resting ? 1080 : holding ? 370 : 196,
      damping = resting ? 48 : holding ? 35 : 19;
    const steps = Math.max(1, Math.ceil(dt * 200));
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      speed += ((goal - amount) * stiffness - speed * damping) * h;
      amount += speed * h;
    }
    if (Math.abs(amount - goal) < 3e-4 && Math.abs(speed) < 0.004) {
      if (amount !== goal) dirty = true;
      amount = goal;
      speed = 0;
    }
    if (dirty || speed !== 0) {
      pull(grip.leg, clamp(amount, 0, 1.1), grip.u, grip.v, grip.direction);
      dirty = false;
    }
    const rule = rules.get(grip.leg);
    if (rule && goal >= rule.tearAt && amount >= rule.tearAt) tear();
    for (const s of surfaces()) {
      const list = tears.get(s);
      if (!list) continue;
      let opened = false;
      for (let i = 0; i < list.count; i++)
        if (list.shape[i * 4 + 3] < 1) {
          list.shape[i * 4 + 3] = Math.min(1, list.shape[i * 4 + 3] + dt * 4.2);
          opened = true;
        }
      if (opened) writeTears(s);
    }
    timing.cloth += mid - before;
    timing.pull += performance.now() - mid;
    timing.frames++;
    const { width, height } = size();
    look.update(eye, target, view.fov, width / height);
  };
  window.addEventListener('resize', () => aimCamera());
  context.runtime.start(() => step(context.runtime.layers.scaledDeltas.get('world') ?? 1 / 60));

  state.api = {
    dress: (id: string, shade?: number) => {
      const type = TYPES.find((t) => t.id === id)!;
      dress(type, shade ?? type.colors[0]);
      return { type: type.id, color };
    },
    wear: (id: string) => {
      wear(BOTTOMS.find((b) => b.id === id)!);
      return bottom.id;
    },
    stats: () => ({
      type: current.id,
      bottom: bottom.id,
      tears: surfaces().map((s) => tears.get(s)?.count ?? 0),
      frames: timing.frames,
      clothMs: +(timing.cloth / Math.max(1, timing.frames)).toFixed(3),
      pullMs: +(timing.pull / Math.max(1, timing.frames)).toFixed(3),
      amount: +amount.toFixed(3),
      inside: skirt ? skirt.cloth.solver.countInside() : 0,
      held: held?.kind ?? null,
      inputError: state.note?.inputError,
    }),
    /** Per frame for a while: the pull's amount and the skirt hem's mean height and sway, for checking motion. */
    trace: (frames = 180) =>
      new Promise((resolve) => {
        const out: number[][] = [];
        const sample = () => {
          let hemY = 0,
            hemX = 0;
          if (skirt) {
            const { columns, rows } = skirt,
              p = skirt.cloth.solver.positions;
            for (let c = 0; c < columns; c++) {
              hemY += p[((rows - 1) * columns + c) * 3 + 1] / columns;
              hemX += p[((rows - 1) * columns + c) * 3] / columns;
            }
          }
          out.push([+amount.toFixed(4), +hemY.toFixed(5), +hemX.toFixed(5), +performance.now().toFixed(1)]);
          if (out.length < frames) requestAnimationFrame(sample);
          else resolve(out);
        };
        requestAnimationFrame(sample);
      }),
    /** The skirt's cloth as it is now: stretch, particles inside a body, hands held. */
    cloth: () => {
      if (!skirt) return null;
      const info = skirt.cloth.solver.inspect() as any;
      return { maxStretch: +skirt.cloth.solver.measureStrain().toFixed(3), inside: info.inside, hands: info.hands, dropped: info.dropped };
    },
    rows: UP,
    around: AROUND,
    legs: () => legs,
  };
  const { width, height } = size();
  look.update(eye, target, view.fov, width / height);
  ZhudaEngine.flushRenderFrames(4);
  state.note = { type: current.id, bottom: bottom.id };
  state.ready = true;
}

main().catch((error) => {
  state.error = String(error?.stack || error);
  const note = document.createElement('pre');
  note.style.cssText = 'position:fixed;left:8px;top:8px;right:8px;color:#fff;font:12px/1.4 monospace;white-space:pre-wrap;z-index:9';
  note.textContent = state.error;
  document.body.appendChild(note);
});
