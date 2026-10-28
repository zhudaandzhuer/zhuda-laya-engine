import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaUI } from '../packages/core/DeclarativeSDK.ts';
import { ZhudaAssetSerializer } from '../packages/core/StaticAssetPipeline.ts';
import { PixelCalibrationEngine } from '../packages/core/PixelCalibrationEngine.ts';
import { IframeSoundAdapter } from '../packages/core/IframeSoundAdapter.ts';
import { ViewportMatrixEngine } from '../packages/core/ViewportMatrixEngine.ts';
import {
  UNITY_CYBER_SHRINE_SCENE,
  UnityAnimatorStateMachine,
  UnityBridgePipeline
} from '../packages/core/UnityBridgePipeline.ts';

test('Direction 1 (M1): 9-Slice (sizeGrid) locks 4 corners at 16x16px with 0px distortion across arbitrary stretches', () => {
  const parsed = ZhudaUI.parseSizeGrid('16,16,16,16,0');
  assert.deepEqual(parsed, [16, 16, 16, 16, 0]);
  assert.equal(ZhudaUI.formatSizeGrid([16, 16, 16, 16, 0]), '16,16,16,16,0');

  // 測試 2.0x 寬度與 1.75x 高度拉伸 (320x140)
  const dialog320 = ZhudaAssetSerializer.buildNineSliceDialogPrefab(320, 140);
  const report320 = PixelCalibrationEngine.verifyNineSliceIntegrity(dialog320);
  assert.equal(report320.passed, true);
  assert.equal(report320.stretchRatioX, 2.0);
  assert.equal(report320.stretchRatioY, 1.75);
  assert.equal(report320.maxCornerDistortionPx, 0);
  assert.deepEqual(report320.cornerPins.topLeft, { x: 0, y: 0, width: 16, height: 16 });
  assert.deepEqual(report320.cornerPins.bottomRight, { x: 304, y: 124, width: 16, height: 16 });

  // 測試 3.0x 寬度與 2.5x 高度極限拉伸 (480x200)
  const dialog480 = ZhudaAssetSerializer.buildNineSliceDialogPrefab(480, 200);
  const report480 = PixelCalibrationEngine.verifyNineSliceIntegrity(dialog480);
  assert.equal(report480.passed, true);
  assert.equal(report480.stretchRatioX, 3.0);
  assert.equal(report480.stretchRatioY, 2.5);
  assert.equal(report480.maxCornerDistortionPx, 0);
  assert.deepEqual(report480.cornerPins.bottomRight, { x: 464, y: 184, width: 16, height: 16 });
});

test('Direction 1 (M2): IframeSoundAdapter handles pre-gesture queue, auto-unlock, blur suspend, and postMessage bridge', () => {
  const adapter = new IframeSoundAdapter();

  // 1. 手勢解鎖前排程音效，應記錄入列且不崩潰
  const scheduled = adapter.scheduleTone({
    id: 'test-pre-unlock',
    channel: 'sfx',
    startFreq: 520,
    durationSec: 0.05
  });
  assert.equal(scheduled, true);
  assert.equal(adapter.getDiagnostics().queuedBeforeUnlockCount, 1);

  // 2. 觸發首觸手勢解鎖
  const unlocked = adapter.unlockAudio('pointerdown');
  assert.equal(unlocked, true);
  assert.equal(adapter.getDiagnostics().unlockedByGesture, true);
  assert.equal(adapter.getDiagnostics().unlockGestureType, 'pointerdown');

  // 3. 模擬 iframe 失焦 / 切出背景分頁 -> 自動靜音保護
  adapter.handleFocusOrVisibilityChange(false, false);
  assert.equal(adapter.getDiagnostics().autoSuspendedByBlur, true);
  assert.equal(
    adapter.scheduleTone({ id: 'blocked-while-blurred', startFreq: 440, durationSec: 0.05 }),
    false
  );

  // 4. 模擬焦點恢復
  adapter.handleFocusOrVisibilityChange(true, true);
  assert.equal(adapter.getDiagnostics().autoSuspendedByBlur, false);

  // 5. 模擬母平台透過 postMessage Bridge 控制音量與靜音
  adapter.handleBridgeMessage({ type: 'zhuda:audio:setVolume', channel: 'bgm', volume: 0.35 });
  assert.equal(adapter.getChannelVolume('bgm'), 0.35);

  adapter.handleBridgeMessage({ type: 'zhuda:audio:mute' });
  assert.equal(adapter.isMuted(), true);

  adapter.handleBridgeMessage({ type: 'zhuda:audio:unmute' });
  assert.equal(adapter.isMuted(), false);
});

