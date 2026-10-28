import { zhudaComponent } from '../../packages/core/DeclarativeSDK';

/**
 * 3D 棋盤格物理爆破與波浪動力學組件
 * 由 @zhuda-laya/compiler AST 靜態掃描自動注入 ClassUtils.regClass('TilePhysicsBehavior', TilePhysicsBehavior)
 */
@zhudaComponent({
  className: 'TilePhysicsBehavior',
  assetId: 'zhuda://TilePhysicsBehavior',
  category: 'physics',
  description: '管理 3D 踩地雷方塊爆破重力飛散與波浪動畫狀態'
})
export class TilePhysicsBehavior extends Laya.Script {
  public activeSimulations: number = 0;

  public onAwake(): void {
    this.activeSimulations = 0;
  }
}
