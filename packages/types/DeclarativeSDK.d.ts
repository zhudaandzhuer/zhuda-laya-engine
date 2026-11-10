// Generated from TypeScript source; run npm run types:generate.
import { type RendererDiagnostics } from './runtime3d/Renderer.js';
import type { RendererBackend } from './TopologyGraph.js';
import { ZhudaRuntimeSession } from './runtime3d/Runtime.js';
import type { ManagedRuntimeOptions } from './runtime3d/Runtime.js';
import type { PrefabTree3D, PrefabTreeInstance3D } from './prefabs/PrefabTree3D.js';
/**
 * @zhuda-laya/core — AI-Friendly Declarative SDK (對標 Three.js / R3F 純代碼開發體驗)
 *
 * 目標：
 * - 100% 純 TypeScript 宣告式建構 3D 場景、材質、燈光、相機與 2D 向量玻璃擬態 UI
 * - 不依賴 LayaAir IDE；同時支援可版本控制的 .lh/.ls 序列化與程序式建構
 * - 消除 AI 生成 Laya 程式碼時常見的 1.x / 2.x 廢棄 API 幻覺
 */
import { type EngineFeatureTag, type TopologyResolutionResult } from './TopologyGraph.js';
import { type EngineHealthReport } from './RuntimeGuards.js';
import type { DeclarativeCameraOptions, DeclarativeLightOptions, DeclarativeMaterialOptions, GlassPanelOptions, NineSliceGridInput, NineSlicePanelOptions, PrimitiveType3D, VectorButtonStyle, ZhudaClassMetadata } from './index.js';
export interface ZhudaBootOptions extends Omit<ManagedRuntimeOptions, 'container'> {
    container?: HTMLElement | string;
    antialias?: boolean;
    preserveDrawingBuffer?: boolean;
    width?: number;
    height?: number;
    bgColor?: string;
    scaleMode?: string;
    screenMode?: string;
    features?: EngineFeatureTag[] | 'all';
    beforeInit?: () => void;
    renderer?: RendererBackend;
    signal?: AbortSignal;
    /** Bounded native initialization, default 30 seconds. */
    bootTimeoutMs?: number;
}
export interface ZhudaBootContext {
    renderer: RendererDiagnostics;
    stage: Laya.Stage;
    rootScene: Laya.Scene;
    topology: TopologyResolutionResult;
    health: EngineHealthReport;
    canvas: HTMLCanvasElement;
    runtime: ZhudaRuntimeSession;
    resize(): void;
    dispose(): void;
}
/**
 * @zhudaComponent 裝飾器：脫離 IDE 時自動向 Laya.ClassUtils.regClass 與 EngineGuard 註冊類別反射
 */
export declare function zhudaComponent(meta: string | ZhudaClassMetadata): <T extends new (...args: any[]) => any>(ctor: T) => T;
/**
 * ZhudaEngine 核心啟動器：整合拓撲解析、原型解毒、WASM 守衛與 Stage 初始化
 */
export declare class ZhudaEngine {
    private static activeContext;
    private static booting;
    private static retiredGpuRealm;
    static boot(options?: ZhudaBootOptions): Promise<ZhudaBootContext>;
    static getContext(): ZhudaBootContext | null;
    /**
     * 立即推進指定幀數的 WebGL 渲染迴圈，確保首幀無白屏延遲
     */
    static flushRenderFrames(frameCount?: number): void;
}
/**
 * Zhuda3D：零幻覺 3D 宣告式建構器 (對標 Three.js Scene / Mesh / Material 直覺語法)
 */
export declare class Zhuda3D {
    static buildPrefabTree(spec: PrefabTree3D): PrefabTreeInstance3D;
    static createScene3D(parent: Laya.Node, options?: {
        name?: string;
        ambientColor?: [number, number, number, number];
    }): Laya.Scene3D;
    static createCamera(scene3D: Laya.Scene3D, options: DeclarativeCameraOptions): Laya.Camera;
    static createDirectionalLight(scene3D: Laya.Scene3D, options?: DeclarativeLightOptions): {
        node: Laya.Sprite3D;
        light: Laya.DirectionLightCom;
    };
    static createMaterial(options: DeclarativeMaterialOptions & {
        type: 'pbr';
    }): Laya.PBRStandardMaterial;
    static createMaterial(options: DeclarativeMaterialOptions & {
        type: 'unlit';
    }): Laya.UnlitMaterial;
    static createMaterial(options: Omit<DeclarativeMaterialOptions, 'type'> & {
        type?: 'blinn-phong';
    }): Laya.BlinnPhongMaterial;
    static createMaterial(options: DeclarativeMaterialOptions): Laya.BlinnPhongMaterial | Laya.PBRStandardMaterial | Laya.UnlitMaterial;
    static createPrimitiveMesh(type: PrimitiveType3D, dims?: {
        width?: number;
        height?: number;
        depth?: number;
        radius?: number;
    }): Laya.Mesh;
}
/**
 * ZhudaUI：免疫 AutoBitmap 崩潰的純代碼 2D 向量組件庫
 */
export declare class ZhudaUI {
    static createGlassPanel(parent: Laya.Node, opts: GlassPanelOptions): Laya.Sprite;
    static createVectorButton(parent: Laya.Node, x: number, y: number, text: string, style: VectorButtonStyle, onClick: () => void): {
        root: Laya.Sprite;
        label: Laya.Text;
        setStyleState: (active: boolean) => void;
    };
    /**
     * 解析 LayaAir 3.4.2 九宮格 (9-Slice / sizeGrid) 參數為標準 5 元組 [top, right, bottom, left, repeat]
     */
    static parseSizeGrid(input: NineSliceGridInput): [number, number, number, number, number];
    static formatSizeGrid(input: NineSliceGridInput): string;
    /**
     * 建構 9-Slice 九宮格無失真拉伸面板 (支援 Laya.Image.sizeGrid 與純向量 4 角鎖定網格)
     * 當面板從 baseWidth×baseHeight 拉伸至任意尺寸時，四個角落維持 1:1 物理像素大小不變形
     */
    static createNineSlicePanel(parent: Laya.Node, opts: NineSlicePanelOptions): {
        root: Laya.Sprite;
        sizeGridTuple: [number, number, number, number, number];
        resizeNineSlice: (newWidth: number, newHeight: number) => void;
    };
}
