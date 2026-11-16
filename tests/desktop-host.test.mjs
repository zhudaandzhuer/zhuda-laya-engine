import test from 'node:test';
import assert from 'node:assert/strict';
import { linkFile, NO_FILE_LINKS } from './helpers/links.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import {
  stageBundle,
  resolveBundleFile,
  missingPackageMetadata,
  readPackageJson,
} from '../examples/windows-webgpu/bundle.mjs';
import { squirrelEvent, runSquirrelEvent } from '../examples/windows-webgpu/squirrel.mjs';
test('desktop stages a standalone consumer and rejects directory-index symlink escapes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-desktop-')),
    source = path.join(root, 'source'),
    dest = path.join(root, 'app/web');
  try {
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'index.html'), '<html>fixture</html>');
    fs.mkdirSync(path.join(source, 'libs'));
    fs.writeFileSync(path.join(source, 'libs/a.js'), 'window.fixture=1;');
    const manifest = stageBundle(source, dest);
    assert.equal(manifest.files.length, 2);
    fs.rmSync(source, { recursive: true });
    assert.match(fs.readFileSync(resolveBundleFile(dest, 'app://bundle/'), 'utf8'), /fixture/);
    fs.mkdirSync(path.join(dest, 'escape'));
    fs.writeFileSync(path.join(root, 'secret'), 'outside');
    assert.throws(() => resolveBundleFile(dest, 'app://evil/index.html'), /APP_PATH_ESCAPE/);
    if (linkFile(path.join(root, 'secret'), path.join(dest, 'escape/index.html'))) {
      assert.throws(() => resolveBundleFile(dest, 'app://bundle/escape/'), /APP_PATH_ESCAPE/);
      assert.throws(() => stageBundle(dest, path.join(root, 'bad')), /symlinks/);
    } else t.diagnostic('symlink escape not checked: ' + NO_FILE_LINKS);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the Windows installer metadata is present and checked before packaging (DIST-01)', () => {
  const pkg = JSON.parse(
    fs.readFileSync(new URL('../examples/windows-webgpu/package.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(missingPackageMetadata(pkg), []);
  assert.deepEqual(missingPackageMetadata({}), ['author', 'description']);
  assert.deepEqual(missingPackageMetadata({ author: { name: ' ' }, description: 'x' }), ['author']);
  assert.deepEqual(missingPackageMetadata({ author: 'A', description: '' }), ['description']);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-bom-'));
  try {
    const file = path.join(root, 'package.json');
    fs.writeFileSync(file, '\uFEFF{"author":"A","description":"B"}');
    assert.deepEqual(missingPackageMetadata(readPackageJson(file)), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a Squirrel start makes or removes shortcuts, exits, and never starts the host (DIST-02)', async () => {
  const exe = 'C:\\Users\\u\\AppData\\Local\\host\\app-1.0.0\\zhuda-windows-webgpu-host.exe';
  assert.equal(squirrelEvent([exe, '--squirrel-install', '1.0.0'], 'win32'), 'install');
  assert.equal(squirrelEvent([exe, '--squirrel-updated', '1.0.1'], 'win32'), 'updated');
  assert.equal(squirrelEvent([exe, '--squirrel-uninstall'], 'win32'), 'uninstall');
  assert.equal(squirrelEvent([exe, '--squirrel-obsolete'], 'win32'), 'obsolete');
  assert.equal(squirrelEvent([exe, '--squirrel-firstrun'], 'win32'), undefined);
  assert.equal(squirrelEvent([exe, '--verify'], 'win32'), undefined);
  assert.equal(squirrelEvent([exe, '--squirrel-install'], 'darwin'), undefined);
  const run = async (event, child) => {
    const calls = [],
      exits = [];
    const outcome = await runSquirrelEvent(event, {
      app: { exit: (code) => exits.push(code) },
      execPath: exe,
      timeoutMs: 50,
      start: (file, args) => {
        calls.push([file, args]);
        return child;
      },
    });
    return { calls, exits, outcome };
  };
  const closing = (code) => {
    const child = new EventEmitter();
    setTimeout(() => child.emit('close', code), 1);
    return child;
  };
  const update = 'C:\\Users\\u\\AppData\\Local\\host\\Update.exe';
  let r = await run('install', closing(0));
  assert.deepEqual(r.calls, [[update, ['--createShortcut=zhuda-windows-webgpu-host.exe']]]);
  assert.deepEqual(r.exits, [0]);
  assert.equal(r.outcome, 'Update.exe exit 0');
  r = await run('uninstall', closing(0));
  assert.deepEqual(r.calls, [[update, ['--removeShortcut=zhuda-windows-webgpu-host.exe']]]);
  // An Update.exe that never ends does not hold the hook past the limit.
  r = await run('updated', new EventEmitter());
  assert.match(r.outcome, /still running after 50 ms/);
  assert.deepEqual(r.exits, [0]);
  r = await run('obsolete', closing(0));
  assert.deepEqual([r.calls, r.exits], [[], [0]]);
  // The host's startup is behind the event check.
  const main = fs.readFileSync(
    new URL('../examples/windows-webgpu/main.mjs', import.meta.url),
    'utf8',
  );
  assert.ok(main.indexOf('runSquirrelEvent(squirrel') < main.indexOf('protocol.registerSchemes'));
  assert.match(main, /if \(!squirrel\) \{\s*app\s*\.whenReady\(\)/);
});
