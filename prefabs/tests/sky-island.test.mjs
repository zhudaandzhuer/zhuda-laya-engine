// The floating island without a browser: its ground, pond and path (from the game's own
// tests), where things stand, the island its characters see, the day's weather and lightning,
// and the island's sound files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const { groundAt, insideBy, pondDistance, pathDistance, rimAt, POND, WATER_Y, HOUSE, TREE } = await import('../3d/sky-island/ground.ts');
const layout = await import('../3d/sky-island/layout.ts');
const { createIslandDay } = await import('../3d/sky-island/day.ts');
const { random } = await import('../3d/math.ts');
const { NATURE_PACK } = await import('../3d/nature-pack/nature-pack.ts');
const sound = await import('../3d/island-sound/lines.ts');

test('the ground is the island top inside the rim and nothing outside it', () => {
  assert.equal(typeof groundAt(0, 0), 'number');
  assert.equal(groundAt(12, 0), null);
  assert.ok(insideBy(0, 0) > 5);
  assert.ok(insideBy(10, 0) < 0);
  // the rim goes all the way round, 6 to 9 m out (17 m across)
  for (let a = 0; a < Math.PI * 2; a += 0.1) assert.ok(rimAt(a) > 5.5 && rimAt(a) < 9, `rim at ${a}`);
});

test('the pond is a hollow below its water line; the path is worn into the top', () => {
  assert.ok(pondDistance(POND.center[0], POND.center[1]) < 0.01);
  assert.ok(groundAt(POND.center[0], POND.center[1]) < WATER_Y - 0.2);
  assert.ok(pathDistance(0.8, 4.6) < 0.01);
});

test('every prop, plant and lamp stands on the island, and the plants are in the nature pack', () => {
  for (const [name, x, z] of layout.PROPS) assert.ok(insideBy(x, z) > 0.3, name);
  for (const [id, x, z] of layout.NATURE) {
    assert.ok(NATURE_PACK[id], id);
    assert.notEqual(groundAt(x, z), null, `${id} at ${x}, ${z}`);
  }
  for (const { at } of layout.LAMPS) assert.ok(at[1] > (groundAt(at[0], at[2]) ?? 0) + 1, 'lamps hang above the ground');
  assert.ok(layout.CHIMNEY[1] > HOUSE.height + 3 && layout.WINDMILL[1] > HOUSE.height + 5);
  assert.deepEqual(['island', 'house', 'props', 'tree'].map(layout.islandPath), ['island', 'house', 'props', 'tree'].map((n) => `common/3d/sky-island/assets/${n}.glb`));
  const assets = fileURLToPath(new URL('../3d/sky-island/assets/', import.meta.url));
  for (const n of ['island', 'house', 'props', 'tree']) assert.equal(fs.readFileSync(assets + n + '.glb').subarray(0, 4).toString('latin1'), 'glTF', n);
});

test('grass grows on open ground, not on the path, in the pond, under the house or the tree', () => {
  const at = (x, z) => layout.grassGrows(x, z, groundAt(x, z) ?? -1);
  assert.equal(at(0.8, 4.6), false, 'path');
  assert.equal(at(POND.center[0], POND.center[1]), false, 'pond');
  assert.equal(at(HOUSE.center[0], HOUSE.center[1]), false, 'house');
  assert.equal(at(TREE.center[0], TREE.center[1]), false, 'tree');
  let grows = 0;
  for (let x = -8; x <= 8; x += 0.5) for (let z = -8; z <= 8; z += 0.5) if (groundAt(x, z) !== null && at(x, z)) grows++;
  assert.ok(grows > 400, `grass on ${grows} of the half-metre points`);
});

