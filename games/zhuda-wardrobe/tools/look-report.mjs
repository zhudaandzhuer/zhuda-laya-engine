// Looks at the wardrobe's character dressed, in every clip, from 26 directions, and counts what must
// never be on the screen (games/tools/characters/look-check.mjs): pixels one sees through, and
// covered skin or cloth that shows. Every part is looked at alone on the body, then a sample of
// whole outfits drawn by a seed under the wardrobe's own rules. Nothing is opened in a browser.
//   node tools/look-report.mjs               every part and 24 outfits (about ten minutes)
//   node tools/look-report.mjs --outfits 0   the parts only
//   node tools/look-report.mjs tee+skirt     only what is named (ids joined by +)
//   node tools/look-report.mjs --sheet       only the picture of the sampled outfits
// Writes docs/evidence/look-report.json and docs/evidence/outfits.png, and fails if a view of a
// kit-made part or outfit shows more than LIMIT square centimetres of either.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, posesOf } from '../../tools/characters/clip-check.mjs';
import { dressed, lookCheck } from '../../tools/characters/look-check.mjs';
import { picture, sheet, writePng } from '../../tools/characters/raster.mjs';
import { coverOf } from '../../tools/characters/garment.mjs';
import { body as shapes, r } from './defs.mjs';
import { CATALOGUE } from './catalogue.mjs';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(project, 'assets');
const LIMIT = 1; // cm2 in the worst single view: nine pixels at 300 to the metre
const load = (id) => loadModel(new Uint8Array(readFileSync(join(assets, 'parts', `${id}.glb`))));
const manifest = JSON.parse(readFileSync(join(assets, 'wardrobe.json'), 'utf8')), masks = JSON.parse(readFileSync(join(assets, 'masks.json'), 'utf8'));
const decode = (text) => new Uint8Array(Buffer.from(text, 'base64'));
const either = (a, b) => (a ? a.map((x, i) => x | b[i]) : b);
/** Of two parts worn together the one later in this order is over the other (tools/build-parts.mjs). */
const LAYER = { shoes: 1, bottom: 2, top: 3, full: 4, waist: 5, hair: 6, back: 7, hat: 8 };
const figure = { joints: r.joints, body: shapes, skin: 0.024 };
const body = load('body');
const models = new Map();
const model = (id) => models.get(id) ?? models.set(id, load(id)).get(id);
// What a part's cloth covers, well inside its edges: surface there has no business on the screen.
const covers = new Map(CATALOGUE.filter((c) => c.zone || c.volume).map((c) => [c.id, coverOf(figure, c, { under: 0.004, fromEdge: 0.012, looseEdge: 0.01 })]));

/** The body and the parts of an outfit as the game draws them: innermost first, each with what is hidden of it. */
function layersOf(ids) {
  const worn = ids.map((id) => manifest.parts.find((p) => p.id === id) ?? (() => { throw Error(`no part ${id}`); })()).sort((a, b) => LAYER[a.slot] - LAYER[b.slot]);
  const bodyHidden = {};
  for (const part of worn) for (const [region, mask] of Object.entries(masks[part.id]?.body ?? {})) bodyHidden[`region-${region}`] = either(bodyHidden[`region-${region}`], decode(mask));
  const layers = [{ id: 'body', model: body, hidden: bodyHidden }];
  for (const part of worn) {
    let hidden = null;
    for (const other of worn) if (masks[other.id]?.parts?.[part.id]) hidden = either(hidden, decode(masks[other.id].parts[part.id]));
    layers.push({ id: part.id, model: model(part.id), hidden: hidden ? { [model(part.id).meshes[0].name]: hidden } : undefined, covers: covers.get(part.id) });
  }
  return layers;
}
/** An outfit by a seed, under the wardrobe's rules: one part to a slot, a full garment instead of top and bottom, nothing with what it must avoid. */
function outfit(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ok = manifest.parts.filter((p) => p.passes);
  const of = (slot) => ok.filter((p) => p.slot === slot);
  const worn = [];
  const wear = (slot, chance) => {
    const choice = of(slot).filter((p) => !worn.some((w) => w.avoid.includes(p.id)));
    if (choice.length && next() < chance) worn.push(choice[Math.floor(next() * choice.length)]);
  };
  if (next() < 0.3) wear('full', 1);
  else (wear('bottom', 1), wear('top', 0.95));
  wear('shoes', 0.9);
  wear('hair', 0.9);
  wear('waist', 0.5);
  wear('back', 0.3);
  wear('hat', 0.3);
  return worn.map((p) => p.id);
}

