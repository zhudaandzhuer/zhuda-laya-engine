// A recorded run for games/tools/shot.mjs: real clicks on the page's buttons, a real drag across the picture.
//   node ../tools/shot.mjs . --size 1280x720 --query "look=_._._._._" --script tools/play.mjs --out play-out/hands --name hands --timeout 300000
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel } from '../../tools/characters/clip-check.mjs';

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const masks = JSON.parse(readFileSync(join(assets, 'masks.json'), 'utf8'));
/** The sides of every triangle of each mesh in a file, in the file's order. */
function sidesOf(file) {
  const out = {};
  for (const mesh of loadModel(new Uint8Array(readFileSync(join(assets, file)))).meshes) {
    const P = mesh.positions, I = mesh.indices, each = new Float32Array(I.length / 3);
    for (let t = 0; t < each.length; t++)
      for (let k = 0; k < 3; k++) {
        const a = I[t * 3 + k] * 3, b = I[t * 3 + ((k + 1) % 3)] * 3;
        each[t] += Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]);
      }
    out[mesh.name] = each;
  }
  return out;
}
const bodySides = sidesOf('parts/body.glb');
const sum = (each, mask) => {
  let total = 0;
  for (let t = 0; t < each.length; t++) if (!mask || mask[t >> 3] & (1 << (t & 7))) total += each[t];
  return Math.round(total * 1e4);
};
const close = (a, b) => Math.abs(a - b) <= Math.max(4, b * 3e-5);
/**
 * What the page hid, against the files: a mask names triangles by their place in the file, and the
 * page reads back from each drawn mesh which triangles are in fact not drawn. The sums of their
 * sides agree only if the engine hid the triangles the mask meant.
 */
function checkMasks(s) {
  const either = (list) => list.reduce((all, text) => {
    const mask = Buffer.from(text, 'base64');
    return all ? all.map((x, i) => x | mask[i]) : Uint8Array.from(mask);
  }, null);
  for (const [name, got] of Object.entries(s.maskedSum)) {
    const region = name.startsWith('region-') ? name.slice(7) : null;
    const mask = either(s.worn.flatMap((id) => (region ? (masks[id]?.body?.[region] ? [masks[id].body[region]] : []) : masks[id]?.parts?.[name] ? [masks[id].parts[name]] : [])));
    const each = region ? bodySides[name] : Object.values(sidesOf(`parts/${name}.glb`))[0];
    const want = mask ? sum(each, mask) : 0;
    if (!close(got, want)) throw Error(`${name}: the triangles hidden on the page (sides ${got}) are not the ones the mask names (sides ${want})`);
    if (!close(s.order[name][1], sum(each)) || s.order[name][0] !== each.length) throw Error(`${name}: the page's mesh ${JSON.stringify(s.order[name])} is not the file's ${JSON.stringify([each.length, sum(each)])}`);
  }
  return Object.keys(s.maskedSum).length;
}

