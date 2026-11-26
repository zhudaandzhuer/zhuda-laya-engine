# A2：工具寫出的 .glb 給標準工具看

- 做的人：本地機上的 Claude（Fable 5.2），2026-11-25。人沒有看過這些圖；下面「看起來」的描述是我看 Blender 出的圖寫的。
- 機器：Apple M4，macOS 27.2.1。glTF Validator 2.0.0-dev.3.10（npm `gltf-validator`）。Blender 5.2.2 LTS（`/opt/homebrew/bin/blender`，無頭執行），匯入匯出器是 Khronos glTF Blender I/O v5.2.40。
- 對象：`unified` `9efe74e4` 的 `games/**/*.glb`（41 個檔，其中衣櫥 33 個）。

## 1. Khronos 驗證器

`node local-results/A2/validate.mjs <裝了 gltf-validator 的資料夾>`。摘要在 `validator-summary.log`，每個檔的完整報告在 `reports/`。

| | 錯誤 | 警告 | 資訊 |
| --- | --- | --- | --- |
| 衣櫥 33 個檔 | 0 | 1 | 0 |
| `games/shared-assets/models/` 的七隻怪獸 | 0 | 0 | 0 |
| `games/shared-assets/models/zhuda.glb`（擁有者的豬大模型，Blender 匯出） | 3 | 1 | 16 |

- 衣櫥唯一的警告在 `knit.glb`（刻意模仿別的工具寫法的那一件）：`NODE_SKINNED_MESH_NON_ROOT`，蒙皮網格不在最上層。Blender 匯出的檔都會有這個警告，不是錯。
- `zhuda.glb` 的 3 個錯誤：`ACCESSOR_VECTOR3_NON_UNIT`，切線有 3 個是零長度（`/meshes/0/primitives/0/attributes/TANGENT` 的 74996 到 74998）。16 個資訊是沒用到的切線和 UV。這個檔不是工具寫的，沒有動它。

結論：工具（`games/tools/characters/rig-glb.mjs`）寫的檔，標準驗證器 0 錯誤。

## 2. Blender 匯入

`blender -b -P games/tools/blender/inspect-parts.py -- games/zhuda-wardrobe/assets/parts local-results/A2/blender`。數字在 `blender/blender-report.json`，圖在 `blender/*.jpg`（Workbench 繪製、頂點顏色、開背面剔除；正面、側面、背面）。

**對的：**

- 六個檔（`body`、`tee`、`trousers`、`skirt`、`straw-hat`、`pack`）都匯入成功，沒有錯誤訊息。
- 骨架：每個檔一副 24 根骨頭、一個根（`root`）。每個網格 24 個頂點群組、有骨架修改器、沒有不帶權重的頂點、權重加總都是 1、每個頂點最多 4 根骨頭。
- 動作：`body.glb` 帶五段（`Idle`、`Walk`、`Run`、`Greet`、`_Stress`），Blender 讀成五個 action。播 `Walk`：骨頭離靜止姿勢最遠 0.35 m、皮膚頂點最遠 0.40 m。會動。
- 衣服跟著骨架：把身體的動作套到衣服自己的那副骨架（骨頭名字相同），五段動作裡每件衣服到身體表面的距離中位數幾乎不變（走路時 T 恤 19.1 到 19.2 mm、長褲 12.3 到 12.4 mm、裙子 20.0 到 20.5 mm、斗笠 38.1 mm、背包 5.2 到 5.3 mm），長褲走路時最多移動 0.63 m。有跟著。
- 頂點顏色有進來（`Color` 屬性）。位置範圍和原檔一致。

**不對的（三件，都是「能不能交給美術接手」的答案）：**

1. **雙面的布，Blender 匯入時會掉一面。** 工具做鬆的布時，內面和外面共用同一批頂點、三角形反著繞一次。Blender 的網格不允許兩個面用同一組頂點，匯入時直接丟掉重複的：

   | 檔 | 檔裡的三角形 | Blender 留下 | 掉了 |
   | --- | --- | --- | --- |
   | `tee` | 4326 | 2999 | 1327 |
   | `trousers` | 3970 | 3400 | 570 |
   | `skirt` | 4021 | 2399 | 1622 |
   | `pack` | 1700 | 1699 | 1 |
   | `straw-hat` | 589 | 589 | 0 |
   | `body` 十區 | 11598 | 11598 | 0 |

   美術在 Blender 裡打開、改完、再匯出，布就只剩一面；引擎裡從下襬或袖口往裡看會是透的（材質不是雙面的）。要讓它經得起來回，內面要有自己的頂點，或改成材質 `doubleSided`。

