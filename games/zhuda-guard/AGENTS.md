# 給在這個專案工作的 agent

這個遊戲用 zhuda-laya-engine 做（同一個倉庫裡的引擎，`file:../..`）：山口是 film scene 資料，荒獸經引擎的模型庫載入後放在池子裡重複使用，塔與子彈是引擎的基本幾何，速度用 runtime session 的 `world` 時間層。規則（`src/core/td.ts`）是純 TypeScript，在 Node 裡測。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- 改數值先跑 `node tools/balance.ts`：照計畫蓋的要贏，只蓋一種塔的三種都要輸；再跑 `npm test`。
- 這個引擎是右手座標：鏡頭朝 +z 看時 +x 在畫面左邊。標記與血條的位置用 `stage.worldToScreen`，不要自己投影（這裡自己寫過一次，左右寫反）；`extrude` 的 outline 是 `[x, z]`。
- 不要打開草（`?grass=1`）當預設：這塊場地開草是 525 次繪製，關掉 45 次。
- `npm run verify` 過了才算完成。
