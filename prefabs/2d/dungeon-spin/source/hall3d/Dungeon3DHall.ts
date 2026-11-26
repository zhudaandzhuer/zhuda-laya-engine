/**
 * src/presentation/dungeon-slot/Dungeon3DHall.ts
 * 迷宮一閃 · 3D 石廊地城景觀 (以 @zhuda-laya/core 之 Zhuda3D 宣告式 SDK 構建)
 * 1:1 還原 12×24 石磚地面、兩側石柱裝飾、火把光源、深青迷霧 (#102c31) 與呼吸前推感
 */

import { Zhuda3D } from "zhuda-laya-engine";

export class Dungeon3DHall {
  public scene3D: any;
  public camera: any;
  public floorMesh: any;
  public columns: any[] = [];
  public torchNodes: any[] = [];

  constructor() {
    this.createDungeonScene();
  }

  private createDungeonScene(): void {
    if (typeof Laya === 'undefined' || !Laya.Scene3D) return;

    this.scene3D = new Laya.Scene3D();

    // 1. 攝影機設置 (透過 Zhuda3D 宣告式 SDK 建立，安全對齊 3.4.2 內核)
    this.camera = Zhuda3D.createCamera(this.scene3D, {
      fov: 43,
      near: 0.1,
      far: 100,
      position: [0, 3.2, 10],
      rotationEuler: [-10, 0, 0],
      clearColor: [16 / 255, 44 / 255, 49 / 255, 1.0]
    });

    // 設定歸一化視口，精確將 3D 地城限制在 template-v2.png 的上半部石廊視窗內
    if (this.camera && Laya.Viewport) {
      this.camera.normalizedViewport = new Laya.Viewport(7 / 572, 128 / 1024, 558 / 572, 448 / 1024);
    }

    // 2. 主方向光 (暗環境冷光)
    Zhuda3D.createDirectionalLight(this.scene3D, {
      color: [0.2, 0.3, 0.35, 1.0],
      intensity: 1.0,
      rotationEuler: [-45, 30, 0]
    });

    // 3. 深青色迷霧 (Fog 濃度 0.055, 顏色 #102c31)
    if (this.scene3D.enableFog !== undefined) {
      this.scene3D.enableFog = true;
      if (Laya.Color) {
        this.scene3D.fogColor = new Laya.Color(16 / 255, 44 / 255, 49 / 255, 1.0);
      }
      this.scene3D.fogStart = 6;
      this.scene3D.fogRange = 32;
    }

    // 4. 地面 12x24 石磚鋪陳
    try {
      const floorMesh = Zhuda3D.createPrimitiveMesh('box', { width: 12, height: 0.2, depth: 28 });
      this.floorMesh = new Laya.MeshSprite3D(floorMesh);
      this.floorMesh.transform.position = new Laya.Vector3(0, -0.1, 0);

      const floorMat = Zhuda3D.createMaterial({
        albedoColor: [0.12, 0.15, 0.18, 1.0],
        shininess: 16
      });
      this.floorMesh.meshRenderer.material = floorMat;
      this.scene3D.addChild(this.floorMesh);
    } catch (e) {
      console.warn('[Dungeon3DHall] 地面建立略過:', e);
    }

    // 5. 兩側石柱陣列 (左右各 5 根)
    for (let i = 0; i < 5; i++) {
      const z = 4 - i * 5;
      this.createColumn(-4.5, z);
      this.createColumn(4.5, z);
    }

    // 6. 前 3 對石柱安裝暖黃色火把點光源
    for (let i = 0; i < 3; i++) {
      const z = 4 - i * 5;
      this.createTorch(-4.2, 2.2, z);
      this.createTorch(4.2, 2.2, z);
    }
  }

  private createColumn(x: number, z: number): void {
    try {
      const colMesh = Zhuda3D.createPrimitiveMesh('box', { width: 0.8, height: 5, depth: 0.8 });
      const colSprite = new Laya.MeshSprite3D(colMesh);
      colSprite.transform.position = new Laya.Vector3(x, 2.5, z);

      const colMat = Zhuda3D.createMaterial({
        albedoColor: [0.2, 0.24, 0.28, 1.0],
        shininess: 24
      });
      colSprite.meshRenderer.material = colMat;
      this.scene3D.addChild(colSprite);
      this.columns.push(colSprite);
    } catch {}
  }

  private createTorch(x: number, y: number, z: number): void {
    try {
      if (Laya.PointLightCom) {
        const torchNode = new Laya.Sprite3D('TorchLight');
        const light = torchNode.addComponent(Laya.PointLightCom);
        light.color = new Laya.Color(1.0, 0.65, 0.25, 1.0);
        light.range = 8;
        light.intensity = 1.2;
        torchNode.transform.position = new Laya.Vector3(x, y, z);
        this.scene3D.addChild(torchNode);
        this.torchNodes.push(torchNode);
      }
    } catch {}
  }

  /**
   * 角色前進時，相機與石廊產生微妙的呼吸前推感
   */
  public advanceStep(durationMs: number = 700): void {
    if (!this.camera) return;
    const originZ = 10;
    const targetZ = 9.4;
    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const progress = Math.min(1, (now - startTime) / durationMs);
      const ease = Math.sin(progress * Math.PI);
      const curZ = originZ - (originZ - targetZ) * ease;
      this.camera.transform.position = new Laya.Vector3(0, 3.2, curZ);

      if (progress < 1) {
        if (typeof Laya !== 'undefined' && Laya.timer) {
          Laya.timer.frameOnce(1, this, animate);
        }
      } else {
        this.camera.transform.position = new Laya.Vector3(0, 3.2, originZ);
      }
    };
    animate();
  }
}
