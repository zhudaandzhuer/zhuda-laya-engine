# 豬大食堂

原創的合成遊戲（直式）。點菜籃、水龍頭、蒸籠拿食材（一次一點體力），把兩個一樣的拖在一起變成下一階的菜，湊齊客人訂單上的東西就上菜，拿金幣與經驗。三條食材鏈各六階，十個等級，第三級來蒸籠。**沒有儲值**：體力靠時間（30 秒一點）、升級、遊戲裡賺的金幣。

- 引擎：同一個倉庫裡的 zhuda-laya-engine（`file:../..`），**全部用引擎 2D**（features `core`、`2d`、`ui`）。
- 物品圖是 Noto Color Emoji（SIL OFL 1.1）畫進一張圖集（`tools/make-items.py`），每台裝置看到的都一樣；客人是九野的契師頭像。

## 怎麼跑

```sh
npm install && npm run verify      # 建置、型別、Doctor、6 項規則測試
node ../tools/shot.mjs . --size 540x960 --query "fresh=1" --script tools/play.mjs --out play-out/first --name first
```

網址參數：`?fresh=1` 新存檔、`?demo=1` 第 5 級、盤面上有東西的樣本。

## 用到引擎的哪些東西

盤面從一張圖集畫在一個 sprite 上；拖曳用 stage 的 `MOUSE_DOWN`／`MOVE`／`UP`，以 `globalToLocal` 換成 720×1280 的設計座標；`ZhudaUI` 的按鈕與面板；`ZhudaEffect2D`（`sparkle`、`level-up`、`coin-burst`、`confetti`）；runtime session 的時鐘；合成音效。

## 驗證到哪裡

- `npm run verify` exit 0（Doctor HEALTHY；6／6）：合成、移動、交換、來源、體力、上菜、升級；三個種子由機器人玩到滿級（約 4～5 小時的遊戲時間），途中每張訂單都做得出來、盤面不卡死。
- 從新存檔玩到第 3 級（蒸籠出現）在無頭 Chromium 上**用真實的點與拖**跑過：56 次點、23 次拖曳合成（每一次都核對遊戲回報的結果）、32 次上菜，無主控台錯誤：`docs/evidence/`。

## 已知的限制

- 沒有實機：拖曳只用滑鼠事件試過，手指拖曳（遮住物品、誤觸）沒有驗。
- 機器人把盤面用得很乾淨，所以證據圖裡的盤面是空的；人玩起來會堆東西，「盤面快滿」的體驗沒有人看過。
- 沒有劇情、裝修、活動；訂單只有一到兩樣東西。
- 時間用裝置時鐘。
