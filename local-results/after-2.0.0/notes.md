# 2.0.0 之後雲端補的那一輪，在這台 Mac 上驗

雲端工作階段在 `7dcc183b` 之後推了三個提交（`aca6d5f4`、`378ff8cd`、`473ca3d9`）：衣櫥剩下的深色頂點、以及一批路線列出的引擎缺口（等待與補間、固定時鐘、開場畫面消失的訊號、陰影開關、不靠 `TextDecoder` 讀文字、走路格子與尋路、角色控制器、小遊戲工具的語法目標與螢幕方向）。它那邊的紀錄（`docs/plans/records/gaps-after-2-0/verification.md`）寫明：只在 Node 裡驗過，沒有瀏覽器、沒有顯卡、沒有釘住的工具鏈、沒有官方小遊戲工具。這裡補那幾樣。

- 2026-11-26，Apple M4，macOS 27.2.1，Node 26.13.1，Chrome 158，由本地機上的 Claude（Fable 5.2）做。**人沒有參與。**
- 驗的是 `473ca3d9`。

## 結果

| 項目 | 結果 |
| --- | --- |
| 釘住的工具鏈（`local-results/A1/at-473ca3d9/`） | `npm ci`、`npm run verify`（**1027／1027**，雲端過不了的那 2 個在這裡過）、lint、九款參考遊戲、元件庫（189 個測試、兩個觀看台、Go 十個套件）都過。**`npm run format:check` 不過：12 個檔沒照 Prettier 排版** |
| 衣櫥剩下的 30 個深色頂點 | 數零件檔：0 個。**真顯卡重拍確認**：裙子腰頭那排深色小點、短版 T 恤胸口那道深色都不見了（`wardrobe/waist-zoom.jpg`、`wardrobe/waist-and-chest.jpg`；18 張都沒有頁面錯誤） |
| `whenZhudaSplashGone`／`zhuda:splash-gone` | 在真的 Chrome 裡對 `prefabs/viewer2d` 建出來的頁面（有引擎開場畫面）跑三次，三次一樣：一開始節點在、`gone` 是 false；約 2.20 秒 `completed`；約 2.65 秒（晚 450 毫秒）送出事件，**只送一次**，送出時節點已經不在頁面上；頁面錯誤 0（`splash.json`、`splash-check.mjs`） |
| `minigame.orientation` | 用官方工具鏈實際匯出微信小遊戲：`game.json` 的 `deviceOrientation` 從 `portrait` 變成 `landscape`。寫 `sideways`、或對 `vivogame` 設方向，都照設計被拒絕（`minigame/`） |
| `minigame.syntaxTarget` | 雲端寫的那一版：**設成預設（`es2020`）以外的值，匯出一定失敗**，見下面。**已在這台 Mac 修掉**（擁有者說「修好再推」），四個目標都匯得出來，見最後一節 |

## 找到的兩個問題

### 1. 語法目標只要不是 `es2020`，小遊戲匯出一定失敗

- 看到的：`syntaxTarget` 設 `es2017`、`es2018`、`es2019`，`zhuda-laya-minigame --platform wxgame` 都以 `[MINIGAME_SOURCE_RACE] Consumer sources changed between the gated web build and the platform bundle` 結束（各跑兩次都一樣）；不設或設 `es2020` 就過（`minigame/target-*.txt`）。原始碼並沒有人動。
- 原因（讀程式看到的）：`packages/compiler/zhuda-minigame.mjs` 用 `target: syntaxTarget` 編一份遊戲程式，再和網頁版建置的 `app.js` **逐字比對**來確認原始碼沒有在途中被改。網頁版固定用 `es2020` 編（`consumer-build.mjs`），所以目標一換，兩份文字必然不同，被當成「原始碼變了」。
- 為什麼雲端沒看到：它那邊沒有官方工具鏈，`zhuda-laya-minigame` 本身沒跑過，測的是被它呼叫的各個零件。
- 修法（寫這一段時還沒改程式，只試了後半；之後照這樣修了，見最後一節）：比對時照舊用 `es2020` 編；比對通過以後，再把那份已核對的文字用 `esbuild.transform(..., { target: syntaxTarget })` 降下來當輸出。我拿預設匯出的 `js/index.js` 這樣降：`es2017` 得到 476,107 位元組、沒有警告、用語法解析器在 ES2017 能整份解析；`es2018`、`es2019` 同樣各自解析得過。

