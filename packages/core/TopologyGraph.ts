/**
 * @zhuda-laya/core — Topological Dependency Graph & Tree-Pruning Resolver
 *
 * 解決痛點一：隱性拓撲相依與加載順序死鎖 (Global Mutation Deadlock)
 * - 以有向無環圖 (DAG) + Kahn's 拓撲排序演算法，強制確保 29 個核心與擴展庫的載入順序 100% 正確
 * - 支援按需特徵剪枝 (On-Demand Feature Pruning)，脫離 IDE 也能精確控制打包體積
 */

export type EngineFeatureTag =
  | 'core'
  | '2d'
  | '3d'
  | 'ui'
  | 'ui2'
  | 'physics2d'
  | 'physics3d'
  | 'spine42'
  | 'spine3d'
  | 'navmesh2d'
  | 'navmesh3d'
  | 'particle2d'
  | 'particle3d'
  | 'trail2d'
  | 'trail3d'
  | 'effects2d'
  | 'tilemap'
  | 'gltf'
  | 'ik'
  | 'postProcess'
  | 'device'
  | 'ani';

export interface EngineModuleNode {
  id: string;
  file: string;
  sizeBytes: number;
  feature: EngineFeatureTag;
  dependsOn: string[];
  conflictsWith?: string[];
  providesGlobals: string[];
  priority: number;
  painPointNote?: string;
}

export interface TopologyResolutionResult {
  orderedModules: EngineModuleNode[];
  orderedFiles: string[];
  totalSizeBytes: number;
  totalSizeKB: number;
  prunedRatioPercent: number;
  fullEngineSizeBytes: number;
  diagnostics: string[];
}

export interface SequenceAuditIssue {
  type: 'INVERTED_ORDER' | 'MISSING_DEPENDENCY' | 'CONFLICTING_MODULE';
  moduleFile: string;
  requiredFile: string;
  fatalSymptom: string;
  message: string;
}

/**
 * LayaAir 3.4.2 完整 29 模組拓撲定義表 (含真實檔案大小與隱式全域依賴邊)
 */
