# 給在這個專案工作的 agent

這個遊戲全部用 zhuda-laya-engine 的 2D 做（同一個倉庫裡的引擎，`file:../..`）。規則（`src/core/board.ts`）是純 TypeScript、有種子，在 Node 裡測；畫面（`src/Main.ts`）只照規則回傳的每一輪（`Round`）播放，不自己算消除。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- 改分數或關卡目標後跑 `node tools/balance.ts`：它量兩種玩家（看到就換的、挑當下最高分的）。挑最高分的那個不能預知會掉什麼水果（`bestMove` 換了種子），不然量出來的分數會高一倍。
- 每顆水果有 id；畫面用 id 對位置，不要用格子索引對。
- 特效只用 `sparkle`、`hit-spark`（`level-up`、`confetti`、`explosion` 在 zhuda-swarm 讓整個場景掉出合批，原因未明，見倉庫根目錄 `HANDOFF.md` 的待辦）。
- `npm run verify` 過了才算完成。