2. **留下的那一面，有些法線是反的。** 存在檔裡的頂點法線和面的方向相反的面：`tee` 95 個、`pack` 80 個、手 38 個、`trousers` 19 個、`skirt` 8 個、`straw-hat` 1 個。`tee` 的 95 個都在下襬（高度 0.79 到 0.80 m）和領口（1.33 到 1.43 m），也就是布翻進去的那一圈。這是共用頂點的結果：一個頂點只能存一條法線，內外兩面只有一面是對的。

   圖上（`blender/outfit-a-rest-front.jpg`）下襬、袖口、褲腳那一圈深色的鋸齒邊**不是**這個造成的：那是頂點顏色本身（`tee` 有 857 個面的亮度低於 0.25，工具把開口附近塗暗），法線反的面只佔其中 93 個。那圈邊在引擎裡好不好看，要看 B1 的截圖。

3. **`straw-hat` 和 `pack` 的面沒有朝同一邊。** 請 Blender 把面轉成一致，它會轉 `straw-hat` 的 71 個、`pack` 的 146 個（其他檔是 0 或 1）。`pack` 另有 11 條邊接了三個以上的面（背帶和包身接在一起的地方）。在引擎裡畫得出來，但在建模軟體裡做細分、厚度、展 UV 會出問題。

另外：Blender 會在每個檔多加一個 `Icosphere`（匯入器拿來畫骨頭的形狀），不是模型的一部分。

## 3. 從 Blender 原樣匯出再量

五件都用匯出器的預設值原樣匯出：`blender/<名字>.blender-export.glb`。和原檔的差別在 `blender/export-compare.log`，驗證器的報告在 `reports/blender-export__*.json`（都是 0 錯誤、1 個上面說的警告）。

`tee` 來回一趟之後：

| | 原檔 | Blender 匯出 |
| --- | --- | --- |
| 三角形 | 4326 | 2999 |
| 頂點 | 1769 | 1792 |
| 屬性 | 位置、法線、顏色、骨頭、權重 | 一樣 |
| 位置範圍 | | 一樣 |
| 骨頭 | 24 | 24，名字相同、順序不同 |
| 場景結構 | 網格和 `root` 都在最上層 | 都在 `tee-skeleton` 底下 |
| 材質 | `baseColorFactor` 1,1,1,1、粗糙度 0.8 | 粗糙度一樣，沒有寫 `baseColorFactor` |

**拿它重跑綁定和量測**（暫時登記成外來零件 `tee-blender`，跑 `node tools/build-parts.mjs --measure`，跑完已還原；輸出在 `rebind/measure.log` 和 `rebind/tee-vs-tee-blender.json`）：

- 綁得上：工具讀得了 Blender 的寫法（骨頭順序不同、多一層節點都沒問題）。
- 量測結果變了：

  | | `tee` | `tee-blender` |
  | --- | --- | --- |
  | 蓋住而不畫的皮膚三角形 | 3029 | 1858 |
  | 皮膚穿出來的頂點 | 0 | 2（4.2 mm，`_Stress` 第 52 格） |
  | 通過 | 是 | 否 |
  | 不能同穿 | 腰包 | 腰包、短褲、及膝褲、七分褲、長褲、及膝裙、長裙 |
  | 摺進去的三角形 | 15 | 72 |

  原因有兩個：掉了內面；「前幾個三角形是貼身的布」這個資訊（`tight`）只存在工具的清單裡，不在檔裡，來回一趟就沒了，所以它能遮的東西變少，底下的褲裙就穿出來（最深 19.3 mm）。

**結論：** 骨架、權重、顏色、位置來回一趟都在；但「不穿模」這個性質不在檔裡，在工具的清單和遮罩裡。美術改過的檔要重新量、重新產生遮罩，而且目前工具對外來零件不知道哪些面是貼身的。

## 沒做的

- 沒有人在 Blender 的介面裡打開看過；都是無頭執行出的圖和數字。
- 其他 27 件衣服沒有個別進 Blender（驗證器有全跑）。
- Blender 匯出只試了預設值，沒有試其他匯出選項。
- 沒有修上面三件事。它們是工具（`games/tools/characters/`）的做法，要不要改、怎麼改，牽涉到三角形數和量測，留給下一輪。