export const ZHUDA_ENGINE_MODULES: readonly EngineModuleNode[] = [
  {
    id: 'core',
    file: 'laya.core.js',
    sizeBytes: 871452,
    feature: 'core',
    dependsOn: [],
    providesGlobals: ['Laya', 'Laya.Node', 'Laya.Sprite', 'Laya.ClassUtils'],
    priority: 10,
    painPointNote: '所有模組的根基底，定義全域 window.Laya 與 ClassUtils 反射系統'
  },
  {
    id: 'd3',
    file: 'laya.d3.js',
    sizeBytes: 689342,
    feature: '3d',
    dependsOn: ['core'],
    providesGlobals: ['Laya.Scene3D', 'Laya.Sprite3D', 'Laya.Camera', 'Laya.BlinnPhongMaterial'],
    priority: 20,
    painPointNote: '必須在 webgl_3D、physics3D、particle3D、postProcess 之前載入'
  },
  {
    id: 'webgl2d',
    file: 'laya.webgl_2D.js',
    sizeBytes: 280361,
    feature: '2d',
    dependsOn: ['core'],
    providesGlobals: ['Laya.WebGLRenderEngineFactory'],
    priority: 30,
    painPointNote: '2D WebGL 渲染管線後端，Laya.init 初始化前必須就緒'
  },
  {
    id: 'webgl3d',
    file: 'laya.webgl_3D.js',
    sizeBytes: 72249,
    feature: '3d',
    dependsOn: ['core', 'd3', 'webgl2d'],
    providesGlobals: ['Laya.WebGL3DRenderPass'],
    priority: 40,
    painPointNote: '依賴 laya.d3 與 webgl_2D，提供 3D WebGL 渲染設備實作'
  },
  {
    id: 'ui',
    file: 'laya.ui.js',
    sizeBytes: 110837,
    feature: 'ui',
    dependsOn: ['core', 'webgl2d'],
    providesGlobals: ['Laya.Button', 'Laya.Dialog', 'Laya.AutoBitmap'],
    priority: 50,
    painPointNote: '內部 Button 強依賴 AutoBitmap.setState，需搭配 RuntimeGuards 原型保護'
  },
  {
    id: 'physics2d',
    file: 'laya.physics2D.js',
    sizeBytes: 164237,
    feature: 'physics2d',
    dependsOn: ['core', 'webgl2d'],
    providesGlobals: ['Laya.Physics2D', 'Laya.Box2DShapeDef', 'Laya.RigidBody'],
    priority: 60,
    painPointNote: '定義 Laya.Physics2D 與 Box2DShapeDef，必須在 laya.box2D.js 與 laya.tilemap.js 之前'
  },
  {
    id: 'box2d',
    file: 'laya.box2D.js',
    sizeBytes: 1401774,
    feature: 'physics2d',
    dependsOn: ['core', 'physics2d'],
    providesGlobals: ['window.box2d', 'Laya.Physics2D.I._factory'],
    priority: 70,
    painPointNote: '頂層直接存取 Laya.Physics2D.I._factory，若早於 physics2D 載入會拋出 reading "I" 崩潰'
  },
  {
    id: 'bullet',
    file: 'laya.bullet.js',
    sizeBytes: 1232001,
    feature: 'physics3d',
    dependsOn: ['core', 'd3'],
    providesGlobals: ['Laya.Physics3D'],
    priority: 80,
    painPointNote: '裝配 Bullet 3D 物理核心，必須在 laya.physics3D.js 之前完成載入'
  },
  {
    id: 'physics3d',
    file: 'laya.physics3D.js',
    sizeBytes: 72533,
    feature: 'physics3d',
    dependsOn: ['core', 'd3', 'bullet'],
    providesGlobals: ['Laya.PhysicsCollider', 'Laya.Rigidbody3D', 'Laya.BoxColliderShape'],
    priority: 90,
    painPointNote: '掛載 3D 物理組件至 Laya3D，依賴 laya.bullet.js 已注入之工廠'
  },
  {
    id: 'spine-core-42',
    file: 'spine-core-4.2.js',
    sizeBytes: 466015,
    feature: 'spine42',
    dependsOn: ['core'],
    conflictsWith: ['spine-core-38'],
    providesGlobals: ['window.spine', 'window.spine.PhysicsConstraint', 'window.spine.AnimationState'],
    priority: 100,
    painPointNote: '定義全域 window.spine (4.2 PhysicsConstraint)，必須在 laya.spine.js 之前'
  },
  {
    id: 'spine',
    file: 'laya.spine.js',
    sizeBytes: 132824,
    feature: 'spine42',
    dependsOn: ['core', 'webgl2d', 'spine-core-42'],
    providesGlobals: ['Laya.SpineTemplet', 'Laya.Spine2DRenderNode'],
    priority: 110,
    painPointNote: '包含 3.4.2 ReusableStructList 與 SpineInstanceBatch 合批管線，依賴 spine-core-4.2.js'
  },
  {
    id: 'spine3d',
    file: 'laya.spine3D.js',
    sizeBytes: 15895,
    feature: 'spine3d',
    dependsOn: ['core', 'd3', 'spine-core-42', 'spine'],
    providesGlobals: ['Laya.Spine3DRenderNode'],
    priority: 120,
    painPointNote: '將 Spine 骨骼掛載至 3D 場景樹，必須在 laya.d3 與 laya.spine 之後'
  },
  {
    id: 'navmesh-common',
    file: 'laya.navMeshCommon.js',
    sizeBytes: 480255,
    feature: 'navmesh2d',
    dependsOn: ['core'],
    providesGlobals: ['Laya.RecastNavigation'],
    priority: 130,
    painPointNote: '定義 Recast 尋路共用基底，必須在 navMesh2d 與 navMesh3d 之前'
  },
  {
    id: 'navmesh2d',
    file: 'laya.navMesh2d.js',
    sizeBytes: 12000,
    feature: 'navmesh2d',
    dependsOn: ['core', 'navmesh-common'],
    providesGlobals: ['Laya.NavMesh2D'],
    priority: 140
  },
  {
    id: 'navmesh3d',
    file: 'laya.navMesh3d.js',
    sizeBytes: 12415,
    feature: 'navmesh3d',
    dependsOn: ['core', 'd3', 'navmesh-common'],
    providesGlobals: ['Laya.NavMesh3D'],
    priority: 150
  },
  {
    id: 'particle-common',
    file: 'laya.particleCommon.js',
    sizeBytes: 9402,
    feature: 'particle2d',
    dependsOn: ['core'],
    providesGlobals: ['Laya.GradientDataNumber'],
    priority: 160,
    painPointNote: '2D/3D 粒子共用插值基底，必須在 particle 與 particle3D 之前'
  },
  {
    id: 'particle2d',
    file: 'laya.particle.js',
    sizeBytes: 56958,
    feature: 'particle2d',
    dependsOn: ['core', 'webgl2d', 'particle-common'],
    providesGlobals: ['Laya.Particle2D'],
    priority: 170
  },
  {
    id: 'particle3d',
    file: 'laya.particle3D.js',
    sizeBytes: 169120,
    feature: 'particle3d',
    dependsOn: ['core', 'd3', 'particle-common'],
    providesGlobals: ['Laya.ShuriKenParticle3D'],
    priority: 180
  },
  {
    id: 'trail-common',
    file: 'laya.trailCommon.js',
    sizeBytes: 11971,
    feature: 'trail2d',
    dependsOn: ['core'],
    providesGlobals: ['Laya.TrailFilter'],
    priority: 190,
    painPointNote: '2D/3D 拖尾共用幾何構造基底，必須在 trail2D 與 trail3D 之前'
  },
  {
    id: 'trail2d',
    file: 'laya.trail2D.js',
    sizeBytes: 5537,
    feature: 'trail2d',
    dependsOn: ['core', 'webgl2d', 'trail-common'],
    providesGlobals: ['Laya.Trail2DRender'],
    priority: 200
  },
  {
    id: 'trail3d',
    file: 'laya.trail3D.js',
    sizeBytes: 8793,
    feature: 'trail3d',
    dependsOn: ['core', 'd3', 'trail-common'],
    providesGlobals: ['Laya.TrailSprite3D'],
    priority: 210
  },
  {
    id: 'light2d',
    file: 'laya.light2D.js',
    sizeBytes: 76531,
    feature: 'effects2d',
    dependsOn: ['core', 'webgl2d'],
    providesGlobals: ['Laya.Light2DRender'],
    priority: 220
  },
  {
    id: 'line2d',
    file: 'laya.line2D.js',
    sizeBytes: 12170,
    feature: 'effects2d',
    dependsOn: ['core', 'webgl2d'],
    providesGlobals: ['Laya.Line2DRender'],
    priority: 230
  },
  {
    id: 'tilemap',
    file: 'laya.tilemap.js',
    sizeBytes: 85504,
    feature: 'tilemap',
    dependsOn: ['core', 'webgl2d', 'physics2d'],
    providesGlobals: ['Laya.TileMapLayer'],
    priority: 240,
    painPointNote: '內部直接向 Box2DShapeDef 註冊瓦片碰撞體，若未先載入 laya.physics2D.js 會直接崩潰'
  },
  {
    id: 'ani',
    file: 'laya.ani.js',
    sizeBytes: 68047,
    feature: 'ani',
    dependsOn: ['core', 'webgl2d'],
    providesGlobals: ['Laya.Templet'],
    priority: 250
  },
  {
    id: 'gltf',
    file: 'laya.gltf.js',
    sizeBytes: 67581,
    feature: 'gltf',
    dependsOn: ['core', 'd3'],
    providesGlobals: ['Laya.glTFLoader'],
    priority: 260
  },
  {
    id: 'ik',
    file: 'laya.ik.js',
    sizeBytes: 52268,
    feature: 'ik',
    dependsOn: ['core', 'd3'],
    providesGlobals: ['Laya.IKConstraint'],
    priority: 270
  },
  {
    id: 'postProcess',
    file: 'laya.postProcess.js',
    sizeBytes: 92193,
    feature: 'postProcess',
    dependsOn: ['core', 'd3', 'webgl3d'],
    providesGlobals: ['Laya.PostProcess', 'Laya.BloomEffect'],
    priority: 280,
    painPointNote: '頂層自執行註冊 SubShader，必須在首幀 Camera 渲染前載入'
  },
  {
    id: 'device',
    file: 'laya.device.js',
    sizeBytes: 5963,
    feature: 'device',
    dependsOn: ['core'],
    providesGlobals: ['Laya.Accelerator', 'Laya.Geolocation'],
    priority: 290
  }
] as const;

