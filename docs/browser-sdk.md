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

本次固定發行：

`https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/02b62daf1d3a8cdac423f35428454ce8/`

| 檔案 | 包含內容 | 未壓縮 bytes |
| --- | --- | ---: |
| `zhuda-2d.js` | core、2D WebGL、UI、公開 Zhuda SDK | 1,552,551 |
| `zhuda-3d.js` | 上述內容加上 3D、3D WebGL | 2,314,185 |

這兩個基本 profile 沒有打入額外的 Spine、物理、粒子、glTF 或其他 plugin。
公共函式仍與 package root 同一份；功能若依賴未載入的底層模組，不能只因
命名空間有函式就宣稱該功能可用。需要這些模組時走既有 npm consumer pipeline。

```html
<script
  src="https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/02b62daf1d3a8cdac423f35428454ce8/zhuda-3d.js"
  integrity="sha384-WGJs+JEV38Iv3tN6SPf8Hs+K+Gk0RgMtprFi6K4fxXPSXThpr2KDf88ocAFO4k/s"
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

`Zhuda` 的 130 個 runtime exports 與公開 ESM 入口相同，並未再寫一套 facade。
`ZhudaBundle` 回報版本、profile、模組清單、來源指紋與打包器版本。
bundle 自動掛載共用的響應式豬大 × LayaAir Logo；不要自行放入同名 splash。

`sdk-manifest.json` 保存每份 bundle 的 SHA-256、SRI SHA-384、大小和來源檔雜湊。
固定版本不覆寫；不要在正式遊戲使用會變動的 latest／launch URL 作為 script URL。
SRI 不吻合時瀏覽器拒絕執行，不會悄悄改用另一個引擎。

## game.qianlongxundao.com 的兩種情境

- 外部 HTML 載入本站 SDK：本次已實測跨來源腳本＋SRI、2D/3D WebGL。
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
# optional: --profile 2d or --profile 3d
```

預設輸出 `dist/browser/<version>`。相同內容可以重用；若同目錄已有不同產物，
指令拒絕覆寫，請換新的輸出目錄。esbuild 固定為 0.27.1，工具版本不一致會拒絕。
獨立安裝 tarball 的 CLI 與引擎 checkout 生成的八個檔案已逐 byte 比對一致。

編輯器型別可以使用已安裝套件的
`/// <reference types="zhuda-laya-engine/browser" />`，或直接 reference 該套件的
`packages/types/browser.d.ts`。這只是既有 public declarations 的 全域 namespace；
不需要 `Laya: any`。現有 vendor 的 skipLibCheck 邊界仍保持。

**單一 HTML 的啟動成功是 browser runtime 證據，並不等於完成消費專案門禁。**
既有 Doctor 針對 npm／TS consumer，不把普通 HTML 直接當成完整檢查通過。
正式遊戲依 [consumer route](consumer-route.md) 保留版本、型別、Prefab 比對、
Scene／操作及目標裝置證據。Browser 範例的按鈕／計數也不能代替你的遊戲驗收。

完整本輪結果見 [驗收記錄](plans/records/browser-sdk-delivery/verification.md)。
