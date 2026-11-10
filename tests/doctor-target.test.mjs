import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initConsumer } from '../packages/compiler/zhuda-init.mjs';

const cli = path.resolve('packages/compiler/zhuda-doctor.mjs');
test('Doctor defaults to consumer cwd, reports its path and fails deliberate bad source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-target-'));
  try {
    const game = path.join(root, 'game');
    initConsumer({ target: game, engine: '1.3.0' });
    const run = (...args) =>
      spawnSync(process.execPath, [cli, ...args], { cwd: game, encoding: 'utf8' });
    let result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(result.stdout.includes(game));
    assert.match(result.stdout, /掃描 TS 檔案數: 1/);
    fs.appendFileSync(path.join(game, 'src/Main.ts'), '\ndeclare const Laya: any;\n');
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stdout, /UNTYPED_LAYA.*src[\\/]Main\.ts:\d+/);
    assert.match(result.stdout, /new Laya.Vector3/);
    assert.equal(run('--project').status, 1);
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    result = run('--project', empty);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /EMPTY_SOURCE_SCAN/);
    assert.ok(result.stdout.includes(empty));
    result = run('--project', path.join(root, 'missing'));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /EMPTY_SOURCE_SCAN/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
