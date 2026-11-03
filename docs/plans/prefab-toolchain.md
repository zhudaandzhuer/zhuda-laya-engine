# Prefab 隔離預覽與消費端工具路線圖

Status: In progress

Owner: Engine tooling and consumer integration

Last reviewed: 2026-11-03

## Objective

從乾淨的遊戲 checkout，任何 agent 都能選定一個遊戲 Prefab 的子節點、狀態及動畫時間，重現美術比對，再用同一份定義組入 Scene。[開發順序](../prefab-workflow.md)是現行工作規則。1.1.0 已交付 P0 的公開接入、單 Prefab 預覽與消費端瀏覽器證據閘門；下表保留後續 P1/P2 工作。

## Current baseline

從消費遊戲的開發經驗可見三個問題：主畫面使用程式建立節點，建置卻校準的是引擎內建 Prefab；引擎副本與主庫會分歧；以字串比對驗證 UI 座標，無法察覺後續覆寫的位置。這些觀察促成工具需求，不能用來推算效能收益。

- 引擎已有[獨立 consumer build](../3d-integration.md)、[Provider 與 lease](../asset-loading.md)、序列化階層與實例化器。基線 `dee5bcf` 的套件根入口在執行時匯出 `ZhudaPrefab`、`ZhudaUI`，但公開型別入口缺少這兩個類別。消費端在遇到這類缺口時應建立引擎回歸案例。
- 引擎 checkout 內執行 `npm run build`、`npm start`，可開啟 `http://localhost:8890/preview.html?asset=NineSliceDialogFrame.lh`。工作台入口 `src/PreviewMain.ts` 從內建清單選擇示例。外部建置測試 `tests/consumer-build.test.mjs` 會確認遊戲輸出不含示例預覽頁。
- [視覺契約檢查](../../packages/compiler/visual-contract-audit.mjs)驗證指定呈現狀態與還原規則。[畫面輪廓比較](../../packages/core/effects/README.md)可量前景遮罩的重疊和重心。兩者均有明確範圍，單靠這些結果無法確認文字、內部色彩或裝置效能。

## Delivered in 1.1.0

- `ZhudaPrefabLibrary` uses the public `AssetProvider` cache/lease lifecycle,
  validates static 2D hierarchies, exposes named child selection and records
  source hashes for every instance.
- `runConsumerBuild` can emit an isolated `prefab-preview.html` from the
  consumer's own definitions. `prefab-check.mjs` captures real desktop WebGL
  draws, source provenance, fingerprints and pixel diffs; `prefabEvidence`
  blocks stale or changed artifacts.
- `consumer-guards.mjs`, Doctor's `--project` mode and the MCP visual workflow
  contract reject private engine imports, copied engine sources and untyped
  `Laya` declarations. The neutral browser fixture covers wrong nodes, shifted
  text, wrong same-sized textures, cancellation, timeout and 30 unload cycles.

## Staged work and acceptance gates

各項依序取得證據再決定是否擴大。引擎提供通用資料格式、工具、公開型別和中性 fixtures；遊戲保存美術基準、媒體、情境及實機產物。