const args = process.argv.slice(2);
const count = args.includes('--outfits') ? Number(args[args.indexOf('--outfits') + 1]) : 24;
const named = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--outfits');
const every = 8;
const poses = posesOf(body, { every });
const started = Date.now();
const outfits = named.length ? named.map((n) => n.split('+')) : [...manifest.parts.map((p) => [p.id]), ...Array.from({ length: count }, (_, i) => outfit(i + 1))];
const kitMade = (ids) => ids.every((id) => !manifest.parts.find((p) => p.id === id).foreign);
const rows = [];
let failed = 0;
/** --sheet: only the picture of the sampled outfits, without looking at them again. */
const sheetOnly = args.includes('--sheet');
for (const ids of sheetOnly ? [] : outfits) {
  const result = lookCheck(body, layersOf(ids), poses);
  const over = Math.max(result.holes.worst, result.shown.worst) > LIMIT;
  if (over && kitMade(ids)) failed++;
  rows.push({ outfit: ids.join('+'), kitMade: kitMade(ids), passes: !over, ...result });
  console.log(`${over ? (kitMade(ids) ? 'FAILS ' : 'NOTE  ') : 'ok    '}${ids.join('+').padEnd(46)} seen through ${result.holes.worst} cm2 (mean ${result.holes.mean})  covered but showing ${result.shown.worst} cm2 (mean ${result.shown.mean})${over ? `  ${JSON.stringify(result.holes.worst > LIMIT ? result.holes.at : result.shown.at)}` : ''}`);
}
const kit = rows.filter((row) => row.kitMade);
// The triangles of each part as looked at: a part rebuilt since is another part, and the game's tests say so.
const summary = { pxPerMetre: 300, views: 26, everyFrame: every, limitCm2: LIMIT, parts: Object.fromEntries(manifest.parts.map((p) => [p.id, p.triangles])), checked: rows.length, kitMade: kit.length, failed, worstHolesCm2: Math.max(0, ...kit.map((row) => row.holes.worst)), worstShownCm2: Math.max(0, ...kit.map((row) => row.shown.worst)), viewsEach: rows[0]?.views };
if (!named.length) {
  mkdirSync(join(project, 'docs', 'evidence'), { recursive: true });
  if (!sheetOnly) writeFileSync(join(project, 'docs', 'evidence', 'look-report.json'), JSON.stringify({ ...summary, rows }, null, 1) + '\n');
  // A sheet of the sampled outfits, each mid-stride from the front quarter: what the numbers are about.
  const PALETTE = [[226, 180, 150], [86, 126, 196], [196, 92, 88], [92, 164, 112], [208, 170, 76], [150, 112, 186], [84, 84, 96], [62, 150, 158], [200, 130, 80]];
  const all = posesOf(body, { every: 1 });
  const stride = all.list.find((p) => p.clip === 'Walk' && p.frame === 8) ?? all.list[0];
  const tiles = outfits.slice(manifest.parts.length).map((ids) => {
    const seen = dressed(body, layersOf(ids), all, { pxPerMetre: 180 }).at(stride.joints, 30, 8, { bounds: [-0.62, -0.02, 0.62, 1.78] });
    // Sixteen levels a channel: the sheet is for looking at, and the file stays small.
    return { width: seen.view.width, height: seen.view.height, rgba: picture(seen.view, Object.fromEntries(PALETTE.map((c, i) => [i, c])), { marks: seen.marks }).map((v, i) => (i % 4 === 3 ? 255 : v & 0xf0)) };
  });
  if (tiles.length) {
    const page = sheet(tiles, 8);
    writePng(join(project, 'docs', 'evidence', 'outfits.png'), page.width, page.height, page.rgba);
  }
}
if (sheetOnly) process.exit(0);
console.log(`${rows.length} looked at, ${rows[0]?.views} views each; kit-made: ${kit.length}, ${failed} over ${LIMIT} cm2; worst seen through ${summary.worstHolesCm2} cm2, worst covered but showing ${summary.worstShownCm2} cm2; ${((Date.now() - started) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