test('Direction 2 (M3 & M4): Multi-Resolution SafeArea Matrix (5 devices) and 4 VFX Static Blueprints pass audit', () => {
  const matrix = ViewportMatrixEngine.auditAllViewportProfiles();
  assert.equal(matrix.totalProfiles, 5);
  assert.equal(matrix.allPassed, true);

  // 驗證 iPhone 15 Pro 直向 (393x852, Dynamic Island top=59, bottom=34) 具備 3D FOV 補償且不越界
  const portraitReport = ViewportMatrixEngine.computeLayoutForDevice('iphone-15-pro-portrait');
  assert.equal(portraitReport.orientation, 'portrait');
  assert.equal(portraitReport.safeAreaCompliant, true);
  assert.equal(portraitReport.zeroOverflowPassed, true);
  assert.ok(
    portraitReport.recommendedCameraFov > 45,
    'Portrait narrow screen should auto-widen vertical FOV to prevent 3D board horizontal clipping'
  );
  assert.ok(portraitReport.hudTopBarRect.y >= 59, 'HUD must respect Dynamic Island 59px top inset');

  // 驗證 4 套 VFX 靜態藍圖皆具備決定性快照與 0px / ΔE00=0
  const assets = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
  const vfxFiles = [
    'MineExplosionParticle.lh',
    'CoinFountainVfx.lh',
    'SwordSlashTrailVfx.lh',
    'LevelUpAuraVfx.lh'
  ];
  for (const vf of vfxFiles) {
    const report = PixelCalibrationEngine.calibrateAsset(assets[vf]);
    assert.equal(report.passed, true, `VFX blueprint ${vf} must pass 0px / ΔE00 calibration`);
    assert.equal(assets[vf]._$comp[0]._$type, 'ZhudaParticleEmitterComponent');
  }
});

test('Direction 3 (M5): Unity Scene + AnimatorController + Spine 4.2 migration converts LH->RH and transitions states accurately', () => {
  // 1. 驗證 Unity 左手座標系 (LH) 至 LayaAir 3.4.2 右手座標系 (RH) 轉換
  assert.deepEqual(UnityBridgePipeline.convertPositionLHtoRH([-2.2, 1.8, 1.5]), [2.2, 1.8, 1.5]);
  assert.deepEqual(UnityBridgePipeline.convertEulerLHtoRH([15, 45, 15]), [15, -45, -15]);

  // 2. 驗證完整場景轉換與 AnimatorController 狀態機過渡軌跡 (Idle -> Charge -> Burst -> Idle)
  const migrationReport = UnityBridgePipeline.runFullMigrationVerification(UNITY_CYBER_SHRINE_SCENE);
  assert.equal(migrationReport.passed, true);
  assert.equal(migrationReport.convertedNodesCount, 5);
  assert.deepEqual(migrationReport.animatorVerification.simulatedTransitionTrace, [
    'Idle',
    'Charge',
    'Burst',
    'Idle'
  ]);
  assert.equal(migrationReport.spine42Verification.physicsConstraintsMounted, 2);

  // 3. 驗證轉換後之 UnityCrystalGuardian.lh 預製體通過 0px 像素與色差校準
  const unityLh = UnityBridgePipeline.buildUnityCrystalGuardianPrefab();
  const calib = PixelCalibrationEngine.calibrateAsset(unityLh);
  assert.equal(calib.passed, true);
  assert.equal(calib.pixelErrors.maxAbsErrorPx, 0);
  assert.equal(calib.colorMetrics.maxDeltaE2000, 0);
  assert.equal(unityLh._$comp[0]._$type, 'ZhudaAnimatorControllerComponent');
});