### 2. 12 個檔沒有照 Prettier 排版

`npm run format:check` 列出的 12 個檔都是這一輪新增或改過的：`packages/core/runtime3d/` 的 `Assets.ts`、`CharacterController.ts`、`Clocks.ts`、`Runtime.ts`、`Utf8.ts`、`WalkGrid.ts`，`packages/core/SplashSignal.ts`，`packages/compiler/zhuda-minigame.mjs`，和四個測試檔。雲端沒有釘住版本的 Prettier，所以只能在這台 Mac 排。

我在本地跑了 `prettier --write`（只有空白與換行變了），之後 `npm run verify` 仍是 1027／1027、`format:check` 過、lint 過、自動產生的型別宣告沒有變。排版和下面的修正一起提交、推上去了。

## 順帶看到的

- 設了較低的語法目標時，建置會印出一串「Big integer literals are not available in the configured target environment」的警告，指向引擎的 `packages/core/effects/EffectBudget.ts`（量 GPU 時間用的，七處 `0n` 這類字面值，在這一輪之前就有）。這個範本專案用不到那一段，打包時被拿掉了，匯出的檔裡沒有 BigInt 字面值；但用到 `ZhudaEffectBudget` 的遊戲會留著它，那樣的檔在只懂 ES2017 的主機上會整份解析失敗。沒有驗這種遊戲。
- 這一輪做到一半時，工作目錄裡出現別的工作階段正在寫的東西（兩條新路線 `screen-fit-game-box`、`key-art-to-animated-title`，以及路線索引和 `mobile-always-landscape` 的修改，10:32 到 10:34）。不是這一輪的內容，我沒有碰。

## 沒做的

- `fixedDeltaSec` 沒有在真的遊戲頁面裡試（沒有參考遊戲用它）。
- 等待與補間、走路格子、尋路、角色控制器：只跑了它們自己的測試，沒有遊戲用到。
- 小遊戲只匯出到本機資料夾，沒有進微信開發者工具、沒有上手機。
- 沒有人看過圖。

## 之後修了什麼（同一天，擁有者說「修好再推」）

- `packages/compiler/zhuda-minigame.mjs`：比對用的那一份改回照網頁版的語法編（`MINIGAME_GATED_SYNTAX`，直接引用 `consumer-build.mjs` 新抽出來的 `CONSUMER_SYNTAX_TARGET`，兩邊不會再各寫各的）；比對通過之後才用新的 `lowerMiniGameScript()` 把那份文字降到要求的語法。降的時候打包工具說「這個目標沒有、也沒有舊寫法可換」的東西（例如 BigInt 字面值），直接以 `MINIGAME_SYNTAX` 拒絕並說是什麼，不會再默默留在檔裡。
- `tests/minigame-toolchain.test.mjs` 多一個測試：兩邊用同一個語法目標、比對那一步不再用 `syntaxTarget`、四個目標各自降完不留下更新年份的語法而且還能執行、BigInt 在 `es2017` 被拒絕而在 `es2020` 原樣通過。
- **用官方工具鏈實際匯出**（`minigame-after-fix/`）：`es2017`、`es2018`、`es2019`、`es2020` 都匯得出來（同時設橫向，`game.json` 是 `landscape`）。用語法解析器逐年份讀回整包九支腳本（含 LayaAir 的函式庫）：最新只需要到指定的那一版（`es2017` 那次整包在 ES2017 就讀得完）。在遊戲裡放一個 BigInt 字面值：`es2017` 以 `MINIGAME_SYNTAX` 結束並指出是 BigInt，`es2020` 通過。
- 修完重跑：`npm run verify` 1028／1028、lint、`format:check`、九款參考遊戲都過（`../A1/at-473ca3d9/*-after-fix.log`）。
- 文件：`docs/minigame-packaging.md`、`CHANGELOG.md`、`docs/plans/records/gaps-after-2-0/verification.md` 補了這一段。
- 還是沒做的：沒有進微信開發者工具、沒有上手機。九款遊戲釘的是 `v2.0.0`（`91d21f79`），那一版沒有 `syntaxTarget` 這個設定，所以不受影響；要用它得把釘選往後移。
