import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

test('Doctor executes when invoked through a node_modules bin-style symlink', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-cli-'));
  const bin = path.join(temp, 'zhuda-laya-doctor');
  fs.symlinkSync(path.join(root, 'packages/compiler/zhuda-doctor.mjs'), bin);
  const result = spawnSync(process.execPath, [bin, '--project', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /HEALTHY/);
  fs.rmSync(temp, { recursive: true, force: true });
});
