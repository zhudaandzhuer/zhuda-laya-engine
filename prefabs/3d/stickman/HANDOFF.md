# 囂張小黑人（需求者 的需求）交接

最後更新：2026-11-26。prefabs 不是 git repo，沒有提交這回事；檔案就是現況。

## 現在的模型（`assets/stickman.glb`）

- 2994 面、20 根骨頭、兩段 idle（叉腰、抱胸）可 crossfade；三張 512 貼圖（底色含臉、法線、環境遮蔽）。
- 臉畫在底色貼圖上，圖案取自混元 3D 那顆 5 萬面的頭（`source/face/face-mask.png`，`source/face/extract-face.mjs` 產生）。
- 2026-11-26 照混元那顆改了手、腳、腋下（使用者：「差別在於手指粗度 腳粗度 以及腋下多了點東西」），全部在 `source/stickman-def.mjs`：
  - 手：寬、厚放大 20%，沿手指方向只放大 7%，指頭再加粗 12%。
  - 腋下：身體頂端半徑 0.08 → 0.071、肩關節 x 0.10 → 0.09、手臂和身體的圓角 0.006 → 0.003。現在和混元一樣在 0.72 m 就分開。
  - 手臂：上臂維持 0.034（再粗會和身體黏成一片），前臂加粗到 0.036。
  - 腿：維持原本的粗細，小腿幾乎不收細。
  - 腳：平底、寬一點，腳尖低。
- 貼圖烘焙（`source/bake.mjs`）修了上臂前面一道細暗痕，有兩個原因：
  1. 同一塊展開裡，3D 隔很遠、UV 卻相鄰的三角形，現在會拆到別塊。
  2. 像素改成兩輪填：先填三角形裡面的，再填邊外容許帶。
- 驗證：
  - `node --test tests/stickman.test.mjs` 10/10 通過。
  - Khronos 驗證器 0 錯誤 0 警告。
  - 腳不滑（drift 0 mm）。
  - 和三視圖的剪影重疊率：正面 .892（原本 .933）、側面 .936（原本 .943）。下降是因為改成照混元的比例（肩窄、手大），是預期的。

## 對照圖（給使用者看，不在專案裡）

`~/Downloads/需求者需求/照混元改手腳腋下/`：

- stickman.glb
- 改前改後-三個姿勢.jpg
- 近看-腋下和手.jpg
- 輪廓疊圖-對混元.png
- 車庫-對混元.png／.mp4
- 車庫-近看.png

舊版在 `臉改貼圖/`。

## 交付（2026-11-26 已更新成這一版，使用者說「Update 交付」）

- `~/Downloads/需求者需求/交付/` 放的是這一版：
  - stickman.glb：和 `assets/` 的同一個檔，SHA-256 開頭 `d0482c06`。
  - 重拍的預覽、戶外光、三視圖對模型、手對三視圖、三視圖比對、crossfade.mp4。
  - 新加的 對混元.jpg、對混元-車庫.mp4。
  - 使用說明.md 改了：檔案表、「這一版改了什麼」、規格；上一版的改法留成紀錄。
- 上一次交付的原檔整份留在 `~/Downloads/需求者需求/交付-舊版-1125/`。
- 還沒傳給 需求者。傳不傳、怎麼傳，由使用者決定。
- `preview/` 的圖和影片也換成這一版了，和交付的同一批。

## 還沒做（等使用者決定）

- `README.md` 的文字（重疊率 0.934／0.944、手 600 面、色票材質、測試 9 項等）、路線、changelog 還是舊的。使用者之前說文件「先不用」。
- `build.mjs` 裡實驗用的 `STICKMAN_SOURCE`／`STICKMAN_SOURCE_KEEP`（直接拿混元高模當來源）要不要留。
- 觀看台每次 `npm run build` 會清掉 `viewer3d/dist/web/trial/`，要重放混元的 `stickman-50k.glb` 才能並排比。

## 怎麼比

在 `prefabs/` 底下跑：

- `node 3d/stickman/source/build.mjs`
- `node 3d/stickman/source/measure-pair.mjs 3d/stickman/assets/stickman.glb <混元.glb>`：逐高度比粗細。
- 錄 crossfade 影片：用 `prefabs/tools/detplay.mjs`，設 `STEP_MS=33.33`、`VIEWPORT=720x720`，query 是 `scene=stickman&auto=0`。
  - 換段只用 `S.set({ clip })`。
  - 不要帶 `fade`：觀看台會先切一次、再 crossFade 一次，同一格兩次 crossFade，手會先跳回綁定姿勢。這是觀看台腳本的問題，不是模型的問題。
- 觀看台並排比：`scene=stickman-garage&face=front&fov=6&carScale=0.01&models=common/3d/stickman/assets/stickman.glb,trial/stickman-50k.glb`，加 `&bind=1` 或 `&hold=Idle_HandsOnHips`。
