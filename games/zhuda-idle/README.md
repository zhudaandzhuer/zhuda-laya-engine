# 豬大掛機傳

原創的放置抽卡手遊，直式。開局簽到送十連、召喚九野的十一位契師、五人隊伍自動推關、離線掛機收金幣、一鍵升級與上陣、每日任務、七日簽到、VIP。這一類遊戲常見的東西都有，**但沒有儲值**：券、靈玉、VIP 經驗全部從遊玩得到，機率與保底寫在召喚畫面上。

- 引擎：同一個倉庫裡的 zhuda-laya-engine（`file:../..`），**全部用引擎 2D**（features `core`、`2d`、`ui`），沒有 DOM 介面。
- 機率：SSR 2%、SR 13%、R 85%；第 45 抽起 SSR 機率逐抽提高，第 60 抽必出；每 10 抽必出 SR 以上。
- 卡面是契師頭像與荒獸預覽圖縮成 256 px（`tools/make-art.py` 記錄做法；來源圖不在這個倉庫，見 `games/ASSETS.md`）。

## 怎麼跑

```sh
npm install && npm run verify      # 建置、型別、Doctor、9 項規則測試
node ../tools/shot.mjs . --size 540x960 --query "fresh=1&fast=1" --script tools/play.mjs --out play-out/first --name first
```

網址參數：`?fresh=1` 新存檔、`?demo=1` 三天後的樣本存檔（不寫回）、`?tab=summon` 直接開某一頁、`?fast=1` 演出加快。

## 用到引擎的哪些東西

`ZhudaEngine.boot`（2D）、`ZhudaUI.createVectorButton`／`createGlassPanel`（全部按鈕與面板）、`ZhudaEffect2D`（`coin-burst`、`confetti`、`level-up`、`sparkle`、`hit-spark`、`explosion`）、runtime session 的 `ui` 時間層與 `timers`（戰鬥與翻卡的節奏，沒有 `setTimeout`）、`IframeSoundAdapter` 與合成配方（11 個聲音）、Laya 的文字、圖形、貼圖載入。自己寫的：設計尺寸縮放、補間、紅點、進度條、卡片（`src/ui/kit.ts`）。

## 驗證到哪裡

- `npm run verify` exit 0（Doctor HEALTHY；9／9）。測試抽二十萬次核對公開機率、五萬抽核對保底、四個種子模擬一週（每天四次上線）。
- 從新存檔到第一道牆的整段流程（簽到 → 十連 → 一鍵上陣升級 → 推到第 10 關首領卡住 → 快轉三小時領掛機 → 領任務 → 再打過）在無頭 Chromium 上**用真實點擊**跑過，無主控台錯誤：`docs/evidence/first-session/`。

## 已知的限制

- 沒有實機、沒有人玩過；觸控大小與字級只在 540×960 的截圖裡看過。
- 戰鬥是「戰力比大小」加演出，沒有技能、陣型、屬性；養成只有等級與星級。
- 沒有伺服器：時間用裝置時鐘，改時鐘就能領掛機。真的要上線，掛機與抽卡要搬到後端。
- 一週模擬裡偶爾有一天卡在首領關（測試允許一天，不允許連兩天）。
