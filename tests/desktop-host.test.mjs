import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageBundle, resolveBundleFile } from '../examples/windows-webgpu/bundle.mjs';
test('desktop stages a standalone consumer and rejects directory-index symlink escapes', () => {
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
    fs.symlinkSync(path.join(root, 'secret'), path.join(dest, 'escape/index.html'));
    assert.throws(() => resolveBundleFile(dest, 'app://bundle/escape/'), /APP_PATH_ESCAPE/);
    assert.throws(() => resolveBundleFile(dest, 'app://evil/index.html'), /APP_PATH_ESCAPE/);
    assert.throws(() => stageBundle(dest, path.join(root, 'bad')), /symlinks/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