| 順序 | 引擎工作與選擇 | 可驗收的結果 |
| --- | --- | --- |
| P0 — 公開接入 | 補齊 Prefab／UI 必需的根入口型別。以一個外部專案鎖定引擎版本，沿用 consumer build。Doctor 優先檢查遊戲深層匯入、複製 engine/vendor、全域 Laya any 等可客觀判定的偏差；特殊渲染器保留具名 adapter。 | strict TypeScript fixture 只用公開入口即可建立實例；ESM/CJS 匯出與宣告一致。刻意加入私有匯入時應指出檔案、行號與修法。建置後遊戲原檔雜湊不變，不產生引擎範例。 |
| P0 — 單 Prefab 預覽 | 先用一個外部專案的中性面板打通真實資產。沿用 Provider／lease、實際 Prefab 定義與 renderer，增加 ID、子路徑、狀態、seed、時間、DPR 選擇，保存輸入版本與基準。隔離入口可注入最小相機／燈光和假資料。 | 不導入遊戲 Main、Scene 或後端即可畫出指定子節點；從預覽和 Scene 檢查相同資產 ID 與版本。未知 ID、子節點遺失、材質錯誤或缺檔須能定位；切換時取消舊請求，連續 30 次卸載後資源回到約定範圍。 |
| P0 — 把關卡接到消費端 CI | 建立 Prefab→子組件→Scene 的依賴索引及證據記錄。CI 從依賴變更算出待重驗集合，確認實際建置引用的 ID、比較用的版本與測試環境；將幾何、影像差異及行為分開判定。PR 檢查跑固定環境，本機可只跑受影響的 Prefab。 | 正常樣本通過。推歪文字須使幾何／影像測試失敗，換錯同尺寸貼圖也須失敗。私改 Scene 另畫一份、缺基準、引用示例報告、過期基準均不能放行。失敗輸出定位到 Prefab ID／子路徑，附預期、實圖及差異。SSIM 不能直接當像素位移。 |
| P1 — 常用 UI 與切片 | 用真實跑版案例擴充既有九宮格與文字佈局。內容區／光學中心由 Prefab 帶入，量測字形與描邊，明確指定 min/max 字級、RTL 和溢出策略。CLI 可精算指定 alpha 閾值下的外框；顏色推估的內容區只產生可覆寫建議。 | 測不對稱邊框、陰影、透明留白、長數字、不同字型與語系、不同尺寸與 DPR。可區分切片邊界和文字安全區；人工註記優先。先量既有容器是否足夠，再以多個案例及包體／排版成本決定是否導入 Yoga。 |
| P1 — 生命週期、時間與音訊 | 示範切頁暫停、回前景重算、清理指標輸入、對 Canvas 的 context-loss 處理及顯式釋放。重用既有 clock／音訊解鎖與靜音邏輯，讓消費端配置併發上限。 | 實際切頁後不補播過期事件、恢復時不重複執行遊戲動作；關面板後無晚到資源。用真實輸入、實際失去／重建 WebGL context、音訊手勢與 30 次拆除驗證。Worker 心跳或看到 suspend 字串均不能證明行為。 |
| P2 — 影片特效相容性原型 | 把下載完成、解碼就緒、首幀成功合成分開記錄。以同一個特效 Prefab 比較原生透明影片、單支 RGB／alpha 並排影片經 shader 合成、圖集／靜態降級。聲明 DOM 或 Canvas 顯示方式與輸入範圍。 | 在目標 iPhone Safari、Android Chrome 和桌面各看實際透明邊緣、層級、點擊、首幀延遲、記憶體與釋放。測取消／逾時／錯誤後能降級。只對通過的平台組合標示支援；保留原本可用路徑。 |

## Rollout and rollback

CI 的第一個具體案例可用同一塊數字牌走兩個入口。獨立預覽記錄 Prefab ID、子節點路徑、定義及依賴雜湊；Scene 測試在約定的掛點讀出**實際掛載實例**的來源與最終畫面。刻意讓 Scene 改用手畫副本或在掛載後修改字級，前一例應在來源檢查失敗，後一例應在幾何或畫面比對失敗。這使測試能區分「清單裡寫了」和「玩家看到的就是這個 Prefab」。

先用一個「有外框、長數字、描邊」的小面板完成前三項。以原遊戲畫面建立經核准的外觀參考，並為超界問題另列修正預期。先驗其文字和外框，再驗整塊面板，最後替換一個 Scene 掛點。記錄新增一個資產所需時間、回歸誤報及是否能定位差異。錯誤無法定位或外觀回歸時，還原該掛點至前一版本，保留失敗樣本供除錯，再決定是否遷移盤面、控制列及特效。

引擎缺陷以最小中性案例修正；RGS、下注、計分、語系內容、專屬美術與部署維持消費端所有。媒體解碼、裝置效能與新的 UI 演算法均需各自量測。目前無通用消費端工具可自動判定任意 Scene 是否遵守上述全部關卡。
