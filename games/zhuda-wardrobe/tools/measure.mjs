// Takes the figure's measurements with a tape (games/tools/characters/tape.mjs) and compares them
// with a real body's (tools/reference.mjs). The clothes are measured in the same report.
//   node tools/measure.mjs            prints the table, writes docs/evidence/measure-report.json
//   node tools/measure.mjs --body f   measures a body file elsewhere (while shaping it)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel } from '../../tools/characters/clip-check.mjs';
import { extreme, joinedAt, level, round, slice } from '../../tools/characters/tape.mjs';
import { BODY, GARMENTS } from './reference.mjs';
import { FIGURE, H } from './defs.mjs';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = (id) => (id === 'body' && args.includes('--body') ? args[args.indexOf('--body') + 1] : join(project, 'assets', 'parts', `${id}.glb`));
const load = (id) => loadModel(new Uint8Array(readFileSync(file(id))));
const { P } = FIGURE;
const cm = (m) => +(m * 100).toFixed(1);
const mirror = (p) => [-p[0], p[1], p[2]];

/** The figure's girths, heights and widths, in centimetres. */
export function measureBody(model) {
  const all = model.meshes;
  const trunk = (limit) => (p) => Math.abs(p[0]) < limit;
  const oneLeg = (p) => p[0] > 0.004;
  // The crotch: the highest level at which the legs are apart (no surface across the middle).
  let crotch = 0.6;
  while (crotch < 0.95 && !joinedAt(all, crotch + 0.004)) crotch += 0.004;
  // The bust at its fullest, between the chest joint and 6 cm above it, without the arms.
  const [bust, bustAt] = extreme(P.chest[1], P.chest[1] + 0.06, 0.005, (y) => level(all, y, trunk(0.185)).girth);
  const [waist, waistAt] = extreme(P.spine[1] - 0.06, P.spine[1] + 0.05, 0.005, (y) => level(all, y, trunk(0.25)).girth, false);
  const [hip, hipAt] = extreme(crotch + 0.02, P.hips[1] + 0.02, 0.005, (y) => level(all, y, trunk(0.3)).girth);
  const [calf] = extreme(P.ankle[1] + 0.15, P.knee[1] - 0.05, 0.005, (y) => level(all, y, oneLeg).girth);
  const [ankle] = extreme(P.ankle[1], P.ankle[1] + 0.06, 0.004, (y) => level(all, y, oneLeg).girth, false);
  const armLength = Math.hypot(P.elbow[0] - P.shoulder[0], P.elbow[1] - P.shoulder[1], P.elbow[2] - P.shoulder[2]);
  const [upperArm] = extreme(0.08, armLength * 0.6, 0.01, (s) => round(all, P.shoulder, P.elbow, s, 0.09).girth);
  const foreLength = Math.hypot(P.wrist[0] - P.elbow[0], P.wrist[1] - P.elbow[1], P.wrist[2] - P.elbow[2]);
  const [wrist] = extreme(foreLength - 0.03, foreLength, 0.005, (s) => round(all, P.elbow, P.wrist, s, 0.07).girth, false);
  const top = Math.max(...all.flatMap((m) => Array.from({ length: m.positions.length / 3 }, (_, v) => m.positions[v * 3 + 1])));
  const shoulders = model.meshes.filter((m) => /shoulders|torso/.test(m.name)), neck = model.meshes.filter((m) => /head/.test(m.name));
  // Across the shoulders, between their points: taken as the joints and 12 mm outside each (the
  // acromion lies just outside and above the joint's centre).
  const across = (P.shoulder[0] + 0.012) * 2;
  void shoulders;
  // The top of the shoulder beside the neck and at its point: how steeply it falls between them.
  const topAt = (x) => Math.max(...shoulders.flatMap((m) => slice(m.positions, m.indices, { point: [x, 0, 0], normal: [1, 0, 0] })).filter((p) => p[2] < 0.03).map((p) => p[1]));
  const near = 0.075, far = P.shoulder[0];
  const slope = (Math.atan2(topAt(near) - topAt(far), far - near) * 180) / Math.PI;
  const feet = all.filter((m) => /feet/.test(m.name)).flatMap((m) => Array.from({ length: m.positions.length / 3 }, (_, v) => m.positions[v * 3 + 2]));
  const foot = Math.max(...feet) - Math.min(...feet);
  return {
    shoulderSlope: +slope.toFixed(1), foot: cm(foot),
    girths: { bust: cm(bust), waist: cm(waist), highHip: cm(level(all, (waistAt + hipAt) / 2, trunk(0.3)).girth), hip: cm(hip), midNeck: cm(level(neck, (P.neck[1] + P.head[1]) / 2, trunk(0.1)).girth), upperArm: cm(upperArm), elbow: cm(round(all, P.shoulder, P.elbow, armLength, 0.07).girth), wrist: cm(wrist), thighMax: cm(level(all, crotch - 0.025, oneLeg).girth), thighMid: cm(level(all, (crotch + P.knee[1]) / 2, oneLeg).girth), knee: cm(level(all, P.knee[1], oneLeg).girth), calf: cm(calf), ankle: cm(ankle) },
    heights: { stature: cm(top), cervicale: cm(P.neck[1] + 0.03), waist: cm(waistAt), hip: cm(hipAt), crotch: cm(crotch), knee: cm(P.knee[1]), ankle: cm(P.ankle[1]) },
    widths: { acrossShoulder: cm(across) },
    at: { bust: bustAt, waist: waistAt, hip: hipAt, crotch },
  };
}

