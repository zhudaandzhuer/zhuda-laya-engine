# 群體角色、特效預算與效能驗收（1.8.0）

這一版提供群體**呈現**、模型／動畫共享、可降頻粒子和可匯出的量測工具。
它不提供國戰傷害規則、AOI 伺服器、帳號／交易或 2,000 CCU 保證。
100 個角色能否達到指定品質與幀率，必須以消費端模型、場景、設備和有效測量時間接收。
實測數字與尚未完成的門檻見 [本次驗證紀錄](plans/records/crowd-runtime-hardening/verification.md)。

## 選擇開發路線

| 需求 | 公開接入方式 | 必須另外驗收 |
| --- | --- | --- |
| 2D／3D 單人遊戲 | [獨立 consumer](consumer-route.md)、Prefab gate、既有 runtime/provider/input/audio | 本遊戲資產、規則、流程與目標裝置 |
| 單 HTML 2D／程序化 3D | [Browser SDK](browser-sdk.md) 的固定 URL 與 SRI | CSP、離線需求、HTML 的來源完整性與遊戲驗收 |
| glTF 骨骼角色／群體 | npm consumer，features 加 `gltf`；本頁 API | 真實模型與動畫、裝備、材質、可見數、影子與特效成本 |
| 多人客戶端 | `ZhudaRemoteCharacterPresenter` 接 consumer transport | 伺服器時間同步、權威、AOI、封包上限、重連與安全 |
| Windows Native／Steam | 下方「待驗證的平台接入」 | Windows 原生包、Extension ABI、Steam 啟動與 Overlay |

基本 browser `3d` profile **沒有**包含 glTF runtime。不要只因為公開 namespace
有 `ZhudaModelLibrary`，就把未載入的底層模組當作可用。不要混入另一套渲染器。

## 模型與動畫的所有權

```ts
import { DirectoryAssetProvider, ZhudaModelLibrary } from 'zhuda-laya-engine';
const provider = new DirectoryAssetProvider({
  baseUrl: './assets/', manifest: verifiedManifest
});
const models = new ZhudaModelLibrary({ provider, maxIdle: 2, timeoutMs: 15000 });
const actor = await models.instantiate('characters/scout.glb', { signal });
scene.addChild(actor.node);
const hand = actor.find('RightHand'); // 找不到時為 null，使用者先驗證命名骨骼
// 卸載時先釋放實例，最後才關閉 library/provider。
actor.dispose(); models.dispose(); provider.dispose();
```

- `provider` 是借用的；library 不會替呼叫者銷毀它。模型 ID 經同一個 provider，
  可驗證 bytes/SHA，無須在場景硬編 CDN 路徑。
- provider 模式接受自包含 GLB 或內嵌 data URI 的 glTF；外部 buffer/image URI
  會明確失敗，請先打包為 GLB。這一版沒有偷偷繞過 provider 下載相依檔。
- `new ZhudaModelLibrary(3)` 與 URL 載入仍可用，供舊 consumer 遷移。
  deadline 現在包含下載及解析，預設 15 秒；大模型可顯式調整。
- 一次解析產生一份離場模板；各角色複製自己的節點與 Animator 狀態，
  共用 mesh、material 和 animation clip。不同角色可以播放不同片段／相位。
  這不是 GPU 骨骼合批，也不是動畫紋理烘焙。
- `independentMaterials` 預設 false；需要個別改材質時才開啟。
  `setTint` 仍要求獨立材質，不能改到其他角色的共用材質。
- 取消、逾時、解析失敗、晚到完成不會掛回場景。逾時呼叫者不會取消仍在等待的
  其他租約。不能中斷的 native 解析完成後才真正釋放其資源。
- `dispose` 會完成這棵模型樹的 native 延遲 component teardown，再釋放 cache。
  不會清空全場景的 destroy queue。glTF 動畫片段在最後引用歸零時明確釋放。
- `inspectSceneResources().animation` 額外列出 clip/material 數量；bytes 仍是估算，
  不等於驅動程式或作業系統的 GPU 記憶體量測。

`ZhudaInstanceGroup.set` 為每個 ID 保留一份矩陣；重複更新不再產生陣列或矩陣物件。
它仍使用 Laya 節點，由底層依 mesh/material/pass 決定能否合批。移除群組只釋放
節點，不銷毀借用的 mesh/material。透明、不同材質、不同幾何或 SkinnedMesh
不能直接套用普通不透明網格的合批測量。

## 共用呈現排程與動畫 LOD

