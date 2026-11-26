# prefabs 規則（給 agent）

- 這個庫在引擎倉庫裡（2026-11-26 從遊戲中心的 `commonPrefabs/` 搬來）。倉庫根目錄的 `AGENTS.md` 管引擎；這一頁只管 `prefabs/`。整庫的檢查是倉庫根目錄的 `npm run verify:prefabs`（要連 Go 一起就 `npm run verify:prefabs:go`）。

- 說明與交付用繁體中文。
- 做任何遊戲的介面、輸入、存檔、語言、可重用 2D／3D 資產前，先看 `README.md` 與 `catalog.json`；有就用 `scripts/sync.mjs` 複製進遊戲，不要在遊戲裡重寫一份。
- 只改 `prefabs/` 的原始檔，不改遊戲裡的 `src/common/`、`public/common/` 複製品；改完跑 `npm run verify`，再對 `catalog.json` 裡 `usedBy` 的每款遊戲重新 sync 並跑它自己的驗證。
- 元件不放遊戲內容（台詞、角色名、圖片路徑）；顏色用 `--cp-*` 變數，版面讓遊戲覆寫。
- 新模組要有測試、登記進 `catalog.json`；對外行為改變要升版本並在 README 紀錄。
- 做 3D 場景、角色、天氣、畫質前，先看 README 的「3D 場景」和 `viewer3d/`：三座島、豬大豬二（會被抓、丟、唱歌）、第三人稱走路、一天的光都在這裡，觀看台 `?scene=<id>` 直接看。
- 改 `3d/` 或 `ui/scene-controls` 後，除了根目錄的 `npm run verify`，還要在 `viewer3d/` 跑 `node ../scripts/sync.mjs .` 和 `npm run verify`；外觀有變就重拍該模組的 `preview/`，並說明和改前的像素差。
- 新的 3D 模組：程式放 `3d/<名稱>/`，模型聲音放它的 `assets/`（列進 catalog），做法放 `source/`、圖放 `preview/`，寫 `README.md`，並在 `viewer3d/src/presets/` 加一個能看它的 preset。
- 2D 和 3D 同一套規則：程式在 `2d/<名稱>/`，觀看台是 `viewer2d/`（固定 WebGL，和 2D 遊戲逐像素可比）；改了 `2d/` 或 `systems/slot-round` 要在 `viewer2d/` 跑 `node ../scripts/sync.mjs .` 和 `npm run verify`。
- 遊戲伺服器的 Go 共用套件放 `server/<名稱>/`（一個 Go module，不經 sync），改完跑 `npm run verify:go`。
- 比對畫面時一定同時比 `window.__SCENE__.state()`（或遊戲自己的掛鉤）：兩邊一起出錯時畫面也會 0 像素差。
