// The 2D viewer's own checks without a browser: its library copies are current, every 2D module
// is synced here, and every preset is registered and names modules that exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(new URL('../../catalog.json', import.meta.url), 'utf8'));
const lockFile = new URL('../common-prefabs.lock.json', import.meta.url);
const lock = fs.existsSync(lockFile) ? JSON.parse(fs.readFileSync(lockFile, 'utf8')) : { modules: [] };

test('the library copies in this viewer are current (sync --check)', { skip: !lock.modules.length && 'nothing synced yet' }, () => {
  const r = spawnSync(process.execPath, [root + '../scripts/sync.mjs', root, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('every 2D module in the catalog is synced here, so the viewer builds and typechecks all of them', () => {
  for (const id of Object.keys(catalog.modules).filter((id) => id.startsWith('2d/')))
    assert.ok(lock.modules.includes(id), `${id} is not synced into viewer2d: node ../scripts/sync.mjs . ${id}`);
});

test('every preset is registered once and names modules that exist', () => {
  const src = fs.readFileSync(new URL('../src/presets.ts', import.meta.url), 'utf8');
  for (const f of fs.readdirSync(new URL('../src/presets/', import.meta.url)).filter((f) => f.endsWith('.ts'))) {
    const text = fs.readFileSync(new URL('../src/presets/' + f, import.meta.url), 'utf8');
    assert.ok(text.match(/\bid: '([^']+)'/), `${f} has an id`);
    assert.ok(src.includes(`./presets/${f}`), `${f} is imported in presets.ts`);
    const modules = [...(text.match(/modules: \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.ok(modules.length, `${f} lists its modules`);
    for (const m of modules) assert.ok(catalog.modules[m], `${f}: unknown module ${m}`);
  }
});