```ts
import { ZhudaCrowdScheduler, ZhudaAnimatorLOD } from 'zhuda-laya-engine';
const scheduler = new ZhudaCrowdScheduler({
  tiers: [
    { maxDistance: 20, updateHz: 60, animation: 'full' },
    { maxDistance: Infinity, updateHz: 15, animation: 'low', animationInterval: 4 }
  ],
  maxUpdatesPerFrame: 50, hysteresis: 2, maxDeltaSeconds: .25
});
const lod = new ZhudaAnimatorLOD(animator);
scheduler.register('remote-42', {
  update: dt => updatePresentationOnly(dt),
  setTier: tier => lod.set(tier?.animation ?? 'paused', tier?.animationInterval ?? 2)
}, { visible: true, distance: 12, priority: 1 });
context.runtime.start(dt => scheduler.update(dt));
// 可見性由相機投影／視錐／consumer AOI 計算；只控制呈現。
scheduler.setState('remote-42', { visible: false, distance: 50 });
// 回合／場景卸載
scheduler.remove('remote-42'); lod.dispose(); scheduler.dispose();
```

`updateHz` 控制 callback，`maxUpdatesPerFrame` 限制一次 callback 數，
以到期程度優先、相同到期程度再依 priority／ID 排序。這不是毫秒成本保證；
一個昂貴 callback 仍可能超時。回傳 deferred／hidden／droppedSeconds 可監測負載。
`update` 的 delta 來自現有 session／layer，不建立第二個時鐘，也不能用這個排程更新傷害。

`ZhudaAnimatorLOD` 使用 Laya 3.4.2 native Animator manager：`full` 正常、`low`
每 N 個引擎 frame 更新、`paused` speed 0。**frame divisor 不等於固定 Hz**，
低頻時的動畫事件與骨骼掛點也會降頻，不能拿動畫事件做權威命中。
Laya 原本的視錐 culling 仍適用。adapter 不會手動再 tick Animator。
若 Animator 原本不是預設模式，建構時傳 `new ZhudaAnimatorLOD(animator, { updateMode, lowUpdateInterval })`；
原生這兩個屬性只有 setter，不能假裝能讀回。解除後還原原始 speed 和明示模式。

## 遠端快照呈現

`ZhudaRemoteCharacterPresenter<T>` 組合上述 scheduler 與既有 `ZhudaSnapshotBuffer<T>`。
建構傳 `epoch`、`interpolate`、`maxExtrapolation`、`snapshotCapacity`、
`staleAfterSeconds`，以及相同的 tiers／budget。

1. `register(id, { present(value, mode, stale), setTier }, state)` 登記穩定角色 ID。
2. transport 收包後 `push(id, { epoch, sequence, time, value }, teleport)`；
   舊 sequence、倒退 time 或舊 epoch 不會覆蓋新狀態，舊瞬移包也不能清掉新 buffer。
3. session 每幀呼叫 `update(layerDelta, serverSampleTime)`；時間同步與插值延遲由
   consumer 明示提供。丟包時最多外插指定秒數，超過後保留有限位置並回報 stale。
4. 重連 `reset(newEpoch)`，AOI 離開 `remove(id)`；移除後的封包不會重建角色。

它不建立連線、不猜 server time、不做 AOI 或碰撞。參考 fixture 的 HTTP server
只提供 100 個位置、可重現延遲／丟包／epoch／瞬移；不是百位連線玩家或 MMO 後端。

## 特效降級與粒子成本

`ZhudaEffectBudget.allocate` 接受 `minimumScale`（0..1）和 consumer 的 `fallbackId`。
先保留所有可見請求的最低額度，再分配餘量；最低額度彼此衝突時仍按 priority 排序。
回傳 `mode: full | reduced | fallback | culled`、`fallbackRequired`，
讓遊戲必須處理關鍵警示放不下的情況。引擎不會自行猜哪些招式重要。

簡化警示需另有獨立的幾何／繪製預算。不要在收到 fallback 後又播放原版。
`coverage` 仍是 caller 的覆蓋率估算，不是 GPU overdraw 量測。
`particleLimit` 限制新出生，活粒子自然退場，所以不是即時存活數硬上限。
降低顯示不會改變伺服器傷害、碰撞、天氣或其他遊戲權威。

```ts
const system = new ZhudaParticleSystem3D(spec, { frequencyHz: 30, maxSubsteps: 4 });
system.setSimulation({ frequencyHz: 60 });
system.update(effectLayerDelta);
// lastSubsteps / simulatedSteps / droppedSeconds 可證明實際工作量與被丟棄時間。
```

預設仍是 120 Hz、每次最多 30 子步、接受最多 .25 秒。
改頻率會丟棄不足一步的餘數並計入 droppedSeconds；超過子步上限的視覺時間也會丟棄，
不把欠債留到後面暴衝。不同頻率並非數值等價；同一頻率仍可重播固定 seed。
這適用視覺粒子，不能用於精確遊戲碰撞。

