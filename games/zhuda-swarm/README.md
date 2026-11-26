# 豬大割草

原創的割草生存遊戲（橫式）。豬大在荒野上走，武器自己攻擊；荒獸從四面八方圍上來，撿寶石升級，每級三選一；武器滿級再配上對應的能力會進化。五分鐘一局，四分鐘時刑天出場。局外用金幣買三種永久強化。

- 引擎：同一個倉庫裡的 zhuda-laya-engine（`file:../..`），**全部用引擎 2D**（features `core`、`2d`、`ui`）。
- 五種武器（柴刀、符彈、環火、雷鼓、藤域）各有進化；六種能力；八種敵人。
- 操作：拖曳螢幕任何地方當搖桿，或 WASD。

## 怎麼跑

```sh
npm install && npm run verify      # 建置、型別、Doctor、7 項規則測試（約 1 分鐘：測試會跑幾十局）
node ../tools/shot.mjs . --query "auto=1&speed=5&seed=5&fresh=1" --script tools/play.mjs --out play-out/bot --name bot     # 機器人整局
node ../tools/shot.mjs . --query "seed=5&fresh=1&speed=4" --script tools/play.mjs --out play-out/hands --name hands       # 真實按鍵與點擊
python3 -I tools/make-atlas.py     # 重做圖集
```

## 用到引擎的哪些東西

整個戰場是一個 Laya sprite，每幀 `graphics.clear()` 後從**一張圖集**用 `drawTexture` 重畫地面、掉落物、敵人、子彈、範圍圈：四百多個敵人是 **3 次繪製**（`docs/evidence/draws-default.log.json`）。另外用到 `ZhudaPointerInput`（搖桿）、runtime session 的 `world` 時間層（升級選擇時暫停）、`ZhudaEffect2D`、`ZhudaUI`、`ZhudaRuntimeProfiler`（量繪製次數）、合成音效。

## 驗證到哪裡

- `npm run verify` exit 0（Doctor HEALTHY；7／7）：同種子同結果；站著不動撐 45～150 秒；會走位的機器人 24 局贏 8～21 局（同一個種子換一台機器會是不同的一局：Linux x64／Node 24 上種子 1～8 贏 4～7 局，macOS arm64／Node 26 上贏 3 局、40 個種子贏 23 局）、其中四分之三以上場上到過 250 隻；滿場時規則一步平均小於 4 ms。
- 機器人整局（撐過五分鐘、等級 17、擊倒 1483）與真實按鍵整局（101 秒力盡）都在無頭 Chromium 上跑到結算再回標題，無主控台錯誤：`docs/evidence/`。

## 已知的限制

- 沒有實機、沒有 GPU：3 次繪製是次數，不是幀時間；四百個敵人每幀重畫在手機上要多久沒有量。
- **沒解開的繪製次數問題**：在這個遊戲裡，只要畫過引擎的 `level-up`、`confetti` 或 `explosion` 這三個 2D 特效，之後整個畫面就停在 60～90 次繪製，即使當下沒有任何特效活著（不畫是 3 次；改用 `sparkle`、`hit-spark` 是 3～6 次）。單獨的重現專案量不到這個現象（一個特效 1～3 次，釋放後回到原值），所以原因可能在這個遊戲每幀重畫戰場的方式和特效之間，沒有找到。現在預設用 `sparkle`、`hit-spark` 頂替；`?fxfull=1` 可以重現。數字在 `docs/evidence/draws-*.log.json`，列在倉庫根目錄 `HANDOFF.md` 的待辦裡。
- 敵人是圓形頭像，不是有動作的角色；沒有受擊數字。
- 只有一張地圖、一個角色。
