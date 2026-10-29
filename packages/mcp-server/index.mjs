#!/usr/bin/env node
/**
 * @zhuda-laya/mcp-server — Model Context Protocol (MCP) Server for Zhuda-LayaAir
 *
 * 支援兩種呼叫模式：
 * 1. 標準 MCP JSON-RPC 2.0 (stdio 模式)：供 Cursor / Windsurf / Claude Desktop / AGY 掛載
 * 2. CLI 工具直調模式：
 *    node packages/mcp-server/index.mjs --tool resolve_topology --args '{"features":["3d","spine42"]}'
 *    node packages/mcp-server/index.mjs --tool search_api_guardrails --args '{"query":"Button"}'
 *    node packages/mcp-server/index.mjs --tool diagnose_error --args '{"error":"reading '\''I'\''"}'
 *    node packages/mcp-server/index.mjs --tool get_golden_example --args '{"id":"boot-declarative-3d"}'
 */

import readline from 'node:readline';
import { TopologyResolver } from '../core/TopologyGraph.ts';
import { ZhudaBenchmarkEngine } from '../core/BenchmarkEngine.ts';
import { ZhudaAssetSerializer } from '../core/StaticAssetPipeline.ts';
import { PixelCalibrationEngine } from '../core/PixelCalibrationEngine.ts';
import { ViewportMatrixEngine } from '../core/ViewportMatrixEngine.ts';
import { UnityBridgePipeline } from '../core/UnityBridgePipeline.ts';
import { validateParticleEffect } from '../core/particles/ParticleTypes.ts';
import { validateParticleEffect3D } from '../core/particles/ParticleTypes3D.ts';
import { auditVisualAssetMigration } from '../compiler/visual-asset-audit.mjs';
import { auditVisualPresentationContracts } from '../compiler/visual-contract-audit.mjs';
import { API_GUARDRAILS, ERROR_DIAGNOSTICS_DB, GOLDEN_EXAMPLES } from './corpus.mjs';

