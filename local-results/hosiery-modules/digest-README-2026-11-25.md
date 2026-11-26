# 撕襪技術精華（2026-11-25 整理）

這個資料夾收的是兩個撕襪專案裡，**豬大引擎沒有、別處也沒有的東西**。
兩個專案原本在 `ZhudaGameCenter/games/` 底下，2026-11-25 移到垃圾桶
（`~/.Trash/ZhudaGameCenter-games-removed-2026-11-25/`）。它們都不是 git repo，
所以清空垃圾桶之後，這裡就是唯一的一份。

| 資料夾 | 原本的專案 | 是什麼 |
| --- | --- | --- |
| `3D-分層絲襪/` | `games/stocking-tear` | Blender 做的寫實雙腿，穿 15 種絲襪和 13 種下身，可以拉、撕，裙子能掀起來。桌機 WebGL／WebGPU、vivo V40 實機都測過 |
| `2D-Spine褲襪/` | `games/stocking-tear-2d` | 2D 版：生成的腿部圖片＋Spine 4.2 綁定，褲襪可以拉、撕，百褶裙用 IK 掀起、靠物理擺回 |
| `引擎路線文件/` | 引擎 `docs/routes/`（`def94aa` 的版本） | 引擎把上面兩個專案的做法寫成的兩份路線文件，放一份在這裡對照 |

---

## 一、引擎已經有的（不用從這裡拿）

- **做法的文件**：[`引擎路線文件/layered-cloth-on-body.md`](引擎路線文件/layered-cloth-on-body.md)（3D）和
  [`spine-character.md`](引擎路線文件/spine-character.md)（2D）。內容有 Blender 的步驟與參數、絲襪的透光公式、
  拉扯撕破的規則、裙子的布料參數、手機設定、踩過的坑。
- **引擎 API**：`ZhudaLitSurfaceMaterial` 的 `sheen`（布料光澤）與 hook、`ZhudaDynamicMesh`、`ZhudaCloth`、
  `ZhudaTriangleBvh`（點選）、`ZhudaSceneLook`、`ZhudaSpineCharacter`（2D 的 Spine 角色）。
- 從這兩個專案發現、已經在引擎修好的：同一個 shader 的兩個材質不能有不同初始值（11-17 修）、
  加了燈之後太陽的影子會被搶走（WP22）、WebGPU 上 hook 編譯失敗就整個停畫（WP23）。

文件只寫了公式和步驟，**沒有程式碼**。路線文件的最後一節寫明：身體、匯出腳本、絲襪目錄、拉扯撕破的規則
都屬於遊戲專案，「一份都沒有複製進引擎」。

## 二、只有這裡才有的（這個資料夾的價值）

### 3D（`3D-分層絲襪/`）

| 檔案 | 行數 | 內容 | 沒有它要怎樣 |
| --- | --- | --- | --- |
| `blender/export_legs.py` | 203 | 用 Blender＋MPFB 產生瘦長成年女性的下半身，烘體型、切腰、併腿、平滑胯部、細分一次、做絲襪層的 shape key、左右切開、匯出 JSON。檔頭有執行指令 | 照文件重寫，參數文件裡有 |
| `public/assets/legs.json` | 1.5 MB | 上面腳本的輸出：兩條腿，每條約 8,100 頂點、16,000 三角形，含絲襪層的位置 | 要裝 Blender 5.2.2＋MPFB 2.0.18 重跑 |
| `src/meshleg.ts` | 622 | **核心**：每個頂點的拉扯、拉伸量測、撕破起點、褲子層、裙子用的腿部碰撞表、繞腿的貼圖縫線處理 | 只能照文件從零寫。引擎文件說它的通用部分是「候選的引擎功能，還沒做」 |
| `src/Main.ts` | 1,044 | 絲襪著色器 `HOSIERY`（針織、透光、破洞、抽絲、襪頭補強、褲頭加厚）、裙子（百褶、掀起）、燈光與手機畫質設定、操作 | 著色器只有公式在文件裡，實際 GLSL／WGSL 相容的寫法只有這裡 |
| `src/patterns.ts` | 181 | **15 種絲襪的目錄**：8D 超薄到 120D 厚實、亮面、後縫線、蕾絲大腿襪、十字吊帶襪、蕾絲褲襪、細網／經典網／大網、羅紋、點點。每種的針織貼圖、密度、光澤、多用力才會破、會不會抽絲、顏色 | 要重新研究和調整 |
| `src/bottoms.ts` | 70 | 13 種下身：A 字迷你、百褶、窄裙、長裙、網球裙、千鳥格、灰色中長百褶；牛仔短褲（含破洞款）、西裝短褲、牛仔長褲、西裝長褲；不穿 | 要重新調整 |
| `src/hud.ts` | 135 | 右側選單（手機上是抽屜） | 普通 DOM，容易重做 |
| `attic/body-handbuilt.ts` | — | 改用 Blender 之前的手刻腿部網格（不需要 Blender） | — |
| `tools/*.mjs` | — | 建置、本機伺服器、無頭截圖、連拍、手機 DevTools 讀數、裙子放開後的晃動量測 | — |
| `HANDOFF.md` | — | 完整紀錄：V40 實測幀率、手機清晰度的取捨表、裙子抖動的原因與修法、腳的修正過程、引擎發現 | — |

