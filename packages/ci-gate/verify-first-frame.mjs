// @zhuda-laya/ci-gate — Headless Chrome First-Frame & Telemetry Gate
// 使用受管理無頭瀏覽器啟動器 (/Users/yaowei/ZhudaAI/scripts/run-headless-chrome.mjs)
// 自動驗證 WebGL 首幀渲染、29 模組拓撲載入、AST 自動反射、Spine 4.2 PhysicsConstraint 與自動截圖

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const headlessRunner = '/Users/yaowei/ZhudaAI/scripts/run-headless-chrome.mjs';

export function runFirstFrameGate(targetUrl = 'http://127.0.0.1:8890/') {
  console.log(`\n🛡️ [Zhuda CI-Gate] 啟動 Headless Chrome 首幀與執行期守衛 (${targetUrl})...`);

  // 1. 傾印渲染後 DOM 並解析 data-zhuda-* 遙測屬性 (含冷啟動重試保護)
  let domOutput = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    domOutput = execFileSync(
      'node',
      [
        headlessRunner,
        '--window-size=1280,720',
        '--virtual-time-budget=5500',
        '--dump-dom',
        targetUrl
      ],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );
    if (domOutput.includes('data-zhuda-booted="true"')) break;
  }

  const extractAttr = (attr) => {
    const m = domOutput.match(new RegExp(`${attr}="([^"]*)"`));
    return m ? m[1].replace(/&gt;/g, '>') : null;
  };

  const telemetry = {
    booted: extractAttr('data-zhuda-booted') === 'true',
    modulesCount: Number(extractAttr('data-zhuda-modules') || 0),
    reflectedComponents: (extractAttr('data-zhuda-reflected') || '').split(',').filter(Boolean),
    spine42Ready: extractAttr('data-zhuda-spine42') === 'true',
    prototypeDetoxActive: extractAttr('data-zhuda-detox') === 'true',
    tileNodes3D: Number(extractAttr('data-zhuda-tiles') || 0),
    revealedCells: Number(extractAttr('data-zhuda-revealed') || 0),
    estimatedDrawCalls: Number(extractAttr('data-zhuda-drawcalls') || 0),
    stageChildren: Number(extractAttr('data-zhuda-stage-children') || 0),
    staticAssetsCount: Number(extractAttr('data-zhuda-static-assets') || 0),
    calibratedDeltaE: Number(extractAttr('data-zhuda-calibrated-delta-e') || 0),
    prefabAssembled: extractAttr('data-zhuda-prefab-assembled') === 'true',
    nineSlicePassed: extractAttr('data-zhuda-nine-slice-passed') === 'true',
    iframeAudioReady: extractAttr('data-zhuda-iframe-audio') === 'ready',
    viewportProfilesCount: Number(extractAttr('data-zhuda-viewport-profiles') || 0),
    safeAreaPassed: extractAttr('data-zhuda-safearea-passed') === 'true',
    vfxBlueprintsCount: Number(extractAttr('data-zhuda-vfx-blueprints') || 0),
    unityMigratedPassed: extractAttr('data-zhuda-unity-migrated') === 'true',
    unityAnimatorTrace: extractAttr('data-zhuda-unity-animator-trace') || '',
    hasLayaCanvas: domOutput.includes('id="layaCanvas"')
  };

  // 2. 擷取首幀視覺驗收截圖 (含冷載入重試保護)
  const screenshotPath = path.join(projectRoot, 'dist/first-frame-gate.png');
  let screenshotSizeKB = 0;
  for (let attempt = 1; attempt <= 5; attempt++) {
    execFileSync(
      'node',
      [
        headlessRunner,
        '--window-size=1280,720',
        `--virtual-time-budget=${5500 + attempt * 1500}`,
        `--screenshot=${screenshotPath}`,
        targetUrl
      ],
      { stdio: 'pipe' }
    );
    screenshotSizeKB = fs.existsSync(screenshotPath)
      ? Number((fs.statSync(screenshotPath).size / 1024).toFixed(1))
      : 0;
    if (screenshotSizeKB > 25) break;
  }

  // 3. 驗證「孤立靜態資產微預覽與像素/ΔE 校準工作台」 (preview.html)
  const previewUrl = targetUrl.replace(/\/?$/, '/preview.html');
  const previewDomOutput = execFileSync(
    'node',
    [
      headlessRunner,
      '--window-size=1280,720',
      '--virtual-time-budget=2500',
      '--dump-dom',
      previewUrl
    ],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );

  const extractPreviewAttr = (attr) => {
    const m = previewDomOutput.match(new RegExp(`${attr}="([^"]*)"`));
    return m ? m[1] : null;
  };

  const microPreviewTelemetry = {
    previewReady: extractPreviewAttr('data-zhuda-preview-ready') === 'true',
    activeAsset: extractPreviewAttr('data-zhuda-preview-asset') || '',
    calibratedAssetsCount: Number(extractPreviewAttr('data-zhuda-calibrated-assets') || 0),
    allAssetsPassed: extractPreviewAttr('data-zhuda-all-assets-passed') === 'true',
    beforePxError: Number(extractPreviewAttr('data-zhuda-before-px-error') || 0),
    afterPxError: Number(extractPreviewAttr('data-zhuda-after-px-error') || 0),
    beforeDeltaE: Number(extractPreviewAttr('data-zhuda-before-delta-e') || 0),
    afterDeltaE: Number(extractPreviewAttr('data-zhuda-after-delta-e') || 0),
    glPixelsSampled: Number(extractPreviewAttr('data-zhuda-gl-pixels-sampled') || 0)
  };

  const previewScreenshotPath = path.join(projectRoot, 'dist/micro-preview-gate.png');
  execFileSync(
    'node',
    [
      headlessRunner,
      '--window-size=1280,720',
      '--virtual-time-budget=2500',
      `--screenshot=${previewScreenshotPath}`,
      previewUrl
    ],
    { stdio: 'pipe' }
  );

  const previewScreenshotSizeKB = fs.existsSync(previewScreenshotPath)
    ? Number((fs.statSync(previewScreenshotPath).size / 1024).toFixed(1))
    : 0;

  const passed =
    telemetry.booted &&
    telemetry.modulesCount === 29 &&
    telemetry.reflectedComponents.includes('BoardCameraController') &&
    telemetry.reflectedComponents.includes('TilePhysicsBehavior') &&
    telemetry.reflectedComponents.includes('Spine42PhysicsRigComponent') &&
    telemetry.reflectedComponents.includes('ZhudaParticleEmitterComponent') &&
    telemetry.reflectedComponents.includes('ZhudaAnimatorControllerComponent') &&
    telemetry.spine42Ready &&
    telemetry.prototypeDetoxActive &&
    telemetry.tileNodes3D === 81 &&
    telemetry.staticAssetsCount === 11 &&
    telemetry.prefabAssembled &&
    telemetry.nineSlicePassed &&
    telemetry.iframeAudioReady &&
    telemetry.viewportProfilesCount === 5 &&
    telemetry.safeAreaPassed &&
    telemetry.vfxBlueprintsCount === 4 &&
    telemetry.unityMigratedPassed &&
    telemetry.unityAnimatorTrace === 'Idle->Charge->Burst->Idle' &&
    telemetry.hasLayaCanvas &&
    screenshotSizeKB > 10 &&
    microPreviewTelemetry.previewReady &&
    microPreviewTelemetry.calibratedAssetsCount === 10 &&
    microPreviewTelemetry.allAssetsPassed &&
    microPreviewTelemetry.beforePxError === 3 &&
    microPreviewTelemetry.afterPxError === 0 &&
    microPreviewTelemetry.afterDeltaE === 0 &&
    previewScreenshotSizeKB > 10;

  const report = {
    passed,
    targetUrl,
    previewUrl,
    screenshotPath,
    screenshotSizeKB,
    previewScreenshotPath,
    previewScreenshotSizeKB,
    telemetry,
    microPreviewTelemetry,
    verifiedAt: new Date().toISOString()
  };

  const reportPath = path.join(projectRoot, 'dist/ci-gate-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`  ✔ [WebGL Canvas] layaCanvas 存在: ${telemetry.hasLayaCanvas}, Stage 子節點: ${telemetry.stageChildren}`);
  console.log(`  ✔ [Topology]     已載入模組數: ${telemetry.modulesCount}/29`);
  console.log(`  ✔ [AST Reflect]  已註冊組件:   ${telemetry.reflectedComponents.join(', ')}`);
  console.log(`  ✔ [Spine 4.2]    PhysicsConstraint 就緒: ${telemetry.spine42Ready}`);
  console.log(`  ✔ [Static .lh]   已組裝預製體: ${telemetry.staticAssetsCount} 份 (VFX 藍圖: ${telemetry.vfxBlueprintsCount} 套, Unity 預製體掛載: ${telemetry.prefabAssembled})`);
  console.log(`  ✔ [M1 & M2]      九宮格 0px 變形: ${telemetry.nineSlicePassed}, iframe 音訊/失焦守衛: ${telemetry.iframeAudioReady}`);
  console.log(`  ✔ [M3 & M5]      多解析度 SafeArea: ${telemetry.viewportProfilesCount}/5 通過 (${telemetry.safeAreaPassed}), Unity Animator: ${telemetry.unityAnimatorTrace}`);
  console.log(
    `  ✔ [MicroPreview] 孤立微預覽就緒: ${microPreviewTelemetry.previewReady} (${microPreviewTelemetry.calibratedAssetsCount}/10 預製體), 像素誤差收斂: ${microPreviewTelemetry.beforePxError}px -> ${microPreviewTelemetry.afterPxError}px, 色差 ΔE00: ${microPreviewTelemetry.beforeDeltaE} -> ${microPreviewTelemetry.afterDeltaE} (WebGL 採樣像素: ${microPreviewTelemetry.glPixelsSampled})`
  );
  console.log(`  ✔ [3D Scene]     活躍棋盤節點: ${telemetry.tileNodes3D} 格 (開局已揭開 ${telemetry.revealedCells} 格)`);
  console.log(`  ✔ [Screenshots]  主畫面 (${screenshotSizeKB} KB) & 微預覽 (${previewScreenshotSizeKB} KB)`);
  console.log(`  ✔ [Gate Status]  ${passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  if (!passed) {
    throw new Error('[Zhuda CI-Gate] 首幀守衛未通過: ' + JSON.stringify(report));
  }

  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2] || 'http://127.0.0.1:8890/';
  runFirstFrameGate(url);
}
