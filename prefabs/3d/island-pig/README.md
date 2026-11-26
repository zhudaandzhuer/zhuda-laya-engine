# 3d/island-pig：島上的豬大、豬二（可以抓起來丟的角色）

島上自己生活的角色，配 `3d/zhuda-characters` 的模型：

- 平常：待機、走到隨機的空地（繞開房子、樹、池塘、道具、島緣和另一隻）、偶爾跳起來歡呼；改版模型還會對鏡頭揮手、坐下，晚上坐著打瞌睡。
- 被抓：後頸被拎著，身體像鐘擺晃；被甩時掙扎（`Struggle`），放著不動一陣子就放棄垂著（`Dangle`），一甩又掙扎；轉頭面向鏡頭。
- 被丟：用手的速度飛出去、翻滾、落地依速度壓扁再彈回；從 3.2 m 以上掉下來頭暈（冒星星）。
- 掉進池塘：游到最近的岸、爬上來甩乾、之後滴水一陣子。掉到屋頂：滑下來再掉下去；掉到風車塔頂：彈開。掉出島外（低於 `lostBelow`）：從天上掉回來。
- 表演（改版模型的 10 段動作）：`act(clip, 秒數, 面向, 拍子)` 原地做；`goAct(地點, …)` 走過去（半公尺格子找路再抄捷徑）再做，路被擋住或太遠就從天上掉到那裡。`phase()` 給 0..1 就跟著音樂的拍子（官網版用歌曲本身的播放時間，73 BPM）。
- 耳朵和尾巴用引擎的彈簧骨：`earAndTailSprings(model, () => dt)`。

預覽圖在 `3d/sky-island/preview/`（`grab.jpg` 抓起來、`home-wave.jpg` 打招呼、`home-sing.jpg` 唱歌跳舞）。

## 島是注入的（PigWorld）

角色不認得任何一座島；島告訴它（`pig-world.ts`，沒有引擎）：

```ts
interface PigWorld {
  ground(x, z): number | null;          // 頂面高度，島外 null
  inside(x, z): number;                 // 離島緣多遠（公尺，島外為負）；島的中央是原點
  obstacles: { circles: [x, z, r][]; boxes: [x, z, 半寬x, 半寬z][] };
  pond?: { center: [x, z]; waterY: number; distance(x, z): number };  // distance < 1 在池裡
  roof?: { at(x, z): number | null; ridgeX: number };                 // 人字屋頂，屋脊沿 z
  caps?: { x, z, r, y }[];              // 掉上去會彈開的圓頂（塔）
  lostBelow: number;                    // 掉到這個高度以下就算掉出島
  respawnSpan: number; respawnHeight: number;  // 從天上掉回來：中央多寬的方形、多高
  reach: number;                        // 找路的範圍（中央 ± 公尺）
}
```

浮島的是 `3d/sky-island` 的 `SKY_ISLAND_WORLD`（`island.world`）。別的島只要給同樣形狀的物件；沒有池塘、屋頂、塔就不給那幾項。

## 放進遊戲

```bash
node prefabs/scripts/sync.mjs games/<遊戲> 3d/island-pig 3d/zhuda-characters
```

```ts
import { Pig, earAndTailSprings, redesignShape, SKY_ISLAND_GAME_PIG } from './common/3d/island-pig/pig.ts';
import { createHand } from './common/3d/island-pig/hand.ts';
import { characterPath } from './common/3d/zhuda-characters/zhuda-characters.ts';

const model = await models.instantiate(characterPath('zhuer'), { independentMaterials: true });
const pig = new Pig(model, island.world, {
  grab: (at) => fx.sparks.burst(at), land: (at, speed, onRoof) => fx.dust.burst(at, speed / 7),
  splash: (at, speed) => fx.droplets.burst(at, speed / 6), drip: (at) => fx.drips.burst(at), shake: (at) => fx.shakeDrops.burst(at),
  stars: (head) => fx.stars.burst(head), lost: (at) => fx.poof.burst(at), respawn: (at) => fx.sparks.burst(at), footstep: () => {},
}, random(5), () => eye, { ...redesignShape(1.0), start: [-0.7, 2.8], yaw: 0.9 });
scene.addChild(pig.root);
let dt = 1 / 60;
const springs = earAndTailSprings(model, () => dt);
const orbit = { yaw: 0.62, pitch: 0.3, distance: 25 };
const hand = createHand({ canvas, camera, orbit, yaw: () => orbit.yaw, pickable: () => [pig], ground: groundAt, minDistance: 6, maxDistance: 45 });
// 每幀：pig.update(dt, seconds); hand.update(dt); 鏡頭往 orbit 靠近
```

