# 單一 HTML 的 Browser SDK 路線

1.6.0 起，HTML 可以直接載入真正的 LayaAir runtime 和 Zhuda 公開 SDK，
不需要在瀏覽器執行 npm、TypeScript 或依賴 IDE。
[線上入口](https://game.qianlongxundao.com/play/zhuda-engine-sdk/)提供 2D／3D 範例。

## 給 agent 的最短指令

> 要用單一 HTML 開發時，從 [3D 範本](../examples/browser-sdk/3d.html) 或
> [2D 範本](../examples/browser-sdk/2d.html) 開始。保留固定版本 script URL、
> integrity 與 crossorigin，從 `Zhuda` 取得公開 API。不要建立假的 Zhuda 類別、
> 載入另一套渲染器或自行初始化另一個 Laya。先讀公開宣告再呼叫 API。
> 遊戲與隔離預覽共用 Prefab 定義，邏輯時間／輸入／音訊／釋放仍遵守引擎契約。

上述範本是一份 HTML，script 已使用完整 HTTPS 固定網址，可以複製到其他
HTTP 站台。這是**HTML 單檔來源＋網路 SDK**，不是離線完全自包含檔案。
外部 Canvas／Artifacts／嵌入沙箱必須允許此來源的腳本；若其 CSP 不允許，
SDK 無法自行繞過政策，需用允許的附件資源或一般 HTTP 預覽。

## 固定版本與載入方式

本次固定發行：**1.13.0**（電影取樣／光圈快門擷取、離線音軌、Meshopt 與 WebGPU 材質修正；保留 WebGL 與白牌）。
[1.11.0 固定版本](https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/d736a66a3dc72499963c6266914056da/)保留。
[1.10.0 固定版本](https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/d736a66a3dc72499963c6266914056da/)保留。
[1.9.0 固定版本](https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/d736a66a3dc72499963c6266914056da/)保留。
[1.8.0 固定版本](https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/d736a66a3dc72499963c6266914056da/)、
[1.7.0 固定版本](https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/d736a66a3dc72499963c6266914056da/)及 1.6.0 保留。

`https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/d736a66a3dc72499963c6266914056da/`

| 檔案 | 包含內容 | 未壓縮 bytes |
| --- | --- | ---: |
| `zhuda-2d.js` | core、2D WebGL、UI、公開 Zhuda SDK | 1,682,365 |
| `zhuda-3d.js` | 上述內容加上 3D、3D WebGL | 2,443,999 |
| `zhuda-3d-gltf.js` | 3D 加上 glTF、postProcess | 2,603,847 |
| `zhuda-2d-webgpu.js` | 2D WebGPU、UI、內嵌 Shader WASM | 10,260,005 |
| `zhuda-3d-webgpu.js` | 2D/3D WebGPU、UI、內嵌 Shader WASM | 11,284,846 |
| `zhuda-3d-gltf-webgpu.js` | WebGPU 加上 glTF、postProcess、Shader WASM | 11,444,694 |

基本 2d／3d profile（含 WebGPU 變體）沒有打入額外的原生 Spine、物理、粒子、glTF 或其他 plugin。模型展示可選新增的 `3d-gltf` profile；
[可複製的 HTML 模型檢視器](../examples/browser-sdk/3d-gltf.html)
附帶相容性報告、動畫／Morph、三模式與重載測試。
WebGPU 用 [3D GPU 範本](../examples/browser-sdk/3d-webgpu.html)、[2D GPU 範本](../examples/browser-sdk/2d-webgpu.html) 或 [GPU 模型檢視器](../examples/browser-sdk/3d-gltf-webgpu.html)。
`ZhudaEngine.boot({renderer:"webgpu"})` 必須對應 GPU bundle；詳見 [後端／失敗／Windows 驗收契約](webgpu.md)。

電影 API 請用含 glTF／postProcess 的 `3d-gltf` 或 `3d-gltf-webgpu`，依
[電影工作流](cinematics.md)擷取畫格與音軌。MP4 編碼是 Node CLI，不能在站內
沙箱直接呼叫 FFmpeg；下載／檔案 IO 也受宿主政策限制。

公共函式仍與 package root 同一份；功能若依賴未載入的底層模組，不能只因
命名空間有函式就宣稱該功能可用。需要其他未打入的模組時走既有 npm consumer pipeline。

```html
<script
  src="https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/d736a66a3dc72499963c6266914056da/zhuda-3d.js"
  integrity="sha384-DBijLWO+a4DZvRHo0QRD++5P/t9No6LOXJqGYKi8i9GaifurhKLtuVFlSpXphP0C"
  crossorigin="anonymous"></script>
<script>
const { ZhudaEngine, Zhuda3D } = Zhuda;
async function main() {
  const context = await ZhudaEngine.boot({
    container: '#game',
    width: 640, height: 480, dprCap: 1.5,
    features: [...ZhudaBundle.features]
  });
  const scene = Zhuda3D.createScene3D(context.rootScene);
  Zhuda3D.createCamera(scene, {position: [0, 2, 6], rotationEuler: [-15, 0, 0]});
  // Author and instantiate your Prefab through ZhudaPrefabLibrary here.
  context.runtime.start(() => {});
  window.addEventListener('pagehide', () => context.dispose(), {once: true});
}
main().catch(console.error);
</script>
```

HTML 須先建立具有明確尺寸的 `#game` 容器；完整可畫出內容的例子見上方範本。
使用普通 script 並維持順序；不要加 async/defer 後立即在下一段 inline script
使用尚未載入的 `Zhuda`。同頁只載一份 bundle，重複／既有 Laya 會在改寫前明確拒絕。

`Zhuda` 的 runtime exports 與公開 ESM 入口相同，並未再寫一套 facade。
`ZhudaBundle` 回報版本、profile、renderer、模組清單、來源指紋與打包器版本。
bundle 預設掛載響應式豬大 × LayaAir Logo。1.10.0 可在載入前設定
`window.ZhudaBranding={mode:"custom",brandId:"client",logo:"./logo.svg"}`，
或 `{mode:"none"}`；詳見[白牌契約](white-label-themes.md)。不要自行放入同名 splash。

`sdk-manifest.json` 保存每份 bundle 的 SHA-256、SRI SHA-384、大小和來源檔雜湊。
固定版本不覆寫；不要在正式遊戲使用會變動的 latest／launch URL 作為 script URL。
SRI 不吻合時瀏覽器拒絕執行，不會悄悄改用另一個引擎。

## game.qianlongxundao.com 的兩種情境

- 外部 HTML 載入本站 SDK：本次已實測跨來源腳本＋SRI、2D/3D WebGL 及 WebGPU。
  JS 回應包含正確 MIME、`Access-Control-Allow-Origin: *`、跨來源資源政策與
 一年 immutable 快取標頭。Cloudflare 邊緣快取是否命中需看實際回應。
- 站內遊戲沙箱：只允許**自己發行版本目錄**的資源。因此部署遊戲時，將同一份
  bundle 放進遊戲 ZIP 並改為相對 `src`，SRI 保持不變。SDK 入口的同版本 demo
  已在此沙箱實測。此功能沒有放寬平台 CSP、cookie、storage 或後端政策。

站台的內容來源仍是既有託管服務，Cloudflare 是 HTTPS／Tunnel 與快取入口，
不宣稱已改成獨立 Workers/R2 CDN。離線來源、首次下載、快取與可用性受站台環境影響。
遊戲素材仍走自己的 AssetProvider；引擎版本目錄不是遊戲資產庫。

## 建置、型別與正式交付

```sh
# engine checkout
npm run build
npm run build:browser
# installed public package
zhuda-laya-browser-sdk --out ./sdk-release
# optional: --profile 2d, 3d, 3d-gltf, 2d-webgpu, 3d-webgpu, 3d-gltf-webgpu
```

預設輸出 `dist/browser/<version>`。相同內容可以重用；若同目錄已有不同產物，
指令拒絕覆寫，請換新的輸出目錄。esbuild 固定為 0.27.1，工具版本不一致會拒絕。
獨立安裝 tarball 的 CLI 與引擎 checkout 生成的完整產物已逐 byte 比對一致。

編輯器型別可以使用已安裝套件的
`/// <reference types="zhuda-laya-engine/browser" />`，或直接 reference 該套件的
`packages/types/browser.d.ts`。這只是既有 public declarations 的 全域 namespace；
不需要 `Laya: any`。1.7.0 已通過完整 `skipLibCheck:false` 宣告稽核。

**單一 HTML 的啟動成功是 browser runtime 證據，並不等於完成消費專案門禁。**
既有 Doctor 針對 npm／TS consumer，不把普通 HTML 直接當成完整檢查通過。
正式遊戲依 [consumer route](consumer-route.md) 保留版本、型別、Prefab 比對、
Scene／操作及目標裝置證據。Browser 範例的按鈕／計數也不能代替你的遊戲驗收。

1.11.0 結果見 [WebGPU 驗收](plans/records/webgpu-delivery/verification.md)。Windows 硬體尚待實機報告。
1.10.0 結果見[白牌與量產基礎驗收](plans/records/slot-factory-foundation/verification.md)。
1.9.0 結果見[模型展示與 SDK 驗收](plans/records/asset-showcase-hardening/verification.md)。
1.8.0 結果見 [群體與 SDK 發行驗收](plans/records/crowd-runtime-hardening/verification.md)；
1.7.0 結果見 [當輪驗收記錄](plans/records/astra-runtime-feedback/verification.md)；
原始 Browser SDK 範圍見 [1.6.0 記錄](plans/records/browser-sdk-delivery/verification.md)。

站內沙箱禁止 Worker，因此 `ZhudaWorkerFrameDriver` 必須由 consumer 在支援的
外部頁面選用，或明確回退到 RAF。Worklet／Blob media 也受各站 CSP 約束；
此發行不更動伺服器沙箱，不能宣稱所有音訊／背景策略在站內都已驗收。
