# 豬大守關

原創的 3D 塔防（橫式）。荒獸沿山路衝向村口；在路邊十二個石台上蓋箭樓（快、單體、射不穿厚皮）、火爐（炸一片、燒得穿）、冰塔（緩速），各三級。十二波，第九與第十二波有玄武。村口 20 點，漏一隻扣一點（夔兩點、玄武十點）。

- 引擎：同一個倉庫裡的 zhuda-laya-engine（`file:../..`）（features `core`、`3d`、`gltf`、`postProcess`）。
- 敵人是 `games/shared-assets/models/` 的四隻荒獸模型（四分之一面數），每種一個小池子重複使用；塔與子彈是引擎的基本幾何。

## 怎麼跑

```sh
npm install && npm run verify      # 建置、型別、Doctor、5 項規則測試
node tools/balance.ts              # 四種蓋法逐波的結果
node ../tools/shot.mjs . --size 960x540 --query "speed=4" --script tools/play.mjs --out play-out/hands --name hands           # 真實點擊：蓋三座、打三波
node ../tools/shot.mjs . --size 960x540 --query "auto=1&speed=6" --script tools/play.mjs --out play-out/bot --name bot --timeout 400000   # 機器人打完十二波（軟體算圖約 15 分鐘）
```

## 用到引擎的哪些東西

film scene（`terrain`、`extrude` 的路、`lathe` 的石台、`box` 的村口、圖片材質）、`ZhudaModelLibrary` 與 `ZhudaModelInspector`（Move 動作的速度配合走速）、`Zhuda3D.createPrimitiveMesh`／`createMaterial`（塔與子彈）、`ZhudaEffect3D`（`explosion`、`sparks`）、runtime session 的 `world` 時間層（×2 用 `setTimeScale`）、`ZhudaRuntimeProfiler`、合成音效。選單與石台標記是 DOM，位置用自己寫的投影（引擎其實有 `ZhudaCameraCoordinates.worldToScreen`，做的時候沒找到）。

## 驗證到哪裡

- `npm run verify` exit 0（Doctor HEALTHY；5／5）：不蓋塔在第 3 波前失守；照計畫蓋的機器人守住十二波、剩 10 點；只蓋一種塔的三種蓋法都守不住。
- 真實點擊蓋三座塔、升級、打三波：`docs/evidence/`。
- **路畫反過一次**（鏡像；`extrude` 的 outline 寫成了 `[x, -z]`），已改回 `[x, z]`。`docs/evidence/bot.jpg` 與 `bot.log.json` 是修正之後、在合併後的倉庫裡對同庫引擎重錄的機器人十二波（過關、兩星）；`hands.log.json`（真實點擊）是修正之前錄的，標記位置當時是自己投影的，現在改用 `stage.worldToScreen`。

## 已知的限制

- 沒有實機、沒有 GPU。
- **草是關的**（`?grass=1` 可開）：這塊 72×42 m 的場地開草是每幀 525 次繪製，關掉是 45 次，而且鏡頭在 55 m 高根本看不到草（引擎的 film lint 現在會用 `grass.draws` 提示）。
- 每種敵人的模型數有上限（猙 12、九尾狐 12、夔 8）：後面的波次同時在路上的比這多，多出來的走在最後面、暫時看不到（規則照算、血條不顯示）。要全部顯示得用引擎的 instanced 群眾，這一版沒試。
- 只有一張地圖；塔是幾何拼的，不是模型。
- 模型畫得比規則裡的公尺大 1.9 倍（鏡頭遠），所以看起來會稍微超出路面。
