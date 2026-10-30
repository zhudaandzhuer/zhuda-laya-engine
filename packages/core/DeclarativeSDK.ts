import {
  ZhudaRuntimeSession,
  installSandboxStorageFallback,
} from "./runtime3d/Runtime.ts";
import type { ManagedRuntimeOptions } from "./runtime3d/Runtime.ts";
import { createSurfaceMaterial } from "./runtime3d/Surfaces.ts";
import { installLaya342LifecycleFix } from "./runtime3d/Laya342Adapters.ts";
/**
 * @zhuda-laya/core — AI-Friendly Declarative SDK (對標 Three.js / R3F 純代碼開發體驗)
 *
 * 目標：
 * - 100% 純 TypeScript 宣告式建構 3D 場景、材質、燈光、相機與 2D 向量玻璃擬態 UI
 * - 內建 @zhudaComponent 裝飾器與自動類別反射，完全脫離 LayaAir IDE (.laya / .lh / .ls)
 * - 消除 AI 生成 Laya 程式碼時常見的 1.x / 2.x 廢棄 API 幻覺
 */

import {
  type EngineFeatureTag,
  type TopologyResolutionResult,
  TopologyResolver,
} from "./TopologyGraph.ts";
import { EngineGuard, type EngineHealthReport } from "./RuntimeGuards.ts";
import type {
  DeclarativeCameraOptions,
  DeclarativeLightOptions,
  DeclarativeMaterialOptions,
  GlassPanelOptions,
  NineSliceGridInput,
  NineSlicePanelOptions,
  PrimitiveType3D,
  VectorButtonStyle,
  ZhudaClassMetadata,
} from "../types/index.ts";

export interface ZhudaBootOptions
  extends Omit<ManagedRuntimeOptions, "container"> {
  container?: HTMLElement | string;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  width?: number;
  height?: number;
  bgColor?: string;
  scaleMode?: string;
  screenMode?: string;
  features?: EngineFeatureTag[] | "all";
  beforeInit?: () => void;
}

export interface ZhudaBootContext {
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
export function zhudaComponent(meta: string | ZhudaClassMetadata) {
  return function <T extends new (...args: any[]) => any>(ctor: T): T {
    const metadata: ZhudaClassMetadata =
      typeof meta === "string" ? { className: meta } : meta;
    EngineGuard.registerComponent(metadata.className, ctor, metadata.assetId);
    return ctor;
  };
}

/**
 * ZhudaEngine 核心啟動器：整合拓撲解析、原型解毒、WASM 守衛與 Stage 初始化
 */
export class ZhudaEngine {
  private static activeContext: ZhudaBootContext | null = null;
  private static booting = false;

