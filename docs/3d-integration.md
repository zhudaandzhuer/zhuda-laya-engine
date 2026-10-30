# 3D 消費專案接入與驗收契約

2026-10-30。基於 LayaAir 3.4.2；本次補強從 `2edc93d` 開始。

引擎提供通用呈現、載入、座標、時鐘與資源介面。遊戲保留波浪公式、採樣器、島嶼生成、移動／傷害／建造／網路權威規則。水面及模型驗收場景在獨立的 [zhuda-3d-lab](https://github.com/zhudaandzhuer/zhuda-3d-lab)，遊戲資產不放入引擎。

## 外部建置與啟動

Node.js 24+。固定引擎 Git SHA 安裝，不依賴工作目錄旁的引擎原始碼。

```js
import { runConsumerBuild } from 'zhuda-laya-engine/compiler/consumer';
await runConsumerBuild({
  projectRoot: process.cwd(),
  config: { features: ['core', '3d', 'gltf'] },
});
```

消費端 `public/index.html` 必須有 `<!-- ZHUDA_LIBS -->` 與 `<!-- ZHUDA_ENTRY -->`。保留原有 HTML、CSS、DOM；預設來源為 `src/Main.ts`，輸出為 `dist/web`。可設定 `entry`、`publicDir`、`htmlTemplate`、`outDir`。讀取反射資料後直接 bundle，不產生消費端 `.generated`，不寫入來源、不複製內建示範。現有 `zhuda-laya-build` 外部建置也走此路徑；`demoAssets: true` 才啟用舊示範流程。若有畫面契約 manifest，仍執行原有檢查。

`dist/game.zip` 為可解壓的 ZIP，`consumer-build.json` 記錄實際 ZIP／解壓大小，預設各不得超過 50,000,000 bytes。`payload-manifest.json` 列出引擎庫與每個 payload 的 bytes／SHA256。資源與 script 均使用相對路徑；消費端自行管理資產版本目錄。iframe opaque-origin 載入 GLB／JPG 需要資產伺服器回傳 CORS 許可。

```ts
const context = await ZhudaEngine.boot({
  container: document.querySelector('#game')!,
  features: ['core', '3d', 'gltf'],
  dprCap: 1.5, targetFPS: 60,
  antialias: false, preserveDrawingBuffer: false,
  clearInput: () => input?.clear(),
  onContextLost: () => notifyHostWithSnapshot(),
});
context.runtime.start(dt => present(dt));
```

選項在 `beforeInit` 之前設定，callback 可覆寫。DPR cap 控制 backing 尺寸，CSS 大小由容器決定；不再重複套用 retinal DPR。30／60 FPS 分別配置引擎與消費端更新節奏。初始化 resize callback 失敗會清掉監聽器和已建根場景。

`context.dispose()` 釋放本 session 的更新、監聽器與根場景。Laya 是 realm singleton，沒有承諾完整卸載 vendor 全域引擎；需要完全拆除／預覽隔離／context loss 恢復時，使用 `ZhudaRuntimeHost` 擁有的 iframe。host 只接受目前 frame 的訊息來源，儲存 `zhuda:snapshot`；收到 `zhuda:context-lost` 便替換整個 realm，ready 後傳送 `zhuda:restore`。**不是宣稱 Laya 原生 GPU 資源可無損恢復。** 遊戲須序列化所有必要狀態並在重建時還原；同時清空輸入。

opaque-origin 無法讀取 storage 時，boot 安裝 realm 內記憶體替代。這只供引擎初始化，持久進度須由可信 parent 保存。visibility／blur 暫停 presentation 並清輸入；UI deadline 應由權威時鐘重算。

## 材質、shader 與網格

`createSurfaceMaterial` 支援 PBR／Unlit、金屬度／粗糙度／發光、opaque／alpha／additive／cutout、深度寫入與雙面。`Zhuda3D.createMaterial` 也會依 `type` 建立正確類別；未指定時維持 BlinnPhong。

`createSurfaceTexture` 的 color／emission 使用 sRGB，normal／data 使用線性。輸入像素方向保持來源約定；法線使用 Laya／glTF 的切線空間，不自動猜測 DirectX 綠色通道。glTF MR 貼圖的 G=roughness、B=metallic；`packMetallicRoughness` 轉為 Laya 的 R=metallic、A=smoothness。GLB loader 自行處理 glTF 材質，不能再轉一次。

材質借用貼圖；`disposeSurfaceMaterial` 先脫離貼圖再銷毀材質，貼圖由其 owner 釋放。不要對共享材質做受擊變色。

`createCustomSurfaceMaterial({name,vertex,fragment,uniforms,attributes?,instancing?})` 透過 Laya SubShader 接入。相同 shader 名稱及契約可重用；同名不同內容拒絕。uniform map 的型別使用 `Laya.ShaderDataType`；Laya 會注入宣告，adapter 會移除 map 內重複的 scalar/vector uniform。陣列及 struct 等進階宣告依 vendor shader 規範處理。

可執行的水面 shader 在消費端 `src/OceanShader.js`：頂點使用 `Scene.glsl`、`Camera.glsl`、`Sprite3DVertex.glsl`／`VertexCommon.glsl` 的頂點與世界矩陣；clip position 經 `remapPositionZ`。霧使用 `SceneFogInput.glsl`／`SceneFog.glsl`。片段在線性空間計算並用 Laya 的輸出色彩函式。自訂 shader 必須自行實作需要的照明與陰影接收，不能假設加入一段 Three.js shader 就會自動擁有 PBR。

`configureSurfacePasses(camera,[{depth:true,opaqueColor:true}],budget)` 統一該 camera 的深度 prepass／不透明色 copy 請求，回報請求數、啟用數及 budget／depth-unsupported。budget 不足會關閉兩者，消費端必須切換不依賴這些輸入的材質。成本為額外 prepass／copy 的名目計數，實際 draws 仍受陰影／後處理與場景影響。此 API 擁有該 camera 的這兩項設定，避免同時另設 competing owner。shader 使用 vendor 的 camera uniforms 讀取結果。

`ZhudaDynamicMesh` 接收 position／normal／UV／index。每 chunk 限 3..65,535 頂點，使用 UInt16 indices；大型水面自行切塊。`setPosition` 修改 CPU staging，`updateRange` 局部上傳並重算 bounds。`ZhudaInstanceGroup` 使用共享 mesh／material 交給 Laya instancing；`set(id,worldMatrix)` 的穩定 ID 由應用提供，不能使用合批順序當 entity ID。`dispose()` 清除本組節點，mesh／material 的 owner 仍須釋放。

## 模型與非同步生命週期

`ZhudaModelLibrary.instantiate(url,{signal,retries,independentMaterials})` 使用 `ZhudaAssetCache` 去重、引用 lease、最多三次重試、獨立取消與有界 idle cache。辨識 GLB magic，因此 `.bin` 也可載入，外部 JPG 以模型 URL 為基底。3.4.2 的 `_parseglb/_parse` 是版本綁定介面，升級 vendor 時需回歸。

download／parse／ready 與 GPU 已顯示分開：report 的 `gpuReady: requires-first-draw` 明確表示仍需第一次實際 draw。回傳 instance 擁有獨立節點；`independentMaterials:true` 另外複製材質，可 `setTint`。`find(name)` 找節點／骨骼掛點，動畫姿態交由每 instance 的 Animator 管理。驗收的三個模型沒有 animation clips，**未據此驗證骨骼動畫相容性**。

依序釋放 instance，再 dispose library；共享 mesh／texture 在其他 lease 存活時保持有效。`ZhudaRequestSlot.replace(load,commit,discard)` 適合面板，cancel 或新請求後的舊結果只會 discard。`ZhudaResourceScope` 以反向順序釋放，個別錯誤仍繼續清理；`ZhudaSceneRegions` 在區域離開時取消載入並丟棄過期結果。

3.4.2 原本 `WebRender3DProcess.destroy` 漏掉 `_defaultShadowMap`。隔離的 `installLaya342LifecycleFix` 在 boot 後安裝，僅補釋放該 process 擁有的 fallback texture，具冪等性。

## 查詢、輸入、時鐘與掛點

`ZhudaCameraCoordinates` 採 column-major projection×view 與 inverse，screen input／output 都是 CSS pixels，支援 camera normalizedViewport。供給真實 canvas rect 與 backing 尺寸，不自行再乘 DPR。`worldToScreen` 的 visible 供 DOM 血條／名字判斷。

`ZhudaSceneQueries` 從註冊 provider 取得最近命中的 entity／instance ID、法線、位置、距離及 layer。`rayBox` 是 AABB fixture；精確碰撞與 sweep 由遊戲幾何或物理 adapter 注入，不產生新的傷害規則。`ZhudaSurfaceQuery` 接入既有高度／法線採樣器，水面 CPU／GPU 共享座標和外部 time。

`ZhudaPointerInput` 以 pointer ID 分配互斥 role，支援 capture、取消、blur／hidden 清理。DOM overlay 由遊戲排除並攔截，canvas 應 `touch-action:none`。`ZhudaCameraRig` 提供 orbit／follow 及 firstPerson 呈現；pointer lock 不可用時可直接使用拖曳 dx/dy。safe-area CSS 與橫豎版型由消費端管理，沒有固定棋盤版型依賴。

`ZhudaSimulationClock` 是有界固定 tick；`ZhudaSnapshotBuffer` 由外部提供 epoch／sequence／sample time，以插值、有界外插呈現，拒絕重複／倒序快照。遊戲負責 server time offset、render delay、UI deadline 及新局 reset；sample 可以顯式 seek。不要把瀏覽器 arrival time 當網路權威時間。

`ZhudaEventGate` 以 epoch、TTL、capacity 去重，`replay:true` 預設抑制副作用。用它包住遊戲既有 WebAudio 的攻擊／技能事件，保留遊戲的手勢解鎖、背景靜音與釋放規則；引擎不建立第二個音訊權威。

`ZhudaEffectDirector` anchor 可提供 `worldMatrix` 或 quaternion＋scale，offset 經完整父矩陣，支援傾斜、旋轉及非均勻縮放。source resolveAnchor 回傳 null 時停止 target；舊版 XY anchor 繼續有效。骨骼世界矩陣由模型 adapter 提供。

## 場景預算與證據

`sceneQuality`／`applySceneQuality` 配置 DPR、陰影距離／解析度、禁用 MSAA；extraPasses 交給 `configureSurfacePasses`，LOD 使用 `ZhudaDistanceLOD` hysteresis。靜態世界可使用 Laya 原有靜態合批；動態物資使用 instance group。區域切分與可見性不得更改遊戲碰撞、傷害或霧內視野規則。

`ZhudaSceneBudget` 是顯式登記的預算；`inspectSceneResources` 是目前資源的邏輯清單。mesh 借用 vendor accounting，texture 依 RGBA8／mip／cube 估算，render target 假設 color+depth，均不包含 driver overhead。標示 `memoryMeasurement: estimate`，不能當精準 GPU 記憶體。GPU timer 不可用時維持 null／unavailable。

獨立消費端的 browser test 使用真實 WebGL，測水面 CPU／GPU 採樣、三款 `.bin`＋JPG、材質獨立、30 次場景拆除、動態 buffer、擋雨、DPR／橫豎屏對齊、雙指輸入、隔離預覽、context loss 及 opaque sandbox。完整結果／裝置負載見 [接收矩陣](3d-acceptance.md)。
