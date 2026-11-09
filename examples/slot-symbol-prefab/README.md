# Slot Symbol Prefab Showcase

這個範例把「美術換一張圖」和「工程重做一套特效」拆開。`slot/symbol` 是唯一的
Prefab 定義，`Art` 是可替換的邏輯圖片；Badge 和四種
狀態動畫都留在同一份 Prefab／效果控制器裡。做新 symbol 時只要替換
`assets/symbols/rocket.png`，不需要改 Scene 或複製特效程式。

## 美術快速流程

在這個目錄執行：

```sh
npm run manifest
npm run typecheck
npm run build:candidate
npm run preview
```

再開啟輸出的網址：

```text
http://127.0.0.1:8890/index.html
```

要看同一份 `slot/symbol` Prefab 組成的完整 Scene，可開啟：

```text
http://127.0.0.1:8890/index.html?scene=slot-machine
```

這個 Scene 的靜態結構保存在 `assets/scenes/slot-machine.ls`，由 Laya `Scene`、`Sprite`、
`Label` 與 15 個同源 Prefab instance 組成 5×3 reel window。啟動時先透過
`AssetProvider` 載入 `.ls`，再用公開 `ZhudaPrefab` 水合；TypeScript 只尋找命名節點、掛入
已驗證的 `slot/symbol` Prefab，以及驅動狀態效果。它不是另一份複製的 symbol，也沒有把場景
UI 改成 HTML 假畫面。

要像檢查 Prefab 一樣逐層查看或拖曳 Scene，可直接使用引擎共用的 Web Static Asset Editor：

```sh
npx zhuda-prefab-editor \
  --project "$PWD" \
  --prefab assets/scenes/slot-machine.ls \
  --port 8891
```

`.ls` 會使用相同的階層樹、Inspector、設計尺寸、anchor/pivot 框線、Agent View、Undo/Redo
和 revision-safe Save；編輯器載入的是這份 Scene 本身，遊戲 runtime 才會再掛入 15 個 symbol Prefab。

Agent 截圖可直接指定狀態，例如 `index.html?state=jackpot`；畫面會以該狀態啟動，
不需要先點擊面板。

Anchor 與座標標籤預設不壓在素材上；需要校準時可加上 `&guides=1` 顯示設計輔助線與
`ART ANCHOR` 標記。

首頁就是交付時的實際展示畫面：它使用同一份 `slot/symbol` 定義、runtime timeline
和引擎 `ZhudaParticleSystem`，
只保留狀態切換與換圖入口，不另外套一層「預覽版」的假畫面。切換
`idle`、`selected`、`win`、`jackpot`，或用 `Replace image` 載入本機圖片，都會直接反映
在使用者看到的 symbol 上。正式替換後仍要把圖片放回 `assets/symbols/rocket.png`，再跑
manifest 讓 bytes/SHA-256 更新。

畫面左側的 `PREFAB HIERARCHY` 直接讀取已實例化的 Laya 節點樹，可以展開
`SlotSymbol → Shadow / Art / Badge`。點選節點會在設計畫布上顯示該節點的 bounds；這個檢視面板
是 Agent／美術用的工具層，不會被打包成遊戲 Scene。右側 Inspector 會跟著目前選取節點更新；
點設計畫布的空白處可回到 Prefab root，階層標題列的 `COPY` 會複製包含尺寸、位置、scale、
anchor、pivot 與子節點的 JSON，方便直接貼給 Agent 討論。