  public static async boot(
    options: ZhudaBootOptions = {},
  ): Promise<ZhudaBootContext> {
    if (this.activeContext || this.booting)
      throw new Error(
        "An engine session is already active; dispose it or use a separate runtime realm.",
      );
    const container =
      typeof options.container === "string"
        ? document.querySelector<HTMLElement>(options.container)
        : options.container;
    if (options.container && !container)
      throw new Error("Canvas container not found");
    if (
      options.dprCap !== undefined &&
      (!Number.isFinite(options.dprCap) ||
        options.dprCap < 0.5 ||
        options.dprCap > 4)
    )
      throw new Error("DPR cap must be .5..4");
    this.booting = true;
    let allocatedScene: Laya.Scene | undefined;
    try {
      const width = options.width ?? 1280;
      const height = options.height ?? 720;
      const bgColor = options.bgColor ?? "#0d1117";
      const features = options.features ?? "all";

      // 1. 解析拓撲圖與按需模組清單
      const topology = TopologyResolver.resolveByFeatures(features);

      // 2. 安裝原型解毒補丁 (修復 Button AutoBitmap.setState 與反射攔截)
      if (typeof window !== "undefined") installSandboxStorageFallback();
      EngineGuard.installPrototypeDetox();

      // 2.1 Spine 4.2 核心規格設定 (保證 NEED_SLOT=true 與 VersionFirst=4，消除世界頂點計算異常)
      const hasSpine42 =
        features === "all" ||
        (Array.isArray(features) && features.includes("spine42"));
      if (hasSpine42) {
        const spineConst = (
          Laya as unknown as {
            SpineConst?: {
              VERSION: string;
              VersionFirst: number;
              VersionSecond: number;
              NEED_SLOT: boolean;
            };
          }
        ).SpineConst;
        if (spineConst) {
          spineConst.VERSION = "4.2";
          spineConst.VersionFirst = 4;
          spineConst.VersionSecond = 2;
          spineConst.NEED_SLOT = true;
        }
      }

      const layaConfig = (Laya as any).Config;
      // Preserve native production defaults unless explicitly configured. Callbacks remain authoritative.
      if (layaConfig) {
        if (options.preserveDrawingBuffer !== undefined)
          layaConfig.preserveDrawingBuffer = options.preserveDrawingBuffer;
        if (options.antialias !== undefined)
          layaConfig.isAntialias = options.antialias;
      }
      options.beforeInit?.();

      // 3. 初始化 LayaAir 3.4.2 引擎核心與 WebGL/WASM 管線
      await Laya.init(width, height);
      installLaya342LifecycleFix();

      // 再次確認原型解毒補丁在 Laya.init 後保持生效
      EngineGuard.installPrototypeDetox();

      Laya.stage.scaleMode = options.scaleMode ?? Laya.Stage.SCALE_SHOWALL;
      Laya.stage.screenMode = options.screenMode ?? Laya.Stage.SCREEN_NONE;
      Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
      Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
      Laya.stage.bgColor = bgColor;

      // 4. 建立根場景並開啟
      const rootScene = (allocatedScene = new Laya.Scene());
      rootScene.name = "ZhudaRootScene";
      Laya.stage.addChild(rootScene);

      const health = EngineGuard.inspectEngineHealth();

      // 暴露全域遙測供 Headless Chrome CI Gate 與 MCP 診斷讀取
      const win = globalThis as unknown as {
        __ZHUDA_ENGINE_BOOTED__?: boolean;
        __ZHUDA_ENGINE_HEALTH__?: EngineHealthReport;
        __ZHUDA_TOPOLOGY__?: TopologyResolutionResult;
      };
      win.__ZHUDA_ENGINE_BOOTED__ = true;
      win.__ZHUDA_ENGINE_HEALTH__ = health;
      win.__ZHUDA_TOPOLOGY__ = topology;

      if (typeof document !== "undefined" && document.body) {
        document.body.dataset.zhudaBooted = "true";
        document.body.dataset.zhudaModules = String(
          topology.orderedFiles.length,
        );
        document.body.dataset.zhudaReflected =
          health.registeredComponents.join(",");
        document.body.dataset.zhudaSpine42 = String(
          health.spine42.hasPhysicsConstraint,
        );
        document.body.dataset.zhudaDetox = String(health.buttonSetStateGuarded);
      }

      const canvas = (Laya as any).Browser.mainCanvas
        .source as HTMLCanvasElement;
      if (container) container.appendChild(canvas);
      if (options.targetFPS)
        Laya.stage.frameRate = options.targetFPS === 30 ? "slow" : "fast";
      const runtime = new ZhudaRuntimeSession(canvas, {
        ...options,
        container,
      });
      let disposed = false;
      this.activeContext = {
        stage: Laya.stage,
        rootScene,
        topology,
        health,
        canvas,
        runtime,
        resize: () => runtime.resize(),
        dispose: () => {
          if (disposed) return;
          disposed = true;
          runtime.dispose();
          rootScene.destroy(true);
          this.activeContext = null;
        },
      };

      return this.activeContext;
    } catch (error) {
      allocatedScene?.destroy(true);
      (globalThis as any).__ZHUDA_ENGINE_BOOTED__ = false;
      if (typeof document !== "undefined" && document.body)
        document.body.dataset.zhudaBooted = "false";
      throw error;
    } finally {
      this.booting = false;
    }
  }

  public static getContext(): ZhudaBootContext | null {
    return this.activeContext;
  }

