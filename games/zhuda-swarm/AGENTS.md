# 給在這個專案工作的 agent

這個遊戲全部用 zhuda-laya-engine 的 2D 做（同一個倉庫裡的引擎，`file:../..`；features `core`、`2d`、`ui`）。整個戰場是一個 sprite，每幀從一張圖集重畫（`drawTexture`），四百多個敵人是 3 次繪製；不要改成每個敵人一個 sprite。規則（`src/core/run.ts`）是純 TypeScript，在 Node 裡測。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- 圖集由 `python3 -I tools/make-atlas.py` 產生（`assets/atlas.png`、`atlas.json`）；加圖就加在那支腳本裡。
- 改數值先跑 `npm test`：機器人八局要贏 4～7 局，站著不動要撐過 45 秒、撐不過 150 秒。
- 特效只給升級、進化、首領，而且預設用 `sparkle`、`hit-spark`：`level-up`、`confetti`、`explosion` 在這個遊戲裡會讓繪製次數從 3 變成 60～90 而且不回來（README「已知的限制」；`?fxfull=1` 重現）。改特效之後要重量：`node ../tools/shot.mjs . --size 960x540 --query "auto=1&speed=6&seed=5&fresh=1" --script tools/draws.mjs --out play-out/draws --name d`。
- `npm run verify` 過了才算完成。
