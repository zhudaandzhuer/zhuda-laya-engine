import { Cell, MinesweeperGame } from '../domain/MinesweeperCore';
import { Zhuda3D } from '../../packages/core/DeclarativeSDK';
import { BoardCameraController } from '../components/BoardCameraController';
import { TilePhysicsBehavior } from '../components/TilePhysicsBehavior';

export interface TileNode3D {
  r: number;
  c: number;
  root: Laya.Sprite3D;
  meshSprite: Laya.MeshSprite3D;
  flagSprite: Laya.Sprite3D | null;
  mineSprite: Laya.Sprite3D | null;
  textNode: Laya.Sprite | null;
  revealed: boolean;
  baseY: number;
  velocity: Laya.Vector3;
  angularVelocity: Laya.Vector3;
}

export class Minesweeper3DView {
  public scene3D: Laya.Scene3D;
  private camera: Laya.Camera;
  private cameraCtrl: BoardCameraController;
  private physicsBehavior: TilePhysicsBehavior;
  private boardRoot: Laya.Sprite3D;
  private tiles: Map<string, TileNode3D> = new Map();
  private game: MinesweeperGame;
  private overlay2D: Laya.Sprite;

  private matHidden: Laya.BlinnPhongMaterial;
  private matRevealed: Laya.BlinnPhongMaterial;
  private matExploded: Laya.BlinnPhongMaterial;
  private matFlag: Laya.BlinnPhongMaterial;
  private matMine: Laya.BlinnPhongMaterial;

  private is3DView: boolean = true;
  private animatingPhysics: boolean = false;

  constructor(parentScene: Laya.Scene, game: MinesweeperGame, overlay2D: Laya.Sprite) {
    this.game = game;
    this.overlay2D = overlay2D;

    // 使用 @zhuda-laya/core 的 Zhuda3D 宣告式 SDK 建立 3D 場景、相機與燈光
    this.scene3D = Zhuda3D.createScene3D(parentScene, {
      name: 'ZhudaMinesweeperScene3D',
      ambientColor: [0.42, 0.47, 0.58, 1]
    });

    this.camera = Zhuda3D.createCamera(this.scene3D, {
      fov: 50,
      near: 0.1,
      far: 1000,
      position: [4, 15, 17],
      rotationEuler: [-48, 0, 0],
      clearColor: [0.06, 0.08, 0.12, 1]
    });

    // 掛載由 AST 自動反射註冊的 BoardCameraController 組件
    this.cameraCtrl = this.camera.addComponent(BoardCameraController) as BoardCameraController;

    Zhuda3D.createDirectionalLight(this.scene3D, {
      color: [1, 0.98, 0.92, 1],
      intensity: 1.35,
      rotationEuler: [-55, 35, 0]
    });

    this.boardRoot = new Laya.Sprite3D('BoardRoot');
    this.scene3D.addChild(this.boardRoot);
    this.physicsBehavior = this.boardRoot.addComponent(TilePhysicsBehavior) as TilePhysicsBehavior;

    // 使用 Zhuda3D 建立共享材質 (Shared Material 合批)
    this.matHidden = Zhuda3D.createMaterial({ albedoColor: [0.23, 0.33, 0.46, 1], shininess: 36 });
    this.matRevealed = Zhuda3D.createMaterial({ albedoColor: [0.11, 0.15, 0.22, 1], shininess: 10 });
    this.matExploded = Zhuda3D.createMaterial({ albedoColor: [0.92, 0.22, 0.24, 1], shininess: 24 });
    this.matFlag = Zhuda3D.createMaterial({ albedoColor: [1.0, 0.82, 0.12, 1], shininess: 48 });
    this.matMine = Zhuda3D.createMaterial({ albedoColor: [0.15, 0.15, 0.17, 1], shininess: 64 });

    this.rebuildBoard();
    this.updateCamera(true);

    Laya.timer.frameLoop(1, this, this.onFrameUpdate);
  }

  public getTileCount(): number {
    return this.tiles.size;
  }

