import type {
  DeclarativeCameraOptions,
  DeclarativeLightOptions,
  DeclarativeMaterialOptions,
  PrimitiveType3D,
} from "./zhuda-3d-physics";
import type { ZhudaClassMetadata } from "./zhuda-core";
export declare function zhudaComponent(
  meta: string | ZhudaClassMetadata,
): <T extends new (...args: any[]) => any>(ctor: T) => T;
export declare class Zhuda3D {
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
