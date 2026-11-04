import type {
  DeclarativeCameraOptions,
  DeclarativeLightOptions,
  DeclarativeMaterialOptions,
  PrimitiveType3D,
} from "./zhuda-3d-physics";
import type { ZhudaClassMetadata } from "./zhuda-core";
import type { LayaHierarchyNodeData, LayaGraphicsCmdData } from "./zhuda-static-assets";
export declare class ZhudaPrefab {
  static instantiate(data: LayaHierarchyNodeData, parent?: Laya.Node, positionOverride?: { x: number; y: number }): Laya.Sprite;
  static applyGraphicsCommands(graphics: Laya.Graphics, commands: LayaGraphicsCmdData[]): void;
}
import type { GlassPanelOptions, VectorButtonStyle, NineSliceGridInput, NineSlicePanelOptions } from "./zhuda-2d-ui";
export declare class ZhudaUI {
  static createGlassPanel(parent: Laya.Node, opts: GlassPanelOptions): Laya.Sprite;
  static createVectorButton(parent: Laya.Node, x: number, y: number, text: string,
    style: VectorButtonStyle, onClick: () => void): {
      root: Laya.Sprite; label: Laya.Text; setStyleState(active: boolean): void;
    };
  static parseSizeGrid(input: NineSliceGridInput): [number, number, number, number, number];
  static formatSizeGrid(input: NineSliceGridInput): string;
  static createNineSlicePanel(parent: Laya.Node, opts: NineSlicePanelOptions): {
    root: Laya.Sprite;
    sizeGridTuple: [number, number, number, number, number];
    resizeNineSlice(width: number, height: number): void;
  };
}
export declare function zhudaComponent(
  meta: string | ZhudaClassMetadata,
): <T extends new (...args: any[]) => any>(ctor: T) => T;
export declare class Zhuda3D {
  static buildPrefabTree(spec: import('./prefabs/PrefabTree3D').PrefabTree3D): import('./prefabs/PrefabTree3D').PrefabTreeInstance3D;
  static createScene3D(
    parent: Laya.Node,
    options?: {
      name?: string;
      ambientColor?: [number, number, number, number];
    },
  ): Laya.Scene3D;
  static createCamera(
    scene: Laya.Scene3D,
    options: DeclarativeCameraOptions,
  ): Laya.Camera;
  static createDirectionalLight(
    scene: Laya.Scene3D,
    options?: DeclarativeLightOptions,
  ): { node: Laya.Sprite3D; light: Laya.DirectionLightCom };
  static createMaterial(
    options: DeclarativeMaterialOptions & { type: "pbr" },
  ): Laya.PBRStandardMaterial;
  static createMaterial(
    options: DeclarativeMaterialOptions & { type: "unlit" },
  ): Laya.UnlitMaterial;
  static createMaterial(
    options: Omit<DeclarativeMaterialOptions, "type"> & {
      type?: "blinn-phong";
    },
  ): Laya.BlinnPhongMaterial;
  static createMaterial(
    options: DeclarativeMaterialOptions,
  ): Laya.BlinnPhongMaterial | Laya.PBRStandardMaterial | Laya.UnlitMaterial;
  static createPrimitiveMesh(
    type: PrimitiveType3D,
    dims?: { width?: number; height?: number; depth?: number; radius?: number },
  ): Laya.Mesh;
}
