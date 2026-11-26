// 2d/spine-tights without a browser: the rig holds the bones, constraints, slots and attachments
// the driver names; the tear sites lie on the legs below the skirt; and the driver, on a stand-in
// for ZhudaSpineCharacter, pulls, tears in two stages, lifts the skirt by IK and lets everything go.
// What is drawn is checked in the 2D viewer on a graphics card (the module's README says how).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SKIRT_CHAINS, TIGHTS_BASE, TIGHTS_CANVAS, TIGHTS_FILES, TIGHTS_IDLE, createSpineTights, fitTights, tightsPath } from '../2d/spine-tights/spine-tights.ts';

const asset = (file) => new URL(`../2d/spine-tights/assets/${file}`, import.meta.url);
const rig = JSON.parse(fs.readFileSync(asset(TIGHTS_FILES.rig), 'utf8'));
const atlas = fs.readFileSync(asset(TIGHTS_FILES.atlas), 'utf8');
const sites = JSON.parse(fs.readFileSync(asset(TIGHTS_FILES.sites), 'utf8'));
const boneNames = new Set(rig.bones.map((b) => b.name));

test('the files are where the module says, and the page is the size the atlas says', () => {
  assert.equal(tightsPath('rig'), `${TIGHTS_BASE}outfit.json`);
  for (const file of Object.values(TIGHTS_FILES)) assert.ok(fs.existsSync(asset(file)), file);
  const lines = atlas.split('\n');
  assert.equal(lines[0], TIGHTS_FILES.page);
  assert.equal(lines[1], 'size:2048,4096');
  // Straight alpha: ZhudaSpineCharacter's default.
  assert.ok(lines.includes('pma:false'));
  const png = fs.readFileSync(asset(TIGHTS_FILES.page));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [2048, 4096]);
  const bg = fs.readFileSync(asset(TIGHTS_FILES.background));
  assert.equal(bg.toString('latin1', 1, 4), 'PNG');
});

test('the rig: Spine 4.2 on the photo\'s canvas, one swaying animation, nine pleat chains with IK and physics', () => {
  assert.match(rig.skeleton.spine, /^4\.2\./);
  assert.deepEqual([rig.skeleton.x, rig.skeleton.y, rig.skeleton.width, rig.skeleton.height], [-TIGHTS_CANVAS.width / 2, 0, TIGHTS_CANVAS.width, TIGHTS_CANVAS.height]);
  assert.deepEqual(Object.keys(rig.animations), [TIGHTS_IDLE]);
  let length = 0;
  JSON.stringify(rig.animations[TIGHTS_IDLE], (key, value) => (key === 'time' && (length = Math.max(length, value)), value));
  assert.equal(length, 4, 'the idle sways over four seconds');
  assert.equal(rig.ik.length, SKIRT_CHAINS);
  assert.equal(rig.physics.length, SKIRT_CHAINS * 3, 'three links a chain, each with physics');
  for (let i = 0; i < SKIRT_CHAINS; i++) {
    for (const bone of [`pleat${i}_1`, `pleat${i}_2`, `pleat${i}_3`, `grab${i}`]) assert.ok(boneNames.has(bone), bone);
    const ik = rig.ik.find((c) => c.name === `grab${i}_ik`);
    assert.ok(ik, `grab${i}_ik`);
    assert.equal(ik.target, `grab${i}`);
    assert.equal(ik.mix ?? 1, 0, 'at rest the IK is off: the game turns it on for the chain it holds');
  }
});

