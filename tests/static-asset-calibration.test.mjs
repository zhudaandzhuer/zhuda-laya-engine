import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaAssetSerializer } from '../packages/core/StaticAssetPipeline.ts';
import { PixelCalibrationEngine } from '../packages/core/PixelCalibrationEngine.ts';

test('ZhudaAssetSerializer reverse-serializes runtime nodes into Laya 3.4.2 .lh JSON with explicit percent:false', () => {
  const mockRuntimeButton = {
    name: 'DynamicRuntimeBtn',
    x: 16,
    y: 24,
    width: 160,
    height: 48,
    mouseEnabled: true,
    graphics: {
      cmds: [
        {
          cmdID: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width: 160,
          height: 48,
          lt: 8,
          rt: 8,
          lb: 8,
          rb: 8,
          fillColor: '#1e3a5f',
          lineColor: '#3b82f6',
          lineWidth: 2
          // 模擬 runtime 未顯式設定 percent (undefined)
        }
      ]
    },
    _children: [
      {
        name: 'BtnLabel',
        x: 0,
        y: 0,
        width: 160,
        height: 48,
        text: 'START',
        fontSize: 15,
        bold: true,
        color: '#e2f1ff',
        align: 'center'
      }
    ]
  };

  const lh = ZhudaAssetSerializer.serializeNodeToHierarchy(mockRuntimeButton, {
    assetId: 'assets/prefabs/DynamicRuntimeBtn.lh',
    category: 'ui-prefab'
  });

  assert.equal(lh._$ver, 1);
  assert.equal(lh.width, 160);
  assert.equal(lh.height, 48);
  assert.equal(lh._gcmds.length, 1);
  assert.equal(lh._gcmds[0]._$type, 'DrawRoundRectCmd');
  assert.equal(
    lh._gcmds[0].percent,
    false,
    'Must explicitly set percent:false to prevent Laya 3.4.2 DrawRoundRectCmd 100x scaling trap'
  );
  assert.equal(lh._$child.length, 1);
  assert.equal(lh._$child[0]._$type, 'Text');
  assert.equal(lh._$child[0].text, 'START');
});

test('PixelCalibrationEngine detects +3px width drift and ΔE00 color drift and auto-converges to 0px / ΔE00=0', () => {
  const convergence = PixelCalibrationEngine.runSelfConvergenceDemo();

  // 校準前：存在 +2px X 偏移、+3px 寬度偏差與明顯色差
  assert.equal(convergence.beforeReport.passed, false);
  assert.equal(convergence.beforeReport.pixelErrors.xDiffPx, 2);
  assert.equal(convergence.beforeReport.pixelErrors.widthDiffPx, 3);
  assert.equal(convergence.beforeReport.pixelErrors.maxAbsErrorPx, 3);
  assert.ok(convergence.beforeReport.colorMetrics.maxDeltaE2000 > 5.0);
  assert.ok(convergence.appliedPatches.length >= 4);

  // 套用 AutoFixPatch 後：100% 收斂為 0px 誤差與 ΔE00 = 0
  assert.equal(convergence.afterReport.passed, true);
  assert.equal(convergence.afterReport.pixelErrors.maxAbsErrorPx, 0);
  assert.equal(convergence.afterReport.colorMetrics.maxDeltaE2000, 0);
});

test('All 10 builtin static prefabs (UI, 9-Slice, Spine 4.2 Rig, 4 VFX Blueprints, Unity Migrated Prefab) pass calibration', () => {
  const assets = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
  const prefabNames = [
    'ConfirmActionButton.lh',
    'NineSliceDialogFrame.lh',
    'TacticalHudBar.lh',
    'ZhudaSpine42Mascot.lh',
    'MineExplosionParticle.lh',
    'CoinFountainVfx.lh',
    'SwordSlashTrailVfx.lh',
    'LevelUpAuraVfx.lh',
    'UnityCrystalGuardian.lh',
    'TelemetryDashboard.lh'
  ];

  for (const name of prefabNames) {
    const lh = assets[name];
    assert.ok(lh, `Asset ${name} should exist`);
    const report = PixelCalibrationEngine.calibrateAsset(lh);
    assert.equal(report.passed, true, `${name} should pass pixel & ΔE00 calibration`);
    assert.equal(report.pixelErrors.maxAbsErrorPx, 0, `${name} should have 0px bounding box error`);
    assert.equal(report.colorMetrics.maxDeltaE2000, 0, `${name} should have 0 ΔE00 color error`);
  }

  // 檢查 Spine 4.2 預製體與粒子預製體皆掛載對應反射組件
  assert.equal(assets['ZhudaSpine42Mascot.lh']._$comp[0]._$type, 'Spine42PhysicsRigComponent');
  assert.equal(assets['MineExplosionParticle.lh']._$comp[0]._$type, 'ZhudaParticleEmitterComponent');
});

test('PixelCalibrationEngine scans RGBA pixel buffers for tight bounding box and dominant hex color', () => {
  const width = 40;
  const height = 30;
  const rgba = new Uint8ClampedArray(width * height * 4);
  // 背景填充 #0b0f17 (11, 15, 23, 255)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = 11;
    rgba[i * 4 + 1] = 15;
    rgba[i * 4 + 2] = 23;
    rgba[i * 4 + 3] = 255;
  }
  // 在 (5, 6) 到 (24, 15) 繪製 20x10 矩形，顏色 #3b82f6 (59, 130, 246)
  for (let y = 6; y < 16; y++) {
    for (let x = 5; x < 25; x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 59;
      rgba[idx + 1] = 130;
      rgba[idx + 2] = 246;
      rgba[idx + 3] = 255;
    }
  }

  const metrics = PixelCalibrationEngine.measurePixelBuffer(rgba, width, height);
  assert.deepEqual(metrics.tightBox, { x: 5, y: 6, width: 20, height: 10 });
  assert.equal(metrics.nonTransparentPixels, 200);
  assert.equal(metrics.sampledDominantHex, '#3b82f6');
});
