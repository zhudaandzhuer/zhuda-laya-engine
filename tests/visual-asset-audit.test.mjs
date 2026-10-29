import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditVisualAssetMigration } from '../packages/compiler/visual-asset-audit.mjs';
import { SpineVisualContract } from '../packages/core/SpineVisualContract.ts';

function write(root, relative, contents) {
  const filePath = path.join(root, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

test('visual audit compares Spine semantics and reports Unity wrapper contracts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-visual-audit-'));
  const source = path.join(root, 'unity');
  const target = path.join(root, 'laya');
  const spine = JSON.stringify({
    skeleton: { spine: '4.2.43', hash: 'fixture', width: 100, height: 200 },
    bones: [{ name: 'root' }, { name: 'fx' }],
    slots: [{ name: 'fx-slot', bone: 'fx' }],
    skins: [{ name: 'default', attachments: {} }],
    animations: { Hero_idle: {}, Hero_win: {} }
  });
  write(source, 'Assets/Animation/Hero/Hero.json', spine);
  write(source, 'Assets/Animation/Hero/Hero.atlas.txt', 'Hero.png\nsize: 64,64\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\nhero\n  bounds: 0,0,32,32\n');
  write(source, 'Assets/Animation/Hero/Hero.png', 'same-texture');
  write(source, 'Assets/Animation/Hero/Ani_Hero_idle.anim', 'm_Name: Ani_Hero_idle\n');
  write(source, 'Assets/Animation/Hero/Hero_Additive.mat', 'm_Name: Hero_Additive\n');
  write(target, 'assets/spine/Hero/Hero.json', spine);
  write(target, 'assets/spine/Hero/Hero.atlas', 'Hero.png\nsize: 64,64\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\nhero\n  bounds: 0,0,32,32\n');
  write(target, 'assets/spine/Hero/Hero.png', 'same-texture');

  const report = auditVisualAssetMigration({ sourceRoot: source, targetRoot: target });
  assert.equal(report.passed, true);
  assert.equal(report.coverage.spine.ratio, 1);
  assert.equal(report.coverage.atlases.ratio, 1);
  assert.equal(report.coverage.animationWrappers.ratio, 1);
  assert.equal(report.coverage.materialsRequiringContract, 1);
  assert.equal(report.summary.warningCount, 1);

  const strictReport = auditVisualAssetMigration({ sourceRoot: source, targetRoot: target, strict: true });
  assert.equal(strictReport.passed, false);
  assert.ok(strictReport.issues.some((issue) => issue.category === 'material-contract'));

  write(target, 'visual-migration-manifest.json', JSON.stringify({
    schemaVersion: 1,
    materials: [{
      sourcePath: 'Assets/Animation/Hero/Hero_Additive.mat',
      targetMaterial: 'SpineStandard',
      blendMode: 'additive'
    }]
  }));
  const mappedStrictReport = auditVisualAssetMigration({ sourceRoot: source, targetRoot: target, strict: true });
  assert.equal(mappedStrictReport.passed, true);
  assert.equal(mappedStrictReport.contract.loaded, true);
  assert.equal(mappedStrictReport.parity.materials[0].status, 'mapped-by-contract');
});

test('visual audit blocks missing Spine animation data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-visual-audit-mismatch-'));
  const source = path.join(root, 'unity');
  const target = path.join(root, 'laya');
  write(source, 'Assets/Animation/Hero/Hero.json', JSON.stringify({ skeleton: { spine: '4.2.43' }, animations: { Hero_idle: {}, Hero_win: {} } }));
  write(target, 'assets/spine/Hero/Hero.json', JSON.stringify({ skeleton: { spine: '4.2.43' }, animations: { Hero_idle: {} } }));
  const report = auditVisualAssetMigration({ sourceRoot: source, targetRoot: target });
  assert.equal(report.passed, false);
  assert.ok(report.parity.spine[0].missingAnimations.includes('Hero_win'));
});

test('SpineVisualContract rejects fallback objects and missing presentation data', () => {
  const spec = {
    assetId: 'Hero',
    runtimeVersion: '4.2',
    requiredAnimations: ['Hero_idle', 'Hero_win'],
    requiredSkins: ['default'],
    requiredSlots: ['fx-slot'],
    requiredPhysicsConstraints: 1
  };
  const fallback = SpineVisualContract.validate({}, spec);
  assert.equal(fallback.passed, false);
  assert.match(fallback.issues[0], /not a Spine templet/);

  const incomplete = SpineVisualContract.validate({
    version: '4.2.43',
    buildArmature() {},
    getAnimationNames() { return ['Hero_idle']; },
    getSkinNames() { return ['default']; },
    getSlotNames() { return ['fx-slot']; },
    physicsConstraints: 0,
    width: 100,
    height: 200
  }, spec);
  assert.equal(incomplete.passed, false);
  assert.deepEqual(incomplete.missingAnimations, ['Hero_win']);
  assert.match(incomplete.issues.join(' '), /Physics constraints/);

  const complete = SpineVisualContract.validate({
    version: '4.2.43',
    buildArmature() {},
    getAnimationNames() { return ['Hero_idle', 'Hero_win']; },
    getSkinNames() { return ['default']; },
    getSlotNames() { return ['fx-slot']; },
    physicsConstraints: 1,
    width: 100,
    height: 200
  }, spec);
  assert.equal(complete.passed, true);
});