test('ten tear sites, five a leg, mirrored, on the legs below the hem; each has its bone, two slots and four pictures', () => {
  assert.equal(sites.length, 10);
  const slots = new Set(rig.slots.map((s) => s.name));
  const attachments = rig.skins[0].attachments;
  const regions = new Set(atlas.split('\n').filter((line) => line && !line.includes(':') && !line.endsWith('.png')));
  for (const site of sites) {
    assert.match(site.name, /^[LR]_(thigh|lowthigh|knee|calf|shin)$/);
    assert.ok(site.x > 300 && site.x < 724 && site.y > 580 && site.y < 1200 && site.w > 60 && site.w < 160, JSON.stringify(site));
    assert.ok(boneNames.has(`pull_${site.name}`), `pull_${site.name}`);
    for (const kind of ['tear', 'lip']) {
      assert.ok(slots.has(`${kind}_${site.name}`), `${kind}_${site.name}`);
      // Whole at the start: the slots are empty until the game tears.
      assert.equal(rig.slots.find((s) => s.name === `${kind}_${site.name}`).attachment, undefined);
      for (const size of ['small', 'large']) {
        assert.ok(attachments[`${kind}_${site.name}`]?.[`${kind}_${site.name}_${size}`], `${kind}_${site.name}_${size}`);
        assert.ok(regions.has(`${kind}_${site.name}_${size}`), `atlas region ${kind}_${site.name}_${size}`);
      }
    }
  }
  for (const part of ['thigh', 'lowthigh', 'knee', 'calf', 'shin']) {
    const left = sites.find((s) => s.name === `L_${part}`),
      right = sites.find((s) => s.name === `R_${part}`);
    assert.equal(left.y, right.y);
    assert.ok(left.x < 512 && right.x > 512 && Math.abs(left.x + right.x - 1024) < 16, `${part}: ${left.x} / ${right.x}`);
  }
});

/** What the driver needs of ZhudaSpineCharacter, recording what it is told. */
function standIn() {
  const tips = Object.fromEntries(Array.from({ length: SKIRT_CHAINS }, (_, i) => [`pleat${i}_3`, [200 + i * 78, 478 + 87 * Math.sin((Math.PI * i) / 8)]]));
  const told = { attachments: {}, ik: {}, moved: {}, nudged: {} };
  return {
    tips,
    told,
    skeleton: { findBone: (name) => (boneNames.has(name) ? { name } : null) },
    boneTipCanvas: (name) => [...tips[name]],
    moveBoneTo: (name, x, y) => (told.moved[name] = [x, y]),
    nudgeBone: (name, dx, dy) => (told.nudged[name] = [dx, dy]),
    setIkMix: (name, mix) => (told.ik[name] = mix),
    setAttachment: (slot, attachment) => (told.attachments[slot] = attachment),
  };
}
const run = (tights, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) tights.step(1 / 60);
};

test('a pull stretches the nylon toward the finger and lets it spring back whole', () => {
  const spine = standIn(),
    tights = createSpineTights(spine, sites);
  const knee = sites.find((s) => s.name === 'R_knee');
  assert.equal(tights.press(40, 1300), null, 'the background is not a site');
  assert.equal(tights.press(knee.x + 5, knee.y - 5), 'leg');
  tights.drag(knee.x + 65, knee.y + 35);
  run(tights, 0.5);
  const [dx, dy] = spine.told.nudged.pull_R_knee;
  assert.ok(dx > 30 && dx < 60 && dy > 15 && dy < 40, `the nylon follows, giving way a little (${dx}, ${dy})`);
  assert.deepEqual(tights.stats().tears, []);
  for (const other of sites.filter((s) => s !== knee)) assert.deepEqual(spine.told.nudged[`pull_${other.name}`], [0, 0]);
  tights.release();
  assert.equal(tights.held, null);
  run(tights, 1);
  assert.ok(Math.hypot(...spine.told.nudged.pull_R_knee) < 0.5, 'back where it was within a second');
});

