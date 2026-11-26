# 給在這個專案工作的 agent

這個專案用 zhuda-laya-engine 做（同一個倉庫裡的引擎，`file:../..`）。身體是一個模型、切成十個區；每件衣服、頭髮、鞋、配件各是一個模型（一個網格），關節名稱和身體一樣。穿上＝用引擎的 `bindZhudaSkinToSkeleton` 綁到身體的骨架上；被蓋住的皮膚和內層布料用 `setZhudaTriangleMask` 不畫。規則（`src/core/wardrobe.ts`）是純 TypeScript，在 Node 裡測。

- 只從 `zhuda-laya-engine` 的公開入口 import；`npm run doctor` 會查。
- **加一件衣服＝在 `tools/catalogue.mjs` 加一行**，然後 `npm run parts`（約兩分鐘：產生、量測、寫 `assets/wardrobe.json`、`assets/masks.json`、`docs/evidence/clip-report.json`），再 `npm run look`（約七分鐘：寫 `docs/evidence/look-report.json` 和 `outfits.png`），最後 `npm test`。測試會讀兩份報告；重做了零件卻沒重量，測試會失敗。只改幾件時用 `node tools/build-parts.mjs --only a,b`，只看幾套用 `node tools/look-report.mjs a+b`。
- **量測沒過就是沒過。** 身體穿出工具包做的零件，`npm run parts` 會失敗；不要放寬容許值（1 mm、1 cm²），去改那件衣服。兩件搭起來穿模的會被寫進彼此的 `avoid`，規則不讓它們同穿，這是允許的結果，不要手動刪。
- **先看圖再信數字。** 範圍寫錯的衣服可以每項量測都過而實際上是圍兜。`npm run look` 會寫一張總表；新做的衣服要看過。
- 布的權重來自它正下方的皮膚，不要另外替衣服寫權重，也不要給衣服自己的骨頭。鬆的布（裙子、腰包）用 `volume`，並用 `follow` 指定它可以跟的關節。
- 硬的東西（`rigid`）只能放在身體不會彎的地方、整個掛在一根關節上（帽子在頭、背包在胸）；其他都做成鬆的體積。
- 遮罩的位元順序是檔案裡三角形的順序；引擎載入後的順序是反的，`setZhudaTriangleMask` 會換算。不要自己照載入後的順序做遮罩。一件零件只能有一個網格。
- 只有貼在身上的布、或封閉的體積，可以藏它底下的東西；垂著會擺動的布底下不能藏（一擺開就是洞）。
- 身體區的節點叫 `region-<名稱>`：好幾個區和它底下的關節同名（`head`、`hips`），不要改回去。
- 外來的零件（不是工具包做的）列在 `tools/foreign-parts.json`，各有自己的產生腳本；它照樣被量，沒過就標 `passes: false` 留在清單裡，不要為了讓它過而改量法。
- 綁定回報成功不代表畫得出來，遮罩套上不代表藏對了：`tools/play.mjs` 會把藏掉的三角形讀回來和檔案比對，改了載入或遮罩相關的東西一定要重錄。
- 換色用 `model.setTint`（線性值）；直接設 `material.albedoColor` 對 glTF 材質沒有作用。
- 換完裝要有瀏覽器紀錄：`node ../tools/shot.mjs . --size 1280x720 --query "look=_._._._._" --script tools/play.mjs --out play-out/hands --name hands --timeout 300000`。
- `npm run verify` 過了才算完成。
- 改了身體或任何一件衣服之後，三個報告都要重跑：`npm run parts`、`npm run look`、`npm run measure`。新的版型先查真實的規格寫進 `tools/reference.mjs`，再用 `tools/measure.mjs` 量做出來的成品；對不上的項目要列出來，不能改範圍。
