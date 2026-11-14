// Generated from TypeScript source; run npm run types:generate.
export type RendererBackend = 'webgl' | 'webgpu';
/**
 * @zhuda-laya/core — Topological Dependency Graph & Tree-Pruning Resolver
 *
 * 解決痛點一：隱性拓撲相依與加載順序死鎖 (Global Mutation Deadlock)
 * - 以有向無環圖 (DAG) + Kahn's 拓撲排序演算法，強制確保 31 個核心與擴展庫（WebGPU 為 33 個）的載入順序 100% 正確
 * - 支援按需特徵剪枝 (On-Demand Feature Pruning)，脫離 IDE 也能精確控制打包體積
 */
export type EngineFeatureTag = 'core' | '2d' | '3d' | 'ui' | 'ui2' | 'physics2d' | 'physics3d' | 'spine38' | 'spine42' | 'spine3d' | 'navmesh2d' | 'navmesh3d' | 'particle2d' | 'particle3d' | 'trail2d' | 'trail3d' | 'effects2d' | 'tilemap' | 'gltf' | 'ik' | 'postProcess' | 'device' | 'ani';
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
    renderer: RendererBackend;
    supportFiles: string[];
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
 * LayaAir 3.4.2 完整 31 模組拓撲定義表（WebGPU 表為 33 個） (含真實檔案大小與隱式全域依賴邊)
 *
 * `providesGlobals` are paths from the global object that the module's own
 * vendored file defines while it loads; `EngineGuard.inspectEngineHealth`
 * counts a module as loaded when all are present. tests/topology-globals.test.mjs
 * checks every name and `sizeBytes` against vendor/laya-3.4.2/libs.
 */
export declare const ZHUDA_ENGINE_MODULES: readonly EngineModuleNode[];
export type PresetProfileName = '2d-light' | '3d-standard' | 'spine-hybrid' | 'full-all-in-one';
export declare const ENGINE_PRESET_PROFILES: Record<PresetProfileName, EngineFeatureTag[]>;
/**
 * 拓撲圖解析器：給定需要的 Feature Tags 或 Module IDs，自動展開相依閉包並以 Kahn's 演算法輸出嚴格順序
 */
export declare class TopologyResolver {
    private static readonly moduleMap;
    private static readonly fileMap;
    static getFullEngineSizeBytes(): number;
    /**
     * 根據 Feature Tags 解析最小必備模組並執行拓撲排序
     */
    static resolveByFeatures(features: EngineFeatureTag[] | 'all', renderer?: RendererBackend): TopologyResolutionResult;
    /**
     * 根據 Module IDs 展開傳遞依賴閉包並以 Kahn's Algorithm 排序
     */
    static resolveByModuleIds(seedModuleIds: string[], renderer?: RendererBackend): TopologyResolutionResult;
    /**
     * 靜態審計任意 script 載入序列，攔截順序倒置或遺漏依賴的致命錯誤
     */
    static auditFileSequence(files: string[]): SequenceAuditIssue[];
}
