# 🐷 zhuda-laya-engine（豬大 LayaAir · AI-Agent-Friendly 開源分支版）

[![Upstream LayaAir](https://img.shields.io/badge/Upstream-LayaAir_Official_3.4.2-0ea5e9)](https://github.com/layabox/LayaAir)
[![LayaAir Website](https://img.shields.io/badge/Official_Site-layaair.com-14b8a6)](https://layaair.com/)
[![Edition](https://img.shields.io/badge/Edition-Zhuda_Agent--Friendly_Fork-2dd4bf)](https://github.com/zhudaandzhuer/zhuda-laya-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-4ade80)](./LICENSE)

> **基於 [LayaAir 官方引擎 (3.4.2)](https://github.com/layabox/LayaAir) 渲染與物理內核，由 [豬大 (@zhudaandzhuer)](https://github.com/zhudaandzhuer) 打造的 AI-Agent-Friendly 開源分支版本 (`zhuda-laya-engine`)。**
> 完全脫離 LayaAir IDE 黑盒與 GUI 鎖定，專為 **AI Coding Agent（Claude Code / Cursor / Windsurf / AGY / Codex）** 與現代自動化前端工程打造的模組化 **2D / 3D / Spine 4.2** 遊戲引擎工作台與 SDK。

## 3D 接入補強與實測

新增獨立消費端建置、PBR／自訂 shader／動態網格、模型 lease 與材質隔離、CSS 座標與多指輸入、快照時鐘、3D 掛點，以及場景品質／資源預算。修正 DPR 重複放大與 Laya342 相機拆除的陰影貼圖遺漏。

[3D 接入文件](docs/3d-integration.md) · [驗收矩陣與限制](docs/3d-acceptance.md) · [獨立 3D 場景](https://zhudaandzhuer.github.io/zhuda-3d-lab/) · [消費端原始碼與實測報告](https://github.com/zhudaandzhuer/zhuda-3d-lab)

### Agent-friendly 地形與 Shader

引擎現在提供可序列化的 `ZhudaTerrain2D` tile map、分塊／視野 streaming、palette atlas UV、blocked metadata，以及 `ZhudaHeightfield`／`ZhudaTerrain3D` 高度場、brush／patch、LOD 1／2／4、精確三角形採樣、世界 raycast、穩定 cell ID 與資源報告。`ZhudaShaderMaterial` 將 LayaAir 3.4.2 的 2D clipping／atlas／premultiplied alpha／gamma 和 3D world transform／normal／fog／output transform 收進明確的 2D／3D shader recipe；MCP 可先驗證 JSON，真正 GPU 編譯仍由 WebGL draw 驗收。詳見 [地形與 Shader 契約](docs/terrain-shader.md)。

iPhone14 的固定海域小場景持續採樣超過10分鐘，P95 20ms（low／DPR1）；另有雙平台2D／3D地形約20分鐘rolling樣本，iPhone14／vivo V40的P95為22／19.6ms。完整遊戲地圖與不中斷長時間壓測仍須另驗；遊戲資產和規則留在獨立專案。

## 完整遊戲 · 豬大遊戲館

[![豬大遊戲館 · 四款新作與霓虹疾線](https://raw.githubusercontent.com/zhudaandzhuer/zhuda-arcade/main/docs/collection.jpg)](https://zhudaandzhuer.github.io/zhuda-arcade/)

**[進入遊戲館 →](https://zhudaandzhuer.github.io/zhuda-arcade/)** · 共用「豬大 × LayaAir」標題啟動畫面，鍵盤與觸控操作、關卡解鎖、勝負結算、永久強化及進度備份。

| 遊戲 | 玩法 | 遊玩 |
| --- | --- | --- |
| 星港突圍 STARFALL | 太空彈幕、震波清彈、巨型主艦；四關 | [開始](https://zhudaandzhuer.github.io/zhuda-arcade/?game=starfall) |
| 燼火遠征 EMBERBOUND | 競技場生存、升級三選一、衝刺與獸潮首領；四關 | [開始](https://zhudaandzhuer.github.io/zhuda-arcade/?game=ember) |
| 晶核守衛 COREKEEP | 四張路線、三類防禦塔、升級出售、六波守城 | [開始](https://zhudaandzhuer.github.io/zhuda-arcade/?game=corekeep) |
| 潮汐碎光 TIDEBREAK | 角度反彈、裝甲晶礁、多球／寬板／雷射；四關 | [開始](https://zhudaandzhuer.github.io/zhuda-arcade/?game=tidebreak) |
| 霓虹疾線 NEON APEX | 四條賽道、電腦車手、漂移、氮氣與車庫 | [開始](https://zhudaandzhuer.github.io/zhuda-neon-racer/) |

遊戲規則、關卡、UI、美術、存檔和部署分別保存在獨立的 **[zhuda-arcade](https://github.com/zhudaandzhuer/zhuda-arcade)** 與 **[zhuda-neon-racer](https://github.com/zhudaandzhuer/zhuda-neon-racer)**，以公開 SDK 消費本引擎。新作有 21 項規則測試，含操作輸入通關全部 16 關；另檢查實際 WebGL、鍵盤／滑鼠／觸控模擬、結算保存與三種版面，詳見[驗證紀錄](https://github.com/zhudaandzhuer/zhuda-arcade/blob/main/docs/browser-verification.json)。

## 粒子實際渲染展示 · 100 種場景

[![車身包覆氣流、魔法與爆破展示](https://raw.githubusercontent.com/zhudaandzhuer/zhuda-particle-lab/main/docs/media/showcase-preview.gif)](https://zhudaandzhuer.github.io/zhuda-particle-lab/showcase.html)

**[▶ 觀看 60 FPS 展示](https://zhudaandzhuer.github.io/zhuda-particle-lab/showcase.html)** · **[立即試玩 100 種效果](https://zhudaandzhuer.github.io/zhuda-particle-lab/)** · [瀏覽效果圖鑑](https://zhudaandzhuer.github.io/zhuda-particle-lab/catalog.html)

3D 賽車氣流從車頭包覆車頂與兩側，沿彎道留下尾流；另展示魔法、爆破、天候、水體與介面回饋，共 91 種 2D、9 種真實 3D 效果。影片為實際 WebGL 畫面逐幀錄製，完整版 17 秒、60 FPS；上方 GIF 為 24 FPS 縮小預覽。

展示應用、100 種配方、場景、美術與影片完整保存在獨立的 **[zhuda-particle-lab](https://github.com/zhudaandzhuer/zhuda-particle-lab)**。本引擎提供通用 SDK；[驗收結果](https://github.com/zhudaandzhuer/zhuda-particle-lab/blob/main/VERIFICATION-100.md)涵蓋逐項渲染與重播、資源釋放及 4,000 粒子負載。

---

## 🏛️ 官方致謝與分支定位聲明 (Upstream Attribution & Fork Notice)

本專案 **`zhuda-laya-engine`** 是建立在 **LayaAir 官方開源遊戲引擎** 基礎之上的 **豬大 Agent-Friendly 分支版本（AI-Native Fork / Branch Edition）**：

- **LayaAir 官方網站**：[https://layaair.com/](https://layaair.com/)
- **LayaAir 官方 GitHub 倉庫**：[https://github.com/layabox/LayaAir](https://github.com/layabox/LayaAir)（版權歸屬 Layabox Inc.，採 MIT 開源授權）
- **底層內核版本**：`LayaAir 3.4.2`（涵蓋 `laya.core`、`laya.d3`、`laya.physics3D (Bullet)`、`laya.box2D`、`spine-core-4.2` 等 29 個官方執行期模組）
- **豬大分支版本 (`zhuda-laya-engine`) 定位**：
  官方 LayaAir 3.x 預設高度仰賴桌面端 LayaAir IDE 進行類別反射註冊、場景編譯與腳本注入；當 AI Agent 以純程式碼（Zero-IDE CLI）操控時，極易遭遇 **29 庫載入順序死鎖**、**未經 IDE 編譯導致組件遺失**、**`Laya.Button` 原型鏈 `setState` 崩潰**、**1.x/2.x/3.x 跨代語料幻覺** 與 **UI 像素偏移無法離線度量** 等痛點。
  因此，**豬大 (@zhudaandzhuer)** 將官方 3.4.2 內核重新封裝為 **`zhuda-laya-engine`**，補齊 **六大 AI-Native 工程基建** 與 **三大商業化落地支柱（M1~M5）**，讓任何 AI Agent 都能在純終端環境下 **< 90ms 零死鎖建置、0px / ΔE00=0 自動像素校準、並透過內建 MCP Server 零幻覺寫出商業級 2D/3D/Spine 4.2 遊戲**。

---

## ⚡ 官方原版 vs `zhuda-laya-engine` (豬大 Agent-Friendly 分支版) 對照

| 維度 | LayaAir 3.4.2 官方預設工作流 | `zhuda-laya-engine`（豬大 Agent-Friendly 分支版） |
| :--- | :--- | :--- |
| **建置與編譯依賴** | 需開啟 LayaAir IDE 或重型 `layaair2-cmd` 黑盒管線 | **Zero-IDE 純 CLI (`zhuda-laya-build`)**：`esbuild` + AST 自動反射，**< 90ms** 產出 Web 與 ESM/CJS SDK |
| **29 模組載入順序** | 手動排列 `<script>` 極易觸發 `reading 'I'` 或 `Box2D` 死鎖 | **Kahn's DAG 拓撲載入器 (`TopologyResolver`)**：100% 靜態保證 29 庫順序零倒置，2D 輕量剪枝省 **83.2%** 體積 |
| **組件類別反射** | 依賴 IDE 隱藏產出 `regClass` 映射表 | **AST 靜態掃描 (`ast-scanner.mjs`)**：自動掃描 `@zhudaComponent` 與 `Laya.Script` 子類並注入 `ClassUtils.regClass()` |
| **運行期防崩潰** | 純代碼自繪 `Laya.Button` 易觸發 `this._graphics.setState is not a function` | **`EngineGuard.installPrototypeDetox()`**：啟動時自動完成原型解毒修補與宣告式 `ZhudaEngine` / `Zhuda3D` / `ZhudaUI` 封裝 |
| **UI / 預製體校準** | 必須進 GUI 肉眼對齊，且 `DrawRoundRectCmd` 預設 `percent: true` 易放大百倍 | **先設計後組裝 (`ZhudaAssetSerializer` + `PixelCalibrationEngine`)**：離線計算 Tight Bounding Box 與 CIEDE2000 ($\Delta E_{00}$) 色差並自動產生 `AutoFixPatch` 收斂至 **0px / $\Delta E_{00}=0$** |
| **AI 語料與防幻覺** | 大模型常混用 Laya 1.x / 2.x 廢棄 API | **內建 16 工具 MCP Server (`zhuda-laya-mcp`) + `zhuda-laya-doctor` 靜態守衛** |

---

## 🛠️ 六大 AI-Native 工程基建與三大商業化落地支柱

| 基建模組 | 套件路徑 | 解決痛點與核心能力 |
| :--- | :--- | :--- |
| **1. 拓撲載入器與按需剪枝** | `packages/core/TopologyGraph.ts` | 建立 29 個 LayaAir 3.4.2 引擎庫的完整 DAG 有向無環圖與 Kahn's 拓撲排序；確保 `physics2D -> box2D`、`bullet -> physics3D`、`spine-core-4.2 -> laya.spine -> laya.spine3D` 順序零死鎖，並支援按需 Feature Pruning（`2d-light` 縮減 **83.2%** 體積）。 |
| **2. Zero-IDE AST 自動類別反射** | `packages/compiler/ast-scanner.mjs`<br>`packages/compiler/zhuda-build.mjs` | 使用 TypeScript 官方 AST 掃描 `@zhudaComponent` 與 `Laya.Script` 子類別，自動生成 `src/.generated/zhuda-registry.ts` 並注入 `ClassUtils.regClass()`，結合 `esbuild` 同步產出應用程式與 `dist/sdk/zhuda-laya-engine.{esm.js,cjs}`。 |
| **3. 原型解毒與宣告式 SDK** | `packages/core/RuntimeGuards.ts`<br>`packages/core/DeclarativeSDK.ts`<br>`packages/core/SpineVisualContract.ts`<br>`packages/core/VisualFocusContract.ts` | `EngineGuard.installPrototypeDetox()` 自動修補 `Laya.Graphics.prototype.setState`；提供對標 Three.js / R3F 的 `ZhudaEngine.boot`、`Zhuda3D`、`ZhudaUI` 與 `ZhudaPrefab` 宣告式純代碼 API；`SpineVisualContract` 會拒絕 fallback 物件並檢查 Spine 4.2 動畫、皮膚、插槽、事件、約束與 bounds；`VisualFocusContract` 將 clear/focus/空集合的全盤作用域語意明確化。 |
| **4. 模組化型別與 16 工具 MCP Server** | `packages/types/*.d.ts`<br>`packages/mcp-server/index.mjs` | 剝離 IDE 專屬污染型別（`editor.d.ts`），分為乾淨 `.d.ts`；內建可執行之 **Model Context Protocol (MCP) Server**，提供拓撲解析、API 護欄、錯誤診斷、Golden Examples、像素校準、九宮格驗測、SafeArea 矩陣、Unity 移植驗證、視覺資產審計、視覺演出契約與粒子設定驗證共 **16 項 AI 工具**。 |
| **5. Headless Chrome 首幀守衛** | `packages/ci-gate/verify-first-frame.mjs` | 自動啟動受管理無頭瀏覽器驗證 WebGL 上下文、29 模組載入狀態、AST 組件反射、Spine 4.2 `PhysicsConstraint` 彈簧求解器與首幀自動截圖。 |
| **6. 靜態資產 (`.lh`/`.ls`) 與 $\Delta E_{00}$ 校準** | `packages/core/StaticAssetPipeline.ts`<br>`packages/core/PixelCalibrationEngine.ts` | 實現「先設計靜態資產、孤立微預覽 (`preview.html`)、後組裝」工作流，自動強制 `DrawRoundRectCmd` `percent: false`，並執行 Tight Bounding Box 0px 邊界與 CIEDE2000 色差單步自動修補。 |
| **7. 商業化支柱 M1~M5** | `packages/core/IframeSoundAdapter.ts`<br>`packages/core/ViewportMatrixEngine.ts`<br>`packages/core/UnityBridgePipeline.ts` | **M1** 九宮格 `sizeGrid` 四角 16×16px 0px 變形鎖定 · **M2** `IframeSoundAdapter` 首觸手勢解鎖、失焦靜音與 `postMessage` 音訊橋 · **M3** 5 大主流終端 SafeArea 與靈動島 3D FOV 自動補償 · **M4** 4 套決定性 VFX 特效藍圖 · **M5** Unity 左手系轉右手系 (`LH -> RH`) + `AnimatorController` 狀態機 + Spine 4.2 移植管線。 |

---

## 📦 套件結構與匯出入口 (`zhuda-laya-engine`)

```text
zhuda-laya-engine/
├── packages/
│   ├── core/                  # 核心 SDK (TopologyGraph, RuntimeGuards, DeclarativeSDK, StaticAssetPipeline, PixelCalibrationEngine, IframeSoundAdapter, ViewportMatrixEngine, UnityBridgePipeline)
│   ├── compiler/              # Zero-IDE 編譯器 (含 visual-contract-audit.mjs 視覺演出閘門)
│   ├── mcp-server/            # AI-Native MCP 語料與診斷伺服器 (16 Tools, stdio + CLI 雙模)
│   ├── types/                 # 去 IDE 污染之分層 TypeScript 型別宣告 (.d.ts)
│   └── ci-gate/               # Headless Chrome 首幀遙測與 HTML 視覺報告產生器
├── vendor/laya-3.4.2/libs/    # LayaAir 3.4.2 官方 29 個核心與擴充模組 (含 Spine 4.2 / Bullet / Box2D)
├── assets/                    # 經 0px / ΔE00=0 校準之 10 份 .lh 預製體與 .ls 場景資產
├── src/                       # 示範應用：3D + Spine 4.2 物理聯動踩地雷工作台 & 孤立資產微預覽器
├── dist/
│   ├── sdk/                   # 打包後之獨立引擎 SDK (zhuda-laya-engine.esm.js / .cjs)
│   └── web/                   # 零死鎖可部署 Web 產物 (index.html + preview.html)
└── tests/                     # Node.js 原生測試套件 (拓撲、AST、MCP、靜態資產 ΔE00、商業化 M1~M5)
```

### 在專案中匯入 `zhuda-laya-engine` SDK

```ts
import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaUI,
  ZhudaPrefab,
  TopologyResolver,
  EngineGuard,
  PixelCalibrationEngine,
  IframeSoundAdapter,
  ViewportMatrixEngine,
  UnityBridgePipeline
} from 'zhuda-laya-engine';
```

---

## 🚀 快速指令 (CLI & 自動化驗證)

```bash
# 1. 執行 Zero-IDE 極速打包 (< 90ms，同步產出 dist/web 與 dist/sdk/zhuda-laya-engine.{esm.js,cjs})
npm run build

# 2. 執行分層 TypeScript 型別檢查
npm run typecheck

# 3. 執行 Zhuda-Doctor 拓撲與防幻覺靜態體檢
npm run doctor

# 4. 執行完整單元與整合測試 (涵蓋拓撲、AST、MCP、粒子、視覺契約、ΔE00 校準與商業化 M1~M5)
npm run test

# 5. 一鍵執行完整引擎驗證管線 (build + typecheck + doctor + test)
npm run verify

# 6. 驗證移植專案的視覺演出契約 (作用域、狀態與還原規則)
node packages/compiler/visual-contract-audit.mjs --project /absolute/path/to/laya-project

# 7. 封裝開源發布 Tarball (產出 dist/zhuda-laya-engine-1.0.0.tgz)
npm run pack:tarball
```

---

## 🤖 掛載內建 AI-Native MCP Server (`zhuda-laya-mcp`)

在 Cursor / Windsurf / Claude Code / AGY 的 MCP 設定中加入：

```json
{
  "mcpServers": {
    "zhuda-laya-engine": {
      "command": "node",
      "args": ["/path/to/zhuda-laya-engine/packages/mcp-server/index.mjs"]
    }
  }
}
```

亦可在終端機直接以 CLI 模式調用任一工具：

```bash
# 查詢 3D + Spine 4.2 最小按需剪枝拓撲序列
node packages/mcp-server/index.mjs --tool resolve_topology --args '{"features":["3d","spine42"]}'

# 執行靜態 .lh 資產從 +3px / ΔE00 色差偏移自動修補至 0px / ΔE00=0 的閉環驗證
node packages/mcp-server/index.mjs --tool calibrate_asset_pixels --args '{"simulateDriftAndAutoFix":true}'

# 驗證 Unity 場景 (LH->RH) + AnimatorController + Spine 4.2 完整移植
node packages/mcp-server/index.mjs --tool verify_unity_migration --args '{}'

# 先驗證 Unity 視覺資產，再接遊戲規則（strict 會阻擋未映射材質/動畫包裝）
node packages/compiler/visual-asset-audit.mjs \
  --source /absolute/path/to/unity-project/Assets/Game \
  --target /absolute/path/to/laya-project/assets \
  --strict \
  --report /absolute/path/to/laya-project/dist/visual-asset-migration.json

# 同一能力也可由 MCP 呼叫
node packages/mcp-server/index.mjs --tool audit_visual_migration --args '{"sourceRoot":"/absolute/path/to/unity/assets","targetRoot":"/absolute/path/to/laya/assets","strict":true}'
```

`visual-asset-audit` 是移植前的資產閘門。它會盤點來源與目標檔案，逐個比對 Spine 4.2 的動畫、皮膚、骨骼、插槽、約束、Atlas 與貼圖，並把 Unity `.anim`、`.controller`、`.mat` 包裝標記為「已由 Spine 表達」或「需要明確的 Laya 材質/演出契約」。`strict` 模式會在尚未完成這些契約時失敗，避免以靜態 fallback 或畫面存在誤判為移植完成。

`visual-contract-audit` 是第二道閘門，專門驗證「演出怎麼表現」。目標專案放置 `visual-presentation-manifest.json` 後，`zhuda-build` 會在打包前檢查每個演出是否寫明 source/target、board/reel/cell 作用域、明確 runtime states、非中獎目標處理、以及 clear 後的視覺還原規則。執行期可使用 `VisualFocusContract`，避免把 `null` 同時當成「清除」與「空選擇」。

```ts
import { VisualFocusContract } from 'zhuda-laya-engine';

VisualFocusContract.apply(targets, VisualFocusContract.focus(winningIds));
VisualFocusContract.apply(targets, VisualFocusContract.clear());
```

遊戲專案若在 `zhuda.config.json` 宣告 `visualContract`，契約不通過時建置會直接失敗；同一檢查也可由 MCP `audit_visual_contract` 呼叫，讓代理先完成資產與演出規格再進入 gameplay 實作。

若 Unity 的 `.anim` 或 `.mat` 是由 Laya 的演出元件承接，可在目標根目錄放置 `visual-migration-manifest.json`，或透過 `--contract` 指定它：

```json
{
  "schemaVersion": 1,
  "animations": [
    { "sourcePath": "Art/VendorArt/Animation/BigWin/Ani_BigWin_in.anim", "targetAnimation": "BigWin_in" }
  ],
  "materials": [
    { "sourcePath": "Art/VendorArt/Animation/BigWin/BigWin_Additive.mat", "targetMaterial": "SpineStandard", "blendMode": "additive" }
  ]
}
```

---

## 2D 粒子與路徑拖尾

公開 SDK 提供 `ZhudaParticleSystem`、`ZhudaLayaParticleRenderer`、`ZhudaRibbonTrail`、`ZhudaLayaRibbonRenderer` 與 `ZhudaEffectEnvelope`，另提供 3D XYZ 粒子、相機／速度／地面 billboard、歷史拖尾及可沿路徑漸顯的 `ZhudaRibbonPath3D`。支援貼圖、生命曲線、定種子重播、物件池、世界／本地空間、距離發射及彎曲路徑。MCP `validate_particle_effect` 可先檢查 JSON 設定。

公開 SDK 另外提供 VFX 材質合約（溶解、遮罩、噪聲、UV 扭曲、折射、柔化深度）、相機 pass、Flipbook 圖集 UV、平面碰撞與事件鏈、全域粒子／覆蓋預算、時間軸／掛點、Unity Standard／URP Lit 到 PBR 的移植，以及實際 WebGL draw-call profiler。未知 Unity shader 會被明確阻擋，避免把畫面差異藏在 fallback 裡。

完整 API、限制與接入方式見 [packages/core/particles/README.md](packages/core/particles/README.md) 與 [packages/core/effects](packages/core/effects)。展示場景、遊戲預設及美術資產由獨立的 [zhuda-particle-lab](https://github.com/zhudaandzhuer/zhuda-particle-lab) 管理；引擎只提供通用 SDK，不依賴展示專案。

## 📄 開源授權與致謝 (License & Credits)

- **分支整理與 AI-Native 架構研發**：[豬大 (@zhudaandzhuer)](https://github.com/zhudaandzhuer) — MIT License
- **上游底層引擎致謝**：[LayaAir 官方引擎 (Layabox Inc.)](https://layaair.com/) · [https://github.com/layabox/LayaAir](https://github.com/layabox/LayaAir)
