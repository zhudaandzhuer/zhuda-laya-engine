// Builds the body, the hair and every item of tools/catalogue.mjs into assets/parts/*.glb, then
// measures them and writes what the game reads:
//   assets/wardrobe.json  the parts: slot, triangles, which body regions each covers wholly, and
//                         `avoid` (parts it comes through or that come through it: not worn together);
//   assets/masks.json     what each part hides while worn: triangles of the body and of each part
//                         that can be under it (a bit per triangle, base64).
// The build fails if the body comes through any part in any pose of any clip (more than 1 mm).
//   node tools/build-parts.mjs            everything (about three minutes)
//   node tools/build-parts.mjs --measure  measure and write the lists from the files already built
//   node tools/build-parts.mjs --only tee,skirt   build only these, then measure everything
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heroDef } from '../../tools/characters/hero-kit.mjs';
import { buildPart, inspectGlb } from '../../tools/characters/parts.mjs';
import { buildGarment, coverOf, standsOut } from '../../tools/characters/garment.mjs';
import { checkPair, coverMasks, folds, loadModel, maskWhere, posesOf } from '../../tools/characters/clip-check.mjs';
import { HAIR, REGIONS, body, clips, face, paint, r } from './defs.mjs';
import { CATALOGUE, HAT, PACK } from './catalogue.mjs';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(project, 'assets', 'parts');
mkdirSync(out, { recursive: true });
const measureOnly = process.argv.includes('--measure');
/** --only a,b: build just these (the rest stay as they were built) and measure everything. */
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const started = Date.now();
const BODY_BUDGET = { head: 3000, hands: 1700, torso: 1700, shoulders: 600, hips: 800, upperArms: 600, forearms: 600, thighs: 1000, shins: 900, feet: 700 };
const foreign = JSON.parse(readFileSync(join(project, 'tools', 'foreign-parts.json'), 'utf8'));
const manifestPath = join(project, 'assets', 'wardrobe.json');
const masksPath = join(project, 'assets', 'masks.json');
/** Kept from the last build: how many leading triangles of each part are cloth on the body, and its end faces. */
const tightOf = new Map(existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).parts.map((p) => [p.id, p.tight ?? 0]) : []);
const endsOf = new Map(existsSync(masksPath) ? Object.entries(JSON.parse(readFileSync(masksPath, 'utf8'))).filter(([, m]) => m.ends).map(([id, m]) => [id, new Uint8Array(Buffer.from(m.ends, 'base64'))]) : []);
const items = [
  ...HAIR.map((h) => ({ id: h.id, name: h.name, slot: 'hair', tintable: true })),
  ...CATALOGUE.map((c) => ({ id: c.id, name: c.name, slot: c.slot, tintable: c.tintable !== false })),
  ...foreign.map((f) => ({ id: f.id, name: f.name, slot: f.slot, tintable: f.tintable !== false, foreign: true, followsBody: f.followsBody === true })),
];

