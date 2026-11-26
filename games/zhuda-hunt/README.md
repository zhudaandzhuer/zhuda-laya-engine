# 豬大狩荒

原創的 3D 共鬥狩獵動作遊戲（單人）。豬大拿柴刀討伐《山海經》的巨獸：看牠的起手、在最後一刻翻滾穿過去、趁牠收招出刀；破壞部位、剝素材、打造下一把刀。玩法類型參考的是「魔物獵人」這一類狩獵動作遊戲的核心循環；名稱、怪物、美術、數值都是這個倉庫自己的。

- 引擎：同一個倉庫裡的 zhuda-laya-engine（`file:../..`）（features `core`、`3d`、`gltf`、`postProcess`）。
- 三個任務：★饕餮（竹原）、★★窮奇（山口黃昏）、★★★刑天（常羊山）。限時 10 分鐘，力盡 3 次失敗。
- 操作：WASD 移動、J 輕斬（三段）、K 重劈、空白翻滾、E 回復藥；觸控是左半邊搖桿加四顆按鈕。

## 怎麼跑

```sh
npm install && npm run verify      # 建置、型別、Doctor、9 項規則測試
npm run bots                       # 三隻怪 × 三種機器人 × 八個種子的平衡表
node ../tools/shot.mjs . --query "quest=q1&auto=legs&speed=6&seed=3" --script tools/play-auto.mjs --out play-out/q1 --name q1
```

`npm run build` 會先跑 `tools/sync-assets.mjs`，把豬大、三隻怪和地面貼圖從 `games/shared-assets/` 複製進 `assets/`（不進版控；來源見 `games/ASSETS.md`）。

## 用到引擎的哪些東西

| 遊戲裡的 | 引擎的 |
| --- | --- |
| 獵人六個招式的起手、判定、收招、可取消的時段 | `ZhudaActionStateMachine`（`validateActionFrameSpec` 在載入時驗） |
| 提早按的鍵會在可取消時出招 | `ZhudaInputBuffer`（0.22 秒） |
| 命中的卡肉 | runtime session 的 `world` 時間層暫停，`timers` 的 unscaled 計時器解除 |
| 狩場 | film scene 資料（`terrain`、`extrude`、`lathe`、`grass`、`effect`、圖片材質），`loadZhudaFilmScene` |
| 豬大與怪 | `ZhudaModelLibrary`、`ZhudaModelInspector`（`crossFade`、`setAnimationSpeed`） |
| 命中、破壞、回復的特效 | `ZhudaEffect3D`（`hit`、`sparks`、`explosion`、`heal`、`dust-motes`） |
| 觸控搖桿 | `ZhudaPointerInput` |
| 聲音（16 個） | `renderZhudaSynthWav` ＋ `ProceduralAssetProvider` ＋ `IframeSoundAdapter` |

規則（`src/core/hunt.ts`、`data.ts`）不碰畫面，在 Node 裡直接 import 引擎的狀態機與輸入緩衝來測。

## 驗證到哪裡

- `npm run verify` exit 0（Doctor HEALTHY；9／9）。這次的引擎是在沒有 npm registry 的容器裡用替代工具鏈建的（TypeScript 5.9.3、esbuild 0.28.2 代替釘的版本），**要在正常的 `npm ci` 環境再跑一次**。
- 饕餮一戰由機器人在無頭 Chromium（SwiftShader）上從開始打到報酬畫面再回據點，無主控台錯誤：`docs/evidence/q1-bot/`（6 張拼圖、紀錄）。
- 平衡：會看起手的機器人用「前一階的裝備」三隻都贏（2～7 分鐘），只會連打的三隻都輸（測試守住）。

## 已知的限制

- **沒有實機、沒有 GPU、沒有人玩過**：手感（卡肉長度、翻滾無敵時間、鏡頭）都是照數字訂的，沒有人的手驗過。機器人是逐格完美的，不代表人打起來的難度。
- 窮奇、刑天兩個任務只在規則層由機器人打過，沒有在瀏覽器裡整場錄過。
- 饕餮、窮奇只有 Idle／Move／Attack 三個動作：蓄力、倒地、暈眩是把整個模型傾斜做的；不同招式共用同一個 Attack。地上的紅色範圍標記補了一部分可讀性。
- 繪製次數：草的可見距離從 34 m 降到 20 m 後是 202 次（之前 310 次，超過 300 的手機預算）；引擎的 film lint 現在會用 `grass.draws` 提示這件事。
- 單人。沒有多人連線、沒有第二種武器、沒有捕獲、沒有地圖移動。
