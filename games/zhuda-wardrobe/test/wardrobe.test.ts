import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CLOTH, HAIR, SLOTS, Wardrobe, emptyLook, hiddenIn, validateManifest, validateMasks, type Manifest, type Masks } from '../src/core/wardrobe.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../assets/wardrobe.json') as Manifest;
const masks = read(`../assets/${manifest.masks}`) as Masks;
const w = new Wardrobe(manifest, masks);
const dress = (...ids: string[]) => ids.reduce((look, id) => w.wear(look, id), emptyLook());
/** What a .glb written by the kit holds: joint names in skin order, mesh nodes, clips. */
function glb(file: string) {
  const bytes = readFileSync(new URL(`../assets/${file}`, import.meta.url));
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  return {
    joints: json.skins[0].joints.map((n: number) => json.nodes[n].name) as string[],
    parts: json.nodes.filter((n: any) => n.mesh !== undefined).map((n: any) => ({ name: n.name as string, skinned: n.skin === 0, triangles: json.accessors[json.meshes[n.mesh].primitives[0].indices].count / 3 })),
    clips: (json.animations ?? []).map((a: any) => a.name as string),
  };
}

test('the list and the masks are valid, and broken ones say what is wrong', () => {
  assert.deepEqual(validateManifest(manifest), []);
  assert.deepEqual(validateMasks(manifest, masks), []);
  for (const slot of SLOTS) assert.ok(w.partsOf(slot).length >= 1, slot);
  assert.ok(manifest.parts.length >= 30, `${manifest.parts.length} parts`);
  const broken = structuredClone(manifest);
  broken.parts[0].covers = ['tail'];
  broken.parts[1].id = broken.parts[0].id;
  broken.parts[2].slot = 'cape' as any;
  broken.parts[3].avoid = [broken.parts[5].id];
  const issues = validateManifest(broken).join('\n');
  assert.match(issues, /covers tail/);
  assert.match(issues, /id used twice/);
  assert.match(issues, /unknown slot cape/);
  assert.match(issues, /which does not avoid it/);
  assert.deepEqual(validateManifest({ ...manifest, schemaVersion: 1 } as any), ['schemaVersion: must be 2']);
  const wrong = structuredClone(masks);
  wrong.tee.body.torso = wrong.tee.body.torso.slice(4);
  wrong.tee.body.tail = 'AA==';
  assert.match(validateMasks(manifest, wrong).join('\n'), /masks\.tee\.body\.torso: not \d+ bytes/);
  assert.match(validateMasks(manifest, wrong).join('\n'), /no such region/);
});

test("every file is on the body's skeleton: the same joints in the same order, one skinned mesh a part", () => {
  const body = glb(manifest.body.file);
  assert.deepEqual(body.joints, manifest.joints);
  assert.ok(body.joints.length <= 24, `${body.joints.length} joints`);
  assert.deepEqual(body.parts.map((p) => p.name).sort(), Object.keys(manifest.body.regions).map((r) => `region-${r}`).sort());
  assert.ok(body.parts.every((p) => p.skinned));
  for (const region of body.parts) assert.equal(region.triangles, manifest.body.regions[region.name.replace('region-', '')], region.name);
  for (const clip of ['Idle', 'Walk', 'Run', 'Greet', '_Stress']) assert.ok(body.clips.includes(clip), clip);
  for (const part of manifest.parts) {
    const file = glb(part.file);
    assert.equal(file.parts.length, 1, `${part.id} is one mesh: a mask names its triangles by their place in it`);
    assert.ok(file.parts[0].skinned, part.id);
    assert.equal(file.parts[0].triangles, part.triangles, part.id);
    if (part.foreign) {
      // A part from another tool: fewer joints, another order, but none the body lacks.
      assert.ok(file.joints.length >= 1 && file.joints.every((name) => manifest.joints.includes(name)), part.id);
      assert.notDeepEqual(file.joints, manifest.joints.slice(0, file.joints.length), `${part.id} is here to differ from the kit's files`);
      continue;
    }
    // A kit-made part needs no joint the body's own clips do not move: it follows any animation of the skeleton.
    assert.deepEqual(file.joints, manifest.joints, part.id);
    assert.equal(file.clips.length, 0, `${part.id} is posed by the body and carries no clip`);
  }
});

