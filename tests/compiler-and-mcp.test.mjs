import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanAndGenerateRegistry } from '../packages/compiler/ast-scanner.mjs';
import { runDoctorAudit } from '../packages/compiler/zhuda-doctor.mjs';
import { executeMcpTool, handleJsonRpcMessage } from '../packages/mcp-server/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

test('AST Scanner discovers @zhudaComponent classes and generates zhuda-registry.ts without IDE', () => {
  const res = scanAndGenerateRegistry(projectRoot);
  const classNames = res.classes.map((c) => c.className);
  assert.ok(classNames.includes('BoardCameraController'), 'Should discover BoardCameraController');
  assert.ok(classNames.includes('TilePhysicsBehavior'), 'Should discover TilePhysicsBehavior');
  assert.ok(classNames.includes('Spine42PhysicsRigComponent'), 'Should discover Spine42PhysicsRigComponent');
  assert.ok(classNames.includes('ZhudaParticleEmitterComponent'), 'Should discover ZhudaParticleEmitterComponent');
  assert.ok(classNames.includes('ZhudaAnimatorControllerComponent'), 'Should discover ZhudaAnimatorControllerComponent');
});

test('MCP Server resolves topology, diagnoses Laya crashes, and serves Golden Examples', () => {
  const topoRes = executeMcpTool('resolve_topology', { features: ['3d', 'spine42'] });
  assert.ok(topoRes.orderedFiles.includes('laya.d3.js'));
  assert.ok(topoRes.orderedFiles.includes('spine-core-4.2.js'));
  assert.ok(topoRes.orderedFiles.includes('laya.spine.js'));

  const diagRes = executeMcpTool('diagnose_error', {
    error: 'this._graphics.setState is not a function'
  });
  assert.equal(diagRes.diagnosed, true);
  assert.ok(diagRes.matches[0].fix.includes('installPrototypeDetox'));

  const rpcRes = handleJsonRpcMessage({
    jsonrpc: '2.0',
    id: 42,
    method: 'tools/list',
    params: {}
  });
  assert.equal(rpcRes.id, 42);
  assert.equal(rpcRes.result.tools.length, 13);
  assert.ok(rpcRes.result.tools.some((tool) => tool.name === 'audit_visual_migration'));
  assert.ok(rpcRes.result.tools.some((tool) => tool.name === 'audit_visual_contract'));

  const visualContractRes = executeMcpTool('audit_visual_contract', {
    projectRoot: '/Users/yaowei/Desktop/天堂老虎機'
  });
  assert.equal(visualContractRes.passed, true);
  assert.deepEqual(visualContractRes.contractIds, ['win-focus']);

  const calibRes = executeMcpTool('calibrate_asset_pixels', { simulateDriftAndAutoFix: true });
  assert.equal(calibRes.beforeReport.passed, false);
  assert.equal(calibRes.afterReport.passed, true);
  assert.equal(calibRes.afterReport.pixelErrors.maxAbsErrorPx, 0);
  assert.equal(calibRes.afterReport.colorMetrics.maxDeltaE2000, 0);
});

test('Zhuda Doctor audit passes with 0 topological inversions and 0 legacy API violations', () => {
  const audit = runDoctorAudit();
  assert.equal(audit.passed, true);
  assert.equal(audit.apiViolations.length, 0);
  assert.equal(audit.topologyIssues.length, 0);
});

test('zhuda-laya-engine SDK bundles (ESM & CJS) and upstream LayaAir Official attribution are present', async () => {
  const manifestPath = path.join(projectRoot, 'dist/build-manifest.json');
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.packageName, 'zhuda-laya-engine');
  assert.equal(manifest.repositoryUrl, 'https://github.com/zhudaandzhuer/zhuda-laya-engine');
  assert.equal(manifest.upstreamOfficial.website, 'https://layaair.com/');
  assert.equal(manifest.upstreamOfficial.repository, 'https://github.com/layabox/LayaAir');
  assert.equal(manifest.upstreamOfficial.baseVersion, '3.4.2');

  const esmPath = path.join(projectRoot, 'dist/sdk/zhuda-laya-engine.esm.js');
  const cjsPath = path.join(projectRoot, 'dist/sdk/zhuda-laya-engine.cjs');
  assert.equal(fs.existsSync(esmPath), true, 'ESM SDK bundle must exist');
  assert.equal(fs.existsSync(cjsPath), true, 'CJS SDK bundle must exist');

  const sdkMod = await import(esmPath);
  assert.ok(sdkMod.TopologyResolver, 'ESM SDK should export TopologyResolver');
  assert.ok(sdkMod.EngineGuard, 'ESM SDK should export EngineGuard');
  assert.ok(sdkMod.ZhudaEngine, 'ESM SDK should export ZhudaEngine');
  assert.ok(sdkMod.PixelCalibrationEngine, 'ESM SDK should export PixelCalibrationEngine');
  assert.ok(sdkMod.IframeSoundAdapter, 'ESM SDK should export IframeSoundAdapter');
  assert.ok(sdkMod.ViewportMatrixEngine, 'ESM SDK should export ViewportMatrixEngine');
  assert.ok(sdkMod.UnityBridgePipeline, 'ESM SDK should export UnityBridgePipeline');
  assert.ok(sdkMod.VisualFocusContract, 'ESM SDK should export VisualFocusContract');
});
