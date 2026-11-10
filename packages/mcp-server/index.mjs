#!/usr/bin/env node
import { cliMain } from '../compiler/cli.mjs';
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
import {
  FILM_TOOLS_MANIFEST,
  isFilmTool,
  executeFilmTool,
  configureFilmTools,
  closeFilmTools,
} from './film-tools.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  TopologyResolver,
  ZhudaBenchmarkEngine,
  ZhudaAssetSerializer,
  PixelCalibrationEngine,
  ViewportMatrixEngine,
  UnityBridgePipeline,
  validateParticleEffect,
  validateParticleEffect3D,
  validateTerrain2D,
  validateHeightfield,
  validateShaderSpec,
  validateTimelineSpec,
  gltfAssetCapabilities,
  gltfExtensionCapabilities,
  validateZhudaTextureRecipe,
  validateZhudaSynthRecipe,
} from './runtime.mjs';
import { auditVisualAssetMigration } from '../compiler/visual-asset-audit.mjs';
import { auditVisualPresentationContracts } from '../compiler/visual-contract-audit.mjs';
import { getAgentContract, validateTaskSpec } from '../compiler/agent-contract.mjs';
import { API_GUARDRAILS, ERROR_DIAGNOSTICS_DB, GOLDEN_EXAMPLES } from './corpus.mjs';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const packageVersion = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version;

