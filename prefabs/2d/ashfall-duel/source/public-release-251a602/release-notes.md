# 灰燼之庭正式發行

**Commit**　`251a6024575c421e1b814b80fc5957fc31a6c57d`

## Purpose

改善動作切換與手機雙指操作，並發布至原公開入口。開場距離的輕斬放手至命中由 333.3 ms 縮短為 241.7 ms，兩項數值均在 120 Hz 戰鬥模擬中量測。

## Changed files · File-by-file summary

| 狀態 | 檔案 | 修改內容、相依與同步注意事項 |
| --- | --- | --- |
| M | `README.md` | 更新手機按法、出劍時間與公開版證據連結。移植說明時更新站點與實測紀錄。 |
| A | `assets/art/knight-motion-0.webp` | 騎士中間幀第一頁。與第二頁及 motion-cels.json 使用同一套座標。 |
| A | `assets/art/knight-motion-1.webp` | 騎士中間幀第二頁。隨第一頁與場景內的 Knight/Motion1 一起搬移。 |
| A | `assets/art/warden-motion-0.webp` | 守衛中間幀第一頁。需對應 Warden/Motion0 與索引頁序。 |
| A | `assets/art/warden-motion-1.webp` | 守衛中間幀第二頁。需對應 Warden/Motion1 與索引頁序。 |
| M | `assets/courtyard.lh` | 騎士和守衛各增加兩個隱藏圖集節點，由共用 Prefab 載入。保留節點名稱和 skin 路徑。 |
| M | `src/Main.ts` | 以引擎 full 模式量測視口，將場景鏡頭的反向換算提供給 Controls。需同步 render、interface 及 viewport 設定。 |
| M | `src/combat.ts` | 調整輕斬、收招接技、蓄力與閃避優先序，雙方依當前姿勢切換。相依 motion、transitions 與豬大引擎的輸入緩衝。 |
| M | `src/interface.ts` | 依手指分別管理移動與攻擊，處理滑動、取消、背景切換與蓄力顯示。配對 HTML、CSS 和 worldAt。 |
| M | `src/motion.ts` | 區分輕斬短弧與重斬抬手的姿勢時間表。動作編號需對應原始圖集與 combat。 |
| A | `src/motion-cels.json` | 記錄四頁圖集的影格、裁切範圍與錨點。換圖時用相同素材和腳本重製。 |
| M | `src/prefabs.ts` | 將新圖集宣告為場景的依賴材質。保留 JSON、場景和資產路徑的一致性。 |
| M | `src/render.ts` | 每人每次繪出一幀，沿關節變形，加入雙人取景、點擊座標轉換。需對應 Main 的視口與圖集錨點。 |
| A | `src/transitions.ts` | 動作被打斷時沿相鄰的中間幀銜接，讓手腕與劍柄走同一路徑。相依動作圖集索引及 motion 定位。 |
| M | `public/index.html` | 新增移動盤、主攻擊與閃避按鈕、觸控說明及可讀標籤。與介面的元素 ID、CSS 一併更新。 |
| M | `public/court.css` | 調整直橫向畫面、拇指按區、安全區與蓄力環。配對 HTML 的按鍵結構與繁中標籤。 |
| A | `scripts/bake-transitions.py` | 以既有角色圖、關節及手臂遮罩離線生成中間幀。重製時需要 Node、Python、Pillow、OpenCV、NumPy。 |
| A | `scripts/check-controls.mjs` | 從遊戲入口檢查多指、轉向、取消、點擊高度並錄影。需要測試用 Chrome 與 Playwright。 |
| M | `tests/combat.test.mjs` | 補上五項回歸，包括放手至命中、連點、收招閃避、受擊後移動與姿勢銜接。相依相同圖集、戰鬥程式和 Node 24。 |
| M | `tsconfig.json` | 啟用 resolveJsonModule 供圖集索引使用。併入其他專案前比對 TypeScript 設定。 |
| M | `zhuda.config.json` | 視口改為 full，與引擎啟動參數及遊戲鏡頭一致。其他設計尺寸需另行核對。 |
| M | `evidence/courtyard.json` | 以本版指紋核對整個場景。目標專案需用其基準重跑比對。 |
| M | `evidence/knight.json` | 以本版指紋核對騎士素材。依賴隔離預覽、資產與對應基準。 |
| M | `evidence/warden.json` | 以本版指紋核對守衛素材及 30 次載入、卸載。依賴對應基準與環境。 |
| M | `evidence/public-release.json` | 記錄正式網址、ZIP 摘要、公開檔案比對、觸控操作及命中數值。重新部署時需重新驗證。 |
| M | `evidence/public-title.jpg` | 這次正式站的桌面標題與聯名標誌實拍。搭配發布紀錄查閱。 |
| A | `evidence/public-portrait.jpg` | 這次正式站 390 × 844 的直向觸控模擬截圖。和發布紀錄一起保存。 |
| A | `evidence/public-landscape.jpg` | 這次正式站 844 × 390 的橫向觸控模擬截圖。和發布紀錄一起保存。 |
| A | `evidence/public-duel.mp4` | 正式入口連續的蓄力、命中、移動與後撤實玩錄影。與同版指紋一起保存。 |

## Risk / dependency notes

- 此次修改集中在決鬥遊戲專案。引擎為豬大 1.18.0，固定提交 `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`。每個角色仍有原本八個關鍵姿勢。
- 圖集、錨點、場景節點名和相對路徑須配對。畫面使用繁體中文，標題顯示豬大 × LayaAir。遊戲代號為 `ashfall-duel`。
- 桌面在 Windows Chrome 實玩。手機使用 Chrome 的雙指觸控模擬，iOS、Android 實機待測。
- 發布包內 27 個檔案均與本機發行目錄一致。公開回應的 25 個檔案逐位元相同，兩個 HTML 由 Cloudflare 加入統計腳本。

## Recommended sync approach

同源分支可整筆 cherry-pick。併入別的遊戲時，先比對引擎版本、`tsconfig.json`、`zhuda.config.json`、`src/Main.ts` 與場景節點。將四張 WebP、索引、場景與繪圖程式一起搬移，再手動合併 HTML、CSS、繁中按鍵名稱與輸入綁定。使用目標站網址執行瀏覽器驗證，保存其實際部署紀錄。