export const MCP_TOOLS_MANIFEST = [
  {
    name: 'validate_particle_effect',
    description: '驗證可序列化的 2D／3D 粒子設定：發射器、池容量、生命曲線、顏色、空間與週期。只驗證設定，不宣稱已完成畫面或效能驗收。',
    inputSchema: {
      type: 'object',
      properties: { effect: { type: 'object', description: 'schemaVersion: 1 的 ParticleEffectSpec 或 dimension: 3 的 ParticleEffectSpec3D；貼圖 key 由應用程式解析。' } },
      required: ['effect']
    }
  },
  {
    name: 'resolve_topology',
    description: '給定遊戲所需功能標籤 (如 ["3d", "spine42", "physics3d"])，計算最小按需剪枝模組清單與嚴格 DAG 拓撲載入順序。',
    inputSchema: {
      type: 'object',
      properties: {
        features: {
          type: 'array',
          items: { type: 'string' },
          description: '功能標籤陣列，或傳入 ["all"] 取得完整 29 模組拓撲'
        }
      }
    }
  },
  {
    name: 'search_api_guardrails',
    description: '檢索 LayaAir 3.4.2 (@zhuda-laya/core) 防幻覺 API 護欄，對比禁用之 1.x/2.x 舊語法與正確宣告式寫法。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '關鍵字，例如 Button, Mesh, Light, Ray, init' }
      }
    }
  },
  {
    name: 'diagnose_error',
    description: '診斷 LayaAir 常見運行期崩潰錯誤訊息 (如 reading "I", Box2DShapeDef, setState is not a function)，回傳根因與修復方案。',
    inputSchema: {
      type: 'object',
      properties: {
        error: { type: 'string', description: '錯誤訊息字串' }
      },
      required: ['error']
    }
  },
  {
    name: 'get_golden_example',
    description: '取得 100% 經過驗證的 @zhuda-laya/core 純代碼標準範例 (Golden Examples)。',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          enum: Object.keys(GOLDEN_EXAMPLES),
          description: '範例 ID'
        }
      }
    }
  },
  {
    name: 'run_benchmark',
    description: '執行 Zhuda-LayaAir 與 Three.js 拼裝方案的 DrawCall、Spine 4.2 物理求解與包體剪枝基準測試。',
    inputSchema: {
      type: 'object',
      properties: {
        nodesCount: { type: 'number', description: '同屏活躍 3D 節點數 (預設 81)' }
      }
    }
  },
  {
    name: 'list_static_assets',
    description: '列出所有預先設計並序列化之 .lh (Prefab) 與 .ls (Scene) 靜態資產 (含 UI、Spine 4.2 骨骼與 Particle 粒子快照)。',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'compile_static_asset',
    description: '將指定靜態資產藍圖編譯為標準 LayaAir 3.4.2 .lh JSON 階層樹 (支援 calibrated 或 uncalibrated-drift 變體)。',
    inputSchema: {
      type: 'object',
      properties: {
        assetName: {
          type: 'string',
          description: '資產名稱，如 ConfirmActionButton.lh, TacticalHudBar.lh, ZhudaSpine42Mascot.lh, MineExplosionParticle.lh'
        },
        variant: {
          type: 'string',
          enum: ['calibrated', 'uncalibrated-drift'],
          description: '是否產出帶像素/色差偏移的待校準變體'
        }
      }
    }
  },
  {
    name: 'calibrate_asset_pixels',
    description: '對靜態 .lh 資產執行 Tight Bounding Box 像素邊界與 CIEDE2000 (ΔE00) 色差校準，並支援自動套用 AutoFixPatch 收斂至 0 誤差。',
    inputSchema: {
      type: 'object',
      properties: {
        assetName: {
          type: 'string',
          description: '資產名稱，預設 ConfirmActionButton.lh'
        },
        simulateDriftAndAutoFix: {
          type: 'boolean',
          description: '若為 true，執行從 +3px / ΔE00 色差偏移自動修補收斂至 0px / ΔE00=0 的完整閉環'
        }
      }
    }
  },
  {
    name: 'verify_nine_slice_integrity',
    description: '驗證 M1 九宮格 (9-Slice / sizeGrid) 預製體於拉伸狀態下的四角錨塊 1:1 零變形指標。',
    inputSchema: {
      type: 'object',
      properties: {
        stretchedWidth: { type: 'number', description: '拉伸後寬度，預設 320' },
        stretchedHeight: { type: 'number', description: '拉伸後高度，預設 140' }
      }
    }
  },
  {
    name: 'audit_viewport_matrix',
    description: '執行 M3 多解析度與安全區 (SafeArea) 跨設備矩陣驗測 (涵蓋 16:9, 9:19.5 靈動島直向, 19.5:9 橫向, 4:3 iPad, 21:9 超寬螢幕)。',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'verify_unity_migration',
    description: '執行 M5 Unity 場景 (LH→RH 座標轉換) + AnimatorController 狀態機過渡 + Spine 4.2 PhysicsConstraint 完整移植驗證。',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'audit_visual_migration',
    description: '盤點 Unity 與 Laya 視覺資產，驗證 Spine 4.2 動畫/骨骼/皮膚/約束、Atlas、貼圖與 Unity 動畫包裝是否有對應；可用 strict 阻擋未映射材質與動畫。',
    inputSchema: {
      type: 'object',
      properties: {
        sourceRoot: { type: 'string', description: 'Unity 專案或 Game 資產根目錄的絕對路徑' },
        targetRoot: { type: 'string', description: 'Laya 專案 assets 根目錄或專案根目錄的絕對路徑' },
        contractPath: { type: 'string', description: '可選的 visual-migration-manifest.json 絕對路徑' },
        strict: { type: 'boolean', description: '是否把未映射 Unity 動畫包裝與材質契約列為阻斷錯誤' }
      },
      required: ['sourceRoot', 'targetRoot']
    }
  },
  {
    name: 'audit_visual_contract',
    description: '驗證移植專案的視覺演出契約，確認每個演出已定義作用域、狀態、非中獎目標處理與清除還原規則。',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string', description: '包含 visual-presentation-manifest.json 的專案絕對路徑' },
        manifestPath: { type: 'string', description: '可選的契約檔相對或絕對路徑' }
      },
      required: ['projectRoot']
    }
  }
];