3D particle renderer 初始不提交空網格；只上傳活躍頂點並設定有效 index range。
固定 billboard index buffer 不重傳；ribbon 只傳有效 index 區段。
容量不隨活粒子數重建，收縮／清空／再增長不會繪出舊三角形。

## 可重現量測

`new ZhudaRuntimeProfiler({capacity:60000})` 保留有界環形視窗；預設仍為 600。
`attach(gl)` 統計真實 WebGL（含 ANGLE instancing）draw calls 和 triangle primitive，
`enableGpuTiming(webgl2)` 可選非同步 timer query；不支援、disjoint、context lost
或查詢尚未完成時 GPU 保持缺值，不用 CPU 時間代替。查詢同時有其他擁有者時跳過。

每個有效 draw scope 呼叫 `beginFrame()`／`endFrame(frameMs, cpuMs, {heapBytes})`。
**不要用跨兩個 RAF 的整段等待當 GPU draw scope**。fixture 包住公開 `Stage.render`，
frameMs 是兩次 stage 開始的間隔；cpuMs 是 stage 更新／動畫／draw submission，
consumer session callback 另計。GPU scope 是這次 stage 提交的指令。

`report()`／`exportJSON(metadata)` 提供 P50/P95/P99、總樣本、保留／淘汰數、
總時長／視窗時長和原始 frame／CPU／draw／GPU／heap。
百分位採 nearest-rank。CPU timing／heap 來源是 caller；沒 attach 就明示 draw unavailable。
JS heap 不包含 native decoder、驅動或 GPU 記憶體；WebGL multi-draw extension 未攔截。

從 repo 重現（Node 24+、Chrome、Python 3 + Pillow；模型下載至 repo 外）：

```sh
npm ci
npm run verify
CROWD_FIXTURE_DIR=/absolute/external/crowd CROWD_SECONDS=20 node scripts/verify-crowd-browser.mjs
# 個別負載可加長，結果永遠標示實際有效採樣秒數
CROWD_FIXTURE_DIR=/absolute/external/crowd-long CROWD_SCENARIOS=budget-100 CROWD_SECONDS=600 node scripts/verify-crowd-browser.mjs
```

harness 使用 `npm pack` 產物的獨立 strict consumer、公開 compiler、ESM/CJS exports；
驗證實際 Animator 時間和骨骼局部姿勢有變、非空像素、隔離重建比對、
30 次完整模型重載、清空引用、GPU 繪製。`bare-100` 另產生一段 2 秒 Chrome trace，
不把 trace overhead 納入已截取的統計。每個 scenario 使用獨立 browser profile。

參考模型 Cesium Man（Cesium, 2017, CC-BY-4.0，logo 另有商標聲明），固定來源
revision 與 SHA 寫入 inventory。4,672 三角面、19 骨骼、1 段 locomotion；
不是攻擊／死亡／換裝商業美術。模式保留相同預配置 FX pools，`bare` 不啟用特效或裝備。
單獨的裝備／警示／粒子選擇與群體使用同一份 character recipe；初次擷取是中性 fixture
校準基準，不是甲方美術核准。原始資產、圖片與大型測量資料保存在外部 evidence 目錄。
這個模型 fixture 使用獨立隔離入口與明示來源比對；它不是 `ZhudaPrefabLibrary` 的
2D／程序化 3D preview 報告，不能直接冒充該 compiler gate 的通過憑證。
正式遊戲仍需依自己的 Prefab 接線完成同源、狀態與 Scene 的接收。

## 待驗證的平台接入

[官方 LayaAir-Steam 範例](https://github.com/layabox/LayaAir-Steam)目前說明 LayaPro 3.4.1
專案、LayaNative Extension、Windows WebGL 和 Steam 啟動流程。
這些不代表本 SDK 的獨立 consumer 已通過 Native／Steam。

後續接入須固定 SDK 與 Native runtime 版本，以同一 consumer bundle／模型先在
Windows native 載入；確認相對 provider URL、WebGL、字型、音訊、輸入、失焦與釋放。
再由 consumer 注入 Steam adapter，設定自己的 AppID 與 Extension DLL，
從桌面 Steam 啟動驗證 Overlay／帳號／排行榜。Web 不具 Extension 時要明示 unavailable。
不得因上游有示範就宣稱本 repo 已可一鍵輸出或已驗收 Steam。

目前沒有 Windows／Steam 原生包、指定 RTX3060／GTX1650 測量、100 人真機手機測量，
也沒有本遊戲 10 分鐘戰鬥 SLA 或 30 分鐘 native resource trace。
這些是採用前需要補齊的接收門檻；可沿用本次測量格式，不能將短測自動提升為 PASS。
