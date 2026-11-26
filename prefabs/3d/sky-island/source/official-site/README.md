# 官網首頁的小島：怎麼從函式庫重建（zhudaandzhuer.com hero）

官網首頁（https://zhudaandzhuer.com/）的「豬大與豬二的小島」原本是 `games/zhuda-home-island` 建出來的。那個專案的內容現在全在函式庫：觀看台 `viewer3d` 的 `home-island` preset（`viewer3d/src/presets/home-island.ts`）＋`3d/sky-island`、`3d/island-pig`、`3d/island-sound`、`3d/zhuda-characters`、`ui/scene-controls`。這裡是把它再做成官網用的客戶端（`www/gameClients/zhuda/home-island/`）的步驟。**2026-11-25 在暫存資料夾照步驟 1～4 建過一次（WebGL 版、32 MB，型別與體檢都過）；步驟 6、7（寫進官網、發布）沒有跑。**

這個資料夾：

- `register-official.mjs`：原專案的 `tools/register-official.mjs`（只改了開頭說明）。把 WebGL 版的 `dist/web` 複製到 `~/Documents/zhudaandzhuer.com/www/gameClients/zhuda/home-island/web/`，寫 `game-client.json`（每個檔案的 SHA-256、`kind: "scene"`、`slug: "zhuda-home-island"`、`publicPath: "zhuda/home-island"`、`entry: "index.html"`）。建置裡有 WebGPU 就拒絕（官網要較輕、到處都能跑的 WebGL 版）。`OFFICIAL_CLIENT=<目錄>` 可以先寫到別處看看。
- `client/`：一個最小的客戶端專案（`package.json` 釘引擎 def94aa、`zhuda.config.json` 設 `renderer: "webgl"`、原專案的 `public/index.html`、`tools/build.mjs`、`src/Main.ts` 直接開 `home-island` preset，不用 `?scene=`）。

## 步驟

```bash
LIB=prefabs
C=<workspace>/games/zhuda-home-island   # 一個新資料夾（原專案刪掉後可用同一個名字）
# 1. 客戶端骨架＋preset（preset 用到的 preset.ts、page.ts 一起，位置照抄）
mkdir -p $C && cp -R $LIB/3d/sky-island/source/official-site/client/. $C/
mkdir -p $C/src/presets $C/tools
cp $LIB/viewer3d/src/preset.ts $LIB/viewer3d/src/page.ts $C/src/
cp $LIB/viewer3d/src/presets/home-island.ts $C/src/presets/
cp $LIB/3d/sky-island/source/official-site/register-official.mjs $C/tools/
cp $LIB/viewer3d/tools/play.mjs $LIB/viewer3d/tools/serve.mjs $C/tools/
mkdir -p $C/scenarios && cp $LIB/viewer3d/scenarios/home-home.json $LIB/viewer3d/scenarios/home-back.json $C/scenarios/
# 2. 引擎（或 ln -s $LIB/viewer3d/node_modules $C/node_modules）
cd $C && npm install
# 3. 函式庫模組（依賴一起來）；不需要影片版豬大可刪 public/common/3d/zhuda-characters/assets/zhuda-watchman.glb（3.7 MB，不會載入）
node $LIB/scripts/sync.mjs . 3d/sky-island 3d/island-pig 3d/island-sound 3d/zhuda-characters ui/scene-controls
# 4. 建置、型別、體檢
node tools/build.mjs && npx tsc --noEmit && npx zhuda-laya-doctor --project .
# 5. 無頭 Chrome 走一遍（打招呼、唱歌、牽手、抓、晚上）：preset 的 window.__SCENE__ 就是原本的 __ISLAND__（情境裡是 S.）
OUT=evidence LOG_CHARS=20000 node tools/play.mjs scenarios/home-home.json "embed=1"
OUT=evidence node tools/play.mjs scenarios/home-back.json ""
#    看 evidence/*.png；最後一行的 rendererErrors、pageErrors 要是空的
# 6. 放進官網的 gameClients（只改 www/gameClients/zhuda/home-island）
node tools/register-official.mjs
```

註：`tools/play.mjs` 會在網址前面加 `width=1280&height=720&`，`Main.ts` 不看 `scene`，所以這個客戶端用 `"embed=1"` 就好（觀看台裡才要 `scene=home-island&embed=1`）。

