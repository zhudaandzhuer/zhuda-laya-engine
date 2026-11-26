# 豬大跳跳

原創的 2D 平台跳躍，三關。用同一個倉庫裡的 zhuda-laya-engine 的 2D 做，用來驗引擎裡前五款沒碰到的兩塊：`ZhudaTerrain2D` + `ZhudaTerrain2DRenderer`（磚塊地形）和 `ZhudaInputBuffer` 用在跳躍預輸入。

```
npm run verify          # 建置、型別、體檢、6 個測試
npm run build && 用任何靜態伺服器開 dist/web/index.html
index.html?level=3&auto=1    # 機器人玩第三關
```

操作：← → 或 A D 移動，空白鍵（或 W、↑、J）跳，按久跳得高；觸控左下兩個方向鍵、右半邊跳。

## 做了什麼

- 規則在 `src/core/game.ts`：固定 60 Hz、單位是格、可變跳高（放開時上升速度砍到 45%）、離地 0.09 秒內仍可跳、落地前 0.12 秒按的跳會在落地時生效（引擎的輸入緩衝）、踩怪、尖刺、掉坑、金幣、旗子。
- 關卡在 `src/core/levels.ts`，用資料描述（坑、台階、平台、尖刺、怪、金幣），產生字元列，再轉成引擎的 `Terrain2DSpec`。
- 測試裡有兩個機器人：會往前試玩 1.5 秒的（三關都要過）、只會往右跑的（三關都要死）。

## 查過什麼

| 項目 | 結果 |
| --- | --- |
| `npm run verify` | 體檢 HEALTHY，6 個測試過 |
| 真的按鍵（無頭 Chromium，`tools/play.mjs`） | 按 → 走了 8 格、按空白鍵升了 2.4 格（`docs/evidence/keys.log.json`） |
| 機器人玩第三關 | 13.8 秒過關、12/13 金幣（`docs/evidence/bot.log.json`） |
| 地形繪製 | 92 格寬的關卡，畫面內常駐 2 個 chunk（`chunkCells: 16`） |

## 沒查的

- 沒有人玩過：手感（重力 46、起跳 15.2、跑速 6.4 格/秒）是照機器人能過、只會跑的過不了調的，不是照人的感覺。
- 觸控沒有在真機上按過；無頭瀏覽器裡只驗了鍵盤。
- 沒有在有 GPU 的機器或手機上量過幀率。聲音沒有人聽過。

## 對引擎的發現

- `ZhudaTerrain2DRenderer` 只畫純色方塊：尖刺、草皮這種有形狀的磚要自己另外畫一層（本專案在 `Main.ts` 逐格畫）。路線文件沒有說這件事。
- `ZhudaInputBuffer` 拿來做跳躍預輸入剛好，不需要動作狀態機。