  public toggleViewMode(): boolean {
    this.is3DView = !this.is3DView;
    this.updateCamera(false);
    return this.is3DView;
  }

  public updateCamera(immediate: boolean = false): void {
    const centerC = (this.game.cols - 1) * 0.5;
    const centerR = (this.game.rows - 1) * 0.5;
    const maxDim = Math.max(this.game.rows, this.game.cols);

    let targetPos: Laya.Vector3;
    let targetRot: Laya.Vector3;

    if (this.is3DView) {
      const dist = maxDim * 1.35 + 4;
      targetPos = new Laya.Vector3(centerC + 1.1, dist * 0.95, centerR + dist * 0.85);
      targetRot = new Laya.Vector3(-48, 0, 0);
    } else {
      const dist = maxDim * 1.45 + 5;
      targetPos = new Laya.Vector3(centerC + 1.1, dist, centerR);
      targetRot = new Laya.Vector3(-90, 0, 0);
    }

    if (this.cameraCtrl) {
      this.cameraCtrl.setCameraTarget(targetPos, targetRot);
    }
    if (immediate) {
      this.camera.transform.position = targetPos;
      this.camera.transform.rotationEuler = targetRot;
    }
  }

  public rebuildBoard(): void {
    for (const tile of this.tiles.values()) {
      if (tile.textNode) tile.textNode.destroy();
      tile.root.destroy();
    }
    this.tiles.clear();
    this.animatingPhysics = false;

    const boxMesh = Zhuda3D.createPrimitiveMesh('box', {
      width: 0.92,
      height: 0.35,
      depth: 0.92
    });

    for (let r = 0; r < this.game.rows; r++) {
      for (let c = 0; c < this.game.cols; c++) {
        const root = new Laya.Sprite3D(`Tile_${r}_${c}`);
        this.boardRoot.addChild(root);
        root.transform.position = new Laya.Vector3(c, 0, r);

        const meshSprite = new Laya.MeshSprite3D();
        root.addChild(meshSprite);
        meshSprite.meshFilter.sharedMesh = boxMesh;
        meshSprite.meshRenderer.sharedMaterial = this.matHidden;

        this.tiles.set(`${r}_${c}`, {
          r,
          c,
          root,
          meshSprite,
          flagSprite: null,
          mineSprite: null,
          textNode: null,
          revealed: false,
          baseY: 0,
          velocity: new Laya.Vector3(0, 0, 0),
          angularVelocity: new Laya.Vector3(0, 0, 0)
        });
      }
    }
    this.updateCamera(false);
  }

  public updateCellVisual(cell: Cell): void {
    const tile = this.tiles.get(`${cell.y}_${cell.x}`);
    if (!tile) return;

    if (cell.state === 'revealed') {
      tile.revealed = true;
      if (cell.isMine) {
        tile.meshSprite.meshRenderer.sharedMaterial = this.matExploded;
        if (!tile.mineSprite) {
          tile.mineSprite = this.create3DMineVisual();
          tile.root.addChild(tile.mineSprite);
        }
      } else {
        tile.meshSprite.meshRenderer.sharedMaterial = this.matRevealed;
        Laya.Tween.to(tile.root.transform, { localPositionY: -0.16 }, 180, Laya.Ease.cubicOut);

        if (tile.flagSprite) {
          tile.flagSprite.destroy();
          tile.flagSprite = null;
        }

        if (cell.neighborMines > 0 && !tile.textNode) {
          tile.textNode = this.createNumberLabel(cell.neighborMines);
        }
      }
    } else if (cell.state === 'flagged') {
      if (!tile.flagSprite) {
        tile.flagSprite = this.create3DFlagVisual();
        tile.root.addChild(tile.flagSprite);
        tile.flagSprite.transform.localPosition = new Laya.Vector3(0, 0.1, 0);
        tile.flagSprite.transform.localScale = new Laya.Vector3(0.1, 0.1, 0.1);
        Laya.Tween.to(
          tile.flagSprite.transform,
          { localPositionY: 0.35, localScaleX: 1, localScaleY: 1, localScaleZ: 1 },
          200,
          Laya.Ease.backOut
        );
      }
    } else if (cell.state === 'question') {
      if (tile.flagSprite) {
        tile.flagSprite.destroy();
        tile.flagSprite = null;
      }
    } else if (cell.state === 'hidden') {
      tile.meshSprite.meshRenderer.sharedMaterial = this.matHidden;
      if (tile.flagSprite) {
        tile.flagSprite.destroy();
        tile.flagSprite = null;
      }
      if (tile.mineSprite) {
        tile.mineSprite.destroy();
        tile.mineSprite = null;
      }
      if (tile.textNode) {
        tile.textNode.destroy();
        tile.textNode = null;
      }
      tile.root.transform.localPosition = new Laya.Vector3(cell.x, 0, cell.y);
    }
  }