  /**
   * 立即推進指定幀數的 WebGL 渲染迴圈，確保首幀無白屏延遲
   */
  public static flushRenderFrames(frameCount: number = 3): void {
    const renderLoop = (
      Laya as unknown as { Render?: { loop?: (t: number) => void } }
    ).Render?.loop;
    if (typeof renderLoop === "function") {
      const baseNow =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      for (let i = 1; i <= frameCount; i++) {
        renderLoop.call(
          (Laya as unknown as { Render: unknown }).Render,
          baseNow + i * 16.67,
        );
      }
    }
  }
}

/**
 * Zhuda3D：零幻覺 3D 宣告式建構器 (對標 Three.js Scene / Mesh / Material 直覺語法)
 */
export class Zhuda3D {
  public static createScene3D(
    parent: Laya.Node,
    options: {
      name?: string;
      ambientColor?: [number, number, number, number];
    } = {},
  ): Laya.Scene3D {
    const scene3D = new Laya.Scene3D();
    scene3D.name = options.name ?? "ZhudaScene3D";
    scene3D.ambientMode = Laya.AmbientMode.SolidColor;
    const [r, g, b, a] = options.ambientColor ?? [0.42, 0.47, 0.58, 1];
    scene3D.ambientColor = new Laya.Color(r, g, b, a);
    parent.addChild(scene3D);
    return scene3D;
  }

  public static createCamera(
    scene3D: Laya.Scene3D,
    options: DeclarativeCameraOptions,
  ): Laya.Camera {
    const camera = new Laya.Camera(0, options.near ?? 0.1, options.far ?? 1000);
    camera.fieldOfView = options.fov ?? 50;
    if (options.clearColor) {
      const [r, g, b, a] = options.clearColor;
      camera.clearColor = new Laya.Color(r, g, b, a);
    }
    const [px, py, pz] = options.position;
    camera.transform.position = new Laya.Vector3(px, py, pz);
    if (options.rotationEuler) {
      const [rx, ry, rz] = options.rotationEuler;
      camera.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
    }
    scene3D.addChild(camera);
    return camera;
  }

  public static createDirectionalLight(
    scene3D: Laya.Scene3D,
    options: DeclarativeLightOptions = {},
  ): { node: Laya.Sprite3D; light: Laya.DirectionLightCom } {
    const node = new Laya.Sprite3D("ZhudaDirectionalLight");
    scene3D.addChild(node);
    const light = node.addComponent(
      Laya.DirectionLightCom,
    ) as Laya.DirectionLightCom;
    const [r, g, b, a] = options.color ?? [1, 0.98, 0.92, 1];
    light.color = new Laya.Color(r, g, b, a);
    light.intensity = options.intensity ?? 1.3;
    const [rx, ry, rz] = options.rotationEuler ?? [-55, 35, 0];
    node.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
    return { node, light };
  }

  public static createMaterial(
    options: DeclarativeMaterialOptions & { type: "pbr" },
  ): Laya.PBRStandardMaterial;
  public static createMaterial(
    options: DeclarativeMaterialOptions & { type: "unlit" },
  ): Laya.UnlitMaterial;
  public static createMaterial(
    options: Omit<DeclarativeMaterialOptions, "type"> & {
      type?: "blinn-phong";
    },
  ): Laya.BlinnPhongMaterial;
  public static createMaterial(
    options: DeclarativeMaterialOptions,
  ): Laya.BlinnPhongMaterial | Laya.PBRStandardMaterial | Laya.UnlitMaterial;
  public static createMaterial(
    options: DeclarativeMaterialOptions,
  ): Laya.BlinnPhongMaterial | Laya.PBRStandardMaterial | Laya.UnlitMaterial {
    if (options.type === "pbr" || options.type === "unlit")
      return createSurfaceMaterial({
        type: options.type,
        color: options.albedoColor,
        metallic: options.metallic,
        roughness: 1 - (options.smoothness ?? 0.5),
      });
    const mat = new Laya.BlinnPhongMaterial();
    const [r, g, b, a] = options.albedoColor;
    mat.albedoColor = new Laya.Color(r, g, b, a);
    mat.shininess = options.shininess ?? 32;
    return mat;
  }

