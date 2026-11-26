// The viewer's own checks without a browser: every preset is reachable and its library copies are current.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(new URL('../../catalog.json', import.meta.url), 'utf8'));
const lock = JSON.parse(fs.readFileSync(new URL('../common-prefabs.lock.json', import.meta.url), 'utf8'));

test('the library copies in this viewer are current (sync --check)', () => {
  const r = spawnSync(process.execPath, [root + '../scripts/sync.mjs', root, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('every 3D module in the catalog is synced here, so the viewer builds and typechecks all of them', () => {
  const threeD = Object.keys(catalog.modules).filter((id) => id.startsWith('3d/'));
  for (const id of threeD) assert.ok(lock.modules.includes(id), `${id} is not synced into viewer3d: node ../scripts/sync.mjs . ${id}`);
});

test('every preset is registered once and names modules that exist', () => {
  const src = fs.readFileSync(new URL('../src/presets.ts', import.meta.url), 'utf8');
  const files = fs.readdirSync(new URL('../src/presets/', import.meta.url)).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const text = fs.readFileSync(new URL('../src/presets/' + f, import.meta.url), 'utf8');
    const id = text.match(/\bid: '([^']+)'/)?.[1];
    assert.ok(id, `${f} has an id`);
    assert.ok(src.includes(`./presets/${f}`), `${f} is imported in presets.ts`);
    const modules = [...(text.match(/modules: \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.ok(modules.length, `${f} lists its modules`);
    for (const m of modules) assert.ok(catalog.modules[m], `${f}: unknown module ${m}`);
  }
});
