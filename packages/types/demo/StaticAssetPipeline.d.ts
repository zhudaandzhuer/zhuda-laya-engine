// Generated from TypeScript source; run npm run types:generate.
/**
 * @zhuda-laya/core — 基建六：動態轉靜態資產序列化器與預製體組裝管線 (StaticAssetPipeline)
 *
 * 實踐「先設計、轉靜態資產 (.lh / .ls)、孤立微預覽、像素/色差校準，最後再組裝」的 AI-Native 工作流：
 * 1. ZhudaAssetSerializer：支援將運行期動態建立的 Laya 節點樹反向序列化為標準 LayaAir 3.4.2 .lh / .ls JSON
 *    （自動顯式標註 Draw*Cmd 的 percent: false，避免 Laya 3.4.2 預設 percent: true 導致座標放大百倍的陷阱）
 * 2. 內建 UI Prefab、Spine 4.2 PhysicsConstraint 靜態骨骼資產、Particle 決定性粒子爆發資產藍圖
 * 3. ZhudaPrefab：基於 Laya.HierarchyParser.parse 毫秒級實例化靜態資產並掛載 @zhudaComponent 腳本
 */
import type { AutoFixPatch, LayaHierarchyNodeData, ParticleEmitterStaticConfig, PixelCalibrationSpec, Spine42StaticRigConfig, StaticAssetCategory } from '../index.js';
export declare class ZhudaAssetSerializer {
    private static idCounter;
    private static nextId;
    /**
     * 將運行期動態建立的 Laya.Node / Laya.Sprite 節點樹，無損反向序列化為標準 LayaAir 3.4.2 .lh JSON 結構
     */
    static serializeNodeToHierarchy(node: any, options?: {
        assetId?: string;
        category?: StaticAssetCategory;
        designCanvas?: {
            width: number;
            height: number;
            padding: number;
        };
        targetSpec?: PixelCalibrationSpec;
        isRoot?: boolean;
    }): LayaHierarchyNodeData;
    private static detectLayaNodeType;
    private static serializeGraphicsCmd;
    /**
     * 建構「戰術確認按鈕」靜態 Prefab (.lh)
     * 支援產出 'uncalibrated-drift' (含 +3px 寬度偏差與色差 ΔE=6.1) 與 'calibrated' (0px 誤差 / ΔE=0.00)
     */
    static buildConfirmButtonPrefab(variant?: 'calibrated' | 'uncalibrated-drift'): LayaHierarchyNodeData;
    /**
     * 建構「戰術 LED 頂部狀態列」靜態 UI Prefab (.lh)
     */
    static buildTacticalHudBarPrefab(): LayaHierarchyNodeData;
    /**
     * 建構「Spine 4.2 PhysicsConstraint 豬大守護精靈」靜態骨骼資產 (.lh)
     * 先在靜態層校準各部位骨骼座標與配色，再於組裝階段由 Spine42PhysicsRigComponent 驅動二階彈簧擺
     */
    static buildSpine42MascotPrefab(overrides?: Partial<Spine42StaticRigConfig>): LayaHierarchyNodeData;
    /**
     * 建構「戰術爆破粒子發射器」靜態資產 (.lh)
     * 以決定性種子 (seed=20261028) 烘焙 t=240ms 的快照供微預覽與像素/色差校準，並附帶運行期發射器組件
     */
    static buildParticleExplosionPrefab(overrides?: Partial<ParticleEmitterStaticConfig>): LayaHierarchyNodeData;
    /**
     * 建構「6 大基建遙測儀表板」靜態 UI Prefab (.lh)
     */
    static buildTelemetryDashboardPrefab(): LayaHierarchyNodeData;
    /**
     * 建構「M1 九宮格 (9-Slice / sizeGrid) 無失真戰術對話框」靜態 Prefab (.lh)
     * 基準尺寸 160×80，拉伸至 320×140 (2.0x 寬, 1.75x 高)，四角錨塊恆定鎖死為 16×16px 零變形
     */
    static buildNineSliceDialogPrefab(stretchedWidth?: number, stretchedHeight?: number): LayaHierarchyNodeData;
    /**
     * 建構「M4 特效藍圖庫：勝利金幣噴泉 (CoinFountainVfx.lh)」決定性靜態資產 (@ t=280ms)
     */
    static buildCoinFountainVfxPrefab(): LayaHierarchyNodeData;
    /**
     * 建構「M4 特效藍圖庫：戰術刀光劍氣拖尾 (SwordSlashTrailVfx.lh)」決定性靜態資產 (@ t=120ms)
     */
    static buildSwordSlashVfxPrefab(): LayaHierarchyNodeData;
    /**
     * 建構「M4 特效藍圖庫：升級覺醒法陣光環 (LevelUpAuraVfx.lh)」決定性靜態資產 (@ t=320ms)
     */
    static buildLevelUpAuraVfxPrefab(): LayaHierarchyNodeData;
    /**
     * 建構組裝後的主場景靜態階層樹 (MinesweeperStage.ls)
     */
    static buildMinesweeperSceneAsset(): LayaHierarchyNodeData;
    /**
     * 取得所有內建預先設計之靜態資產清單 (涵蓋 UI、9-Slice、Spine 4.2、VFX 特效藍圖與 Unity 移植預製體)
     */
    static getAllBuiltinStaticAssets(): Record<string, LayaHierarchyNodeData>;
    /**
     * 依據 PixelCalibrationEngine 產出的 AutoFixPatch 自動修正靜態 .lh 資產數值
     */
    static applyCalibrationPatches(sourceData: LayaHierarchyNodeData, patches: AutoFixPatch[]): LayaHierarchyNodeData;
}
/**
 * ZhudaPrefab：後組裝階段 (Assembly Phase) 實例化器
 * 結合 Laya.HierarchyParser.parse 與安全指令水合 (Hydration)，確保任何 .lh 資產在 1ms 內精準掛載
 */
