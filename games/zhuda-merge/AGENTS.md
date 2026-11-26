# 給在這個專案工作的 agent

這個遊戲全部用 zhuda-laya-engine 的 2D 做（同一個倉庫裡的引擎，`file:../..`；features `core`、`2d`、`ui`）。盤面從一張圖集畫（`assets/items.png`，由 `python3 -I tools/make-items.py` 用 Noto Color Emoji 產生），拖曳用 stage 的指標事件換成設計座標。規則（`src/core/board.ts`）是純 TypeScript，在 Node 裡測。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- 沒有儲值，也不要加：體力靠時間、升級、遊戲裡賺的金幣。金幣換體力的價格要讓「點一下賺的金幣」買不回一點體力（現在是 0.44），不然體力就無限了；測試的三個種子會跑到滿級並檢查時數。
- `ZhudaEngine.boot` 會在回傳之前就呼叫 `onResize`：回呼裡用到的東西要先有，或像 `Main.ts` 那樣擋掉。
- 錄製腳本（`tools/play.mjs`）用遊戲回報的格子位置真的拖、真的點。
- `npm run verify` 過了才算完成。