  private create3DFlagVisual(): Laya.Sprite3D {
    const flagRoot = new Laya.Sprite3D('Flag');
    const poleMesh = Zhuda3D.createPrimitiveMesh('cylinder', { radius: 0.04, height: 0.6 });
    const pole = new Laya.MeshSprite3D();
    pole.meshFilter.sharedMesh = poleMesh;
    pole.meshRenderer.sharedMaterial = this.matHidden;
    flagRoot.addChild(pole);
    pole.transform.localPosition = new Laya.Vector3(0, 0.3, 0);

    const clothMesh = Zhuda3D.createPrimitiveMesh('box', { width: 0.28, height: 0.18, depth: 0.04 });
    const cloth = new Laya.MeshSprite3D();
    cloth.meshFilter.sharedMesh = clothMesh;
    cloth.meshRenderer.sharedMaterial = this.matFlag;
    flagRoot.addChild(cloth);
    cloth.transform.localPosition = new Laya.Vector3(0.15, 0.5, 0);

    return flagRoot;
  }

  private create3DMineVisual(): Laya.Sprite3D {
    const mineRoot = new Laya.Sprite3D('Mine');
    const sphereMesh = Zhuda3D.createPrimitiveMesh('sphere', { radius: 0.24 });
    const sphere = new Laya.MeshSprite3D();
    sphere.meshFilter.sharedMesh = sphereMesh;
    sphere.meshRenderer.sharedMaterial = this.matMine;
    mineRoot.addChild(sphere);
    sphere.transform.localPosition = new Laya.Vector3(0, 0.3, 0);

    const spikeMesh = Zhuda3D.createPrimitiveMesh('cylinder', { radius: 0.03, height: 0.58 });
    const spike1 = new Laya.MeshSprite3D();
    spike1.meshFilter.sharedMesh = spikeMesh;
    spike1.meshRenderer.sharedMaterial = this.matExploded;
    mineRoot.addChild(spike1);
    spike1.transform.localPosition = new Laya.Vector3(0, 0.3, 0);

    const spike2 = new Laya.MeshSprite3D();
    spike2.meshFilter.sharedMesh = spikeMesh;
    spike2.meshRenderer.sharedMaterial = this.matExploded;
    mineRoot.addChild(spike2);
    spike2.transform.localPosition = new Laya.Vector3(0, 0.3, 0);
    spike2.transform.rotationEuler = new Laya.Vector3(0, 0, 90);

    return mineRoot;
  }

  private createNumberLabel(num: number): Laya.Text {
    const label = new Laya.Text();
    label.text = String(num);
    label.fontSize = 22;
    label.bold = true;
    label.align = 'center';
    label.valign = 'middle';
    label.width = 30;
    label.height = 30;
    label.pivotX = 15;
    label.pivotY = 15;

    const colors = [
      '#000000',
      '#4185f4',
      '#34a853',
      '#ea4335',
      '#7b1fa2',
      '#ff6d00',
      '#0097a7',
      '#212121',
      '#757575'
    ];
    label.color = colors[num] || '#ffffff';
    this.overlay2D.addChild(label);
    return label;
  }