  public static createPrimitiveMesh(
    type: PrimitiveType3D,
    dims: {
      width?: number;
      height?: number;
      depth?: number;
      radius?: number;
    } = {},
  ): Laya.Mesh {
    switch (type) {
      case "box":
        return Laya.PrimitiveMesh.createBox(
          dims.width ?? 1,
          dims.height ?? 1,
          dims.depth ?? 1,
        );
      case "sphere":
        return Laya.PrimitiveMesh.createSphere(dims.radius ?? 0.5);
      case "cylinder":
        return Laya.PrimitiveMesh.createCylinder(
          dims.radius ?? 0.2,
          dims.height ?? 1,
        );
      case "capsule":
        return Laya.PrimitiveMesh.createCapsule(
          dims.radius ?? 0.25,
          dims.height ?? 1,
        );
      case "cone":
        return Laya.PrimitiveMesh.createCone(
          dims.radius ?? 0.5,
          dims.height ?? 1,
        );
      case "plane":
      default:
        return Laya.PrimitiveMesh.createPlane(
          dims.width ?? 10,
          dims.depth ?? 10,
        );
    }
  }
}

/**
 * ZhudaUI：免疫 AutoBitmap 崩潰的純代碼 2D 向量組件庫
 */
export class ZhudaUI {
  public static createGlassPanel(
    parent: Laya.Node,
    opts: GlassPanelOptions,
  ): Laya.Sprite {
    const panel = new Laya.Sprite();
    panel.pos(opts.x, opts.y);
    panel.size(opts.width, opts.height);
    const r = opts.radius ?? 12;
    const g = new Laya.Graphics();
    g.drawRoundRect(
      0,
      0,
      opts.width,
      opts.height,
      r,
      r,
      r,
      r,
      opts.fillColor ?? "#161f2ee6",
      opts.borderColor ?? "#30435f",
      opts.borderWidth ?? 1.5,
    );
    panel.graphics = g;
    parent.addChild(panel);
    return panel;
  }

  public static createVectorButton(
    parent: Laya.Node,
    x: number,
    y: number,
    text: string,
    style: VectorButtonStyle,
    onClick: () => void,
  ): {
    root: Laya.Sprite;
    label: Laya.Text;
    setStyleState: (active: boolean) => void;
  } {
    const root = new Laya.Sprite();
    root.pos(x, y);
    root.size(style.width, style.height);

    const radius = style.radius ?? 8;
    const bgColor = style.bgColor ?? "#22334a";
    const hoverBgColor = style.hoverBgColor ?? "#2e4666";
    const activeBgColor = style.activeBgColor ?? "#1b5e5a";
    const borderColor = style.borderColor ?? "#416188";
    const borderWidth = style.borderWidth ?? 1.2;

    const drawBg = (fill: string, stroke: string) => {
      const g = new Laya.Graphics();
      g.drawRoundRect(
        0,
        0,
        style.width,
        style.height,
        radius,
        radius,
        radius,
        radius,
        fill,
        stroke,
        borderWidth,
      );
      root.graphics = g;
    };

    drawBg(bgColor, borderColor);

    const label = new Laya.Text();
    label.text = text;
    label.fontSize = style.fontSize ?? 13;
    label.bold = style.bold ?? true;
    label.color = style.textColor ?? "#d6e6fa";
    label.align = "center";
    label.valign = "middle";
    label.width = style.width;
    label.height = style.height;
    root.addChild(label);

    let isActive = false;

    root.mouseEnabled = true;
    root.on(Laya.Event.MOUSE_OVER, root, () => {
      drawBg(isActive ? activeBgColor : hoverBgColor, "#64ffda");
      label.color = style.hoverTextColor ?? "#ffffff";
    });
    root.on(Laya.Event.MOUSE_OUT, root, () => {
      drawBg(
        isActive ? activeBgColor : bgColor,
        isActive ? "#00e5ff" : borderColor,
      );
      label.color = isActive ? "#64ffda" : (style.textColor ?? "#d6e6fa");
    });
    root.on(Laya.Event.CLICK, root, onClick);

    parent.addChild(root);

    const setStyleState = (active: boolean) => {
      isActive = active;
      drawBg(
        isActive ? activeBgColor : bgColor,
        isActive ? "#00e5ff" : borderColor,
      );
      label.color = isActive ? "#64ffda" : (style.textColor ?? "#d6e6fa");
    };

    return { root, label, setStyleState };
  }

  /**
   * 解析 LayaAir 3.4.2 九宮格 (9-Slice / sizeGrid) 參數為標準 5 元組 [top, right, bottom, left, repeat]
   */
  public static parseSizeGrid(
    input: NineSliceGridInput,
  ): [number, number, number, number, number] {
    if (Array.isArray(input)) {
      return [
        Number(input[0] ?? 16),
        Number(input[1] ?? 16),
        Number(input[2] ?? 16),
        Number(input[3] ?? 16),
        Number(input[4] ?? 0),
      ];
    }
    const parts = String(input || "16,16,16,16,0")
      .split(",")
      .map((s) => Number(s.trim()));
    return [
      Number.isFinite(parts[0]) ? parts[0] : 16,
      Number.isFinite(parts[1]) ? parts[1] : 16,
      Number.isFinite(parts[2]) ? parts[2] : 16,
      Number.isFinite(parts[3]) ? parts[3] : 16,
      Number.isFinite(parts[4]) ? parts[4] : 0,
    ];
  }