### 2D（`2D-Spine褲襪/`）

| 檔案 | 內容 |
| --- | --- |
| `blender/` | **生成的原圖與提示詞**（資料夾名稱沿用原專案，裡面不是 Blender 檔）：裸腿圖 `legs-bare.png`、千鳥格百褶裙 `skirt.png`、黑色絲襪布樣與兩種破洞 `nylon-*.png`（gpt-image-2.6），`prompt-*.txt`／`p-*.txt` 是提示詞，`.png.json` 是生成紀錄 |
| `spine/outfit/make_parts.py`、`make_tights.py`、`rig.py` | 把圖切成零件、從布樣算出褲襪的透光（亮度＝透光率）、10 個破洞位置的貼片、Spine 綁定（9 條百褶鏈＋IK、每個拉扯點一根骨頭） |
| `spine/outfit/parts/` | 切好的零件圖：身體、裙子正反面、褲襪、每個破洞的大小兩種貼片與捲邊 |
| `spine/outfit/build/008/` | 最終的 Spine 匯出（`outfit.json`、`outfit.atlas`、`outfit.png`）和檢查報告 |
| `spine/outfit/evidence/004/` | 最終版的壓力測試圖（擺動、掀起、拉膝蓋、大小破洞） |
| `public/assets/` | 遊戲直接用的 Spine 檔和圖 |
| `src/Main.ts`（207 行） | 用 `ZhudaSpineCharacter` 的遊戲本體：拉、撕、掀裙 |
| `attic/Main-shader.ts`（425 行） | 更早的著色器版：照片上用 shader 畫褲襪、裙子是引擎布料。**這一版在 V40 實機測過（60 fps）**，Spine 版沒有 |
| `HANDOFF.md` | LayaAir 的 Spine 節點的幾個坑（`useFastRender=false`、`physicsUpdate = 2` 等） |

### 精選截圖

兩邊各有一個 `精選截圖/`：3D 有全部 15 種絲襪、全部下身、參考圖造型的總表，以及 V40 實機圖；
2D 有 Spine 版總表、桌機 WebGL／WebGPU 的破洞圖，和著色器版在 V40 上的圖。

## 三、沒有放進來的

| 東西 | 大小 | 為什麼 |
| --- | --- | --- |
| `dist/`、`node_modules/` | — | 建置產物，重建就有 |
| 3D 的全部截圖 `evidence/` | 196 MB | 只留了精選，其他是過程截圖 |
| 2D 的全部截圖 `evidence/` | 25 MB | 同上 |
| MPFB 外掛 `add-on-mpfb-v2.0.18.zip` | 44 MB | 可以從 extensions.blender.org 重新下載（sha256 開頭 `c075b3e9`，見路線文件）。它是 GPL-3，本來就不能放進引擎或遊戲包 |
| 2D 的 Spine 舊建置 001–007、舊壓力測試 001–003 | 約 20 MB | 只留最終的 008 和 004 |

這些在清空垃圾桶之前，都還在 `~/.Trash/ZhudaGameCenter-games-removed-2026-11-25/` 裡。

## 四、要重新用的話

1. 把 `3D-分層絲襪/` 或 `2D-Spine褲襪/` 複製回 `ZhudaGameCenter/games/<新名字>/`。
2. `npm install`。引擎釘的是舊版：3D 是 `ed1ddbc`，2D 是 `552736a`。先在舊版上 `npm run verify` 跑通，
   再改釘新版（現在是 `def94aa`），然後重新檢查。
3. 3D：`node tools/build.mjs`，再 `node tools/serve.mjs`，打開 `http://127.0.0.1:8897/index.html`。
4. 2D 要重做 Spine 綁定的話，需要 `engines/zhuda-spine2D` 工具組，指令在 `2D-Spine褲襪/HANDOFF.md` 開頭。
5. 要改 3D 的身體，就裝 Blender 5.2.2 和 MPFB 2.0.18，照 `blender/export_legs.py` 檔頭的指令重跑。

## 五、授權與內容

- MakeHuman 的基礎網格和 MPFB 產生的身體是 CC0；MPFB 外掛本身是 GPL-3，只能當外部工具，不能放進專案。
- 2D 的圖都是 gpt-image-2.6 生成的。腿部圖是拿《豬大時空3D》裡沈知微的全身正面圖當參考生成的。
- 下身都是成年款式。HANDOFF 記錄了一個刻意的決定：不做學生制服款的百褶裙。
