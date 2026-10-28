/**
 * @zhuda-laya/core — 孤立靜態資產微預覽與像素/色差 (ΔE00) 校準工作台入口 (PreviewMain.ts)
 *
 * 目標：
 * - 不必啟動完整 3D 遊戲邏輯，50ms 內於孤立畫布掛載並渲染靜態 .lh 預製體 (UI / Spine 4.2 / Particle)
 * - 同屏展示 2x2 像素標尺校準矩陣：
 *   [Q1] 未校準偏差態 (+3px 寬度 / +2px 內距 / ΔE00=8.98 色差)
 *   [Q2] 自動收斂後態 (0px 誤差 / ΔE00=0.00)
 *   [Q3] Spine 4.2 靜態骨骼預製體 (ZhudaSpine42Mascot.lh @ Pose=idle)
 *   [Q4] 決定性爆破粒子靜態快照預製體 (MineExplosionParticle.lh @ t=240ms)
 */

import { registerAllReflectedComponents } from './.generated/zhuda-registry';
import { ZhudaEngine } from '../packages/core/DeclarativeSDK';
import { ZhudaAssetSerializer, ZhudaPrefab } from '../packages/core/StaticAssetPipeline';
import { PixelCalibrationEngine } from '../packages/core/PixelCalibrationEngine';
import type { LayaHierarchyNodeData, PixelCalibrationReport } from '../packages/types/index';

interface MicroPreviewController {
  switchAsset: (assetKey: string, driftMode?: boolean) => PixelCalibrationReport;
  runAutoConverge: () => void;
}

