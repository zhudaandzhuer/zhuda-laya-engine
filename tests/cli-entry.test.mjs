import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isMainModule } from '../packages/compiler/cli.mjs';

const repo = path.resolve(import.meta.dirname, '..');
test('all npm bins respond through symbolic links in Unicode and spaced paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda CLI 中文 '));
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(repo, 'package.json'), 'utf8'));
    for (const [name, relative] of Object.entries(pkg.bin)) {
      const target = path.join(repo, relative);
      let link = path.join(root, name);
      try {
        await fs.symlink(target, link, 'file');
      } catch (error) {
        if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
        const dir = link + '.directory';
        await fs.symlink(path.dirname(target), dir, 'junction');
        link = path.join(dir, path.basename(target));
      }
      assert.equal(isMainModule(pathToFileURL(target).href, link), true);
      const result = spawnSync(process.execPath, [link, '--help'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.equal(result.status, 0, `${name}: ${result.stderr || result.error}`);
      assert.match(result.stdout, /Usage:/i, name);
      assert.equal(result.stderr, '', name);
    }
    assert.equal(
      (await fs.readdir(root)).some((file) => file === 'dist'),
      false,
    );
    const unicode = path.join(root, '模組 file.mjs');
    await fs.writeFile(unicode, 'export const marker = true;');
    assert.equal(isMainModule(pathToFileURL(unicode).href, unicode), true);
    assert.equal(isMainModule(pathToFileURL(unicode).href, path.join(root, 'missing')), false);
    assert.equal(isMainModule(pathToFileURL(unicode).href, undefined), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('build without a project configuration fails before creating output', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-no-config-'));
  try {
    const before = await fs.readFile(path.join(repo, 'dist/sdk/zhuda-laya-engine.esm.js'));
    const result = spawnSync(
      process.execPath,
      [path.join(repo, 'packages/compiler/zhuda-build.mjs')],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing zhuda.config.json/);
    assert.deepEqual(await fs.readdir(root), []);
    assert.deepEqual(
      await fs.readFile(path.join(repo, 'dist/sdk/zhuda-laya-engine.esm.js')),
      before,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