test('the island its characters see: roof and tower above the house, a pond, a lost depth', () => {
  const w = layout.SKY_ISLAND_WORLD;
  assert.equal(w.ground, groundAt);
  const ridge = layout.roofAt(HOUSE.center[0], HOUSE.center[1]);
  const eave = layout.roofAt(HOUSE.center[0] + layout.ROOF.halfW - 0.01, HOUSE.center[1]);
  assert.ok(ridge > eave && eave > HOUSE.height + 2, 'a gable: highest along the ridge');
  assert.equal(layout.roofAt(HOUSE.center[0] + 3, HOUSE.center[1]), null);
  assert.equal(w.roof.ridgeX, HOUSE.center[0]);
  assert.ok(w.caps[0].y > ridge, 'the tower stands above the roof');
  assert.ok(w.lostBelow < -10 && w.respawnHeight > 10);
  // the house and the tree are in the way; the open lawn is not
  const blocked = (x, z) => w.obstacles.circles.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r) || w.obstacles.boxes.some(([bx, bz, hx, hz]) => Math.abs(x - bx) < hx && Math.abs(z - bz) < hz);
  assert.ok(blocked(HOUSE.center[0], HOUSE.center[1]));
  assert.ok(blocked(TREE.center[0], TREE.center[1]));
  assert.ok(!blocked(...layout.STAGE.center), 'the stage is open lawn');
  assert.ok(insideBy(...layout.STAGE.center) > 1);
});

test('the crate bobs in the pond, near its spot', () => {
  for (let t = 0; t < 60; t += 0.7) {
    const { position, euler } = layout.crateAt(t);
    assert.ok(Math.abs(position[0] + 4.4) < 0.2 && Math.abs(position[2] + 0.6) < 0.15 && Math.abs(position[1] - (WATER_Y - 0.2)) < 0.04);
    assert.ok(Math.abs(euler[0]) <= 3 && Math.abs(euler[1] - 22) <= 8);
  }
});

test('the day: the clock runs or stands, weather eases in, a storm strikes lightning and thunder', () => {
  const bolts = [];
  const day = createIslandDay({ hour: 23.9, weather: 'clear', clockRuns: true, rand: random(5), onBolt: (far) => bolts.push(far) });
  day.step(2);
  assert.ok(Math.abs(day.hour - 0.06) < 1e-9, 'the five-minute day wraps at midnight');
  day.clockRuns = false;
  const stood = day.hour;
  day.weather = 'storm';
  day.step(1);
  assert.ok(day.mix.storm > 0.3 && day.mix.storm < 0.5, 'eased, not at once');
  for (let i = 0; i < 60 * 30; i++) day.step(1 / 60);
  assert.equal(day.hour, stood, 'the clock stood still');
  assert.ok(bolts.length >= 2 && bolts.every((f) => f >= 0 && f < 1), `${bolts.length} bolts`);
  day.setWeatherNow('mist');
  assert.deepEqual({ ...day.mix }, { rain: 0, storm: 0, mist: 1 });
  // the random sequence does not depend on whether anyone listens for thunder
  const a = random(9), b = random(9);
  const loud = createIslandDay({ hour: 12, weather: 'storm', clockRuns: false, rand: a, onBolt: () => {} });
  const deaf = createIslandDay({ hour: 12, weather: 'storm', clockRuns: false, rand: b });
  for (let i = 0; i < 600; i++) loud.step(1 / 60), deaf.step(1 / 60);
  assert.equal(a(), b());
});

test('every sound the island asks for is in assets/, and every file there is asked for', () => {
  const dir = fileURLToPath(new URL('../3d/island-sound/assets/', import.meta.url));
  const onDisk = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.m4a')).map((f) => f.split('\\').join('/')).sort();
  assert.deepEqual([...sound.soundFiles()].sort(), onDisk);
  assert.equal(sound.soundFiles(['zhuda'], null).filter((f) => f.startsWith('voice/')).length, 37);
  assert.equal(sound.soundFiles(['zhuer'], null).filter((f) => f.startsWith('voice/')).length, 24);
  assert.equal(sound.SONG_FUTARI.bpm, 73);
  for (const kind of sound.LINE_KINDS) assert.ok(sound.LINES.zhuer[kind] >= 1, `Zhuer has a ${kind} line`);
});