  public triggerExplosionPhysics(centerR: number, centerC: number): void {
    this.animatingPhysics = true;
    if (this.physicsBehavior) {
      this.physicsBehavior.activeSimulations++;
    }
    for (const tile of this.tiles.values()) {
      const dx = tile.c - centerC;
      const dz = tile.r - centerR;
      const dist = Math.sqrt(dx * dx + dz * dz) + 0.1;

      const force = Math.max(0, (6 - dist) * 1.8);
      if (force > 0) {
        tile.velocity.x = (dx / dist) * force * (0.8 + Math.random() * 0.4);
        tile.velocity.y = force * (1.2 + Math.random() * 0.8) + 2.5;
        tile.velocity.z = (dz / dist) * force * (0.8 + Math.random() * 0.4);

        tile.angularVelocity.x = (Math.random() - 0.5) * 450;
        tile.angularVelocity.y = (Math.random() - 0.5) * 450;
        tile.angularVelocity.z = (Math.random() - 0.5) * 450;
      }
    }
  }

  public triggerVictoryWave(): void {
    for (const tile of this.tiles.values()) {
      const dist = Math.sqrt(tile.c * tile.c + tile.r * tile.r);
      const delay = dist * 60;
      const targetRestY = tile.revealed ? -0.16 : 0;
      Laya.Tween.to(tile.root.transform, { localPositionY: 0.75 }, 220, Laya.Ease.sineOut, undefined, delay);
      Laya.Tween.to(tile.root.transform, { localPositionY: targetRestY }, 280, Laya.Ease.bounceOut, undefined, delay + 220);
    }
  }

  private onFrameUpdate(): void {
    const dt = 0.016;
    const outPos = new Laya.Vector4();

    for (const tile of this.tiles.values()) {
      if (tile.textNode && tile.textNode.visible) {
        const worldPos = tile.root.transform.position;
        this.camera.viewport.project(
          new Laya.Vector3(worldPos.x, worldPos.y + 0.22, worldPos.z),
          this.camera.projectionViewMatrix,
          outPos
        );
        tile.textNode.pos(outPos.x, outPos.y);
      }
    }

    if (this.animatingPhysics) {
      const gravity = -18.0;
      let anyMoving = false;

      for (const tile of this.tiles.values()) {
        if (tile.velocity.length() > 0.01 || Math.abs(tile.velocity.y) > 0.01) {
          anyMoving = true;
          tile.velocity.y += gravity * dt;

          const p = tile.root.transform.position;
          p.x += tile.velocity.x * dt;
          p.y += tile.velocity.y * dt;
          p.z += tile.velocity.z * dt;
          tile.root.transform.position = p;

          const rot = tile.root.transform.rotationEuler;
          rot.x += tile.angularVelocity.x * dt;
          rot.y += tile.angularVelocity.y * dt;
          rot.z += tile.angularVelocity.z * dt;
          tile.root.transform.rotationEuler = rot;

          if (p.y < -3.0) {
            p.y = -3.0;
            tile.velocity.y = -tile.velocity.y * 0.4;
            tile.velocity.x *= 0.7;
            tile.velocity.z *= 0.7;
          }
        }
      }

      if (!anyMoving) {
        this.animatingPhysics = false;
      }
    }
  }

  public pickTile(screenX: number, screenY: number): { r: number; c: number } | null {
    const ray = new Laya.Ray(new Laya.Vector3(), new Laya.Vector3());
    this.camera.viewportPointToRay(new Laya.Vector2(screenX, screenY), ray);

    if (Math.abs(ray.direction.y) < 0.0001) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;

    const hitX = ray.origin.x + t * ray.direction.x;
    const hitZ = ray.origin.z + t * ray.direction.z;

    const c = Math.round(hitX);
    const r = Math.round(hitZ);

    if (r >= 0 && r < this.game.rows && c >= 0 && c < this.game.cols) {
      return { r, c };
    }
    return null;
  }
}