const body = load('body');
const mine = measureBody(body);
const scale = (mine.heights.stature / BODY.stature);
const rows = [];
for (const [name, real] of Object.entries(BODY.girths)) rows.push({ what: `girth ${name}`, real, mine: mine.girths[name], ratio: +(mine.girths[name] / real).toFixed(2) });
for (const [name, real] of Object.entries(BODY.heights)) rows.push({ what: `height ${name}`, real: +(real * scale).toFixed(1), mine: mine.heights[name], ratio: +(mine.heights[name] / (real * scale)).toFixed(2) });
rows.push({ what: 'across shoulder', real: BODY.widths.acrossShoulder, mine: mine.widths.acrossShoulder, ratio: +(mine.widths.acrossShoulder / BODY.widths.acrossShoulder).toFixed(2) });
rows.push({ what: 'shoulder slope (deg)', real: BODY.shoulderSlope, mine: mine.shoulderSlope, ratio: +(mine.shoulderSlope / BODY.shoulderSlope).toFixed(2) });
rows.push({ what: 'foot length', real: +(BODY.footToStature * mine.heights.stature).toFixed(1), mine: mine.foot, ratio: +(mine.foot / (BODY.footToStature * mine.heights.stature)).toFixed(2) });
console.log(`body against ${BODY.source} (heights scaled to ${mine.heights.stature} cm)`);
for (const row of rows) console.log(`  ${row.what.padEnd(22)} real ${String(row.real).padStart(6)}  mine ${String(row.mine).padStart(6)}  ${row.ratio}`);
export const bodyRows = rows, bodyMeasures = mine;