7. 官網那邊（原專案 HANDOFF 的流程；**對外發布，要先問使用者**）：

```bash
cd ~/Documents/zhudaandzhuer.com/www/officialSite && npm run check:structure && npm test
cd ~/Documents/zhudaandzhuer.com && zsh ./安裝常駐服務.command   # 備份會員資料→新 release→切換→健康檢查，失敗自動回滾
```

**不要在 officialSite 直接 `npm run build`**：`dist` 是指向正式 release 的符號連結，直接 build 會蓋掉線上版本（2026-11-16 19:13 發生過一次）。要本機試建，用 `ASTRO_OUT_DIR=<暫存目錄> npm run build`。

## 官網怎麼接這個小島（原專案 HANDOFF，2026-11-16）

- 成品：`www/gameClients/zhuda/home-island/`（`kind: "scene"`）。`officialSite/scripts/sync-game-clients.mjs` 對 `kind: "scene"` 原樣複製，不加 Godot 分片載入器和平台工作階段；檔案出現在 `/game-clients/zhuda/home-island/…`。
- `officialSite/src/components/HomeIsland.astro`＋`src/styles/story-island.css`；首頁 `src/pages/index.astro` 加了這個元件、「進入兄妹的小島」按鈕、「聽首歌」面板的「讓兄妹在小島上唱給你聽」。iframe 開的是這個客戶端的 `index.html` 加 `?embed=1`（網址細節以 `HomeIsland.astro` 為準；這次沒有打開官網原始碼確認）。
- 原本的標題、文案、插圖都在（SEO、首次繪製不變）。桌機（≥900px、有滑鼠、沒開減少動態、沒開省流量）在頁面載完、瀏覽器閒置時才載入小島，畫好前 40 幀（小島送出 `ready` 事件）後才淡入；手機只顯示按鈕，按了全螢幕打開。捲出畫面就停止繪製。
- 頁面在使用者的點擊裡直接呼叫 `iframe.contentWindow.zhudaIsland.command({ action })`（同源），所以點「唱首歌」就能出聲；`postMessage({ type: 'zhuda-island', action })` 是備援，只接受同源訊息。
- `/game-clients/` 沒有 CSP、可被同源 iframe；首頁本身的 CSP、`X-Frame-Options: DENY` 不變。

### 頁面指令與事件（preset 和原專案相同）

| `command({ action, … })` | 做什麼 |
|---|---|
| `sing` | 兩兄妹走到舞台（`STAGE`，左前方空地），豬大唱、豬二跳，跟著歌的播放時間對拍；歌停或 444 秒後結束 |
| `wave`、`bow`、`point`、`sit`、`sleep`、`hands`、`talk` | 打招呼、鞠躬、指、坐、睡、牽手（各伸一隻手）、聊天（面對面） |
| `stop` | 結束表演（歌也停） |
| `sound`（`on`） | 開／關聲音，並在這次點擊裡叫醒聲音 |
| `visible`（`on`） | 捲出畫面時 `on: false` 停止更新與繪製 |
| `full`（`on`） | 全螢幕時觸控全給小島；嵌在頁面時直向滑動捲頁面（`touch-action: pan-y`） |
| `hour`（`hour`） | 固定時間 |

小島送出的事件（`postMessage` 到 `window.parent`，`targetOrigin` 是自己的 origin）：`{ type: 'zhuda-island', event: 'ready', sound }`（前 40 幀後）、`event: 'song', playing`、`event: 'sound', on`。`window.zhudaIsland.state()` → `{ show, sound, hour }`。

## 已知限制（原專案 HANDOFF）

- 沒上過真手機（iPhone Safari、vivo）：全螢幕、觸控抓取、聲音解鎖、記憶體都沒試。
- 首次載入約 25 MB（WebGL 版；歌 7 MB 最後才載或按唱歌時才載），網站走這台 Mac 的 tunnel。
- 歌的第一拍位置（`offset`）是 0，沒量；拍子準不準要人眼人耳看。
- 用函式庫重建後的資源路徑是 `common/3d/…`（原本是 `assets/…`），大小差不多；多了用不到的 `rock_moss_set_01.glb`（自然小物整包複製）。