test('one part to a slot; a full garment takes the place of top and bottom, and a top or bottom takes its place', () => {
  let look = dress('tee', 'trousers');
  assert.deepEqual([look.top, look.bottom, look.full], ['tee', 'trousers', null]);
  look = w.wear(look, 'robe');
  assert.deepEqual([look.top, look.bottom, look.full], [null, null, 'robe']);
  look = w.wear(look, 'skirt');
  assert.deepEqual([look.top, look.bottom, look.full], [null, 'skirt', null]);
  look = w.wear(w.wear(look, 'tank'), 'crop-shirt');
  assert.equal(look.top, 'crop-shirt');
  look = w.wear(w.wear(w.wear(look, 'belt-pouch'), 'pack'), 'straw-hat');
  assert.deepEqual(w.worn(look).map((p) => p.slot), ['bottom', 'top', 'waist', 'back', 'hat'], 'from the skin outwards');
  assert.equal(w.takeOff(look, 'top').top, null);
  assert.throws(() => w.wear(look, 'cape'), /no part cape/);
});

test('what cannot be worn together is not: putting one on takes the other off', () => {
  const clashing = manifest.parts.filter((p) => p.avoid.length);
  assert.ok(clashing.length >= 2, 'the build found at least one pair to avoid');
  for (const part of clashing)
    for (const other of part.avoid) {
      const a = w.part(other);
      if (a.slot === part.slot) continue;
      const look = w.wear(dress(other), part.id);
      assert.equal(look[a.slot], null, `${other} comes off under ${part.id}`);
      assert.equal(look[part.slot], part.id);
    }
  // Long hair and a pack: the hair would hang through it.
  assert.ok(w.part('pack').avoid.includes('hair-long'));
  assert.equal(w.wear(dress('hair-long'), 'pack').hair, null);
  for (let seed = 1; seed <= 300; seed++) {
    const worn = w.worn(w.random(seed));
    for (const p of worn) {
      assert.ok(p.passes, `seed ${seed}: ${p.id} does not pass the measure`);
      for (const q of worn) assert.ok(!p.avoid.includes(q.id), `seed ${seed}: ${p.id} with ${q.id}`);
    }
  }
});

test('what a part covers is not drawn: the skin under it, and the cloth of a part under it', () => {
  const regions = manifest.body.regions;
  assert.deepEqual(w.hidden(emptyLook()), []);
  for (const region of Object.keys(regions)) assert.equal(w.bodyMask(emptyLook(), region), null);
  // A tee: most of the torso goes, none of the hands or the head, and the arm only up to the cuff.
  const tee = dress('tee');
  const torso = hiddenIn(w.bodyMask(tee, 'torso'), regions.torso);
  assert.ok(torso > regions.torso * 0.6 && torso <= regions.torso, `${torso} of ${regions.torso}`);
  assert.equal(w.bodyMask(tee, 'hands'), null);
  assert.equal(w.bodyMask(tee, 'head'), null);
  assert.equal(w.bodyMask(tee, 'forearms'), null);
  const arm = hiddenIn(w.bodyMask(tee, 'upperArms'), regions.upperArms);
  assert.ok(arm > 0 && arm < regions.upperArms, `${arm} of ${regions.upperArms}: a short sleeve`);
  // Dressed from neck to foot: whole regions go, and nothing covers the head or the hands.
  const dressed = dress('shirt', 'trousers', 'boots');
  for (const region of ['upperArms', 'thighs', 'feet']) assert.ok(w.hidden(dressed).includes(region), region);
  for (const region of ['head', 'hands']) assert.ok(!w.hidden(dressed).includes(region), `${region} is never covered`);
  for (const part of manifest.parts) for (const region of part.covers) assert.ok(w.hidden(dress(part.id)).includes(region), `${part.id} covers ${region}`);
  // The trousers' waist is under the shirt: those triangles go, and only cloth that lies on the body may.
  const trousers = w.part('trousers');
  const under = w.partMask(dressed, 'trousers')!;
  assert.ok(hiddenIn(under, trousers.triangles) > 0);
  assert.equal(w.partMask(dress('trousers'), 'trousers'), null);
  for (const [outer, entry] of Object.entries(masks))
    for (const [inner, text] of Object.entries(entry.parts)) {
      const part = w.part(inner), mask = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
      for (let t = part.tight; t < part.triangles; t++) assert.ok(!(mask[t >> 3] & (1 << (t & 7))), `${outer} hides triangle ${t} of ${inner}, which is not cloth on the body`);
    }
  // Triangles drawn: what is hidden is not counted, what is worn is.
  const bare = w.triangles(emptyLook());
  assert.equal(bare, Object.values(regions).reduce((a, b) => a + b, 0));
  const skin = Object.entries(regions).reduce((sum, [region, n]) => sum + hiddenIn(w.bodyMask(tee, region), n), 0);
  assert.equal(w.triangles(tee), bare - skin + w.part('tee').triangles);
  // (A top that hangs and a trouser leg that is a tube have two sides: about 3,200 more than the bare body, where cloth lying on the skin cost under 2,000.)
  assert.ok(w.triangles(dressed) < bare + 3500, 'dressed costs little more than the bare body does: most of the skin is not drawn');
});