test('pulled past 1.35 times tearAt of the leg\'s width it tears: a small hole, then a large one, and no further', () => {
  const spine = standIn();
  let changes = 0;
  const tights = createSpineTights(spine, sites, { tearAt: 0.8, onChange: () => changes++ });
  const thigh = sites.find((s) => s.name === 'L_thigh');
  const far = thigh.w * 0.8 * 1.35;
  tights.press(thigh.x, thigh.y);
  tights.drag(thigh.x - (far - 2), thigh.y);
  assert.deepEqual(tights.stats().tears, [], 'just short of it');
  tights.drag(thigh.x - (far + 2), thigh.y);
  assert.deepEqual(tights.stats().tears, ['L_thigh:1']);
  assert.equal(tights.held, null, 'a tear lets go by itself');
  assert.equal(spine.told.attachments.tear_L_thigh, 'tear_L_thigh_small');
  assert.equal(spine.told.attachments.lip_L_thigh, 'lip_L_thigh_small');
  tights.drag(thigh.x - 500, thigh.y);
  assert.deepEqual(tights.stats().tears, ['L_thigh:1'], 'a drag with nothing held does nothing');
  tights.press(thigh.x, thigh.y);
  tights.drag(thigh.x, thigh.y + far + 2);
  assert.equal(spine.told.attachments.tear_L_thigh, 'tear_L_thigh_large');
  assert.equal(tights.tear('L_thigh'), 2, 'two stages are all there are');
  assert.equal(tights.tear('R_shin'), 1);
  assert.equal(tights.tear('nowhere'), undefined);
  assert.deepEqual(tights.stats().tears, ['L_thigh:2', 'R_shin:1']);
  tights.reset();
  assert.deepEqual(tights.stats().tears, []);
  for (const site of sites) for (const kind of ['tear', 'lip']) assert.equal(spine.told.attachments[`${kind}_${site.name}`], null);
  assert.equal(changes, 5, 'told of each tear and of the mending');
});

test('the skirt: the pleat nearest the finger is taken by its IK, follows the finger up, and is given back to the physics', () => {
  const spine = standIn(),
    tights = createSpineTights(spine, sites);
  const [tipX, tipY] = spine.tips.pleat4_3;
  assert.equal(tights.press(tipX + 10, 60), null, 'above the waistband is not the skirt');
  assert.equal(tights.press(tipX + 10, tipY - 40), 'skirt');
  assert.deepEqual(spine.told.moved.grab4, [tipX, tipY], 'the grab bone starts at the chain\'s tip');
  tights.drag(tipX + 10 + 50, tipY - 40 - 200);
  assert.deepEqual(spine.told.moved.grab4, [tipX + 55, tipY - 250], 'up by five quarters of the finger\'s travel, sideways by eleven tenths');
  tights.drag(tipX + 10, tipY - 40 + 300);
  assert.deepEqual(spine.told.moved.grab4, [tipX, tipY + 50], 'pulled down, the cloth gives only 50 pixels');
  run(tights, 0.5);
  assert.ok(spine.told.ik.grab4_ik > 0.99, `the held chain's IK is on (${spine.told.ik.grab4_ik})`);
  for (let i = 0; i < SKIRT_CHAINS; i++) if (i !== 4) assert.equal(spine.told.ik[`grab${i}_ik`], 0);
  tights.release();
  run(tights, 0.2);
  assert.ok(spine.told.ik.grab4_ik > 0.2 && spine.told.ik.grab4_ik < 0.5, `fading a fifth of a second after letting go (${spine.told.ik.grab4_ik})`);
  run(tights, 1.5);
  assert.ok(spine.told.ik.grab4_ik < 0.01);
  // Below the hem is leg, not skirt.
  const thigh = sites.find((s) => s.name === 'L_thigh');
  assert.equal(tights.press(thigh.x, thigh.y), 'leg');
});

test('a rig without the bones the driver names is refused with the bone\'s name', () => {
  const spine = standIn();
  assert.throws(() => createSpineTights(spine, [{ name: 'L_elbow', x: 400, y: 700, w: 100 }]), /pull_L_elbow/);
  spine.skeleton.findBone = (name) => (name.startsWith('grab') ? null : { name });
  assert.throws(() => createSpineTights(spine, sites), /no chain pleat0_3/);
});

test('the picture fits a tall screen by its height and a wide one whole', () => {
  const tall = fitTights(390, 844),
    wide = fitTights(1280, 720);
  // Tall: the legs fill the width (the grey sides are cut), the picture is wider than the screen.
  assert.ok(Math.abs(tall.scale - 390 / (1024 * 0.8)) < 1e-9 && TIGHTS_CANVAS.width * tall.scale > 390 && tall.x < 0);
  // Wide: nine tenths of the height shows, centred.
  assert.ok(Math.abs(wide.scale - 720 / (1536 * 0.9)) < 1e-9 && Math.abs(wide.x - (1280 - 1024 * wide.scale) / 2) < 1e-9);
});