export const MCP_TOOLS_MANIFEST = [
  ...FILM_TOOLS_MANIFEST,
  {
    name: 'validate_texture_recipe',
    description:
      'Validate a procedural PBR texture recipe (base surface plus seamless mask layers) and list every problem. Configuration only; no baking, rendering or visual approval.',
    inputSchema: {
      type: 'object',
      properties: {
        recipe: { type: 'object', description: 'ZhudaTextureRecipe, schemaVersion 1' },
      },
      required: ['recipe'],
    },
  },
  {
    name: 'validate_synth_recipe',
    description:
      'Validate a synthesised sound recipe (noise and tone layers with envelopes and filters) and list every problem. Configuration only; no audio is rendered or judged.',
    inputSchema: {
      type: 'object',
      properties: { recipe: { type: 'object', description: 'ZhudaSynthRecipe, schemaVersion 1' } },
      required: ['recipe'],
    },
  },
  {
    name: 'get_cinematic_contract',
    description:
      'Return the deterministic movie API, export route and explicit HDR/device limits. Does not render or certify quality.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'validate_timeline_spec',
    description:
      'Validate deterministic timeline keys, dimensions and targets. Configuration only; no rendering or movie certification.',
    inputSchema: {
      type: 'object',
      properties: { timeline: { type: 'object' } },
      required: ['timeline'],
    },
  },
  {
    name: 'get_model_capabilities',
    description:
      'List native model extensions, optional Meshopt adapter and unsupported formats with device evidence limits.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_agent_contract',
    description:
      '回傳複雜專案 agent 必讀文件、引擎／consumer 邊界、開發順序、必跑命令與證據規則；不代表所有計畫已實作。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'validate_task_spec',
    description:
      '驗證 agent 任務規格是否列出來源、目標、不變規則、依賴、引擎／consumer 範圍、非目標、驗收與未驗證限制。',
    inputSchema: {
      type: 'object',
      properties: { task: { type: 'object' } },
      required: ['task'],
    },
  },
  {
    name: 'validate_terrain_spec',
    description:
      '驗證可序列化的2D tile地形或3D高度場；回報尺寸、圖層、atlas、高度與配置錯誤，不代替實際渲染驗收。',
    inputSchema: {
      type: 'object',
      properties: { terrain: { type: 'object' } },
      required: ['terrain'],
    },
  },
  {
    name: 'validate_shader_spec',
    description:
      '驗證ZhudaShaderSpec的2D/3D surface函式契約與uniform型別；GLSL編譯、fog、instancing、clipping及畫面須實際WebGL驗收。',
    inputSchema: {
      type: 'object',
      properties: { shader: { type: 'object' } },
      required: ['shader'],
    },
  },
  {
    name: 'validate_particle_effect',
    description:
      '驗證可序列化的 2D／3D 粒子設定：發射器、池容量、生命曲線、顏色、空間與週期。只驗證設定，不宣稱已完成畫面或效能驗收。',
    inputSchema: {
      type: 'object',
      properties: {
        effect: {
          type: 'object',
          description:
            'schemaVersion: 1 的 ParticleEffectSpec 或 dimension: 3 的 ParticleEffectSpec3D；貼圖 key 由應用程式解析。',
        },
      },
      required: ['effect'],
    },
  },
  {
    name: 'resolve_topology',
    description:
      '給定遊戲所需功能標籤 (如 ["3d", "spine42", "physics3d"])，計算最小按需剪枝模組清單與嚴格 DAG 拓撲載入順序。',
    inputSchema: {
      type: 'object',
      properties: {
        features: {
          type: 'array',
          items: { type: 'string' },
          description: '功能標籤陣列，或傳入 ["all"] 取得完整 29 模組拓撲',
        },
      },
    },
  },
  {
    name: 'search_api_guardrails',
    description:
      '檢索 LayaAir 3.4.2 (@zhuda-laya/core) 防幻覺 API 護欄，對比禁用之 1.x/2.x 舊語法與正確宣告式寫法。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '關鍵字，例如 Button, Mesh, Light, Ray, init' },
      },
    },
  },
  {
    name: 'diagnose_error',
    description:
      '診斷 LayaAir 常見運行期崩潰錯誤訊息 (如 reading "I", Box2DShapeDef, setState is not a function)，回傳根因與修復方案。',
    inputSchema: {
      type: 'object',
      properties: {
        error: { type: 'string', description: '錯誤訊息字串' },
      },
      required: ['error'],
    },
  },
  {
    name: 'get_golden_example',
    description:
      '取得 @zhuda-laya/core 純代碼標準範例 (Golden Examples)；範例示範 API 用法，畫面與裝置表現仍需實際繪製驗收。',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          enum: Object.keys(GOLDEN_EXAMPLES),
          description: '範例 ID',
        },
      },
    },
  },
  {
    name: 'run_benchmark',
    description: '執行彈簧算術微基準與拓撲包體估計；不是實際 Spine、WebGL、GPU 或跨引擎效能測試。',
    inputSchema: {
      type: 'object',
      properties: {
        nodesCount: { type: 'number', description: '同屏活躍 3D 節點數 (預設 81)' },
      },
    },
  },
  {
    name: 'list_static_assets',
    description:
      '列出所有預先設計並序列化之 .lh (Prefab) 與 .ls (Scene) 靜態資產 (含 UI、Spine 4.2 骨骼與 Particle 粒子快照)。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'compile_static_asset',
    description:
      '將指定靜態資產藍圖編譯為標準 LayaAir 3.4.2 .lh JSON 階層樹 (支援 calibrated 或 uncalibrated-drift 變體)。',
    inputSchema: {
      type: 'object',
      properties: {
        assetName: {
          type: 'string',
          description:
            '資產名稱，如 ConfirmActionButton.lh, TacticalHudBar.lh, ZhudaSpine42Mascot.lh, MineExplosionParticle.lh',
        },
        variant: {
          type: 'string',
          enum: ['calibrated', 'uncalibrated-drift'],
          description: '是否產出帶像素/色差偏移的待校準變體',
        },
      },
    },
  },
  {
    name: 'calibrate_asset_pixels',
    description:
      '對靜態 .lh 資產執行 Tight Bounding Box 像素邊界與 CIEDE2000 (ΔE00) 色差校準，並支援自動套用 AutoFixPatch 收斂至 0 誤差。',
    inputSchema: {
      type: 'object',
      properties: {
        assetName: {
          type: 'string',
          description: '資產名稱，預設 ConfirmActionButton.lh',
        },
        simulateDriftAndAutoFix: {
          type: 'boolean',
          description:
            '若為 true，執行從 +3px / ΔE00 色差偏移自動修補收斂至 0px / ΔE00=0 的完整閉環',
        },
      },
    },
  },
  {
    name: 'verify_nine_slice_integrity',
    description:
      '驗證 M1 九宮格 (9-Slice / sizeGrid) 預製體於拉伸狀態下的四角錨塊 1:1 零變形指標。',
    inputSchema: {
      type: 'object',
      properties: {
        stretchedWidth: { type: 'number', description: '拉伸後寬度，預設 320' },
        stretchedHeight: { type: 'number', description: '拉伸後高度，預設 140' },
      },
    },
  },
  {
    name: 'audit_viewport_matrix',
    description:
      '執行 M3 多解析度與安全區 (SafeArea) 跨設備矩陣驗測 (涵蓋 16:9, 9:19.5 靈動島直向, 19.5:9 橫向, 4:3 iPad, 21:9 超寬螢幕)。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'demo_verify_unity_migration',
    description:
      '執行 M5 Unity 場景 (LH→RH 座標轉換) + AnimatorController 狀態機過渡 + Spine 4.2 PhysicsConstraint 完整移植驗證。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'audit_visual_migration',
    description:
      '盤點 Unity 與 Laya 視覺資產，驗證 Spine 4.2 動畫/骨骼/皮膚/約束、Atlas、貼圖與 Unity 動畫包裝是否有對應；可用 strict 阻擋未映射材質與動畫。',
    inputSchema: {
      type: 'object',
      properties: {
        sourceRoot: { type: 'string', description: 'Unity 專案或 Game 資產根目錄的絕對路徑' },
        targetRoot: {
          type: 'string',
          description: 'Laya 專案 assets 根目錄或專案根目錄的絕對路徑',
        },
        contractPath: {
          type: 'string',
          description: '可選的 visual-migration-manifest.json 絕對路徑',
        },
        strict: {
          type: 'boolean',
          description: '是否把未映射 Unity 動畫包裝與材質契約列為阻斷錯誤',
        },
      },
      required: ['sourceRoot', 'targetRoot'],
    },
  },
  {
    name: 'audit_visual_contract',
    description:
      '驗證移植專案的視覺演出契約，確認每個演出已定義作用域、狀態、非中獎目標處理與清除還原規則。',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: '包含 visual-presentation-manifest.json 的專案絕對路徑',
        },
        manifestPath: { type: 'string', description: '可選的契約檔相對或絕對路徑' },
      },
      required: ['projectRoot'],
    },
  },
];

