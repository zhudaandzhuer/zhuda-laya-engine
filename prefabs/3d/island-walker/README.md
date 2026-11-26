# 3d/island-walker：在島上第三人稱走動

讓豬大（或任何有 `Idle`、`Walk` 動作的角色）在任何一座島上走：角色、跟隨鏡頭、鍵盤與觸控。
地面是誰的不管：場景只要回答兩個問題（`WalkWorld`）——這裡地面多高、這裡能不能站。
`3d/garden-island` 的 `createGardenIsland()` 傳回的物件本身就是一個 `WalkWorld`。

從《豬大花園島》（`games/zhuda-garden-island`，2026-11-18）的 `src/walker.ts` 和 `src/Main.ts` 的鏡頭與輸入拆出來；
數值、順序、每一步的算法都沒改，花園島原版和觀看台的 `garden-island` 逐像素相同（見 `3d/garden-island/README.md` 的「驗證」）。

| 檔案 | 內容 |
|---|---|
| `walker.ts` | `Walker`：`ZhudaAnimationBlend` 混 Idle／Walk（走路節奏跟腳步速度走），站著時可疊一段動作（`act`：Wave、Bow、Sit、Talk、Point、ReachLeft、ReachRight、Cheer，模型有才播），自己走到 `goal`；最高速 `WALK_SPEED` = 3.1 m/s |
| `walk-world.ts` | `WalkWorld` 介面＋`slide()`：一步先整步走，不行就只走 x、再不行只走 z（沿岸邊滑），都不行就停。沒有引擎，可在 node 測 |
| `follow-camera.ts` | `FollowCamera`：環繞角色的第三人稱鏡頭。yaw／pitch／distance 緩動到 `goal`，看的點跟著腳（離地 1 m），中間有障礙球（樹冠）就把鏡頭拉到它前面（最近 3 m），鏡頭不低於地面 0.4 m |
| `walk-input.ts` | `WalkInput`：WASD／方向鍵（依鏡頭方向）、觸控畫面左側 38% 是搖桿（拖 60 px 推滿）、其他拖曳轉視角、雙指捏合與滾輪縮放（3–40 m）、視窗失焦放開按鍵 |

## 用法

```bash
cd <repository root>
node prefabs/scripts/sync.mjs games/<遊戲> 3d/island-walker 3d/zhuda-characters   # 3d/math 會一起帶進去
```

```ts
import { ZhudaModelLibrary, DirectoryAssetProvider } from 'zhuda-laya-engine';
import { Walker, type WalkWorld } from './common/3d/island-walker/walker.ts';
import { FollowCamera } from './common/3d/island-walker/follow-camera.ts';
import { WalkInput } from './common/3d/island-walker/walk-input.ts';
import { characterPath } from './common/3d/zhuda-characters/zhuda-characters.ts';

// 一座平地小島：半徑 20 m 內能走
const world: WalkWorld = { groundAt: () => 0, walkable: (x, z) => Math.hypot(x, z) < 20 };
const models = new ZhudaModelLibrary({ provider: new DirectoryAssetProvider({ baseUrl: './' }) });
const walker = new Walker(await models.instantiate(characterPath('zhuda'), { independentMaterials: true }), world, [0, 0]);
scene.addChild(walker.root);
const follow = new FollowCamera(camera, walker.feet, { ground: world.groundAt });   // obstacles: 樹冠球 [x, y, z, r][]
const input = new WalkInput(container.querySelector('canvas')!, follow.goal);
context.runtime.start((dt: number) => {
  walker.update(dt, input.stick(follow.orbit.yaw));   // 先走
  const eye = follow.update(dt, walker.feet);          // 再放鏡頭；eye、follow.target 給場景的 update
});
```

（這段補上 `scene`、`camera`、`container`、`context` 的宣告後，2026-11-25 對引擎 def94aa 型別檢查過。）

花園島上的完整接法（含 `createGardenIsland`）在 `3d/garden-island/README.md`，實際跑的程式是 `viewer3d/src/presets/garden-island.ts`。

### 可以改的

- `Walker`：`feet`（腳的位置）、`yaw`（面向，0 朝 +z）、`speed`、`goal`（`[x, z]`，自己走過去；有搖桿輸入就取消）、`act`（站著時的動作名，`null` 回 Idle）、`place(x, z)`（立刻放到某處的地面上）、`head`、`root`（Laya 節點）、`dispose()`。建構子第四個參數是縮放。
- `FollowCamera`：`orbit`（現在）、`goal`（要去的；`WalkInput` 改它）、`set({ yaw, pitch, distance })`（立刻）、`snap(feet)`（看的點立刻到角色身上，用在瞬移／換鏡頭）、`lookAt`（固定看某點，`null` 看角色）、`avoid`（`false`：不閃障礙，拍片手動構圖時用）、`boom`（拉近後實際的距離；換鏡頭時可直接設）、`eye`、`target`。選項 `lift`、`nearest`、`clearance`、`orbit`。
- `WalkInput`：`stick(yaw)`、`clear()`（暫停、開選單、換場時放開所有按鍵與手指）、`dispose()`；選項 `stickShare`、`stickReach`、`pitch`、`distance`。

## 已知限制

- 鏡頭只閃給它的障礙球（花園島給的是樹冠），不閃樹幹、灌木、竹子，也沒有對一般網格的碰撞（引擎沒有角色控制器和鏡頭碰撞，見 `3d/garden-island/README.md`）。
- 走路只看 `walkable`：沒有坡度限制、沒有和其他角色或物件碰撞、沒有跳。
- 觸控、鍵盤只在無頭 Chrome 用合成事件驗過（2026-11-25：按 W 走、左側拖曳走、右側拖曳轉視角、滾輪縮放），還沒人在真手機上用手指走一圈。
- `Walker` 一定要有 `Idle`、`Walk` 兩段動作（豬大、豬二、守夜人版都有）。

## 測試

`tests/island-walker.test.mjs`（5 項，不開瀏覽器）：鏡頭距離與方向、障礙球拉近且不近於 3 m、`avoid=false` 退回、不鑽地、`set`／`snap`；W／D 依鏡頭方向、斜走不超過 1、失焦放開、`dispose` 後不再收鍵；左側觸控是搖桿、右側拖曳轉視角、滾輪縮放上下限。
`tests/garden-island.test.mjs` 用花園島的地面測 `slide()`：往池中央直走會停在岸邊、每一步都在可走範圍、踏石之間能走的走得到。
