# 給在這個專案工作的 agent

這個遊戲全部用 zhuda-laya-engine 的 2D 做（同一個倉庫裡的引擎，`file:../..`）。關卡的磚塊是引擎的 `ZhudaTerrain2D`（碰撞問它的 `isBlocked`），由 `ZhudaTerrain2DRenderer` 畫；跳躍鍵進引擎的 `ZhudaInputBuffer`。規則（`src/core/game.ts`）是純 TypeScript，在 Node 裡測。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- 關卡寫在 `src/core/levels.ts` 的資料裡，不要手畫字元。守三條：平台放在出發點上方兩格；坑最寬三格；尖刺或坑的五格內上方不放任何實心的東西（跳起來會撞頭掉下去）。改完跑 `npm test`：會往前試玩的機器人三關都要過，只會往右跑的三關都要死。
- 地形繪製器把一格畫成調色盤顏色的方塊：尖刺的形狀和土上的草皮是 `Main.ts` 另外畫的。
- `npm run verify` 過了才算完成。