export function executeMcpTool(toolName, args = {}) {
  switch (toolName) {
    case 'validate_texture_recipe': {
      const issues = validateZhudaTextureRecipe(args.recipe);
      return {
        tool: toolName,
        passed: issues.length === 0,
        issues,
        rendering: 'requires-real-draw',
      };
    }
    case 'validate_synth_recipe': {
      const issues = validateZhudaSynthRecipe(args.recipe);
      return {
        tool: toolName,
        passed: issues.length === 0,
        issues,
        listening: 'requires-playback',
      };
    }
    case 'get_cinematic_contract':
      return {
        tool: toolName,
        version: packageVersion,
        api: [
          'ZhudaTimelineSequencer',
          'ZhudaModelAnimationSampler',
          'ZhudaPhysicalCameraRig',
          'ZhudaCinematicCapture',
          'IframeSoundAdapter.renderOffline',
        ],
        export:
          'zhuda-film-export sequence.json --fps 24 --output movie.mp4 --audio soundtrack.wav',
        capture: {
          pose: 'synchronous absolute time',
          runtime: 'paused',
          samples: '1..256',
          pixels: 'opaque sRGB top-left',
          accumulation: 'display-linear after tone mapping',
          shutter: 'forward interval; single sample at frame start',
        },
        requirements: [
          'Load assets through provider before capture',
          'Select one override animation per Animator; no state transitions/events',
          'Disable TAA; render callbacks must be deterministic',
          'Movie timestamps are i/fps for i < frameCount; exclude endpoint',
          'FFmpeg/ffprobe required for MP4; PNG output remains available',
        ],
        limits: [
          'No scene-linear HDR/ACEScg/EXR/path-tracing claim',
          'OfflineAudioContext drains after cancellation; no streaming/custom Worklet DSP export',
          'Windows physical GPU/mobile/XR unavailable',
        ],
        documentation: 'docs/cinematics.md',
        example: 'examples/cinematic-capture/',
        deviceCertification: false,
      };
    case 'validate_timeline_spec': {
      const issues = validateTimelineSpec(args.timeline);
      return {
        tool: toolName,
        passed: issues.length === 0,
        issues,
        rendering: 'requires-real-draw',
      };
    }
    case 'get_model_capabilities':
      return {
        tool: toolName,
        assets: gltfAssetCapabilities,
        extensions: gltfExtensionCapabilities,
        scope: 'importer-capabilities',
        deviceCertification: false,
      };
    case 'get_agent_contract':
      return { tool: toolName, ...getAgentContract(projectRoot) };
    case 'validate_task_spec':
      return { tool: toolName, ...validateTaskSpec(args.task) };
    case 'validate_terrain_spec': {
      const issues =
        args.terrain?.dimension === 3
          ? validateHeightfield(args.terrain)
          : validateTerrain2D(args.terrain);
      return { tool: toolName, passed: issues.length === 0, issues };
    }
    case 'validate_shader_spec': {
      const issues = validateShaderSpec(args.shader);
      return {
        tool: toolName,
        passed: issues.length === 0,
        issues,
        gpuValidation: 'requires-real-draw',
      };
    }
    case 'validate_particle_effect': {
      const issues =
        args.effect?.dimension === 3
          ? validateParticleEffect3D(args.effect)
          : validateParticleEffect(args.effect);
      return { tool: 'validate_particle_effect', passed: issues.length === 0, issues };
    }
    case 'resolve_topology': {
      const features = !args.features || args.features.includes('all') ? 'all' : args.features;
      const res = TopologyResolver.resolveByFeatures(features);
      return {
        tool: 'resolve_topology',
        moduleCount: res.orderedFiles.length,
        totalSizeKB: res.totalSizeKB,
        prunedRatioPercent: res.prunedRatioPercent,
        orderedFiles: res.orderedFiles,
        diagnostics: res.diagnostics,
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
              g.id.toLowerCase().includes(q),
          )
        : API_GUARDRAILS;
      return {
        tool: 'search_api_guardrails',
        matchCount: matched.length,
        guardrails: matched,
      };
    }

    case 'diagnose_error': {
      const errText = (args.error || '').toLowerCase();
      const matched = ERROR_DIAGNOSTICS_DB.filter(
        (d) =>
          errText.includes(d.pattern.toLowerCase()) ||
          d.pattern.toLowerCase().includes(errText) ||
          d.faultyModule.toLowerCase().includes(errText),
      );
      return {
        tool: 'diagnose_error',
        diagnosed: matched.length > 0,
        matches: matched.length > 0 ? matched : ERROR_DIAGNOSTICS_DB,
      };
    }

    case 'get_golden_example': {
      const ex = args.id ? GOLDEN_EXAMPLES[args.id] : GOLDEN_EXAMPLES;
      return {
        tool: 'get_golden_example',
        availableIds: Object.keys(GOLDEN_EXAMPLES),
        result: ex || GOLDEN_EXAMPLES,
      };
    }

    case 'run_benchmark': {
      return {
        tool: 'run_benchmark',
        benchmark: ZhudaBenchmarkEngine.runSuite(args.nodesCount || 81),
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
          components: Array.isArray(data._$comp) ? data._$comp.map((c) => c._$type) : [],
        };
      });
      return {
        tool: 'list_static_assets',
        totalCount: summary.length,
        assets: summary,
      };
    }

    case 'compile_static_asset': {
      const name = args.assetName || 'ConfirmActionButton.lh';
      let hierarchy;
      if (name === 'ConfirmActionButton.lh' && args.variant === 'uncalibrated-drift') {
        hierarchy = ZhudaAssetSerializer.buildConfirmButtonPrefab('uncalibrated-drift');
      } else {
        const all = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
        if (!Object.hasOwn(all, name)) throw Error(`Unknown built-in static asset: ${name}`);
        hierarchy = all[name];
      }
      return {
        tool: 'compile_static_asset',
        assetName: name,
        hierarchy,
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
          afterReport: demo.afterReport,
        };
      }
      const name = args.assetName || 'ConfirmActionButton.lh';
      const all = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
      if (!Object.hasOwn(all, name)) throw Error(`Unknown built-in static asset: ${name}`);
      const target = all[name];
      const report = PixelCalibrationEngine.calibrateAsset(target);
      return {
        tool: 'calibrate_asset_pixels',
        mode: 'single-audit',
        report,
      };
    }

    case 'verify_nine_slice_integrity': {
      const w = args.stretchedWidth || 320;
      const h = args.stretchedHeight || 140;
      const prefab = ZhudaAssetSerializer.buildNineSliceDialogPrefab(w, h);
      const report = PixelCalibrationEngine.verifyNineSliceIntegrity(prefab);
      return {
        tool: 'verify_nine_slice_integrity',
        report,
      };
    }

    case 'audit_viewport_matrix': {
      const audit = ViewportMatrixEngine.auditAllViewportProfiles();
      return {
        tool: 'audit_viewport_matrix',
        ...audit,
      };
    }

    case 'demo_verify_unity_migration': {
      const report = UnityBridgePipeline.runFullMigrationVerification();
      return {
        tool: 'demo_verify_unity_migration',
        report,
      };
    }

    case 'audit_visual_migration': {
      const report = auditVisualAssetMigration({
        sourceRoot: args.sourceRoot,
        targetRoot: args.targetRoot,
        contractPath: args.contractPath,
        strict: Boolean(args.strict),
      });
      return {
        tool: 'audit_visual_migration',
        report,
      };
    }

    case 'audit_visual_contract': {
      const report = auditVisualPresentationContracts({
        projectRoot: args.projectRoot,
        manifestPath: args.manifestPath,
      });
      return {
        tool: 'audit_visual_contract',
        ...report,
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
  if (
    !msg ||
    typeof msg !== 'object' ||
    Array.isArray(msg) ||
    msg.jsonrpc !== '2.0' ||
    typeof msg.method !== 'string'
  ) {
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
  }
  if (!Object.hasOwn(msg, 'id')) return null;
  const { id, method, params = {} } = msg;
  if (!(id === null || typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id)))) {
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid id' } };
  }

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: '@zhuda-laya/mcp-server',
          version: packageVersion,
        },
        capabilities: {
          tools: {},
        },
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS_MANIFEST,
      },
    };
  }

  if (method === 'tools/call') {
    try {
      if (
        !params ||
        typeof params !== 'object' ||
        typeof params.name !== 'string' ||
        (params.arguments !== undefined &&
          (!params.arguments ||
            typeof params.arguments !== 'object' ||
            Array.isArray(params.arguments)))
      )
        throw Error('Invalid tool parameters');
      if (isFilmTool(params.name))
        // Film tools render in a browser and answer asynchronously, with image blocks.
        return executeFilmTool(params.name, params.arguments || {}).then(
          (content) => ({ jsonrpc: '2.0', id, result: { content } }),
          (err) => ({ jsonrpc: '2.0', id, error: { code: -32602, message: err.message } }),
        );
      const output = executeMcpTool(params.name, params.arguments || {});
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2),
            },
          ],
        },
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: err.message,
        },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    ...(method === 'ping'
      ? { result: {} }
      : { error: { code: -32601, message: 'Method not found' } }),
  };
}

