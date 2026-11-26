// audio/casual-sfx: every id has its file, every file has its id, and each is a real .m4a.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CASUAL_SFX, CASUAL_SFX_IDS, casualSfxPath } from '../audio/casual-sfx/casual-sfx.ts';

const dir = new URL('../audio/casual-sfx/assets/', import.meta.url);

test('the list and the folder hold the same forty-one sounds', () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.m4a')).map((f) => f.slice(0, -4)).sort();
  assert.equal(CASUAL_SFX_IDS.length, 41);
  assert.equal(new Set(CASUAL_SFX_IDS).size, 41, 'no id twice');
  assert.deepEqual([...CASUAL_SFX_IDS].sort(), files);
  assert.deepEqual(Object.keys(CASUAL_SFX), ['interface', 'reward', 'reaction', 'event', 'ambience']);
});

test('each file is an MPEG-4 audio container of a sensible size', () => {
  for (const id of CASUAL_SFX_IDS) {
    const bytes = fs.readFileSync(new URL(`${id}.m4a`, dir));
    assert.equal(bytes.subarray(4, 8).toString('latin1'), 'ftyp', id);
    assert.ok(bytes.length > 1500 && bytes.length < 120_000, `${id}: ${bytes.length} bytes`);
  }
});

test('the path is where the sync puts the file', () => {
  assert.equal(casualSfxPath('ui_click'), 'common/audio/casual-sfx/assets/ui_click.m4a');
  assert.equal(casualSfxPath('coin', '../'), '../common/audio/casual-sfx/assets/coin.m4a');
});
