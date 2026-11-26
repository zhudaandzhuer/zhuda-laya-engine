# 2d/：可重用的 2D 場景、角色、系統與素材

和 `3d/` 同一套規則：程式（`*.ts`，會 sync 進遊戲的 `src/common/2d/…`）、`assets/`（圖、聲音，原樣 sync 到 `public/common/2d/…`）、
`source/`（怎麼做出來的，不 sync）、`preview/`（圖，不 sync）、`README.md`。觀看台是 `../viewer2d/`（固定 WebGL）。

## 連消老虎機（拆自 <original-cascade-slot>，主題與美術未收）

| 模組 | 做什麼 |
|---|---|
| `2d/cascade-math` | 隨處消除連消倍數數學（純 TS）：和 Go 伺服器 `server/slotmath` 同種子同結果的引擎、種子局（給本機存檔重算）、腳本局插拔管線、中性範例設定 |
| `2d/slot-client` | slot 用戶端的其餘部分（純 TS）：連消畫面資料、伺服器回合轉換、伺服器用戶端與伺服器權威 session、管線、事件、狀態、語系級聯、資產尋址 |
| `2d/slot-ui` | 畫面（Laya，程式繪製）：演出播放器、逐格時鐘、盤面、大獎、控制列、倍數看板、三個對話框、掛載層、音效橋、佔位符號 |

回合狀態機與本機帳本是 `systems/slot-round`（和 dungeon-spin 共用）。觀看台：`viewer2d` 的 `?scene=cascade-slot`；做法：`docs/routes/cascade-slot.md`。