export type PresetProfileName = '2d-light' | '3d-standard' | 'spine-hybrid' | 'full-all-in-one';

export const ENGINE_PRESET_PROFILES: Record<PresetProfileName, EngineFeatureTag[]> = {
  '2d-light': ['core', '2d', 'ui'],
  '3d-standard': ['core', '2d', '3d', 'ui', 'physics3d', 'postProcess', 'gltf'],
  'spine-hybrid': ['core', '2d', '3d', 'ui', 'spine42', 'spine3d', 'physics3d'],
  'full-all-in-one': [
    'core',
    '2d',
    '3d',
    'ui',
    'physics2d',
    'physics3d',
    'spine42',
    'spine3d',
    'navmesh2d',
    'navmesh3d',
    'particle2d',
    'particle3d',
    'trail2d',
    'trail3d',
    'effects2d',
    'tilemap',
    'ani',
    'gltf',
    'ik',
    'postProcess',
    'device'
  ]
};

/**
 * 拓撲圖解析器：給定需要的 Feature Tags 或 Module IDs，自動展開相依閉包並以 Kahn's 演算法輸出嚴格順序
 */
export class TopologyResolver {
  private static readonly moduleMap: Map<string, EngineModuleNode> = new Map(
    ZHUDA_ENGINE_MODULES.map((m) => [m.id, m])
  );