export default async ({ page, shot, state, sleep, log }) => {
  let s = await state();
  const click = async (name) => {
    s = await state();
    if (!s.hot[name]) throw Error(`no control ${name}`);
    await page.evaluate((n) => document.querySelector(`[data-hot="${n}"]`).scrollIntoView({ block: 'center' }), name);
    await sleep(60);
    s = await state();
    // The page lists controls where they were when it last drew; after scrolling, ask it where this one is.
    const [x, y] = await page.evaluate((n) => {
      const box = document.querySelector(`[data-hot="${n}"]`).getBoundingClientRect();
      return [box.left + box.width / 2, box.top + box.height / 2];
    }, name);
    await page.mouse.click(x, y);
    // A part worn for the first time is loaded: wait until the page says what is worn has settled.
    const before = s.look;
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      s = await state();
      if (s.error) throw Error(s.error);
      if (i >= 4 && (s.look !== before || i >= 8)) break;
    }
    return s;
  };
  const settle = async (ms = 600) => (await sleep(ms), (s = await state()));
  const all = ['head', 'torso', 'shoulders', 'upperArms', 'forearms', 'hands', 'hips', 'thighs', 'shins', 'feet'];
  const same = (a, b) => [...a].sort().join() === [...b].sort().join();
  if (!same(s.shown, all)) throw Error(`the bare body should show every region: ${s.shown}`);
  if (s.masked.body !== 0) throw Error(`the bare body has ${s.masked.body} triangles hidden`);
  checkMasks(s);
  await shot('00-bare');

  // A top, a bottom, boots, a pack, hair: each loads once, binds to the body's joints and hides what it covers.
  for (const id of ['shirt', 'trousers', 'boots', 'pack', 'hair-bob']) await click(`wear-${id}`);
  await click('colour-shirt-2');
  await click('colour-trousers-1');
  log({ step: 'dressed', look: s.look, hidden: s.hidden, masked: s.masked, bound: s.bound, loads: s.loads, triangles: s.triangles, draws: s.draws });
  if (!same(s.worn, ['hair-bob', 'shirt', 'trousers', 'boots', 'pack'])) throw Error(`worn: ${s.worn}`);
  for (const id of s.worn) {
    if (!(s.bound[id]?.renderers >= 1) || s.bound[id].missing.length) throw Error(`${id} was not bound: ${JSON.stringify(s.bound[id])}`);
  }
  log({ step: 'masks agree with the files', meshes: checkMasks(s) });
  for (const region of ['upperArms', 'thighs', 'feet']) if (!s.hidden.includes(region)) throw Error(`${region} should be wholly hidden: ${s.hidden}`);
  for (const region of ['head', 'hands']) if (s.hidden.includes(region)) throw Error(`${region} is hidden`);
  if (!same(s.shown, all.filter((r) => !s.hidden.includes(r)))) throw Error(`shown ${s.shown} against hidden ${s.hidden}`);
  // Skin under the cuffs and the collar, the trousers' waist under the shirt that hangs over it, the shirt under the pack's straps.
  if (!(s.masked.body > 500)) throw Error(`skin hidden in the regions still drawn: ${s.masked.body}`);
  if (!(s.masked.parts.trousers > 50) || !(s.masked.parts.shirt > 5)) throw Error(`cloth hidden under cloth: ${JSON.stringify(s.masked.parts)}`);
  await shot('01-dressed-idle');
  await click('clip-Walk');
  await settle(500);
  await shot('02-walk');
  // Poses no clip of the game reaches, each held: arms overhead with a twist, a deep crouch, a high kick.
  for (const [i, pose] of ['arms', 'crouch', 'kick'].entries()) {
    await click(`hold-${pose}`);
    await settle(500);
    if (s.clip !== `_Stress@${pose}`) throw Error(`the pose held: ${s.clip}`);
    await shot(`0${3 + i}-${pose}`);
  }

  // A full garment takes the top and the bottom off; turning the character by dragging across the picture.
  await click('wear-robe');
  if (s.worn.includes('shirt') || s.worn.includes('trousers') || !s.worn.includes('robe')) throw Error(`after the robe: ${s.worn}`);
  const before = s.yaw;
  await page.mouse.move(300, 360);
  await page.mouse.down();
  await page.mouse.move(450, 360, { steps: 6 });
  await page.mouse.up();
  await settle(300);
  if (!(Math.abs(s.yaw - before) > 60)) throw Error(`the drag did not turn the character: ${before} -> ${s.yaw}`);
  await click('clip-Run');
  await settle(400);
  await shot('06-robe-run-turned');

  // Wearing the shirt again does not load it again; a top takes the robe off. A skirt, in the kick.
  const loads = s.loads;
  await click('wear-shirt');
  if (s.loads !== loads) throw Error('a part worn before was loaded again');
  if (s.worn.includes('robe')) throw Error('a top did not take the robe off');
  await click('wear-skirt');
  await click('colour-skirt-4');
  await click('wear-hair-long');
  checkMasks(s);
  await click('hold-kick');
  await settle(500);
  await shot('07-skirt-kick');
  await click('hold-crouch');
  await settle(500);
  await shot('08-skirt-crouch');
  // What the build measured to clip is not worn together: a pack takes the long hair off.
  await click('wear-pack');
  if (s.worn.includes('hair-long') || !s.worn.includes('pack')) throw Error(`long hair with a pack: ${s.worn}`);
  await click('wear-straw-hat');
  await click('wear-hair-bun');
  await click('clip-Greet');
  await settle(700);
  await shot('09-hat-pack-greet');
  // A part this project's kit did not make (tools/foreign-part.py: centimetres, z up, bones turned, fewer
  // joints in another order, a texture): bound through offset nodes, one a joint; the kit's own need none.
  // It is made the naive way and does not pass the build's measure: the page marks it.
  // It clips with every bottom in some pose, so the list keeps them apart: wearing it takes the skirt off.
  await click('wear-knit');
  // (Whether it goes with the skirt is what the build measured: the list says.)
  const apart = JSON.parse(readFileSync(join(assets, 'wardrobe.json'), 'utf8')).parts.find((q) => q.id === 'knit').avoid.includes('skirt');
  if (!s.worn.includes('knit') || s.worn.includes('skirt') === apart) throw Error(`the knit and the skirt, which the list ${apart ? 'keeps apart' : 'lets go together'}: ${s.worn}`);
  await click('clip-Run');
  await settle(450);
  await shot('10-foreign-knit-run');
  log({ step: 'foreign', knit: s.bound.knit, hidden: s.hidden, masked: s.masked });
  if (!(s.bound.knit?.renderers >= 1) || s.bound.knit.offsets !== s.bound.knit.joints || s.bound.knit.offsets < 8) throw Error(`the foreign part: ${JSON.stringify(s.bound.knit)}`);
  checkMasks(s);
  for (const [id, b] of Object.entries(s.bound)) if (id !== 'knit' && b.offsets !== 0) throw Error(`${id} is the kit's own and needed offsets: ${b.offsets}`);
  const mark = await page.evaluate(() => document.querySelector('[data-hot="wear-knit"]').textContent);
  if (!mark.includes('⚠')) throw Error(`the part that does not pass is not marked: ${mark}`);
  for (let i = 0; i < 3; i++) (await click('random'), checkMasks(s));
  await click('clip-Idle');
  await shot('11-random');
  await click('clear');
  if (s.worn.length || !same(s.shown, all) || s.masked.body !== 0) throw Error(`after clearing: worn ${s.worn}, shown ${s.shown}, hidden triangles ${s.masked.body}`);
  await shot('12-bare-again');
  log({ step: 'end', loads: s.loads, bound: Object.keys(s.bound).length, triangles: s.triangles, draws: s.draws });
};