  public static formatSizeGrid(input: NineSliceGridInput): string {
    return this.parseSizeGrid(input).join(",");
  }

  /**
   * 建構 9-Slice 九宮格無失真拉伸面板 (支援 Laya.Image.sizeGrid 與純向量 4 角鎖定網格)
   * 當面板從 baseWidth×baseHeight 拉伸至任意尺寸時，四個角落維持 1:1 物理像素大小不變形
   */
  public static createNineSlicePanel(
    parent: Laya.Node,
    opts: NineSlicePanelOptions,
  ): {
    root: Laya.Sprite;
    sizeGridTuple: [number, number, number, number, number];
    resizeNineSlice: (newWidth: number, newHeight: number) => void;
  } {
    const gridTuple = this.parseSizeGrid(opts.sizeGrid);
    const [top, right, bottom, left] = gridTuple;
    const formattedGrid = gridTuple.join(",");

    const gGlobal = globalThis as unknown as {
      Laya?: {
        Image?: new () => Laya.Sprite & { sizeGrid?: string; skin?: string };
      };
    };
    const root: Laya.Sprite & { sizeGrid?: string; skin?: string } =
      opts.skin && gGlobal.Laya?.Image
        ? new gGlobal.Laya.Image()
        : new Laya.Sprite();

    root.name = "ZhudaNineSlicePanel";
    root.pos(opts.x, opts.y);
    root.size(opts.width, opts.height);
    root.sizeGrid = formattedGrid;
    if (opts.skin) {
      root.skin = opts.skin;
    }

    let titleNode: Laya.Text | null = null;
    if (opts.titleText) {
      titleNode = new Laya.Text();
      titleNode.name = "NineSliceTitle";
      titleNode.text = opts.titleText;
      titleNode.fontSize = 13;
      titleNode.bold = true;
      titleNode.color = opts.titleColor ?? "#7df9ff";
      titleNode.align = "center";
      titleNode.valign = "middle";
      root.addChild(titleNode);
    }

    const drawSlices = (w: number, h: number) => {
      root.size(w, h);
      const radius = opts.radius ?? 10;
      const fill = opts.fillColor ?? "#132036";
      const border = opts.borderColor ?? "#38bdf8";
      const cornerColor = opts.cornerAccentColor ?? "#2dd4bf";
      const innerColor = opts.innerSurfaceColor ?? "#0c1524";

      const g = new Laya.Graphics();
      // 1. 外層主基底
      g.drawRoundRect(
        0,
        0,
        w,
        h,
        radius,
        radius,
        radius,
        radius,
        fill,
        border,
        2,
      );
      // 2. 中央雙向拉伸區 (Center Slice #5)
      const cw = Math.max(4, w - left - right);
      const ch = Math.max(4, h - top - bottom);
      g.drawRect(left, top, cw, ch, innerColor, "#233858", 1);
      // 3. 四角 1:1 鎖定保護錨塊 (Slices #1, #3, #7, #9 — 尺寸恆定為 left×top 等，永不隨長寬變形)
      g.drawRoundRect(
        0,
        0,
        left,
        top,
        radius,
        2,
        2,
        2,
        cornerColor,
        border,
        1.5,
      );
      g.drawRoundRect(
        w - right,
        0,
        right,
        top,
        2,
        radius,
        2,
        2,
        cornerColor,
        border,
        1.5,
      );
      g.drawRoundRect(
        0,
        h - bottom,
        left,
        bottom,
        2,
        2,
        2,
        radius,
        cornerColor,
        border,
        1.5,
      );
      g.drawRoundRect(
        w - right,
        h - bottom,
        right,
        bottom,
        2,
        2,
        radius,
        2,
        cornerColor,
        border,
        1.5,
      );
      root.graphics = g;

      if (titleNode) {
        titleNode.pos(left, 0);
        titleNode.size(cw, h);
      }
    };

    drawSlices(opts.width, opts.height);
    parent.addChild(root);

    return {
      root,
      sizeGridTuple: gridTuple,
      resizeNineSlice: (newWidth: number, newHeight: number) =>
        drawSlices(newWidth, newHeight),
    };
  }
}
