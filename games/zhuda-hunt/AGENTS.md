# 給在這個專案工作的 agent

這個遊戲用 zhuda-laya-engine 做（同一個倉庫裡的引擎，`file:../..`）：場景是 film scene 資料，角色經引擎的模型庫載入，招式是引擎的 action frame spec，按鍵進引擎的 input buffer，卡肉用 runtime session 的 `world` 時間層，聲音是引擎的合成配方。規則（`src/core/`）是純 TypeScript，在 Node 裡測。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- 改數值先跑 `npm run bots`（三隻怪 × 三種機器人 × 八個種子），再跑 `npm test`。
- 介面是 `public/index.html` 裡的 DOM；3D 裡的東西都在 `src/view/`。
- `npm run verify` 過了才算完成；畫面要有 `docs/evidence/` 裡的瀏覽器紀錄。
