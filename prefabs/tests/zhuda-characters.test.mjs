// 3d/zhuda-characters: every model in the table is there with its clips and the bones that end
// its spring chains, and the light Zhuda has the full one's skeleton and clips at a fifth of its triangles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHARACTERS, characterPath } from '../3d/zhuda-characters/zhuda-characters.ts';

function read(file) {
  const bytes = fs.readFileSync(new URL(`../3d/zhuda-characters/assets/${file}`, import.meta.url));
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  return {
    megabytes: bytes.length / 1e6,
    clips: (json.animations ?? []).map((a) => a.name),
    joints: json.skins[0].joints.map((n) => json.nodes[n].name),
    triangles: json.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + json.accessors[p.indices].count / 3, 0),
    height: Math.max(...json.meshes.flatMap((m) => m.primitives).map((p) => json.accessors[p.attributes.POSITION].max[1])),
  };
}

test('each character has its file, its clips, its spring tips and the size the table says', () => {
  for (const [id, character] of Object.entries(CHARACTERS)) {
    const model = read(character.file);
    for (const clip of character.clips) assert.ok(model.clips.includes(clip), `${id}: clip ${clip}`);
    for (const tip of character.springTips) assert.ok(model.joints.includes(tip), `${id}: bone ${tip}`);
    assert.ok(Math.abs(model.megabytes - character.megabytes) < 0.25, `${id}: ${model.megabytes.toFixed(2)} MB`);
    assert.ok(Math.abs(model.height - character.heightM) < 0.03, `${id}: ${model.height.toFixed(3)} m`);
    assert.equal(characterPath(id), `common/3d/zhuda-characters/assets/${character.file}`);
  }
});

test('the light Zhuda is the full one with fewer triangles: same joints, same clips, same height', () => {
  const full = read(CHARACTERS.zhuda.file), lite = read(CHARACTERS['zhuda-lite'].file);
  assert.deepEqual(lite.joints, full.joints);
  assert.deepEqual(lite.clips, full.clips);
  assert.equal(lite.triangles, 8990);
  assert.ok(lite.triangles < full.triangles / 5, `${lite.triangles} of ${full.triangles}`);
  assert.ok(Math.abs(lite.height - full.height) < 0.005);
});