test('no look costs more than 25,000 triangles', () => {
  let most = 0;
  for (let seed = 1; seed <= 300; seed++) most = Math.max(most, w.triangles(w.random(seed)));
  assert.ok(most <= 25000, `${most}`);
  assert.ok(w.triangles(emptyLook()) <= 12000);
});

test("colours: one of the part's palette, hair from the hair colours; a part that is not tintable stays as made", () => {
  let look = dress('tee', 'hair-bob');
  assert.deepEqual(w.colourOf(look, 'tee'), CLOTH[0]);
  look = w.colour(look, 'tee', 2);
  look = w.colour(look, 'hair-bob', 4);
  assert.deepEqual(w.colourOf(look, 'tee'), CLOTH[2]);
  assert.deepEqual(w.colourOf(look, 'hair-bob'), HAIR[4]);
  assert.equal(w.colour(look, 'tee', 99), look, 'outside the palette');
  assert.equal(w.colour(look, 'hair-bob', HAIR.length), look);
  look = w.wear(look, 'boots');
  assert.equal(w.colour(look, 'boots', 1), look);
  assert.deepEqual(w.colourOf(look, 'boots'), [1, 1, 1]);
});

test('a look survives being written as a code and read back; an older or a bad code gives what it can', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const look = w.random(seed);
    const back = w.decode(w.encode(look));
    assert.deepEqual(w.encode(back), w.encode(look), `seed ${seed}`);
    assert.deepEqual(w.hidden(back), w.hidden(look));
    assert.ok(!(look.full && (look.top || look.bottom)), 'never a full garment with a top or bottom');
  }
  assert.deepEqual(w.random(7), w.random(7));
  // A code from before there were belts, packs and hats: five slots.
  const old = w.decode('hair-bob.tee.trousers.shoes._~tee:1');
  assert.deepEqual([old.hair, old.top, old.bottom, old.shoes, old.full, old.waist, old.back, old.hat], ['hair-bob', 'tee', 'trousers', 'shoes', null, null, null, null]);
  const odd = w.decode('hair-bob.robe.trousers.nothing._.straw-hat.pack.belt-pouch~tee:3,hair-bob:1');
  assert.deepEqual([odd.hair, odd.top, odd.bottom, odd.shoes, odd.full, odd.waist, odd.back, odd.hat], ['hair-bob', null, 'trousers', null, null, null, 'pack', null], 'a robe is not a top, a hat is not a belt');
  assert.equal(odd.colours['hair-bob'], 1);
  assert.equal(odd.colours.tee, undefined, 'not worn');
  assert.deepEqual(w.decode(''), emptyLook());
});

