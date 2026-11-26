# 2d/prefab-atlas：從通過檢查的 Prefab 拿圖給動態畫面

Prefab-first 的 2D 遊戲裡，圖集（怪物、姿勢、圖示）先做成 Prefab、單獨檢查過，場景再掛上**同一個定義**。
會動的畫面（生怪、換姿勢、切圖示）要的格子圖，就從這個掛上的 Prefab 實例取它已解碼的貼圖來切，
不另開網址、不另建貼圖快取——這樣檢查過的圖就是畫面上的圖，釋放也跟著 Prefab 一起。

拆自 `games/dungeon-spin`（`src/Main.ts` 掛 `visual/creatures-atlas`、`visual/hero-actions` 的做法，和三個畫面裡重複的切格子算式）。

| 函式 | 做什麼 |
|---|---|
| `mountAtlasPrefab(library, id, node, parent, state = 'idle')` | `library.instantiate(id, { state, parent })`、把根節點藏起來、找到圖片節點 `node`，傳回 `{ instance, image, texture }`；節點沒有解碼好的圖就丟錯 |
| `gridCell(texture, cols, rows, col, row)` | `cols × rows` 等分圖集的第 (col, row) 格（寬高可以是小數：`texture.width / cols`） |
| `gridCellAt(texture, cols, rows, index)` | 由左上往右數的第 `index` 格 |

## 用法

```ts
import { ZhudaPrefabLibrary } from 'zhuda-laya-engine';
import { mountAtlasPrefab, gridCellAt } from './common/2d/prefab-atlas/prefab-atlas.ts';

const library = new ZhudaPrefabLibrary({ provider, definitions });        // 和 prefabChecks 用的同一份定義與 provider
const creatures = await mountAtlasPrefab(library, 'visual/creatures-atlas', 'CreaturesAtlas', layer);
const icon = new Laya.Sprite();
icon.graphics.drawTexture(gridCellAt(creatures.texture, 5, 2, 7), 0, 0, 120, 120);   // 5×2 圖集的第 7 格
// 場景結束：creatures.instance.dispose()，再 library.dispose()
```

實際用法：`2d/dungeon-spin/dungeon-spin.ts`（掛兩個圖集）、`views/monster-field.ts`、`views/hero-action.ts`、`views/boss-seal.ts`（切格子）。

## 驗證

- 迷宮一閃改用這兩個函式後，觀看台和原遊戲 26 個狀態逐像素相同（算式和原本一模一樣：先算 `cellW = width / cols` 再乘 `col`）。
- `mountAtlasPrefab` 經 `2d/dungeon-spin/source/prefab-check` 建置、型別檢查（引擎 def94aa）。

## 限制

- 只會等分格子；不等分的圖集（每格大小不同）要自己給矩形呼叫 `Laya.Texture.createFromTexture`。
- 每次呼叫都新建一個子貼圖（原遊戲也是），沒有快取；每格每幀都叫的話自己存起來。
- 只處理 2D 的圖片節點（`Laya.Image`）。
