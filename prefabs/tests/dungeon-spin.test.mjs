// 2d/dungeon-spin and 2d/prefab-atlas without a browser: the original game's own tests
// (tests/math-fixtures.test.mjs, tests/consumer-boundary.test.mjs, scripts/verify-assets.mjs
// of games/dungeon-spin/client), plus the paylines against the game's line table.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = fileURLToPath(new URL('..', import.meta.url));
const MOD = path.join(LIB, '2d/dungeon-spin');
const { MathEngine, PAYLINES, FIXTURE_TRUTHS } = await import('../2d/dungeon-spin/math.ts');
const catalog = JSON.parse(fs.readFileSync(path.join(LIB, 'catalog.json'), 'utf8'));
const shipped = (id) => catalog.modules[id].files.filter((f) => f.endsWith('.ts')).map((f) => [f, fs.readFileSync(path.join(LIB, f), 'utf8')]);

// --- from math-fixtures.test.mjs ---
test('fixed fixtures resolve without mutating their boards', () => {
  const first = MathEngine.resolve('three', 10);
  const second = MathEngine.resolve('three', 10);
  assert.equal(first.p.totalBet, 90);
  assert.equal(first.p.mainWin, 100);
  assert.deepEqual(first.p, second.p);
  first.p.board[0] = 99;
  assert.equal(second.p.board[0], 3);
});

test('boss fixture scales main and bonus outcomes', () => {
  const result = MathEngine.resolve('boss', 20);
  assert.equal(result.p.totalBet, 180);
  assert.equal(result.p.mainWin, 1700);
  assert.equal(result.b.total, 90720);
  assert.equal(result.b.beats[0].isFull, true);
});

test('unknown fixture uses the documented multi-line fallback', () => {
  const result = MathEngine.resolve('unknown', 10);
  assert.equal(result.p.attack, '召喚・萬刃橫掃');
  assert.equal(result.p.awards.length, 4);
});

// --- the tables behind the fixtures ---
test('the 18 paylines are the game line table (source/math/runtime-lines.tsv), each with its reverse', () => {
  const rows = fs.readFileSync(path.join(MOD, 'source/math/runtime-lines.tsv'), 'utf8').split(/\r?\n/).slice(2).filter((l) => l.trim());
  assert.deepEqual(PAYLINES, rows.map((l) => l.split('\t')[2].split(',').map(Number)));
  for (let i = 0; i < 18; i += 2) assert.deepEqual(PAYLINES[i + 1], [...PAYLINES[i]].reverse());
  assert.ok(PAYLINES.flat().every((c) => c >= 0 && c < 15));
});

test('every fixture: 15 symbols 0..8, wins scale with the bet, bonus beats add up to the bonus', () => {
  assert.deepEqual(Object.keys(FIXTURE_TRUTHS), ['three', 'empty', 'multi', 'five', 'four', 'full', 'group', 'word', 'boss', 'allzero']);
  for (const [key, f] of Object.entries(FIXTURE_TRUTHS)) {
    assert.equal(f.board.length, 15, key);
    assert.ok(f.board.every((s) => s >= 0 && s <= 8), key);
    for (const bet of [10, 20, 50]) {
      const { p, b } = MathEngine.resolve(key, bet);
      assert.equal(p.totalBet, bet * 9);
      assert.equal(p.mainWin, (f.baseMainWin * bet) / 10);
      assert.equal(b.total, (f.baseBonusWin * bet) / 10);
      if (b.beats.length) assert.equal(b.beats.at(-1).cumulative, b.total, `${key} ${bet}`);
      assert.equal(p.opportunities > 0, b.beats.length > 0, key);
    }
  }
  // the awards are the win split evenly (rounded), not per-line pays: 12030 / 4
  assert.deepEqual(MathEngine.resolve('multi', 10).p.awards.map((a) => a.amount), [3008, 3008, 3008, 3008]);
});

// --- from consumer-boundary.test.mjs ---
test('the modules stay on the public SDK boundary', () => {
  const files = [...shipped('2d/dungeon-spin'), ...shipped('2d/prefab-atlas')];
  const source = files.map(([, text]) => text).join('\n');
  assert.doesNotMatch(source, /packages\/core|packages\/types|vendor\//);
  assert.doesNotMatch(source, /declare\s+const\s+Laya\s*:\s*any/);
  assert.match(source, /from\s+["']zhuda-laya-engine["']/);
  for (const [file, text] of files)
    for (const [, spec] of text.matchAll(/from\s+["']([^"']+)["']/g)) assert.ok(spec === 'zhuda-laya-engine' || spec.startsWith('.'), `${file} imports ${spec}`);
  const code = source.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /__DUNGEON_GAME__/, 'no reaching through a window global');
  // the rules and the runtime need no engine
  for (const [file, text] of [...shipped('systems/slot-round'), [path.join('2d/dungeon-spin/math.ts'), fs.readFileSync(path.join(MOD, 'math.ts'), 'utf8')]])
    assert.doesNotMatch(text, /zhuda-laya-engine|\bLaya\./, file);
});

test('the prefab manifest covers every shipped visual source, with the right sizes and hashes', () => {
  const prefabs = fs.readFileSync(path.join(MOD, 'prefabs.ts'), 'utf8');
  const entries = [...prefabs.matchAll(/\{ id: "([^"]+)", kind: "(\w+)", bytes: (\d+), sha256: "([0-9a-f]{64})" \}/g)].map((m) => ({ id: m[1], kind: m[2], bytes: Number(m[3]), sha256: m[4] }));
  const assets = catalog.modules['2d/dungeon-spin'].files.filter((f) => f.includes('/assets/')).map((f) => f.slice('2d/dungeon-spin/assets/'.length));
  assert.deepEqual(entries.map((e) => e.id).sort(), assets.sort(), 'every shipped asset is in the manifest and nothing else');
  for (const e of entries) {
    const bytes = fs.readFileSync(path.join(MOD, 'assets', e.id));
    assert.equal(bytes.length, e.bytes, e.id);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), e.sha256, e.id);
  }
  // each definition's .lh is listed, and names the one texture the definition declares
  for (const [, id, asset, texture] of prefabs.matchAll(/id: "(visual\/[^"]+)",\s*asset: "([^"]+)",\s*textures: \["([^"]+)"\]/g)) {
    const lh = JSON.parse(fs.readFileSync(path.join(MOD, 'assets', asset), 'utf8'));
    assert.equal(lh._$child[0].skin, texture, id);
    assert.ok(entries.some((e) => e.id === texture), texture);
  }
  for (const id of ['template-v2.png', 'creatures-v3.png', 'hero-actions-v4.png']) assert.match(prefabs, new RegExp(`id: "${id}"`));
});

test('the scene mounts every checked prefab through the shared library', () => {
  const source = fs.readFileSync(path.join(MOD, 'dungeon-spin.ts'), 'utf8');
  assert.match(source, /instantiate\(\s*'visual\/template-background'/);
  for (const id of ['visual/creatures-atlas', 'visual/hero-actions']) assert.match(source, new RegExp(`mountAtlasPrefab\\(this\\.prefabLibrary,\\s*'${id}'`));
  const all = shipped('2d/dungeon-spin').map(([, t]) => t).join('\n');
  assert.doesNotMatch(all, /TextureStore|Laya\.loader\.getRes|Laya\.loader\.load|new DirectoryAssetProvider\([^)]*'\.\/assets\//);
  assert.equal((all.match(/new DirectoryAssetProvider/g) || []).length, 1, 'one provider factory');
});
