# 上一版公開發行包（251a602）：退回公開站用

這是《灰燼之庭》在公開站 <https://game.qianlongxundao.com/ashfall-duel/> 的上一版：提交 `251a602`，站上版本 `20261123T173503291799Z`，原作者 CCW 在 Windows 建置。
原專案把它放在 `attic/public-release-251a602/`（不進 git），拆進函式庫時原樣搬到這裡。

| 檔案 | 內容 |
|---|---|
| `game.zip` | 發行包，3,006,811 位元組，SHA-256 `8be96d17cdf470b7071ed712093a1b3e9663a9f8cf5d87e1558f7173c342c4f7`（和 `../release-records/public-release.json` 記的相同），27 個檔 |
| `release-notes.md` | 那一版的變更說明（原作者） |
| `consumer-build.json` | 建置紀錄（指紋 `d9aa90cd…`、引擎 `def94aa`、WebGL、`branding: engine`） |

**把這個 zip 上架，公開站就會退回 251a602 那版**：搬進遊戲中心、改用共用元件之前的版本（沒有「音效設定」，也沒有修好「雙指按住時第三指按暫停沒反應」）。
現在上線的是 `ca53724`（版本 `20261124T171318866006Z`），可以從 `../ashfall-duel.bundle` 的 `main` 重新建置，發行包逐位元組相同。
上架是對外動作，先問使用者；做法見 `../../README.md` 的「上架」（zhuda-windows 技能 B 路線，`ssh_publish.py` 不收 `.lh`）。2026-11-25 上架紀錄寫著站上還留著 `releases/20261123T173503291799Z/`（`previousRelease`）；沒有驗證過不重傳能不能直接切回。
