# 🐷 zhuda-laya-engine（豬大 LayaAir · AI-Agent-Friendly 開源分支版）

[![Upstream LayaAir](https://img.shields.io/badge/Upstream-LayaAir_Official_3.4.2-0ea5e9)](https://github.com/layabox/LayaAir)
[![LayaAir Website](https://img.shields.io/badge/Official_Site-layaair.com-14b8a6)](https://layaair.com/)
[![Edition](https://img.shields.io/badge/Edition-Zhuda_Agent--Friendly_Fork-2dd4bf)](https://github.com/zhudaandzhuer/zhuda-laya-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-4ade80)](./LICENSE)

> **基於 [LayaAir 官方引擎 (3.4.2)](https://github.com/layabox/LayaAir) 渲染與物理內核，由 [豬大 (@zhudaandzhuer)](https://github.com/zhudaandzhuer) 打造的 AI-Agent-Friendly 開源分支版本 (`zhuda-laya-engine`)。**
> 完全脫離 LayaAir IDE 黑盒與 GUI 鎖定，專為 **AI Coding Agent（Claude Code / Cursor / Windsurf / AGY / Codex）** 與現代自動化前端工程打造的模組化 **2D / 3D / Spine 4.2** 遊戲引擎工作台與 SDK。

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
| **AI 語料與防幻覺** | 大模型常混用 Laya 1.x / 2.x 廢棄 API | **內建 13 工具 MCP Server (`zhuda-laya-mcp`) + `zhuda-laya-doctor` 靜態守衛** |

---

## 🛠️ 六大 AI-Native 工程基建與三大商業化落地支柱

| 基建模組 | 套件路徑 | 解決痛點與核心能力 |
| :--- | :--- | :--- |
| **1. 拓撲載入器與按需剪枝** | `packages/core/TopologyGraph.ts` | 建立 29 個 LayaAir 3.4.2 引擎庫的完整 DAG 有向無環圖與 Kahn's 拓撲排序；確保 `physics2D -> box2D`、`bullet -> physics3D`、`spine-core-4.2 -> laya.spine -> laya.spine3D` 順序零死鎖，並支援按需 Feature Pruning（`2d-light` 縮減 **83.2%** 體積）。 |
| **2. Zero-IDE AST 自動類別反射** | `packages/compiler/ast-scanner.mjs`<br>`packages/compiler/zhuda-build.mjs` | 使用 TypeScript 官方 AST 掃描 `@zhudaComponent` 與 `Laya.Script` 子類別，自動生成 `src/.generated/zhuda-registry.ts` 並注入 `ClassUtils.regClass()`，結合 `esbuild` 同步產出應用程式與 `dist/sdk/zhuda-laya-engine.{esm.js,cjs}`。 |
| **3. 原型解毒與宣告式 SDK** | `packages/core/RuntimeGuards.ts`<br>`packages/core/DeclarativeSDK.ts`<br>`packages/core/SpineVisualContract.ts`<br>`packages/core/VisualFocusContract.ts` | `EngineGuard.installPrototypeDetox()` 自動修補 `Laya.Graphics.prototype.setState`；提供對標 Three.js / R3F 的 `ZhudaEngine.boot`、`Zhuda3D`、`ZhudaUI` 與 `ZhudaPrefab` 宣告式純代碼 API；`SpineVisualContract` 會拒絕 fallback 物件並檢查 Spine 4.2 動畫、皮膚、插槽、事件、約束與 bounds；`VisualFocusContract` 將 clear/focus/空集合的全盤作用域語意明確化。 |
| **4. 模組化型別與 13 工具 MCP Server** | `packages/types/*.d.ts`<br>`packages/mcp-server/index.mjs` | 剝離 IDE 專屬污染型別（`editor.d.ts`），分為乾淨 `.d.ts`；內建可執行之 **Model Context Protocol (MCP) Server**，提供拓撲解析、API 護欄、錯誤診斷、Golden Examples、像素校準、九宮格驗測、SafeArea 矩陣、Unity 移植驗證、視覺資產審計與視覺演出契約共 **13 項 AI 工具**。 |
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
│   ├── mcp-server/            # AI-Native MCP 語料與診斷伺服器 (13 Tools, stdio + CLI 雙模)
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

# 4. 執行完整單元與整合測試 (14 項測試涵蓋拓撲、AST、MCP、ΔE00 校準與商業化 M1~M5)
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

## 📄 開源授權與致謝 (License & Credits)

- **分支整理與 AI-Native 架構研發**：[豬大 (@zhudaandzhuer)](https://github.com/zhudaandzhuer) — MIT License
- **上游底層引擎致謝**：[LayaAir 官方引擎 (Layabox Inc.)](https://layaair.com/) · [https://github.com/layabox/LayaAir](https://github.com/layabox/LayaAir)

