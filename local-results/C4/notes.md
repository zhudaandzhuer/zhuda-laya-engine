# C4：真顯卡的基準截圖

**狀態：做了（Mac）。**

- 本地機上的 Claude（Fable 5.2），2026-11-26。Apple M4，macOS 27.2.1，Chrome 158.0.8127.89。
- 對象：`unified` `50856ca4` 的九款遊戲（遊戲的檔和 `9efe74e4` 相同）。

## 先回答問的那一題

**這台 Mac 上 Playwright 可以驅動已安裝的 Chrome。** `chromium.launch({ channel: 'chrome' })`，不用另外下載瀏覽器；只裝 `playwright` 函式庫（1.65.1，`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright`，19 MB）就夠，`playwright-core` 也可以。無頭模式也是用真顯卡：頁面讀到 `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)`。

## 所以我直接把選項加上了

`games/tools/shot.mjs` 多了這些（沒加任何一個時和原來完全一樣，仍是軟體繪製）：

| 選項 | 作用 |
| --- | --- |
| `--gpu` | 用機器上安裝的瀏覽器和它的顯卡 |
| `--headed` | 開視窗（不加就是無頭，一樣用顯卡） |
| `--channel chrome` | 用哪個已安裝的瀏覽器（預設 `chrome`） |
| `--dpr 2` | 裝置像素比（預設 1） |
| `--root dist/web` | 要服務的建置資料夾（WebGPU 版放在 `dist/webgpu` 時用） |
| 環境變數 `SHOT_CHROME_ARGS` | 額外的瀏覽器參數，例如拿掉 60 Hz 上限 |

紀錄檔多了 `renderer`（顯卡名稱、有沒有 WebGPU、瀏覽器字串、像素比），主控台錯誤後面會帶網址。

## 九款各跑一次它自己的錄製腳本

`PLAYWRIGHT_PATH=<裝了 playwright 的 node_modules> sh local-results/C4/run.sh`。大小和網址參數照各款 README 或 `tools/play.mjs` 開頭寫的，只多加 `--gpu`。腳本裡是真的點擊、按鍵、拖曳。

| 遊戲 | 腳本 | 圖 | 頁面錯誤（不算 favicon） | 結果 |
| --- | --- | --- | --- | --- |
| `zhuda-beat` | `keys` | 4 | 0 | 走完 |
| `zhuda-guard` | `hands` | 2 | 0 | 走完 |
| `zhuda-hunt` | `q1`（機器人） | 9 | 0 | 第一次截圖逾時，重跑走完（見下） |
| `zhuda-idle` | `first` | 11 | 0 | 走完 |
| `zhuda-jump` | `keys` | 3 | 0 | 走完 |
| `zhuda-match` | `hands` | 5 | 0 | 走完 |
| `zhuda-merge` | `first` | 7 | 0 | 走完 |
| `zhuda-swarm` | `hands` | 7 | 0 | 走完 |
| `zhuda-wardrobe` | `hands` | 13 | 0 | 走完 |

圖和紀錄在 `mac/<遊戲>/`（JPEG，品質 88；原本的 PNG 沒有留）。這一組就是以後比對用的真顯卡基準。

- **九款的錄製腳本在真顯卡、真的速度下都走得完。** 這些腳本原本只在軟體繪製（慢很多）上跑過；腳本裡的等待時間在快的機器上也成立。
- **`zhuda-hunt` 第一次沒過**：`page.screenshot` 等了 30 秒逾時，一張圖都沒拍到，但遊戲本身有打完（最後停在結算畫面）。同樣的指令重跑一次、再用 `speed=2` 跑一次，都走完（9 張和 13 張）。第一次的紀錄留在 `mac/zhuda-hunt/q1-first-try.log.json` 和 `failed.jpg`。原因沒有查；只出現一次。
- **每一款的結束碼都是 1**，因為真的 Chrome 會去要 `favicon.ico`，拿到 404，`shot.mjs` 把主控台錯誤算成失敗。九款都一樣，和遊戲內容無關。要讓結束碼有意義，得在 `public/index.html` 加一個圖示（或在 `shot.mjs` 忽略這一條）；我沒有改。

## 沒做的

- 沒有逐張看圖，也沒有和庫裡軟體繪製的 `docs/evidence/` 逐張比對。
- 沒有把這組圖設成任何測試的基準；只是放著。
- 每款只跑了一種腳本（有 `bot` 和 `hands` 兩種的只跑了一種）。
- 沒有在 Windows、Linux 或手機上跑。
