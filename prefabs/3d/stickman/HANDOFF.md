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

## 布偶版（2026-11-26，另一個版本，沒動交付）

使用者問「全身要有玩偶感怎麼做」，選了毛絨布偶、不動身材的做法，說「幫我做另一個版本，不要動到交付內容」。

- **做法**：還是同一個 2994 面的網格、同一副骨架、同樣的動作，只換貼圖和材質。全部在 `source/plush.mjs`：
  - 兩片布縫起來：身體、手臂、腿的側邊，頭的耳朵那一圈，加上腳底一圈、手腕一圈。
  - 縫線是一道細溝，兩邊的布被拉進去一點，烘進法線和陰影貼圖。
  - 針腳是淺灰色、橫過縫線的一段段線，畫在底色上。
  - 不織布眼睛：眼白凸出 1.2 mm，邊上一圈深色針腳。
  - 粗糙度 0.9，貼圖 1024。
- **怎麼建**：
  - `STICKMAN_STYLE=plush STICKMAN_OUT=<別的檔> node 3d/stickman/source/build.mjs`（在 `prefabs/` 底下跑，約 22 秒）。
  - 沒給 `STICKMAN_OUT` 會直接報錯，`assets/stickman.glb` 不會被蓋掉。
  - 預設樣式重建出來和 `assets/stickman.glb` 逐位元組相同（改 build.mjs 之後驗過）。
- **觀看台**：`?scene=stickman&model=trial/stickman-plush.glb`。`?model=` 是這次加的，可以換成任何 glb。檔案要先放進 `viewer3d/dist/web/trial/`，每次 `npm run build` 會被清掉，要重放。
- **成品**：在 `~/Downloads/` 裡需求者那個資料夾的 `布偶版/`：
  - stickman-plush.glb：833 KB，Khronos 驗證器 0 錯誤。
  - 布偶版-預覽.jpg：六個角度。
  - 原版對布偶版.jpg：肩膀、腿腳、抱胸、側面、臉。
  - 布偶版-crossfade.mp4：逐格錄，每格輪廓最多變 2 px。
- **交付沒動**：`交付/` 的 11 個檔，SHA-256 和做之前一樣；`assets/stickman.glb` 也一樣。
- **沒提交**：引擎倉庫裡這次動到的是 `source/plush.mjs`（新）、`source/build.mjs`、`viewer3d/src/presets/stickman.ts`，都還沒 commit。同一個工作目錄裡另外有別的工作階段改的檔，不是這次的。
- **限制和下一步**：
  - 全身遠看時針腳太細，幾乎看不到；中、近距離才明顯。
  - 「絨毛邊緣發亮」要另寫 shader，LayaAir 內建的 PBR 材質沒有。
  - 身材（2～2.5 頭身、四肢短胖）和布偶動作（呼吸時壓扁彈起、手臂延遲）都沒做，使用者還沒要。

## 絨毛版（2026-11-26，又一個版本，也沒動交付）

使用者看了布偶版說：「身上一堆針線就是玩偶感？不是絨毛感嗎？」所以改做絨毛版，針腳全拿掉。

- **做法**：`STICKMAN_STYLE=fuzzy`，設定在 `source/plush.mjs` 的 `FUZZY`。
  - 網格、骨架、動作照舊。
  - 全身一層往下梳的細毛流：上下拉長 3 倍的雜訊，4 mm 和 2.2 mm 兩層，做進法線貼圖。全身都用法線貼圖。
  - 毛色深淺 ±5%。
  - 縫線只剩 1.2 mm 的淺凹；不織布眼睛照舊凸起、不縫邊。
  - 粗糙度 1。
  - 材質寫上 `KHR_materials_sheen`（顏色 0.42、粗糙度 0.4）：絨布在輪廓附近泛起的柔光。
  - 另外烘一張柔光強度圖（第 4 張貼圖，`sheenColorTexture`）：手上只留 20%，凹處降到 35%。
  - 再寫 `KHR_materials_specular`（specularFactor 0.2），布料幾乎不反光。
  - 這兩項是使用者問「遠遠看手部亮亮的邊緣是正常的嗎」之後加的。原因有兩層：
    - 低模的指縫是斜斜朝外的面，柔光專照斜看的面，所以每條指縫一道亮線。
    - 表面反光在同樣位置也有亮線，原版也有，只是淡。
  - 拿掉柔光、拿掉法線貼圖、只壓柔光、再加低反光，逐一比過：現在的亮線比原版還淡。對照圖是 `手部亮邊-改前改後.png`。
- **柔光是 LayaAir 自己畫的**：LayaAir 3.4.2 的 glTF 讀取器（`vendor/laya-3.4.2/libs/laya.gltf.js`）讀這個擴充。在觀看台試過 0、0.35、0.6、1.0 四種強度：1.0 整隻變灰，0.35～0.6 像絨布，所以選 0.42。
- **怎麼建**：`STICKMAN_STYLE=fuzzy STICKMAN_OUT=<別的檔> node 3d/stickman/source/build.mjs`，約 10 秒。
  - 柔光是建好 glb 之後只改 JSON 那一段加上去的（`withSheen`），`games/tools/characters/rig-glb.mjs` 沒動。
  - 預設樣式重建出來仍和 `assets/stickman.glb` 逐位元組相同。
- **成品**：在 `~/Downloads/` 裡需求者那個資料夾的 `絨毛版/`：
  - stickman-fuzzy.glb：1.53 MB，驗證器 0 錯誤。
  - 絨毛版-預覽.jpg、絨毛版-戶外光.jpg、原版對絨毛版.jpg、原版對絨毛版-戶外光.jpg、手部亮邊-改前改後.png。
  - 絨毛版-crossfade.mp4：每格輪廓最多變 1 px。
- **檔案變大**：從 0.42 MB 變成 1.53 MB，其中法線貼圖 0.73 MB（毛流雜訊用 PNG 壓不下來），柔光強度圖 0.11 MB。要小的話可以把貼圖改成 JPEG（glTF 允許），或貼圖降回 512；都還沒做。
- **還沒做**：毛毛的輪廓（殼層毛，執行時多畫幾層，要另寫 shader、量手機效能）。
- **拍照要注意**：同一個引擎工作目錄裡有別的工作階段會重建觀看台，`dist/web/trial/` 會被清掉。這次是把 `dist/web` 複製到暫存資料夾，再用 `prefabs/tools/detplay.mjs <那個資料夾>` 拍。
- **沒提交**：這次改的是 `source/plush.mjs`（新）、`source/build.mjs`、`viewer3d/src/presets/stickman.ts`。

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
