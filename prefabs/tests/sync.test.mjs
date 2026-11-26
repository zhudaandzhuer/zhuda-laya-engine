import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LIB = fileURLToPath(new URL('..', import.meta.url));
const SYNC = path.join(LIB, 'scripts/sync.mjs');
const catalog = JSON.parse(fs.readFileSync(path.join(LIB, 'catalog.json'), 'utf8'));
const run = (...args) => spawnSync(process.execPath, [SYNC, ...args], { encoding: 'utf8' });

test('catalog lists every library file once, and every listed file exists', () => {
  const listed = Object.values(catalog.modules).flatMap((m) => m.files);
  assert.equal(new Set(listed).size, listed.length);
  for (const f of listed) assert.ok(fs.existsSync(path.join(LIB, f)), f);
  // Shipped files: TypeScript and CSS anywhere, and everything inside a 2D, 3D or audio module's assets/
  // folder. A module's source/ (how its assets were made), preview/ pictures and notes stay
  // in the library and are not copied into games. server/ is Go, used by game servers, never synced.
  const shipped = (p) => (/\.(ts|css)$/.test(p) && !/(^|\/)(source|preview)\//.test(p)) || /^([23]d|audio)\/.*\/assets\/[^/]+(\/[^/]+)*$/.test(p);
  const onDisk = ['ui', 'input', 'systems', '3d', '2d', 'audio']
    .flatMap((dir) => fs.readdirSync(path.join(LIB, dir), { recursive: true }).map((p) => `${dir}/${p}`))
    .filter((p) => fs.statSync(path.join(LIB, p)).isFile() && !p.endsWith('.DS_Store') && shipped(p));
  assert.deepEqual(onDisk.sort(), [...listed].sort(), 'every source file belongs to a module');
  for (const [id, m] of Object.entries(catalog.modules)) for (const d of m.deps) assert.ok(catalog.modules[d], `${id} -> ${d}`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(LIB, 'package.json'), 'utf8')).version, catalog.version);
});

test('sync copies modules with their deps, records hashes, and --check finds edits', () => {
  const game = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-sync-'));
  fs.writeFileSync(path.join(game, 'package.json'), '{}');
  execFileSync(process.execPath, [SYNC, game, 'ui/dialog'], { encoding: 'utf8' });
  const lock = JSON.parse(fs.readFileSync(path.join(game, 'common-prefabs.lock.json'), 'utf8'));
  assert.deepEqual(lock.modules, ['ui/dom', 'ui/dialog']);
  assert.deepEqual(Object.keys(lock.files).sort(), ['public/common/ui/dialog/dialog.css', 'src/common/ui/dialog/dialog.ts', 'src/common/ui/dom.ts']);
  assert.match(fs.readFileSync(path.join(game, 'src/common/ui/dom.ts'), 'utf8'), /^\/\/ prefabs · ui\/dom\.ts — 複製品/);
  // an older lock version with the same content still passes, with a note
  const lockFile = path.join(game, 'common-prefabs.lock.json'), old = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  fs.writeFileSync(lockFile, JSON.stringify({ ...old, version: '0.0.1' }));
  const noted = run(game, '--check');
  assert.equal(noted.status, 0);
  assert.match(noted.stdout, /synced at 0\.0\.1/);
  fs.writeFileSync(lockFile, JSON.stringify(old));
  assert.equal(run(game, '--check').status, 0);
  // add a module: earlier ones stay
  execFileSync(process.execPath, [SYNC, game, 'systems/i18n'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(game, 'common-prefabs.lock.json'), 'utf8')).modules, ['ui/dom', 'ui/dialog', 'systems/storage', 'systems/i18n']);
  // a local edit is caught, and a plain sync puts it back
  fs.appendFileSync(path.join(game, 'src/common/ui/dom.ts'), '\n// hack\n');
  const bad = run(game, '--check');
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /differs src\/common\/ui\/dom\.ts/);
  execFileSync(process.execPath, [SYNC, game], { encoding: 'utf8' });
  assert.equal(run(game, '--check').status, 0);
  // unknown modules and non-games are refused
  assert.match(run(game, 'ui/nope').stderr, /unknown module "ui\/nope"/);
  assert.match(run(os.tmpdir() + '/definitely-not-here').stderr, /not a game client/);
  fs.rmSync(game, { recursive: true });
});

test('binary assets are copied byte for byte to public/common and checked the same way', () => {
  const game = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-sync-bin-'));
  fs.writeFileSync(path.join(game, 'package.json'), '{}');
  execFileSync(process.execPath, [SYNC, game, '3d/nature-pack'], { encoding: 'utf8' });
  const lock = JSON.parse(fs.readFileSync(path.join(game, 'common-prefabs.lock.json'), 'utf8'));
  const glb = 'public/common/3d/nature-pack/assets/fern_02.glb';
  assert.ok(lock.files[glb], 'the model is in the lock');
  assert.ok(lock.files['src/common/3d/nature-pack/nature-pack.ts']);
  const copied = fs.readFileSync(path.join(game, glb)), original = fs.readFileSync(path.join(LIB, '3d/nature-pack/assets/fern_02.glb'));
  assert.ok(copied.equals(original), 'no header, same bytes');
  assert.equal(copied.subarray(0, 4).toString('latin1'), 'glTF');
  assert.equal(run(game, '--check').status, 0);
  const bytes = Buffer.from(copied);
  bytes[bytes.length - 1] ^= 1;
  fs.writeFileSync(path.join(game, glb), bytes);
  const bad = run(game, '--check');
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /differs public\/common\/3d\/nature-pack\/assets\/fern_02\.glb/);
  fs.rmSync(game, { recursive: true });
});
