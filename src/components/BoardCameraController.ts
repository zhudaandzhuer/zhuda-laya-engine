import { zhudaComponent } from '../../packages/core/DeclarativeSDK';

/**
 * 自定義 3D 相機控制器組件
 * 透過 @zhudaComponent 裝飾器與 @zhuda-laya/compiler AST 掃描器自動註冊至 Laya.ClassUtils
 * 證明完全脫離 LayaAir IDE 仍可完美運作組件生命週期 (onAwake / onUpdate)
 */
@zhudaComponent({
  className: 'BoardCameraController',
  assetId: 'zhuda://BoardCameraController',
  category: '3d',
  description: '3D 戰術棋盤相機平滑插值與微幅呼吸運鏡組件'
})
export class BoardCameraController extends Laya.Script {
  public targetPosition: Laya.Vector3 = new Laya.Vector3(4, 15, 17);
  public targetRotationEuler: Laya.Vector3 = new Laya.Vector3(-48, 0, 0);
  public lerpSpeed: number = 0.14;
  public frameTickCount: number = 0;

  public onAwake(): void {
    this.frameTickCount = 0;
  }

  public setCameraTarget(pos: Laya.Vector3, euler: Laya.Vector3): void {
    this.targetPosition = pos.clone();
    this.targetRotationEuler = euler.clone();
  }

  public onUpdate(): void {
    this.frameTickCount++;
    const cam = this.owner as Laya.Camera;
    if (!cam || !cam.transform) return;

    const curPos = cam.transform.position;
    const curRot = cam.transform.rotationEuler;

    const nx = curPos.x + (this.targetPosition.x - curPos.x) * this.lerpSpeed;
    const ny = curPos.y + (this.targetPosition.y - curPos.y) * this.lerpSpeed;
    const nz = curPos.z + (this.targetPosition.z - curPos.z) * this.lerpSpeed;
    cam.transform.position = new Laya.Vector3(nx, ny, nz);

    const rx = curRot.x + (this.targetRotationEuler.x - curRot.x) * this.lerpSpeed;
    const ry = curRot.y + (this.targetRotationEuler.y - curRot.y) * this.lerpSpeed;
    const rz = curRot.z + (this.targetRotationEuler.z - curRot.z) * this.lerpSpeed;
    cam.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
  }
}
