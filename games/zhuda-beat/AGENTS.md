# 給在這個專案工作的 agent

這個遊戲全部用 zhuda-laya-engine 的 2D 做（同一個倉庫裡的引擎，`file:../..`）。歌（`src/core/song.ts`）和判定（`src/core/judge.ts`）是純 TypeScript，在 Node 裡測。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- **時間只有一個來源**：歌的時間 = `performance.now()` − `origin`。按鍵用事件自己的 `timeStamp`，不要用「這一幀的時間」。音檔用 `offsetSec` 從時鐘說的位置開始播，不要假設它是在時間零那一刻開始的。
- 這個遊戲寫的時候引擎的 `IframeSoundAdapter` 沒有音訊時鐘，而且頁面失焦時它會自己暫停音訊；所以失焦一定要暫停遊戲，回來要重新從偏移處播。歌響著的時候 `origin` 每幀往引擎的 `getSamplePositionSec` 靠（`Main.ts`）；讀不到（還沒解鎖、靜音、停了）就只用頁面時鐘，所以失焦暫停那一段要留著。
- 譜面取自旋律的起音，和音檔出自同一份資料：不要另外手寫譜面時間。
- 引擎合成器一個 recipe 最長 10 秒、最多 16 層：整首歌是逐音算好、自己混進一條 Float32Array 再用 `encodeZhudaWav` 包起來的。
- `npm run verify` 過了才算完成。