const figure = { joints: r.joints, body, skin: 0.024 };
if (!measureOnly) {
  const wanted = (id) => !only || only.includes(id);
  const def = (id, shapes) => heroDef({ id, title: id, latin: id, lore: '', rig: r, shapes, clips, paint, face });
  if (wanted('body')) {
    const whole = await buildPart(def('body', body), { id: 'body', keep: () => true, groupOf: (s) => `region-${s.region}`, budgets: Object.fromEntries(Object.entries(BODY_BUDGET).map(([k, v]) => [`region-${k}`, v])), clips: true });
    writeFileSync(join(out, 'body.glb'), whole.glb);
  }
  for (const hair of HAIR) {
    if (!wanted(hair.id)) continue;
    const { glb } = await buildPart(def(hair.id, [...body, ...hair.shapes]), { id: hair.id, keep: (s) => s.part === hair.id, budgets: { [hair.id]: hair.budget } });
    writeFileSync(join(out, `${hair.id}.glb`), glb);
  }
  for (const item of CATALOGUE) {
    if (!wanted(item.id)) continue;
    const { glb, stats, ends } = await buildGarment(figure, item);
    endsOf.set(item.id, ends);
    writeFileSync(join(out, `${item.id}.glb`), glb);
    tightOf.set(item.id, stats.tight);
    console.log(item.id.padEnd(12), `${stats.triangles} triangles of ${stats.meshed}`, `${(glb.length / 1e6).toFixed(2)} MB`);
  }
  console.log(`built in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

// ---- measure ----
const load = (id) => loadModel(new Uint8Array(readFileSync(join(out, `${id}.glb`))));
const bodyModel = load('body');
const bodyInfo = inspectGlb(new Uint8Array(readFileSync(join(out, 'body.glb'))));
const poses = posesOf(bodyModel, { every: 2 });
const models = new Map(items.map((item) => [item.id, load(item.id)]));
/** What lies over what: of two parts worn together, the one later in this order is the outer. */
const LAYER = { shoes: 1, bottom: 2, top: 3, full: 4, waist: 5, hair: 6, back: 7, hat: 8 };
const TRUNK = ['top', 'bottom', 'full'];
const together = (a, b) => a.slot !== b.slot && !((a.slot === 'full' || b.slot === 'full') && TRUNK.includes(a.slot) && TRUNK.includes(b.slot));
const mm = (d) => +(d * 1000).toFixed(1);
/** A part as the outer of a pair: the faces its cuffs and hems end in are openings, not cloth to stay under. */
const withinOf = new Map(CATALOGUE.filter((c) => c.zone || c.volume).map((c) => [c.id, coverOf(figure, c, { under: -0.05, fromEdge: 0, looseHem: 0 })]));
const outerOf = (item) => ({ model: models.get(item.id), masks: endsOf.has(item.id) ? { [item.id]: endsOf.get(item.id) } : undefined, within: withinOf.get(item.id) });
/**
 * What `outer` hides of `inner` (the body, or a part worn under it). A part of the catalogue says
 * exactly what lies under its cloth; for any other (hair, a part made elsewhere) it is measured from
 * the surfaces, counting only what is known to follow the body (`tight`).
 */
const underOf = new Map(CATALOGUE.map((c) => [c.id, coverOf(figure, c)]));
const hiddenBy = (outer, inner) => (underOf.has(outer.id) ? maskWhere(bodyModel, inner, poses, underOf.get(outer.id)) : coverMasks(bodyModel, inner, { model: models.get(outer.id), tight: outer.tight }, poses));
const b64 = (mask) => Buffer.from(mask).toString('base64');
/** Parts the catalogue says are not worn together by their cut (`apart`), whatever the measure says. */
function declareApart() {
  for (const c of CATALOGUE)
    for (const other of c.apart ?? []) {
      const a = items.find((i) => i.id === c.id), b = items.find((i) => i.id === other);
      if (!a || !b) continue;
      report.apart.push([a.id, b.id]);
      if (!a.avoid.includes(b.id)) (a.avoid.push(b.id), b.avoid.push(a.id));
    }
}
const report = { poses: poses.list.length, clips: bodyModel.clips.map((c) => c.name), toleranceMm: 1, parts: {}, pairs: [], apart: [] };
const masks = {};
let failed = 0;
// The body's vertices at rest, without its arms: what a bell or a trouser leg must hold.
const restPoints = bodyModel.meshes.filter((m) => !/upperArms|forearms|hands/.test(m.name)).flatMap((m) => Array.from({ length: m.positions.length / 3 }, (_, v) => [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]]));
for (const item of items) {
  const info = inspectGlb(new Uint8Array(readFileSync(join(out, `${item.id}.glb`))));
  const unknown = info.joints.filter((name) => !bodyInfo.joints.includes(name));
  if (unknown.length) throw Error(`${item.id}: joints the body does not have: ${unknown.join(', ')}`);
  const model = models.get(item.id);
  if (model.meshes.length !== 1) throw Error(`${item.id}: a part is one mesh; this has ${model.meshes.length}`);
  item.triangles = info.parts.reduce((a, p) => a + p.triangles, 0);
  // A part made elsewhere that is said to lie on the body all over may hide what is under it.
  item.tight = item.followsBody ? item.triangles : (tightOf.get(item.id) ?? 0);
  item.file = `parts/${item.id}.glb`;
  item.avoid = [];
  // The skin under the part's cloth is not drawn while it is worn.
  const cover = hiddenBy(item, { model: bodyModel });
  masks[item.id] = { ends: endsOf.has(item.id) ? b64(endsOf.get(item.id)) : undefined, body: Object.fromEntries(Object.entries(cover.masks).map(([node, mask]) => [node.replace(/^region-/, ''), b64(mask)])), parts: {} };
  item.covers = REGIONS.filter((region) => {
    const mask = cover.masks[`region-${region}`], triangles = bodyInfo.parts.find((p) => p.name === `region-${region}`).triangles;
    return mask && mask.reduce((n, byte) => n + (byte.toString(2).match(/1/g)?.length ?? 0), 0) === triangles;
  });
  // What skin is still drawn under the part must stay under it.
  const clip = checkPair(bodyModel, { model: bodyModel, masks: cover.masks }, outerOf(item), poses);
  // Cloth on the body turned inside out where a crease closes: counted, not judged.
  const fold = folds(bodyModel, model, poses, undefined, { first: item.tight || Infinity });
  report.parts[item.id] = { triangles: item.triangles, tight: item.tight, covers: item.covers, skinHidden: cover.hidden, skinChecked: clip.paired, skinThrough: clip.poking, depthMm: mm(clip.depth), worst: clip.worst, foldedTriangles: fold.triangles, foldedCm2: +(fold.area * 1e4).toFixed(1), foldedAt: fold.worst };
  item.passes = !clip.poking;
  // Loose cloth that hangs round the body must hold it at rest (garment.mjs, standsOut).
  const source = CATALOGUE.find((c) => c.id === item.id);
  if (source?.volume?.holds) {
    const stands = standsOut(figure, source, restPoints);
    report.parts[item.id].standsOut = stands.count;
    if (stands.count) {
      item.passes = false;
      failed++;
      console.log(`OUT    ${item.id}: the body stands out of its loose cloth at rest at ${stands.count} vertices, ${mm(stands.depth)} mm at [${stands.at.map((v) => +v.toFixed(3))}]`);
    }
  }
  if (clip.poking) {
    // A part of the catalogue that clips stops the build. A part made elsewhere is measured the same
    // way and listed as it is: the list says it does not pass, and the game can say so.
    if (!item.foreign) failed++;
    console.log(`${item.foreign ? 'NOTE  ' : 'CLIPS '} ${item.id}: the body comes through at ${clip.poking} of ${clip.paired} vertices, ${mm(clip.depth)} mm, ${clip.worst.clip} frame ${clip.worst.frame} at [${clip.worst.at}]`);
  }
}
for (const a of items)
  for (const b of items) {
    if (!together(a, b) || LAYER[a.slot] >= LAYER[b.slot]) continue;
    const cover = hiddenBy(b, { model: models.get(a.id), tight: a.tight });
    const pair = checkPair(bodyModel, { model: models.get(a.id), masks: cover.masks }, outerOf(b), poses);
    if (cover.hidden) masks[b.id].parts[a.id] = b64(Object.values(cover.masks)[0]);
    if (!pair.paired && !cover.hidden) continue;
    report.pairs.push({ inner: a.id, outer: b.id, hidden: cover.hidden, checked: pair.paired, through: pair.poking, depthMm: mm(pair.depth), worst: pair.poking ? pair.worst : undefined });
    if (pair.poking && !a.avoid.includes(b.id)) (a.avoid.push(b.id), b.avoid.push(a.id));
  }
const manifest = {
  schemaVersion: 2,
  joints: bodyInfo.joints,
  body: { file: 'parts/body.glb', regions: Object.fromEntries(bodyInfo.parts.map((p) => [p.name.replace(/^region-/, ''), p.triangles])), clips: bodyInfo.clips },
  masks: 'masks.json',
  parts: (declareApart(), items).map(({ id, slot, name, file, covers, tintable, triangles, tight, avoid, passes, foreign: f }) => ({ id, slot, name, file, covers, tintable, triangles, tight, avoid: avoid.sort(), passes, ...(f ? { foreign: true } : {}) })),
};
for (const region of REGIONS) if (!(region in manifest.body.regions)) throw Error(`body: region ${region} has no node`);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
writeFileSync(masksPath, JSON.stringify(masks) + '\n');
mkdirSync(join(project, 'docs', 'evidence'), { recursive: true });
writeFileSync(join(project, 'docs', 'evidence', 'clip-report.json'), JSON.stringify(report, null, 1) + '\n');
const clipping = report.pairs.filter((p) => p.through);
console.log(`${items.length} parts; ${poses.list.length} poses of ${report.clips.join(', ')}`);
// The hard objects are not cloth and cover nothing, so the measures above never look at them. At
// rest: nothing of the head or of any hair may stand through the hat's cone, and nothing worn with
// the pack may be inside its box.
const restOf = (id) => load(id).meshes.flatMap((m) => Array.from({ length: m.positions.length / 3 }, (_, v) => [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]]));
const underCone = (p) => p[1] - (HAT.apex - 0.012 - (Math.hypot(p[0], p[2] - HAT.axis[2]) * HAT.height) / HAT.radius);
const inBox = (p) => (Math.abs((p[0] - PACK.centre[0]) / (PACK.w / 2)) ** 5 + Math.abs((p[1] - PACK.centre[1]) / (PACK.h / 2)) ** 5 + Math.abs((p[2] - PACK.centre[2]) / (PACK.d / 2)) ** 5) ** 0.2 < 0.97;
report.solids = [];
for (const [solidId, test, others] of [['straw-hat', (p) => underCone(p) > 0.001 && Math.hypot(p[0], p[2] - HAT.axis[2]) < HAT.radius, items.filter((i) => i.slot === 'hair')], ['pack', inBox, items.filter((i) => ['top', 'full', 'hair', 'waist'].includes(i.slot))]]) {
  const solidItem = items.find((i) => i.id === solidId);
  if (!solidItem) continue;
  for (const other of [{ id: 'body' }, ...others]) {
    if (other.foreign || solidItem.avoid.includes(other.id) || CATALOGUE.find((c) => c.id === solidId)?.apart?.includes(other.id)) continue;
    const through = restOf(other.id).filter(test).length;
    report.solids.push({ solid: solidId, with: other.id, through });
    if (through) {
      failed++;
      console.log(`SOLID  ${other.id} stands through ${solidId} at rest at ${through} vertices`);
    }
  }
}
writeFileSync(join(project, 'docs', 'evidence', 'clip-report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(`skin through a part: ${failed} parts fail; deepest ${Math.max(0, ...Object.values(report.parts).map((p) => p.depthMm))} mm`);
console.log(`pairs: ${report.pairs.length} overlap, ${clipping.length} clip and are listed as avoid; deepest allowed ${Math.max(0, ...report.pairs.filter((p) => !p.through).map((p) => p.depthMm))} mm`);
for (const p of clipping) console.log(`  avoid ${p.inner} under ${p.outer}: ${p.through} of ${p.checked}, ${p.depthMm} mm, ${p.worst.clip} ${p.worst.frame} [${p.worst.at}]`);
console.log(`${((Date.now() - started) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
