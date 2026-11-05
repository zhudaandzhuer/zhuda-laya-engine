import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeOfficialProject, resolveMiniGameToolchain, OFFICIAL_VERSION} from '../packages/compiler/minigame-toolchain.mjs';
import {auditMiniGameInputs} from '../packages/compiler/minigame-guards.mjs';

test('headless official project declares required platform config without credentials', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-mini-project-'));
  try {
    writeOfficialProject(root, 'fixture');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'zhuda.laya'))), {version: OFFICIAL_VERSION});
    const settings = JSON.parse(fs.readFileSync(path.join(root, 'settings/BuildSettings.json')));
    assert.equal(settings.oppogame.package, 'com.zhuda.minigame');
    assert.equal(settings.vivogame.minPlatformVersion, '1063');
    assert.equal(settings.xmgame.versionCode, '1');
    assert.equal(settings.wxgame.appid, 'touristappid');
  } finally { fs.rmSync(root, {recursive:true,force:true}); }
});

test('mini-game source guard reports browser APIs with a source location', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-mini-guard-'));
  const file = path.join(root, 'Main.ts');
  fs.writeFileSync(file, `import {ZhudaPointerInput} from 'zhuda-laya-engine';\nconst node = document.body;\n`);
  try {
    assert.throws(() => auditMiniGameInputs([file], root), /Main\.ts:1 \[MINIGAME_BROWSER_API\].*pointer|Main\.ts:2 \[MINIGAME_BROWSER_API\]/i);
  } finally { fs.rmSync(root, {recursive:true,force:true}); }
});

test('mini-game source guard rejects dynamic public SDK imports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-mini-dynamic-guard-'));
  const file = path.join(root, 'Main.ts');
  fs.writeFileSync(file, `const sdk = await import('zhuda-laya-engine');\nconsole.log(sdk);\n`);
  try {
    assert.throws(() => auditMiniGameInputs([file], root), /Main\.ts:1 \[MINIGAME_BROWSER_API\].*static public SDK import/i);
  } finally { fs.rmSync(root, {recursive:true,force:true}); }
});

test('toolchain resolver rejects a missing installation before invoking a build', () => {
  assert.throws(() => resolveMiniGameToolchain('/definitely/missing/layaair/3.4.2'), /ENOENT|no such file/i);
});
