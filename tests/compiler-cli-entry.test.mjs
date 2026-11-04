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

test('consumer init executes through an installed bin symlink and refuses to overwrite existing files', () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zhuda-init-bin-'));
  try {
    const bin=path.join(temp,'zhuda-laya-init');
    fs.symlinkSync(path.join(root,'packages/compiler/zhuda-init.mjs'),bin);
    const destination=path.join(temp,'consumer');
    const args=[bin,destination,'--engine','1.3.0'];
    const result=spawnSync(process.execPath,args,{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.ok(fs.existsSync(path.join(destination,'package.json')));
    const original=fs.readFileSync(path.join(destination,'src/Main.ts'),'utf8');
    assert.notEqual(spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);
    assert.equal(fs.readFileSync(path.join(destination,'src/Main.ts'),'utf8'),original);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
