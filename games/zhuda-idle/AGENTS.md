# 給在這個專案工作的 agent

這個遊戲全部用 zhuda-laya-engine 的 2D 做（同一個倉庫裡的引擎，`file:../..`；features `core`、`2d`、`ui`）：720×1280 的設計尺寸縮放到螢幕，按鈕與面板是引擎的 `ZhudaUI`，特效是引擎的 `ZhudaEffect2D`，時間與計時器來自 runtime session，聲音是引擎的合成配方。規則（`src/core/idle.ts`）是純 TypeScript，在 Node 裡測。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- 這個遊戲沒有儲值，也不要加：所有貨幣都從遊玩得到，機率與保底寫在召喚畫面上，測試會抽二十萬次核對。
- 改數值先看 `test/idle.test.ts` 的一週模擬（四個種子）。
- 畫面的控制項用 `kit.ts` 的 `button(..., name)` 取名，錄製腳本（`tools/play.mjs`）靠名字找到位置後真的點畫布。
- `npm run verify` 過了才算完成。