`dist/candidate/web/prefab-preview.html` 是 CI 用的隔離 Prefab 驗收入口；
`dist/candidate/web/index.html` 是給人和 Agent 直接觀察成品的互動畫面。
畫面下方的 `ASSETS` 工作台直接讀取同一份 `AssetManifest`：左側是 `assets/` 目錄樹，右側是
目前資料夾的 `.ls` Scene、`.lh` Prefab、圖片縮圖與 `.glb/.gltf` 3D 模型卡片，卡片會顯示
種類、檔案大小與 manifest 鎖定狀態。點擊 Scene／Prefab 會重新使用相同的 Laya runtime 預覽；
點擊圖片會切到 Prefab 預覽並替換 `Art` slot；點擊 3D 模型會切到同一個頁面的 Laya 3D
預覽，顯示 Sprite3D 階層、mesh、材質、morph、動畫與模型資產資訊，拖曳可旋轉、滾輪可縮放。
為避免長時間切換大型 Scene／GLB 時保留整棵隱藏資源，展示頁預設在離開 Scene 或 3D 模型
時釋放該模式的 handle；再次選取會透過同一份 provider／Prefab 定義重新建立。需要快速反覆
比較而保留快取時可加上 `?resources=retain`。目前 2D symbol 保持常駐，讓狀態按鈕與換圖流程
隨時可用；`window.slotSymbolDemo.report()` 會回報目前的 `resourcePolicy`。
範例內的 `assets/models/zhuda-showcase-character.glb` 是用 Blender 腳本與 `npm run character`
產生的中性引擎角色 fixture，包含可檢查的身體、頭部、豬鼻、耳朵、吊帶褲、四肢、尾巴、背包與
`IdleBounce` 動畫；
消費端只要把自己的自包含 GLB／glTF 放入 `assets/` 並重新執行 `npm run manifest`，同一個面板就會列出它。
這個面板是可重跑的 Project/Assets 檢視，不是 HTML 假畫面，也不會繞過 `AssetProvider` 或把
遊戲規則帶進引擎。
展示頁右下角的 `LAYOUT INSPECTOR` 會即時列出來源圖片像素、Prefab 根設計尺寸、
Art slot 尺寸、目前 CSS 顯示尺寸、來源到畫面的縮放比與 DPR。畫面上的 `ART · IMAGE`
和 `UI · BADGE` 標籤也明確區分圖片內容與 Laya UI Label；`ROCKET` 文字不是原圖的一部分。
`ROCKET` 的虛線框是該 Label 的設計 bounds guide；實際文字由 Laya vendor 的 `Label`
節點繪製，並使用 Laya `valign` 與小幅上 padding 做字型 ink 的 optical centering。右上狀態列與右下 inspector 是預覽工具操作層，不是遊戲 Scene 的 UI。

Inspector 的 `Prefab root` 是固定的 480 × 480 設計畫布；`Art rect` 是圖片節點的位置與尺寸，
`Art scale` 會隨狀態時間軸即時更新。Jackpot 只縮放 `Art`，不縮放 Prefab root 或設計網格。
`Art anchor` 以百分比顯示 Laya anchor，後面是實際 local pivot 像素；範例使用 50% / 50%，
所以放大會繞圖片中心，不會從左上角向右下角漂移。黃色虛線框是 Image 節點的實際 bounds，
透明像素也算在這個設計框內；畫面上的十字是這個真正的 Laya anchor guide。

## 驗收流程

第一次建立基準圖：

```sh
npm run capture:prefab
```

檢查 `reference/slot-symbol-idle.png`，確認畫面後再執行真正的 30 次建立／釋放與
瀏覽器比對：

```sh
npm run check:prefab
```

驗收產物在 `reference/` 和 `evidence/`。缺圖、錯誤 hash、瀏覽器環境不符、畫面差異
或生命週期未完成都會阻擋通過。`npm run build` 會在引擎 repo 外的暫存 consumer 中
完成 release build，避免把引擎原始碼當成遊戲依賴，也避免污染引擎輸出。

## 穩定節點與狀態

| 節點 | 用途 |
| --- | --- |
| `Art` | 唯一需要替換的 symbol 圖片 |
| SVG design grid | 固定 `viewBox="0 0 960 540"` 的座標與自適應外框；不屬於火箭 Prefab |
| SVG particle layer | Selected/Win/Jackpot 的引擎粒子呈現，受 symbol clip 限制，不會越界 |
| `Badge` | 可換文字標籤 |

Scene 定義在 `assets/scenes/slot-machine.ls`，Prefab 定義在
`assets/prefabs/slot-symbol.lh`，狀態與 asset provider 在 `src/prefabs.ts`，效果時間軸在
`src/slot-symbol-effect.ts`。`src/asset-manifest.ts`
由 `scripts/update-manifest.mjs` 產生，禁止手改 hash。

## 邊界

這是引擎 repo 裡的可重跑示範，不是任何一款老虎機的生產素材或派彩規則。腳本會把
範例複製到系統暫存的獨立 consumer，再呼叫公開 `zhuda-laya-engine` SDK 建置；因此
範例能展示正確的 consumer 路線，也不會把遊戲資產或私有引擎 import 混進正式套件。
