import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE_PRESET_PROFILES,
  TopologyResolver,
  ZHUDA_ENGINE_MODULES
} from '../packages/core/TopologyGraph.ts';
import { EngineGuard } from '../packages/core/RuntimeGuards.ts';

test('TopologyResolver resolves all 29 LayaAir 3.4.2 modules in strict DAG order', () => {
  const res = TopologyResolver.resolveByFeatures('all');
  assert.equal(res.orderedFiles.length, 29);
  assert.equal(res.orderedFiles[0], 'laya.core.js');

  const idx = (file) => res.orderedFiles.indexOf(file);

  // 驗證痛點一的關鍵拓撲約束
  assert.ok(idx('laya.physics2D.js') < idx('laya.box2D.js'), 'physics2D must precede box2D');
  assert.ok(idx('laya.physics2D.js') < idx('laya.tilemap.js'), 'physics2D must precede tilemap');
  assert.ok(idx('laya.bullet.js') < idx('laya.physics3D.js'), 'bullet must precede physics3D');
  assert.ok(idx('spine-core-4.2.js') < idx('laya.spine.js'), 'spine-core-4.2 must precede laya.spine');
  assert.ok(idx('laya.spine.js') < idx('laya.spine3D.js'), 'laya.spine must precede laya.spine3D');
  assert.ok(idx('laya.navMeshCommon.js') < idx('laya.navMesh2d.js'), 'navMeshCommon must precede navMesh2d');
  assert.ok(idx('laya.navMeshCommon.js') < idx('laya.navMesh3d.js'), 'navMeshCommon must precede navMesh3d');
  assert.ok(idx('laya.particleCommon.js') < idx('laya.particle.js'), 'particleCommon must precede particle');
  assert.ok(idx('laya.particleCommon.js') < idx('laya.particle3D.js'), 'particleCommon must precede particle3D');
  assert.ok(idx('laya.trailCommon.js') < idx('laya.trail2D.js'), 'trailCommon must precede trail2D');
  assert.ok(idx('laya.trailCommon.js') < idx('laya.trail3D.js'), 'trailCommon must precede trail3D');
});

test('TopologyResolver.auditFileSequence detects inverted and missing dependencies', () => {
  // 故意將 laya.box2D.js 放在 laya.physics2D.js 之前
  const brokenOrder = [
    'laya.core.js',
    'laya.webgl_2D.js',
    'laya.box2D.js',
    'laya.physics2D.js'
  ];
  const issues = TopologyResolver.auditFileSequence(brokenOrder);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'INVERTED_ORDER');
  assert.equal(issues[0].moduleFile, 'laya.box2D.js');
  assert.equal(issues[0].requiredFile, 'laya.physics2D.js');

  // 故意載入 laya.tilemap.js 卻漏掉 laya.physics2D.js
  const missingDepOrder = ['laya.core.js', 'laya.webgl_2D.js', 'laya.tilemap.js'];
  const missingIssues = TopologyResolver.auditFileSequence(missingDepOrder);
  assert.equal(missingIssues.length, 1);
  assert.equal(missingIssues[0].type, 'MISSING_DEPENDENCY');
  assert.equal(missingIssues[0].requiredFile, 'laya.physics2D.js');
});

test('TopologyResolver on-demand feature pruning reduces engine size by >80% for 2D light profile', () => {
  const light2D = TopologyResolver.resolveByFeatures(ENGINE_PRESET_PROFILES['2d-light']);
  assert.equal(light2D.orderedFiles.length, 3); // core, webgl_2D, ui
  assert.ok(light2D.prunedRatioPercent > 80, `Expected >80% saved, got ${light2D.prunedRatioPercent}%`);
});

test('EngineGuard.installPrototypeDetox patches Laya.Graphics.prototype.setState & ClassUtils.regClass', () => {
  const registeredMap = new Map();
  globalThis.Laya = {
    version: '3.4.2',
    Graphics: function () {},
    ClassUtils: {
      regClass(name, def) {
        registeredMap.set(name, def);
      },
      getClass(name) {
        return registeredMap.get(name);
      }
    }
  };

  const detox = EngineGuard.installPrototypeDetox();
  assert.equal(detox.detoxApplied, true);
  assert.equal(typeof globalThis.Laya.Graphics.prototype.setState, 'function');

  // 模擬 Laya.Button 呼叫 this._graphics.setState() 不應崩潰
  const gInstance = new globalThis.Laya.Graphics();
  assert.doesNotThrow(() => {
    gInstance.setState(1, 1.0);
  });

  // 驗證反射追蹤
  class DummyScript {}
  EngineGuard.registerComponent('DummyScript', DummyScript, 'zhuda://DummyScript');
  assert.ok(EngineGuard.getRegisteredComponents().includes('DummyScript'));
  assert.equal(globalThis.Laya.ClassUtils.getClass('DummyScript'), DummyScript);
});