  private static readonly fileMap: Map<string, EngineModuleNode> = new Map(
    ZHUDA_ENGINE_MODULES.map((m) => [m.file, m])
  );

  public static getFullEngineSizeBytes(): number {
    return ZHUDA_ENGINE_MODULES.reduce((acc, m) => acc + m.sizeBytes, 0);
  }

  /**
   * 根據 Feature Tags 解析最小必備模組並執行拓撲排序
   */
  public static resolveByFeatures(features: EngineFeatureTag[] | 'all'): TopologyResolutionResult {
    const targetFeatures =
      features === 'all' ? ENGINE_PRESET_PROFILES['full-all-in-one'] : Array.from(new Set(['core', ...features]));

    const seedIds = ZHUDA_ENGINE_MODULES.filter((m) =>
      targetFeatures.includes(m.feature)
    ).map((m) => m.id);

    return this.resolveByModuleIds(seedIds);
  }

  /**
   * 根據 Module IDs 展開傳遞依賴閉包並以 Kahn's Algorithm 排序
   */
  public static resolveByModuleIds(seedModuleIds: string[]): TopologyResolutionResult {
    const closure = new Set<string>();
    const diagnostics: string[] = [];

    const visit = (id: string, chain: string[]) => {
      if (chain.includes(id)) {
        throw new Error(`[ZhudaTopology] 偵測到循環依賴 (Cycle Detected): ${[...chain, id].join(' -> ')}`);
      }
      const node = this.moduleMap.get(id);
      if (!node) {
        throw new Error(`[ZhudaTopology] 未知的引擎模組 ID: "${id}"`);
      }
      for (const depId of node.dependsOn) {
        if (!closure.has(depId)) {
          diagnostics.push(`[Auto-Dependency] 模組 "${node.file}" 自動拉入前置依賴 "${this.moduleMap.get(depId)?.file}"`);
        }
        visit(depId, [...chain, id]);
      }
      closure.add(id);
    };

    for (const seed of seedModuleIds) {
      visit(seed, []);
    }

    // 檢查互斥衝突
    for (const id of closure) {
      const node = this.moduleMap.get(id)!;
      if (node.conflictsWith) {
        for (const conflictId of node.conflictsWith) {
          if (closure.has(conflictId)) {
            throw new Error(`[ZhudaTopology] 模組互斥衝突: "${id}" 與 "${conflictId}" 不可同時載入`);
          }
        }
      }
    }

    // Kahn's Algorithm 拓撲排序 (以 priority 作為確定性 tie-breaker)
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const id of closure) {
      inDegree.set(id, 0);
      adj.set(id, []);
    }