`Pig` 的選項（`PigOptions`）：

| 選項 | 預設 | 說明 |
|---|---|---|
| `size`、`scruff`、`middle`、`head`、`radius` | 1、[0,1,−0.12]、[0,0.5,0]、1.2、0.46 | 模型大小、拎的位置、身體中心、頭高、被點到的半徑。改版模型用 `redesignShape(頭高)`（放大 1.2 倍；豬大 0.95、豬二 1.0） |
| `start`、`yaw` | [0.6, 2.2]、0.15π | 一開始站哪、面向 |
| `others` | 無 | 另外幾隻的腳（每步讀），不走進彼此 |
| `performs` | true | 用模型有的改版動作（揮手、坐、睡、`act`）；false 只用九段基本動作 |
| `cheerChance` | 0.12 | 停下來想下一步時歡呼的機率 |
| `respawnInView` | true | 從天上掉回鏡頭看得到的那一側；false 隨便哪個空地 |
| `pickHeights` | 依頭高 | 四顆點選球的高度 |
| `name` | `character-holder` | 外層節點名稱 |

`SKY_ISLAND_GAME_PIG` 就是浮島遊戲那隻豬大（`performs: false`、`cheerChance: 0.18`、`respawnInView: false`、`pickHeights: [0.25, 0.45, 0.65, 0.85]`）：觀看台 `sky-island` 用它和影片版豬大重現了原遊戲（逐像素相同）。

狀態 `pig.state`：`idle`、`walk`、`held`、`fall`、`slide`、`land`、`dizzy`、`swim`、`shake`、`cheer`、`act`。讀得到 `feet`、`head`、`center`、`scruff`、`held`、`swing`（手甩的速度）、`stillFor`（垂著多久）、`speed`、`acting`、`going`、`arriving`、`wet`；可寫 `night`（0..1，晚上多坐多睡）。方法：`grab()`、`drag(到哪)`、`release()`、`respawn()`、`dropAt([x, z])`、`act()`、`goAct()`、`rest()`、`free(x, z, 邊距)`、`hit(射線)`。

`createHand(options)`：玩家的手。按住角色就拎起來（拖曳平面面向鏡頭，帶著一點上提），移動就甩，放手就丟；拖空白處轉鏡頭、滾輪或兩指縮放（`wheel: false` 讓滾輪捲網頁）；`bringForwardTo: () => 點` 讓抓到後面的角色能被拉到前面（官網版）。`hand.press/move/release` 可以用程式驅動（檢查用），`hand.project(世界座標)` 回傳頁面座標，`hand.idle` 是多久沒碰（遊戲拿來慢慢轉鏡頭）。

## 驗證過的

- `tests/island-pig.test.mjs`：浮島是完整的 PigWorld；站得住的地方（島緣、池塘、房子、樹、任意圓島）；掉落會落在塔頂、屋頂、地面；找路（直線、繞房子、圍住時沒有路、每一段都通）；動作循環；兩個 preset；拖曳平面。
- 觀看台 `sky-island`（`SKY_ISLAND_GAME_PIG`）、`home-island`（兩兄妹）和兩款原遊戲：同一份情境、虛擬時鐘下（`hero`、`grab`、`pond`、`home`、`back` 共 25 張），角色的位置、狀態、腳本回傳值每張都相同，畫面 0 像素不同（細節見 `3d/sky-island/README.md`）。
- 原遊戲紀錄：從高處丟下頭暈、掉到屋頂滑下、丟進池塘游到岸邊甩乾、抓到房子後面的角色可以拉到前面、連續重生三次都在鏡頭側（無頭 Chrome）。

## 沒驗證／限制

- 沒在手機上用手指抓過；觸控只在無頭 Chrome 模擬。
- 找路只在島中央 ±`reach` 內、半公尺格子；很窄的縫走不過去就會從天上掉過去（官網版的設計）。
- 角色之間只會避開，不會互相碰撞或推擠；被丟的角色會穿過另一隻。

## 來源

`games/zhuda-home-island/src/pig.ts`（841 行，浮島 `pig.ts` 的超集合）與 `games/zhuda-sky-island/src/pig.ts`，2026-11-16。收進來時把 `ground.ts` 的直接引用（房子、池塘、屋頂、塔、島緣）換成注入的 `PigWorld`，找路與落點判斷搬到沒有引擎的 `pig-world.ts`，兩邊不同的地方變成選項；抓取與鏡頭操作從兩款的 `Main.ts` 抽成 `hand.ts`。