export function executeMcpTool(toolName, args = {}) {
  switch (toolName) {
    case 'validate_particle_effect': {
      const issues = args.effect?.dimension === 3 ? validateParticleEffect3D(args.effect) : validateParticleEffect(args.effect);
      return { tool: 'validate_particle_effect', passed: issues.length === 0, issues };
    }
    case 'resolve_topology': {
      const features =
        !args.features || args.features.includes('all') ? 'all' : args.features;
      const res = TopologyResolver.resolveByFeatures(features);
      return {
        tool: 'resolve_topology',
        moduleCount: res.orderedFiles.length,
        totalSizeKB: res.totalSizeKB,
        prunedRatioPercent: res.prunedRatioPercent,
        orderedFiles: res.orderedFiles,
        diagnostics: res.diagnostics
      };
    }

    case 'search_api_guardrails': {
      const q = (args.query || '').toLowerCase();
      const matched = q
        ? API_GUARDRAILS.filter(
            (g) =>
              g.topic.toLowerCase().includes(q) ||
              g.hallucinatedLegacyApi.toLowerCase().includes(q) ||
              g.zhudaCanonicalApi.toLowerCase().includes(q) ||
              g.id.toLowerCase().includes(q)
          )
        : API_GUARDRAILS;
      return {
        tool: 'search_api_guardrails',
        matchCount: matched.length,
        guardrails: matched
      };
    }

    case 'diagnose_error': {
      const errText = (args.error || '').toLowerCase();
      const matched = ERROR_DIAGNOSTICS_DB.filter(
        (d) =>
          errText.includes(d.pattern.toLowerCase()) ||
          d.pattern.toLowerCase().includes(errText) ||
          d.faultyModule.toLowerCase().includes(errText)
      );
      return {
        tool: 'diagnose_error',
        diagnosed: matched.length > 0,
        matches: matched.length > 0 ? matched : ERROR_DIAGNOSTICS_DB
      };
    }

    case 'get_golden_example': {
      const ex = args.id ? GOLDEN_EXAMPLES[args.id] : GOLDEN_EXAMPLES;
      return {
        tool: 'get_golden_example',
        availableIds: Object.keys(GOLDEN_EXAMPLES),
        result: ex || GOLDEN_EXAMPLES
      };
    }

    case 'run_benchmark': {
      return {
        tool: 'run_benchmark',
        benchmark: ZhudaBenchmarkEngine.runSuite(args.nodesCount || 81)
      };
    }

    case 'list_static_assets': {
      const assets = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
      const summary = Object.entries(assets).map(([fileName, data]) => {
        const metrics = PixelCalibrationEngine.measureStaticHierarchy(data);
        return {
          fileName,
          category: data._zhudaMeta?.category || 'ui-prefab',
          rootType: data._$type,
          tightBox: metrics.tightBox,
          primaryFill: metrics.primaryFill,
          borderStroke: metrics.borderStroke,
          childCount: Array.isArray(data._$child) ? data._$child.length : 0,
          graphicsCmdCount: Array.isArray(data._gcmds) ? data._gcmds.length : 0,
          components: Array.isArray(data._$comp) ? data._$comp.map((c) => c._$type) : []
        };
      });
      return {
        tool: 'list_static_assets',
        totalCount: summary.length,
        assets: summary
      };
    }

    case 'compile_static_asset': {
      const name = args.assetName || 'ConfirmActionButton.lh';
      let hierarchy;
      if (name === 'ConfirmActionButton.lh' && args.variant === 'uncalibrated-drift') {
        hierarchy = ZhudaAssetSerializer.buildConfirmButtonPrefab('uncalibrated-drift');
      } else {
        const all = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
        hierarchy = all[name] || all['ConfirmActionButton.lh'];
      }
      return {
        tool: 'compile_static_asset',
        assetName: name,
        hierarchy
      };
    }

    case 'calibrate_asset_pixels': {
      if (args.simulateDriftAndAutoFix) {
        const demo = PixelCalibrationEngine.runSelfConvergenceDemo();
        return {
          tool: 'calibrate_asset_pixels',
          mode: 'self-convergence-loop',
          elapsedMs: demo.elapsedMs,
          beforeReport: demo.beforeReport,
          appliedPatches: demo.appliedPatches,
          afterReport: demo.afterReport
        };
      }
      const name = args.assetName || 'ConfirmActionButton.lh';
      const all = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
      const target = all[name] || all['ConfirmActionButton.lh'];
      const report = PixelCalibrationEngine.calibrateAsset(target);
      return {
        tool: 'calibrate_asset_pixels',
        mode: 'single-audit',
        report
      };
    }

    case 'verify_nine_slice_integrity': {
      const w = args.stretchedWidth || 320;
      const h = args.stretchedHeight || 140;
      const prefab = ZhudaAssetSerializer.buildNineSliceDialogPrefab(w, h);
      const report = PixelCalibrationEngine.verifyNineSliceIntegrity(prefab);
      return {
        tool: 'verify_nine_slice_integrity',
        report
      };
    }

    case 'audit_viewport_matrix': {
      const audit = ViewportMatrixEngine.auditAllViewportProfiles();
      return {
        tool: 'audit_viewport_matrix',
        ...audit
      };
    }

    case 'verify_unity_migration': {
      const report = UnityBridgePipeline.runFullMigrationVerification();
      return {
        tool: 'verify_unity_migration',
        report
      };
    }

    case 'audit_visual_migration': {
      const report = auditVisualAssetMigration({
        sourceRoot: args.sourceRoot,
        targetRoot: args.targetRoot,
        contractPath: args.contractPath,
        strict: Boolean(args.strict)
      });
      return {
        tool: 'audit_visual_migration',
        report
      };
    }

    case 'audit_visual_contract': {
      const report = auditVisualPresentationContracts({
        projectRoot: args.projectRoot,
        manifestPath: args.manifestPath
      });
      return {
        tool: 'audit_visual_contract',
        ...report
      };
    }

    default:
      throw new Error(`Unknown MCP tool: ${toolName}`);
  }
}

/**
 * 處理單筆 JSON-RPC 2.0 請求
 */
export function handleJsonRpcMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: '@zhuda-laya/mcp-server',
          version: '1.0.0'
        },
        capabilities: {
          tools: {}
        }
      }
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS_MANIFEST
      }
    };
  }

  if (method === 'tools/call') {
    try {
      const output = executeMcpTool(params.name, params.arguments || {});
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2)
            }
          ]
        }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: err.message
        }
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    result: {}
  };
}

// CLI 或 stdio 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const toolIdx = process.argv.indexOf('--tool');
  if (toolIdx !== -1) {
    const toolName = process.argv[toolIdx + 1];
    const argsIdx = process.argv.indexOf('--args');
    const rawArgs = argsIdx !== -1 ? JSON.parse(process.argv[argsIdx + 1]) : {};
    const result = executeMcpTool(toolName, rawArgs);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // 標準 MCP stdio 模式
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      const res = handleJsonRpcMessage(req);
      process.stdout.write(JSON.stringify(res) + '\n');
    } catch (e) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: e.message }
        }) + '\n'
      );
    }
  });
}
