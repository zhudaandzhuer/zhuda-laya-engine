# Agent-friendly 2D／3D 地形與 Shader 契約

這份文件定義可由 agent 產生、驗證和拆除的地形資料與 shader 邊界。引擎只擁有資料、可見 chunk、查詢和 GPU 資源生命週期；遊戲仍擁有碰撞、傷害、移動、生成種子與勝負規則。

## 2D tile terrain

`Terrain2DSpec` 是可序列化的地圖格式。`dimension: 2`、`width`／`height` 是 tile 數，`origin` 是 local 左上角，`palette` 的 `0` 代表空 tile，`layers` 以同一個 row-major 陣列保存各層。

```ts
import { ZhudaTerrain2D, ZhudaTerrain2DRenderer } from "zhuda-laya-engine";

const map = new ZhudaTerrain2D({
  schemaVersion: 1, dimension: 2,
  width: 256, height: 128, tileSize: 32, origin: [-4096, -2048],
  palette: [
    { id: 1, color: "#2f9e44" },
    { id: 2, uv: [0, 0, .25, .25], blocked: true },
  ],
  layers: [
    { id: "ground", tiles: Array(256 * 128).fill(1) },
    { id: "objects", tiles: Array(256 * 128).fill(0) },
  ],
});
const view = new ZhudaTerrain2DRenderer(map, {
  parent: scene2D,
  atlas: atlasTexture,
  chunkCells: 16,
  maxResidentChunks: 64,
});
view.setView({ x: -512, y: -256, width: 1600, height: 900 });
map.paintRect("objects", { x: 20, y: 12, width: 3, height: 2 }, 2);
view.flush();
```

`localToTile`／`tileToLocal` 是唯一的座標轉換入口。`setTile` 和 `paintRect` 會檢查邊界、拒絕未知 palette ID，並只標記相交 chunk。renderer 只擁有自己的 `Sprite` 和 graphics commands；atlas、material 和遊戲規則由呼叫方擁有。離開場景時呼叫 `view.dispose()`。

## 3D heightfield terrain

`ZhudaHeightfield` 用 deterministic seed 或明確的 vertex heights 保存高度。`origin` 是 X/Z local 原點，`cellSize` 是格距。`sample` 和 `raycast` 使用 renderer 的同一條三角形對角線，因此 CPU 查詢不會和畫面使用不同的插值。

```ts
import { ZhudaHeightfield, ZhudaTerrain3D, shaderRecipes,
  ZhudaShaderMaterial } from "zhuda-laya-engine";

const field = ZhudaHeightfield.generate({
  cellsX: 256, cellsZ: 256, cellSize: 1,
  origin: [-128, -128], seed: 42, amplitude: 8, frequency: .035,
});
const shader = new ZhudaShaderMaterial(shaderRecipes.terrain3D);
const terrain = new ZhudaTerrain3D(field, {
  parent: scene3D, material: shader.material,
  chunkCells: 32, maxResidentChunks: 64,
});
terrain.setRegion({ minX: -64, minZ: -64, maxX: 64, maxZ: 64 });
const hit = terrain.raycast(cameraRay, 200);
```

`setRegion` 是 streaming 的 ownership 邊界。它會建立所需 chunk、釋放離開範圍的 chunk，並拒絕超過 `maxResidentChunks` 的請求。`setHeight`／`applyPatch`／`brush` 會通知相交 chunk；呼叫 `flush()` 才把 dirty vertex range 局部上傳並刷新 bounds。LOD stride 只接受 `1`、`2`、`4`，同一個 terrain 的 resident chunks 使用同一 stride，避免邊界出現裂縫。

`queryProvider(entityId, layer)` 回傳穩定的 `instanceId`（`cellX:cellZ`），不使用 batch 順序。`raycast` 先把世界 ray 轉到 terrain local，再把距離換回世界單位，所以旋轉、父層和非均勻縮放下仍可用；未 resident 的 cell 不會命中。`dispose()` 釋放 chunk mesh、root node 和 field listener，但不銷毀借用的 material。

## Shader recipe 與使用規則

`ZhudaShaderSpec` 的 `dimension` 必須明確為 `2` 或 `3`。`surface` 只提供 `zhudaSurface(...)` function body；attribute、uniform 宣告、camera transform、clip、fog 和 output transform 由 LayaAir 3.4.2 template 提供。自訂 uniform 必須使用 `u_Zhuda` 前綴且指定 scalar/vector/texture2D 型別：

```ts
const mat = new ZhudaShaderMaterial({
  schemaVersion: 1,
  name: "ZhudaWaterTint",
  dimension: 3,
  uniforms: { u_ZhudaTint: { type: "vec4", value: [0.1, .45, .8, 1] } },
  surface: `vec4 zhudaSurface(vec2 uv, vec3 p, vec3 n) {
    float fresnel = pow(1.0 - max(dot(n, vec3(0., 1., 0.)), 0.), 3.);
    return vec4(u_ZhudaTint.rgb * (.7 + .3 * fresnel), u_ZhudaTint.a);
  }`,
});
mat.setUniform("u_ZhudaTint", [0.05, .3, .7, 1]);
```

引擎內建 `terrain3D`、`textured3D`、`dissolve3D` 和 `tint2D` recipes。`validateShaderSpec` 只做 JSON／結構檢查；它不代表 GPU 編譯成功。要宣稱可用，必須在真實 WebGL draw 中建立 material、畫出一個 mesh／graphics，並保留 compile diagnostics。`ZhudaShaderMaterial.report().gpuStatus` 在第一次 draw 前固定為 `requires-first-draw`。

2D template 保留 graphics vertex color、atlas UV、texture-array、premultiplied alpha、clip 和 gamma 分支；3D template 保留 world transform、normal、fog 和 `outputTransform`。自訂 shader 仍需自行實作需要的光照與陰影，不能把 Three.js shader 原始碼直接貼入 `surface`。

材質借用外部 texture；`setTexture` 只更新 binding，`dispose` 會解除 texture slot 後銷毀 material。shader pass 需求要透過 `configureSurfacePasses` 申請並受 camera budget 約束；深度或 opaque color 被拒絕時，消費端必須切換不依賴該輸入的 recipe。

## Agent 驗證順序

1. 先呼叫 MCP `validate_terrain_spec` 或 `validate_shader_spec`，修完資料契約錯誤。
2. 用獨立 fixture 建立 map／field、renderer、material；確認 `report()`、`residentChunks` 和 `gpuStatus`。
3. 在真實 WebGL draw 驗證 2D atlas、3D terrain、uniform 變更和故意錯誤 GLSL 的 diagnostic。
4. 驗證 edit seam、LOD 1／2／4、負 origin、旋轉＋非均勻縮放 ray、region unload。
5. 先釋放 instance／renderer，再釋放 material／texture owner；重複建立／銷毀至少 30 次後，資源數應回到有界穩態。

完整可執行 fixture 在獨立消費端的 `tests/terrain.mjs`；展示與遊戲資產留在消費專案，不放入引擎 repo。