test("the build's measure: the body stays under every kit-made part in every pose, and what clips is kept apart", () => {
  const report = read('../docs/evidence/clip-report.json');
  assert.ok(report.poses >= 150, `${report.poses} poses`);
  assert.ok(report.clips.includes('_Stress'), 'poses no clip of the game reaches are measured too');
  assert.equal(report.toleranceMm, 1);
  for (const part of manifest.parts) {
    const row = report.parts[part.id];
    assert.ok(row, `${part.id} was measured`);
    assert.equal(row.triangles, part.triangles, `${part.id}: the report is of another build; run npm run parts`);
    assert.equal(row.skinThrough === 0, part.passes, part.id);
    if (!part.foreign) assert.equal(row.skinThrough, 0, `${part.id}: the body comes through, ${row.depthMm} mm`);
  }
  // A pair measured to clip is a pair the list keeps apart, and no other is.
  const clipping = new Set(report.pairs.filter((p: any) => p.through > 0).flatMap((p: any) => [`${p.inner}/${p.outer}`, `${p.outer}/${p.inner}`]));
  // (Or one the catalogue keeps apart by its cut: a belt under a top that hangs over it, a bun under a cone.)
  const declared = new Set((report.apart as string[][]).flatMap(([a, b]) => [`${a}/${b}`, `${b}/${a}`]));
  const avoided = new Set(manifest.parts.flatMap((p) => p.avoid.map((other) => `${p.id}/${other}`)));
  assert.deepEqual([...avoided].sort(), [...new Set([...clipping, ...declared])].sort());
  assert.ok(declared.has('pack/hair-long') && declared.has('straw-hat/hair-bun') && declared.has('belt-pouch/tee'));
  const kit = report.pairs.filter((p: any) => !w.part(p.inner).foreign && !w.part(p.outer).foreign);
  // (Fewer than before: four cuts left the catalogue, and the hat and the pack are solids now, not cloth.)
  assert.ok(kit.length >= 85, `${kit.length} pairs of kit-made parts overlap and were measured`);
  assert.ok(kit.filter((p: any) => p.through > 0 && !declared.has(`${p.inner}/${p.outer}`)).length <= 3, 'kit-made parts go together but for a few pairs');
  // Loose cloth that hangs round the body holds it at rest, and nothing stands through a hard object.
  const loose = Object.entries(report.parts).filter(([, row]: any) => row.standsOut !== undefined);
  assert.ok(loose.length >= 12, `${loose.length} parts with a bell or a tube`);
  for (const [id, row] of loose as any) assert.equal(row.standsOut, 0, `${id}: the body stands out of its loose cloth`);
  assert.ok(report.solids.length >= 10);
  for (const row of report.solids) assert.equal(row.through, 0, `${row.with} stands through ${row.solid}`);
});

test('looked at from all round in every clip, a dressed figure shows no hole and nothing that is covered', () => {
  const report = read('../docs/evidence/look-report.json');
  assert.equal(report.views, 26);
  assert.ok(report.limitCm2 <= 1);
  for (const part of manifest.parts) assert.equal(report.parts[part.id], part.triangles, `${part.id}: the report is of another build; run npm run look`);
  const alone = new Map(report.rows.filter((row: any) => !row.outfit.includes('+')).map((row: any) => [row.outfit, row]));
  for (const part of manifest.parts) {
    const row = alone.get(part.id) as any;
    assert.ok(row, `${part.id} was looked at`);
    if (part.foreign) continue;
    assert.ok(row.holes.worst <= report.limitCm2, `${part.id}: seen through, ${row.holes.worst} cm2`);
    assert.ok(row.shown.worst <= report.limitCm2, `${part.id}: covered surface shows, ${row.shown.worst} cm2`);
  }
  const outfits = report.rows.filter((row: any) => row.outfit.includes('+') && row.kitMade);
  assert.ok(outfits.length >= 20, `${outfits.length} whole outfits`);
  for (const row of outfits) assert.ok(row.passes, `${row.outfit}: ${row.holes.worst} cm2 seen through, ${row.shown.worst} cm2 showing`);
  assert.equal(report.failed, 0);
});

test('the figure and the clothes have the measurements of real ones, and what does not is listed', () => {
  const report = read('../docs/evidence/measure-report.json');
  for (const [id, triangles] of Object.entries(report.built)) assert.equal(triangles, w.part(id).triangles, `${id}: the report is of another build; run npm run measure`);
  // The body: every girth within 6 % of a real size 8, every height within 8 %, the shoulders' slope within 15 %.
  assert.match(report.body.source, /ASTM D5585/);
  const girths = report.body.rows.filter((row: any) => row.what.startsWith('girth'));
  assert.equal(girths.length, 13);
  for (const row of report.body.rows) {
    const slack = row.what.startsWith('girth') ? 0.06 : row.what.startsWith('shoulder slope') ? 0.15 : 0.08;
    assert.ok(Math.abs(row.ratio - 1) <= slack + 1e-9, `${row.what}: ${row.mine} against ${row.real}`);
  }
  // The clothes: inside the range real ones are made in, but for these, which the game says and does not hide.
  const outside = report.garments.rows.filter((row: any) => !row.within).map((row: any) => `${row.garment}: ${row.what}`);
  assert.deepEqual(outside.sort(), ['long-skirt: hip round less the hips (ease)', 'skirt: hip round less the hips (ease)', 'tee: hem round over chest round']);
  assert.ok(report.garments.rows.length >= 21, `${report.garments.rows.length} measurements`);
  for (const garment of ['tee', 'trousers', 'skirt', 'straw-hat', 'pack']) assert.ok(report.garments.rows.some((row: any) => row.garment === garment), garment);
});