// CLI 或 stdio 入口
if (
  cliMain(
    import.meta.url,
    'Usage: zhuda-laya-mcp [--tool NAME --args JSON] [--film-output DIRECTORY] [--film-pack MODULE ...]\nWithout --tool, starts the JSON-RPC stdio server. --film-output lets film_render_job write stills and MP4 there; --film-pack adds an operator prop/recipe module (repeatable).',
  )
) {
  const { resolve } = await import('node:path');
  const filmIdx = process.argv.indexOf('--film-output');
  if (filmIdx !== -1) {
    const dir = process.argv[filmIdx + 1];
    if (!dir) throw Error('--film-output needs a directory');
    configureFilmTools({ output: resolve(dir) });
  }
  const packList = process.argv.flatMap((arg, i) => {
    if (arg !== '--film-pack') return [];
    const file = process.argv[i + 1];
    if (!file) throw Error('--film-pack needs a module path');
    return [resolve(file)];
  });
  if (packList.length) configureFilmTools({ packs: packList });
  const toolIdx = process.argv.indexOf('--tool');
  if (toolIdx !== -1) {
    const toolName = process.argv[toolIdx + 1];
    const argsIdx = process.argv.indexOf('--args');
    const rawArgs = argsIdx !== -1 ? JSON.parse(process.argv[argsIdx + 1]) : {};
    if (isFilmTool(toolName)) {
      const content = await executeFilmTool(toolName, rawArgs);
      await closeFilmTools();
      console.log(
        JSON.stringify(
          content.filter((block) => block.type === 'text').map((b) => JSON.parse(b.text)),
          null,
          2,
        ),
      );
      process.exit(0);
    }
    const result = executeMcpTool(toolName, rawArgs);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // 標準 MCP stdio 模式
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // The film host owns a browser; close it with the server.
  // Answer every request already received before closing.
  const pending = new Set();
  rl.on('close', () => {
    Promise.allSettled([...pending])
      .then(() => closeFilmTools())
      .finally(() => process.exit(0));
  });

  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      const res = handleJsonRpcMessage(req);
      if (res && typeof res.then === 'function') {
        const reply = res.then((done) => process.stdout.write(JSON.stringify(done) + '\n'));
        pending.add(reply);
        reply.finally(() => pending.delete(reply));
      } else if (res !== null) process.stdout.write(JSON.stringify(res) + '\n');
    } catch (e) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: e.message },
        }) + '\n',
      );
    }
  });
}
