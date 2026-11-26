# 豬大果園

原創的三消，四關。用同一個倉庫裡的 zhuda-laya-engine 的 2D 做。

```
npm run verify            # 建置、型別、體檢、7 個測試
node tools/balance.ts     # 兩種玩家在每關 40 盤的分數
index.html?level=4&seed=3&auto=1
# 介面情境跑 20 次、比對每次是否相同（在倉庫根目錄）：
HOOK=__GAME__ READY=ready VIEWPORT=540x960 node prefabs/tools/detrepeat.mjs 20 games/zhuda-match/dist/web games/zhuda-match/tools/scenarios/ui-flow.json "fresh=1&seed=7" <輸出資料夾>
```

操作：拖一顆水果往旁邊，或點一顆再點旁邊那顆。停 4 秒會提示。

## 做了什麼

- 規則在 `src/core/board.ts`：8×8、有種子；交換、三連以上消除、掉落、補新的、連鎖（倍率最多 ×3）；四連留閃電（被消時清掉整行整列）、五連留星星（和水果交換清掉同種全部）；沒有步可走時洗牌；開局保證沒有現成的三連而且有步可走。
- 一步棋回傳每一輪（`Round`：消了哪些、得幾分、做出什麼特殊果、消完後每格是誰）；畫面只照著播，用水果 id 對位置。

## 查過什麼

| 項目 | 結果 |
| --- | --- |
| `npm run verify` | 體檢 HEALTHY，7 個測試過 |
| 真的滑鼠（無頭 Chromium，`tools/play.mjs`） | 一次無效拖曳被退回、不扣步；之後拖曳和點選交替走 11 步過第一關（`docs/evidence/hands.log.json`） |
| 機器人玩第四關 | 15 步、26 次連鎖、3 個特殊果，過關（`docs/evidence/bot.log.json`） |
| 介面情境（`tools/scenarios/*.json`，只用具名點擊和 `expect`，沒有座標） | 虛擬時鐘上各跑 20 次，每次的截圖、舞台節點樹、紀錄都相同（`ui-flow.json`：標題、靜音開關、未開放的關點了沒反應、進第一關、回選單；`bot-to-result.json`：機器人玩到結算，按「再一次」「下一園」）。跑法見路線 [ui-test-by-probe](../../docs/routes/ui-test-by-probe.md) |
| 平衡（40 盤） | 看到就換的玩家：第一關過 29 盤、第二關 4 盤、三四關 0 盤；挑當下最高分的：40、40、32、23 盤 |

## 沒查的

- 沒有人玩過。兩種機器人之間的分數差到 5 倍以上，真人落在哪裡不知道；關卡目標是夾在兩者之間定的。
- 觸控沒有在真機上試；沒有在有 GPU 的機器或手機上量過。聲音沒有人聽過。
- 只有「步數內拿到分數」一種目標，沒有障礙物、收集指定水果這類關卡目標。

## 對引擎的發現

- 沒有新的缺口：一張圖集 + 一個 sprite 每幀重畫 64 顆水果、`ZhudaEffect2D` 的 `sparkle`/`hit-spark`、引擎的向量按鈕就夠了。
- 測試用的玩家如果用同一顆種子複製棋盤，會預知要掉什麼水果，量出來的分數高一倍——這是本專案自己的坑，寫進了 AGENTS.md。
