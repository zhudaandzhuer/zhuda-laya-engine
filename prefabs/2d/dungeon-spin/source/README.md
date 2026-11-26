# 2d/dungeon-spin/source：不會進遊戲的資料與工具

`scripts/sync.mjs` 不複製這個資料夾，函式庫的型別檢查也不看它。全部拆自 `games/dungeon-spin`。

## `math/`：數學表（原遊戲 `client/data/`）

| 檔案 | 內容 |
|---|---|
| `runtime-lines.tsv` | 本遊戲的 18 條連線（UID 1–18，`0,3,6,9,12`…），**和 `math.ts` 的 `PAYLINES` 相同**（`tests/dungeon-spin.test.mjs` 檢查） |
| `runtime-rates.tsv` | 本遊戲的 54 筆倍率：符號 0–8 的 3／4／5 連與全盤、新年全盤、字母全盤（`Slot`），巨袋封印 1–8 的單枚與四枚全同（`SlotBonus`），含追擊次數（3 個 0 給 1 次、全盤 0 給 27 次） |
| `fixtures.json` | 桌面原型時的十組情境「真值」：盤面、Bonus 盤、每一條中獎線的金額（例：`multi` 是線 15＝2000、線 2＝30、線 0＝10000）。`math.ts` 的情境是它的簡化版：總額相同，但每筆金額是平均分、線也不同 |
| `SlotLine.txt`、`SlotRate.txt` | 公司全部拉霸的線表與倍率表（UTF-16、Tab 分隔，727 種 SlotID）。本遊戲只用 `Slot`／`SlotBonus` 那幾列，抽出來就是上面兩個 `.tsv`（2026-11-25 逐字比對相同）。其他列是別的遊戲的，原樣保留 |

要做真的數學（照倍率表算、隨機盤面）就從這裡開始；現在的 `math.ts` 和 Go 版都只是十組固定情境。

## `hall3d/Dungeon3DHall.ts`：看不見的 3D 石廊（原碼，不建置）

原遊戲在背景 Prefab 之上加了一個 `Scene3D`：12×28 的石磚地、左右各 5 根柱、前 3 對柱上的火把點光源（橘色、範圍 8）、青色霧（#102c31，6–38 m）、
攝影機 FOV 43、正規化視口剛好是石廊視窗（7/572, 128/1024, 558/572, 448/1024），主角走路時鏡頭前推 0.6 m。
實測它一個像素都沒畫出來（被整張不透明的背景蓋住），所以本模組不建它、觀看台不開 `3d`。想讓 3D 真的出現，
要讓背景在石廊處透明，或讓 3D 畫在 2D 之上（相機的 `renderTarget` 再貼成 2D 圖）——這兩條都沒試過。

## `prefab-check/`：只由本模組組成的最小遊戲＋原遊戲的三個 Prefab 檢查

```bash
W=<暫存資料夾>
rsync -a prefabs/2d/dungeon-spin/source/prefab-check/ $W/ && cd $W
ln -s prefabs/viewer3d/node_modules node_modules   # 已安裝 def94aa 的引擎
node prefabs/scripts/sync.mjs . 2d/dungeon-spin
npm run build:candidate && npm run accept:prefabs && npm run build && npm run typecheck && npm run doctor
```

- `zhuda.config.json`：`prefabPreview` 指向 sync 進來的 `src/common/2d/dungeon-spin/prefabs.ts`；三個 `prefabChecks` 和原遊戲一樣（572×1024／572×453／572×324、DPR 1、30 次）。
- `references/`：原遊戲的三張基準圖（原封不動）。
- `evidence/`：2026-11-25 的報告（schema 2，三個都過、0 像素、30 次，定義雜湊與來源 SHA-256 和原遊戲證據相同）。重跑會覆寫它們。
- `src/Main.ts`：README「放進遊戲」那段程式的出處。
