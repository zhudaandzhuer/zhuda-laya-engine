# F2：主角的設定圖

**狀態：只有從模型檔出的圖，沒有設定圖。真正的設定圖要擁有者提供。**

- 本地機上的 Claude（Fable 5.2），2026-11-26。Blender 5.2.2 LTS 無頭執行。
- `blender -b -P games/tools/blender/model-sheet.py -- games/shared-assets/models/zhuda.glb local-results/F2`

倉庫裡唯一的豬大是 `games/shared-assets/models/zhuda.glb`。我用 Blender 把它的靜止姿勢從正面、側面、背面各出一張（`front.jpg`、`side.jpg`、`back.jpg`，正交投影、貼圖顏色），尺寸和材質在 `sheet.json`：

| | |
| --- | --- |
| 高 | 1.16 m |
| 寬（左右） | 0.76 m |
| 前後 | 1.31 m（含身上掛的道具） |
| 三角形 | 60,556 |
| 骨頭 | 19 |
| 動作 | 21 段（Idle、Walk、Run、Sit、Kick、Punch1 到 4、Slash1 到 2、Roll、Swim、Yawn 等） |
| 網格 | 一個（`zhuda`），9 種材質 |

我看正面那張看到的：粉紅色布偶豬、白色肚子、深棕色蹄、大頭（頭大約佔身高一半）、垂耳、腮紅；右手邊掛著一個橘紅色的燈籠形道具。

**和清單寫的不一樣的地方**：清單說配色是「粉紅布偶、棕色蹄、黃色肩包」。這個模型上沒有黃色肩包，有的是燈籠形道具和刀的零件（材質名 `blade-grip`、`blade-guard`）。所以這個檔可能不是要當設定依據的那一版，要擁有者確認。

**能用來做什麼**：體型的比例和尺寸可以直接從這三張圖和 `sheet.json` 量（做豬大的衣服需要的是這個）。**不能當成**正式的角色設定：沒有配色表、沒有表情、沒有「哪些是固定特徵」的說明。

另外，Khronos 驗證器對這個檔報 3 個錯誤（切線有 3 個是零長度），見 `local-results/A2/notes.md`。