// ---- the clothes, with the same tape, against what real ones measure ----
const { A } = FIGURE;
const pointsOf = (model) => model.meshes.flatMap((m) => Array.from({ length: m.positions.length / 3 }, (_, v) => [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]]));
const span = (points, k) => [Math.min(...points.map((p) => p[k])), Math.max(...points.map((p) => p[k]))];
const garmentRows = [];
const row = (garment, what, real, value, note) => garmentRows.push({ garment, what, real, mine: +value.toFixed(1), within: value >= real[0] - 0.05 && value <= real[1] + 0.05, ...(note ? { note } : {}) });
if (!args.includes('--body')) {
  const at = mine.at;
  {
    const tee = load('tee'), pts = pointsOf(tee), [hem, hps] = span(pts, 1);
    const chest = level(tee.meshes, at.bust, trunk185).girth, low = level(tee.meshes, hem + 0.02, trunk185).girth;
    row('tee', 'chest round less the bust (ease)', GARMENTS.tee.chestEase, cm(chest) - mine.girths.bust);
    row('tee', 'length from the shoulder\'s high point', GARMENTS.tee.length, cm(hps - hem));
    const middle = tee.meshes.flatMap((m) => slice(m.positions, m.indices, { point: [0, 0, 0], normal: [1, 0, 0] })).filter((p) => p[1] > 1.3);
    row('tee', 'front of the neck below the high point', GARMENTS.tee.frontNeckDrop, cm(hps - Math.max(...middle.filter((p) => p[2] > 0).map((p) => p[1]))));
    row('tee', 'back of the neck below the high point', GARMENTS.tee.backNeckDrop, cm(hps - Math.max(...middle.filter((p) => p[2] < 0).map((p) => p[1]))));
    const along = (p) => (p[0] - P.shoulder[0]) * A[0] + (p[1] - P.shoulder[1]) * A[1] + (p[2] - P.shoulder[2]) * A[2];
    const beside = (p) => Math.hypot(p[0] - P.shoulder[0] - A[0] * along(p), p[1] - P.shoulder[1] - A[1] * along(p), p[2] - P.shoulder[2] - A[2] * along(p));
    const end = Math.max(...pts.filter((p) => p[0] > 0 && beside(p) < 0.09).map(along));
    row('tee', 'sleeve from the shoulder\'s point', GARMENTS.tee.sleeve, cm(end - 0.012), 'the point taken 12 mm outside the joint');
    row('tee', 'sleeve opening round', GARMENTS.tee.sleeveOpening, cm(round(tee.meshes, P.shoulder, P.elbow, end - 0.015, 0.12).girth));
    garmentRows.push({ garment: 'tee', what: 'hem round over chest round', real: GARMENTS.tee.hemToChest, mine: +(low / chest).toFixed(2), within: low / chest >= GARMENTS.tee.hemToChest[0] && low / chest <= GARMENTS.tee.hemToChest[1] });
  }
  {
    const jeans = load('trousers'), pts = pointsOf(jeans), [hem, band] = span(pts, 1), leg = (p) => p[0] > 0.004;
    row('trousers', 'inseam', GARMENTS.jeans.inseam, cm(at.crotch - hem));
    row('trousers', 'knee round, 33 cm below the crotch', GARMENTS.jeans.knee, cm(level(jeans.meshes, at.crotch - 0.33, leg).girth));
    row('trousers', 'leg opening round', GARMENTS.jeans.legOpening, cm(level(jeans.meshes, hem + 0.012, leg).girth));
    row('trousers', 'front rise', GARMENTS.jeans.frontRise, cm(band - at.crotch), 'taken straight up; a real one is taken along the curve and is a little longer');
  }
  for (const [id, kind] of [['skirt', 'knee'], ['long-skirt', 'maxi']]) {
    const skirt = load(id), [hem, band] = span(pointsOf(skirt), 1);
    row(id, 'length from the waist', GARMENTS.skirt.lengths[kind], cm(band - hem));
    row(id, 'hip round less the hips (ease)', GARMENTS.skirt.hipEase, cm(level(skirt.meshes, at.hip, () => true).girth) - mine.girths.hip);
    if (GARMENTS.skirt.sweep[kind]) row(id, 'hem round (sweep)', GARMENTS.skirt.sweep[kind], cm(level(skirt.meshes, hem + 0.012, () => true).girth));
  }
  {
    const hat = pointsOf(load('straw-hat')), middle = (span(hat, 2)[0] + span(hat, 2)[1]) / 2, wide = hat.filter((p) => Math.hypot(p[0], p[2] - middle) > 0.12);
    row('straw-hat', 'across', GARMENTS.hat.diameter, cm(span(hat, 0)[1] - span(hat, 0)[0]));
    row('straw-hat', 'height', GARMENTS.hat.height, cm(span(hat, 1)[1] - Math.min(...wide.map((p) => p[1]))));
    const box = pointsOf(load('pack')).filter((p) => p[2] < -0.142 && Math.abs(p[0]) < 0.14);
    const main = box.filter((p) => p[2] > span(box, 2)[0] + 0.05 || true);
    row('pack', 'height', GARMENTS.pack.height, cm(span(main, 1)[1] - span(main, 1)[0]));
    row('pack', 'width', GARMENTS.pack.width, cm(span(main, 0)[1] - span(main, 0)[0]));
    row('pack', 'depth', GARMENTS.pack.depth, cm(span(main, 2)[1] - span(main, 2)[0]), 'with its front pocket');
  }
  console.log('\ngarments against real ones (tools/reference.mjs)');
  for (const r of garmentRows) console.log(`  ${r.garment.padEnd(11)} ${r.what.padEnd(40)} real ${String(r.real[0]).padStart(5)} to ${String(r.real[1]).padEnd(5)} mine ${String(r.mine).padStart(6)}  ${r.within ? 'within' : 'OUTSIDE'}`);
  mkdirSync(join(project, 'docs', 'evidence'), { recursive: true });
  const list = JSON.parse(readFileSync(join(project, 'assets', 'wardrobe.json'), 'utf8'));
  const built = Object.fromEntries([...new Set(garmentRows.map((r) => r.garment))].map((id) => [id, list.parts.find((q) => q.id === id).triangles]));
  writeFileSync(join(project, 'docs', 'evidence', 'measure-report.json'), JSON.stringify({ built, body: { source: BODY.source, stature: mine.heights.stature, rows }, garments: { sources: Object.fromEntries(Object.entries(GARMENTS).map(([k, v]) => [k, v.sources])), rows: garmentRows } }, null, 1) + '\n');
}
function trunk185(p) {
  return Math.abs(p[0]) < 0.2;
}
void [H, mirror];