    for (const id of closure) {
      const node = this.moduleMap.get(id)!;
      for (const depId of node.dependsOn) {
        adj.get(depId)!.push(id);
        inDegree.set(id, (inDegree.get(id) || 0) + 1);
      }
    }

    const readyQueue: EngineModuleNode[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        readyQueue.push(this.moduleMap.get(id)!);
      }
    }
    readyQueue.sort((a, b) => a.priority - b.priority);

    const orderedModules: EngineModuleNode[] = [];
    while (readyQueue.length > 0) {
      const current = readyQueue.shift()!;
      orderedModules.push(current);

      for (const neighborId of adj.get(current.id) || []) {
        const nextDeg = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, nextDeg);
        if (nextDeg === 0) {
          readyQueue.push(this.moduleMap.get(neighborId)!);
          readyQueue.sort((a, b) => a.priority - b.priority);
        }
      }
    }

    if (orderedModules.length !== closure.size) {
      throw new Error('[ZhudaTopology] 拓撲排序失敗：存在無法解開的依賴環');
    }

    const totalSizeBytes = orderedModules.reduce((acc, m) => acc + m.sizeBytes, 0);
    const fullSizeBytes = this.getFullEngineSizeBytes();
    const prunedRatioPercent = Number((((fullSizeBytes - totalSizeBytes) / fullSizeBytes) * 100).toFixed(1));

    return {
      orderedModules,
      orderedFiles: orderedModules.map((m) => m.file),
      totalSizeBytes,
      totalSizeKB: Number((totalSizeBytes / 1024).toFixed(1)),
      prunedRatioPercent: Math.max(0, prunedRatioPercent),
      fullEngineSizeBytes: fullSizeBytes,
      diagnostics
    };
  }

  /**
   * 靜態審計任意 script 載入序列，攔截順序倒置或遺漏依賴的致命錯誤
   */
  public static auditFileSequence(files: string[]): SequenceAuditIssue[] {
    const issues: SequenceAuditIssue[] = [];
    const seenFiles = new Set<string>();

    for (const file of files) {
      const node = this.fileMap.get(file);
      if (!node) {
        seenFiles.add(file);
        continue;
      }

      for (const depId of node.dependsOn) {
        const depNode = this.moduleMap.get(depId);
        if (!depNode) continue;

        if (!seenFiles.has(depNode.file)) {
          const isPresentLater = files.includes(depNode.file);
          issues.push({
            type: isPresentLater ? 'INVERTED_ORDER' : 'MISSING_DEPENDENCY',
            moduleFile: node.file,
            requiredFile: depNode.file,
            fatalSymptom: node.painPointNote || `${node.file} 需要在 ${depNode.file} 之後載入`,
            message: isPresentLater
              ? `[順序倒置死鎖] "${node.file}" 出現在前置依賴 "${depNode.file}" 之前！(${node.painPointNote || 'Global Mutation Error'})`
              : `[缺失前置依賴] 載入 "${node.file}" 前未載入必備庫 "${depNode.file}"！`
          });
        }
      }

      seenFiles.add(file);
    }

    return issues;
  }
}
