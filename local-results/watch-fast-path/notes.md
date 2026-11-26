# watch-fast-path：改腳本存檔後 0.15 秒左右就能重新整理（2026-11-26）

擁有者的 Mac（Apple M4，macOS 27.2，Node 26.13.1，esbuild 0.27.1）。沒有人參與；沒有手機、沒有 Windows。
規則寫在 [`docs/consumer-tooling.md`](../../docs/consumer-tooling.md#the-watcher-saves-that-change-only-scripts)，完整的檢查表在 [`docs/plans/records/watch-scripts-only/verification.md`](../../docs/plans/records/watch-scripts-only/verification.md)。

## 做了什麼

`zhuda-laya-watch --candidate` 在「上次建置之後改到的檔案全部在 `src/` 裡」時，只重建 `app.js`：用一個整段監看期間都留著的 esbuild context，設定和完整建置同一份，所以位元組和完整建置寫出來的一樣；重建前照樣跑完整建置的來源檢查。改到 `assets/`、`public/`、`zhuda.config.json`、`package.json` 就照舊跑完整建置。

**快速路徑的結果不寫進磁碟。** 新的 `app.js` 只在 watcher 的記憶體裡，由它自己的伺服器給頁面；`dist/candidate/web`、`game.zip`、`consumer-build.json` 一直是上一次完整建置的整組結果。這段期間 watcher 給出去的 `payload-manifest.json` 沒有指紋（`fingerprint: null`，多一個 `stale` 欄位），`zhuda-prefab-check` 看到就拒絕。所以沒有任何檔案會被誤認成發布版或驗收過的候選版。

不走快速路徑的：沒加 `--candidate`（那時輸出資料夾就是發布版，別的工具會直接讀）、設了 `prefabPreview`／`prefabChecks`／`prefabEvidence` 的專案、加了 `--full-builds`。

## 量到的

存檔（把 `src/Main.ts` 用同樣的位元組寫回去）到 watcher 送出 `reload` 的時間，九次的中位數，含 120 ms 的防抖。單位毫秒。

| 專案 | 改之前（16:14） | 改之後、`--full-builds`（17:24） | 改之後（17:24） | watcher 自己記的重建時間 |
| --- | --- | --- | --- | --- |
| `games/zhuda-match`（2D） | 263 | 362 | **143** | 11 |
| `games/zhuda-hunt`（3D） | 899 | 1206 | **145** | 13 |
| `prefabs/viewer3d`（3D，輸出 50 MB） | 1459 | 2119 | **157** | 24 |

- 改之後的兩欄是在別的會話同時在這台 Mac 上跑重工作的時候量的（一分鐘負載 7.3 到 8.5，之前一小時多數時間超過 100）。中間那欄比第一欄慢是因為機器忙，不是因為改了程式：把舊程式和新程式的完整建置放在同一個程序裡交錯各跑七次，中位數是 220／224、1292／1297、2359／2371 ms，指紋相同。
- 沒有在和第一欄一樣安靜的機器上量到「改之後」。
- 完整建置寫出來的東西沒有變：三個專案的候選版、九款參考遊戲的發布版，指紋和 ZIP 大小都和改之前一樣（`before-fingerprints.txt`／`after-fingerprints.txt`、`release-before.txt`／`release-after.txt`）。

## 在瀏覽器裡看過一次

對 `games/zhuda-match` 開 watcher，在桌面 app 的瀏覽器窗格開它的頁面；把標題字串改成「豬大果園・已自動重載」，頁面自己重新載入、舞台上第一個文字節點變成新字串、`app.js` 從 369,447 變 369,483 位元組、清單沒有指紋；磁碟上的 `dist/candidate/web/app.js` 沒有新字串。改回去之後頁面再自動載入回原樣，`git status` 對那款遊戲沒有任何變更。圖：`edited-title.jpg`（無頭 Chrome 拍的；字串太長所以標題超出畫面）。

## 沒量的

- Windows、Linux；手機經區網連 `--host 0.0.0.0`。
- 超過一萬行腳本的專案（兩個會掃全部腳本的步驟已改成只重掃有改的檔，但沒有拿大專案量過）。
- 設了 `prefabPreview` 的專案沒有快速路徑（每次存檔仍是完整建置）。

## 過程中看到的、沒有修的

- 專案路徑經過符號連結時（例如 macOS 的 `/var` 暫存目錄），`app.js` 裡不會有元件類別的註冊；完整建置也一樣。原因是建置外掛拿 esbuild 回報的真實路徑和設定的路徑直接比字串。**同一天使用者說要修，已修**：紀錄在 [`docs/plans/records/consumer-symlink-entry/`](../../docs/plans/records/consumer-symlink-entry/verification.md)。
- watcher 啟動後印的網址是 `prefab-preview.html?id=ui/control-bar`，沒有 prefab 預覽的專案沒有這一頁；遊戲在 `/`。
- 機器負載超過 100 時，有五個測試檔裡的六個計時類測試會不過（啟動逾時、「N 毫秒內完成」）；負載降下來單獨重跑都過。

`full/` 底下是原尺寸的圖（不進版本庫）。
