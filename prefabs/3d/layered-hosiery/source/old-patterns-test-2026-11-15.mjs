// The stocking catalogue and its tiles: every kind can be torn, has colours, and its tile is sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, COLORS, tileOf, knitTile, netTile } from '../src/patterns.ts';

test('every kind can be torn before the pull runs out, and names known colours', () => {
  const ids = new Set();
  for (const type of TYPES) {
    assert.ok(!ids.has(type.id), `duplicate ${type.id}`);
    ids.add(type.id);
    assert.ok(type.tearAt > 0.5 && type.tearAt <= 1.1, `${type.id} tearAt ${type.tearAt}`);
    assert.ok(type.colors.length > 0 && type.colors.every((c) => c in COLORS), `${type.id} colours`);
    assert.ok(type.ladder >= 0 && type.ladder <= 1 && type.holeSize > 0);
    if (type.lace) assert.ok(type.lace[0] < type.lace[1] && type.lace[1] < 1);
  }
  assert.equal(TYPES.length, 15);
});

test('tiles are 128 square, the same every time, and a net has open holes', () => {
  for (const type of TYPES) {
    const tile = tileOf(type);
    assert.equal(tile.pixels.length, 128 * 128 * 4);
  }
  assert.deepEqual(knitTile(1).pixels, knitTile(1).pixels);
  const net = netTile(0.045).pixels;
  let open = 0;
  for (let i = 2; i < net.length; i += 4) if (net[i] < 8) open++;
  assert.ok(open / (128 * 128) > 0.5, `open share ${open / 16384}`);
  const knit = knitTile(1).pixels;
  let solid = 0;
  for (let i = 2; i < knit.length; i += 4) if (knit[i] > 64) solid++;
  assert.ok(solid / (128 * 128) > 0.2);
});