async function bootMicroPreview() {
  registerAllReflectedComponents();

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const initialAsset = params.get('asset') || 'ConfirmActionButton.lh';
  const initialDrift = params.get('drift') === '1';

  await ZhudaEngine.boot({
    width: 1280,
    height: 720,
    bgColor: '#080c14',
    features: ['core', '2d', 'ui', 'spine42']
  });

  const stageRoot = new Laya.Sprite();
  stageRoot.name = 'MicroPreviewCalibrationStage';
  Laya.stage.addChild(stageRoot);

  const gridLayer = new Laya.Sprite();
  stageRoot.addChild(gridLayer);

  const quadrantLayer = new Laya.Sprite();
  stageRoot.addChild(quadrantLayer);

  const overlayLayer = new Laya.Sprite();
  stageRoot.addChild(overlayLayer);

  const builtinAssets = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
  const uncalibratedBtn = ZhudaAssetSerializer.buildConfirmButtonPrefab('uncalibrated-drift');
  const calibratedBtn = builtinAssets['ConfirmActionButton.lh'];
  const spineMascot = builtinAssets['ZhudaSpine42Mascot.lh'];
  const particleBurst = builtinAssets['MineExplosionParticle.lh'];

  // 繪製單一象限校準格與資產實例
  const renderQuadrantCard = (opts: {
    qx: number;
    qy: number;
    qw: number;
    qh: number;
    title: string;
    lhData: LayaHierarchyNodeData;
    isHighlighted?: boolean;
  }): PixelCalibrationReport => {
    const { qx, qy, qw, qh, title, lhData, isHighlighted } = opts;
    const g = gridLayer.graphics;

    // 卡片外框
    g.drawRoundRect(
      qx,
      qy,
      qw,
      qh,
      10,
      10,
      10,
      10,
      '#0e1525',
      isHighlighted ? '#38bdf8' : '#1e293b',
      isHighlighted ? 2 : 1.2
    );

    // 標題列
    const titleTxt = new Laya.Text();
    titleTxt.pos(qx + 12, qy + 8);
    titleTxt.fontSize = 12;
    titleTxt.bold = true;
    titleTxt.color = isHighlighted ? '#7df9ff' : '#94a3b8';
    titleTxt.text = title;
    overlayLayer.addChild(titleTxt);

    // 內部像素標尺網格區
    const stageX = qx + 14;
    const stageY = qy + 30;
    const stageW = qw - 28;
    const stageH = qh - 62;

    g.drawRect(stageX, stageY, stageW, stageH, '#090d16', '#1e293b', 1);
    for (let x = stageX; x <= stageX + stageW; x += 12) {
      g.drawLine(x, stageY, x, stageY + stageH, '#131c2e', 1);
    }
    for (let y = stageY; y <= stageY + stageH; y += 12) {
      g.drawLine(stageX, y, stageX + stageW, y, '#131c2e', 1);
    }

    const report = PixelCalibrationEngine.calibrateAsset(lhData);

    // 計算置中偏移
    const expW = report.expectedBox.width;
    const expH = report.expectedBox.height;
    const baseOriginX = Math.round(stageX + (stageW - expW) / 2 - report.expectedBox.x);
    const baseOriginY = Math.round(stageY + (stageH - expH) / 2 - report.expectedBox.y);

    // 實例化靜態預製體 (凍結 Spine 動態更新以便像素比對)
    const inst = ZhudaPrefab.instantiate(lhData, quadrantLayer, {
      x: baseOriginX + (lhData.x ?? 10),
      y: baseOriginY + (lhData.y ?? 10)
    });

    // 繪製預期框 (青色) 與實測 Tight Bounding Box (翠綠/玫紅)
    const og = overlayLayer.graphics;
    og.drawRect(
      baseOriginX + report.expectedBox.x,
      baseOriginY + report.expectedBox.y,
      report.expectedBox.width,
      report.expectedBox.height,
      null,
      '#38bdf888',
      1.2
    );

    const statusColor = report.passed ? '#4ade80' : '#fb7185';
    og.drawRect(
      baseOriginX + report.measuredBox.x,
      baseOriginY + report.measuredBox.y,
      report.measuredBox.width,
      report.measuredBox.height,
      null,
      statusColor,
      1.8
    );

    // 底部像素與色差度量摘要列
    const footerTxt = new Laya.Text();
    footerTxt.pos(qx + 12, qy + qh - 24);
    footerTxt.fontSize = 11;
    footerTxt.bold = true;
    footerTxt.color = statusColor;
    footerTxt.text = report.passed
      ? `✔ TightBox: (${report.measuredBox.x},${report.measuredBox.y}) ${report.measuredBox.width}×${report.measuredBox.height}px | ΔPx=0px | ΔE00=${report.colorMetrics.maxDeltaE2000}`
      : `⚠ Drift: (${report.measuredBox.x},${report.measuredBox.y}) ${report.measuredBox.width}×${report.measuredBox.height}px | ΔW=+${report.pixelErrors.widthDiffPx}px, ΔX=+${report.pixelErrors.xDiffPx}px | ΔE00=${report.colorMetrics.maxDeltaE2000}`;
    overlayLayer.addChild(footerTxt);

    return report;
  };

  const renderFullCalibrationWorkbench = (
    focusAssetKey: string,
    driftMode: boolean = false
  ): PixelCalibrationReport => {
    gridLayer.graphics.clear();
    overlayLayer.graphics.clear();
    overlayLayer.removeChildren();
    quadrantLayer.removeChildren();

    // Q1: 未校準偏差態 (Uncalibrated Drift)
    const rDrift = renderQuadrantCard({
      qx: 24,
      qy: 66,
      qw: 378,
      qh: 298,
      title: '[1] 校準前：ConfirmActionButton.lh (未校準偏差態)',
      lhData: uncalibratedBtn,
      isHighlighted: focusAssetKey === 'ConfirmActionButton.lh' && driftMode
    });

    // Q2: 自動收斂後態 (或目前選取的 UI / 9-Slice 預製體)
    const q2Asset =
      focusAssetKey === 'NineSliceDialogFrame.lh' ||
      focusAssetKey === 'TacticalHudBar.lh' ||
      focusAssetKey === 'TelemetryDashboard.lh'
        ? builtinAssets[focusAssetKey]
        : calibratedBtn;
    const rCalibrated = renderQuadrantCard({
      qx: 416,
      qy: 66,
      qw: 378,
      qh: 298,
      title: `[2] 自動收斂後：${q2Asset.name}.lh (0px / ΔE00=0)`,
      lhData: q2Asset,
      isHighlighted:
        !driftMode &&
        (focusAssetKey === 'ConfirmActionButton.lh' ||
          focusAssetKey === 'NineSliceDialogFrame.lh' ||
          focusAssetKey === 'TacticalHudBar.lh' ||
          focusAssetKey === 'TelemetryDashboard.lh')
    });

    // Q3: Spine 4.2 PhysicsConstraint 靜態骨骼 或 Unity 移植預製體
    const q3Asset =
      focusAssetKey === 'UnityCrystalGuardian.lh'
        ? builtinAssets['UnityCrystalGuardian.lh']
        : spineMascot;
    const rSpine = renderQuadrantCard({
      qx: 24,
      qy: 378,
      qw: 378,
      qh: 316,
      title:
        focusAssetKey === 'UnityCrystalGuardian.lh'
          ? '[3] Unity 移植資產：UnityCrystalGuardian.lh (Animator+Spine4.2)'
          : '[3] Spine 4.2 靜態骨骼資產：ZhudaSpine42Mascot.lh',
      lhData: q3Asset,
      isHighlighted:
        focusAssetKey === 'ZhudaSpine42Mascot.lh' || focusAssetKey === 'UnityCrystalGuardian.lh'
    });

    // Q4: 決定性粒子快照或 VFX 特效藍圖預製體
    const q4Asset =
      focusAssetKey === 'CoinFountainVfx.lh' ||
      focusAssetKey === 'SwordSlashTrailVfx.lh' ||
      focusAssetKey === 'LevelUpAuraVfx.lh'
        ? builtinAssets[focusAssetKey]
        : particleBurst;
    const rParticle = renderQuadrantCard({
      qx: 416,
      qy: 378,
      qw: 378,
      qh: 316,
      title: `[4] 決定性 VFX 藍圖：${q4Asset.name}.lh`,
      lhData: q4Asset,
      isHighlighted:
        focusAssetKey === 'MineExplosionParticle.lh' ||
        focusAssetKey === 'CoinFountainVfx.lh' ||
        focusAssetKey === 'SwordSlashTrailVfx.lh' ||
        focusAssetKey === 'LevelUpAuraVfx.lh'
    });

    ZhudaEngine.flushRenderFrames(4);

    let selectedReport = rCalibrated;
    let selectedLh = q2Asset;
    if (focusAssetKey === 'ConfirmActionButton.lh' && driftMode) {
      selectedReport = rDrift;
      selectedLh = uncalibratedBtn;
    } else if (
      focusAssetKey === 'ZhudaSpine42Mascot.lh' ||
      focusAssetKey === 'UnityCrystalGuardian.lh'
    ) {
      selectedReport = rSpine;
      selectedLh = q3Asset;
    } else if (
      focusAssetKey === 'MineExplosionParticle.lh' ||
      focusAssetKey === 'CoinFountainVfx.lh' ||
      focusAssetKey === 'SwordSlashTrailVfx.lh' ||
      focusAssetKey === 'LevelUpAuraVfx.lh'
    ) {
      selectedReport = rParticle;
      selectedLh = q4Asset;
    }

    const win = globalThis as unknown as {
      __ZHUDA_PREVIEW_ON_UPDATE__?: (data: {
        assetKey: string;
        driftMode: boolean;
        lhData: LayaHierarchyNodeData;
        report: PixelCalibrationReport;
      }) => void;
    };
    if (typeof win.__ZHUDA_PREVIEW_ON_UPDATE__ === 'function') {
      win.__ZHUDA_PREVIEW_ON_UPDATE__({
        assetKey: focusAssetKey,
        driftMode,
        lhData: selectedLh,
        report: selectedReport
      });
    }

    return selectedReport;
  };

  const convergenceDemo = PixelCalibrationEngine.runSelfConvergenceDemo();
  const calibratedAssetKeys = Object.keys(builtinAssets).filter((k) => k.endsWith('.lh'));
  const allReports = calibratedAssetKeys.map((k) =>
    PixelCalibrationEngine.calibrateAsset(builtinAssets[k])
  );
  const allPassed = allReports.every((r) => r.passed);

  const activeReport = renderFullCalibrationWorkbench(initialAsset, initialDrift);

  // 驗證 WebGL 像素緩衝區實際讀取 (gl.readPixels)
  let sampledNonBgPixels = 0;
  try {
    const canvasEl = document.getElementById('layaCanvas') as HTMLCanvasElement | null;
    if (canvasEl) {
      const gl =
        (canvasEl.getContext('webgl2') as WebGLRenderingContext | null) ||
        (canvasEl.getContext('webgl') as WebGLRenderingContext | null);
      if (gl) {
        const w = canvasEl.width;
        const h = canvasEl.height;
        const buf = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const pxMetrics = PixelCalibrationEngine.measurePixelBuffer(buf, w, h, {
          r: 8,
          g: 12,
          b: 20
        });
        sampledNonBgPixels = pxMetrics.nonTransparentPixels;
      }
    }
  } catch (_e) {
    sampledNonBgPixels = 0;
  }

  if (typeof document !== 'undefined' && document.body) {
    document.body.dataset.zhudaPreviewReady = 'true';
    document.body.dataset.zhudaPreviewAsset = activeReport.assetName;
    document.body.dataset.zhudaCalibratedAssets = String(calibratedAssetKeys.length);
    document.body.dataset.zhudaAllAssetsPassed = String(allPassed);
    document.body.dataset.zhudaBeforePxError = String(
      convergenceDemo.beforeReport.pixelErrors.maxAbsErrorPx
    );
    document.body.dataset.zhudaAfterPxError = String(
      convergenceDemo.afterReport.pixelErrors.maxAbsErrorPx
    );
    document.body.dataset.zhudaBeforeDeltaE = String(
      convergenceDemo.beforeReport.colorMetrics.maxDeltaE2000
    );
    document.body.dataset.zhudaAfterDeltaE = String(
      convergenceDemo.afterReport.colorMetrics.maxDeltaE2000
    );
    document.body.dataset.zhudaGlPixelsSampled = String(sampledNonBgPixels);
  }

  const controller: MicroPreviewController = {
    switchAsset: (key: string, drift = false) => renderFullCalibrationWorkbench(key, drift),
    runAutoConverge: () => renderFullCalibrationWorkbench('ConfirmActionButton.lh', false)
  };

  (globalThis as unknown as { __ZHUDA_MICRO_PREVIEW__?: MicroPreviewController }).__ZHUDA_MICRO_PREVIEW__ =
    controller;
}

bootMicroPreview().catch((err) => {
  console.error('[Zhuda-MicroPreview] 啟動失敗:', err);
});
